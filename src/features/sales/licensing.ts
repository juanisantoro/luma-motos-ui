import { useEffect, useState } from 'react'
import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type {
  SalesLicensing,
  SalesLicensingMode,
  SalesLicensingPlateStatus,
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
// (lunes a viernes que no son feriado nacional) desde la fecha de la
// operación. Sólo se usa para mostrar la ventana en la previsualización; el
// valor persistido lo calcula la API. Los feriados salen de
// GET /sales/operations/licensing-calendar (useLicensingHolidays); sin ellos
// se cuenta de lunes a viernes.
export const LICENSING_ESTIMATE_BUSINESS_DAYS = { from: 10, to: 15 } as const

const NO_HOLIDAYS: ReadonlySet<string> = new Set()

export function addBusinessDays(
  isoDate: string,
  days: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
) {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return null
  const result = new Date(Date.UTC(year, month - 1, day))
  let remaining = days
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    const weekday = result.getUTCDay()
    if (
      weekday !== 0 &&
      weekday !== 6 &&
      !holidays.has(result.toISOString().slice(0, 10))
    )
      remaining -= 1
  }
  return result.toISOString().slice(0, 10)
}

export function licensingEstimate(
  operationDate: string,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
) {
  const from = addBusinessDays(
    operationDate,
    LICENSING_ESTIMATE_BUSINESS_DAYS.from,
    holidays,
  )
  const to = addBusinessDays(
    operationDate,
    LICENSING_ESTIMATE_BUSINESS_DAYS.to,
    holidays,
  )
  return from && to ? { from, to } : null
}

type LicensingCalendar = { holidays: string[] }

let calendarRequest: Promise<ReadonlySet<string>> | null = null

// Una sola consulta por sesión de la app: el calendario cambia una vez por año.
export function loadLicensingHolidays(): Promise<ReadonlySet<string>> {
  calendarRequest ??= apiRequest<LicensingCalendar>(
    '/sales/operations/licensing-calendar',
    { token: sessionStorage.getItem(AUTH_TOKEN_KEY) },
  )
    .then((calendar) => new Set(calendar.holidays) as ReadonlySet<string>)
    .catch(() => {
      calendarRequest = null
      return NO_HOLIDAYS
    })
  return calendarRequest
}

export function resetLicensingHolidaysCache() {
  calendarRequest = null
}

export function useLicensingHolidays() {
  const [holidays, setHolidays] = useState<ReadonlySet<string>>(NO_HOLIDAYS)
  useEffect(() => {
    let active = true
    void loadLicensingHolidays().then((loaded) => {
      if (active) setHolidays(loaded)
    })
    return () => {
      active = false
    }
  }, [])
  return holidays
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

// Fase 5: situación de la patente en sí (independiente del pago a la
// gestoría). Las respuestas anteriores a la fase 5 no traen `plate`.
export function plateStatusOf(
  licensing: Pick<SalesLicensing, 'plate' | 'plateLoaded' | 'overdue'> | null | undefined,
): SalesLicensingPlateStatus | null {
  if (!licensing) return null
  if (licensing.plate) return licensing.plate.status
  if (licensing.plateLoaded) return 'RECIBIDA'
  return licensing.overdue ? 'EN_TRAMITE_VENCIDA' : 'EN_TRAMITE'
}

export function plateStatusLabel(
  status: SalesLicensingPlateStatus,
  licensing: Pick<SalesLicensing, 'estimatedFrom' | 'estimatedTo'>,
) {
  const window =
    licensing.estimatedFrom && licensing.estimatedTo
      ? ` (estimada entre ${formatIsoDate(licensing.estimatedFrom)} y ${formatIsoDate(licensing.estimatedTo)})`
      : ''
  switch (status) {
    case 'EN_TRAMITE':
      return `Patente en trámite${window}`
    case 'EN_TRAMITE_VENCIDA':
      return `Patente en trámite, pasó la fecha estimada${window}`
    case 'RECIBIDA':
      return 'Patente recibida'
    case 'RECIBIDA_COBRO_PENDIENTE':
      return 'Patente recibida, pago pendiente'
    case 'RECIBIDA_COBRADA':
      return 'Patente recibida y paga'
    case 'NO_APLICA':
      return 'Patente: no aplica'
  }
}

export function plateStatusClass(status: SalesLicensingPlateStatus) {
  if (status === 'RECIBIDA' || status === 'RECIBIDA_COBRADA')
    return 'status-badge--success'
  if (status === 'EN_TRAMITE_VENCIDA' || status === 'RECIBIDA_COBRO_PENDIENTE')
    return 'status-badge--warning'
  return ''
}

// Quién puede cargar la llegada: operaciones enviadas, aprobadas o cerradas,
// con unidad física y modalidad definida (mismas reglas que la API).
export function canRegisterPlate(operation: SalesOperation) {
  return (
    (operation.status === 'PENDIENTE_APROBACION' ||
      operation.status === 'APROBADA' ||
      operation.status === 'CERRADA') &&
    operation.licensing?.mode != null &&
    operation.vehicle.unit != null
  )
}

// Normalización del número igual que la API (sólo letras y dígitos).
export function normalizedPlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidPlate(value: string) {
  const length = normalizedPlate(value).length
  return length >= 5 && length <= 10
}
