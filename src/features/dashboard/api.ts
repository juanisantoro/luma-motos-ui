import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type { DashboardHome, DashboardMonth } from './types'

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

// `month` sólo lo usa el inicio del ADMINISTRADOR (mes actual o anterior).
export function getDashboardHome(signal?: AbortSignal, month: DashboardMonth = 'current') {
  const query = month === 'previous' ? '?month=previous' : ''
  return apiRequest<DashboardHome>(`/dashboard/inicio${query}`, {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}
