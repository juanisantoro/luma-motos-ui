import { ArrowRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DashboardPanel, PanelEmptyState, RankingList, TopModelsPanel } from './components'
import {
  formatCurrency,
  formatMonthDelta,
  formatUnits,
  greetingFirstName,
  monthNameOf,
  todayLongLabel,
} from './format'
import { formatDay } from '../../shared/work-months/workMonths'
import { PendingTasksPanel } from './PendingTasksPanel'
import type {
  AdminBranchSummary,
  AdminHome,
  CreditPortfolio,
  DashboardMonth,
  MonthlyPerformance,
  PendingTasks,
} from './types'

const ALL_BRANCHES = 'all'

/** Textos que cambian según se mire el mes en curso o uno cerrado. */
type MonthLabels = {
  /** "este mes" / "en septiembre" */
  inMonth: string
  /** "el mes anterior" / "en agosto" */
  inPreviousMonth: string
  /** "del mes" / "de septiembre" */
  ofMonth: string
  /** "el mes anterior" / "agosto" */
  previousMonth: string
  /** "en el mes" / "en septiembre" */
  withinMonth: string
}

const CURRENT_MONTH_LABELS: MonthLabels = {
  inMonth: 'este mes',
  inPreviousMonth: 'el mes anterior',
  ofMonth: 'del mes',
  previousMonth: 'el mes anterior',
  withinMonth: 'en el mes',
}

function monthLabels(month: DashboardMonth, period: string | undefined): MonthLabels {
  const name = period ? monthNameOf(period) : ''
  if (month === 'current' || !period || !name) return CURRENT_MONTH_LABELS
  const previousName = monthNameOf(period, -1)
  return {
    inMonth: `en ${name}`,
    inPreviousMonth: `en ${previousName}`,
    ofMonth: `de ${name}`,
    previousMonth: previousName,
    withinMonth: `en ${name}`,
  }
}

