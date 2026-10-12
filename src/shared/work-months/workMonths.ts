import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { AUTH_TOKEN_KEY, apiRequest } from '../api/client'

// Meses de trabajo: la organización define el corte de cada mes y todo lo
// que es "del mes" (inicio, comisiones, atajos de filtros) usa esas fechas.
// Sin cortes cargados son los meses de almanaque.

export type WorkMonth = {
  period: string
  from: string
  to: string
  cutDate: string | null
  cutMin: string
  cutMax: string
  current: boolean
  locked: boolean
}

export type WorkMonths = {
  current: string
  months: WorkMonth[]
}

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function listWorkMonths(signal?: AbortSignal) {
  return apiRequest<WorkMonths>('/work-months', {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export async function setWorkMonthCut(period: string, cutDate: string) {
  const result = await apiRequest<WorkMonth>(`/work-months/${period}`, {
    method: 'PUT',
    token: authToken(),
    body: { cutDate },
  })
  invalidateWorkMonths()
  return result
}

export async function removeWorkMonthCut(period: string) {
  const result = await apiRequest<WorkMonth>(`/work-months/${period}`, {
    method: 'DELETE',
    token: authToken(),
  })
  invalidateWorkMonths()
  return result
}

// Una consulta por usuario y por día: los cortes cambian pocas veces y el
// que los cambia invalida la copia. La clave lleva el token (otro usuario,
// otra organización) y el día de Argentina (a la medianoche puede empezar
// otro mes).
let cached: { key: string; promise: Promise<WorkMonths> } | null = null
let resolved: { key: string; value: WorkMonths } | null = null

function cacheKey() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())
  return `${authToken() ?? ''}|${today}`
}

export function invalidateWorkMonths() {
  cached = null
  resolved = null
}

function loadWorkMonths() {
  const key = cacheKey()
  if (cached?.key !== key) {
    const promise = listWorkMonths()
      .then((result) => {
        // Un backend anterior a los meses de trabajo no tiene este endpoint.
        if (!result || !Array.isArray(result.months)) throw new Error('Sin meses de trabajo')
        resolved = { key, value: result }
        return result
      })
      .catch((error: unknown) => {
        if (cached?.promise === promise) cached = null
        throw error
      })
    cached = { key, promise }
  }
  return cached.promise
}

/** Lo ya cargado para este usuario y este día, sin esperar. */
function resolvedWorkMonths() {
  return resolved?.key === cacheKey() ? resolved.value : null
}

/** Período "AAAA-MM" del almanaque de hoy, para arrancar antes de saber los cortes. */
export function calendarPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Los meses de trabajo, o null mientras cargan o si no se pudieron leer. */
export function useWorkMonths() {
  const [value, setValue] = useState<WorkMonths | null>(resolvedWorkMonths)
  useEffect(() => {
    let active = true
    loadWorkMonths()
      .then((result) => {
        if (active) setValue(result)
      })
      .catch(() => {
        // Sin los cortes la pantalla sigue con meses de almanaque.
      })
    return () => {
      active = false
    }
  }, [])
  return value
}

/** "28/09" o "28/09/2026" a partir de "2026-09-28". */
export function formatDay(value: string, withYear = false) {
  const [year, month, day] = value.split('-')
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`
}

/** "del 28/09 al 27/10" para un período, si se conocen sus fechas. */
export function workMonthRangeLabel(months: WorkMonths | null, period: string) {
  const month = months?.months.find((item) => item.period === period)
  if (!month) return null
  return `del ${formatDay(month.from)} al ${formatDay(month.to)}`
}

/**
 * Período elegido en una pantalla. Arranca en el mes de almanaque y, cuando
 * llegan los cortes, pasa al mes de trabajo en curso, salvo que el usuario
 * ya haya elegido otro.
 */
export function useWorkPeriod(initial?: string | null) {
  const months = useWorkMonths()
  const [period, setPeriodState] = useState(
    () => initial || resolvedWorkMonths()?.current || calendarPeriod(),
  )
  const chosen = useRef(Boolean(initial))
  useEffect(() => {
    if (months && !chosen.current) setPeriodState(months.current)
  }, [months])
  const setPeriod = useCallback((value: SetStateAction<string>) => {
    chosen.current = true
    setPeriodState(value)
  }, [])
  return [period, setPeriod, months] as const
}

/**
 * Primer y último día ("AAAA-MM-DD") de un mes elegido en un filtro: el mes
 * de trabajo si se conocen sus cortes, si no el de almanaque.
 */
export function workMonthBounds(months: WorkMonths | null, period: string) {
  if (!period) return {}
  const month = months?.months.find((item) => item.period === period)
  if (month) return { from: month.from, to: month.to }
  const [year, monthNumber] = period.split('-').map(Number)
  if (!year || !monthNumber) return {}
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` }
}

/** Primer y último día del mes de almanaque "AAAA-MM". */
export function calendarMonthBounds(period: string) {
  if (!period) return {}
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return {}
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` }
}
