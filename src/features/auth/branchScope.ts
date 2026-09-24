import { ApiError } from '../../shared/api/client'
import type { AuthUser } from './types'

export const ALL_BRANCHES_PERMISSION = 'sucursales.todas'

type BranchLike = { id: string }
type ScopedUser = Pick<AuthUser, 'globalAccess' | 'role' | 'branch'> & {
  branchScope?: AuthUser['branchScope']
}
/**
 * Either the authenticated user or its `branchScopeKey()`. Effects receive the
 * key (a primitive) so they do not depend on the user object identity.
 */
export type BranchScopeInput = ScopedUser | string | null | undefined

const ALL = '*'

/**
 * Branch ids the user may see and operate, or `null` for every branch.
 * The backend (`user.branchScope`) is the source of truth and enforces the
 * same rule; this only keeps selectors and lookups consistent with it.
 */
export function allowedBranchIds(scope: BranchScopeInput): string[] | null {
  if (typeof scope === 'string') {
    return scope === ALL ? null : scope.split(',').filter(Boolean)
  }
  const user = scope
  if (!user) return null
  if (user.branchScope) {
    return user.branchScope.allBranches
      ? null
      : user.branchScope.branches.map((branch) => branch.id)
  }
  // Session restored from an older payload without branchScope.
  if (
    user.globalAccess ||
    user.role.permissions.includes(ALL_BRANCHES_PERMISSION)
  ) {
    return null
  }
  return user.branch ? [user.branch.id] : null
}

/** Stable primitive for effect dependencies (the user object may change). */
export function branchScopeKey(scope: BranchScopeInput) {
  const allowed = allowedBranchIds(scope)
  return allowed ? allowed.join(',') : ALL
}

export function hasAllBranches(scope: BranchScopeInput) {
  return allowedBranchIds(scope) === null
}

export function filterAllowedBranches<T extends BranchLike>(
  scope: BranchScopeInput,
  branches: T[],
): T[] {
  const allowed = allowedBranchIds(scope)
  if (!allowed) return branches
  return branches.filter((branch) => allowed.includes(branch.id))
}

/** True when the selector must stay fixed: a scoped user with one branch. */
export function isBranchSelectionLocked(
  scope: BranchScopeInput,
  branches: BranchLike[],
) {
  return (
    !hasAllBranches(scope) && filterAllowedBranches(scope, branches).length === 1
  )
}

/**
 * Preferred default: the user's own branch if allowed, else the only one.
 * `userBranchId` is only needed when `scope` is a key.
 */
export function defaultBranchId(
  scope: BranchScopeInput,
  branches: BranchLike[],
  userBranchId?: string | null,
) {
  const ownBranchId =
    userBranchId ?? (typeof scope === 'object' ? scope?.branch?.id : undefined)
  const options = filterAllowedBranches(scope, branches)
  if (ownBranchId && options.some((branch) => branch.id === ownBranchId)) {
    return ownBranchId
  }
  const [only] = options
  return options.length === 1 && only && !hasAllBranches(scope) ? only.id : ''
}

/** Sales lookups (sellers/contacts): personnel of the allowed branches. */
export function filterPeopleInScope<
  T extends { branch?: BranchLike | null; branches?: BranchLike[] },
>(scope: BranchScopeInput, people: T[]): T[] {
  const allowed = allowedBranchIds(scope)
  if (!allowed) return people
  return people.filter((person) => {
    // Without branch data there is nothing to check: the API already scoped it.
    if (person.branch === undefined && person.branches === undefined) return true
    return [person.branch ?? null, ...(person.branches ?? [])].some(
      (branch) => branch !== null && allowed.includes(branch.id),
    )
  })
}

export function branchScopeErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  if (error.details?.code === 'BRANCH_OUT_OF_SCOPE') {
    return 'No podés ver ni cargar datos de una sucursal distinta a las tuyas.'
  }
  if (error.details?.code === 'BRANCH_REQUIRED') {
    return 'Seleccioná la sucursal.'
  }
  return null
}
