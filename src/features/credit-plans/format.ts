import { ApiError, NetworkError } from '../../shared/api/client'

export function creditPlansErrorMessage(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 400) {
      const message = Array.isArray(error.details?.message)
        ? error.details.message.join(' ')
        : error.details?.message ?? ''
      if (/minimum/i.test(message)) return 'El monto financiado está por debajo del mínimo del plan.'
      if (/maximum/i.test(message)) return 'El monto financiado supera el máximo del plan.'
      if (/inactive credit plan/i.test(message)) return 'El plan elegido ya no está activo. Elegí otro.'
      if (/already fully paid/i.test(message)) return 'Esa cuota ya está totalmente pagada.'
      if (/exceeds the installment balance/i.test(message)) {
        return 'El importe supera el saldo pendiente de la cuota.'
      }
      return 'Revisá los datos ingresados.'
    }
    if (error.status === 403) return 'No tenés permiso para realizar esta acción.'
    if (error.status === 404) return 'El registro no existe o no pertenece a tu organización.'
  }
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}

export function formatMoney(value: number | null | undefined, currency = 'ARS') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export const calculationMethodLabels: Record<'FRANCES' | 'INTERES_SIMPLE', string> = {
  FRANCES: 'Sistema francés (cuota fija)',
  INTERES_SIMPLE: 'Interés simple prorrateado',
}

export const installmentStatusLabels: Record<
  'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'PARCIAL',
  string
> = {
  PENDIENTE: 'Pendiente',
  PAGADA: 'Pagada',
  VENCIDA: 'Vencida',
  PARCIAL: 'Pago parcial',
}

export function installmentStatusTone(
  status: 'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'PARCIAL',
) {
  if (status === 'PAGADA') return ' status-badge--success'
  if (status === 'VENCIDA') return ' status-badge--danger'
  if (status === 'PARCIAL') return ' status-badge--warning'
  return ''
}
