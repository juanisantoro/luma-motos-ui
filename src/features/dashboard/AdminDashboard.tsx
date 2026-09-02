import {
  Banknote,
  CheckCircle2,
  PackageSearch,
  UsersRound,
  Warehouse,
} from 'lucide-react'
import { DashboardPanel, KpiCard, PanelEmptyState, RankingList, TopModelsPanel } from './components'
import { formatCurrency, formatMonthDelta, formatUnits, greetingFirstName, todayLongLabel } from './format'
import type { AdminHome } from './types'

export function AdminDashboard({ home }: { home: AdminHome }) {
  const { greeting } = home

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LUMA MOTOS</p>
          <h1>Buen día, {greetingFirstName(greeting.name)}</h1>
          <p>
            {todayLongLabel(greeting.date)} · Vista consolidada de la organización
          </p>
        </div>
        <span className="status-badge status-badge--success">
          <CheckCircle2 size={15} aria-hidden="true" />
          {greeting.organizationName}
        </span>
      </header>

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

      <div className="panel-grid">
        {home.salesByBranch && (
          <DashboardPanel
            title="Ventas por sucursal"
            description="Unidades y monto del mes, por sucursal"
          >
            {home.salesByBranch.length === 0 ? (
              <PanelEmptyState>No hay sucursales activas.</PanelEmptyState>
            ) : (
              <RankingList
                items={home.salesByBranch.map((branch) => ({
                  key: branch.branchId,
                  name: branch.branchName,
                  stat: formatUnits(branch.units),
                  statSubtitle: formatCurrency(branch.amount),
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
  )
}
