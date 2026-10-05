export type AuditCategory =
  | 'VENTAS'
  | 'DINERO'
  | 'STOCK'
  | 'CLIENTES'
  | 'CREDITOS'
  | 'COMISIONES'
  | 'CATALOGO'
  | 'USUARIOS'
  | 'ACCESOS'
  | 'OTROS'

export type AuditPerson = { id: string; fullName: string }

export type AuditSubject = {
  title: string
  detail: string | null
  amount: string | null
  operationId: string | null
  operationNumber: string | null
}

/** JSON guardado por el backend: casi siempre un objeto. */
export type AuditData = unknown

export type AuditEvent = {
  id: string
  createdAt: string
  action: string
  actionLabel: string
  category: AuditCategory
  categoryLabel: string
  entity: string
  entityId: string | null
  subject: AuditSubject | null
  /** Registro de otra sucursal: sin detalle para un usuario acotado. */
  restricted: boolean
  metadata: AuditData
  previousData: AuditData
  ipAddress: string | null
  actor: {
    id: string
    email: string
    name: string | null
    role: string | null
  } | null
  branch: { id: string; code: string; name: string } | null
}

export type AuditPage<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export type AuditFilters = {
  categories: Array<{ code: AuditCategory; label: string }>
  actions: Array<{ code: string; label: string; category: AuditCategory }>
  actors: Array<{
    id: string
    email: string
    name: string | null
    active: boolean
  }>
  accounts: Array<{
    id: string
    name: string
    currency: string
    branchId: string | null
    active: boolean
  }>
  branches: Array<{ id: string; code: string; name: string }>
}

export type AuditLogQuery = {
  page: number
  limit: number
  from?: string
  to?: string
  category?: AuditCategory | ''
  action?: string
  actorId?: string
  operationNumber?: string
}

export type MoneyDirection = 'CREDITO' | 'DEBITO'

export type MoneyMovementType =
  | 'INGRESO'
  | 'EGRESO'
  | 'TRANSFERENCIA_ENTRANTE'
  | 'TRANSFERENCIA_SALIENTE'
  | 'REINTEGRO'
  | 'AJUSTE'

export type MoneyMovement = {
  id: string
  createdAt: string
  occurredAt: string
  account: {
    id: string
    code: string
    name: string
    type: string
    currency: string
  }
  branch: { id: string; code: string; name: string } | null
  type: MoneyMovementType
  direction: MoneyDirection
  /** `null`: compra cuyo costo el usuario no puede ver. */
  amount: string | null
  reference: string | null
  notes: string | null
  registeredBy: AuditPerson | null
  source: { kind: string; id: string | null; title: string }
  client: string | null
  operation: { id: string; number: string; client: string } | null
  paymentMethod: string | null
  handover: {
    to: AuditPerson | null
    status: 'PENDIENTE_RENDICION' | 'RENDIDO' | null
    confirmedAt: string | null
    confirmedBy: AuditPerson | null
  } | null
  reversalOfId: string | null
  reversal: {
    id: string
    at: string
    by: AuditPerson | null
    notes: string | null
  } | null
}

export type MoneySummaryRow = {
  account: { id: string; name: string; type: string }
  branch: { id: string; code: string; name: string } | null
  currency: string
  credit: string
  debit: string
  /** Efectivo cobrado que todavía no confirmó quien lo recibe. */
  pendingHandover: string
}

export type MoneyPage = AuditPage<MoneyMovement> & {
  /** Un total por moneda; `null` si el perfil no ve costos de compra. */
  totals: Array<{ currency: string; credit: string; debit: string }> | null
  /** Una fila por caja, para el cierre; `null` igual que `totals`. */
  summary: MoneySummaryRow[] | null
}

export type MoneyQuery = {
  page: number
  limit: number
  from?: string
  to?: string
  accountId?: string
  branchId?: string
  direction?: MoneyDirection | ''
  actorId?: string
  operationNumber?: string
  search?: string
  onlyReversals?: boolean
}

export type OperationTrace = {
  operation: {
    id: string
    number: string
    ticketNumber: string | null
    date: string
    status: string
    deliveryStatus: string
    deliveredAt: string | null
    client: string
    vehicle: string
    vin: string | null
    branch: { id: string; code: string; name: string }
    listPrice: string | null
    minimumPrice: string | null
    agreedPrice: string | null
    createdBy: AuditPerson | null
    createdAt: string
    updatedAt: string
  }
  approvals: Array<{
    id: string
    decision: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
    requestedBy: AuditPerson | null
    requestedAt: string
    decidedBy: AuditPerson | null
    decidedAt: string | null
    listPrice: string | null
    minimumPrice: string | null
    agreedPrice: string | null
    reason: string | null
  }>
  events: AuditEvent[]
  eventsTotal: number
  movements: MoneyMovement[]
}
