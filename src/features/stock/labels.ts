import type {
  AcquisitionOrigin,
  PhysicalUnit,
  SupplyStatus,
  UnitStatus,
  VehicleCondition,
} from './types'

// Etiquetas compartidas por la grilla de stock y su exportación a Excel.

export const unitStatusLabels: Record<UnitStatus, string> = {
  EN_STOCK: 'En stock',
  RESERVADO: 'Reservado',
  EN_TRASLADO: 'En traslado',
  EN_ACONDICIONAMIENTO: 'En acondicionamiento',
  VENDIDO: 'Vendido',
  ENTREGADO: 'Entregado',
  BLOQUEADO: 'Bloqueado',
  DADO_DE_BAJA: 'Dado de baja',
}

export const supplyStatusLabels: Record<SupplyStatus, string> = {
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  CONFIRMADO: 'Confirmado',
  PEDIDO: 'Pedido',
  EN_TRANSITO: 'En tránsito',
  RECIBIDO: 'Recibido',
  ASIGNADO: 'Recibida y reservada',
  CANCELADA: 'Cancelada',
}

export const originLabels: Record<AcquisitionOrigin, string> = {
  PROVEEDOR: 'Proveedor',
  TOMA_PARTE_PAGO: 'Parte de pago',
  OTRO: 'Otro',
}

export function conditionLabel(condition: VehicleCondition) {
  return condition === 'NUEVO' ? 'Nuevo / 0 km' : 'Usado'
}

export function unitColorLabel(unit: PhysicalUnit) {
  if (unit.color && unit.acabado) return `${unit.color} · ${unit.acabado}`
  return unit.color ?? unit.acabado ?? 'Sin color'
}
