import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type {
  AgreementInput,
  CommissionDetail,
  CommissionGateway,
  CommissionListQuery,
  CommissionOptions,
  CommissionPage,
  CommissionPaymentOptions,
  CommissionScalePolicy,
  CommissionSummary,
  CommissionSettlement,
  CommissionVehicleType,
  MyCommissions,
  PaidCommission,
  PaidCommissionQuery,
  PaymentInput,
  SaveScalePolicyInput,
} from './types'

function request<T>(
  path: `/${string}`,
  options: Parameters<typeof apiRequest<T>>[1] = {},
) {
  return apiRequest<T>(path, {
    ...options,
    token: sessionStorage.getItem(AUTH_TOKEN_KEY),
  })
}

function queryPath(
  base: `/${string}`,
  query: Record<string, string | number | undefined>,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return `${base}${search.size ? `?${search.toString()}` : ''}` as `/${string}`
}

function listOptions(signal?: AbortSignal) {
  const options = signal ? { signal } : {}
  return Promise.all([
    request<CommissionPage<{ id: string; name: string }>>(
      '/branches?page=1&limit=100',
      options,
    ),
    request<CommissionPage<{ id: string; employeeCode: string; fullName: string }>>(
      '/sales/operations/sellers?page=1&limit=100',
      options,
    ),
  ]).then(([branches, sellers]): CommissionOptions => ({
    branches: branches.items,
    sellers: sellers.items.map((seller) => ({
      id: seller.id,
      name: seller.fullName,
    })),
  }))
}

function listPaymentOptions(signal?: AbortSignal) {
  return request<CommissionPage<{ id: string; code: string; name: string }>>(
    '/cash/accounts?active=true&page=1&limit=100',
    signal ? { signal } : {},
  ).then((accounts): CommissionPaymentOptions => ({ accounts: accounts.items }))
}

function listSuggestions(
  query: CommissionListQuery,
  signal?: AbortSignal,
) {
  return request<CommissionPage<CommissionSummary>>(
    queryPath('/commissions/suggestions', {
      ...query,
      minComputableSales: query.minSales,
      maxComputableSales: query.maxSales,
      minSales: undefined,
      maxSales: undefined,
    }),
    signal ? { signal } : {},
  )
}

function getSuggestion(
  id: string,
  signal?: AbortSignal,
) {
  return request<CommissionDetail>(
    `/commissions/suggestions/${id}`,
    signal ? { signal } : {},
  )
}

function registerAgreement(
  id: string,
  input: AgreementInput,
) {
  return request<CommissionSettlement>(
    `/commissions/suggestions/${id}/agreement`,
    { method: 'PUT', body: input },
  )
}

function listPayable(query: CommissionListQuery, signal?: AbortSignal) {
  return request<CommissionPage<CommissionSettlement>>(
    queryPath('/commissions/settlements', query),
    signal ? { signal } : {},
  )
}

function pay(
  id: string,
  input: PaymentInput,
) {
  return request<PaidCommission>(
    `/commissions/settlements/${id}/payments`,
    { method: 'POST', body: input },
  )
}

function listPaid(query: PaidCommissionQuery, signal?: AbortSignal) {
  return request<CommissionPage<PaidCommission>>(
    queryPath('/commissions/history', query),
    signal ? { signal } : {},
  )
}

function listPolicies(
  vehicleType: CommissionVehicleType,
  signal?: AbortSignal,
) {
  return request<CommissionPage<CommissionScalePolicy>>(
    queryPath('/commissions/policies', {
      vehicleType,
      page: 1,
      limit: 100,
    }),
    signal ? { signal } : {},
  )
}

function savePolicy(input: SaveScalePolicyInput) {
  return request<CommissionScalePolicy>('/commissions/policies', {
    method: 'POST',
    body: input,
  })
}

function getMine(
  period: string,
  vehicleType: CommissionVehicleType,
  signal?: AbortSignal,
) {
  return request<MyCommissions>(
    queryPath('/commissions/me', {
      period,
      vehicleType,
      page: 1,
      limit: 50,
    }),
    signal ? { signal } : {},
  )
}

export const commissionApiGateway: CommissionGateway = {
  listOptions,
  listPaymentOptions,
  listSuggestions,
  getSuggestion,
  registerAgreement,
  listPayable,
  pay,
  listPaid,
  listPolicies,
  savePolicy,
  getMine,
}
