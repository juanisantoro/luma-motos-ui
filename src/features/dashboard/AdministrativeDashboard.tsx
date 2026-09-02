import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  FileWarning,
  Receipt,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AlertStrip, DashboardPanel, KpiCard, PanelEmptyState, TopModelsPanel } from './components'
import { formatCurrency, formatDateTime, greetingFirstName, todayLongLabel } from './format'
import type { AdministrativeHome } from './types'

const RESULT_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
}

const RESULT_TONE: Record<string, string> = {
  PENDIENTE: 'status-badge--warning',
  APROBADA: 'status-badge--success',
  RECHAZADA: 'status-badge--danger',
}

export function AdministrativeDashboard({ home }: { home: AdministrativeHome }) {
  const { greeting } = home
  const alerts = home.managementAlerts

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

      {home.dueTodayAlert && home.dueTodayAlert.clientCount > 0 && (
        <AlertStrip icon={CalendarClock} cta={{ label: 'Ir a cobranza', to: '/creditos/cobranza' }}>
          <strong>{formatCurrency(home.dueTodayAlert.amount)}</strong> a cobrar hoy de{' '}
          <strong>{home.dueTodayAlert.clientCount}</strong>{' '}
          {home.dueTodayAlert.clientCount === 1 ? 'cliente' : 'clientes'} con cuota vencida hoy.
        </AlertStrip>
      )}

      <div className="kpi-grid">
        {home.cashBalanceToday !== null && (
          <KpiCard
            icon={Banknote}
            label="Saldo de caja hoy"
            value={formatCurrency(home.cashBalanceToday)}
          />
        )}
        {home.dueThisWeek && (
          <KpiCard
            icon={CalendarClock}
            label="Cuotas a cobrar esta semana"
            value={formatCurrency(home.dueThisWeek.amount)}
            meta={`${home.dueThisWeek.count} cuota${home.dueThisWeek.count === 1 ? '' : 's'}`}
          />
        )}
        {home.unconfirmedVehiclePayments && (
          <KpiCard
            icon={FileWarning}
            label="Pagos de vehículo sin confirmar"
            value={String(home.unconfirmedVehiclePayments.count)}
            meta={
              home.unconfirmedVehiclePayments.staleCount > 0
                ? `${home.unconfirmedVehiclePayments.staleCount} con más de 5 días`
                : undefined
            }
            metaTone={home.unconfirmedVehiclePayments.staleCount > 0 ? 'negative' : 'neutral'}
          />
        )}
        {home.payableExpensesThisWeek && (
          <KpiCard
            icon={Receipt}
            label="Gastos a pagar esta semana"
            value={formatCurrency(home.payableExpensesThisWeek.amount)}
            meta={`${home.payableExpensesThisWeek.count} gasto${home.payableExpensesThisWeek.count === 1 ? '' : 's'}`}
          />
        )}
      </div>

      <div className="panel-grid">
        {home.collectionsToday && (
          <DashboardPanel
            title="Cobranza de hoy"
            description="Cuotas de crédito personal que vencen hoy"
            action={
              <Link to="/creditos/cobranza" className="button button--secondary button--compact">
                Ir a cobranza
              </Link>
            }
          >
            {home.collectionsToday.length === 0 ? (
              <PanelEmptyState>No hay cuotas venciendo hoy.</PanelEmptyState>
            ) : (
              <div className="financial-table-wrap">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Cuota</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {home.collectionsToday.map((row) => (
                      <tr key={row.id}>
                        <td>{row.cliente_nombre}</td>
                        <td>Nº {row.numero_cuota}</td>
                        <td>{formatCurrency(Number(row.monto) - Number(row.monto_pagado))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardPanel>
        )}

        {home.recentInquiries && (
          <DashboardPanel
            title="Consultas crediticias recientes"
            description="Últimas consultas realizadas en tu sucursal"
          >
            {home.recentInquiries.length === 0 ? (
              <PanelEmptyState>No hay consultas recientes.</PanelEmptyState>
            ) : (
              <div className="financial-table-wrap">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Entidad</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {home.recentInquiries.map((inquiry) => (
                      <tr key={inquiry.id}>
                        <td>
                          {inquiry.clientName}
                          <small>{formatDateTime(inquiry.consultedAt)}</small>
                        </td>
                        <td>{inquiry.institutionName}</td>
                        <td>
                          <span className={`status-badge ${RESULT_TONE[inquiry.result] ?? ''}`}>
                            {RESULT_LABEL[inquiry.result] ?? inquiry.result}
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

        {alerts && (
          <DashboardPanel title="Alertas de gestión" description="Puntos a resolver en tu sucursal">
            {!alerts.overdueInstallments && !alerts.staleVehiclePayments && !alerts.zeroStockModels ? (
              <PanelEmptyState>No hay alertas activas.</PanelEmptyState>
            ) : (
              <ul className="ranking-list">
                {alerts.overdueInstallments && alerts.overdueInstallments.count > 0 && (
                  <li className="ranking-list__item">
                    <span className="ranking-list__rank">
                      <AlertTriangle size={13} />
                    </span>
                    <span className="ranking-list__name">
                      Cuotas de crédito personal con más de 30 días de mora
                    </span>
                    <span className="ranking-list__stat">
                      {alerts.overdueInstallments.count}
                      <small>{formatCurrency(alerts.overdueInstallments.amount)}</small>
                    </span>
                  </li>
                )}
                {alerts.staleVehiclePayments && alerts.staleVehiclePayments.count > 0 && (
                  <li className="ranking-list__item">
                    <span className="ranking-list__rank">
                      <AlertTriangle size={13} />
                    </span>
                    <span className="ranking-list__name">
                      Pagos de vehículo sin confirmar hace más de 5 días
                    </span>
                    <span className="ranking-list__stat">
                      {alerts.staleVehiclePayments.count}
                    </span>
                  </li>
                )}
                {alerts.zeroStockModels && alerts.zeroStockModels.total > 0 && (
                  <li className="ranking-list__item">
                    <span className="ranking-list__rank">
                      <AlertTriangle size={13} />
                    </span>
                    <span className="ranking-list__name">
                      Modelos vendibles sin stock en tu sucursal
                    </span>
                    <span className="ranking-list__stat">{alerts.zeroStockModels.total}</span>
                  </li>
                )}
                {alerts.overdueInstallments?.count === 0 &&
                  alerts.staleVehiclePayments?.count === 0 &&
                  alerts.zeroStockModels?.total === 0 && (
                    <PanelEmptyState>No hay alertas activas.</PanelEmptyState>
                  )}
              </ul>
            )}
          </DashboardPanel>
        )}

        <TopModelsPanel
          title="Modelos más vendidos"
          description="Top 5 por unidades, tu sucursal"
          models={home.topModels}
        />
      </div>

      {home.dueTodayAlert === null &&
        home.cashBalanceToday === null &&
        home.dueThisWeek === null &&
        home.unconfirmedVehiclePayments === null &&
        home.payableExpensesThisWeek === null &&
        !home.collectionsToday &&
        !home.recentInquiries &&
        !alerts &&
        !home.topModels && (
          <DashboardPanel title="Sin secciones disponibles">
            <PanelEmptyState>
              <ShieldCheck size={16} aria-hidden="true" /> Tu rol no tiene permisos asignados para
              ver información de este panel todavía.
            </PanelEmptyState>
          </DashboardPanel>
        )}
    </>
  )
}
