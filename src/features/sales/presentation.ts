import type {
  SalesOperation,
  SalesOperationStatus,
} from './types'

export const operationStatusLabels: Record<SalesOperationStatus, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  CERRADA: 'Cerrada',
}

export function operationStatusClass(status: SalesOperationStatus) {
  if (status === 'APROBADA' || status === 'CERRADA') return 'status-badge--success'
  if (status === 'RECHAZADA' || status === 'CANCELADA') {
    return 'status-badge--danger'
  }
  if (status === 'PENDIENTE_APROBACION') return 'status-badge--warning'
  return ''
}

export function formatMoney(value: string | null, currency: string) {
  if (value === null) return '—'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatOperationDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '—'
  // operationDate es una fecha pura (@db.Date) serializada como
  // "...T00:00:00.000Z". Sin forzar UTC acá, Intl la formatea en el huso
  // horario del navegador y en zonas negativas (Argentina) muestra el día
  // anterior.
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function vehicleLabel(operation: SalesOperation) {
  const { brand, name } = operation.vehicle.model
  return [brand.name, name, operation.vehicle.versionName].filter(Boolean).join(' ')
}
