import {
  Bike,
  CarFront,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Search,
  Store,
  Warehouse,
} from 'lucide-react'
import { useMemo } from 'react'
import type { PhysicalUnit, SupplierAvailability } from '../stock/types'

export type OperationVehicleOption =
  | { key: string; source: 'PHYSICAL'; unit: PhysicalUnit }
  | { key: string; source: 'SUPPLIER'; availability: SupplierAvailability }

type VehicleSourceError = {
  source: string
  message: string
}

function versionLabel(option: OperationVehicleOption) {
  const model =
    option.source === 'PHYSICAL'
      ? option.unit.catalogModel
      : option.availability.catalogModel
  return [model.brand, model.model, model.version].filter(Boolean).join(' ')
}

export function vehicleOptionSearchText(option: OperationVehicleOption) {
  if (option.source === 'PHYSICAL') {
    const { unit } = option
    return [
      versionLabel(option),
      unit.condition,
      unit.branch.name,
      unit.vin,
      unit.licensePlate,
      'stock físico',
    ]
      .filter(Boolean)
      .join(' ')
  }
  const { availability } = option
  return [
    versionLabel(option),
    availability.condition,
    availability.supplier.name,
    'proveedor disponibilidad',
  ].join(' ')
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim()
}

export function OperationVehiclePicker({
  vehicleType,
  options,
  selectedKey,
  search,
  loading,
  errors,
  onSearch,
  onSelect,
  onRetry,
  minSearchLength = 3,
}: {
  vehicleType: 'MOTO' | 'AUTO'
  options: OperationVehicleOption[]
  selectedKey: string
  search: string
  loading: boolean
  errors: VehicleSourceError[]
  onSearch: (value: string) => void
  onSelect: (option: OperationVehicleOption) => void
  onRetry: () => void
  minSearchLength?: number
}) {
  const filtered = useMemo(() => {
    const query = normalizeSearch(search)
    if (!query) return options
    return options.filter((option) =>
      normalizeSearch(vehicleOptionSearchText(option)).includes(query),
    )
  }, [options, search])

  const belowMinLength = normalizeSearch(search).length < minSearchLength

  const TypeIcon = vehicleType === 'MOTO' ? Bike : CarFront

  return (
    <div className="operation-vehicle-picker">
      <label className="field">
        <span>Buscar vehículo *</span>
        <div className="operation-vehicle-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-controls="operation-vehicle-results"
            aria-expanded={filtered.length > 0}
            aria-label="Buscar vehículo *"
            autoComplete="off"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Marca, modelo, versión, chasis o sucursal"
            role="combobox"
            value={search}
          />
        </div>
        <small>
          Resultados exclusivos del circuito de{' '}
          {vehicleType === 'MOTO' ? 'motos' : 'autos'}. Ingresá al menos{' '}
          {minSearchLength} letras para buscar.
        </small>
      </label>

      {loading ? (
        <div className="operation-vehicle-skeleton" role="status">
          <LoaderCircle className="spin" size={20} aria-hidden="true" />
          <span>Cargando stock físico y disponibilidad de proveedores…</span>
          <i />
          <i />
        </div>
      ) : (
        <>
          {errors.length > 0 && (
            <div className="operation-resource-error" role="alert">
              <div>
                <strong>No se pudo cargar toda la disponibilidad</strong>
                {errors.map((error) => (
                  <p key={error.source}>
                    <b>{error.source}:</b> {error.message}
                  </p>
                ))}
              </div>
              <button className="button button--secondary" onClick={onRetry} type="button">
                <RefreshCw size={16} aria-hidden="true" />
                Reintentar
              </button>
            </div>
          )}

          <div
            aria-label="Vehículos disponibles"
            className="operation-vehicle-results"
            id="operation-vehicle-results"
            role="listbox"
          >
            {filtered.map((option) => {
              const selected = selectedKey === option.key
              const physical = option.source === 'PHYSICAL'
              const branch = physical ? option.unit.branch.name : null
              const supplier = physical ? null : option.availability.supplier.name
              const condition = physical
                ? option.unit.condition
                : option.availability.condition
              return (
                <button
                  aria-selected={selected}
                  className={selected ? 'is-selected' : ''}
                  key={option.key}
                  onClick={() => onSelect(option)}
                  role="option"
                  type="button"
                >
                  <span className="operation-vehicle-results__icon">
                    {physical ? <Warehouse size={19} /> : <Store size={19} />}
                  </span>
                  <span>
                    <strong>{versionLabel(option)}</strong>
                    <small>
                      {condition === 'NUEVO' ? 'Nuevo' : 'Usado'} ·{' '}
                      {physical
                        ? `${branch} · Chasis ${option.unit.vin}`
                        : `Stock de ${supplier} (${option.availability.quantity}) · Chasis al recibir`}
                    </small>
                  </span>
                  <span className="operation-vehicle-results__source">
                    {physical
                      ? 'Disponible · Stock físico'
                      : 'Disponibilidad proveedor'}
                  </span>
                  {selected && <CheckCircle2 size={19} aria-hidden="true" />}
                </button>
              )
            })}
            {filtered.length === 0 && belowMinLength && (
              <div className="operation-vehicle-empty">
                <TypeIcon size={22} aria-hidden="true" />
                <strong>Seguí escribiendo para buscar</strong>
                <span>
                  Ingresá al menos {minSearchLength} letras de la marca, modelo, versión, chasis o sucursal.
                </span>
              </div>
            )}
            {filtered.length === 0 && !belowMinLength && (
              <div className="operation-vehicle-empty">
                <TypeIcon size={22} aria-hidden="true" />
                <strong>No hay coincidencias</strong>
                <span>
                  Probá otra marca, modelo, chasis o sucursal, o reintentá la carga.
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
