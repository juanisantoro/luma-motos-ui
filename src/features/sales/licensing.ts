import type {
  SalesLicensingMode,
  SalesLicensingStatus,
  SalesOperation,
} from './types'

export const licensingModeLabels: Record<SalesLicensingMode, string> = {
  BONIFICADA: 'Bonificada',
  PAGA_CLIENTE: 'Paga el cliente',
}

export const licensingModeDescriptions: Record<SalesLicensingMode, string> = {
  BONIFICADA: 'No se le cobra la patente al cliente.',
  PAGA_CLIENTE: 'El cliente paga la patente; el cobro se registra cuando llega.',
}

export const licensingStatusLabels: Record<SalesLicensingStatus, string> = {
  SIN_DEFINIR: 'Sin definir',
  COBRO_PENDIENTE: 'Cobro pendiente',
  COBRADO: 'Cobrado',
  PAGO_PENDIENTE: 'Pago pendiente',
  PAGADO: 'Pagado',
}

export function licensingStatusClass(status: SalesLicensingStatus) {
  if (status === 'COBRADO' || status === 'PAGADO') return 'status-badge--success'
  if (status === 'SIN_DEFINIR') return ''
  return 'status-badge--warning'
}

// Misma regla que el backend (src/sales/licensing.ts): 10 y 15 días hábiles
// (lunes a viernes, sin feriados) desde la fecha de la operación. Sólo se usa
// para mostrar la ventana en la previsualización; el valor persistido lo
// calcula la API.
export const LICENSING_ESTIMATE_BUSINESS_DAYS = { from: 10, to: 15 } as const

export function addBusinessDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return null
  const result = new Date(Date.UTC(year, month - 1, day))
  let remaining = days
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    const weekday = result.getUTCDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return result.toISOString().slice(0, 10)
}

export function licensingEstimate(operationDate: string) {
  const from = addBusinessDays(
    operationDate,
    LICENSING_ESTIMATE_BUSINESS_DAYS.from,
  )
  const to = addBusinessDays(operationDate, LICENSING_ESTIMATE_BUSINESS_DAYS.to)
  return from && to ? { from, to } : null
}

export function formatIsoDate(value: string | null | undefined) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

export function licensingWindowLabel(
  from: string | null | undefined,
  to: string | null | undefined,
) {
  if (!from || !to) return 'Sin fecha estimada'
  return `Patente estimada entre ${formatIsoDate(from)} y ${formatIsoDate(to)}`
}

export function isLicensingOverdue(operation: SalesOperation) {
  return operation.licensing?.overdue === true
}
