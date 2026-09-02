import {
  AlertTriangle,
  Banknote,
  Bike,
  CheckCircle2,
  HandCoins,
  ShieldQuestion,
  TrendingUp,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { DashboardPanel, KpiCard, PanelEmptyState, TopModelsPanel } from './components'
import { formatCurrency, formatMonthDelta, formatUnits, greetingFirstName, todayLongLabel } from './format'
import type { AttentionReason, SellerHome } from './types'

const REASON_LABEL: Record<AttentionReason, string> = {
  RECHAZADA: 'Rechazada, a corregir',
  PENDIENTE_APROBACION: 'Esperando aprobación',
  LISTA_PARA_FIRMAR: 'Lista para firmar',
  RESERVA_POR_VENCER: 'Reserva por vencer',
}

const REASON_TONE: Record<AttentionReason, string> = {
  RECHAZADA: 'status-badge--danger',
  PENDIENTE_APROBACION: 'status-badge--warning',
  LISTA_PARA_FIRMAR: 'status-badge--info',
  RESERVA_POR_VENCER: 'status-badge--warning',
}

export function SellerDashboard({ home }: { home: SellerHome }) {
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

      {home.attentionCount !== null && home.attentionCount > 0 && (
        <section className="alert-strip" role="alert">
          <div className="alert-strip__text">
            <span className="alert-strip__icon" aria-hidden="true">
              <AlertTriangle size={18} />
            </span>
            <span>
              Tenés <strong>{home.attentionCount}</strong>{' '}
              {home.attentionCount === 1 ? 'operación que necesita' : 'operaciones que necesitan'}{' '}
              tu atención.
            </span>
          </div>
          <Link to="/motos/mis-operaciones" className="button button--secondary button--compact">
            Ir a mis operaciones
          </Link>
        </section>
      )}

      <div className="kpi-grid">
        {home.monthlySales && (
          <KpiCard
            icon={TrendingUp}
            label="Tus ventas del mes"
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
        {home.clientsThisWeek !== null && (
          <KpiCard
            icon={UsersRound}
            label="Clientes cargados esta semana"
            value={String(home.clientsThisWeek)}
          />
        )}
      </div>

      <div className="panel-grid">
        {home.myOperations && (
          <DashboardPanel
            title="Mis operaciones"
            description="Operaciones propias que necesitan una acción"
            action={
              <Link to="/motos/mis-operaciones" className="button button--secondary button--compact">
                Ver todas
              </Link>
            }
          >
            {home.myOperations.length === 0 ? (
              <PanelEmptyState>No tenés operaciones pendientes de acción.</PanelEmptyState>
            ) : (
              <div className="financial-table-wrap">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Operación</th>
                      <th>Cliente</th>
                      <th>Monto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {home.myOperations.map((operation) => (
                      <tr key={operation.operationId}>
                        <td>{operation.operationNumber}</td>
                        <td>{operation.clientName}</td>
                        <td>{formatCurrency(operation.amount)}</td>
                        <td>
                          <span className={`status-badge ${REASON_TONE[operation.reason]}`}>
                            {REASON_LABEL[operation.reason]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardPanel>
        )}

        <TopModelsPanel
          title="Tus modelos más vendidos"
          description="Top 5 por unidades, ranking personal"
          models={home.topModels}
        />

        {(home.quickLinks.bcraCheck || home.quickLinks.catalog || home.quickLinks.newClient) && (
          <DashboardPanel title="Accesos rápidos">
            <div className="quick-links">
              {home.quickLinks.bcraCheck && (
                <Link to={home.quickLinks.bcraCheck} className="quick-link-card">
                  <span>
                    <ShieldQuestion size={18} />
                  </span>
                  Consulta BCRA
                </Link>
              )}
              {home.quickLinks.catalog && (
                <Link to={home.quickLinks.catalog} className="quick-link-card">
                  <span>
                    <Bike size={18} />
                  </span>
                  Catálogo
                </Link>
              )}
              {home.quickLinks.newClient && (
                <Link to={home.quickLinks.newClient} className="quick-link-card">
                  <span>
                    <UserPlus size={18} />
                  </span>
                  Nuevo cliente
                </Link>
              )}
            </div>
          </DashboardPanel>
        )}
      </div>
    </>
  )
}
