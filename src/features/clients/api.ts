import {
  AUTH_TOKEN_KEY,
  apiRequest,
} from '../../shared/api/client'
import type {
  Client,
  ClientListQuery,
  ClientListResponse,
  CreateClientInput,
  UpdateClientInput,
} from './types'

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function listClients(query: ClientListQuery, signal?: AbortSignal) {
  const search = new URLSearchParams()
  if (query.page !== undefined) search.set('page', String(query.page))
  if (query.limit !== undefined) search.set('limit', String(query.limit))
  if (query.search) search.set('search', query.search)
  if (query.active !== undefined) search.set('active', String(query.active))
  if (query.organizationId) {
    search.set('organizationId', query.organizationId)
  }

  const suffix = search.size ? `?${search.toString()}` : ''
  return apiRequest<ClientListResponse>(`/clients${suffix}`, {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function createClient(input: CreateClientInput) {
  return apiRequest<Client>('/clients', {
    method: 'POST',
    token: authToken(),
    body: input,
  })
}

export function updateClient(id: string, input: UpdateClientInput) {
  return apiRequest<Client>(`/clients/${id}`, {
    method: 'PATCH',
    token: authToken(),
    body: input,
  })
}

export function updateClientStatus(id: string, active: boolean) {
  return apiRequest<Client>(`/clients/${id}/status`, {
    method: 'PATCH',
    token: authToken(),
    body: { active },
  })
}
