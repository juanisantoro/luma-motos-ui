import {
  AUTH_TOKEN_KEY,
  apiRequest,
} from '../../shared/api/client'
import type {
  BranchReference,
  CreatedCreditInquiry,
  CreateCreditInquiryInput,
  CreditHistoryResponse,
  FinancialInstitution,
  PaginatedResponse,
  ReferenceQuery,
  RegistrantReference,
  RejectedInquiryListResponse,
  RejectedInquiryQuery,
} from './types'

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

function setOptional(search: URLSearchParams, key: string, value?: string | number) {
  if (value !== undefined && value !== '') search.set(key, String(value))
}

export function listRejectedInquiries(
  query: RejectedInquiryQuery,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams()
  setOptional(search, 'page', query.page)
  setOptional(search, 'limit', query.limit)
  setOptional(search, 'search', query.search)
  setOptional(search, 'document', query.document)
  setOptional(search, 'financialEntityId', query.financialEntityId)
  setOptional(search, 'dateFrom', query.dateFrom)
  setOptional(search, 'dateTo', query.dateTo)
  setOptional(search, 'branchId', query.branchId)
  setOptional(search, 'registeredById', query.registeredById)
  const suffix = search.size ? `?${search.toString()}` : ''

  return apiRequest<RejectedInquiryListResponse>(
    `/credit-inquiries/rejected${suffix}`,
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

export function getCreditHistory(
  clientId: string,
  page = 1,
  limit = 50,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  return apiRequest<CreditHistoryResponse>(
    `/credit-inquiries/clients/${clientId}/history?${search.toString()}`,
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

export function createCreditInquiry(
  input: CreateCreditInquiryInput,
  idempotencyKey: string,
) {
  return apiRequest<CreatedCreditInquiry>('/credit-inquiries', {
    method: 'POST',
    token: authToken(),
    headers: { 'Idempotency-Key': idempotencyKey },
    body: input,
  })
}

function referenceSearch(query: ReferenceQuery = {}) {
  const search = new URLSearchParams()
  setOptional(search, 'page', query.page)
  setOptional(search, 'limit', query.limit)
  setOptional(search, 'search', query.search)
  setOptional(search, 'branchId', query.branchId)
  return search.size ? `?${search.toString()}` : ''
}

export function listFinancialInstitutions(signal?: AbortSignal) {
  return apiRequest<PaginatedResponse<FinancialInstitution>>(
    '/financial-institutions?page=1&limit=100&active=true',
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

export function listCreditBranches(signal?: AbortSignal) {
  return apiRequest<PaginatedResponse<BranchReference>>(
    `/credit-inquiries/branches${referenceSearch({ page: 1, limit: 100 })}`,
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

export function listCreditRegistrants(
  query: ReferenceQuery = {},
  signal?: AbortSignal,
) {
  return apiRequest<PaginatedResponse<RegistrantReference>>(
    `/credit-inquiries/registrants${referenceSearch(query)}`,
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