function isCalendarMonth(item: { period: string; from: string; to: string }) {
  const [year, month] = item.period.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate()
  return item.from === `${item.period}-01` && item.to === `${item.period}-${String(lastDay).padStart(2, '0')}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

type Collection = NonNullable<AdminBranchSummary['collection']>

/** Qué parte de lo vendido en el mes ya se cobró, de 0 a 100. */
export function collectedPercent(collection: Collection) {
  if (collection.agreedAmount <= 0) return 0
  const percent = Math.round((collection.collectedAmount / collection.agreedAmount) * 100)
  return Math.min(100, Math.max(0, percent))
}

/** Suma lo que mandan las sucursales; null si ninguna lo manda (sin permiso). */
function sumOf<T>(items: Array<T | null>, add: (total: T, item: T) => T): T | null {
  return items.reduce<T | null>((total, item) => {
    if (item === null) return total
    return total === null ? item : add(total, item)
  }, null)
}

function sumCollections(branches: AdminBranchSummary[]) {
  return sumOf<Collection>(
    branches.map((branch) => branch.collection),
    (total, item) => ({
      agreedAmount: total.agreedAmount + item.agreedAmount,
      collectedAmount: total.collectedAmount + item.collectedAmount,
      pendingAmount: total.pendingAmount + item.pendingAmount,
      pendingOperations: total.pendingOperations + item.pendingOperations,
    }),
  )
}

function sumExpenses(branches: AdminBranchSummary[]) {
  return sumOf(
    branches.map((branch) => branch.expensesThisMonth),
    (total, item) => ({ amount: total.amount + item.amount, count: total.count + item.count }),
  )
}

function percentOf(value: number, max: number) {
  return max > 0 ? Math.round((value / max) * 100) : 0
}

// --- Piezas del inicio -------------------------------------------------------

function Stat({
  label,
  value,
  meta,
  tone = 'neutral',
  progress,
}: {
  label: string
  value: string
  meta?: ReactNode
  tone?: 'neutral' | 'danger'
  /** Barra de avance de 0 a 100 (decorativa: el texto ya dice el número). */
  progress?: number
}) {
  return (
    <article className="cockpit-stat">
      <p className="cockpit-stat__label">{label}</p>
      <p className={`cockpit-stat__value${tone === 'danger' ? ' cockpit-stat__value--danger' : ''}`}>
        {value}
      </p>
      {progress !== undefined && (
        <span className="cockpit-bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </span>
      )}
      {meta && <p className="cockpit-stat__meta">{meta}</p>}
    </article>
  )
}

/** Tarjeta oscura con las ventas del mes: lo primero que se mira. */
function SalesHero({
  scope,
  sales,
  labels,
  footer,
}: {
  scope: string
  sales: MonthlyPerformance
  labels: MonthLabels
  footer: ReactNode
}) {
  const delta = formatMonthDelta(sales.currentMonth.units, sales.previousMonth.units)
  const up = sales.currentMonth.units >= sales.previousMonth.units
  return (
    <article className="cockpit-stat cockpit-stat--hero">
      <p className="cockpit-stat__label">
        VENTAS {labels.ofMonth.toUpperCase()} · {scope.toUpperCase()}
      </p>
      <p className="cockpit-stat__value">{formatCurrency(sales.currentMonth.amount)}</p>
      <p className="cockpit-stat__meta">
        {formatUnits(sales.currentMonth.units)} vendidas {labels.inMonth}, frente a{' '}
        {formatUnits(sales.previousMonth.units)} {labels.inPreviousMonth} (
        <b className={up ? 'cockpit-up' : 'cockpit-down'}>{delta}</b>).
      </p>
      <p className="cockpit-stat__foot">{footer}</p>
    </article>
  )
}

function CollectionStats({
  collection,
  expenses,
  labels,
  expensesNote,
}: {
  collection: Collection | null
  expenses: { amount: number; count: number } | null
  labels: MonthLabels
  expensesNote: string
}) {
  const percent = collection ? collectedPercent(collection) : 0
  return (
    <>
      {collection && (
        <Stat
          label={`Cobrado de las ventas ${labels.ofMonth}`}
          value={formatCurrency(collection.collectedAmount)}
          progress={percent}
          meta={`${percent}% de lo vendido`}
        />
      )}
      {collection && (
        <Stat
          label="Falta cobrar"
          value={formatCurrency(collection.pendingAmount)}
          tone={collection.pendingAmount > 0 ? 'danger' : 'neutral'}
          meta={
            collection.pendingOperations === 1
              ? '1 venta con saldo'
              : `${collection.pendingOperations} ventas con saldo`
          }
        />
      )}
      {expenses && (
        <Stat
          label={`Gastos ${labels.ofMonth}`}
          value={formatCurrency(expenses.amount)}
          meta={expensesNote}
        />
      )}
    </>
  )
}

/** Cartera de créditos, stock y lo que espera una decisión. */
function PortfolioPanel({
  credit,
  items,
}: {
  credit: CreditPortfolio | null
  items: Array<{ label: string; value: string } | null>
}) {
  const shown = items.filter((item): item is { label: string; value: string } => item !== null)
  if (!credit && shown.length === 0) return null
  return (
    <DashboardPanel title="Cartera y stock">
      {credit && (
        <div className="cockpit-credit">
          <p className="cockpit-stat__label">Cartera de créditos personales</p>
          <p className="cockpit-credit__value">{formatCurrency(credit.financedAmount)}</p>
          <p className={`cockpit-credit__overdue${credit.overdueAmount > 0 ? ' cockpit-credit__overdue--danger' : ''}`}>
            {formatCurrency(credit.overdueAmount)} en mora
          </p>
        </div>
      )}
      {shown.length > 0 && (
        <dl className="cockpit-facts">
          {shown.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </DashboardPanel>
  )
}

function SellersPanel({
  branches,
  labels,
  showBranch,
}: {
  branches: AdminBranchSummary[]
  labels: MonthLabels
  showBranch: boolean
}) {
  const withSellers = branches.filter((branch) => branch.sellers)
  if (withSellers.length === 0) return null
  // Un solo ranking, con la sucursal de cada vendedor.
  const sellers = withSellers
    .flatMap((branch) =>
      (branch.sellers ?? []).map((seller) => ({ ...seller, branchName: branch.branchName })),
    )
    .sort((a, b) => b.units - a.units)
  const max = sellers[0]?.units ?? 0
  return (
    <DashboardPanel title="Vendedores del mes" description={`Unidades computables ${labels.ofMonth}`}>
      {sellers.length === 0 ? (
        <PanelEmptyState>No hay ventas computables {labels.inMonth}.</PanelEmptyState>
      ) : (
        <RankingList
          items={sellers.map((seller) => ({
            key: `${seller.branchName}-${seller.sellerId}`,
            name: seller.sellerName,
            ...(showBranch ? { subtitle: seller.branchName } : {}),
            stat: `${seller.units} un.`,
            share: percentOf(seller.units, max),
          }))}
        />
      )}
    </DashboardPanel>
  )
}

function BranchRow({
  branch,
  labels,
  totalAmount,
  onOpen,
}: {
  branch: AdminBranchSummary
  labels: MonthLabels
  totalAmount: number
  onOpen: () => void
}) {
  const sales = branch.monthlySales
  const collection = branch.collection
  const percent = collection ? collectedPercent(collection) : 0
  return (
    <li className="cockpit-branch">
      <div className="cockpit-branch__head">
        <h3>{branch.branchName}</h3>
        {sales && <strong>{formatCurrency(sales.currentMonth.amount)}</strong>}
      </div>
      {collection && (
        <div
          aria-label={`Cobrado ${percent}% de lo vendido ${labels.withinMonth}`}
          className="cockpit-bar cockpit-bar--large"
          role="img"
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
      <div className="cockpit-branch__foot">
        <p>
          {sales && (
            <>
              <span>
                <b>{sales.currentMonth.units}</b> un. ·{' '}
                {formatMonthDelta(sales.currentMonth.units, sales.previousMonth.units)}
              </span>
              {totalAmount > 0 && (
                <span>
                  <b>{percentOf(sales.currentMonth.amount, totalAmount)}%</b> del total
                </span>
              )}
            </>
          )}
          {collection && (
            <>
              <span>
                Cobrado <b>{percent}%</b>
              </span>
              <span>
                Saldo <b>{formatCurrency(collection.pendingAmount)}</b>
              </span>
            </>
          )}
        </p>
        <button className="cockpit-link" onClick={onOpen} type="button">
          Ver sucursal <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

function MonthSwitch({
  today,
  months,
  month,
  loading,
  onChange,
}: {
  today: string
  months: AdminHome['months']
  month: DashboardMonth
  loading: boolean
  onChange: (month: DashboardMonth) => void
}) {
  // Con cortes, el mes en curso puede no ser el del almanaque: los nombres y
  // las fechas vienen del backend. Uno anterior a los cortes no los manda.
  const currentPeriod = today.slice(0, 7)
  const options: Array<{ value: DashboardMonth; label: string; range?: string }> = months?.length
    ? months.map((item) => ({
        value: item.month,
        label: capitalize(monthNameOf(item.period)),
        range: `Del ${formatDay(item.from)} al ${formatDay(item.to)}`,
      }))
    : [
        { value: 'current', label: capitalize(monthNameOf(currentPeriod)) },
        { value: 'previous', label: capitalize(monthNameOf(currentPeriod, -1)) },
      ]
  return (
    <div aria-busy={loading} aria-label="Mes" className="cockpit-segment" role="group">
      {options.map((option) => (
        <button
          aria-pressed={option.value === month}
          className={`cockpit-segment__option${option.value === month ? ' cockpit-segment__option--dark' : ''}`}
          disabled={loading}
          key={option.value}
          onClick={() => onChange(option.value)}
          title={option.range}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// --- Vistas ------------------------------------------------------------------

function BranchView({
  branch,
  labels,
  shareOfTotal,
}: {
  branch: AdminBranchSummary
  labels: MonthLabels
  shareOfTotal: number | null
}) {
  const sales = branch.monthlySales
  return (
    <>
      <section aria-label="Números del mes" className="cockpit-stats">
        {sales && (
          <SalesHero
            labels={labels}
            sales={sales}
            scope={branch.branchName}
            footer={
              shareOfTotal !== null ? (
                <>
                  <strong>{shareOfTotal}%</strong> del total de la organización
                </>
              ) : (
                <>
                  {capitalize(labels.inPreviousMonth)}: {formatCurrency(sales.previousMonth.amount)}
                </>
              )
            }
          />
        )}
        <CollectionStats
          collection={branch.collection}
          expenses={branch.expensesThisMonth}
          expensesNote="Sólo los de la sucursal, en pesos"
          labels={labels}
        />
      </section>

      <div className="cockpit-split">
        <SellersPanel branches={[branch]} labels={labels} showBranch={false} />
        <PortfolioPanel
          credit={branch.creditPortfolio}
          items={[
            branch.stockUnits !== null
              ? { label: 'Stock disponible', value: formatUnits(branch.stockUnits) }
              : null,
            branch.pendingApprovals !== null
              ? { label: 'Esperan aprobación', value: String(branch.pendingApprovals) }
              : null,
          ]}
        />
      </div>

      <div className="cockpit-pair">
        <TopModelsPanel
          title="Modelos más vendidos"
          description={`Top 5 por unidades ${labels.ofMonth}, ${branch.branchName}`}
          models={branch.topModels}
        />
      </div>
    </>
  )
}

function OrganizationView({
  home,
  branches,
  labels,
  onOpen,
}: {
  home: AdminHome
  branches: AdminBranchSummary[]
  labels: MonthLabels
  onOpen: (branchId: string) => void
}) {
  const sales = home.monthlySales
  const totalAmount = sales?.currentMonth.amount ?? 0
  const several = branches.length > 1
  return (
    <>
      <section aria-label="Números del mes" className="cockpit-stats">
        {sales && (
          <SalesHero
            labels={labels}
            sales={sales}
            scope="Todas las sucursales"
            footer={
              <>
                {capitalize(labels.inPreviousMonth)}: {formatCurrency(sales.previousMonth.amount)} ·
                monto {formatMonthDelta(sales.currentMonth.amount, sales.previousMonth.amount)}
              </>
            }
          />
        )}
        <CollectionStats
          collection={sumCollections(branches)}
          expenses={sumExpenses(branches)}
          expensesNote="Todas las sucursales, en pesos"
          labels={labels}
        />
      </section>

      <div className="cockpit-split">
        {branches.length > 0 ? (
          <DashboardPanel
            title="Sucursales"
            description={`Ventas y cobranza ${labels.ofMonth}`}
          >
            <ul className="cockpit-branches">
              {branches.map((item) => (
                <BranchRow
                  branch={item}
                  key={item.branchId}
                  labels={labels}
                  onOpen={() => onOpen(item.branchId)}
                  totalAmount={several ? totalAmount : 0}
                />
              ))}
            </ul>
          </DashboardPanel>
        ) : (
          home.salesByBranch && (
            <DashboardPanel
              title="Ventas por sucursal"
              description={`Unidades y monto ${labels.ofMonth}, por sucursal`}
            >
              {home.salesByBranch.length === 0 ? (
                <PanelEmptyState>No hay sucursales activas.</PanelEmptyState>
              ) : (
                <RankingList
                  items={home.salesByBranch.map((item) => ({
                    key: item.branchId,
                    name: item.branchName,
                    stat: formatUnits(item.units),
                    statSubtitle: formatCurrency(item.amount),
                  }))}
                />
              )}
            </DashboardPanel>
          )
        )}
        <PortfolioPanel
          credit={home.creditPortfolio}
          items={[
            home.stockUnitsTotal !== null
              ? { label: 'Stock total', value: formatUnits(home.stockUnitsTotal) }
              : null,
            home.pendingPurchases !== null
              ? { label: 'Compras pendientes de recibir', value: formatUnits(home.pendingPurchases) }
              : null,
            home.newClientsThisWeek !== null
              ? { label: 'Clientes nuevos esta semana', value: String(home.newClientsThisWeek) }
              : null,
          ]}
        />
      </div>

      <div className="cockpit-pair">
        <SellersPanel branches={branches} labels={labels} showBranch={several} />
        <TopModelsPanel
          title="Modelos más vendidos"
          description={`Top 5 por unidades ${labels.ofMonth}, toda la organización`}
          models={home.topModels}
        />
      </div>

      {!home.salesByBranch && !home.topModels && !home.creditPortfolio && (
        <DashboardPanel title="Sin secciones disponibles">
          <PanelEmptyState>
            Tu rol no tiene permisos asignados para ver información de este panel todavía.
          </PanelEmptyState>
        </DashboardPanel>
      )}
    </>
  )
}

export function AdminDashboard({
  home,
  month = 'current',
  loading = false,
  onMonthChange,
}: {
  home: AdminHome
  month?: DashboardMonth
  loading?: boolean
  /** Sin esto (o con un backend que no manda `period`) no hay selector de mes. */
  onMonthChange?: (month: DashboardMonth) => void
}) {
  const { greeting } = home
  // Lo que se ve es el mes que trajo el backend; mientras carga otro, el
  // selector ya marca el nuevo.
  const shownMonth = home.month ?? 'current'
  const labels = monthLabels(shownMonth, home.period ?? home.monthlySales?.period)
  // Si el mes que se ve no es el del almanaque, sus fechas en el encabezado.
  const shownMonthRange = home.months?.find((item) => item.month === shownMonth)
  const shownRange =
    shownMonthRange && !isCalendarMonth(shownMonthRange)
      ? `${capitalize(monthNameOf(shownMonthRange.period))}: del ${formatDay(shownMonthRange.from)} al ${formatDay(shownMonthRange.to)}`
      : null
  const branches = home.branches ?? []
  const [selected, setSelected] = useState<string>(ALL_BRANCHES)
  const branch = branches.find((item) => item.branchId === selected) ?? null
  const totalAmount = home.monthlySales?.currentMonth.amount ?? 0
  // Las tareas pendientes de la sucursal elegida, con el mismo panel que la
  // vista consolidada.
  const branchTasks: PendingTasks | null =
    branch && home.pendingTasks
      ? {
          branches: home.pendingTasks.branches.filter(
            (item) => item.branchId === branch.branchId,
          ),
        }
      : null
  const shareOfTotal =
    branch?.monthlySales && totalAmount > 0
      ? Math.round((branch.monthlySales.currentMonth.amount / totalAmount) * 100)
      : null

  return (
    <div className="cockpit">
      <header className="cockpit-heading">
        <div>
          <p className="cockpit-heading__date">{todayLongLabel(greeting.date)}</p>
          <h1>Buen día, {greetingFirstName(greeting.name)}</h1>
          <p className="cockpit-heading__scope">
            {branch ? `Sucursal ${branch.branchName}` : `${greeting.organizationName} · todas las sucursales`}
            {shownRange && ` · ${shownRange}`}
            {loading && ' · Actualizando…'}
          </p>
        </div>
        <div className="cockpit-heading__actions">
          {onMonthChange && home.period && (
            <MonthSwitch
              loading={loading}
              month={month}
              months={home.months}
              onChange={onMonthChange}
              today={greeting.date}
            />
          )}
          {branches.length > 0 && (
            <nav className="cockpit-segment" aria-label="Sucursal">
              <button
                aria-current={branch ? undefined : 'page'}
                className={`cockpit-segment__option${branch ? '' : ' cockpit-segment__option--accent'}`}
                onClick={() => setSelected(ALL_BRANCHES)}
                type="button"
              >
                Todas las sucursales
              </button>
              {branches.map((item) => (
                <button
                  aria-current={item.branchId === branch?.branchId ? 'page' : undefined}
                  className={`cockpit-segment__option${item.branchId === branch?.branchId ? ' cockpit-segment__option--accent' : ''}`}
                  key={item.branchId}
                  onClick={() => setSelected(item.branchId)}
                  type="button"
                >
                  {item.branchName}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <PendingTasksPanel tasks={branch ? branchTasks : home.pendingTasks} mode="team" links />

      {branch ? (
        <BranchView branch={branch} labels={labels} shareOfTotal={shareOfTotal} />
      ) : (
        <OrganizationView
          branches={branches}
          home={home}
          labels={labels}
          onOpen={setSelected}
        />
      )}
    </div>
  )
}
