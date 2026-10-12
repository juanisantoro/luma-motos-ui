import type { BalanceData, BalanceEntry, BalanceSection } from './api'

// Arma las tablas del balance a partir de los importes que manda la API
// (`entries`, ya desagregados por renglón, sucursal y caja). La pantalla sólo
// suma: qué entra y con qué fecha lo decide el servidor.

export const ALL_BRANCHES = 'ALL'
export const GENERAL_BRANCH = 'GENERAL'
export const NO_ACCOUNT = 'NONE'

// Las motos y autos comprados en el mes son stock: no restan cuando se
// compran. 'cogs' resta lo que costaron las unidades vendidas; 'none' deja
// las unidades afuera del resultado.
export type UnitsMode = 'cogs' | 'none'

export type BalanceRowKind = 'section' | 'group' | 'line' | 'subtotal' | 'result'

export type BalanceRow = {
  kind: BalanceRowKind
  label: string
  // Un valor por columna; la última es el total. Los egresos van en negativo.
  // `null` en los títulos de sección.
  values: Array<number | null>
}

export type BalanceTable = {
  columns: Array<{ key: string; label: string }>
  rows: BalanceRow[]
}

const round = (value: number) => Math.round(value * 100) / 100

function inScope(entry: BalanceEntry, scope: string) {
  return scope === ALL_BRANCHES || entry.branch === scope
}

/** Suma por renglón de una sección, ordenado de mayor a menor. */
function linesOf(
  entries: BalanceEntry[],
  sections: BalanceSection[],
  keys: string[],
  keyOf: (entry: BalanceEntry) => string | null,
  lineOf: (entry: BalanceEntry) => string = (entry) => entry.line,
) {
  const byLine = new Map<string, number[]>()
  for (const entry of entries) {
    if (!sections.includes(entry.section)) continue
    const key = keyOf(entry)
    const column = key === null ? -1 : keys.indexOf(key)
    const label = lineOf(entry)
    const values = byLine.get(label) ?? keys.map(() => 0)
    if (column >= 0) values[column] = round(values[column]! + entry.amount)
    byLine.set(label, values)
  }
  return [...byLine.entries()]
    .map(([label, values]) => ({ label, values, total: values.reduce((a, b) => a + b, 0) }))
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, 'es'))
}

function sum(rows: Array<{ values: number[] }>, width: number) {
  const out = Array.from({ length: width }, () => 0)
  for (const row of rows) row.values.forEach((value, index) => (out[index] = round(out[index]! + value)))
  return out
}

const withTotal = (values: number[]) => [...values, round(values.reduce((a, b) => a + b, 0))]
const negative = (values: number[]) => values.map((value) => (value === 0 ? 0 : -value))
const blank = (width: number) => Array.from({ length: width + 1 }, () => null)

function lineRows(lines: Array<{ label: string; values: number[] }>, sign: 1 | -1): BalanceRow[] {
  return lines.map((line) => ({
    kind: 'line',
    label: line.label,
    values: withTotal(sign === 1 ? line.values : negative(line.values)),
  }))
}

/** Sucursales que se muestran como columnas para un alcance. */
export function branchColumns(data: BalanceData, scope: string) {
  return scope === ALL_BRANCHES
    ? data.branches
    : data.branches.filter((branch) => branch.key === scope)
}

export type BranchView = {
  table: BalanceTable
  income: number
  costOfSales: number
  expenses: number
  result: number
  purchases: number
  pendingSales: { amount: number; operations: number }
  unpaidExpenses: number
  unitsWithoutCost: number
}

