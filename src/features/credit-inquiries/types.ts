import type {
  CreditDocumentType,
  CreditHistorySummary,
} from '../credit-checks'

export type CreditInquiryOutcome = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'

export type CreditInquiry = {
  id: string
  client: {
    id: string
    documentType: CreditDocumentType
    documentNumber: string
    fullName: string
  }
  financialEntity: {
    id: string
    name: string
  }
  outcome: CreditInquiryOutcome
  reason: string | null
  consultedAt: string
  attemptCount: number
  branch: {
    id: string
    code: string
    name: string
  }
  registeredBy: {
    id: string
    fullName: string
  }
  operation: {
    id: string
    number: string
  } | null
  externalReference: string | null
  createdAt: string
}

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export type RejectedInquiryListResponse = PaginatedResponse<CreditInquiry>

export type CreditHistoryResponse = PaginatedResponse<CreditInquiry> & {
  client: CreditInquiry['client']
  summary: CreditHistorySummary
}

export type RejectedInquiryQuery = {
  page?: number
  limit?: number
  search?: string
  document?: string
  financialEntityId?: string
  dateFrom?: string
  dateTo?: string
  branchId?: string
  registeredById?: string
}

export type CreateCreditInquiryInput = {
  documentType: CreditDocumentType
  documentNumber: string
  fullName: string
  financialEntityId: string
  outcome: CreditInquiryOutcome
  reason?: string
  consultedAt: string
  registeredById?: string
  branchId?: string
  operationId?: string
  externalReference?: string
}

export type CreatedCreditInquiry = CreditInquiry & {
  idempotentReplay: boolean
}

export type FinancialInstitution = {
  id: string
  name: string
  taxId: string | null
  active: boolean
  createdAt: string
}

export type BranchReference = {
  id: string
  code: string
  name: string
}

export type RegistrantReference = {
  id: string
  fullName: string
  primaryBranch: BranchReference | null
}

export type ReferenceQuery = {
  page?: number
  limit?: number
  search?: string
  branchId?: string
}

