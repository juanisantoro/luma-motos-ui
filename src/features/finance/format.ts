import { ApiError, NetworkError } from '../../shared/api/client'
import { branchScopeErrorMessage } from '../auth/branchScope'
import type { DecimalString, FinancialKind, FinancialStatus } from './types'

const financialConflictMessages: Record<string, string> = {
  INCOME_REQUIRES_RECONCILIATION:
    'Este ingreso requiere conciliación antes de registrar un cobro.',
  OVERPAYMENT: 'El importe supera el saldo pendiente.',
  ALREADY_REVERSED: 'Ese movimiento ya fue reversado.',
  EDIT_BELOW_SETTLED:
    'El total no puede quedar por debajo de los movimientos vigentes.',
  IDEMPOTENCY_CONFLICT:
    'La operación ya fue enviada con otros datos. Actualizá y reintentá.',
  OVER_RECOVERY: 'El importe supera el saldo recuperable del gasto.',
  RECOVERY_EXISTS: 'El gasto ya tiene un recupero registrado.',
  EXPENSE_NOT_RECOVERABLE: 'Este gasto no está marcado como recuperable.',
  UNBALANCED_TRANSFER: 'La transferencia entre cuentas no está balanceada.',
}

export function financialErrorMessage(error: unknown) {
  const branchScopeMessage = branchScopeErrorMessage(error)
  if (branchScopeMessage) return branchScopeMessage
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 400) {
      if (error.details?.code === 'CASH_ACCOUNT_BRANCH_MISMATCH')
        return 'Esa cuenta no es de la sucursal del ingreso. Un cobro entra a una caja de su misma sucursal.'
      if (error.details?.code === 'HISTORIC_CASH_ACCOUNT')
        return 'Esa es una cuenta histórica importada del Excel: no recibe movimientos nuevos. Elegí una cuenta de caja actual.'
      return 'Revisá los datos y el estado del registro.'
    }
    if (error.status === 403) return 'No tenés permiso para realizar esta acción.'
    if (error.status === 404) {
      return 'El registro no existe o no pertenece a tu organización.'
    }
    if (error.status === 409) {
      // El backend identifica el motivo en `code`; el `message` es texto
      // en inglés. Se mantiene el match por mensaje como respaldo.
      const message = Array.isArray(error.details?.message)
        ? error.details.message.join(' ')
        : error.details?.message ?? ''
      const code = error.details?.code ?? ''
      const known = financialConflictMessages[code]
      if (known) return known
      const byMessage = Object.entries(financialConflictMessages).find(
        ([key]) => new RegExp(key, 'i').test(message),
      )
      if (byMessage) return byMessage[1]
      if (/conflicts with another request/i.test(message)) {
        return 'Otro usuario modificó el registro al mismo tiempo. Actualizá y reintentá.'
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
