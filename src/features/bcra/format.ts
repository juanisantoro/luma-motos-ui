import { ApiError, NetworkError } from '../../shared/api/client'
import type { BcraSituacionResumen, BcraVeredicto } from './types'

// Same AFIP standard modulo-11 check digit algorithm as the backend
// (src/common/cuit.ts in luma-motos-api) - duplicated here on purpose: the
// point is to reject an obviously malformed CUIT/CUIL before spending an
// API call, entirely client-side, before the request ever leaves the form.
const CHECK_DIGIT_MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const

export function normalizeCuit(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 11)
}

/** Formats digits as XX-XXXXXXXX-X while the user types. */
export function formatCuit(raw: string): string {
  const digits = normalizeCuit(raw)
  const type = digits.slice(0, 2)
  const body = digits.slice(2, 10)
  const check = digits.slice(10, 11)
  let out = type
  if (body) out += `-${body}`
  if (check) out += `-${check}`
  return out
}

export function isValidCuit(raw: string): boolean {
  const digits = normalizeCuit(raw)
  if (digits.length !== 11) return false

  let sum = 0
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i] ?? '0') * (CHECK_DIGIT_MULTIPLIERS[i] ?? 0)
  }

  let checkDigit = 11 - (sum % 11)
  if (checkDigit === 11) checkDigit = 0
  if (checkDigit === 10) return false

  return checkDigit === Number(digits[10])
}

export function bcraErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 400) return 'El CUIT/CUIL ingresado no es válido.'
    if (error.status === 403) {
      return 'No tenés permiso para consultar la situación crediticia.'
    }
    if (error.status === 502 || error.status === 504) {
      return 'No pudimos consultar al BCRA en este momento. Probá nuevamente en unos segundos.'
    }
  }
  return 'Ocurrió un error inesperado al consultar al BCRA. Intentá nuevamente.'
}

export const veredictoLabels: Record<BcraVeredicto, string> = {
  VERDE: 'Sin antecedentes de mora',
  AMARILLO: 'Antecedentes a revisar',
  ROJO: 'Situación irregular',
  SIN_DATOS: 'Sin antecedentes registrados',
}

// Short, plain-language explanation for the seller/callcenter/administrativa
// audience - the ones who only ever see the semaforo, never the raw BCRA
// table. Kept as display copy here (not in the backend) following the same
// convention as credit-plans/format.ts: the API returns codes and flags,
// the frontend owns the Spanish wording shown to the user.
export function veredictoDescription(resumen: BcraSituacionResumen): string {
  if (resumen.veredicto === 'SIN_DATOS') {
    return 'No se encontraron antecedentes crediticios registrados para este CUIT/CUIL en el sistema financiero. No implica nada negativo: puede tratarse de alguien que nunca tomó un crédito.'
  }
  if (resumen.veredicto === 'ROJO') {
    return resumen.procesoJudActual
      ? 'Registra un proceso judicial activo por deuda y/o una situación crediticia irregular en el período más reciente informado. Revisar antes de avanzar con el crédito.'
      : 'Registra atrasos importantes en el período más reciente informado. Revisar antes de avanzar con el crédito.'
  }
  if (resumen.veredicto === 'AMARILLO') {
    return resumen.peorSituacionActual === 2
      ? 'Registra seguimiento especial / riesgo bajo en el período más reciente. Conviene revisar antes de avanzar.'
      : 'La situación actual está normalizada, pero registró atrasos importantes en los últimos 24 meses. Conviene revisar el historial antes de avanzar.'
  }
  return 'Sin antecedentes de mora en el período más reciente ni en los últimos 24 meses.'
}

const SITUACION_LABELS: Record<number, string> = {
  0: 'Sin informar',
  1: 'Normal',
  2: 'Seguimiento especial / riesgo bajo',
  3: 'Con problemas / riesgo medio',
  4: 'Alto riesgo de insolvencia / riesgo alto',
  5: 'Irrecuperable',
}

export function situacionLabel(situacion: number): string {
  return SITUACION_LABELS[situacion] ?? `Situación ${situacion}`
}

export function situacionTone(situacion: number): string {
  if (situacion === 0 || situacion === 1) return ' status-badge--success'
  if (situacion === 2) return ' status-badge--warning'
  if (situacion >= 3) return ' status-badge--danger'
  return ''
}

/** AAAAMM -> MM/AAAA */
export function formatPeriodo(periodo: string): string {
  if (!/^\d{6}$/.test(periodo)) return periodo
  return `${periodo.slice(4, 6)}/${periodo.slice(0, 4)}`
}

export function formatConsultadoEn(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const montoFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** Formats an amount already in pesos (not thousands). */
export function formatMonto(monto: number): string {
  return montoFormatter.format(monto)
}

/** BCRA reports `monto` in thousands of pesos. */
export function formatMontoMiles(monto: number): string {
  return formatMonto(monto * 1000)
}

/**
 * One line to show next to the veredicto so a seller/manager can weigh the
 * amount actually in mora instead of trusting the semáforo color alone -
 * the color itself (worst situación wins, amount-agnostic) does not change.
 *
 * Returns `null` when there is nothing meaningful to show: SIN_DATOS, or a
 * clean current period with no historical antecedente either.
 */
export function montoIrregularLine(
  resumen: BcraSituacionResumen,
): string | null {
  if (resumen.veredicto === 'SIN_DATOS') return null

  // Current period is clean (nothing irregular right now) but there is a
  // historical antecedente behind the AMARILLO - show that instead, even if
  // the current period itself reported no monto at all.
  if (resumen.montoIrregularActual === 0 && resumen.antecedenteSeveroReciente) {
    if (
      resumen.mayorMontoIrregularHistorico != null &&
      resumen.periodoMayorMontoIrregular
    ) {
      return (
        `Sin deuda irregular en el período actual. Registró ` +
        `${formatMonto(resumen.mayorMontoIrregularHistorico)} en situación ` +
        `irregular en ${formatPeriodo(resumen.periodoMayorMontoIrregular)}.`
      )
    }
    // Historical monto wasn't computed - the existing "antecedente" flag
    // already covers this case, nothing more to add here.
    return null
  }

  if (resumen.montoTotalActual <= 0) return null

  const porcentaje =
    resumen.porcentajeIrregular != null
      ? ` (${Math.round(resumen.porcentajeIrregular * 100)}%)`
      : ''

  return (
    `${formatMonto(resumen.montoIrregularActual)} en situación irregular ` +
    `sobre ${formatMonto(resumen.montoTotalActual)} informados en el ` +
    `período más reciente${porcentaje}.`
  )
}
