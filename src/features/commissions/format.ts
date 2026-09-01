import { ApiError, NetworkError } from '../../shared/api/client'
import { localIsoDate } from '../../shared/utils/date'
export { localIsoDate }

import type {
  CommissionStatus,
  CommissionTier,
  CommissionVehicleType,
  ManagerCommissionMode,
  ManagerCommissionScope,
  ManagerCommissionSettlementStatus,
  SaveScalePolicyInput,
} from './types'

export const vehicleLabels: Record<CommissionVehicleType, string> = {
  MOTO: 'Motos',
  AUTO: 'Autos',
}

export const statusLabels: Record<CommissionStatus, string> = {
  CALCULATED: 'Calculada',
  AGREED: 'Acordada',
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pagada',
}

export const managerSettlementStatusLabels: Record<ManagerCommissionSettlementStatus, string> = {
  SUGGESTED: 'Sugerida',
  AGREED: 'Acordada',
  PAID: 'Pagada',
}

export const managerModeLabels: Record<ManagerCommissionMode, string> = {
  PORCENTAJE: 'Porcentaje sobre precio de cierre',
  ESCALA: 'Escala por unidades',
}

export const managerScopeLabels: Record<ManagerCommissionScope, string> = {
  SUCURSAL_PROPIA: 'Su sucursal',
  TODAS_LAS_SUCURSALES: 'Todas las sucursales',
}

export function formatCommissionMoney(value: string | number | null) {
  if (value === null || value === '') return 'Sin definir'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

export function formatCommissionDate(value: string) {
  const datePart = value.slice(0, 10)
  const [year, month, day] = datePart.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('es-AR').format(new Date(year, month - 1, day))
}

export function formatPeriod(value: string) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  const text = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function tierLabel(tier: Pick<CommissionTier, 'minUnits' | 'maxUnits'> | null) {
  if (!tier) return 'Sin escala'
  return tier.maxUnits === null
    ? `${tier.minUnits} o más`
    : `${tier.minUnits} a ${tier.maxUnits}`
}

export function commissionErrorMessage(error: unknown) {
  if (error instanceof NetworkError) return 'No pudimos conectar con el servidor.'
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      COMMISSION_POLICY_NOT_CONFIGURED: 'No hay escalas configuradas para este tipo y período.',
      INVALID_COMMISSION_TIERS: 'Los tramos deben comenzar en 1, ser contiguos y terminar con un rango abierto.',
      POLICY_PERIOD_OVERLAP: 'La vigencia se superpone con otra política.',
      POLICY_IMMUTABLE: 'Una política con liquidaciones históricas no puede modificarse.',
      COMMISSION_SETTLEMENT_NOT_FOUND: 'La liquidación ya no está disponible.',
      COMMISSION_ALREADY_PAID: 'Esta comisión ya fue pagada. Actualizá el listado.',
      COMMISSION_NOT_AGREED: 'Primero debe registrarse el acuerdo con el vendedor.',
      COMMISSION_STALE_VERSION: 'La comisión cambió mientras trabajabas. Actualizá el listado.',
      IDEMPOTENCY_CONFLICT: 'El identificador de este pago ya fue utilizado con otros datos.',
      SELLER_PROFILE_NOT_FOUND: 'El usuario no tiene un perfil de vendedor asociado.',
      CURRENCY_MISMATCH: 'La cuenta seleccionada no opera en la moneda de la comisión.',
      INVALID_MANAGER: 'El usuario seleccionado no es un gerente activo de la organización.',
      INVALID_MANAGER_COMMISSION_CONFIG: 'Revisá los datos de la comisión de gerencia: falta el porcentaje o la escala según el modo elegido.',
      MANAGER_COMMISSION_NOT_CONFIGURED: 'Este gerente no tiene una comisión configurada y activa.',
      MANAGER_COMMISSION_SETTLEMENT_NOT_FOUND: 'La liquidación de comisión de gerencia ya no está disponible.',
      INVALID_MANAGER_COMMISSION_SUGGESTION_ID: 'El sugerido de comisión de gerencia no es válido.',
    }
    const typedMessage = messages[error.details?.code ?? '']
    if (typedMessage) return typedMessage
    const technicalMessage = Array.isArray(error.details?.message)
      ? error.details.message.join(' ')
      : error.message
    if (
      /property (page|limit) should not exist|must be a UUID/i.test(
        technicalMessage,
      )
    ) {
      return 'No pudimos aplicar esos filtros. Actualizá la pantalla y volvé a intentarlo.'
    }
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tu perfil no tiene permiso para realizar esta acción.'
  }
  if (error instanceof ApiError && error.status === 409) {
    return error.message
  }
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.'
}

export function decimalAmount(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : null
}

export function newCommissionIdempotencyKey() {
  return crypto.randomUUID()
}

export function withOptional<T extends object, K extends keyof T>(
  source: T,
  key: K,
  value: T[K] | undefined,
) {
  const next = { ...source }
  if (value === undefined) delete next[key]
  else next[key] = value
  return next
}

export function validateScalePolicy(input: SaveScalePolicyInput) {
  const errors: string[] = []
  if (!input.validFrom) errors.push('Indicá desde cuándo entra en vigencia.')
  if (input.tiers.length === 0) errors.push('Agregá al menos un tramo.')
  if (input.tiers[0]?.minUnits !== 1) errors.push('La escala debe comenzar en 1.')

  input.tiers.forEach((tier, index) => {
    if (tier.minUnits < 1) errors.push(`El tramo ${index + 1} tiene un mínimo inválido.`)
    const fixedAmount = Number(tier.fixedAmount)
    if (!Number.isFinite(fixedAmount) || fixedAmount < 0) {
      errors.push(`El tramo ${index + 1} debe tener un monto igual o mayor a cero.`)
    }
    if (tier.maxUnits !== null && tier.maxUnits < tier.minUnits) {
      errors.push(`El tramo ${index + 1} termina antes de comenzar.`)
    }
    const next = input.tiers[index + 1]
    if (next && tier.maxUnits === null) {
      errors.push('Sólo el último tramo puede quedar abierto.')
    }
    if (next && tier.maxUnits !== null && next.minUnits !== tier.maxUnits + 1) {
      errors.push(`Hay un hueco o solapamiento entre los tramos ${index + 1} y ${index + 2}.`)
    }
  })

  if (input.tiers.at(-1)?.maxUnits !== null) {
    errors.push('El último tramo debe quedar abierto.')
  }
  return [...new Set(errors)]
}
