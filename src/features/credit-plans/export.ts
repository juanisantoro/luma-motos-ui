import type { ExcelColumn } from '../../shared/export/excel'
import { calculationMethodLabels, installmentStatusLabels } from './format'
import type { CreditInstallment, CreditPlan } from './types'

// Columnas del Excel de Planes de crédito y Cobranza de cuotas: las mismas que
// las grillas, con importes como número.

export const creditPlanExcelColumns: Array<ExcelColumn<CreditPlan>> = [
  { header: 'Nombre', value: (row) => row.name },
  { header: 'Método', value: (row) => calculationMethodLabels[row.calculationMethod] },
  { header: 'Cuotas', value: (row) => row.installmentCount, type: 'integer' },
  { header: 'Tasa (%)', value: (row) => row.interestRate, type: 'number' },
  {
    header: 'Tipo de tasa',
    value: (row) => (row.calculationMethod === 'FRANCES' ? 'Mensual' : 'Total'),
  },
  { header: 'Monto mínimo', value: (row) => row.minimumAmount, type: 'money' },
  { header: 'Monto máximo', value: (row) => row.maximumAmount, type: 'money' },
  { header: 'Estado', value: (row) => (row.active ? 'Activo' : 'Inactivo') },
]

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export const creditInstallmentExcelColumns: Array<ExcelColumn<CreditInstallment>> = [
  { header: 'Vencimiento', value: (row) => row.dueDate, type: 'date' },
  { header: 'Cliente', value: (row) => row.clientName },
  { header: 'Operación', value: (row) => `#${row.operationNumber}` },
  { header: 'Cuota', value: (row) => row.number, type: 'integer' },
  { header: 'Importe', value: (row) => row.amount, type: 'money' },
  { header: 'Pagado', value: (row) => row.paidAmount, type: 'money' },
  { header: 'Saldo', value: (row) => round2(row.amount - row.paidAmount), type: 'money' },
  { header: 'Estado', value: (row) => installmentStatusLabels[row.status] },
  { header: 'Fecha de pago', value: (row) => row.paidAt, type: 'date' },
]
