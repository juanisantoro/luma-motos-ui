import {
  AUTH_TOKEN_KEY,
  apiRequest,
} from '../../shared/api/client'
import type {
  CreateSalesOperationInput,
  CreateSupplyRequestInput,
  LinkedSupplyRequest,
  SalesPricePolicy,
  SalesSellerPage,
  SalesOperation,
  SalesOperationPage,
  SalesOperationQuery,
  UpdateSalesOperationInput,
} from './types'

function token() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

function request<T>(
  path: `/${string}`,
  options: Parameters<typeof apiRequest<T>>[1] = {},
) {
  return apiRequest<T>(path, { ...options, token: token() })
}

function operationsPath(query: SalesOperationQuery) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  })
  return `/sales/operations${search.size ? `?${search.toString()}` : ''}` as const
}

export function listSalesOperations(
  query: SalesOperationQuery,
  signal?: AbortSignal,
) {
  return request<SalesOperationPage>(
    operationsPath(query),
    signal ? { signal } : {},
  )
}

export function getSalesOperation(id: string, signal?: AbortSignal) {
  return request<SalesOperation>(
    `/sales/operations/${id}`,
    signal ? { signal } : {},
  )
}

export function listSalesSellers(
  query: {
    branchId: string
    search?: string
    organizationId?: string
    page?: number
    limit?: number
  },
  signal?: AbortSignal,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  const suffix = search.size ? `?${search.toString()}` : ''
  return request<SalesSellerPage>(
    `/sales/operations/sellers${suffix}`,
    signal ? { signal } : {},
  )
}

export function getSalesPricePolicy(
  query: {
    branchId: string
    versionId: string
    operationDate?: string
    organizationId?: string
  },
  signal?: AbortSignal,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value)
  })
  return request<SalesPricePolicy>(
    `/sales/operations/price-policy?${search.toString()}`,
    signal ? { signal } : {},
  )
}

export function createSalesOperation(input: CreateSalesOperationInput) {
  return request<SalesOperation>('/sales/operations', {
    method: 'POST',
    body: input,
  })
}

export function createLinkedSupplyRequest(input: CreateSupplyRequestInput) {
  return request<LinkedSupplyRequest>('/supply-requests', {
    method: 'POST',
    body: input,
  })
}

export function updateSalesOperation(
  id: string,
  input: UpdateSalesOperationInput,
) {
  return request<SalesOperation>(`/sales/operations/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export function reserveSalesUnit(
  id: string,
  input: {
    unitId: string
    expectedVersion: number
    expiresAt?: string
  },
) {
  return request<SalesOperation>(`/sales/operations/${id}/reservation`, {
    method: 'POST',
    body: input,
  })
}

export function releaseSalesReservation(
  id: string,
  input: { expectedVersion: number; reason: string },
) {
  return request<SalesOperation>(
    `/sales/operations/${id}/reservation/release`,
    { method: 'POST', body: input },
  )
}

function versionedAction(id: string, action: string, expectedVersion: number) {
  return request<SalesOperation>(`/sales/operations/${id}/${action}`, {
    method: 'POST',
    body: { expectedVersion },
  })
}

export function submitSalesOperation(id: string, expectedVersion: number) {
  return versionedAction(id, 'submit', expectedVersion)
}

export function approveSalesOperation(
  id: string,
  input: { expectedVersion: number; notes?: string },
) {
  return request<SalesOperation>(`/sales/operations/${id}/approve`, {
    method: 'POST',
    body: input,
  })
}

export function rejectSalesOperation(
  id: string,
  input: { expectedVersion: number; reason: string },
) {
  return request<SalesOperation>(`/sales/operations/${id}/reject`, {
    method: 'POST',
    body: input,
  })
}

export function cancelSalesOperation(
  id: string,
  input: { expectedVersion: number; reason: string },
) {
  return request<SalesOperation>(`/sales/operations/${id}/cancel`, {
    method: 'POST',
    body: input,
  })
}

export function closeSalesOperation(id: string, expectedVersion: number) {
  return versionedAction(id, 'close', expectedVersion)
}
