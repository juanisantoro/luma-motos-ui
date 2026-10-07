export type FinancialStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO'
export type FinancialKind = 'purchase' | 'income' | 'expense'
export type FinancialVehicleType = 'MOTO' | 'AUTO'
export type DecimalString = string

export type PageResponse<T> = {
  items: T[]
  total: number
  page: number
  limit: number
  // Ingresos, gastos y compras: suma de TODO lo que trae el filtro (no sólo la
  // página), una entrada por moneda. Ausente en los demás listados y, en
  // compras, sin permiso para ver costos.
  totals?: Array<{ currency: string; amount: DecimalString }>
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
  operation: { id: string; number: string; ticketNumber?: string | null } | null
  collector?: MinimalPersonnel | null
  account?: MinimalAccount | null
  // Medio, quién recibió la plata y rendición del efectivo.
  paymentMethod?: IncomePaymentMethod | null
  collectedBy?: MinimalPersonnel | null
  handover?: {
    status: 'PENDIENTE_RENDICION' | 'RENDIDO'
    recipient: MinimalPersonnel | null
    confirmedAt: string | null
    confirmedBy: MinimalPersonnel | null
  } | null
  rowVersion?: number
}

export type IncomePaymentMethod =
  | 'EFECTIVO'
  | 'TRANSFERENCIA_BANCARIA'
  | 'TARJETA'
  | 'DESEMBOLSO_FINANCIERA'
  | 'PAGARE'
  | 'OTRO'

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
  // Ingresos: rendición del efectivo (estado y a quién se rinde).
  handoverStatus?: 'PENDIENTE_RENDICION' | 'RENDIDO'
  handoverToId?: string
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
  /** Circuito donde se carga: ubica en la grilla al ingreso sin unidad ni operación. */
  vehicleType?: FinancialVehicleType
  description: string
  totalAmount: DecimalString
  currency?: string
  notes?: string
  paymentMethod?: IncomePaymentMethod
  collectedById?: string
  handoverToId?: string
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
  branch?: MinimalBranch | null
  responsiblePersonnel?: MinimalPersonnel | null
  // Cuentas creadas por la importación del Excel histórico.
  imported?: boolean
  importedLabel?: string | null
}

export type CashAccountInput = {
  name: string
  type: CashAccountType
  branchId?: string | null
  responsiblePersonnelId?: string | null
  /** Sólo en el alta: la moneda de una cuenta no cambia. */
  currency?: string
  active?: boolean
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

// Transferencia interna: pasa plata de una caja a otra de la misma moneda.
export type CashTransfer = {
  id: string
  amount: DecimalString
  occurredAt: string
  reference: string | null
  status: 'CONFIRMADA' | 'REVERSADA' | 'PENDIENTE'
  sourceAccount: { id: string; code: string; name: string; type: string }
  destinationAccount: { id: string; code: string; name: string; type: string }
  createdBy: MinimalPersonnel
  createdAt: string
}

export type CashTransferInput = {
  idempotencyKey: string
  sourceAccountId: string
  destinationAccountId: string
  amount: DecimalString
  occurredAt?: string
  reference?: string
  notes?: string
}

// Retiro de un socio desde una caja de la que es responsable. No es un gasto.
export type PartnerWithdrawal = {
  id: string
  date: string
  amount: DecimalString
  currency: string
  reason: string
  status: 'REGISTRADO' | 'ANULADO'
  account: { id: string; name: string; type: string | null }
  branch: MinimalBranch | null
  partner: MinimalPersonnel | null
  registeredBy: MinimalPersonnel | null
  createdAt: string
  reversal: {
    at: string
    by: MinimalPersonnel | null
    reason: string | null
  } | null
}

export type PartnerWithdrawalPage = PageResponse<PartnerWithdrawal> & {
  /** Total vigente (sin anulados) por moneda. */
  totals: Array<{ currency: string; amount: DecimalString }>
}

export type PartnerWithdrawalInput = {
  idempotencyKey: string
  accountId: string
  amount: DecimalString
  date: string
  reason: string
}

export type CashOperationQuery = {
  page: number
  limit: number
  branchId?: string
  accountId?: string
  from?: string
  to?: string
}
