import {
  FileBadge,
  FileText,
  PackageCheck,
  Pencil,
  Store,
  Unlock,
  Warehouse,
} from 'lucide-react'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import {
  fulfillmentLabel,
  fulfillmentStatusClass,
  operationFulfillment,
} from './fulfillment'
import type { UnitAction } from './UnitFulfillmentDialogs'
import {
  licensingModeLabels,
  licensingStatusClass,
  licensingStatusLabels,
  plateStatusClass,
  plateStatusLabel,
  plateStatusOf,
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
  if (operation.supply) {
    return `${operation.supply.supplier.legalName} → ${operation.supply.destinationBranch.name}`
  }
  // Motos (fase 3): la unidad la define la administrativa (stock o pedido).
  if (operation.vehicle.model.vehicleType === 'MOTO') {
    const supplier = operation.fulfillment?.supplier?.legalName
    return supplier
      ? `${supplier} → ${operation.branch.name}`
      : `A definir → ${operation.branch.name}`
  }
  return `Proveedor → ${operation.branch.name}`
}

function requestedColorLabel(operation: SalesOperation) {
  return !operation.vehicle.unit && operation.requestedColor
    ? ` · Color ${operation.requestedColor}`
    : ''
}

// Autos: sin cambios respecto de fase 2 (texto de abastecimiento/reserva).
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

const isAuto = (operation: SalesOperation) =>
  operation.vehicle.model.vehicleType === 'AUTO'

const unitActionButtons: Record<
  UnitAction,
  { label: string; aria: string; icon: typeof Warehouse; primary: boolean }
> = {
  assign: {
    label: 'Asignar de stock',
    aria: 'Asignar de stock a la operación',
    icon: Warehouse,
    primary: true,
  },
  order: {
    label: 'Pedir a proveedor',
    aria: 'Pedir a proveedor para la operación',
    icon: Store,
    primary: false,
  },
  receive: {
    label: 'Registrar llegada',
    aria: 'Registrar llegada de la operación',
    icon: PackageCheck,
    primary: true,
  },
}

// Motos (fase 3): estado de asignación de la unidad y, en la grilla
// administrativa, las acciones para asignarla, pedirla o recibirla.
function UnitStatus({
  operation,
  actions = [],
  onAction,
}: {
  operation: SalesOperation
  actions?: UnitAction[] | undefined
  onAction?: ((operation: SalesOperation, action: UnitAction) => void) | undefined
}) {
  if (isAuto(operation)) return <>{supplyStatus(operation)}</>
  const fulfillment = operationFulfillment(operation)
  return (
    <div className="unit-cell">
      <span className={`status-badge ${fulfillmentStatusClass(fulfillment.status)}`}>
        {fulfillmentLabel(fulfillment)}
      </span>
      {onAction && actions.length > 0 && (
        <div className="unit-cell__actions">
          {actions.map((action) => {
            const button = unitActionButtons[action]
            const Icon = button.icon
            return (
              <button
                aria-label={`${button.aria} #${operation.number}`}
                className={`button button--compact ${button.primary ? 'button--primary' : 'button--secondary'}`}
                key={action}
                onClick={() => onAction(operation, action)}
                type="button"
              >
                <Icon size={15} />
                {button.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
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
  onRegisterPayment,
}: {
  operation: SalesOperation
  onManage?: ((operation: SalesOperation) => void) | undefined
  onRegisterPayment?: ((operation: SalesOperation) => void) | undefined
}) {
  const licensing = operation.licensing
  if (!licensing) return <span>—</span>
  const plateStatus = plateStatusOf(licensing)
  const plateNumber = licensing.plate?.number ?? operation.vehicle.unit?.licensePlate
  return (
    <div className="licensing-cell">
      <strong>
        {licensing.mode ? licensingModeLabels[licensing.mode] : 'Sin definir'}
      </strong>
      <span className={`status-badge ${licensingStatusClass(licensing.status)}`}>
        {licensingStatusLabels[licensing.status]}
      </span>
      {plateStatus === 'EN_TRAMITE' && (
        <small>{plateStatusLabel(plateStatus, licensing)}</small>
      )}
      {plateStatus === 'EN_TRAMITE_VENCIDA' && (
        <small className="licensing-overdue">
          {plateStatusLabel(plateStatus, licensing)}
        </small>
      )}
      {plateStatus?.startsWith('RECIBIDA') && (
        <span className={`status-badge ${plateStatusClass(plateStatus)}`}>
          {plateStatusLabel(plateStatus, licensing)}
          {plateNumber ? ` · ${plateNumber}` : ''}
        </span>
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
      {onRegisterPayment &&
        operation.vehicle.unit &&
        operation.status !== 'CANCELADA' &&
        operation.status !== 'RECHAZADA' && (
          <button
            aria-label={`Registrar pago de patente de la operación #${operation.number}`}
            className="button button--secondary button--compact"
            onClick={() => onRegisterPayment(operation)}
            type="button"
          >
            <FileText size={15} />
            Pago de patente
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
  onRegisterLicensingPayment,
  unitActions,
  onUnitAction,
  onEdit,
}: {
  operations: SalesOperation[]
  canRelease?: boolean
  busyId?: string | null
  onRelease?: (operation: SalesOperation) => void
  // Columna de patentamiento de la grilla administrativa.
  showLicensing?: boolean
  onManageLicensing?: (operation: SalesOperation) => void
  // Fase 5: abre pagos de vehículo con el pago de patente precargado.
  onRegisterLicensingPayment?: (operation: SalesOperation) => void
  // Fase 3 (motos): acciones de unidad disponibles por fila.
  unitActions?: (operation: SalesOperation) => UnitAction[]
  onUnitAction?: (operation: SalesOperation, action: UnitAction) => void
  // Corrección de la venta (ventas.corregir): botón Editar por fila.
  onEdit?: (operation: SalesOperation) => void
}) {
  const cards = useMediaQuery('(max-width: 768px)')
  const unitColumn =
    operations.length > 0 && operations.every(isAuto)
      ? 'Abastecimiento'
      : 'Unidad'

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
                      : 'Usado'}
                    {requestedColorLabel(operation)}{' '}
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
                <dt>{isAuto(operation) ? 'Abastecimiento' : 'Unidad'}</dt>
                <dd>
                  <UnitStatus
                  actions={unitActions?.(operation)}
                  onAction={onUnitAction}
                  operation={operation}
                />
                </dd>
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
                      onRegisterPayment={onRegisterLicensingPayment}
                    />
                  </dd>
                </div>
              )}
            </dl>
            <p className="sales-card__note">
              <strong>Observación:</strong> {observation(operation)}
            </p>
            {onEdit && (
              <button
                aria-label={`Editar operación ${operation.number}`}
                className="button button--secondary sales-card__action"
                onClick={() => onEdit(operation)}
                type="button"
              >
                <Pencil size={16} />
                Editar
              </button>
            )}
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
            <th>{unitColumn}</th>
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
                {onEdit && (
                  <button
                    aria-label={`Editar operación ${operation.number}`}
                    className="button button--secondary button--compact"
                    onClick={() => onEdit(operation)}
                    type="button"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
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
                    : 'Usado'}
                  {requestedColorLabel(operation)}{' '}
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
              <td>
                <UnitStatus
                  actions={unitActions?.(operation)}
                  onAction={onUnitAction}
                  operation={operation}
                />
              </td>
              {showLicensing && (
                <td>
                  <LicensingSummary
                    operation={operation}
                    onManage={onManageLicensing}
                    onRegisterPayment={onRegisterLicensingPayment}
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
