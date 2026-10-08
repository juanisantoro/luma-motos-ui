import {
  ChevronDown,
  ChevronRight,
  FileBadge,
  FileText,
  History,
  PackageCheck,
  Pencil,
  Store,
  Unlock,
  Warehouse,
} from 'lucide-react'
import { Fragment, useState, type MouseEvent } from 'react'
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

export function clientDocument(operation: SalesOperation) {
  const documentType = operation.client.documentType
  const documentNumber = operation.client.documentNumber
  return documentType && documentNumber
    ? `${documentType} ${documentNumber}`
    : 'Documento no informado'
}

export function sourceAndDestination(operation: SalesOperation) {
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

export function observation(operation: SalesOperation) {
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

function canManageLicensing(operation: SalesOperation) {
  return Boolean(operation.licensing) && operation.status !== 'CANCELADA'
}

function canRegisterLicensingPayment(operation: SalesOperation) {
  return (
    Boolean(operation.licensing) &&
    Boolean(operation.vehicle.unit) &&
    operation.status !== 'CANCELADA' &&
    operation.status !== 'RECHAZADA'
  )
}

function canReleaseReservation(operation: SalesOperation) {
  return (
    operation.reservation?.status === 'ACTIVO' &&
    (operation.status === 'BORRADOR' || operation.status === 'RECHAZADA')
  )
}

function LicensingSummary({
  operation,
  onManage,
  onRegisterPayment,
  compact = false,
}: {
  operation: SalesOperation
  // Grilla: sólo datos en una línea; las acciones van en la columna Acciones.
  compact?: boolean
  onManage?: ((operation: SalesOperation) => void) | undefined
  onRegisterPayment?: ((operation: SalesOperation) => void) | undefined
}) {
  const licensing = operation.licensing
  if (!licensing) return <span>—</span>
  const plateStatus = plateStatusOf(licensing)
  const plateNumber = licensing.plate?.number ?? operation.vehicle.unit?.licensePlate
  return (
    <div className={`licensing-cell ${compact ? 'licensing-cell--compact' : ''}`}>
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
      {!compact && onManage && canManageLicensing(operation) && (
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
      {!compact &&
        onRegisterPayment &&
        canRegisterLicensingPayment(operation) && (
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
  if (!onRelease || !canReleaseReservation(operation)) return null
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

// Resumen de patentamiento para la fila plegada: la patente recibida si ya
// llegó, si no el estado del trámite. El detalle completo va en el acordeón.
function LicensingBadge({ operation }: { operation: SalesOperation }) {
  const licensing = operation.licensing
  if (!licensing) return <span>—</span>
  const plateStatus = plateStatusOf(licensing)
  if (plateStatus?.startsWith('RECIBIDA')) {
    const plateNumber =
      licensing.plate?.number ?? operation.vehicle.unit?.licensePlate
    const label = `${plateStatusLabel(plateStatus, licensing)}${plateNumber ? ` · ${plateNumber}` : ''}`
    return (
      <span className={`status-badge ${plateStatusClass(plateStatus)}`} title={label}>
        {label}
      </span>
    )
  }
  const label = licensingStatusLabels[licensing.status]
  return (
    <span
      className={`status-badge ${licensingStatusClass(licensing.status)}`}
      title={licensing.overdue ? `${label} · patente demorada` : label}
    >
      {label}
    </span>
  )
}

export function unitSummary(operation: SalesOperation) {
  return isAuto(operation)
    ? supplyStatus(operation)
    : fulfillmentLabel(operationFulfillment(operation))
}

// Grilla: todas las acciones de la fila en una sola columna compacta, como
// íconos con tooltip (data-tip), así las celdas de datos no crecen. La acción
// que toca en ese momento (asignar / registrar llegada) va resaltada.
function RowActions({
  operation,
  unitActions = [],
  onUnitAction,
  onEdit,
  onHistory,
  onManageLicensing,
  onRegisterLicensingPayment,
  canRelease,
  busyId,
  onRelease,
}: {
  operation: SalesOperation
  unitActions?: UnitAction[] | undefined
  onUnitAction?: ((operation: SalesOperation, action: UnitAction) => void) | undefined
  onEdit?: ((operation: SalesOperation) => void) | undefined
  onHistory?: ((operation: SalesOperation) => void) | undefined
  onManageLicensing?: ((operation: SalesOperation) => void) | undefined
  onRegisterLicensingPayment?: ((operation: SalesOperation) => void) | undefined
  canRelease: boolean
  busyId?: string | null | undefined
  onRelease?: ((operation: SalesOperation) => void) | undefined
}) {
  const visibleUnitActions =
    onUnitAction && !isAuto(operation) ? unitActions : []
  return (
    <div className="row-actions">
      {visibleUnitActions.map((action) => {
        const button = unitActionButtons[action]
        const Icon = button.icon
        return (
          <button
            aria-label={`${button.aria} #${operation.number}`}
            className={`row-action ${button.primary ? 'row-action--primary' : ''}`}
            data-tip={button.label}
            key={action}
            onClick={() => onUnitAction?.(operation, action)}
            type="button"
          >
            <Icon size={16} />
          </button>
        )
      })}
      {onEdit && (
        <button
          aria-label={`Editar operación ${operation.number}`}
          className="row-action"
          data-tip="Editar venta"
          onClick={() => onEdit(operation)}
          type="button"
        >
          <Pencil size={16} />
        </button>
      )}
      {onHistory && (
        <button
          aria-label={`Ver historial de la operación ${operation.number}`}
          className="row-action"
          data-tip="Historial (auditoría)"
          onClick={() => onHistory(operation)}
          type="button"
        >
          <History size={16} />
        </button>
      )}
      {onManageLicensing && canManageLicensing(operation) && (
        <button
          aria-label={`Gestionar patentamiento de la operación #${operation.number}`}
          className="row-action"
          data-tip="Gestionar patentamiento"
          onClick={() => onManageLicensing(operation)}
          type="button"
        >
          <FileBadge size={16} />
        </button>
      )}
      {onRegisterLicensingPayment && canRegisterLicensingPayment(operation) && (
        <button
          aria-label={`Registrar pago de patente de la operación #${operation.number}`}
          className="row-action"
          data-tip="Pago de patente"
          onClick={() => onRegisterLicensingPayment(operation)}
          type="button"
        >
          <FileText size={16} />
        </button>
      )}
      {canRelease && onRelease && canReleaseReservation(operation) && (
        <button
          className="row-action row-action--danger"
          data-tip="Liberar reserva"
          disabled={busyId === operation.id}
          onClick={() => onRelease(operation)}
          type="button"
        >
          <Unlock size={16} />
          <span className="sr-only">Liberar reserva</span>
        </button>
      )}
    </div>
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
  onHistory,
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
  // Auditoría (auditoria.consultar): historial completo de la venta.
  onHistory?: (operation: SalesOperation) => void
}) {
  const cards = useMediaQuery('(max-width: 768px)')
  const unitColumn =
    operations.length > 0 && operations.every(isAuto)
      ? 'Abastecimiento'
      : 'Unidad'

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const allExpanded =
    operations.length > 0 &&
    operations.every((operation) => expanded.has(operation.id))
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () =>
    setExpanded(
      allExpanded ? new Set() : new Set(operations.map((item) => item.id)),
    )
  // Clic en cualquier parte de la fila la despliega, salvo sobre un botón.
  const toggleFromRow = (event: MouseEvent<HTMLTableRowElement>, id: string) => {
    if ((event.target as HTMLElement).closest('button, a')) return
    toggle(id)
  }
  const hasActions = Boolean(
    canRelease ||
      onEdit ||
      onHistory ||
      onUnitAction ||
      (showLicensing && (onManageLicensing || onRegisterLicensingPayment)),
  )

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
            {onHistory && (
              <button
                aria-label={`Ver historial de la operación ${operation.number}`}
                className="button button--secondary sales-card__action"
                onClick={() => onHistory(operation)}
                type="button"
              >
                <History size={16} />
                Historial
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

  const columnCount = 8 + (showLicensing ? 1 : 0) + (hasActions ? 1 : 0)

  return (
    <div className="sales-table-wrap">
      <table className="sales-table sales-table--operations">
        <thead>
          <tr>
            <th className="sales-col--toggle">
              <button
                aria-expanded={allExpanded}
                aria-label={allExpanded ? 'Plegar todas' : 'Desplegar todas'}
                className="row-action"
                data-tip={allExpanded ? 'Plegar todas' : 'Desplegar todas'}
                onClick={toggleAll}
                type="button"
              >
                {allExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </th>
            <th className="sales-col--number">Operación</th>
            <th>Cliente</th>
            <th>Vehículo</th>
            <th className="sales-col--price">Precio</th>
            <th>Vendedor</th>
            <th className="sales-col--status">Estado operación</th>
            <th className="sales-col--unit">{unitColumn}</th>
            {showLicensing && <th className="sales-col--licensing">Patentamiento</th>}
            {hasActions && <th className="sales-table__actions">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => {
            const open = expanded.has(operation.id)
            const fulfillmentClass = isAuto(operation)
              ? ''
              : fulfillmentStatusClass(operationFulfillment(operation).status)
            return (
              <Fragment key={operation.id}>
                <tr
                  className={`sales-row ${open ? 'sales-row--open' : ''} ${rowClass(operation, showLicensing)}`}
                  onClick={(event) => toggleFromRow(event, operation.id)}
                >
                  <td className="sales-col--toggle">
                    <button
                      aria-controls={`operation-detail-${operation.id}`}
                      aria-expanded={open}
                      aria-label={`${open ? 'Ocultar' : 'Ver'} detalle de la operación #${operation.number}`}
                      className="row-action"
                      data-tip={open ? 'Ocultar detalle' : 'Ver detalle'}
                      onClick={() => toggle(operation.id)}
                      type="button"
                    >
                      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </td>
                  <td>
                    <strong>#{operation.number}</strong>
                  </td>
                  <td title={operation.client.fullName}>
                    <strong>{operation.client.fullName}</strong>
                  </td>
                  <td title={vehicleLabel(operation)}>{vehicleLabel(operation)}</td>
                  <td>
                    <strong>
                      {formatMoney(operation.agreedPrice, operation.currency)}
                    </strong>
                  </td>
                  <td title={operation.seller?.fullName ?? 'Sin asignar'}>
                    {operation.seller?.fullName ?? 'Sin asignar'}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${operationStatusClass(operation.status)}`}
                    >
                      {operationStatusLabels[operation.status]}
                    </span>
                  </td>
                  <td>
                    {isAuto(operation) ? (
                      <span title={unitSummary(operation)}>
                        {unitSummary(operation)}
                      </span>
                    ) : (
                      <span
                        className={`status-badge ${fulfillmentClass}`}
                        title={unitSummary(operation)}
                      >
                        {unitSummary(operation)}
                      </span>
                    )}
                  </td>
                  {showLicensing && (
                    <td>
                      <LicensingBadge operation={operation} />
                    </td>
                  )}
                  {hasActions && (
                    <td className="sales-table__actions">
                      <RowActions
                        busyId={busyId}
                        canRelease={canRelease}
                        onEdit={onEdit}
                        onHistory={onHistory}
                        onManageLicensing={
                          showLicensing ? onManageLicensing : undefined
                        }
                        onRegisterLicensingPayment={
                          showLicensing ? onRegisterLicensingPayment : undefined
                        }
                        onRelease={onRelease}
                        onUnitAction={onUnitAction}
                        operation={operation}
                        unitActions={unitActions?.(operation)}
                      />
                    </td>
                  )}
                </tr>
                {open && (
                  <tr
                    className="sales-detail-row"
                    id={`operation-detail-${operation.id}`}
                  >
                    <td colSpan={columnCount}>
                      <dl className="sales-detail">
                        <div>
                          <dt>Fecha</dt>
                          <dd>{formatOperationDate(operation.operationDate)}</dd>
                        </div>
                        <div>
                          <dt>Boleto</dt>
                          <dd>
                            {operation.ticketNumber
                              ? `Boleto ${operation.ticketNumber}`
                              : 'Sin boleto'}
                          </dd>
                        </div>
                        <div>
                          <dt>Cliente</dt>
                          <dd>
                            {operation.client.fullName}
                            <small>{clientDocument(operation)}</small>
                          </dd>
                        </div>
                        <div>
                          <dt>Vehículo / chasis</dt>
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
                        {showLicensing && (
                          <div>
                            <dt>Patentamiento</dt>
                            <dd>
                              <LicensingSummary compact operation={operation} />
                            </dd>
                          </div>
                        )}
                        <div className="sales-detail__wide">
                          <dt>Observación</dt>
                          <dd>{observation(operation)}</dd>
                        </div>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
