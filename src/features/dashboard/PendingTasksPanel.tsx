import {
  ArrowRight,
  Banknote,
  BellRing,
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  FileWarning,
  HandCoins,
  Receipt,
  TriangleAlert,
  Truck,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  HOME_BRANCH_PARAM,
  HOME_ORIGIN_PARAM,
  homeLink,
} from '../../shared/homeFilters'
import { DashboardPanel, PanelEmptyState } from './components'
import { formatCurrency } from './format'
import type { PendingTaskKey, PendingTasks } from './types'

// Texto de cada tarea, la pantalla donde se resuelve (con los filtros que
// muestran exactamente lo que cuenta la tarjeta) y su ícono. `urgent`: lo
// que ya está vencido se destaca en rojo.
const TASKS: Record<
  PendingTaskKey,
  { label: string; to: string; icon: LucideIcon; urgent?: boolean }
> = {
  INSTALLMENTS_DUE_TODAY: {
    label: 'Cuotas que vencen hoy',
    to: '/creditos/cobranza?vence=hoy',
    icon: CalendarClock,
  },
  INSTALLMENTS_OVERDUE: {
    label: 'Cuotas vencidas sin cobrar',
    to: '/creditos/cobranza?estado=VENCIDA',
    icon: TriangleAlert, urgent: true,
  },
  INCOMES_PENDING_COLLECTION: {
    label: 'Ingresos pendientes de cobro',
    to: '/motos/ingresos?pendientes=1',
    icon: HandCoins,
  },
  CASH_PENDING_HANDOVER: {
    label: 'Efectivo cobrado sin rendir',
    to: '/motos/ingresos?rendicion=PENDIENTE_RENDICION',
    icon: Banknote,
  },
  VEHICLE_PAYMENTS_UNCONFIRMED: {
    label: 'Gastos de motos y autos sin pagar',
    to: '/motos/pagos-vehiculo?estado=PENDIENTE',
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
    to: '/gastos?pendientes=1',
    icon: Receipt,
  },
  SERVICE_READY_TO_DELIVER: {
    label: 'Service terminados para entregar',
    to: '/service?tab=entregar',
    icon: Wrench,
  },
  SERVICE_REMINDERS_DUE: {
    label: 'Clientes a contactar por el service',
    to: '/service/avisos',
    icon: BellRing,
  },
}

// Link de la tarjeta: la pantalla con sus filtros, la sucursal (si se está
// mirando una sola: el tab abierto o la única del usuario) y el texto de la
// tarjeta para que la pantalla muestre qué se fue a ver.
function taskLink(
  key: PendingTaskKey,
  branch: { branchId: string; branchName: string } | null,
) {
  const { label, to } = TASKS[key]
  return homeLink(to, {
    [HOME_BRANCH_PARAM]: branch?.branchId,
    [HOME_ORIGIN_PARAM]: branch ? `${label} · ${branch.branchName}` : label,
  })
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

  const singleBranch = branches.length === 1 ? (branches[0] ?? null) : null

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
                    <Link to={taskLink(row.key, singleBranch)}>Resolver</Link>
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
            <ul className="task-rows" aria-label="Tareas pendientes de administración">
              {open.map((row) => {
                const { label, icon: Icon, urgent } = TASKS[row.key]
                return (
                  <li className={`task-row${urgent ? ' task-row--urgent' : ''}`} key={row.key}>
                    <span className="task-row__count">{row.count}</span>
                    <div className="task-row__body">
                      <p className="task-row__label">
                        <Icon size={15} aria-hidden="true" />
                        {label}
                      </p>
                      {(row.amount > 0 || several) && (
                        <div className="task-row__meta">
                          {row.amount > 0 && (
                            <span className="task-row__amount">{formatCurrency(row.amount)}</span>
                          )}
                          {several && (
                            <dl className="task-row__split">
                              {row.perBranch.map((branch) => (
                                <div key={branch.branchId}>
                                  <dt>{branch.branchName}</dt>
                                  <dd>
                                    <b>{branch.count}</b>
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </div>
                      )}
                    </div>
                    {links && (
                      <Link
                        className="task-row__link"
                        to={taskLink(row.key, singleBranch)}
                        aria-label={`Ver ${label}`}
                      >
                        {urgent ? 'Urgente' : 'Ver'} <ArrowRight size={14} aria-hidden="true" />
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
