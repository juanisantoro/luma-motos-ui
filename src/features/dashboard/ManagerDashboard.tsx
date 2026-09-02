import { AlertTriangle, Banknote, CheckCircle2, HandCoins, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AlertStrip, DashboardPanel, KpiCard, PanelEmptyState, RankingList, TopModelsPanel } from './components'
import { formatCurrency, formatMonthDelta, formatUnits, greetingFirstName, todayLongLabel } from './format'
import type { ManagerHome } from './types'

export function ManagerDashboard({ home }: { home: ManagerHome }) {
  const { greeting } = home

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LUMA MOTOS</p>
          <h1>Buen día, {greetingFirstName(greeting.name)}</h1>
          <p>
            {todayLongLabel(greeting.date)} · {greeting.branchName ?? 'Sin sucursal asignada'}
          </p>
        </div>
        <span className="status-badge status-badge--success">
          <CheckCircle2 size={15} aria-hidden="true" />
          {greeting.branchName ?? '—'}
        </span>
      </header>

      {home.pendingApprovalsCount !== null && home.pendingApprovalsCount > 0 && (
        <AlertStrip
          icon={AlertTriangle}
          cta={{ label: 'Ir a aprobaciones', to: '/motos/aprobaciones' }}
        >
          <strong>{home.pendingApprovalsCount}</strong>{' '}
          {home.pendingApprovalsCount === 1
            ? 'operación de tu sucursal espera tu aprobación.'
            : 'operaciones de tu sucursal esperan tu aprobación.'}
        </AlertStrip>
      )}

      <div className="kpi-grid">
        {home.monthlySales && (
          <KpiCard
            icon={TrendingUp}
            label="Ventas del mes"
            value={formatUnits(home.monthlySales.currentMonth.units)}
            meta={`${formatMonthDelta(home.monthlySales.currentMonth.units, home.monthlySales.previousMonth.units)} vs. mes anterior`}
            metaTone={
              home.monthlySales.currentMonth.units >= home.monthlySales.previousMonth.units
                ? 'positive'
                : 'negative'
            }
          />
        )}
        {home.monthlySales && (
          <KpiCard
            icon={Banknote}
            label="Monto vendido este mes"
            value={formatCurrency(home.monthlySales.currentMonth.amount)}
          />
        )}
        {home.ownCommission && (
          <KpiCard
            icon={HandCoins}
            label="Tu comisión estimada"
            value={formatCurrency(home.ownCommission.amount)}
            meta="Período actual"
          />
        )}
        {home.creditOverdue && (
          <KpiCard
            icon={AlertTriangle}
            label="Mora en créditos personales"
            value={formatCurrency(home.creditOverdue.amount)}
            meta={`${home.creditOverdue.installments} cuota${home.creditOverdue.installments === 1 ? '' : 's'} vencida${home.creditOverdue.installments === 1 ? '' : 's'}`}
            metaTone={home.creditOverdue.amount > 0 ? 'negative' : 'neutral'}
          />
        )}
      </div>

      <div className="panel-grid">
        {home.approvals && (
          <DashboardPanel
            title="Aprobaciones pendientes"
            description="Operaciones de tu sucursal esperando tu decisión"
            action={
              <Link to="/motos/aprobaciones" className="button button--secondary button--compact">
                Ir a aprobaciones
              </Link>
            }
          >
            {home.approvals.length === 0 ? (
              <PanelEmptyState>No hay operaciones pendientes de aprobación.</PanelEmptyState>
            ) : (
              <div className="financial-table-wrap">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Operación</th>
                      <th>Vendedor</th>
                      <th>Cliente</th>
                      <th>Diferencia vs. lista</th>
                    </tr>
                  </thead>
                  <tbody>
                    {home.approvals.map((approval) => (
                      <tr key={approval.operationId}>
                        <td>{approval.operationNumber}</td>
                        <td>{approval.sellerName}</td>
                        <td>{approval.clientName}</td>
                        <td>
                          {approval.differencePercent === null
                            ? '—'
                            : `${approval.differencePercent > 0 ? '+' : ''}${approval.differencePercent}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardPanel>
        )}

        {home.teamRanking && (
          <DashboardPanel
            title="Ranking del equipo"
            description="Vendedores de tu sucursal, por unidades del mes"
          >
            {home.teamRanking.length === 0 ? (
              <PanelEmptyState>Todavía no hay ventas computables este mes.</PanelEmptyState>
            ) : (
              <RankingList
                items={home.teamRanking.map((seller) => ({
                  key: seller.sellerId,
                  name: seller.sellerName,
                  stat: formatUnits(seller.units),
                  statSubtitle: formatCurrency(seller.amount),
                }))}
              />
            )}
          </DashboardPanel>
        )}

        <TopModelsPanel
          title="Modelos más vendidos"
          description="Top 5 por unidades, tu sucursal"
          models={home.topModels}
        />
      </div>
    </>
  )
}
