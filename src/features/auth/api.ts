import { apiRequest } from '../../shared/api/client'
import type { AuthUser, LoginCredentials, LoginResponse } from './types'

export function loginRequest(credentials: LoginCredentials, signal?: AbortSignal) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
    ...(signal ? { signal } : {}),
  })
}

export function getCurrentUser(token: string, signal?: AbortSignal) {
  return apiRequest<AuthUser>('/auth/me', {
    token,
    ...(signal ? { signal } : {}),
  })
}

export function logoutRequest(token: string) {
  return apiRequest<void>('/auth/logout', { method: 'POST', token })
}
