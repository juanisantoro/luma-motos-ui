import { ApiError } from '../../shared/api/client'
import { financialErrorMessage } from '../finance/format'
import { cashCollectionErrorMessage } from '../sales/tracking'
import type { ServiceOrder, ServiceOrderStatus, VehicleCondition } from './types'

export const statusLabels: Record<ServiceOrderStatus, string> = {
  RECIBIDA: 'Recibida',
  EN_TALLER: 'En el taller',
  TERMINADA: 'Lista para entregar',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada',
}

export const statusTones: Record<ServiceOrderStatus, string> = {
  RECIBIDA: 'status-badge--warning',
  EN_TALLER: 'status-badge--info',
  TERMINADA: 'status-badge--success',
  ENTREGADA: '',
  CANCELADA: 'status-badge--danger',
}

export const conditionLabels: Record<VehicleCondition, string> = {
  OPTIMO: 'Óptimo',
  BUENO: 'Bueno',
  REGULAR: 'Regular',
}

/** `7` → `000007`, como en la planilla en papel. */
export function orderNumber(value: number) {
  return String(value).padStart(6, '0')
}

export function formatDay(value: string | null | undefined) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function formatKm(value: number | null | undefined) {
  return value === null || value === undefined
    ? '—'
    : `${new Intl.NumberFormat('es-AR').format(value)} km`
}

export function vehicleLabel(order: Pick<ServiceOrder, 'vehicle'>) {
  return (
    [order.vehicle.plate, order.vehicle.model].filter(Boolean).join(' · ') ||
    order.vehicle.chassis ||
    '—'
  )
}

export function partsTotal(order: Pick<ServiceOrder, 'parts'>) {
  return order.parts.reduce(
    (sum, part) => sum + (part.unitPrice ? Number(part.unitPrice) * part.quantity : 0),
    0,
  )
}

export function serviceErrorMessage(error: unknown) {
  const cash = cashCollectionErrorMessage(error)
  if (cash) return cash
  if (error instanceof ApiError) {
    const code = error.details?.code
    if (error.status === 403) return 'No tenés permiso para hacer esto.'
    // Los errores propios de Service ya vienen explicados desde la API.
    if (typeof code === 'string' && (code.startsWith('SERVICE_') || code === 'STALE_VERSION' ||
      ['VEHICLE_REQUIRED', 'CLIENT_REQUIRED', 'CLIENT_NOT_FOUND', 'UNIT_NOT_FOUND', 'FUTURE_DELIVERY_DATE'].includes(code)))
      return error.message
  }
  return financialErrorMessage(error)
}
