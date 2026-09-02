import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type { DashboardHome } from './types'

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function getDashboardHome(signal?: AbortSignal) {
  return apiRequest<DashboardHome>('/dashboard/inicio', {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}
