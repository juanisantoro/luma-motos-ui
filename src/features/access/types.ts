export type BranchOption = {
  id: string
  code: string
  name: string
  organizationId: string
}

export type UserRoleSummary = {
  id: string
  code: string
  name: string
  system: boolean
  active: boolean
  version: number
  permissions: string[]
}

export type InvitationStatus =
  | 'PENDING'
  | 'DELIVERED'
  | 'FAILED'
  | 'ACCEPTED'
  | 'EXPIRED'

export type ManagedUser = {
  id: string
  email: string
  active: boolean
  globalAccess: boolean
  passwordChangeRequired: boolean
  temporaryPasswordExpiresAt: string | null
  organization: {
    id: string
    code: string
    name: string
    type: 'CASA_CENTRAL' | 'FRANQUICIA'
    active: boolean
  }
  branch: BranchOption | null
  role: UserRoleSummary | null
  personnel: {
    id: string
    employeeCode: string | null
    fullName: string
    phone: string | null
    canSignIn: boolean
    status: string
  } | null
  invitation: {
    status: InvitationStatus
    sentAt: string | null
    lastAttemptAt: string | null
    expiresAt: string | null
    acceptedAt: string | null
  }
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type UserListResponse = {
  items: ManagedUser[]
  total: number
  page: number
  limit: number
}

export type UserListQuery = {
  page?: number
  limit?: number
  search?: string
  organizationId?: string
  branchId?: string
  roleCode?: string
  active?: boolean
  invitationStatus?: InvitationStatus
}

export type CreateUserInput = {
  email: string
  fullName: string
  organizationId: string
  branchId?: string
  roleCode: string
  globalAccess?: boolean
  employeeCode?: string
  phone?: string
}

export type UpdateUserAccessInput = {
  roleCode?: string
  branchId?: string | null
  globalAccess?: boolean
}

export type UserMutationResponse = {
  user: ManagedUser
  revokedSessions: number
}

export type InvitationResponse = {
  user: ManagedUser
  delivery: {
    status: 'DELIVERED'
    expiresAt: string
  }
}

export type CreateUserResponse = InvitationResponse

export type PermissionItem = {
  code: string
  module?: string
  description: string
}

export type PermissionGroup = {
  module: string
  label: string
  permissions: PermissionItem[]
}

export type ManagedRole = {
  id: string
  code: string
  name: string
  description: string
  permissions: Array<{
    code: string
    module: string
    description: string
  }>
  userCount: number
  active: boolean
  system: boolean
  version: number
  organization: {
    id: string
    code: string
    name: string
    type: 'CASA_CENTRAL' | 'FRANQUICIA'
  } | null
  actions: {
    canEdit: boolean
    canChangeStatus: boolean
    canClone: boolean
  }
  createdAt: string
  updatedAt: string
}

export type RoleListResponse = {
  items: ManagedRole[]
  total: number
  page: number
  limit: number
}

export type RoleListQuery = {
  page?: number
  limit?: number
  search?: string
  active?: boolean
}

export type CreateRoleInput = {
  name: string
  code?: string
  description: string
  permissionCodes: string[]
}

export type UpdateRoleInput = {
  name?: string
  description?: string
  permissionCodes?: string[]
  version: number
}

export type RoleStatusInput = {
  active: boolean
  version: number
}

export type CloneRoleInput = {
  name: string
  code?: string
}

export type RoleMutationResponse = {
  role: ManagedRole
  revokedSessions: number
}

export type AccessGateway = {
  listUsers: (query: UserListQuery, signal?: AbortSignal) => Promise<UserListResponse>
  getUser: (id: string, signal?: AbortSignal) => Promise<ManagedUser>
  createUser: (input: CreateUserInput) => Promise<CreateUserResponse>
  updateUserAccess: (
    id: string,
    input: UpdateUserAccessInput,
  ) => Promise<UserMutationResponse>
  updateUserStatus: (id: string, active: boolean) => Promise<UserMutationResponse>
  resendUserInvitation: (id: string) => Promise<InvitationResponse>
  listRoles: (query: RoleListQuery, signal?: AbortSignal) => Promise<RoleListResponse>
  getRole: (id: string, signal?: AbortSignal) => Promise<ManagedRole>
  createRole: (input: CreateRoleInput) => Promise<ManagedRole>
  updateRole: (id: string, input: UpdateRoleInput) => Promise<RoleMutationResponse>
  updateRoleStatus: (id: string, input: RoleStatusInput) => Promise<ManagedRole>
  cloneRole: (id: string, input: CloneRoleInput) => Promise<ManagedRole>
  listPermissions: (signal?: AbortSignal) => Promise<PermissionGroup[]>
  listBranches: (
    organizationId: string,
    signal?: AbortSignal,
  ) => Promise<BranchOption[]>
}
