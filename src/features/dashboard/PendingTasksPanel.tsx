import { ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DashboardPanel, PanelEmptyState } from './components'
import { formatCurrency } from './format'
import type { PendingTaskKey, PendingTasks } from './types'

// Texto de cada tarea y la pantalla donde se resuelve.
const TASKS: Record<PendingTaskKey, { label: string; to: string }> = {
  INSTALLMENTS_DUE_TODAY: {
    label: 'Cuotas que vencen hoy',
    to: '/creditos/cobranza',
  },
  INSTALLMENTS_OVERDUE: {
    label: 'Cuotas vencidas sin cobrar',
    to: '/creditos/cobranza',
  },
  INCOMES_PENDING_COLLECTION: {
    label: 'Ingresos pendientes de cobro',
    to: '/motos/ingresos',
  },
  CASH_PENDING_HANDOVER: {
    label: 'Efectivo cobrado sin rendir',
    to: '/motos/ingresos',
  },
  VEHICLE_PAYMENTS_UNCONFIRMED: {
    label: 'Pagos de vehículo sin confirmar',
    to: '/motos/pagos-vehiculo',
  },
  LICENSING_OVERDUE: {
    label: 'Patentes vencidas sin cargar',
    to: '/motos/operaciones?patente=DEMORADAS',
  },
  LICENSING_PENDING_COLLECTION: {
    label: 'Patentes recibidas con pago pendiente',
    to: '/motos/operaciones?patente=COBRO_PENDIENTE',
  },
  EXPENSES_PENDING_PAYMENT: {
    label: 'Gastos pendientes de pago',
    to: '/gastos',
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
 * discriminado por sucursal (administrador y gerente).
 */
export function PendingTasksPanel({
  tasks,
  mode,
}: {
  tasks: PendingTasks | null | undefined
  mode: 'own' | 'team'
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
        ) : (
          <div className="financial-table-wrap">
            <table className="financial-table pending-tasks-table">
              <thead>
                <tr>
                  <th>Tarea</th>
                  {branches.map((branch) => (
                    <th className="pending-tasks-table__count" key={branch.branchId} scope="col">
                      {branch.branchName}
                    </th>
                  ))}
                  {several && (
                    <th className="pending-tasks-table__count" scope="col">
                      Total
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key}>
                    <th scope="row">{TASKS[key].label}</th>
                    {branches.map((branch) => {
                      const task = find(branch.branchId, key)
                      const count = task?.count ?? 0
                      return (
                        <td className="pending-tasks-table__count" key={branch.branchId}>
                          {count === 0 ? (
                            <span className="pending-tasks-table__zero">0</span>
                          ) : (
                            <strong>{count}</strong>
                          )}
                          {task?.amount != null && task.amount > 0 && (
                            <small>{formatCurrency(task.amount)}</small>
                          )}
                        </td>
                      )
                    })}
                    {several && (
                      <td className="pending-tasks-table__count">
                        <strong>
                          {branches.reduce(
                            (sum, branch) => sum + (find(branch.branchId, key)?.count ?? 0),
                            0,
                          )}
                        </strong>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total de pendientes</th>
                  {branches.map((branch) => (
                    <td className="pending-tasks-table__count" key={branch.branchId}>
                      <strong>{branch.total}</strong>
                    </td>
                  ))}
                  {several && (
                    <td className="pending-tasks-table__count">
                      <strong>{total}</strong>
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DashboardPanel>
    </div>
  )
}
