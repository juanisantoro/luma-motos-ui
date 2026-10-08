import type { ExcelColumn } from '../../shared/export/excel'
import {
  commissionOperationStatus,
  formatPeriod,
  managerModeLabels,
  managerScopeLabels,
  managerSettlementStatusLabels,
  nonComputableReasonText,
  statusLabels,
  tierLabel,
  vehicleLabels,
} from './format'
import type {
  CommissionOperation,
  CommissionOptions,
  CommissionSettlement,
  CommissionSummary,
  CommissionVehicleType,
  ManagerCommissionSettlement,
  ManagerCommissionSuggestion,
  PaidCommission,
} from './types'

// Columnas del Excel de las grillas de comisiones: las mismas que se ven,
// con importes como número (todas las comisiones son en pesos) y los
// estados con su etiqueta.

export const suggestionExcelColumns: Array<ExcelColumn<CommissionSummary>> = [
  { header: 'Vendedor', value: (row) => row.seller.name },
  { header: 'Período', value: (row) => formatPeriod(row.period) },
  { header: 'Sucursal', value: (row) => row.branch.name },
  { header: 'Ventas computables', value: (row) => row.computableSales, type: 'integer' },
  { header: 'Escala', value: (row) => tierLabel(row.scale) },
  { header: 'Comisión sugerida fija total', value: (row) => row.suggestedAmount, type: 'money' },
  { header: 'Estado', value: (row) => statusLabels[row.status] },
]

export const managerSuggestionExcelColumns: Array<ExcelColumn<ManagerCommissionSuggestion>> = [
  { header: 'Gerente', value: (row) => row.manager.name },
  { header: 'Período', value: (row) => formatPeriod(row.period) },
  { header: 'Alcance', value: (row) => managerScopeLabels[row.scope] },
  { header: 'Modalidad', value: (row) => managerModeLabels[row.mode] },
  { header: 'Ventas computables', value: (row) => row.computableSales, type: 'integer' },
  { header: 'Comisión calculada', value: (row) => row.suggestedAmount, type: 'money' },
  {
    header: 'Estado',
    value: (row) =>
      row.settlement
        ? statusLabels[row.settlement.status === 'PAID' ? 'PAID' : 'AGREED']
        : managerSettlementStatusLabels.SUGGESTED,
  },
]

export const payableExcelColumns: Array<ExcelColumn<CommissionSettlement>> = [
  { header: 'Vendedor', value: (row) => row.seller.name },
  { header: 'Sucursal', value: (row) => row.branch.name },
  { header: 'Período', value: (row) => formatPeriod(row.period) },
  { header: 'Cantidad', value: (row) => row.computableSales, type: 'integer' },
  { header: 'Escala', value: (row) => tierLabel(row.scale) },
  { header: 'Sugerido', value: (row) => row.suggestedAmount, type: 'money' },
  { header: 'Acordado', value: (row) => row.agreedAmount, type: 'money' },
  { header: 'Estado', value: (row) => statusLabels[row.status] },
]

export const managerSettlementExcelColumns: Array<ExcelColumn<ManagerCommissionSettlement>> = [
  { header: 'Gerente', value: (row) => row.manager.name },
  { header: 'Período', value: (row) => formatPeriod(row.period) },
  { header: 'Alcance', value: (row) => managerScopeLabels[row.scope] },
  { header: 'Modalidad', value: (row) => managerModeLabels[row.mode] },
  { header: 'Ventas computables', value: (row) => row.computableSales, type: 'integer' },
  { header: 'Acordado', value: (row) => row.amount, type: 'money' },
  { header: 'Estado', value: (row) => managerSettlementStatusLabels[row.status] },
]

export const paidExcelColumns: Array<ExcelColumn<PaidCommission>> = [
  { header: 'Fecha pago', value: (row) => row.paidAt, type: 'date' },
  { header: 'Vendedor', value: (row) => row.seller.name },
  { header: 'Sucursal', value: (row) => row.branch.name },
  { header: 'Cantidad', value: (row) => row.computableSales, type: 'integer' },
  { header: 'Escala snapshot', value: (row) => tierLabel(row.scaleSnapshot) },
  { header: 'Sugerida', value: (row) => row.suggestedAmount, type: 'money' },
  { header: 'Acordada / pagada', value: (row) => row.paidAmount, type: 'money' },
  { header: 'Período', value: (row) => formatPeriod(row.period) },
  { header: 'Cuenta', value: (row) => row.account.name },
  { header: 'Referencia', value: (row) => row.reference },
]

export const operationExcelColumns: Array<ExcelColumn<CommissionOperation>> = [
  { header: 'Fecha', value: (row) => row.date, type: 'date' },
  { header: 'Cliente', value: (row) => row.customerName },
  { header: 'Vehículo', value: (row) => row.vehicleLabel },
  { header: 'Precio lista', value: (row) => row.listPrice, type: 'money' },
  { header: 'Cierre', value: (row) => row.closingPrice, type: 'money' },
  { header: 'Diferencia', value: (row) => row.difference, type: 'money' },
  { header: 'Bajo lista', value: (row) => row.belowList },
  { header: 'Estado', value: (row) => commissionOperationStatus(row.status) },
  { header: 'Computable', value: (row) => row.computable },
  {
    header: 'Motivo no computable',
    value: (row) =>
      row.computable ? null : nonComputableReasonText(row.nonComputableReason, row.status),
  },
]

// "Mis comisiones": el histórico propio de pagos, con el tipo de vehículo.
export const ownPaidExcelColumns: Array<ExcelColumn<PaidCommission>> = [
  { header: 'Fecha', value: (row) => row.paidAt, type: 'date' },
  { header: 'Período', value: (row) => formatPeriod(row.period) },
  { header: 'Tipo', value: (row) => vehicleLabels[row.vehicleType] },
  { header: 'Cantidad', value: (row) => row.computableSales, type: 'integer' },
  { header: 'Escala', value: (row) => tierLabel(row.scaleSnapshot) },
  { header: 'Monto', value: (row) => row.paidAmount, type: 'money' },
]

export const ownManagerSettlementExcelColumns: Array<ExcelColumn<ManagerCommissionSettlement>> = [
  { header: 'Período', value: (row) => formatPeriod(row.period) },
  { header: 'Alcance', value: (row) => managerScopeLabels[row.scope] },
  { header: 'Ventas computables', value: (row) => row.computableSales, type: 'integer' },
  { header: 'Monto', value: (row) => row.amount, type: 'money' },
  { header: 'Estado', value: (row) => managerSettlementStatusLabels[row.status] },
  { header: 'Pagada', value: (row) => row.paidAt, type: 'date' },
]

// Textos de los filtros aplicados (no del borrador del formulario).

export function vehicleFilter(vehicleType: CommissionVehicleType) {
  return `Tipo: ${vehicleLabels[vehicleType]}`
}

export function periodFilter(period: string | undefined) {
  return period ? `Período: ${formatPeriod(period)}` : null
}

export function optionFilters(
  options: CommissionOptions,
  query: { branchId?: string; sellerId?: string },
) {
  const branch = query.branchId
    ? options.branches.find((item) => item.id === query.branchId)?.name ?? query.branchId
    : null
  const seller = query.sellerId
    ? options.sellers.find((item) => item.id === query.sellerId)?.name ?? query.sellerId
    : null
  return [branch && `Sucursal: ${branch}`, seller && `Vendedor: ${seller}`]
}

export function excelDate(value: string | undefined) {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}
