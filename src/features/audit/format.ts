import { formatMoney } from '../finance/format'
import type {
  AuditData,
  AuditEvent,
  MoneyMovement,
} from './types'

const ZONE = 'America/Argentina/Buenos_Aires'
// Argentina no cambia la hora: el día comercial siempre es UTC-3.
const OFFSET = '-03:00'

export function dayStart(date: string) {
  return `${date}T00:00:00.000${OFFSET}`
}

export function dayEnd(date: string) {
  return `${date}T23:59:59.999${OFFSET}`
}

const dateTimeParts = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Fecha y hora de Argentina con segundos: `04/10/2026 12:30:12`. */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const parts = Object.fromEntries(
    dateTimeParts.formatToParts(date).map((part) => [part.type, part.value]),
  )
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`
}

/** Día de Argentina (`YYYY-MM-DD`) corrido `offsetDays` desde hoy. */
export function argentinaDay(offsetDays = 0, now = new Date()) {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(shifted)
}

/**
 * Fecha contable de un movimiento. Si se guardó sólo el día (medianoche UTC)
 * se muestra ese día; si se guardó un instante (p. ej. una reversa), el día
 * de Argentina.
 */
export function formatAccountingDate(value: string) {
  if (/T00:00:00(\.000)?Z$/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-')
    return `${day}/${month}/${year}`
  }
  return formatDateTime(value).slice(0, 10)
}

/** `2026-10-03` → `03/10/2026`. */
export function formatDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

export function actorName(event: AuditEvent) {
  if (!event.actor) return 'Sistema'
  return event.actor.name ?? event.actor.email
}

export const movementTypeLabels: Record<MoneyMovement['type'], string> = {
  INGRESO: 'Cobro',
  EGRESO: 'Pago',
  TRANSFERENCIA_ENTRANTE: 'Transferencia recibida',
  TRANSFERENCIA_SALIENTE: 'Transferencia enviada',
  REINTEGRO: 'Reintegro',
  AJUSTE: 'Ajuste',
}

export const sourceKindLabels: Record<string, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
  PURCHASE: 'Compra',
  COMMISSION: 'Comisión',
  TRANSFER: 'Transferencia',
  WITHDRAWAL: 'Retiro de socio',
  VEHICLE_EXPENSE: 'Gasto de moto o auto',
  OTHER: 'Otro',
}

export const paymentMethodLabels: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA_BANCARIA: 'Transferencia bancaria',
  TARJETA: 'Tarjeta',
  DESEMBOLSO_FINANCIERA: 'Desembolso de financiera',
  PAGARE: 'Pagaré',
  OTRO: 'Otro',
}

export function handoverLabel(movement: MoneyMovement) {
  const handover = movement.handover
  if (!handover?.to) return null
  if (handover.status === 'RENDIDO')
    return `Rendido a ${handover.to.fullName}. Confirmó ${
      handover.confirmedBy?.fullName ?? handover.to.fullName
    } el ${formatDateTime(handover.confirmedAt)}`
  return `Pendiente de rendir a ${handover.to.fullName}`
}

const fieldLabels: Record<string, string> = {
  value: 'Valor',
  type: 'Tipo',
  description: 'Descripción',
  amount: 'Importe',
  incomeDate: 'Fecha del ingreso',
  paymentMethod: 'Medio de pago',
  collectedBy: 'Cobró',
  handoverTo: 'Rinde a',
  handoverStatus: 'Rendición',
  operationNumber: 'N.º de operación',
  client: 'Cliente',
  clientId: 'Cliente (id)',
  branch: 'Sucursal',
  reference: 'Referencia',
  notes: 'Observaciones',
  sellerIds: 'Vendedores asignados',
  agreedPrice: 'Precio acordado',
  paymentPlatform: 'Plataforma de pago',
  creditAmount: 'Monto de crédito',
  operationDate: 'Fecha de la operación',
  ticketNumber: 'N.º de boleto',
  status: 'Estado',
  email: 'Correo',
  roleId: 'Rol (id)',
  roleCode: 'Rol',
  branchId: 'Sucursal (id)',
  active: 'Activo',
  reason: 'Motivo',
  componentId: 'Componente del plan (id)',
}

const valueLabels: Record<string, string> = {
  PENDIENTE_RENDICION: 'Pendiente de rendir',
  RENDIDO: 'Rendido',
  ...paymentMethodLabels,
}

export function fieldLabel(key: string) {
  return fieldLabels[key] ?? key
}

const moneyFields = new Set(['amount', 'agreedPrice', 'creditAmount'])

export function fieldValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'string') {
    if (key && moneyFields.has(key)) return formatMoney(value)
    return valueLabels[value] ?? value
  }
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value))
    return value.length ? value.map((item) => fieldValue(item)).join(', ') : '—'
  return JSON.stringify(value)
}

export type AuditChange = {
  key: string
  label: string
  before: string
  after: string
  changed: boolean
}

/**
 * Antes / después de un evento. Con las dos fotos compara campo por campo;
 * con una sola lista lo que se guardó.
 */
function snapshot(data: AuditData): Record<string, unknown> | null {
  if (data === null || data === undefined) return null
  if (typeof data === 'object' && !Array.isArray(data))
    return data as Record<string, unknown>
  return { value: data }
}

export function auditChanges(
  previousData: AuditData,
  currentData: AuditData,
): AuditChange[] {
  const previous = snapshot(previousData)
  const current = snapshot(currentData)
  const keys = [
    ...new Set([...Object.keys(previous ?? {}), ...Object.keys(current ?? {})]),
  ]
  return keys.map((key) => {
    const before = previous && key in previous ? fieldValue(previous[key], key) : '—'
    const after = current && key in current ? fieldValue(current[key], key) : '—'
    return {
      key,
      label: fieldLabel(key),
      before,
      after,
      changed: Boolean(previous && current) && before !== after,
    }
  })
}

/** Entradas menos salidas de una caja, sin perder centavos. */
export function netAmount(row: { credit: string; debit: string }) {
  const cents = (value: string) => Math.round(Number(value) * 100)
  return ((cents(row.credit) - cents(row.debit)) / 100).toFixed(2)
}
