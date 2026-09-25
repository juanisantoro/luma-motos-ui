import { FileBadge, Unlock } from 'lucide-react'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import {
  licensingModeLabels,
  licensingStatusClass,
  licensingStatusLabels,
  licensingWindowLabel,
} from './licensing'
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

function rowClass(operation: SalesOperation, showLicensing: boolean) {
  return [
    isBelowList(operation) ? 'sales-row--below-list' : '',
    showLicensing && operation.licensing?.overdue
      ? 'sales-row--licensing-overdue'
      : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function LicensingSummary({
  operation,
  onManage,
}: {
  operation: SalesOperation
  onManage?: ((operation: SalesOperation) => void) | undefined
}) {
  const licensing = operation.licensing
  if (!licensing) return <span>—</span>
  return (
    <div className="licensing-cell">
      <strong>
        {licensing.mode ? licensingModeLabels[licensing.mode] : 'Sin definir'}
      </strong>
      <span className={`status-badge ${licensingStatusClass(licensing.status)}`}>
        {licensingStatusLabels[licensing.status]}
      </span>
      <small>
        {licensing.plateLoaded
          ? 'Patente cargada'
          : licensingWindowLabel(licensing.estimatedFrom, licensing.estimatedTo)}
      </small>
      {licensing.overdue && (
        <small className="licensing-overdue">Pasó la fecha estimada sin patente</small>
      )}
      {onManage && operation.status !== 'CANCELADA' && (
        <button
          aria-label={`Gestionar patentamiento de la operación #${operation.number}`}
          className="button button--secondary button--compact"
          onClick={() => onManage(operation)}
          type="button"
        >
          <FileBadge size={15} />
          Gestionar
        </button>
      )}
    </div>
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
  showLicensing = false,
  onManageLicensing,
}: {
  operations: SalesOperation[]
  canRelease?: boolean
  busyId?: string | null
  onRelease?: (operation: SalesOperation) => void
  // Columna de patentamiento de la grilla administrativa.
  showLicensing?: boolean
  onManageLicensing?: (operation: SalesOperation) => void
}) {
  const cards = useMediaQuery('(max-width: 768px)')

  if (cards) {
    return (
      <div className="sales-card-list">
        {operations.map((operation) => (
          <article
            className={`sales-card ${rowClass(operation, showLicensing)}`}
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
              {operation.ticketNumber && (
                <div>
                  <dt>Boleto</dt>
                  <dd>{operation.ticketNumber}</dd>
                </div>
              )}
              {showLicensing && (
                <div>
                  <dt>Patentamiento</dt>
                  <dd>
                    <LicensingSummary
                      operation={operation}
                      onManage={onManageLicensing}
                    />
                  </dd>
                </div>
              )}
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
            {showLicensing && <th>Patentamiento</th>}
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
            <tr className={rowClass(operation, showLicensing)} key={operation.id}>
              <td>
                <strong>#{operation.number}</strong>
                {operation.ticketNumber && (
                  <small>Boleto {operation.ticketNumber}</small>
                )}
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
              {showLicensing && (
                <td>
                  <LicensingSummary
                    operation={operation}
                    onManage={onManageLicensing}
                  />
                </td>
              )}
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
