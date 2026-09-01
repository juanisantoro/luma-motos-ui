import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type {
  ConfirmOperationCreditInput,
  CreateCreditPlanInput,
  CreditInstallment,
  CreditInstallmentQuery,
  CreditPlan,
  CreditPlanQuery,
  OperationCredit,
  PageResponse,
  PayCreditInstallmentInput,
  UpdateCreditPlanInput,
} from './types'

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

function withQuery(
  path: `/${string}`,
  query: Record<string, string | number | boolean | undefined>,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return (search.size ? `${path}?${search.toString()}` : path) as `/${string}`
}

export function listCreditPlans(query: CreditPlanQuery, signal?: AbortSignal) {
  return apiRequest<PageResponse<CreditPlan>>(withQuery('/credit-plans', query), {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function createCreditPlan(input: CreateCreditPlanInput, signal?: AbortSignal) {
  return apiRequest<CreditPlan>('/credit-plans', {
    method: 'POST',
    body: input,
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function updateCreditPlan(
  id: string,
  input: UpdateCreditPlanInput,
  signal?: AbortSignal,
) {
  return apiRequest<CreditPlan>(`/credit-plans/${id}`, {
    method: 'PATCH',
    body: input,
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function getOperationCredit(operationId: string, signal?: AbortSignal) {
  return apiRequest<OperationCredit>(`/credit-plans/operations/${operationId}`, {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function confirmOperationCredit(
  operationId: string,
  input: ConfirmOperationCreditInput,
  signal?: AbortSignal,
) {
  return apiRequest<OperationCredit>(`/credit-plans/operations/${operationId}`, {
    method: 'POST',
    body: input,
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function listCreditInstallments(
  query: CreditInstallmentQuery,
  signal?: AbortSignal,
) {
  return apiRequest<PageResponse<CreditInstallment>>(
    withQuery('/credit-plans/installments', query),
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

export function payCreditInstallment(
  id: string,
  input: PayCreditInstallmentInput,
  signal?: AbortSignal,
) {
  return apiRequest<CreditInstallment>(`/credit-plans/installments/${id}/pay`, {
    method: 'POST',
    body: input,
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}
