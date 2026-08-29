import {
  Building2,
  Check,
  CircleDollarSign,
  Clock3,
  Printer,
  PackageCheck,
  Plus,
  Search,
  Send,
  Store,
  Truck,
  Warehouse,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { ProviderAvailabilityModal } from './ProviderAvailabilityModal'
import { PricePolicyModal } from './PricePolicyModal'
import { ReceiveSupplyModal } from './ReceiveSupplyModal'
import { UnitFormModal } from './UnitFormModal'
import { stockErrorMessage } from './errors'
import type {
  AcquisitionOrigin,
  ConfigurePriceInput,
  CreateUnitsInput,
  PhysicalUnit,
  ReceiveSupplyInput,
  StockCapabilities,
  StockWorkspaceData,
  SupplierAvailability,
  SupplyOrder,
  SupplyStatus,
  UnitStatus,
  UpsertAvailabilityInput,
  VehicleCondition,
  VehicleKind,
} from './types'

type StockTab = 'physical' | 'catalog' | 'providers' | 'supply'
type FilterValue<T extends string> = T | 'ALL'

type StockWorkspaceProps = {
  vehicleType: VehicleKind
  data: StockWorkspaceData
  capabilities: StockCapabilities
  onCreateUnits: (input: CreateUnitsInput) => Promise<void>
  onUpsertAvailability: (input: UpsertAvailabilityInput) => Promise<void>
  onConfigurePrice: (input: ConfigurePriceInput) => Promise<void>
  onTransitionSupply: (
    supplyId: string,
    status: SupplyStatus,
  ) => Promise<void>
  onReceiveSupply: (
    supplyId: string,
    input: ReceiveSupplyInput,
  ) => Promise<void>
}

const unitStatusLabels: Record<UnitStatus, string> = {
  EN_STOCK: 'En stock',
  RESERVADO: 'Reservado',
  EN_TRASLADO: 'En traslado',
  EN_ACONDICIONAMIENTO: 'En acondicionamiento',
  VENDIDO: 'Vendido',
  ENTREGADO: 'Entregado',
  BLOQUEADO: 'Bloqueado',
  DADO_DE_BAJA: 'Dado de baja',
}

const supplyStatusLabels: Record<SupplyStatus, string> = {
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  CONFIRMADO: 'Confirmado',
  PEDIDO: 'Pedido',
  EN_TRANSITO: 'En tránsito',
  RECIBIDO: 'Recibido',
  ASIGNADO: 'Asignado',
  CANCELADA: 'Cancelada',
}

const originLabels: Record<AcquisitionOrigin, string> = {
  PROVEEDOR: 'Proveedor',
  TOMA_PARTE_PAGO: 'Parte de pago',
  OTRO: 'Otro',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatMoney(value: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function modelName(item: {
  brand: string
  model: string
  version: string | null
}) {
  return `${item.brand} ${item.model}${item.version ? ` · ${item.version}` : ''}`
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
}

function matchesSearch(
  values: Array<string | null | undefined>,
  search: string,
) {
  if (!search) return true
  return normalize(values.filter(Boolean).join(' ')).includes(normalize(search))
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) {
  return (
    <span className={`stock-badge stock-badge--${tone}`}>{children}</span>
  )
}

function EmptyTab({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="stock-empty">
      <Warehouse size={30} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function UnitCards({
  units,
  selected,
  onToggle,
}: {
  units: PhysicalUnit[]
  selected: Set<string>
  onToggle: (unitId: string) => void
}) {
  return (
    <div className="stock-card-list">
      {units.map((unit) => (
        <article className="stock-row-card" key={unit.id}>
          <div className="stock-row-card__heading">
            <input
              aria-label={`Seleccionar ${unit.vin}`}
              checked={selected.has(unit.id)}
              onChange={() => onToggle(unit.id)}
              type="checkbox"
            />
            <div>
              <strong>{modelName(unit.catalogModel)}</strong>
              <span>{unit.vin}</span>
            </div>
            <Badge
              tone={unit.status === 'EN_STOCK' ? 'success' : 'neutral'}
            >
              {unitStatusLabels[unit.status]}
            </Badge>
          </div>
          <dl>
            <div>
              <dt>Condición</dt>
              <dd>{unit.condition === 'NUEVO' ? 'Nuevo / 0 km' : 'Usado'}</dd>
            </div>
            <div>
              <dt>Sucursal</dt>
              <dd>{unit.branch.name}</dd>
            </div>
            <div>
              <dt>Origen</dt>
              <dd>{originLabels[unit.acquisitionOrigin]}</dd>
            </div>
            <div>
              <dt>Año / km</dt>
              <dd>
                {unit.year} · {unit.mileage.toLocaleString('es-AR')} km
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  )
}

function PhysicalUnits({
  units,
  selected,
  onToggle,
  onToggleAll,
}: {
  units: PhysicalUnit[]
  selected: Set<string>
  onToggle: (unitId: string) => void
  onToggleAll: () => void
}) {
  if (units.length === 0) {
    return (
      <EmptyTab
        title="No hay unidades físicas"
        description="No encontramos unidades que coincidan con los filtros aplicados."
      />
    )
  }
  return (
    <>
      <UnitCards units={units} selected={selected} onToggle={onToggle} />
      <div className="stock-table-wrap">
        <table className="stock-table">
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Seleccionar unidades visibles"
                  checked={
                    units.length > 0 &&
                    units.every((unit) => selected.has(unit.id))
                  }
                  onChange={onToggleAll}
                  type="checkbox"
                />
              </th>
              <th>Tipo</th>
              <th>Marca / modelo</th>
              <th>Condición</th>
              <th>VIN / chasis</th>
              <th>Sucursal</th>
              <th>Origen</th>
              <th>Año / km</th>
              <th>Estado</th>
              <th>Reserva</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id}>
                <td>
                  <input
                    aria-label={`Seleccionar ${unit.vin}`}
                    checked={selected.has(unit.id)}
                    onChange={() => onToggle(unit.id)}
                    type="checkbox"
                  />
                </td>
                <td>
                  <Badge tone="info">
                    {unit.vehicleType === 'MOTO' ? 'Moto' : 'Auto'}
                  </Badge>
                </td>
                <td>
                  <strong>{modelName(unit.catalogModel)}</strong>
                </td>
                <td>
                  {unit.condition === 'NUEVO' ? 'Nuevo / 0 km' : 'Usado'}
                </td>
                <td className="stock-table__identifier">{unit.vin}</td>
                <td>{unit.branch.name}</td>
                <td>{originLabels[unit.acquisitionOrigin]}</td>
                <td>
                  {unit.year} · {unit.mileage.toLocaleString('es-AR')} km
                </td>
                <td>
                  <Badge
                    tone={
                      unit.status === 'EN_STOCK' ? 'success' : 'neutral'
                    }
                  >
                    {unitStatusLabels[unit.status]}
                  </Badge>
                </td>
                <td>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CatalogList({
  catalog,
  units,
  canConfigurePrice,
  onConfigurePrice,
}: {
  catalog: StockWorkspaceData['catalog']
  units: PhysicalUnit[]
  canConfigurePrice: boolean
  onConfigurePrice: (item: StockWorkspaceData['catalog'][number]) => void
}) {
  if (catalog.length === 0) {
    return (
      <EmptyTab
        title="No hay modelos en el catálogo"
        description="No encontramos marcas, modelos o versiones para esta categoría."
      />
    )
  }
  return (
    <div className="stock-table-wrap stock-table-wrap--catalog">
      <table className="stock-table stock-table--catalog">
        <thead>
          <tr>
            <th>Marca</th>
            <th>Modelo</th>
            <th>Precio sugerido</th>
            <th>Precio mínimo</th>
            <th>Unidades físicas</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {catalog.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.brand}</strong></td>
              <td>
                {item.model}
                {item.version && item.version !== item.model && (
                  <small className="stock-table__subline">{item.version}</small>
                )}
              </td>
              <td>
                {item.pricePolicy
                  ? formatMoney(
                      item.pricePolicy.listPrice,
                      item.pricePolicy.currency,
                    )
                  : '—'}
              </td>
              <td>
                {item.pricePolicy
                  ? formatMoney(
                      item.pricePolicy.minimumPrice,
                      item.pricePolicy.currency,
                    )
                  : '—'}
              </td>
              <td>
                {units.filter((unit) => unit.catalogModel.id === item.id).length}
              </td>
              <td>
                {item.pricePolicy ? (
                  <Badge tone="success">Precio vigente</Badge>
                ) : canConfigurePrice ? (
                  <div className="catalog-price-action">
                    <Badge tone="danger">Sin precio configurado</Badge>
                    <button
                      className="button button--secondary"
                      onClick={() => onConfigurePrice(item)}
                      type="button"
                    >
                      Configurar precio
                    </button>
                  </div>
                ) : (
                  <Badge tone="danger">Sin precio configurado</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AvailabilityList({
  items,
  canManage,
  onEdit,
}: {
  items: SupplierAvailability[]
  canManage: boolean
  onEdit: (item: SupplierAvailability) => void
}) {
  if (items.length === 0) {
    return (
      <EmptyTab
        title="Sin disponibilidad informada"
        description="No hay cantidades de proveedores que coincidan con los filtros."
      />
    )
  }
  return (
    <>
      <div className="stock-table-wrap stock-table-wrap--availability">
        <table className="stock-table stock-table--availability">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Marca / modelo</th>
              <th>Condición</th>
              <th>Proveedor</th>
              <th>Disponibilidad</th>
              <th>Actualizado</th>
              <th>Observaciones</th>
              {canManage && <th>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Badge tone="info">
                    {item.vehicleType === 'MOTO' ? 'Moto' : 'Auto'}
                  </Badge>
                </td>
                <td>
                  <strong>{modelName(item.catalogModel)}</strong>
                  <small className="stock-table__subline">
                    Sin chasis hasta la recepción
                  </small>
                </td>
                <td>
                  {item.condition === 'NUEVO' ? 'Nuevo / 0 km' : 'Usado'}
                </td>
                <td>{item.supplier.name}</td>
                <td><strong>{item.quantity} unidades</strong></td>
                <td>{formatDate(item.updatedAt)}</td>
                <td>{item.notes ?? '—'}</td>
                {canManage && (
                  <td>
                    <button
                      className="button button--secondary"
                      onClick={() => onEdit(item)}
                      type="button"
                    >
                      Actualizar cantidad
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stock-card-list availability-card-list">
        {items.map((item) => (
          <article className="availability-card" key={item.id}>
            <div className="availability-card__top">
              <Store aria-hidden="true" />
              <div>
                <strong>{item.supplier.name}</strong>
                <span>{formatDate(item.updatedAt)}</span>
              </div>
              <b>{item.quantity}</b>
            </div>
            <h3>{modelName(item.catalogModel)}</h3>
            <div className="availability-card__meta">
              <Badge tone="info">
                {item.condition === 'NUEVO' ? 'Nuevo / 0 km' : 'Usado'}
              </Badge>
              <span>Sin VIN · fuera del stock físico</span>
            </div>
            {item.notes && <p>{item.notes}</p>}
            {canManage && (
              <button
                className="button button--secondary availability-card__action"
                onClick={() => onEdit(item)}
                type="button"
              >
                Actualizar cantidad
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  )
}

function nextSupplyAction(status: SupplyStatus) {
  if (status === 'PENDIENTE_CONFIRMACION') {
    return {
      status: 'CONFIRMADO' as const,
      label: 'Confirmar disponibilidad',
      icon: Check,
    }
  }
  if (status === 'CONFIRMADO') {
    return { status: 'PEDIDO' as const, label: 'Realizar pedido', icon: Send }
  }
  if (status === 'PEDIDO') {
    return {
      status: 'EN_TRANSITO' as const,
      label: 'Marcar en tránsito',
      icon: Truck,
    }
  }
  return null
}

function SuppliesList({
  supplies,
  capabilities,
  busyId,
  onTransition,
  onReceive,
}: {
  supplies: SupplyOrder[]
  capabilities: StockCapabilities
  busyId: string | null
  onTransition: (supply: SupplyOrder, status: SupplyStatus) => void
  onReceive: (supply: SupplyOrder) => void
}) {
  if (supplies.length === 0) {
    return (
      <EmptyTab
        title="No hay abastecimientos"
        description="No encontramos solicitudes pendientes o históricas con estos filtros."
      />
    )
  }
  return (
    <div className="supply-list">
      {supplies.map((supply) => {
        const nextAction = nextSupplyAction(supply.status)
        const ActionIcon = nextAction?.icon
        return (
          <article className="supply-card" key={supply.id}>
            <div className="supply-card__timeline" aria-hidden="true">
              <Clock3 />
            </div>
            <div className="supply-card__body">
              <div className="supply-card__heading">
                <div>
                  <span>
                    {supply.operation?.number ??
                      supply.operation?.id ??
                      supply.id}
                  </span>
                  <h3>{modelName(supply.catalogModel)}</h3>
                  <p className="supply-card__customer">
                    {supply.operation?.clientName ?? 'Cliente no informado por API'}
                    {supply.operation?.clientDocument
                      ? ` · ${supply.operation.clientDocument}`
                      : ''}
                  </p>
                </div>
                <Badge
                  tone={
                    supply.status === 'RECIBIDO' ||
                    supply.status === 'ASIGNADO'
                      ? 'success'
                      : supply.status === 'CANCELADA'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {supplyStatusLabels[supply.status]}
                </Badge>
              </div>
              <dl>
                <div>
                  <dt>Estado operación</dt>
                  <dd>{supply.operation?.status ?? '—'}</dd>
                </div>
                <div>
                  <dt>Abastecimiento</dt>
                  <dd>{supplyStatusLabels[supply.status]}</dd>
                </div>
                <div>
                  <dt>Chasis</dt>
                  <dd>{supply.receivedUnit?.vin ?? 'Sin asignar'}</dd>
                </div>
                <div>
                  <dt>Proveedor / destino</dt>
                  <dd>{supply.supplier.name} · {supply.destinationBranch.name}</dd>
                </div>
              </dl>
              {(nextAction && capabilities.manageSupply && ActionIcon) && (
                <button
                  className="button button--primary"
                  disabled={busyId === supply.id}
                  onClick={() => onTransition(supply, nextAction.status)}
                  type="button"
                >
                  <ActionIcon size={17} />
                  {busyId === supply.id ? 'Actualizando…' : nextAction.label}
                </button>
              )}
              {supply.status === 'EN_TRANSITO' &&
                capabilities.receiveSupply && (
                  <button
                    className="button button--primary"
                    disabled={busyId === supply.id}
                    onClick={() => onReceive(supply)}
                    type="button"
                  >
                    <PackageCheck size={17} />
                    Recibir
                  </button>
                )}
              {supply.status === 'PENDIENTE_APROBACION' && (
                <p className="supply-card__note">
                  La gestión se habilitará cuando la solicitud sea aprobada.
                </p>
              )}
              {supply.receivedUnit && (
                <div className="received-unit">
                  <PackageCheck size={18} aria-hidden="true" />
                  <span>
                    Unidad creada: <strong>{supply.receivedUnit.vin}</strong> ·{' '}
                    {supply.receivedUnit.branch.name}
                  </span>
                </div>
              )}
              {!supply.receivedUnit && supply.receivedUnitId && (
                <div className="received-unit">
                  <PackageCheck size={18} aria-hidden="true" />
                  <span>
                    Unidad física creada · disponible en la vista de unidades.
                  </span>
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function StockWorkspace({
  vehicleType,
  data,
  capabilities,
  onCreateUnits,
  onUpsertAvailability,
  onConfigurePrice,
  onTransitionSupply,
  onReceiveSupply,
}: StockWorkspaceProps) {
  const [tab, setTab] = useState<StockTab>('physical')
  const [search, setSearch] = useState('')
  const [condition, setCondition] =
    useState<FilterValue<VehicleCondition>>('ALL')
  const [branchId, setBranchId] = useState('ALL')
  const [origin, setOrigin] =
    useState<FilterValue<AcquisitionOrigin>>('ALL')
  const [unitStatus, setUnitStatus] =
    useState<FilterValue<UnitStatus>>('ALL')
  const [supplyStatus, setSupplyStatus] =
    useState<FilterValue<SupplyStatus>>('ALL')
  const [unitModal, setUnitModal] = useState(false)
  const [providerModal, setProviderModal] = useState<
    SupplierAvailability | 'new' | null
  >(null)
  const [receiving, setReceiving] = useState<SupplyOrder | null>(null)
  const [pricing, setPricing] = useState<
    StockWorkspaceData['catalog'][number] | null
  >(null)
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [busySupplyId, setBusySupplyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const noun = vehicleType === 'MOTO' ? 'motos' : 'autos'
  const tabs = [
    ['physical', 'Unidades físicas'],
    ...(capabilities.viewAvailability
      ? ([['providers', 'Disponibilidad de proveedores']] as const)
      : []),
    ...(capabilities.viewSupply
      ? ([['supply', 'Abastecimientos']] as const)
      : []),
    ...(capabilities.viewCatalog
      ? ([['catalog', 'Catálogo de modelos']] as const)
      : []),
  ] satisfies Array<readonly [StockTab, string]>

  const units = useMemo(
    () =>
      data.units.filter(
        (unit) =>
          unit.vehicleType === vehicleType &&
          (condition === 'ALL' || unit.condition === condition) &&
          (branchId === 'ALL' || unit.branch.id === branchId) &&
          (origin === 'ALL' || unit.acquisitionOrigin === origin) &&
          (unitStatus === 'ALL' || unit.status === unitStatus) &&
          matchesSearch(
            [
              unit.catalogModel.brand,
              unit.catalogModel.model,
              unit.catalogModel.version,
              unit.vin,
              unit.licensePlate,
            ],
            search,
          ),
      ),
    [
      branchId,
      condition,
      data.units,
      origin,
      search,
      unitStatus,
      vehicleType,
    ],
  )
  const catalog = useMemo(
    () =>
      data.catalog.filter(
        (item) =>
          item.vehicleType === vehicleType &&
          matchesSearch([item.brand, item.model, item.version], search),
      ),
    [data.catalog, search, vehicleType],
  )
  const labelUnits = useMemo(
    () => data.units.filter((unit) => selectedUnits.has(unit.id)),
    [data.units, selectedUnits],
  )
  const availability = useMemo(
    () =>
      data.availability.filter(
        (item) =>
          item.vehicleType === vehicleType &&
          (condition === 'ALL' || item.condition === condition) &&
          matchesSearch(
            [
              item.catalogModel.brand,
              item.catalogModel.model,
              item.catalogModel.version,
              item.supplier.name,
            ],
            search,
          ),
      ),
    [condition, data.availability, search, vehicleType],
  )
  const supplies = useMemo(
    () =>
      data.supplies.filter(
        (item) =>
          item.vehicleType === vehicleType &&
          (condition === 'ALL' || item.condition === condition) &&
          (branchId === 'ALL' ||
            item.destinationBranch.id === branchId) &&
          (supplyStatus === 'ALL' || item.status === supplyStatus) &&
          matchesSearch(
            [
              item.id,
              item.catalogModel.brand,
              item.catalogModel.model,
              item.catalogModel.version,
              item.supplier.name,
              item.operation?.number,
              item.operation?.clientName,
              item.operation?.clientDocument,
              item.receivedUnit?.vin,
            ],
            search,
          ),
      ),
    [
      branchId,
      condition,
      data.supplies,
      search,
      supplyStatus,
      vehicleType,
    ],
  )

  const runMutation = async (
    mutation: () => Promise<void>,
    afterSuccess: () => void,
  ) => {
    setBusy(true)
    setActionError(null)
    try {
      await mutation()
      afterSuccess()
    } catch (error) {
      setActionError(stockErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const transitionSupply = async (
    supply: SupplyOrder,
    status: SupplyStatus,
  ) => {
    setBusySupplyId(supply.id)
    setActionError(null)
    try {
      await onTransitionSupply(supply.id, status)
    } catch (error) {
      setActionError(stockErrorMessage(error))
    } finally {
      setBusySupplyId(null)
    }
  }

  const openUnitModal = () => {
    setActionError(null)
    setUnitModal(true)
  }
  const openProviderModal = () => {
    setActionError(null)
    setProviderModal('new')
  }
  const openReception = (supply: SupplyOrder) => {
    setActionError(null)
    setReceiving(supply)
  }
  const toggleUnit = (unitId: string) => {
    setSelectedUnits((current) => {
      const next = new Set(current)
      if (next.has(unitId)) next.delete(unitId)
      else next.add(unitId)
      return next
    })
  }
  const toggleVisibleUnits = () => {
    setSelectedUnits((current) => {
      const allSelected =
        units.length > 0 && units.every((unit) => current.has(unit.id))
      const next = new Set(current)
      units.forEach((unit) =>
        allSelected ? next.delete(unit.id) : next.add(unit.id),
      )
      return next
    })
  }

  return (
    <>
      <header className="page-heading stock-heading">
        <div>
          <p className="eyebrow">INVENTARIO Y ABASTECIMIENTO</p>
          <h1>Stock de {noun}</h1>
          <p>
            Unidades físicas, catálogo y disponibilidad de proveedores sin
            mezclar sus existencias.
          </p>
        </div>
        <div className="stock-heading__actions">
          {capabilities.manageAvailability && (
            <button
              className="button button--secondary"
              onClick={openProviderModal}
              type="button"
            >
              <Store size={18} />
              + {vehicleType === 'MOTO' ? 'Motos' : 'Autos'} de proveedor
            </button>
          )}
          {capabilities.createUnits && (
            <button
              className="button button--primary"
              onClick={openUnitModal}
              type="button"
            >
              <Plus size={18} />
              + Ingresar {vehicleType === 'MOTO' ? 'motos' : 'autos'}
            </button>
          )}
          <button
            className="button button--dark"
            disabled={selectedUnits.size === 0}
            onClick={() => window.print()}
            type="button"
          >
            <Printer size={18} />
            Etiquetas ({selectedUnits.size})
          </button>
        </div>
      </header>

      <section className="stock-metrics" aria-label="Métricas de stock">
        {data.branches.map((branch) => (
          <article className="stock-metric" key={branch.id}>
            <Building2 aria-hidden="true" />
            <div>
              <strong>
                {
                  data.units.filter(
                    (unit) =>
                      unit.vehicleType === vehicleType &&
                      unit.branch.id === branch.id &&
                      unit.status === 'EN_STOCK',
                  ).length
                }
              </strong>
              <span>{noun} disponibles en {branch.name}</span>
            </div>
          </article>
        ))}
        <article className="stock-metric">
          <CircleDollarSign aria-hidden="true" />
          <div>
            <strong>
              {
                data.units.filter(
                  (unit) =>
                    unit.vehicleType === vehicleType &&
                    unit.status === 'RESERVADO',
                ).length
              }
            </strong>
            <span>{noun} reservadas</span>
          </div>
        </article>
        {capabilities.viewAvailability && (
          <article className="stock-metric">
            <Store aria-hidden="true" />
            <div>
              <strong>
                {
                  data.availability.filter(
                    (item) =>
                      item.vehicleType === vehicleType && item.quantity > 0,
                  ).length
                }
              </strong>
              <span>Modelos en proveedores</span>
            </div>
          </article>
        )}
      </section>

      <section className="stock-panel">
        <div className="stock-tabs" role="tablist" aria-label="Vistas de stock">
          {tabs.map(([value, label]) => (
            <button
              aria-selected={tab === value}
              aria-controls={`stock-${vehicleType.toLocaleLowerCase()}-panel`}
              className={tab === value ? 'is-active' : ''}
              id={`stock-${vehicleType.toLocaleLowerCase()}-${value}-tab`}
              key={value}
              onKeyDown={(event) => {
                if (
                  event.key !== 'ArrowLeft' &&
                  event.key !== 'ArrowRight'
                ) {
                  return
                }
                event.preventDefault()
                const currentIndex = tabs.findIndex(
                  ([tabValue]) => tabValue === value,
                )
                const direction = event.key === 'ArrowRight' ? 1 : -1
                const next = tabs[
                  (currentIndex + direction + tabs.length) % tabs.length
                ]
                if (!next) return
                setTab(next[0])
                document
                  .getElementById(
                    `stock-${vehicleType.toLocaleLowerCase()}-${next[0]}-tab`,
                  )
                  ?.focus()
              }}
              onClick={() => setTab(value)}
              role="tab"
              tabIndex={tab === value ? 0 : -1}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="stock-filters">
          <label className="search-field">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Buscar por marca o modelo</span>
            <input
              aria-label="Buscar por marca o modelo"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Buscar ${vehicleType === 'MOTO' ? 'moto' : 'auto'}, chasis, proveedor u operación`}
              type="search"
              value={search}
            />
          </label>
          <label className="filter-field">
            <span className="sr-only">Condición</span>
            <select
              aria-label="Condición"
              onChange={(event) =>
                setCondition(
                  event.target.value as FilterValue<VehicleCondition>,
                )
              }
              value={condition}
            >
              <option value="ALL">Nuevos y usados</option>
              <option value="NUEVO">Nuevo / 0 km</option>
              <option value="USADO">Usado</option>
            </select>
          </label>
          {(tab === 'physical' || tab === 'supply') && (
            <label className="filter-field">
              <span className="sr-only">Sucursal</span>
              <select
                aria-label="Sucursal"
                onChange={(event) => setBranchId(event.target.value)}
                value={branchId}
              >
                <option value="ALL">Todas las sucursales</option>
                {data.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {tab === 'physical' && (
            <>
              <label className="filter-field">
                <span className="sr-only">Origen</span>
                <select
                  aria-label="Origen"
                  onChange={(event) =>
                    setOrigin(
                      event.target.value as FilterValue<AcquisitionOrigin>,
                    )
                  }
                  value={origin}
                >
                  <option value="ALL">Todos los orígenes</option>
                  <option value="PROVEEDOR">Proveedor</option>
                  <option value="TOMA_PARTE_PAGO">Parte de pago</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
              <label className="filter-field">
                <span className="sr-only">Estado de unidad</span>
                <select
                  aria-label="Estado de unidad"
                  onChange={(event) =>
                    setUnitStatus(
                      event.target.value as FilterValue<UnitStatus>,
                    )
                  }
                  value={unitStatus}
                >
                  <option value="ALL">Todos los estados</option>
                  {Object.entries(unitStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {tab === 'supply' && (
            <label className="filter-field">
              <span className="sr-only">Estado de abastecimiento</span>
              <select
                aria-label="Estado de abastecimiento"
                onChange={(event) =>
                  setSupplyStatus(
                    event.target.value as FilterValue<SupplyStatus>,
                  )
                }
                value={supplyStatus}
              >
                <option value="ALL">Todos los estados</option>
                {Object.entries(supplyStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {actionError && (
          <div className="inline-error" role="alert">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} type="button">
              Cerrar
            </button>
          </div>
        )}

        <div
          aria-labelledby={`stock-${vehicleType.toLocaleLowerCase()}-${tab}-tab`}
          className="stock-panel__content"
          id={`stock-${vehicleType.toLocaleLowerCase()}-panel`}
          role="tabpanel"
        >
          {tab === 'physical' && (
            <PhysicalUnits
              units={units}
              selected={selectedUnits}
              onToggle={toggleUnit}
              onToggleAll={toggleVisibleUnits}
            />
          )}
          {tab === 'catalog' && (
            <CatalogList
              catalog={catalog}
              units={data.units}
              canConfigurePrice={capabilities.createCatalog}
              onConfigurePrice={(item) => {
                setActionError(null)
                setPricing(item)
              }}
            />
          )}
          {tab === 'providers' && (
            <AvailabilityList
              canManage={capabilities.manageAvailability}
              items={availability}
              onEdit={(item) => {
                setActionError(null)
                setProviderModal(item)
              }}
            />
          )}
          {tab === 'supply' && (
            <SuppliesList
              supplies={supplies}
              capabilities={capabilities}
              busyId={busySupplyId}
              onTransition={(supply, status) =>
                void transitionSupply(supply, status)
              }
              onReceive={openReception}
            />
          )}
        </div>
      </section>

      <section aria-hidden="true" className="stock-label-sheet">
        {labelUnits.map((unit) => (
          <article className="stock-label" key={unit.id}>
            <strong>LUMA MOTOS · {unit.vehicleType}</strong>
            <span>{modelName(unit.catalogModel)}</span>
            <b>{unit.vin}</b>
            <small>{unit.branch.name}</small>
          </article>
        ))}
      </section>

      {unitModal && (
        <UnitFormModal
          branches={data.branches}
          canCreateCatalog={capabilities.createCatalog}
          catalog={data.catalog}
          error={actionError}
          onClose={() => setUnitModal(false)}
          onSubmit={(input) =>
            void runMutation(
              () => onCreateUnits(input),
              () => setUnitModal(false),
            )
          }
          submitting={busy}
          vehicleType={vehicleType}
        />
      )}
      {providerModal !== null && (
        <ProviderAvailabilityModal
          {...(providerModal === 'new'
            ? {}
            : { availability: providerModal })}
          catalog={data.catalog}
          canCreateCatalog={capabilities.createCatalog}
          error={actionError}
          onClose={() => setProviderModal(null)}
          onSubmit={(input) =>
            void runMutation(
              () => onUpsertAvailability(input),
              () => setProviderModal(null),
            )
          }
          submitting={busy}
          suppliers={data.suppliers}
          vehicleType={vehicleType}
        />
      )}
      {receiving && (
        <ReceiveSupplyModal
          branches={data.branches}
          error={actionError}
          onClose={() => setReceiving(null)}
          onSubmit={(input) =>
            void runMutation(
              () => onReceiveSupply(receiving.id, input),
              () => setReceiving(null),
            )
          }
          submitting={busy}
          supply={receiving}
        />
      )}
      {pricing && (
        <PricePolicyModal
          error={actionError}
          model={pricing}
          onClose={() => setPricing(null)}
          onSubmit={(input) =>
            void runMutation(
              () => onConfigurePrice(input),
              () => setPricing(null),
            )
          }
          submitting={busy}
        />
      )}
    </>
  )
}
