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

// Cuentas que se ofrecen para cobrar o pagar un registro. La plata entra y
// sale por una caja de la sucursal del registro, así el cierre de cada
// sucursal sale de sus propias cajas:
// - `branchId` con una sucursal: sólo las cuentas de esa sucursal.
// - `branchId: null` (registro "General", sin sucursal): sólo las compartidas.
// - sin `branchId`: no se filtra por sucursal.
// Las históricas importadas del Excel no se ofrecen nunca: sólo conservan
// los movimientos viejos.
export function usableCashAccounts(
  accounts: CashAccount[],
  { currency, branchId }: { currency?: string; branchId?: string | null },
) {
  return sortCashAccounts(
    accounts.filter(
      (account) =>
        account.active &&
        !isImportedAccount(account) &&
        (!currency || account.currency === currency) &&
        (branchId === undefined || cashAccountBranchId(account) === branchId),
    ),
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

function nameStems(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .map((token) => token.slice(0, 5))
}

// Palabras del nombre histórico que coinciden con las de la persona: una
// coincide si empieza como la otra, mirando hasta 5 letras ("Capdevilla" /
// "Capdevila", "Nico" / "Nicolás"). Mismo criterio que el script que pasó los
// cobros de las históricas a las cajas activas.
function nameScore(historic: string, person: string) {
  const personStems = nameStems(person)
  return new Set(
    nameStems(historic).filter((stem) =>
      personStems.some((other) => other.startsWith(stem) || stem.startsWith(other)),
    ),
  ).size
}

export type CashAccountPartner = { id: string; name: string }

function responsibleOf(account: CashAccount) {
  const id = account.responsiblePersonnelId ?? account.responsiblePersonnel?.id ?? null
  return id ? { id, name: account.responsiblePersonnel?.fullName ?? '' } : null
}

// Responsables de las cajas activas (los socios), para filtrar "sus cajas".
export function cashAccountPartners(accounts: CashAccount[]): CashAccountPartner[] {
  const partners = new Map<string, CashAccountPartner>()
  for (const account of accounts) {
    if (isImportedAccount(account)) continue
    const responsible = responsibleOf(account)
    if (responsible && responsible.name && !partners.has(responsible.id))
      partners.set(responsible.id, responsible)
  }
  return [...partners.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'es-AR'),
  )
}

/**
 * De qué socio es una cuenta. Una histórica importada del Excel puede no
 * tener responsable cargado ("Histórica: LUCAS"): se reconoce por el nombre
 * cuando coincide con un único socio.
 */
export function cashAccountPartnerId(
  account: CashAccount,
  partners: CashAccountPartner[],
): string | null {
  const responsible = responsibleOf(account)
  if (responsible) return responsible.id
  if (!isImportedAccount(account)) return null
  const owner = cashAccountLabel(account).replace(/^Histórica:\s*/, '')
  const scores = partners.map((partner) => ({
    id: partner.id,
    score: nameScore(owner, partner.name),
  }))
  const best = Math.max(0, ...scores.map((item) => item.score))
  const winners = scores.filter((item) => item.score === best)
  return best > 0 && winners.length === 1 ? (winners[0]?.id ?? null) : null
}

/**
 * Cuentas para el filtro de las grillas de ingresos y gastos. Con una
 * sucursal elegida quedan las de esa sucursal y las que no tienen sucursal
 * (compartidas e históricas, que pueden tener cobros de cualquiera); con un
 * socio, sólo las suyas (incluidas sus históricas).
 */
export function filterCashAccounts(
  accounts: CashAccount[],
  { branchId, partnerId }: { branchId?: string | undefined; partnerId?: string | undefined },
) {
  const partners = cashAccountPartners(accounts)
  return sortCashAccounts(
    accounts.filter((account) => {
      const accountBranch = cashAccountBranchId(account)
      if (branchId && accountBranch && accountBranch !== branchId) return false
      if (partnerId && cashAccountPartnerId(account, partners) !== partnerId) return false
      return true
    }),
  )
}
