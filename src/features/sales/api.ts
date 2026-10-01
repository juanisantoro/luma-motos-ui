import {
  AUTH_TOKEN_KEY,
  apiRequest,
} from '../../shared/api/client'
import type {
  AssignSalesUnitInput,
  CreateSalesOperationInput,
  CreateSalesTradeInInput,
  SalesPricePolicy,
  SalesFinancialInstitutionPage,
  SalesSellerPage,
  SalesOperation,
  SalesOperationPage,
  SalesOperationQuery,
  RegisterSalesLicensePlateInput,
  RegisterSalesLicensingCollectionInput,
  ReplaceSalesPaymentPlanInput,
  RequestSalesSupplyInput,
  UpdateSalesLicensingInput,
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

export function listSalesApprovals(
  query: SalesOperationQuery,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return request<SalesOperationPage>(
    `/sales/operations/approvals?${search.toString()}`,
    signal ? { signal } : {},
  )
}

export function getSalesOperation(id: string, signal?: AbortSignal) {
  return request<SalesOperation>(
    `/sales/operations/${id}`,
    signal ? { signal } : {},
  )
}

async function listSalesPeople(
  resource: 'sellers' | 'contacts',
  query: {
    branchId?: string
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
  const first = await request<SalesSellerPage>(
    `/sales/operations/${resource}${suffix}`,
    signal ? { signal } : {},
  )
  const loadedThrough = first.page * first.limit
  if (first.items.length >= first.total || loadedThrough >= first.total) {
    return first
  }
  const lastPage = Math.ceil(first.total / first.limit)
  const remaining = await Promise.all(
    Array.from(
      { length: lastPage - first.page },
      (_, index) => first.page + index + 1,
    ).map((page) => {
      const pageSearch = new URLSearchParams(search)
      pageSearch.set('page', String(page))
      return request<SalesSellerPage>(
        `/sales/operations/${resource}?${pageSearch.toString()}`,
        signal ? { signal } : {},
      )
    }),
  )
  return {
    ...first,
    page: 1,
    items: [
      ...first.items,
      ...remaining.flatMap((result) => result.items),
    ],
  }
}

export function listSalesSellers(
  query: Parameters<typeof listSalesPeople>[1],
  signal?: AbortSignal,
) {
  return listSalesPeople('sellers', query, signal)
}

export function listSalesContacts(
  query: Parameters<typeof listSalesPeople>[1],
  signal?: AbortSignal,
) {
  return listSalesPeople('contacts', query, signal)
}

export function listSalesFinancialInstitutions(signal?: AbortSignal) {
  return request<SalesFinancialInstitutionPage>(
    '/financial-institutions?active=true&page=1&limit=100',
    signal ? { signal } : {},
  )
}

export function getSalesPricePolicy(
  query: {
    branchId: string
    versionId: string
    vehicleType: 'MOTO' | 'AUTO'
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

export function createSalesTradeIn(
  id: string,
  input: CreateSalesTradeInInput,
) {
  return request<SalesOperation>(`/sales/operations/${id}/trade-ins`, {
    method: 'POST',
    body: input,
  })
}

export function replaceSalesPaymentPlan(
  id: string,
  input: ReplaceSalesPaymentPlanInput,
) {
  return request<SalesOperation>(`/sales/operations/${id}/payment-plan`, {
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

export function updateSalesLicensing(
  id: string,
  input: UpdateSalesLicensingInput,
) {
  return request<SalesOperation>(`/sales/operations/${id}/licensing`, {
    method: 'PATCH',
    body: input,
  })
}

export function assignSalesUnit(id: string, input: AssignSalesUnitInput) {
  return request<SalesOperation>(`/sales/operations/${id}/assign-unit`, {
    method: 'POST',
    body: input,
  })
}

export function requestSalesSupply(
  id: string,
  input: RequestSalesSupplyInput,
) {
  return request<SalesOperation>(`/sales/operations/${id}/supply-request`, {
    method: 'POST',
    body: input,
  })
}

// Unidades EN_STOCK que la administrativa puede asignar a la operación:
// misma versión y condición, en la sucursal de la operación.
export type AssignableUnit = {
  id: string
  vin: string
  engineNumber: string | null
  color: string | null
  manufactureYear: number | null
  branch: { id: string; name: string }
}

export async function listAssignableUnits(
  operation: Pick<SalesOperation, 'vehicle' | 'branch' | 'organizationId'>,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    vehicleType: operation.vehicle.model.vehicleType,
    versionId: operation.vehicle.versionId,
    condition: operation.vehicle.condition,
    inventoryStatus: 'EN_STOCK',
    branchId: operation.branch.id,
    page: '1',
    limit: '100',
  })
  const page = await request<{
    items: Array<{
      id: string
      vin: string
      engineNumber: string | null
      color: string | null
      manufactureYear: number | null
      branch: { id: string; name: string }
    }>
  }>(`/inventory/units?${search.toString()}`, signal ? { signal } : {})
  return page.items.map((item) => ({
    id: item.id,
    vin: item.vin,
    engineNumber: item.engineNumber,
    color: item.color,
    manufactureYear: item.manufactureYear,
    branch: { id: item.branch.id, name: item.branch.name },
  }))
}

// Disponibilidad informada por proveedores: sólo sugerencia al pedir.
export type SupplierSuggestion = {
  supplierId: string
  supplierName: string
  quantity: number
  expired: boolean
}

export async function listSupplierSuggestions(
  operation: Pick<SalesOperation, 'vehicle'>,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    vehicleType: operation.vehicle.model.vehicleType,
    versionId: operation.vehicle.versionId,
    condition: operation.vehicle.condition,
    page: '1',
    limit: '100',
  })
  const page = await request<{
    items: Array<{
      supplierId: string
      reportedQuantity: number
      expired: boolean
      supplier: { id: string; legalName: string }
    }>
  }>(`/supplier-availability?${search.toString()}`, signal ? { signal } : {})
  return page.items
    .filter((item) => !item.expired && item.reportedQuantity > 0)
    .map((item) => ({
      supplierId: item.supplierId,
      supplierName: item.supplier.legalName,
      quantity: item.reportedQuantity,
      expired: item.expired,
    }))
}

export function collectSalesLicensing(
  id: string,
  input: RegisterSalesLicensingCollectionInput,
) {
  return request<SalesOperation>(
    `/sales/operations/${id}/licensing/collections`,
    { method: 'POST', body: input },
  )
}

// Fase 5: llegada de la patente.
export function registerSalesLicensePlate(
  id: string,
  input: RegisterSalesLicensePlateInput,
) {
  return request<SalesOperation>(`/sales/operations/${id}/licensing/plate`, {
    method: 'POST',
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
