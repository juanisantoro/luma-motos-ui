export type Organization = {
  id: string
  code: string
  name: string
  type: 'CASA_CENTRAL' | 'FRANQUICIA'
}

export type UserRole = {
  id: string
  code: string
  name: string
  system: boolean
  permissions: string[]
}

export type AuthUser = {
  id: string
  email: string
  name: string | null
  active: boolean
  globalAccess: boolean
  organization: Organization
  role: UserRole
  branch: {
    id: string
    code: string
    name: string
  } | null
}

export type LoginCredentials = {
  organizationCode: string
  email: string
  password: string
}

export type LoginResponse = {
  accessToken: string
  tokenType: 'Bearer'
  idleTimeoutSeconds: number
  user: AuthUser
}

export type TemporaryPasswordChallenge = {
  organizationCode: string
  email: string
  temporaryPassword: string
  expiresAt: string | null
}

export type LoginResult = 'authenticated' | 'password-change-required'

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'password-change-required'
  | 'error'
