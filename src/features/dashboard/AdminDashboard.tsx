import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  HandCoins,
  PackageSearch,
  Receipt,
  UsersRound,
  Wallet,
  Warehouse,
} from 'lucide-react'
import { useState } from 'react'
import { DashboardPanel, KpiCard, PanelEmptyState, RankingList, TopModelsPanel } from './components'
import { formatCurrency, formatMonthDelta, formatUnits, greetingFirstName, todayLongLabel } from './format'
import { PendingTasksPanel } from './PendingTasksPanel'
import type { AdminBranchSummary, AdminHome, PendingTasks } from './types'

const ALL_BRANCHES = 'all'

/** Qué parte de lo vendido en el mes ya se cobró, de 0 a 100. */
export function collectedPercent(collection: NonNullable<AdminBranchSummary['collection']>) {
  if (collection.agreedAmount <= 0) return 0
  const percent = Math.round((collection.collectedAmount / collection.agreedAmount) * 100)
  return Math.min(100, Math.max(0, percent))
}

function BranchSellers({ branch }: { branch: AdminBranchSummary }) {
  if (!branch.sellers) return null
  if (branch.sellers.length === 0)
    return <PanelEmptyState>Todavía no hay ventas computables este mes.</PanelEmptyState>
  return (
    <RankingList
      items={branch.sellers.map((seller) => ({
        key: seller.sellerId,
        name: seller.sellerName,
        stat: `${seller.units} un.`,
      }))}
    />
  )
}

