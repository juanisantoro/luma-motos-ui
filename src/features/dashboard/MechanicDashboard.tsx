import { CheckCircle2, ClipboardList, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDay, formatKm, orderNumber, statusLabels, statusTones } from '../service/format'
import { DashboardPanel, KpiCard, PanelEmptyState } from './components'
import { greetingFirstName, todayLongLabel } from './format'
import type { MechanicHome } from './types'

// Inicio del mecánico: las motos que esperan service en su taller, la más
// vieja primero, para que sepa por cuál seguir.
export function MechanicDashboard({ home }: { home: MechanicHome }) {
  const { greeting, workshop } = home
  const pending = workshop.waiting + workshop.inProgress

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LUMA MOTOS · TALLER</p>
          <h1>Buen día, {greetingFirstName(greeting.name)}</h1>
          <p>
            {todayLongLabel(greeting.date)} · {greeting.branchName ?? 'Sin sucursal asignada'}
          </p>
        </div>
        <Link className="button button--primary" to="/service">
          <Wrench size={17} />
          Ir a Service
        </Link>
      </header>

      <div className="kpi-grid">
        <KpiCard icon={ClipboardList} label="Motos esperando service" value={String(workshop.waiting)} />
        <KpiCard icon={Wrench} label="En el taller (empezadas)" value={String(workshop.inProgress)} />
        <KpiCard icon={CheckCircle2} label="Terminadas hoy" value={String(workshop.finishedToday)} />
      </div>

      <DashboardPanel
        title="Motos para hacer"
        description={
          pending > 20
            ? `Las 20 más viejas de ${pending}: el resto está en Service.`
            : 'La más vieja primero. Abrí una para cargar lo que le hiciste y firmarla.'
        }
      >
        {workshop.orders.length === 0 ? (
          <PanelEmptyState>No hay motos esperando service. Cuando la administración reciba una, aparece acá.</PanelEmptyState>
        ) : (
          <div className="financial-table-wrap">
            <table className="financial-table service-table">
              <thead>
                <tr>
                  <th>N.º</th>
                  <th>Recibida</th>
                  <th>Moto</th>
                  <th>Service</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {workshop.orders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{orderNumber(order.number)}</strong></td>
                    <td>{formatDay(order.receptionDate)}</td>
                    <td>
                      <strong>{order.vehicle.plate ?? order.vehicle.chassis ?? '—'}</strong>
                      <small>{[order.vehicle.model, formatKm(order.currentKm)].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td>
                      {order.serviceType.name}
                      {order.receptionNotes && <small>{order.receptionNotes}</small>}
                    </td>
                    <td>
                      <span className={`status-badge ${statusTones[order.status]}`}>{statusLabels[order.status]}</span>
                    </td>
                    <td className="financial-actions">
                      <Link className="button button--secondary" to={`/service/${order.id}`}>
                        {order.status === 'EN_TALLER' ? 'Seguir' : 'Empezar'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>
    </>
  )
}
