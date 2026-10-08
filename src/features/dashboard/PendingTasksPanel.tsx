import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  FileWarning,
  HandCoins,
  Receipt,
  TriangleAlert,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { DashboardPanel, PanelEmptyState } from './components'
import { formatCurrency } from './format'
import type { PendingTaskKey, PendingTasks } from './types'

// Texto de cada tarea, la pantalla donde se resuelve y su ícono. `urgent`:
// lo que ya está vencido se destaca en rojo.
const TASKS: Record<
  PendingTaskKey,
  { label: string; to: string; icon: LucideIcon; urgent?: boolean }
> = {
  INSTALLMENTS_DUE_TODAY: {
    label: 'Cuotas que vencen hoy',
    to: '/creditos/cobranza',
    icon: CalendarClock,
  },
  INSTALLMENTS_OVERDUE: {
    label: 'Cuotas vencidas sin cobrar',
    to: '/creditos/cobranza',
    icon: TriangleAlert, urgent: true,
  },
  INCOMES_PENDING_COLLECTION: {
    label: 'Ingresos pendientes de cobro',
    to: '/motos/ingresos',
    icon: HandCoins,
  },
  CASH_PENDING_HANDOVER: {
    label: 'Efectivo cobrado sin rendir',
    to: '/motos/ingresos',
    icon: Banknote,
  },
  VEHICLE_PAYMENTS_UNCONFIRMED: {
    label: 'Gastos de motos y autos sin pagar',
    to: '/motos/pagos-vehiculo',
    icon: Truck,
  },
  LICENSING_OVERDUE: {
    label: 'Patentes vencidas sin cargar',
    to: '/motos/operaciones?patente=DEMORADAS',
    icon: FileWarning, urgent: true,
  },
  LICENSING_PENDING_COLLECTION: {
    label: 'Patentes recibidas con pago pendiente',
    to: '/motos/operaciones?patente=COBRO_PENDIENTE',
    icon: Wallet,
  },
  EXPENSES_PENDING_PAYMENT: {
    label: 'Gastos pendientes de pago',
    to: '/gastos',
    icon: Receipt,
  },
}

function TotalBadge({ total }: { total: number }) {
  return (
    <span
      className={`status-badge ${total > 0 ? 'status-badge--warning' : 'status-badge--success'}`}
    >
      <ClipboardCheck size={15} aria-hidden="true" />
      {total === 0 ? 'Al día' : `${total} pendiente${total === 1 ? '' : 's'}`}
    </span>
  )
}

/**
 * Tareas pendientes de administración. `own`: la lista de la propia sucursal
 * con acceso a cada pantalla (administrativa). `team`: el mismo conteo
 * en tarjetas, con el reparto por sucursal (administrador y gerente). `links`
 * agrega en cada tarjeta el acceso a la pantalla donde se resuelve.
 */
