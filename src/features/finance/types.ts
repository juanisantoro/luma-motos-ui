export type FinancialStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO'
export type FinancialKind = 'purchase' | 'income' | 'expense'
export type FinancialVehicleType = 'MOTO' | 'AUTO'
export type DecimalString = string

export type PageResponse<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export type MinimalBranch = {
  id: string
  code: string
  name: string
}

export type MinimalAccount = {
  id: string
  code: string
  name: string
  type: CashAccountType
}

export type MinimalPersonnel = {
  id: string
  fullName: string
}

export type MinimalUnit = {
  id: string
  vin: string
}

export type MinimalVersion = {
  id: string
  name: string
  model: {
    id: string
    name: string
    vehicleType: string
    brand: { id: string; name: string }
  }
}

export type FinancialMovement = {
  id: string
  type:
    | 'INGRESO'
    | 'EGRESO'
    | 'TRANSFERENCIA_ENTRANTE'
    | 'TRANSFERENCIA_SALIENTE'
    | 'REINTEGRO'
    | 'AJUSTE'
  direction: 'CREDITO' | 'DEBITO'
  amount?: DecimalString
  occurredAt: string
  reference: string | null
  notes: string | null
  reversed: boolean
  reversalOfId: string | null
  account: MinimalAccount
  registeredBy: MinimalPersonnel
  createdAt: string
}

type FinancialBase = {
  id: string
  organizationId: string
  branchId: string | null
  paymentStatus: FinancialStatus
  currency: string
  notes: string | null
  branch: MinimalBranch | null
  movements?: FinancialMovement[]
  createdAt: string
  updatedAt: string
}

export type SupplierPurchase = FinancialBase & {
  purchaseDate: string
  supplierId: string
  unitId: string | null
  versionId: string | null
  documentNumber: string | null
  supplier: { id: string; legalName: string }
  vehicle: {
    unit: (MinimalUnit & { licensePlate: string | null }) | null
    version: MinimalVersion | null
  }
  baseAmount?: DecimalString
  additionalCosts?: DecimalString
  totalAmount?: DecimalString
  paidAmount?: DecimalString
  balanceAmount?: DecimalString
}

export type Income = FinancialBase & {
  incomeDate: string
  type: string
  reference: string | null
  unitId: string | null
  operationId: string | null
  description: string
  totalAmount: DecimalString
  paidAmount: DecimalString
  balanceAmount: DecimalString
  vehicle: {
    unit: (MinimalUnit & { licensePlate: string | null }) | null
  } | null
  operation: { id: string; number: string } | null
  collector?: MinimalPersonnel | null
  account?: MinimalAccount | null
}

export type Expense = FinancialBase & {
  expenseDate: string
  month: number
  year: number
  category: string
  reference: string
  description: string
  totalAmount: DecimalString
  paidAmount: DecimalString
  balanceAmount: DecimalString
  recoverable: boolean
  recovered: boolean
  recoveredAmount: DecimalString
  recoverableBalance: DecimalString
  createdBy: MinimalPersonnel
  paidBy: string
  paymentRegisteredBy: MinimalPersonnel | null
  account: MinimalAccount | null
}

export type FinancialRecord = SupplierPurchase | Income | Expense

export type FinancialListQuery = {
  page?: number
  limit?: number
  organizationId?: string
  branchId?: string
  from?: string
  to?: string
  status?: FinancialStatus
  search?: string
  supplierId?: string
  unitId?: string
  versionId?: string
  type?: string
  operationId?: string
  accountId?: string
  collectorId?: string
  category?: string
  recoverable?: boolean
  recovered?: boolean
  vehicleType?: FinancialVehicleType
}

export type CreatePurchaseInput = {
  organizationId?: string
  branchId: string
  purchaseDate: string
  supplierId: string
  unitId?: string
  versionId?: string
  documentNumber?: string
  baseAmount: DecimalString
  additionalCosts?: DecimalString
  currency?: string
  notes?: string
}

export type CreateIncomeInput = {
  organizationId?: string
  branchId: string
  incomeDate: string
  type: string
  reference?: string
  unitId?: string
  operationId?: string
  description: string
  totalAmount: DecimalString
  currency?: string
  notes?: string
}

export type CreateExpenseInput = {
  organizationId?: string
  branchId?: string
  expenseDate: string
  category: string
  reference: string
  description: string
  totalAmount: DecimalString
  paidBy: string
  status: 'PENDIENTE'
  recovered: boolean
  month: number
  year: number
  currency?: string
  recoverable?: boolean
  notes?: string
}

export type FinancialCreateInput =
  | CreatePurchaseInput
  | CreateIncomeInput
  | CreateExpenseInput

export type SettlementInput = {
  idempotencyKey: string
  accountId: string
  amount: DecimalString
  occurredAt?: string
  reference?: string
  notes?: string
}

export type ReverseInput = {
  idempotencyKey: string
  reason: string
}

export type CashAccountType =
  | 'CAJA'
  | 'BANCO'
  | 'SOCIO'
  | 'PROCESADORA_TARJETA'
  | 'FINANCIERA'
  | 'OTRO'

export type CashAccount = {
  id: string
  code: string
  name: string
  type: CashAccountType
  branchId: string | null
  responsiblePersonnelId: string | null
  currency: string
  active: boolean
  balance: DecimalString
}

export type CashAccountListQuery = {
  page?: number
  limit?: number
  type?: CashAccountType
  branchId?: string
  active?: boolean
  search?: string
}

export type SupplierOption = {
  id: string
  legalName: string
  active: boolean
}

export type IncomeTypeOption = {
  id: string
  name: string
}

export type BranchOption = MinimalBranch & {
  organizationId: string
}

export type UnitOption = MinimalUnit & {
  licensePlate: string | null
  version: MinimalVersion
  branch: MinimalBranch
}

export type VersionOption = MinimalVersion & {
  active: boolean
}

export type SalesOperationOption = {
  id: string
  number: string
  operationDate: string
  client: { id: string; fullName: string; active: boolean }
  vehicle: {
    versionName: string
    unit: { id: string; vin: string; licensePlate: string | null } | null
  }
}
