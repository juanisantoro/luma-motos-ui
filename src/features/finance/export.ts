import type { ExcelColumn } from '../../shared/export/excel'
import { paymentMethodLabels, handoverStatusLabels } from '../sales/tracking'
import { cashAccountLabel } from './cashAccounts'
import { statusLabel } from './format'
import type { Expense, FinancialKind, FinancialRecord, Income, SupplierPurchase } from './types'
import { displayVersion } from '../../shared/utils/vehicleVersion'

// Columnas del Excel de Ingresos, Gastos y Compras: las mismas que la grilla,
// con importes como número y la moneda aparte.

const incomeColumns: Array<ExcelColumn<Income>> = [
  { header: 'Fecha', value: (row) => row.incomeDate, type: 'date' },
  { header: 'Tipo', value: (row) => row.type },
  { header: 'Descripción', value: (row) => row.description },
  { header: 'Referencia', value: (row) => row.reference },
  { header: 'VIN', value: (row) => row.vehicle?.unit?.vin },
  { header: 'Operación', value: (row) => (row.operation ? `#${row.operation.number}` : null) },
  { header: 'Boleto', value: (row) => row.operation?.ticketNumber },
  { header: 'Sucursal', value: (row) => row.branch?.name ?? 'General' },
  { header: 'Moneda', value: (row) => row.currency },
  { header: 'Total', value: (row) => row.totalAmount, type: 'money' },
  { header: 'Cobrado', value: (row) => row.paidAmount, type: 'money' },
  { header: 'Saldo', value: (row) => row.balanceAmount, type: 'money' },
  { header: 'Estado', value: (row) => statusLabel(row.paymentStatus) },
  { header: 'Cuenta', value: (row) => (row.account ? cashAccountLabel(row.account) : null) },
  { header: 'Medio', value: (row) => (row.paymentMethod ? paymentMethodLabels[row.paymentMethod] : null) },
  { header: 'Cobró', value: (row) => row.collectedBy?.fullName },
  { header: 'Rendición', value: (row) => (row.handover ? handoverStatusLabels[row.handover.status] : null) },
  { header: 'Rinde a', value: (row) => row.handover?.recipient?.fullName },
  { header: 'Observaciones', value: (row) => row.notes },
]

const expenseColumns: Array<ExcelColumn<Expense>> = [
  { header: 'Fecha', value: (row) => row.expenseDate, type: 'date' },
  { header: 'Motivo', value: (row) => row.category },
  { header: 'TT', value: (row) => row.reference },
  { header: 'Detalle', value: (row) => row.description },
  { header: 'Sucursal', value: (row) => row.branch?.name ?? 'General' },
  { header: 'Moneda', value: (row) => row.currency },
  { header: 'Importe', value: (row) => row.totalAmount, type: 'money' },
  { header: 'Pagado', value: (row) => row.paidAmount, type: 'money' },
  { header: 'Saldo', value: (row) => row.balanceAmount, type: 'money' },
  { header: 'Pagado por', value: (row) => row.paidBy },
  { header: 'Cuenta', value: (row) => (row.account ? cashAccountLabel(row.account) : null) },
  { header: 'Estado', value: (row) => statusLabel(row.paymentStatus) },
  { header: 'Recuperable', value: (row) => row.recoverable },
  { header: 'Recuperada', value: (row) => row.recovered },
  { header: 'Mes', value: (row) => row.month, type: 'integer' },
  { header: 'Año', value: (row) => String(row.year) },
  { header: 'Observaciones', value: (row) => row.notes },
]

function purchaseColumns(canViewCosts: boolean): Array<ExcelColumn<SupplierPurchase>> {
  return [
    { header: 'Fecha', value: (row) => row.purchaseDate, type: 'date' },
    { header: 'Proveedor', value: (row) => row.supplier.legalName },
    { header: 'Comprobante', value: (row) => row.documentNumber },
    { header: 'VIN', value: (row) => row.vehicle.unit?.vin },
    {
      header: 'Vehículo',
      value: (row) =>
        [
          row.vehicle.version?.model.name,
          displayVersion(row.vehicle.version?.name, row.vehicle.version?.model.name),
        ]
          .filter(Boolean)
          .join(' ') || null,
    },
    { header: 'Sucursal', value: (row) => row.branch?.name ?? 'General' },
    ...(canViewCosts
      ? ([
          { header: 'Moneda', value: (row) => row.currency },
          { header: 'Base', value: (row) => row.baseAmount, type: 'money' },
          { header: 'Adicionales', value: (row) => row.additionalCosts, type: 'money' },
          { header: 'Total', value: (row) => row.totalAmount, type: 'money' },
          { header: 'Pagado', value: (row) => row.paidAmount, type: 'money' },
          { header: 'Saldo', value: (row) => row.balanceAmount, type: 'money' },
        ] satisfies Array<ExcelColumn<SupplierPurchase>>)
      : []),
    { header: 'Estado', value: (row) => statusLabel(row.paymentStatus) },
    { header: 'Observaciones', value: (row) => row.notes },
  ]
}

export function financialExcelColumns(
  kind: FinancialKind,
  canViewCosts: boolean,
): Array<ExcelColumn<FinancialRecord>> {
  if (kind === 'income') return incomeColumns as Array<ExcelColumn<FinancialRecord>>
  if (kind === 'expense') return expenseColumns as Array<ExcelColumn<FinancialRecord>>
  return purchaseColumns(canViewCosts) as Array<ExcelColumn<FinancialRecord>>
}
