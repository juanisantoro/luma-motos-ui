import type { ExcelColumn } from '../../shared/export/excel'
import { cashAccountLabel, cashAccountTypeLabels, isImportedAccount } from './cashAccounts'
import type { CashAccount, CashTransfer, PartnerWithdrawal } from './types'

// Columnas del Excel de Cuentas de caja, Transferencias entre cajas y Retiros
// de socios: las mismas que la grilla, con importes como número y la moneda
// aparte.

export function cashAccountColumns(
  branchName: (account: CashAccount) => string,
): Array<ExcelColumn<CashAccount>> {
  return [
    {
      header: 'Cuenta',
      value: (row) => (isImportedAccount(row) ? cashAccountLabel(row) : row.name),
    },
    { header: 'Importada del Excel', value: (row) => isImportedAccount(row) },
    { header: 'Tipo', value: (row) => cashAccountTypeLabels[row.type] },
    { header: 'Responsable', value: (row) => row.responsiblePersonnel?.fullName ?? 'Sin responsable' },
    { header: 'Sucursal', value: branchName },
    { header: 'Moneda', value: (row) => row.currency },
    { header: 'Saldo', value: (row) => row.balance, type: 'money' },
    { header: 'Estado', value: (row) => (row.active ? 'Activa' : 'Inactiva') },
  ]
}

export function cashTransferStatusLabel(status: CashTransfer['status']) {
  if (status === 'CONFIRMADA') return 'Vigente'
  if (status === 'REVERSADA') return 'Anulada'
  return 'Pendiente'
}

export function cashTransferColumns(
  accounts: CashAccount[],
  branchOf: (accountId: string) => string,
): Array<ExcelColumn<CashTransfer>> {
  return [
    { header: 'Fecha', value: (row) => row.occurredAt, type: 'date' },
    { header: 'Sale de', value: (row) => row.sourceAccount.name },
    { header: 'Sucursal origen', value: (row) => branchOf(row.sourceAccount.id) },
    { header: 'Entra a', value: (row) => row.destinationAccount.name },
    { header: 'Sucursal destino', value: (row) => branchOf(row.destinationAccount.id) },
    {
      header: 'Moneda',
      value: (row) => accounts.find((account) => account.id === row.sourceAccount.id)?.currency,
    },
    { header: 'Importe', value: (row) => row.amount, type: 'money' },
    { header: 'Referencia', value: (row) => row.reference },
    { header: 'Registró', value: (row) => row.createdBy.fullName },
    { header: 'Estado', value: (row) => cashTransferStatusLabel(row.status) },
  ]
}

export const partnerWithdrawalColumns: Array<ExcelColumn<PartnerWithdrawal>> = [
  { header: 'Fecha', value: (row) => row.date, type: 'date' },
  { header: 'Socio', value: (row) => row.partner?.fullName },
  { header: 'Caja', value: (row) => row.account.name },
  { header: 'Sucursal', value: (row) => row.branch?.name ?? 'Compartida' },
  { header: 'Moneda', value: (row) => row.currency },
  { header: 'Importe', value: (row) => row.amount, type: 'money' },
  { header: 'Motivo', value: (row) => row.reason },
  { header: 'Registró', value: (row) => row.registeredBy?.fullName },
  { header: 'Estado', value: (row) => (row.status === 'REGISTRADO' ? 'Vigente' : 'Anulado') },
  { header: 'Anuló', value: (row) => row.reversal?.by?.fullName },
  { header: 'Motivo de anulación', value: (row) => row.reversal?.reason },
]
