import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type {
  AccessGateway,
  BranchOption,
  CloneRoleInput,
  CreateRoleInput,
  CreateUserInput,
  CreateUserResponse,
  InvitationResponse,
  ManagedRole,
  ManagedUser,
  PermissionGroup,
  RoleListQuery,
  RoleListResponse,
  RoleMutationResponse,
  RoleStatusInput,
  UpdateRoleInput,
  UpdateUserAccessInput,
  UserListQuery,
  UserListResponse,
  UserMutationResponse,
} from './types'

const paths = {
  users: '/users',
  roles: '/roles',
  permissions: '/permissions',
  branches: '/branches',
} as const

function token() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

function queryString(query: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return search.size ? `?${search.toString()}` : ''
}

export const accessApiGateway: AccessGateway = {
  listUsers(query: UserListQuery, signal?: AbortSignal) {
    return apiRequest<UserListResponse>(
      `${paths.users}${queryString(query)}`,
      { token: token(), ...(signal ? { signal } : {}) },
    )
  },
  getUser(id: string, signal?: AbortSignal) {
    return apiRequest<ManagedUser>(`${paths.users}/${id}`, {
      token: token(),
      ...(signal ? { signal } : {}),
    })
  },
  createUser(input: CreateUserInput) {
    return apiRequest<CreateUserResponse>(paths.users, {
      method: 'POST',
      token: token(),
      body: input,
    })
  },
  updateUserAccess(id: string, input: UpdateUserAccessInput) {
    return apiRequest<UserMutationResponse>(`${paths.users}/${id}/access`, {
      method: 'PATCH',
      token: token(),
      body: input,
    })
  },
  updateUserStatus(id: string, active: boolean) {
    return apiRequest<UserMutationResponse>(`${paths.users}/${id}/status`, {
      method: 'PATCH',
      token: token(),
      body: { active },
    })
  },
  resendUserInvitation(id: string) {
    return apiRequest<InvitationResponse>(
      `${paths.users}/${id}/invitation/resend`,
      { method: 'POST', token: token() },
    )
  },
  listRoles(query: RoleListQuery, signal?: AbortSignal) {
    return apiRequest<RoleListResponse>(
      `${paths.roles}${queryString(query)}`,
      { token: token(), ...(signal ? { signal } : {}) },
    )
  },
  getRole(id: string, signal?: AbortSignal) {
    return apiRequest<ManagedRole>(`${paths.roles}/${id}`, {
      token: token(),
      ...(signal ? { signal } : {}),
    })
  },
  createRole(input: CreateRoleInput) {
    return apiRequest<ManagedRole>(paths.roles, {
      method: 'POST',
      token: token(),
      body: input,
    })
  },
  updateRole(id: string, input: UpdateRoleInput) {
    return apiRequest<RoleMutationResponse>(`${paths.roles}/${id}`, {
      method: 'PATCH',
      token: token(),
      body: input,
    })
  },
  updateRoleStatus(id: string, input: RoleStatusInput) {
    return apiRequest<ManagedRole>(`${paths.roles}/${id}/status`, {
      method: 'PATCH',
      token: token(),
      body: input,
    })
  },
  cloneRole(id: string, input: CloneRoleInput) {
    return apiRequest<ManagedRole>(`${paths.roles}/${id}/clone`, {
      method: 'POST',
      token: token(),
      body: input,
    })
  },
  listPermissions(signal?: AbortSignal) {
    return apiRequest<PermissionGroup[]>(paths.permissions, {
      token: token(),
      ...(signal ? { signal } : {}),
    })
  },
  listBranches(organizationId: string, signal?: AbortSignal) {
    return apiRequest<BranchOption[]>(
      `${paths.branches}${queryString({ organizationId })}`,
      { token: token(), ...(signal ? { signal } : {}) },
    )
  },
}