export function branchView(data: BalanceData, scope: string, mode: UnitsMode): BranchView {
  const columns = branchColumns(data, scope)
  const keys = columns.map((column) => column.key)
  const width = keys.length
  const entries = data.entries.filter((entry) => inScope(entry, scope))
  const byBranch = (entry: BalanceEntry) => entry.branch

  const income = linesOf(entries, ['INCOME'], keys, byBranch)
  const cogs = linesOf(entries, ['COST_OF_SALES'], keys, byBranch)
  const general = linesOf(entries, ['EXPENSE'], keys, byBranch)
  const vehicle = linesOf(entries, ['VEHICLE_EXPENSE'], keys, byBranch)
  const commissions = linesOf(entries, ['COMMISSION'], keys, byBranch)
  const purchases = linesOf(entries, ['PURCHASE'], keys, byBranch)

  const incomeTotal = sum(income, width)
  const cogsTotal = mode === 'cogs' ? sum(cogs, width) : Array.from({ length: width }, () => 0)
  const expenseTotal = sum([...general, ...vehicle, ...commissions], width)
  const result = incomeTotal.map((value, index) => round(value - cogsTotal[index]! - expenseTotal[index]!))

  const rows: BalanceRow[] = [
    { kind: 'section', label: 'Ingresos', values: blank(width) },
    ...lineRows(income, 1),
    { kind: 'subtotal', label: 'Total ingresos', values: withTotal(incomeTotal) },
  ]
  if (mode === 'cogs') {
    rows.push(
      { kind: 'section', label: 'Costo de lo vendido', values: blank(width) },
      {
        kind: 'line',
        label: 'Lo que costaron las motos y autos vendidos',
        values: withTotal(negative(cogsTotal)),
      },
    )
  }
  rows.push({ kind: 'section', label: 'Egresos', values: blank(width) })
  for (const [label, lines] of [
    ['Gastos generales', general],
    ['Gastos de motos y autos', vehicle],
    ['Comisiones', commissions],
  ] as const) {
    if (!lines.length) continue
    rows.push({ kind: 'group', label, values: blank(width) }, ...lineRows(lines, -1))
  }
  rows.push(
    { kind: 'subtotal', label: 'Total egresos', values: withTotal(negative(expenseTotal)) },
    {
      kind: 'result',
      label: mode === 'cogs' ? 'Resultado del mes' : 'Ingresos menos egresos',
      values: withTotal(result),
    },
  )

  const total = (values: number[]) => round(values.reduce((a, b) => a + b, 0))
  const pending = data.sales.pending.filter((row) => scope === ALL_BRANCHES || row.branch === scope)
  return {
    table: {
      columns: [...columns.map((column) => ({ key: column.key, label: column.name })), { key: 'TOTAL', label: 'Total' }],
      rows,
    },
    income: total(incomeTotal),
    costOfSales: total(cogsTotal),
    expenses: total(expenseTotal),
    result: total(result),
    purchases: total(sum(purchases, width)),
    pendingSales: {
      amount: round(pending.reduce((acc, row) => acc + row.amount, 0)),
      operations: pending.reduce((acc, row) => acc + row.operations, 0),
    },
    unpaidExpenses: round(
      entries
        .filter(
          (entry) =>
            !entry.paid && ['EXPENSE', 'VEHICLE_EXPENSE', 'COMMISSION'].includes(entry.section),
        )
        .reduce((acc, entry) => acc + entry.amount, 0),
    ),
    unitsWithoutCost: data.sales.unitsWithoutCost,
  }
}

export type PartnerView = {
  table: BalanceTable
  partners: Array<{ key: string; name: string; collected: number; paid: number; net: number }>
}

const EXPENSE_GROUPS: Partial<Record<BalanceSection, string>> = {
  EXPENSE: 'Gastos generales',
  VEHICLE_EXPENSE: 'Gastos de motos y autos',
  COMMISSION: 'Comisiones',
}

/**
 * Lo que movió la caja de cada socio en el mes: lo cobrado en sus cajas y lo
 * pagado desde ellas. No es lo que ganó cada uno. El costo de lo vendido no
 * se reparte: la unidad se compra desde una caja y se cobra en otra.
 */
export function partnerView(data: BalanceData, scope: string): PartnerView {
  const entries = data.entries.filter((entry) => inScope(entry, scope) && entry.partner !== null)
  const present = new Set(entries.map((entry) => entry.partner))
  const columns = data.partners.filter((partner) => present.has(partner.key))
  const keys = columns.map((column) => column.key)
  const width = keys.length
  const byPartner = (entry: BalanceEntry) => entry.partner

  const income = linesOf(entries, ['INCOME'], keys, byPartner)
  const expenses = linesOf(
    entries,
    ['EXPENSE', 'VEHICLE_EXPENSE', 'COMMISSION'],
    keys,
    byPartner,
    (entry) => EXPENSE_GROUPS[entry.section]!,
  )
  const purchases = linesOf(entries, ['PURCHASE'], keys, byPartner, () => 'Compras de motos y autos')
  const collected = sum(income, width)
  const paid = sum(expenses, width)
  const net = collected.map((value, index) => round(value - paid[index]!))
  const purchased = sum(purchases, width)

  const rows: BalanceRow[] = [
    { kind: 'section', label: 'Cobrado en sus cajas', values: blank(width) },
    ...lineRows(income, 1),
    { kind: 'subtotal', label: 'Total cobrado', values: withTotal(collected) },
    { kind: 'section', label: 'Pagado desde sus cajas', values: blank(width) },
    ...lineRows(expenses, -1),
    { kind: 'subtotal', label: 'Total pagado', values: withTotal(negative(paid)) },
    { kind: 'result', label: 'Neto de la caja', values: withTotal(net) },
  ]
  if (purchases.length) {
    rows.push(
      { kind: 'section', label: 'Aparte (no entra en el neto)', values: blank(width) },
      ...lineRows(purchases, -1),
      {
        kind: 'subtotal',
        label: 'Neto después de compras',
        values: withTotal(net.map((value, index) => round(value - purchased[index]!))),
      },
    )
  }

  return {
    table: {
      columns: [...columns.map((column) => ({ key: column.key, label: column.name })), { key: 'TOTAL', label: 'Total' }],
      rows,
    },
    partners: columns.map((column, index) => ({
      key: column.key,
      name: column.name,
      collected: collected[index]!,
      paid: paid[index]!,
      net: net[index]!,
    })),
  }
}
