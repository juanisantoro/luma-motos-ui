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
  query: Record<string, unknown>,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      value !== 'Todas' &&
      value !== 'Todos'
    ) {
      search.set(key, String(value))
    }
  })
  return `${base}${search.size ? `?${search.toString()}` : ''}` as `/${string}`
}

function validUuid(value: unknown) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : undefined
}

function sanitizeListQuery<T extends CommissionListQuery | PaidCommissionQuery>(
  query: T,
) {
  return {
    ...query,
    branchId: validUuid(query.branchId),
    sellerId: validUuid(query.sellerId),
  }
}

async function listOptions(signal?: AbortSignal) {
  const options = signal ? { signal } : {}
  const branches = await request<Array<{ id: string; name: string }>>(
    '/branches',
    options,
  )
  const sellerPages = await Promise.all(
    branches.map((branch) =>
      request<
        CommissionPage<{
          id: string
          employeeCode: string
          fullName: string
        }>
      >(
        queryPath('/sales/operations/sellers', {
          branchId: branch.id,
          page: 1,
          limit: 100,
        }),
        options,
      ),
    ),
  )
  const sellers = [
    ...new Map(
      sellerPages
        .flatMap((page) => page.items)
        .map((seller) => [
          seller.id,
          { id: seller.id, name: seller.fullName },
        ]),
    ).values(),
  ]
  return { branches, sellers } satisfies CommissionOptions
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
      ...sanitizeListQuery(query),
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
    queryPath('/commissions/settlements', sanitizeListQuery(query)),
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
    queryPath('/commissions/history', sanitizeListQuery(query)),
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