function BranchCard({ branch, onOpen }: { branch: AdminBranchSummary; onOpen: () => void }) {
  const sales = branch.monthlySales
  const collection = branch.collection
  const percent = collection ? collectedPercent(collection) : 0
  return (
    <section className="dashboard-panel branch-card">
      <div className="dashboard-panel__header">
        <div>
          <h3>{branch.branchName}</h3>
        </div>
        <button className="button button--secondary button--compact" onClick={onOpen} type="button">
          Ver sucursal
        </button>
      </div>
      {sales && (
        <div>
          <p className="branch-card__label">Ventas del mes</p>
          <p className="branch-card__value">{formatCurrency(sales.currentMonth.amount)}</p>
          <p className="branch-card__meta">
            {formatUnits(sales.currentMonth.units)} ·{' '}
            {formatMonthDelta(sales.currentMonth.units, sales.previousMonth.units)} contra el mes anterior
          </p>
        </div>
      )}
      {collection && (
        <div className="branch-card__collection">
          <div className="branch-card__collection-text">
            <strong>Cobrado {formatCurrency(collection.collectedAmount)}</strong>
            <span>Falta cobrar {formatCurrency(collection.pendingAmount)}</span>
          </div>
          <div
            aria-label={`Cobrado ${percent}% de lo vendido en el mes`}
            className="branch-card__bar"
            role="img"
          >
            <div className="branch-card__bar-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
    </section>
  )
}

function BranchDetail({ branch, shareOfTotal }: { branch: AdminBranchSummary; shareOfTotal: number | null }) {
  const sales = branch.monthlySales
  const collection = branch.collection
  const credit = branch.creditPortfolio
  return (
    <>
      {sales && (
        <section className="hero-card">
          <div>
            <span className="hero-card__icon" aria-hidden="true">
              <Banknote />
            </span>
            <p className="eyebrow">VENTAS DEL MES · {branch.branchName.toUpperCase()}</p>
            <h2>{formatCurrency(sales.currentMonth.amount)}</h2>
            <p>
              {formatUnits(sales.currentMonth.units)} vendidas este mes, frente a{' '}
              {formatUnits(sales.previousMonth.units)} el mes anterior (
              {formatMonthDelta(sales.currentMonth.units, sales.previousMonth.units)}).
            </p>
          </div>
          <div className="hero-card__meta">
            <small>Mes anterior</small>
            <strong>{formatCurrency(sales.previousMonth.amount)}</strong>
            {shareOfTotal !== null && (
              <>
                <small>Participación en el total</small>
                <strong>{shareOfTotal}%</strong>
              </>
            )}
          </div>
        </section>
      )}

      <div className="kpi-grid">
        {collection && (
          <KpiCard
            icon={HandCoins}
            label="Cobrado de las ventas del mes"
            value={formatCurrency(collection.collectedAmount)}
            meta={`${collectedPercent(collection)}% de lo vendido`}
          />
        )}
        {collection && (
          <KpiCard
            icon={Wallet}
            label="Falta cobrar"
            value={formatCurrency(collection.pendingAmount)}
            meta={
              collection.pendingOperations === 1
                ? '1 venta con saldo'
                : `${collection.pendingOperations} ventas con saldo`
            }
            metaTone={collection.pendingAmount > 0 ? 'negative' : 'neutral'}
          />
        )}
        {branch.expensesThisMonth && (
          <KpiCard
            icon={Receipt}
            label="Gastos del mes"
            value={formatCurrency(branch.expensesThisMonth.amount)}
            meta="Sólo los de la sucursal, en pesos"
          />
        )}
        {branch.stockUnits !== null && (
          <KpiCard
            icon={Warehouse}
            label="Stock disponible"
            value={formatUnits(branch.stockUnits)}
            meta="Motos + autos"
          />
        )}
        {credit && (
          <KpiCard
            icon={Banknote}
            label="Cartera de créditos personales"
            value={formatCurrency(credit.financedAmount)}
            meta={`${formatCurrency(credit.overdueAmount)} en mora`}
            metaTone={credit.overdueAmount > 0 ? 'negative' : 'neutral'}
          />
        )}
        {branch.pendingApprovals !== null && (
          <KpiCard
            icon={ClipboardCheck}
            label="Esperan aprobación"
            value={String(branch.pendingApprovals)}
            meta="Ventas por debajo de lista"
          />
        )}
      </div>

      <div className="panel-grid">
        {branch.sellers && (
          <DashboardPanel title="Vendedores" description="Unidades computables del mes">
            <BranchSellers branch={branch} />
          </DashboardPanel>
        )}
        <TopModelsPanel
          title="Modelos más vendidos"
          description={`Top 5 por unidades, ${branch.branchName}`}
          models={branch.topModels}
        />
      </div>
    </>
  )
}

export function AdminDashboard({ home }: { home: AdminHome }) {
  const { greeting } = home
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
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LUMA MOTOS</p>
          <h1>Buen día, {greetingFirstName(greeting.name)}</h1>
          <p>
            {todayLongLabel(greeting.date)} ·{' '}
            {branch ? `Sucursal ${branch.branchName}` : 'Vista consolidada de la organización'}
          </p>
        </div>
        <span className="status-badge status-badge--success">
          <CheckCircle2 size={15} aria-hidden="true" />
          {greeting.organizationName}
        </span>
      </header>

      {branches.length > 0 && (
        <nav className="access-tabs" aria-label="Sucursal">
          <button
            aria-current={branch ? undefined : 'page'}
            className={`access-tab${branch ? '' : ' access-tab--active'}`}
            onClick={() => setSelected(ALL_BRANCHES)}
            type="button"
          >
            Todas las sucursales
          </button>
          {branches.map((item) => (
            <button
              aria-current={item.branchId === branch?.branchId ? 'page' : undefined}
              className={`access-tab${item.branchId === branch?.branchId ? ' access-tab--active' : ''}`}
              key={item.branchId}
              onClick={() => setSelected(item.branchId)}
              type="button"
            >
              {item.branchName}
            </button>
          ))}
        </nav>
      )}

      <PendingTasksPanel tasks={branch ? branchTasks : home.pendingTasks} mode="team" />

      {branch ? (
        <BranchDetail branch={branch} shareOfTotal={shareOfTotal} />
      ) : (
        <>
          {home.monthlySales && (
            <section className="hero-card">
              <div>
                <span className="hero-card__icon" aria-hidden="true">
                  <Banknote />
                </span>
                <p className="eyebrow">VENTAS DEL MES · TODAS LAS SUCURSALES</p>
                <h2>{formatCurrency(home.monthlySales.currentMonth.amount)}</h2>
                <p>
                  {formatUnits(home.monthlySales.currentMonth.units)} vendidas este mes, frente a{' '}
                  {formatUnits(home.monthlySales.previousMonth.units)} el mes anterior (
                  {formatMonthDelta(
                    home.monthlySales.currentMonth.units,
                    home.monthlySales.previousMonth.units,
                  )}
                  ).
                </p>
              </div>
              <div className="hero-card__meta">
                <small>Mes anterior</small>
                <strong>{formatCurrency(home.monthlySales.previousMonth.amount)}</strong>
                <small>Variación en monto</small>
                <strong>
                  {formatMonthDelta(
                    home.monthlySales.currentMonth.amount,
                    home.monthlySales.previousMonth.amount,
                  )}
                </strong>
              </div>
            </section>
          )}

          {branches.length > 0 && (
            <div className="panel-grid">
              {branches.map((item) => (
                <BranchCard branch={item} key={item.branchId} onOpen={() => setSelected(item.branchId)} />
              ))}
            </div>
          )}

          <div className="kpi-grid">
            {home.newClientsThisWeek !== null && (
              <KpiCard
                icon={UsersRound}
                label="Clientes nuevos esta semana"
                value={String(home.newClientsThisWeek)}
                meta="Todas las sucursales"
              />
            )}
            {home.stockUnitsTotal !== null && (
              <KpiCard
                icon={Warehouse}
                label="Stock total"
                value={formatUnits(home.stockUnitsTotal)}
                meta="Motos + autos, todas las sucursales"
              />
            )}
            {home.creditPortfolio && (
              <KpiCard
                icon={Banknote}
                label="Cartera de créditos personales"
                value={formatCurrency(home.creditPortfolio.financedAmount)}
                meta={`${formatCurrency(home.creditPortfolio.overdueAmount)} en mora`}
                metaTone={home.creditPortfolio.overdueAmount > 0 ? 'negative' : 'neutral'}
              />
            )}
            {home.pendingPurchases !== null && (
              <KpiCard
                icon={PackageSearch}
                label="Compras pendientes de recibir"
                value={formatUnits(home.pendingPurchases)}
              />
            )}
          </div>

          {branches.some((item) => item.sellers) && (
            <div className="panel-grid">
              {branches
                .filter((item) => item.sellers)
                .map((item) => (
                  <DashboardPanel
                    description="Unidades computables del mes"
                    key={item.branchId}
                    title={`Vendedores · ${item.branchName}`}
                  >
                    <BranchSellers branch={item} />
                  </DashboardPanel>
                ))}
            </div>
          )}

          <div className="panel-grid">
            {branches.length === 0 && home.salesByBranch && (
              <DashboardPanel
                title="Ventas por sucursal"
                description="Unidades y monto del mes, por sucursal"
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
            )}

            <TopModelsPanel
              title="Modelos más vendidos"
              description="Top 5 por unidades, toda la organización"
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
      )}
    </>
  )
}
