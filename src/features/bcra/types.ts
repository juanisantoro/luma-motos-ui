export type BcraVeredicto = 'VERDE' | 'AMARILLO' | 'ROJO' | 'SIN_DATOS'

export type BcraEntidadHistorica = {
  entidad: string
  situacion: number
  monto: number
  enRevision: boolean
  procesoJud: boolean
}

export type BcraPeriodoHistorico = {
  periodo: string
  entidades: BcraEntidadHistorica[]
}

export type BcraSituacionResumen = {
  veredicto: BcraVeredicto
  identificacion: string
  denominacion: string | null
  periodoMasReciente: string | null
  peorSituacionActual: number | null
  procesoJudActual: boolean
  enRevisionActual: boolean
  antecedenteSeveroReciente: boolean
  /** Already in pesos (not thousands): sum of `monto` for entities at
   * situación 3+ in the most recent period. */
  montoIrregularActual: number
  /** Already in pesos (not thousands): sum of `monto` for ALL entities in
   * the most recent period. */
  montoTotalActual: number
  /** `montoIrregularActual / montoTotalActual`, or `null` when there is
   * nothing to divide by. */
  porcentajeIrregular: number | null
  /** Highest monto (pesos) at situación 3+ in the last 24 months. Only set
   * when `antecedenteSeveroReciente` is true. */
  mayorMontoIrregularHistorico?: number
  /** AAAAMM period `mayorMontoIrregularHistorico` was reported in. */
  periodoMayorMontoIrregular?: string
  consultadoEn: string
}

export type BcraSituacionDetalle = {
  periodos: BcraPeriodoHistorico[]
}

export type BcraSituacionResponse = {
  resumen: BcraSituacionResumen
  detalle?: BcraSituacionDetalle
}

export type BcraCheckState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: BcraSituacionResponse }
  | { status: 'error'; message: string }
