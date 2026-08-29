import { Unlock } from 'lucide-react'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import {
  formatMoney,
  formatOperationDate,
  operationStatusClass,
  operationStatusLabels,
  vehicleLabel,
} from './presentation'
import type { SalesOperation } from './types'

export function SalesOperationList({
  operations,
  canRelease = false,
  busyId,
  onRelease,
}: {
  operations: SalesOperation[]
  canRelease?: boolean
  busyId?: string | null
  onRelease?: (operation: SalesOperation) => void
}) {
  const cards = useMediaQuery('(max-width: 768px)')

  if (cards) {
    return (
      <div className="sales-card-list">
        {operations.map((operation) => (
          <article className="sales-card" key={operation.id}>
            <div className="sales-card__heading">
              <div>
                <span>Operación #{operation.number}</span>
                <strong>{operation.client.fullName}</strong>
              </div>
              <span
                className={`status-badge ${operationStatusClass(operation.status)}`}
              >
                {operationStatusLabels[operation.status]}
              </span>
            </div>
            <dl>
              <div>
                <dt>Vehículo</dt>
                <dd>{vehicleLabel(operation)}</dd>
              </div>
              <div>
                <dt>Unidad</dt>
                <dd>
                  {operation.vehicle.unit?.vin ??
                    (operation.reservation
                      ? 'Reserva sin unidad visible'
                      : 'Sin reserva física')}
                </dd>
              </div>
              <div>
                <dt>Precio</dt>
                <dd>
                  {formatMoney(operation.agreedPrice, operation.currency)}
                </dd>
              </div>
              <div>
                <dt>Vendedor</dt>
                <dd>{operation.seller?.fullName ?? 'Sin asignar'}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{formatOperationDate(operation.operationDate)}</dd>
              </div>
            </dl>
            {operation.approval?.reason && (
              <p className="sales-card__note">
                <strong>Observación:</strong> {operation.approval.reason}
              </p>
            )}
            {canRelease &&
              operation.reservation?.status === 'ACTIVO' &&
              onRelease && (
                <button
                  className="button button--danger-quiet sales-card__action"
                  disabled={busyId === operation.id}
                  onClick={() => onRelease(operation)}
                  type="button"
                >
                  <Unlock size={16} />
                  Liberar reserva
                </button>
              )}
          </article>
        ))}
      </div>
    )
  }

  return (
    <div className="sales-table-wrap">
      <table className="sales-table">
        <thead>
          <tr>
            <th>Operación</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Vehículo / unidad</th>
            <th>Sucursal</th>
            <th>Precio</th>
            <th>Vendedor</th>
            <th>Estado</th>
            {canRelease && <th><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id}>
              <td><strong>#{operation.number}</strong></td>
              <td>{formatOperationDate(operation.operationDate)}</td>
              <td>{operation.client.fullName}</td>
              <td>
                <strong>{vehicleLabel(operation)}</strong>
                <small>
                  {operation.vehicle.unit?.vin ?? 'Sin unidad física'}
                </small>
              </td>
              {canRelease && (
                <td>
                  {operation.reservation?.status === 'ACTIVO' && onRelease && (
                    <button
                      className="button button--danger-quiet"
                      disabled={busyId === operation.id}
                      onClick={() => onRelease(operation)}
                      type="button"
                    >
                      <Unlock size={16} />
                      Liberar
                    </button>
                  )}
                </td>
              )}
              <td>{operation.branch.name}</td>
              <td>{formatMoney(operation.agreedPrice, operation.currency)}</td>
              <td>{operation.seller?.fullName ?? 'Sin asignar'}</td>
              <td>
                <span
                  className={`status-badge ${operationStatusClass(operation.status)}`}
                >
                  {operationStatusLabels[operation.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
