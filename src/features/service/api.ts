import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type {
  DeliverInput,
  PageResponse,
  ReceptionInput,
  ServiceOrder,
  ServiceOrderQuery,
  ServiceType,
  VehicleLookup,
  WorkInput,
} from './types'

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

function withSignal(signal?: AbortSignal) {
  return { token: authToken(), ...(signal ? { signal } : {}) }
}

export function listServiceOrders(query: ServiceOrderQuery, signal?: AbortSignal) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  const suffix = search.size ? `?${search.toString()}` : ''
  return apiRequest<PageResponse<ServiceOrder>>(
    `/service-orders${suffix}`,
    withSignal(signal),
  )
}

export function getServiceOrder(id: string, signal?: AbortSignal) {
  return apiRequest<ServiceOrder>(`/service-orders/${id}`, withSignal(signal))
}

export function listServiceTypes(signal?: AbortSignal, includeInactive = false) {
  return apiRequest<ServiceType[]>(
    `/service-orders/types${includeInactive ? '?includeInactive=true' : ''}`,
    withSignal(signal),
  )
}

export type ServiceTypeInput = {
  name: string
  order?: number
  tasks: string[]
  suggestedPrice: string | null
  active: boolean
}

export function createServiceType(input: ServiceTypeInput) {
  return apiRequest<ServiceType>('/service-orders/types', {
    method: 'POST',
    body: input,
    token: authToken(),
  })
}

export function updateServiceType(id: string, input: ServiceTypeInput) {
  return apiRequest<ServiceType>(`/service-orders/types/${id}`, {
    method: 'PUT',
    body: input,
    token: authToken(),
  })
}

export function lookupServiceVehicle(q: string, signal?: AbortSignal) {
  return apiRequest<VehicleLookup>(
    `/service-orders/vehicle-lookup?q=${encodeURIComponent(q)}`,
    withSignal(signal),
  )
}

export function createServiceOrder(input: ReceptionInput) {
  return apiRequest<ServiceOrder>('/service-orders', {
    method: 'POST',
    body: input,
    token: authToken(),
  })
}

export function updateServiceOrder(
  id: string,
  input: ReceptionInput & { expectedVersion: number },
) {
  return apiRequest<ServiceOrder>(`/service-orders/${id}`, {
    method: 'PATCH',
    body: input,
    token: authToken(),
  })
}

export function saveServiceWork(id: string, input: WorkInput) {
  return apiRequest<ServiceOrder>(`/service-orders/${id}/work`, {
    method: 'PUT',
    body: input,
    token: authToken(),
  })
}

export function finishServiceOrder(id: string, input: WorkInput) {
  return apiRequest<ServiceOrder>(`/service-orders/${id}/finish`, {
    method: 'POST',
    body: input,
    token: authToken(),
  })
}

export function reopenServiceOrder(id: string, expectedVersion: number, reason: string) {
  return apiRequest<ServiceOrder>(`/service-orders/${id}/reopen`, {
    method: 'POST',
    body: { expectedVersion, reason },
    token: authToken(),
  })
}

export function cancelServiceOrder(id: string, expectedVersion: number, reason: string) {
  return apiRequest<ServiceOrder>(`/service-orders/${id}/cancel`, {
    method: 'POST',
    body: { expectedVersion, reason },
    token: authToken(),
  })
}

export function deliverServiceOrder(id: string, input: DeliverInput) {
  return apiRequest<ServiceOrder>(`/service-orders/${id}/deliver`, {
    method: 'POST',
    body: input,
    token: authToken(),
  })
}
