import type { CashAccount, CashAccountType } from './types'

// Cuentas de caja: a quién le entra la plata. Una cuenta tiene un responsable
// (el socio o administrador que recibe el efectivo o el depósito) y puede ser
// de una sucursal o compartida por toda la organización.

export const cashAccountTypeLabels: Record<CashAccountType, string> = {
  CAJA: 'Efectivo',
  BANCO: 'Cuenta bancaria',
  SOCIO: 'Caja de socio',
  PROCESADORA_TARJETA: 'Procesadora de tarjetas',
  FINANCIERA: 'Financiera',
  OTRO: 'Otra',
}

// Monedas en las que se opera. Una cuenta es de una sola moneda y sólo
// recibe cobros o pagos de registros en esa misma moneda.
export const currencyLabels: Record<string, string> = {
  ARS: 'Pesos (ARS)',
  USD: 'Dólares (USD)',
}

export const currencies = Object.keys(currencyLabels)

export function currencyName(currency: string) {
  return { ARS: 'pesos', USD: 'dólares' }[currency] ?? currency
}

export const cashAccountTypes = Object.keys(
  cashAccountTypeLabels,
) as CashAccountType[]

type AccountLike = Pick<CashAccount, 'code' | 'name'> &
  Partial<
    Pick<
      CashAccount,
      | 'type'
      | 'currency'
      | 'branchId'
      | 'branch'
      | 'responsiblePersonnel'
      | 'imported'
      | 'importedLabel'
    >
  >

// Respuestas anteriores no traían `imported`: se infiere del código HIST-.
export function isImportedAccount(account: AccountLike) {
  return account.imported ?? account.code.startsWith('HIST-')
}

// La API devuelve `branchId`; versiones anteriores sólo traían `branch`.
export function cashAccountBranchId(account: AccountLike) {
  return account.branchId ?? account.branch?.id ?? null
}

export function cashAccountLabel(account: AccountLike) {
  if (isImportedAccount(account)) {
    const owner =
      account.importedLabel?.trim() ||
      account.name.replace(/^Cuenta historica importada:?\s*/i, '').trim() ||
      'sin identificar'
    return `Histórica: ${owner}`
  }
  const responsible = account.responsiblePersonnel?.fullName
  const type = account.type ? cashAccountTypeLabels[account.type] : null
  return [
    account.name,
    responsible && !account.name.includes(responsible) ? responsible : null,
    type,
    // La moneda sólo se aclara cuando no es pesos.
    account.currency && account.currency !== 'ARS' ? account.currency : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

// Cuentas propias primero, por nombre; las históricas importadas al final.
export function sortCashAccounts<T extends AccountLike>(accounts: T[]) {
  return [...accounts].sort(
    (left, right) =>
      Number(isImportedAccount(left)) - Number(isImportedAccount(right)) ||
      cashAccountLabel(left).localeCompare(cashAccountLabel(right), 'es-AR'),
  )
}

// Cuentas que se ofrecen para un registro de esa sucursal. Las históricas
// importadas del Excel no se ofrecen: sólo conservan los movimientos viejos.
// - Pagos y gastos: las de la sucursal y las compartidas (sin sucursal).
// - Cobros (`collection`): sólo las de la sucursal del ingreso, para que el
//   cierre de cada sucursal salga de sus propias cajas.
export function usableCashAccounts(
  accounts: CashAccount[],
  {
    currency,
    branchId,
    collection = false,
  }: { currency?: string; branchId?: string | null; collection?: boolean },
) {
  return sortCashAccounts(
    accounts.filter((account) => {
      const accountBranch = cashAccountBranchId(account)
      return (
        account.active &&
        !isImportedAccount(account) &&
        (!currency || account.currency === currency) &&
        (!branchId ||
          accountBranch === branchId ||
          (!collection && accountBranch === null))
      )
    }),
  )
}

// Al elegir a quién se rinde el efectivo se propone la caja de esa persona.
export function accountForRecipient(
  accounts: CashAccount[],
  recipientId: string,
) {
  const owned = accounts.filter(
    (account) =>
      !isImportedAccount(account) &&
      (account.responsiblePersonnelId ?? account.responsiblePersonnel?.id) ===
        recipientId,
  )
  // Sólo cajas de efectivo: no se propone un banco para plata que se rinde.
  return (
    owned.find((account) => account.type === 'SOCIO') ??
    owned.find((account) => account.type === 'CAJA') ??
    null
  )
}
