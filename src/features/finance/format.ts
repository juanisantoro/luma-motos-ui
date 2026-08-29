import { ApiError, NetworkError } from '../../shared/api/client'
import type { DecimalString, FinancialKind, FinancialStatus } from './types'

export function financialErrorMessage(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 400) return 'Revisá los datos y el estado del registro.'
    if (error.status === 403) return 'No tenés permiso para realizar esta acción.'
    if (error.status === 404) {
      return 'El registro no existe o no pertenece a tu organización.'
    }
    if (error.status === 409) {
      const message = Array.isArray(error.details?.message)
        ? error.details.message.join(' ')
        : error.details?.message ?? ''
      if (/overpayment/i.test(message)) return 'El importe supera el saldo pendiente.'
      if (/already_reversed/i.test(message)) return 'Ese movimiento ya fue reversado.'
      if (/edit_below_settled/i.test(message)) {
        return 'El total no puede quedar por debajo de los movimientos vigentes.'
      }
      if (/idempotency_conflict/i.test(message)) {
        return 'La operación ya fue enviada con otros datos. Actualizá y reintentá.'
      }
      return 'La operación entra en conflicto con el estado actual del registro.'
    }
  }
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}

export function formatMoney(value: DecimalString | undefined, currency = 'ARS') {
  if (value === undefined) return '—'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return value
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function statusLabel(status: FinancialStatus) {
  return {
    PENDIENTE: 'Pendiente',
    PARCIAL: 'Parcial',
    PAGADO: 'Pagado',
  }[status]
}

export function statusTone(status: FinancialStatus) {
  if (status === 'PAGADO') return ' status-badge--success'
  if (status === 'PARCIAL') return ' status-badge--warning'
  return ''
}

export function financialLabels(kind: FinancialKind) {
  return {
    purchase: {
      eyebrow: 'ADMINISTRACIÓN',
      title: 'Compras / Proveedores',
      description: 'Compras a proveedores y documentación de unidades.',
      singular: 'compra',
      plural: 'compras',
    },
    income: {
      eyebrow: 'TESORERÍA',
      title: 'Ingresos',
      description: 'Registro operativo de ingresos y cobranzas.',
      singular: 'ingreso',
      plural: 'ingresos',
    },
    expense: {
      eyebrow: 'TESORERÍA',
      title: 'Gastos generales',
      description: 'Egresos operativos y recuperaciones asociadas.',
      singular: 'gasto',
      plural: 'gastos',
    },
  }[kind]
}

export function newIdempotencyKey() {
  return globalThis.crypto.randomUUID()
}
