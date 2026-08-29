export type CommissionVehicleType = 'MOTO' | 'AUTO'

export type CommissionStatus =
  | 'CALCULATED'
  | 'AGREED'
  | 'PENDING_PAYMENT'
  | 'PAID'

export type CommissionConfigurationStatus = 'CONFIGURED' | 'NOT_CONFIGURED'
export type CommissionPolicyStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'

export type CommissionTier = {
  id: string
  minUnits: number
  maxUnits: number | null
  fixedAmount: string
  validFrom: string
  validTo: string | null
}

export type CommissionScalePolicy = {
  id: string
  vehicleType: CommissionVehicleType
  currency: 'ARS'
  validFrom: string
  validTo: string | null
  status: CommissionPolicyStatus
  version: number
  tiers: CommissionTier[]
}

export type CommissionPerson = {
  id: string
  name: string
}

export type CommissionBranch = {
  id: string
  name: string
}

export type CommissionAccount = {
  id: string
  code: string
  name: string
}

export type CommissionSummary = {
  id: string
  seller: CommissionPerson
  branch: CommissionBranch
  period: string
  vehicleType: CommissionVehicleType
  configurationStatus: CommissionConfigurationStatus
  computableSales: number
  scale: CommissionTier | null
  suggestedAmount: string | null
  status: CommissionStatus
  nextScale: CommissionTier | null
  unitsToNextScale: number | null
  version: number
}

export type CommissionOperation = {
  id: string
  date: string
  customerName: string
  vehicleLabel: string
  listPrice: string | null
  closingPrice: string
  difference: string
  belowList: boolean
  computable: boolean
  nonComputableReason: string | null
  status: string
}

export type CommissionDetail = CommissionSummary & {
  operations: CommissionOperation[]
  settlement: CommissionSettlement | null
}

export type CommissionSettlement = CommissionSummary & {
  agreedAmount: string
  meetingDate: string
  notes: string | null
}

export type PaidCommission = CommissionSettlement & {
  paidAt: string
  paidAmount: string
  account: CommissionAccount
  reference: string
  scaleSnapshot: {
    minUnits: number
    maxUnits: number | null
    fixedAmount: string
  }
  auditTrail?: Array<{
    action: string
    actorId: string
    at: string
  }>
}

export type CommissionPage<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export type CommissionOptions = {
  sellers: CommissionPerson[]
  branches: CommissionBranch[]
}

export type CommissionPaymentOptions = {
  accounts: CommissionAccount[]
}

export type CommissionListQuery = {
  vehicleType: CommissionVehicleType
  period?: string
  branchId?: string
  sellerId?: string
  minSales?: number
  maxSales?: number
  page?: number
  limit?: number
}

export type PaidCommissionQuery = {
  vehicleType: CommissionVehicleType
  sellerId?: string
  branchId?: string
  paidFrom?: string
  paidTo?: string
  year?: number
  month?: number
  page?: number
  limit?: number
}

export type AgreementInput = {
  agreedAmount: string
  meetingDate: string
  notes?: string
  expectedVersion?: number
}

export type PaymentInput = {
  idempotencyKey: string
  expectedVersion: number
  accountId: string
  paidAt: string
  reference: string
  receipt?: string
  notes?: string
}

export type SaveScalePolicyInput = {
  vehicleType: CommissionVehicleType
  currency: 'ARS'
  validFrom: string
  validTo?: string
  status: Extract<CommissionPolicyStatus, 'DRAFT' | 'ACTIVE'>
  tiers: Array<{
    minUnits: number
    maxUnits: number | null
    fixedAmount: string
  }>
}

export type MyCommissionSection = {
  vehicleType: CommissionVehicleType
  current: CommissionDetail | null
  policyConfigured: boolean
}

export type MyCommissions = {
  progress: CommissionDetail
  paidHistory: CommissionPage<PaidCommission>
}

export type CommissionGateway = {
  listOptions: (signal?: AbortSignal) => Promise<CommissionOptions>
  listPaymentOptions: (signal?: AbortSignal) => Promise<CommissionPaymentOptions>
  listSuggestions: (
    query: CommissionListQuery,
    signal?: AbortSignal,
  ) => Promise<CommissionPage<CommissionSummary>>
  getSuggestion: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<CommissionDetail>
  registerAgreement: (
    id: string,
    input: AgreementInput,
  ) => Promise<CommissionSettlement>
  listPayable: (
    query: CommissionListQuery,
    signal?: AbortSignal,
  ) => Promise<CommissionPage<CommissionSettlement>>
  pay: (
    id: string,
    input: PaymentInput,
  ) => Promise<PaidCommission>
  listPaid: (
    query: PaidCommissionQuery,
    signal?: AbortSignal,
  ) => Promise<CommissionPage<PaidCommission>>
  listPolicies: (
    vehicleType: CommissionVehicleType,
    signal?: AbortSignal,
  ) => Promise<CommissionPage<CommissionScalePolicy>>
  savePolicy: (
    input: SaveScalePolicyInput,
  ) => Promise<CommissionScalePolicy>
  getMine: (
    period: string,
    vehicleType: CommissionVehicleType,
    signal?: AbortSignal,
  ) => Promise<MyCommissions>
}
