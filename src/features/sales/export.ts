import type { ExcelColumn } from '../../shared/export/excel'
import { fulfillmentLabel, operationFulfillment } from './fulfillment'
import {
  licensingModeLabels,
  licensingStatusLabels,
  plateStatusLabel,
  plateStatusOf,
} from './licensing'
import { operationStatusLabels, vehicleLabel } from './presentation'
import {
  observation,
  sourceAndDestination,
  unitSummary,
} from './SalesOperationList'
import type { OperationTrackingRow } from './tracking'
import type { SalesOperation } from './types'

// Columnas del Excel de las grillas de ventas: las mismas que se ven, más lo
// que la grilla muestra en el detalle (documento, VIN, sucursal, boleto…),
// con importes como número y la moneda aparte.

function documentOf(client: {
  documentType?: string | null
  documentNumber?: string | null
}) {
  return client.documentNumber
    ? [client.documentType, client.documentNumber].filter(Boolean).join(' ')
    : null
}

const conditionLabel = (operation: SalesOperation) =>
  operation.vehicle.condition === 'NUEVO' ? 'Nuevo' : 'Usado'

function difference(operation: SalesOperation) {
  return Math.max(
    0,
    Number(operation.listPrice ?? 0) - Number(operation.agreedPrice),
  )
}

function plateText(operation: SalesOperation) {
  const licensing = operation.licensing
  const status = licensing ? plateStatusOf(licensing) : null
  if (!licensing || !status) return null
  return plateStatusLabel(status, licensing)
}

const numberColumn: ExcelColumn<{ number: string }> = {
  header: 'Operación',
  value: (row) => `#${row.number}`,
}

/** Operaciones / Mis operaciones (motos y autos). */
export function operationExcelColumns(
  showLicensing: boolean,
): Array<ExcelColumn<SalesOperation>> {
  return [
    numberColumn,
    { header: 'Boleto', value: (row) => row.ticketNumber },
    { header: 'Fecha', value: (row) => row.operationDate, type: 'date' },
    { header: 'Estado', value: (row) => operationStatusLabels[row.status] },
    { header: 'Cliente', value: (row) => row.client.fullName },
    { header: 'Documento', value: (row) => documentOf(row.client) },
    { header: 'Vehículo', value: (row) => vehicleLabel(row) },
    { header: 'Condición', value: conditionLabel },
    { header: 'Color pedido', value: (row) => (row.vehicle.unit ? null : row.requestedColor) },
    { header: 'VIN', value: (row) => row.vehicle.unit?.vin },
    { header: 'Sucursal', value: (row) => row.branch.name },
    { header: 'Origen / destino', value: (row) => sourceAndDestination(row) },
    { header: 'Vendedor', value: (row) => row.seller?.fullName ?? 'Sin asignar' },
    { header: 'Moneda', value: (row) => row.currency },
    { header: 'Precio lista', value: (row) => row.listPrice, type: 'money' },
    { header: 'Precio acordado', value: (row) => row.agreedPrice, type: 'money' },
    { header: 'Unidad', value: (row) => unitSummary(row) },
    ...(showLicensing
      ? ([
          {
            header: 'Patentamiento',
            value: (row) =>
              row.licensing
                ? row.licensing.mode
                  ? licensingModeLabels[row.licensing.mode]
                  : 'Sin definir'
                : null,
          },
          {
            header: 'Estado patentamiento',
            value: (row) =>
              row.licensing ? licensingStatusLabels[row.licensing.status] : null,
          },
          { header: 'Patente', value: plateText },
          {
            header: 'Número de patente',
            value: (row) =>
              row.licensing?.plate?.number ?? row.vehicle.unit?.licensePlate,
          },
        ] satisfies Array<ExcelColumn<SalesOperation>>)
      : []),
    {
      header: 'Observación',
      value: (row) => {
        const text = observation(row)
        return text === '—' ? null : text
      },
    },
  ]
}

/** Aprobaciones pendientes (precio bajo lista). */
export const approvalExcelColumns: Array<ExcelColumn<SalesOperation>> = [
  numberColumn,
  { header: 'Fecha', value: (row) => row.operationDate, type: 'date' },
  { header: 'Cliente', value: (row) => row.client.fullName },
  { header: 'Documento', value: (row) => documentOf(row.client) },
  { header: 'Vehículo', value: (row) => vehicleLabel(row) },
  { header: 'Sucursal', value: (row) => row.branch.name },
  { header: 'Vendedor', value: (row) => row.seller?.fullName ?? 'Sin asignar' },
  { header: 'Moneda', value: (row) => row.currency },
  { header: 'Precio lista', value: (row) => row.listPrice, type: 'money' },
  { header: 'Precio mínimo', value: (row) => row.minimumPrice, type: 'money' },
  { header: 'Precio ofertado', value: (row) => row.agreedPrice, type: 'money' },
  { header: 'Diferencia', value: difference, type: 'money' },
]

/** Operaciones a asignar (bandeja de la administrativa). */
export const assignmentExcelColumns: Array<ExcelColumn<SalesOperation>> = [
  numberColumn,
  { header: 'Boleto', value: (row) => row.ticketNumber },
  { header: 'Fecha', value: (row) => row.operationDate, type: 'date' },
  { header: 'Cliente', value: (row) => row.client.fullName },
  { header: 'Documento', value: (row) => documentOf(row.client) },
  { header: 'Vehículo', value: (row) => vehicleLabel(row) },
  { header: 'Condición', value: conditionLabel },
  { header: 'Color pedido', value: (row) => row.requestedColor },
  { header: 'Sucursal', value: (row) => row.branch.name },
  { header: 'Vendedor', value: (row) => row.seller?.fullName ?? 'Sin asignar' },
  { header: 'Estado operación', value: (row) => operationStatusLabels[row.status] },
  { header: 'Unidad', value: (row) => fulfillmentLabel(operationFulfillment(row)) },
]

/** Seguimiento de cobros. */
export const trackingExcelColumns: Array<ExcelColumn<OperationTrackingRow>> = [
  numberColumn,
  { header: 'Fecha', value: (row) => row.operationDate, type: 'date' },
  { header: 'Estado', value: (row) => operationStatusLabels[row.status] },
  { header: 'Boleto', value: (row) => row.ticketNumber },
  { header: 'Cliente', value: (row) => row.client.fullName },
  { header: 'Documento', value: (row) => documentOf(row.client) },
  { header: 'Vendedor', value: (row) => row.seller?.fullName },
  { header: 'Sucursal', value: (row) => row.branch.name },
  { header: 'Moneda', value: (row) => row.currency },
  { header: 'Acordado', value: (row) => row.agreedPrice, type: 'money' },
  { header: 'Cobrado', value: (row) => row.collectedAmount, type: 'money' },
  { header: 'Saldo', value: (row) => row.balanceAmount, type: 'money' },
  {
    header: 'Efectivo sin rendir',
    value: (row) => (row.pendingHandoverCount > 0 ? row.pendingHandoverAmount : null),
    type: 'money',
  },
  {
    header: 'Crédito propio cobrado',
    value: (row) => row.ownCredit?.collectedAmount,
    type: 'money',
  },
  {
    header: 'Cuotas pagas',
    value: (row) =>
      row.ownCredit
        ? `${row.ownCredit.paidInstallments} de ${row.ownCredit.installments}`
        : null,
  },
  { header: 'Unidad', value: (row) => fulfillmentLabel(row.fulfillment) },
  { header: 'Patentamiento', value: (row) => licensingStatusLabels[row.licensing.status] },
]
