import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type { BcraSituacionResponse } from './types'

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function getBcraSituacion(cuit: string, signal?: AbortSignal) {
  return apiRequest<BcraSituacionResponse>(`/bcra/situacion/${cuit}`, {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}
