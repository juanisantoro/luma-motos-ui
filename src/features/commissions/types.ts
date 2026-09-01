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

export type ManagerCommissionMode = 'PORCENTAJE' | 'ESCALA'
export type ManagerCommissionScope = 'SUCURSAL_PROPIA' | 'TODAS_LAS_SUCURSALES'

export type ManagerCommissionConfig = {
  mode: ManagerCommissionMode
  percentage: string | null
  policyId: string | null
  scope: ManagerCommissionScope
  active: boolean
  updatedAt: string
}

export type SaveManagerCommissionConfigInput = {
  mode: ManagerCommissionMode
  percentage?: string
  policyId?: string
  scope: ManagerCommissionScope
  active?: boolean
}

export type ManagerCommission = {
  type: 'GERENTE'
  manager: CommissionPerson
  period: string
  vehicleType: CommissionVehicleType
  scope: ManagerCommissionScope
  branchCount: number
  mode: ManagerCommissionMode
  computableSales: number
  totalClosingPrice: string
  suggestedAmount: string
  scale: CommissionTier | null
  nextScale: CommissionTier | null
  unitsToNextScale: number | null
}

// Manager (GERENTE) commission settlements - agree/pay flow, its own table
// on the backend (liquidaciones_comisiones_gerente), separate from vendor
// settlements above.

export type ManagerCommissionSettlementStatus = 'SUGGESTED' | 'AGREED' | 'PAID'

export type ManagerCommissionSettlement = {
  id: string
  manager: CommissionPerson
  period: string
  vehicleType: CommissionVehicleType
  mode: ManagerCommissionMode
  scope: ManagerCommissionScope
  branchIds: string[]
  computableSales: number
  percentage: string | null
  policyId: string | null
  scale: Record<string, unknown> | null
  amount: string
  currency: string
  status: ManagerCommissionSettlementStatus
  version: number
  notes: string | null
  agreedAt: string | null
  agreedBy: CommissionPerson | null
  paidAt: string | null
  paidBy: CommissionPerson | null
  createdAt: string
  updatedAt: string
}

export type ManagerCommissionSuggestion = ManagerCommission & {
  id: string
  settlement: ManagerCommissionSettlement | null
}

export type ManagerCommissionSuggestionQuery = {
  period: string
  vehicleType: CommissionVehicleType
  managerId?: string
  page?: number
  limit?: number
}

export type ManagerCommissionSettlementQuery = {
  vehicleType: CommissionVehicleType
  status?: ManagerCommissionSettlementStatus
  period?: string
  managerId?: string
  page?: number
  limit?: number
}

export type ManagerCommissionHistoryQuery = {
  vehicleType: CommissionVehicleType
  managerId?: string
  paidFrom?: string
  paidTo?: string
  year?: number
  month?: number
  page?: number
  limit?: number
}

export type AgreeManagerCommissionInput = {
  expectedVersion?: number
}

export type PayManagerCommissionInput = {
  paidAt: string
  expectedVersion: number
  notes?: string
}

export type MyCommissions = {
  progress: CommissionDetail
  paidHistory: CommissionPage<PaidCommission>
  // Optional so existing mocked gateways/tests that predate manager
  // commissions keep type-checking without changes. The real API always
  // includes it (null when the actor is not a GERENTE with active config).
  managerCommission?: (ManagerCommission & { settlement: ManagerCommissionSettlement | null }) | null
  // Past agreed/paid manager settlements for the acting GERENTE - same
  // optionality reasoning as managerCommission above.
  managerSettlementHistory?: CommissionPage<ManagerCommissionSettlement> | null
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
  // Manager (GERENTE) commission configuration. Optional so gateway mocks
  // built before this feature (in tests) keep satisfying the type.
  getManagerConfig?: (
    managerId: string,
    signal?: AbortSignal,
  ) => Promise<ManagerCommissionConfig | null>
  saveManagerConfig?: (
    managerId: string,
    input: SaveManagerCommissionConfigInput,
  ) => Promise<ManagerCommissionConfig | null>
  // Manager (GERENTE) commission settlements - admin "Gerentes" view.
  // Optional for the same mock-compatibility reason as the pair above.
  listManagerSuggestions?: (
    query: ManagerCommissionSuggestionQuery,
    signal?: AbortSignal,
  ) => Promise<CommissionPage<ManagerCommissionSuggestion>>
  agreeManagerCommission?: (
    id: string,
    input: AgreeManagerCommissionInput,
  ) => Promise<ManagerCommissionSettlement>
  listManagerSettlements?: (
    query: ManagerCommissionSettlementQuery,
    signal?: AbortSignal,
  ) => Promise<CommissionPage<ManagerCommissionSettlement>>
  payManagerCommission?: (
    id: string,
    input: PayManagerCommissionInput,
  ) => Promise<ManagerCommissionSettlement>
  listManagerHistory?: (
    query: ManagerCommissionHistoryQuery,
    signal?: AbortSignal,
  ) => Promise<CommissionPage<ManagerCommissionSettlement>>
}
