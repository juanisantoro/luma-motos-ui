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

function clientDocument(operation: SalesOperation) {
  const documentType = operation.client.documentType
  const documentNumber = operation.client.documentNumber
  return documentType && documentNumber
    ? `${documentType} ${documentNumber}`
    : 'Documento no informado'
}

function sourceAndDestination(operation: SalesOperation) {
  if (operation.vehicle.unit) {
    return `Stock físico · ${operation.branch.name}`
  }
  return operation.supply
    ? `${operation.supply.supplier.legalName} → ${operation.supply.destinationBranch.name}`
    : `Proveedor → ${operation.branch.name}`
}

function supplyStatus(operation: SalesOperation) {
  if (operation.supply) return operation.supply.status
  if (
    operation.reservation?.status === 'ACTIVO' &&
    operation.reservation.supplierAvailabilityId
  ) {
    return 'Disponibilidad reservada'
  }
  if (operation.reservation?.status === 'ACTIVO') return 'Unidad reservada'
  if (operation.reservation?.status === 'CONSUMIDA') return 'Unidad consumida'
  if (operation.reservation?.status === 'LIBERADA') return 'Reserva liberada'
  if (operation.reservation?.status === 'VENCIDA') return 'Reserva vencida'
  if (!operation.vehicle.unit) return 'Pendiente de abastecimiento'
  return 'Unidad asignada'
}

function observation(operation: SalesOperation) {
  return (
    operation.approval?.reason ??
    operation.reservation?.releaseReason ??
    operation.notes ??
    (operation.status === 'PENDIENTE_APROBACION'
      ? 'Precio bajo revisión'
      : '—')
  )
}

function isBelowList(operation: SalesOperation) {
  return (
    operation.listPrice !== null &&
    Number(operation.agreedPrice) < Number(operation.listPrice)
  )
}

function ReleaseButton({
  operation,
  busyId,
  onRelease,
}: {
  operation: SalesOperation
  busyId?: string | null
  onRelease?: (operation: SalesOperation) => void
}) {
  if (
    !onRelease ||
    operation.reservation?.status !== 'ACTIVO' ||
    (operation.status !== 'BORRADOR' && operation.status !== 'RECHAZADA')
  ) {
    return null
  }
  return (
    <button
      className="button button--danger-quiet sales-card__action"
      disabled={busyId === operation.id}
      onClick={() => onRelease(operation)}
      type="button"
    >
      <Unlock size={16} />
      Liberar reserva
    </button>
  )
}

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
          <article
            className={`sales-card ${isBelowList(operation) ? 'sales-row--below-list' : ''}`}
            key={operation.id}
          >
            <div className="sales-card__heading">
              <div>
                <span>Operación #{operation.number}</span>
                <strong>{operation.client.fullName}</strong>
                <small>{clientDocument(operation)}</small>
              </div>
              <span
                className={`status-badge ${operationStatusClass(operation.status)}`}
              >
                {operationStatusLabels[operation.status]}
              </span>
            </div>
            <dl>
              <div>
                <dt>Fecha</dt>
                <dd>{formatOperationDate(operation.operationDate)}</dd>
              </div>
              <div>
                <dt>Vehículo</dt>
                <dd>
                  {vehicleLabel(operation)}
                  <small>
                    {operation.vehicle.model.vehicleType === 'MOTO'
                      ? 'Moto'
                      : 'Auto'}{' '}
                    ·{' '}
                    {operation.vehicle.condition === 'NUEVO'
                      ? 'Nuevo'
                      : 'Usado'}{' '}
                    · {operation.vehicle.unit?.vin ?? 'Sin chasis asignado'}
                  </small>
                </dd>
              </div>
              <div>
                <dt>Origen / destino</dt>
                <dd>{sourceAndDestination(operation)}</dd>
              </div>
              <div>
                <dt>Precio</dt>
                <dd>
                  {formatMoney(operation.agreedPrice, operation.currency)}
                  {isBelowList(operation) && (
                    <small>
                      Lista{' '}
                      {formatMoney(operation.listPrice, operation.currency)}
                    </small>
                  )}
                </dd>
              </div>
              <div>
                <dt>Vendedor</dt>
                <dd>{operation.seller?.fullName ?? 'Sin asignar'}</dd>
              </div>
              <div>
                <dt>Abastecimiento</dt>
                <dd>{supplyStatus(operation)}</dd>
              </div>
            </dl>
            <p className="sales-card__note">
              <strong>Observación:</strong> {observation(operation)}
            </p>
            {canRelease && (
              <ReleaseButton
                operation={operation}
                {...(busyId !== undefined ? { busyId } : {})}
                {...(onRelease ? { onRelease } : {})}
              />
            )}
          </article>
        ))}
      </div>
    )
  }

  return (
    <div className="sales-table-wrap">
      <table className="sales-table sales-table--operations">
        <thead>
          <tr>
            <th>Operación</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Vehículo / chasis</th>
            <th>Origen / destino</th>
            <th>Precio</th>
            <th>Vendedor</th>
            <th>Estado operación</th>
            <th>Abastecimiento</th>
            <th>Observación</th>
            {canRelease && (
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr
              className={isBelowList(operation) ? 'sales-row--below-list' : ''}
              key={operation.id}
            >
              <td>
                <strong>#{operation.number}</strong>
              </td>
              <td>{formatOperationDate(operation.operationDate)}</td>
              <td>
                <strong>{operation.client.fullName}</strong>
                <small>{clientDocument(operation)}</small>
              </td>
              <td>
                <strong>{vehicleLabel(operation)}</strong>
                <small>
                  {operation.vehicle.model.vehicleType === 'MOTO'
                    ? 'Moto'
                    : 'Auto'}{' '}
                  ·{' '}
                  {operation.vehicle.condition === 'NUEVO'
                    ? 'Nuevo'
                    : 'Usado'}{' '}
                  · {operation.vehicle.unit?.vin ?? 'Sin chasis asignado'}
                </small>
              </td>
              <td>{sourceAndDestination(operation)}</td>
              <td>
                <strong>
                  {formatMoney(operation.agreedPrice, operation.currency)}
                </strong>
                {isBelowList(operation) && (
                  <small>
                    Lista {formatMoney(operation.listPrice, operation.currency)}
                  </small>
                )}
              </td>
              <td>{operation.seller?.fullName ?? 'Sin asignar'}</td>
              <td>
                <span
                  className={`status-badge ${operationStatusClass(operation.status)}`}
                >
                  {operationStatusLabels[operation.status]}
                </span>
              </td>
              <td>{supplyStatus(operation)}</td>
              <td>{observation(operation)}</td>
              {canRelease && (
                <td>
                  <ReleaseButton
                    operation={operation}
                    {...(busyId !== undefined ? { busyId } : {})}
                    {...(onRelease ? { onRelease } : {})}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