export function PendingTasksPanel({
  tasks,
  mode,
  links = false,
}: {
  tasks: PendingTasks | null | undefined
  mode: 'own' | 'team'
  links?: boolean
}) {
  if (!tasks) return null
  const { branches } = tasks
  const total = branches.reduce((sum, branch) => sum + branch.total, 0)
  // Las tareas que le llegaron a alguna sucursal, en el orden del servidor.
  const keys = [...new Set(branches.flatMap((branch) => branch.tasks.map((task) => task.key)))]
  const find = (branchId: string, key: PendingTaskKey) =>
    branches.find((branch) => branch.branchId === branchId)?.tasks.find((task) => task.key === key)

  if (mode === 'own') {
    const names = branches.map((branch) => branch.branchName).join(' · ')
    const rows = keys.map((key) => ({
      key,
      count: branches.reduce((sum, branch) => sum + (find(branch.branchId, key)?.count ?? 0), 0),
      amount: branches.reduce<number | null>((sum, branch) => {
        const amount = find(branch.branchId, key)?.amount
        return amount == null ? sum : (sum ?? 0) + amount
      }, null),
    }))
    const open = rows.filter((row) => row.count > 0)
    return (
      <div className="pending-tasks">
        <DashboardPanel
          title="Tus tareas pendientes"
          description={names || undefined}
          action={<TotalBadge total={total} />}
        >
          {open.length === 0 ? (
            <PanelEmptyState>No tenés tareas pendientes. Estás al día.</PanelEmptyState>
          ) : (
            <ul className="ranking-list" aria-label="Tus tareas pendientes">
              {open.map((row) => (
                <li className="ranking-list__item" key={row.key}>
                  <span className="ranking-list__rank">{row.count}</span>
                  <span className="ranking-list__name">
                    {TASKS[row.key].label}
                    {row.amount !== null && row.amount > 0 && (
                      <small>{formatCurrency(row.amount)}</small>
                    )}
                  </span>
                  <span className="ranking-list__stat">
                    <Link to={TASKS[row.key].to}>Resolver</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      </div>
    )
  }

  const several = branches.length > 1
  const rows = keys.map((key) => {
    const perBranch = branches.map((branch) => ({
      branchId: branch.branchId,
      branchName: branch.branchName,
      count: find(branch.branchId, key)?.count ?? 0,
    }))
    return {
      key,
      perBranch,
      count: perBranch.reduce((sum, branch) => sum + branch.count, 0),
      amount: branches.reduce(
        (sum, branch) => sum + (find(branch.branchId, key)?.amount ?? 0),
        0,
      ),
    }
  })
  const open = rows.filter((row) => row.count > 0)
  const clear = rows.filter((row) => row.count === 0)
  return (
    <div className="pending-tasks">
      <DashboardPanel
        title="Tareas pendientes de administración"
        description={
          several
            ? 'Lo que tienen por resolver las administrativas, por sucursal'
            : 'Lo que tiene por resolver la administración de la sucursal'
        }
        action={<TotalBadge total={total} />}
      >
        {branches.length === 0 || keys.length === 0 ? (
          <PanelEmptyState>No hay sucursales para mostrar.</PanelEmptyState>
        ) : open.length === 0 ? (
          <PanelEmptyState>No hay tareas pendientes. La administración está al día.</PanelEmptyState>
        ) : (
          <>
            {several && (
              <ul className="task-branches" aria-label="Pendientes por sucursal">
                {branches.map((branch) => (
                  <li key={branch.branchId}>
                    <strong>{branch.total}</strong> {branch.branchName}
                  </li>
                ))}
              </ul>
            )}
            <ul className="task-tiles" aria-label="Tareas pendientes de administración">
              {open.map((row) => {
                const { label, to, icon: Icon, urgent } = TASKS[row.key]
                return (
                  <li className={`task-tile${urgent ? ' task-tile--urgent' : ''}`} key={row.key}>
                    <div className="task-tile__head">
                      <span className="task-tile__icon">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="task-tile__count">{row.count}</span>
                    </div>
                    <p className="task-tile__label">{label}</p>
                    {row.amount > 0 && (
                      <p className="task-tile__amount">{formatCurrency(row.amount)}</p>
                    )}
                    {several && (
                      <dl className="task-tile__split">
                        {row.perBranch.map((branch) => (
                          <div key={branch.branchId}>
                            <dt>{branch.branchName}</dt>
                            <dd>
                              <span className="task-tile__bar" aria-hidden="true">
                                <span style={{ width: `${(branch.count / row.count) * 100}%` }} />
                              </span>
                              <b>{branch.count}</b>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {links && (
                      <Link className="task-tile__link" to={to} aria-label={`Ver ${label}`}>
                        Ver <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
            {clear.length > 0 && (
              <p className="task-clear">
                <CircleCheck size={15} aria-hidden="true" />
                <span>Al día: {clear.map((row) => TASKS[row.key].label).join(' · ')}</span>
              </p>
            )}
          </>
        )}
      </DashboardPanel>
    </div>
  )
}
