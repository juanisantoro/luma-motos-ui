export type DashboardGreeting = {
  name: string
  organizationName: string
  branchName: string | null
  date: string
}

export type MonthlyPerformance = {
  period: string
  currentMonth: { units: number; amount: number }
  previousMonth: { units: number; amount: number }
}

export type TopModel = {
  versionId: string
  vehicleType: 'MOTO' | 'AUTO' | null
  brand: string
  model: string
  version: string
  units: number
  amount: number
}

export type BranchSales = {
  branchId: string
  branchName: string
  units: number
  amount: number
}

export type CreditPortfolio = {
  financedAmount: number
  overdueAmount: number
  overdueInstallments: number
}

// --- Tareas pendientes de administración, por sucursal -----------------------

export type PendingTaskKey =
  | 'INSTALLMENTS_DUE_TODAY'
  | 'INSTALLMENTS_OVERDUE'
  | 'INCOMES_PENDING_COLLECTION'
  | 'CASH_PENDING_HANDOVER'
  | 'VEHICLE_PAYMENTS_UNCONFIRMED'
  | 'LICENSING_OVERDUE'
  | 'LICENSING_PENDING_COLLECTION'
  | 'EXPENSES_PENDING_PAYMENT'

export type PendingTasks = {
  branches: Array<{
    branchId: string
    branchName: string
    total: number
    // Sólo las tareas que el usuario tiene permiso de ver.
    tasks: Array<{ key: PendingTaskKey; count: number; amount: number | null }>
  }>
}

// --- ADMINISTRADOR --------------------------------------------------------

// Los números de una sucursal. Cada dato vuelve en null cuando el rol no
// tiene el permiso que lo habilita.
export type AdminBranchSummary = {
  branchId: string
  branchName: string
  monthlySales: MonthlyPerformance | null
  // Cobranza de las ventas del mes de la sucursal.
  collection: {
    agreedAmount: number
    collectedAmount: number
    pendingAmount: number
    pendingOperations: number
  } | null
  expensesThisMonth: { amount: number; count: number } | null
  stockUnits: number | null
  creditPortfolio: CreditPortfolio | null
  pendingApprovals: number | null
  sellers: Array<{ sellerId: string; sellerName: string; units: number }> | null
  topModels: TopModel[] | null
}

export type AdminHome = {
  role: 'ADMINISTRADOR'
  greeting: DashboardGreeting
  // Ausente en respuestas anteriores; null sin permisos sobre esas tareas.
  pendingTasks?: PendingTasks | null
  monthlySales: MonthlyPerformance | null
  newClientsThisWeek: number | null
  stockUnitsTotal: number | null
  creditPortfolio: CreditPortfolio | null
  pendingPurchases: number | null
  salesByBranch: BranchSales[] | null
  topModels: TopModel[] | null
  // Opcional: un backend anterior a la vista por sucursal no lo manda.
  branches?: AdminBranchSummary[] | null
}

// --- GERENTE ---------------------------------------------------------------

export type ApprovalItem = {
  operationId: string
  operationNumber: string
  sellerName: string
  clientName: string
  listPrice: number | null
  agreedPrice: number
  differencePercent: number | null
}

export type TeamRankingItem = {
  sellerId: string
  sellerName: string
  units: number
  amount: number
}

export type ManagerHome = {
  role: 'GERENTE'
  greeting: DashboardGreeting
  pendingTasks?: PendingTasks | null
  pendingApprovalsCount: number | null
  monthlySales: MonthlyPerformance | null
  ownCommission: { period: string; amount: number } | null
  creditOverdue: { amount: number; installments: number } | null
  approvals: ApprovalItem[] | null
  teamRanking: TeamRankingItem[] | null
  topModels: TopModel[] | null
}

// --- ADMINISTRATIVA ----------------------------------------------------------

export type CollectionToday = {
  id: string
  numero_cuota: number
  monto: string | number
  monto_pagado: string | number
  cliente_nombre: string
}

export type RecentInquiry = {
  id: string
  clientName: string
  institutionName: string
  result: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  consultedAt: string
}

export type ManagementAlerts = {
  overdueInstallments: { amount: number; count: number } | null
  staleVehiclePayments: { count: number } | null
  zeroStockModels: {
    items: Array<{
      versionId: string
      vehicleType: 'MOTO' | 'AUTO'
      brand: string
      model: string
      version: string
    }>
    total: number
  } | null
}

export type AdministrativeHome = {
  role: 'ADMINISTRATIVA'
  greeting: DashboardGreeting
  pendingTasks?: PendingTasks | null
  dueTodayAlert: { amount: number; clientCount: number } | null
  dueThisWeek: { amount: number; count: number } | null
  unconfirmedVehiclePayments: { count: number; staleCount: number } | null
  payableExpensesThisWeek: { amount: number; count: number } | null
  collectionsToday: CollectionToday[] | null
  recentInquiries: RecentInquiry[] | null
  managementAlerts: ManagementAlerts | null
  // Fase 5: patentes vencidas sin cargar y PAGA_CLIENTE recibidas con el
  // cobro pendiente (null sin ventas.patentamiento.gestionar; ausente en
  // respuestas anteriores).
  licensingAlerts?: { overdue: number; receivedPendingCollection: number } | null
  topModels: TopModel[] | null
}

// --- VENDEDOR / CALLCENTER --------------------------------------------------

export type AttentionReason =
  | 'RECHAZADA'
  | 'PENDIENTE_APROBACION'
  | 'LISTA_PARA_FIRMAR'
  | 'RESERVA_POR_VENCER'

export type MyOperation = {
  operationId: string
  operationNumber: string
  clientName: string
  amount: number
  reason: AttentionReason
  reservationExpiresAt?: string
}

export type SellerHome = {
  role: 'VENDEDOR'
  greeting: DashboardGreeting
  attentionCount: number | null
  monthlySales: MonthlyPerformance | null
  ownCommission: { period: string; amount: number } | null
  clientsThisWeek: number | null
  myOperations: MyOperation[] | null
  topModels: TopModel[] | null
  quickLinks: {
    bcraCheck: string | null
    catalog: string | null
    newClient: string | null
  }
}

export type OtherRoleHome = {
  role: 'OTRO'
  greeting: DashboardGreeting
}

// A role's screen can also come back as just { role, greeting } with none of
// its section keys - happens when a GERENTE/ADMINISTRATIVA/VENDEDOR user has
// no branch assigned yet. Every consumer below must handle that shape too.
export type DashboardHome =
  | AdminHome
  | ManagerHome
  | AdministrativeHome
  | SellerHome
  | OtherRoleHome
  | { role: 'GERENTE'; greeting: DashboardGreeting }
  | { role: 'ADMINISTRATIVA'; greeting: DashboardGreeting }
  | { role: 'VENDEDOR'; greeting: DashboardGreeting }
