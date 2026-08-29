export type CreditDocumentType =
  | 'DNI'
  | 'CUIT'
  | 'CI'
  | 'PASAPORTE'
  | 'OTRO'

export type CreditHistorySummary = {
  totalAttempts: number
  rejectedAttempts: number
  approvedAttempts: number
  pendingAttempts: number
  firstConsultedAt: string | null
  lastConsultedAt: string | null
}

export type CreditRejectionSummary = {
  inquiryId: string
  financialEntity: {
    id: string
    name: string
  }
  rejectedAt: string
  reason: string | null
}

export type CreditCheckResponse = {
  found: boolean
  clientId: string | null
  isFlagged: boolean
  blocksSale: boolean
  lastRejection: CreditRejectionSummary | null
  summary: CreditHistorySummary
  checkedAt: string
}

export type CreditCheckState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'not-found'; checkedAt: string }
  | { status: 'success'; data: CreditCheckResponse }
  | { status: 'error'; message: string }

