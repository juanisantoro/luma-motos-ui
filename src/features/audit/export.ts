import type { ExcelColumn } from '../../shared/export/excel'
import {
  actorName,
  formatDateTime,
  formatDay,
  handoverLabel,
  movementTypeLabels,
  netAmount,
  paymentMethodLabels,
  sourceKindLabels,
} from './format'
import type {
  AuditEvent,
  AuditFilters,
  AuditLogQuery,
  MoneyMovement,
  MoneyQuery,
  MoneySummaryRow,
} from './types'

// Columnas de las exportaciones a Excel de Auditoría. Las mismas que traía el
// CSV, con importes como número y fechas como fecha.

export const eventColumns: Array<ExcelColumn<AuditEvent>> = [
  { header: 'Fecha y hora', value: (event) => event.createdAt, type: 'datetime' },
  { header: 'Usuario', value: actorName },
  { header: 'Correo', value: (event) => event.actor?.email },
  { header: 'Rol', value: (event) => event.actor?.role },
  { header: 'Sucursal', value: (event) => event.branch?.name },
  { header: 'Módulo', value: (event) => event.categoryLabel },
  { header: 'Acción', value: (event) => event.actionLabel },
  {
    header: 'Sobre qué',
    value: (event) =>
      event.restricted ? 'Registro de otra sucursal' : event.subject?.title,
  },
  { header: 'Detalle', value: (event) => event.subject?.detail },
  { header: 'Importe', value: (event) => event.subject?.amount, type: 'money' },
  {
    header: 'N.º operación',
    value: (event) => event.subject?.operationNumber,
    type: 'integer',
  },
  { header: 'IP', value: (event) => event.ipAddress },
]

function movementAmount(
  movement: MoneyMovement,
  direction: MoneyMovement['direction'],
) {
  if (movement.direction !== direction) return null
  // Compra cuyo costo el perfil no ve: igual que en la grilla.
  return movement.amount ?? 'Reservado'
}

export const movementColumns: Array<ExcelColumn<MoneyMovement>> = [
  { header: 'Fecha', value: (movement) => movement.date, type: 'date' },
  { header: 'Cargado el', value: (movement) => movement.createdAt, type: 'datetime' },
  { header: 'Cuenta', value: (movement) => movement.account.name },
  { header: 'Moneda', value: (movement) => movement.account.currency },
  { header: 'Sucursal', value: (movement) => movement.branch?.name ?? 'Compartida' },
  {
    header: 'Origen',
    value: (movement) => sourceKindLabels[movement.source.kind] ?? 'Otro',
  },
  { header: 'Movimiento', value: (movement) => movementTypeLabels[movement.type] },
  { header: 'Concepto', value: (movement) => movement.source.title },
  {
    header: 'N.º operación',
    value: (movement) => movement.operation?.number,
    type: 'integer',
  },
  {
    header: 'Cliente',
    value: (movement) => movement.operation?.client ?? movement.client,
  },
  {
    header: 'Medio',
    value: (movement) =>
      movement.paymentMethod
        ? (paymentMethodLabels[movement.paymentMethod] ?? movement.paymentMethod)
        : null,
  },
  {
    header: 'Entrada',
    value: (movement) => movementAmount(movement, 'CREDITO'),
    type: 'money',
  },
  {
    header: 'Salida',
    value: (movement) => movementAmount(movement, 'DEBITO'),
    type: 'money',
  },
  { header: 'Registró', value: (movement) => movement.registeredBy?.fullName },
  { header: 'Rendición', value: handoverLabel },
  {
    header: 'Reversado',
    value: (movement) =>
      movement.reversal
        ? `Sí, ${movement.reversal.by?.fullName ?? ''} el ${formatDateTime(movement.reversal.at)}`
        : movement.reversalOfId
          ? 'Es una reversa'
          : null,
  },
  { header: 'Referencia', value: (movement) => movement.reference },
  { header: 'Notas', value: (movement) => movement.notes },
]

export const summaryColumns: Array<ExcelColumn<MoneySummaryRow>> = [
  { header: 'Sucursal', value: (row) => row.branch?.name ?? 'Compartida' },
  { header: 'Caja', value: (row) => row.account.name },
  { header: 'Moneda', value: (row) => row.currency },
  { header: 'Entradas', value: (row) => row.credit, type: 'money' },
  { header: 'Salidas', value: (row) => row.debit, type: 'money' },
  { header: 'Neto', value: netAmount, type: 'money' },
  {
    header: 'Pendiente de rendir',
    value: (row) => row.pendingHandover,
    type: 'money',
  },
]

function actorLabel(filters: AuditFilters | null, actorId: string | undefined) {
  if (!actorId) return null
  const actor = filters?.actors.find((item) => item.id === actorId)
  return actor ? (actor.name ?? actor.email) : actorId
}

/** Filtros aplicados (no lo que se está editando) de la pestaña Actividad. */
export function describeActivityFilters(
  query: AuditLogQuery,
  filters: AuditFilters | null,
) {
  const category = filters?.categories.find(
    (item) => item.code === query.category,
  )
  const action = filters?.actions.find((item) => item.code === query.action)
  const actor = actorLabel(filters, query.actorId)
  return [
    query.from && `Desde: ${formatDay(query.from)}`,
    query.to && `Hasta: ${formatDay(query.to)}`,
    query.category && `Módulo: ${category?.label ?? query.category}`,
    query.action && `Acción: ${action?.label ?? query.action}`,
    actor && `Usuario: ${actor}`,
    query.operationNumber?.trim() &&
      `N.º de operación: ${query.operationNumber.trim()}`,
  ]
}

const directionLabels = { CREDITO: 'Sólo entradas', DEBITO: 'Sólo salidas' }

/** Filtros aplicados de la pestaña Movimientos de dinero. */
export function describeMoneyFilters(
  query: MoneyQuery,
  filters: AuditFilters | null,
) {
  const branch = filters?.branches.find((item) => item.id === query.branchId)
  const account = filters?.accounts.find((item) => item.id === query.accountId)
  const actor = actorLabel(filters, query.actorId)
  return [
    query.from && `Fecha desde: ${formatDay(query.from)}`,
    query.to && `Fecha hasta: ${formatDay(query.to)}`,
    query.branchId && `Sucursal: ${branch?.name ?? query.branchId}`,
    query.accountId && `Cuenta: ${account?.name ?? query.accountId}`,
    query.direction && `Sentido: ${directionLabels[query.direction]}`,
    actor && `Registró: ${actor}`,
    query.operationNumber?.trim() &&
      `N.º de operación: ${query.operationNumber.trim()}`,
    query.search?.trim() && `Buscar: ${query.search.trim()}`,
    query.onlyReversals && 'Sólo reversados y reversas',
  ]
}
