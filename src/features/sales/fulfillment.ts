import type {
  SalesFulfillment,
  SalesFulfillmentStatus,
  SalesOperation,
} from './types'

// Textos de la fase 3, compartidos por la grilla de operaciones, la bandeja
// de asignación y el stock.
export const fulfillmentStatusLabels: Record<SalesFulfillmentStatus, string> =
  {
    PENDIENTE_ASIGNACION: 'Pendiente de asignar unidad',
    PEDIDA: 'Pedida a proveedor',
    PENDIENTE_INGRESO: 'Pendiente de ingreso del proveedor',
    RECIBIDA: 'Recibida, falta asignar',
    ASIGNADA: 'Recibida / asignada',
  }

export function fulfillmentStatusClass(status: SalesFulfillmentStatus) {
  if (status === 'ASIGNADA') return 'status-badge--success'
  if (status === 'PENDIENTE_ASIGNACION') return 'status-badge--danger'
  return 'status-badge--warning'
}

function shortDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return null
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

export function fulfillmentLabel(fulfillment: SalesFulfillment) {
  if (fulfillment.status === 'PEDIDA') {
    const date = shortDate(fulfillment.orderedAt ?? fulfillment.requestedAt)
    const supplier = fulfillment.supplier?.legalName
    return [
      supplier ? `Pedida a ${supplier}` : 'Pedida a proveedor',
      date ? `(${date})` : null,
    ]
      .filter(Boolean)
      .join(' ')
  }
  if (fulfillment.status === 'PENDIENTE_INGRESO' && fulfillment.supplier) {
    return `Pendiente de ingreso de ${fulfillment.supplier.legalName}`
  }
  return fulfillmentStatusLabels[fulfillment.status]
}

// Respuestas anteriores a la fase 3 no traen `fulfillment`: se infiere de la
// unidad asignada.
export function operationFulfillment(
  operation: SalesOperation,
): SalesFulfillment {
  return (
    operation.fulfillment ?? {
      status: operation.vehicle.unit ? 'ASIGNADA' : 'PENDIENTE_ASIGNACION',
      supplyRequestId: operation.supply?.id ?? null,
      supplyStatus: operation.supply?.status ?? null,
      supplier: operation.supply?.supplier ?? null,
      requestedAt: null,
      orderedAt: null,
      dispatchedAt: null,
      receivedAt: null,
    }
  )
}

// Abastecimiento visto desde stock: mismos textos que la operación.
export function supplyFulfillmentLabel(supply: {
  status: string
  supplier: { name: string }
  requestedAt: string | null
  orderedAt?: string | null
}) {
  if (supply.status === 'CANCELADA') return 'Cancelada'
  if (supply.status === 'RECIBIDO' || supply.status === 'ASIGNADO')
    return fulfillmentStatusLabels.ASIGNADA
  if (supply.status === 'EN_TRANSITO')
    return `Pendiente de ingreso de ${supply.supplier.name}`
  const date = shortDate(supply.orderedAt ?? supply.requestedAt)
  return `Pedida a ${supply.supplier.name}${date ? ` (${date})` : ''}`
}
