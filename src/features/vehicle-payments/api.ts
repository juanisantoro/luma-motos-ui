import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type {
  CatalogOption,
  CreateVehiclePaymentInput,
  PageResponse,
  UpdateVehiclePaymentInput,
  VehiclePayment,
  VehiclePaymentQuery,
} from './types'

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

function listPath(
  path: `/${string}`,
  query: Record<string, string | number | boolean | undefined>,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return (search.size ? `${path}?${search.toString()}` : path) as `/${string}`
}

export function listVehiclePaymentConcepts(signal?: AbortSignal) {
  return apiRequest<CatalogOption[]>('/vehicle-payments/concepts', {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function listVehiclePaymentProviders(signal?: AbortSignal) {
  return apiRequest<CatalogOption[]>('/vehicle-payments/providers', {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function createVehiclePaymentConcept(name: string, signal?: AbortSignal) {
  return apiRequest<CatalogOption>('/vehicle-payments/concepts', {
    method: 'POST',
    body: { name },
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function createVehiclePaymentProvider(name: string, signal?: AbortSignal) {
  return apiRequest<CatalogOption>('/vehicle-payments/providers', {
    method: 'POST',
    body: { name },
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function listVehiclePayments(
  vehicleType: 'MOTO' | 'AUTO',
  query: VehiclePaymentQuery,
  signal?: AbortSignal,
) {
  return apiRequest<PageResponse<VehiclePayment>>(
    listPath('/vehicle-payments', { ...query, vehicleType }),
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

export function createVehiclePayment(
  input: CreateVehiclePaymentInput,
  signal?: AbortSignal,
) {
  return apiRequest<VehiclePayment>('/vehicle-payments', {
    method: 'POST',
    body: input,
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function updateVehiclePayment(
  id: string,
  input: UpdateVehiclePaymentInput,
  signal?: AbortSignal,
) {
  return apiRequest<VehiclePayment>(`/vehicle-payments/${id}`, {
    method: 'PATCH',
    body: input,
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}
