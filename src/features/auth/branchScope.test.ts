import { describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/api/client'
import {
  allowedBranchIds,
  branchScopeErrorMessage,
  branchScopeKey,
  defaultBranchId,
  filterAllowedBranches,
  filterPeopleInScope,
  isBranchSelectionLocked,
} from './branchScope'
import type { AuthUser } from './types'

const sanMiguel = { id: 'sm', code: 'SAN_MIGUEL', name: 'San Miguel' }
const delViso = { id: 'dv', code: 'DEL_VISO', name: 'Del Viso' }
const branches = [sanMiguel, delViso]

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    email: 'administrativa@luma.test',
    name: 'Administrativa',
    active: true,
    globalAccess: false,
    organization: {
      id: 'o1',
      code: 'LUMA_CENTRAL',
      name: 'Luma',
      type: 'CASA_CENTRAL',
    },
    role: {
      id: 'r1',
      code: 'ADMINISTRATIVA',
      name: 'Administrativa',
      system: true,
      permissions: [],
    },
    branch: sanMiguel,
    branchScope: { allBranches: false, branches: [sanMiguel] },
    ...overrides,
  }
}

function withoutScope(value: AuthUser): AuthUser {
  const copy = { ...value }
  delete copy.branchScope
  return copy
}

describe('alcance por sucursal (front)', () => {
  it('muestra solo las sucursales permitidas y fija el selector con una sola', () => {
    const administrativa = user()
    expect(filterAllowedBranches(administrativa, branches)).toEqual([sanMiguel])
    expect(isBranchSelectionLocked(administrativa, branches)).toBe(true)
    expect(defaultBranchId(administrativa, branches)).toBe('sm')
  })

  it('habilita el selector cuando el usuario tiene más de una sucursal', () => {
    const gerente = user({
      role: {
        id: 'r2',
        code: 'GERENTE',
        name: 'Gerente',
        system: true,
        permissions: [],
      },
      branchScope: { allBranches: false, branches: [sanMiguel, delViso] },
    })
    expect(filterAllowedBranches(gerente, branches)).toHaveLength(2)
    expect(isBranchSelectionLocked(gerente, branches)).toBe(false)
    expect(defaultBranchId(gerente, branches)).toBe('sm')
  })

  it('deja todas las sucursales al administrador sin sugerir una', () => {
    const administrador = user({
      branch: null,
      branchScope: { allBranches: true, branches: [] },
    })
    expect(allowedBranchIds(administrador)).toBeNull()
    expect(filterAllowedBranches(administrador, branches)).toEqual(branches)
    expect(isBranchSelectionLocked(administrador, branches)).toBe(false)
    expect(defaultBranchId(administrador, branches)).toBe('')
    expect(branchScopeKey(administrador)).toBe('*')
  })

  it('usa la sucursal del usuario si la sesión no trae branchScope', () => {
    const legacy = withoutScope(user())
    expect(allowedBranchIds(legacy)).toEqual(['sm'])
    expect(
      allowedBranchIds(
        withoutScope(
          user({
            role: {
              id: 'r3',
              code: 'CUSTOM',
              name: 'Custom',
              system: false,
              permissions: ['sucursales.todas'],
            },
          }),
        ),
      ),
    ).toBeNull()
  })

  it('filtra vendedores y contactos por sucursal principal o accesos', () => {
    const people = [
      { id: 'p1', branch: sanMiguel, branches: [sanMiguel] },
      { id: 'p2', branch: delViso, branches: [delViso, sanMiguel] },
      { id: 'p3', branch: delViso, branches: [delViso] },
      { id: 'p4' },
    ]
    expect(filterPeopleInScope(user(), people).map((person) => person.id)).toEqual(
      ['p1', 'p2', 'p4'],
    )
  })

  it('traduce los errores tipados del backend', () => {
    expect(
      branchScopeErrorMessage(
        new ApiError(403, 'forbidden', { code: 'BRANCH_OUT_OF_SCOPE' }),
      ),
    ).toMatch(/sucursal distinta/)
    expect(
      branchScopeErrorMessage(
        new ApiError(400, 'bad request', { code: 'BRANCH_REQUIRED' }),
      ),
    ).toBe('Seleccioná la sucursal.')
    expect(branchScopeErrorMessage(new ApiError(403, 'forbidden'))).toBeNull()
  })
})
