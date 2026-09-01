export type CreditCalculationMethod = 'FRANCES' | 'INTERES_SIMPLE'

export type CreditInstallmentStatus = 'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'PARCIAL'

export type CreditOperationStatus = 'ACTIVO' | 'CANCELADO' | 'FINALIZADO'

export type CreditPlan = {
  id: string
  name: string
  calculationMethod: CreditCalculationMethod
  installmentCount: number
  interestRate: number
  minimumAmount: number | null
  maximumAmount: number | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type CreditPlanQuery = {
  page: number
  limit: number
  active?: boolean
  amount?: number
  organizationId?: string
}

export type CreateCreditPlanInput = {
  name: string
  calculationMethod: CreditCalculationMethod
  installmentCount: number
  interestRate: number
  minimumAmount?: number
  maximumAmount?: number
  active?: boolean
  organizationId?: string
}

export type UpdateCreditPlanInput = {
  name?: string
  calculationMethod?: CreditCalculationMethod
  installmentCount?: number
  interestRate?: number
  minimumAmount?: number | null
  maximumAmount?: number | null
  active?: boolean
}

export type OperationCreditInstallmentSummary = {
  id: string
  number: number
  amount: number
  dueDate: string
  status: CreditInstallmentStatus
  paidAmount: number
  paidAt: string | null
}

export type OperationCredit = {
  id: string
  operationId: string
  operationNumber: string
  planId: string | null
  calculationMethod: CreditCalculationMethod
  installmentCount: number
  interestRate: number
  financedAmount: number
  totalInterest: number
  totalAmount: number
  installmentAmount: number
  status: CreditOperationStatus
  createdAt: string
  installments: OperationCreditInstallmentSummary[]
}

export type ConfirmOperationCreditInput = {
  planId: string
  financedAmount: number
  firstDueDate: string
}

export type CreditInstallment = {
  id: string
  operationCreditId: string
  operationId: string
  operationNumber: string
  clientName: string
  number: number
  amount: number
  dueDate: string
  status: CreditInstallmentStatus
  paidAmount: number
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export type CreditInstallmentQuery = {
  page: number
  limit: number
  status?: CreditInstallmentStatus
  operationId?: string
  search?: string
  organizationId?: string
}

export type PayCreditInstallmentInput = {
  amount: number
  paymentDate: string
}

export type PageResponse<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}
