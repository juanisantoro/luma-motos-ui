import type { ExcelColumn } from '../../shared/export/excel'
import { supplyFulfillmentLabel } from '../sales/fulfillment'
import {
  conditionLabel,
  originLabels,
  supplyStatusLabels,
  unitColorLabel,
  unitStatusLabels,
} from './labels'
import type {
  CatalogModel,
  CatalogPricePolicy,
  PhysicalUnit,
  SupplierAvailability,
  SupplyOrder,
} from './types'

// Columnas del Excel de cada vista de Stock: las mismas que la grilla, con
// importes como número y la moneda aparte.

const vehicleTypeLabel = (type: 'MOTO' | 'AUTO') => (type === 'MOTO' ? 'Moto' : 'Auto')

export const physicalUnitColumns: Array<ExcelColumn<PhysicalUnit>> = [
  { header: 'Tipo', value: (row) => vehicleTypeLabel(row.vehicleType) },
  { header: 'Marca', value: (row) => row.catalogModel.brand },
  { header: 'Modelo', value: (row) => row.catalogModel.model },
  { header: 'Versión', value: (row) => row.catalogModel.version },
  { header: 'Condición', value: (row) => conditionLabel(row.condition) },
  { header: 'VIN / chasis', value: (row) => row.vin },
  { header: 'Patente', value: (row) => row.licensePlate },
  { header: 'Sucursal', value: (row) => row.branch.name },
  { header: 'Origen', value: (row) => originLabels[row.acquisitionOrigin] },
  { header: 'Proveedor', value: (row) => row.supplier?.name },
  { header: 'Año', value: (row) => String(row.year) },
  { header: 'Kilometraje', value: (row) => row.mileage, type: 'integer' },
  { header: 'Color / acabado', value: (row) => unitColorLabel(row) },
  { header: 'Estado', value: (row) => unitStatusLabels[row.status] },
  { header: 'Ingreso', value: (row) => row.receivedAt, type: 'date' },
]

/** Fila del catálogo tal como se ve: con la política vigente para la sucursal elegida. */
export type CatalogExportRow = {
  item: CatalogModel
  policy: CatalogPricePolicy | null
  units: number
  scope: string
  policyLabel: string
}

export function catalogColumns(canViewCosts: boolean): Array<ExcelColumn<CatalogExportRow>> {
  const discount = (policy: CatalogPricePolicy | null) =>
    policy && policy.listPrice > 0 ? policy.listPrice - policy.minimumPrice : null
  return [
    { header: 'Marca', value: (row) => row.item.brand },
    { header: 'Modelo', value: (row) => row.item.model },
    { header: 'Versión', value: (row) => row.item.version },
    { header: 'Moneda', value: (row) => row.policy?.currency },
    { header: 'Precio sugerido', value: (row) => row.policy?.listPrice, type: 'money' },
    { header: 'Precio mínimo', value: (row) => row.policy?.minimumPrice, type: 'money' },
    { header: 'Baja máxima', value: (row) => discount(row.policy), type: 'money' },
    {
      header: 'Descuento %',
      value: (row) => {
        const drop = discount(row.policy)
        return drop === null || !row.policy ? null : Math.round((drop / row.policy.listPrice) * 100)
      },
      type: 'integer',
    },
    ...(canViewCosts
      ? [{ header: 'Costo', value: (row: CatalogExportRow) => row.item.costPrice, type: 'money' as const }]
      : []),
    { header: 'Unidades físicas', value: (row) => row.units, type: 'integer' },
    { header: 'Alcance', value: (row) => row.scope },
    { header: 'Estado del precio', value: (row) => row.policyLabel },
  ]
}

export const availabilityColumns: Array<ExcelColumn<SupplierAvailability>> = [
  { header: 'Tipo', value: (row) => vehicleTypeLabel(row.vehicleType) },
  { header: 'Marca', value: (row) => row.catalogModel.brand },
  { header: 'Modelo', value: (row) => row.catalogModel.model },
  { header: 'Versión', value: (row) => row.catalogModel.version },
  { header: 'Condición', value: (row) => conditionLabel(row.condition) },
  { header: 'Proveedor', value: (row) => row.supplier.name },
  { header: 'Disponibilidad', value: (row) => row.quantity, type: 'integer' },
  { header: 'Actualizado', value: (row) => row.updatedAt, type: 'datetime' },
  { header: 'Observaciones', value: (row) => row.notes },
]

export const supplyColumns: Array<ExcelColumn<SupplyOrder>> = [
  { header: 'Operación', value: (row) => row.operation?.number ?? row.operation?.id ?? row.id },
  { header: 'Cliente', value: (row) => row.operation?.clientName },
  { header: 'Documento', value: (row) => row.operation?.clientDocument },
  { header: 'Marca', value: (row) => row.catalogModel.brand },
  { header: 'Modelo', value: (row) => row.catalogModel.model },
  { header: 'Versión', value: (row) => row.catalogModel.version },
  { header: 'Condición', value: (row) => conditionLabel(row.condition) },
  {
    header: 'Estado',
    value: (row) =>
      row.vehicleType === 'MOTO' ? supplyFulfillmentLabel(row) : supplyStatusLabels[row.status],
  },
  { header: 'Abastecimiento', value: (row) => supplyStatusLabels[row.status] },
  { header: 'Estado operación', value: (row) => row.operation?.status },
  { header: 'Chasis', value: (row) => row.receivedUnit?.vin ?? 'Sin asignar' },
  { header: 'Proveedor', value: (row) => row.supplier.name },
  { header: 'Sucursal destino', value: (row) => row.destinationBranch.name },
  { header: 'Cantidad', value: (row) => row.quantity, type: 'integer' },
  { header: 'Color solicitado', value: (row) => row.color },
  { header: 'Solicitado', value: (row) => row.requestedAt, type: 'datetime' },
]
