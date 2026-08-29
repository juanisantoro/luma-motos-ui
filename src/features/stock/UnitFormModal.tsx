import {
  LoaderCircle,
  Minus,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useDialogFocus } from './dialog'
import type {
  CatalogModel,
  CatalogModelDraft,
  CreateUnitsInput,
  UnitDraft,
  VehicleCondition,
  VehicleKind,
} from './types'

type UnitFormModalProps = {
  vehicleType: VehicleKind
  catalog: CatalogModel[]
  branches: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  canCreateCatalog: boolean
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: CreateUnitsInput) => void
}

type UnitRow = {
  key: number
  vin: string
  branchId: string
  year: string
  mileage: string
  licensePlate: string
  receivedAt: string
}

const today = () => new Date().toISOString().slice(0, 10)

function emptyUnit(key: number, branchId = ''): UnitRow {
  return {
    key,
    vin: '',
    branchId,
    year: String(new Date().getFullYear()),
    mileage: '0',
    licensePlate: '',
    receivedAt: today(),
  }
}

export function UnitFormModal({
  vehicleType,
  catalog,
  branches,
  suppliers,
  canCreateCatalog,
  submitting,
  error,
  onClose,
  onSubmit,
}: UnitFormModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [condition, setCondition] = useState<VehicleCondition>('NUEVO')
  const [acquisitionOrigin, setAcquisitionOrigin] =
    useState<CreateUnitsInput['units'][number]['acquisitionOrigin']>('OTRO')
  const [supplierId, setSupplierId] = useState('')
  const [createCatalog, setCreateCatalog] = useState(false)
  const [catalogModelId, setCatalogModelId] = useState('')
  const [catalogDraft, setCatalogDraft] = useState<CatalogModelDraft>({
    brand: '',
    model: '',
    version: '',
  })
  const [units, setUnits] = useState<UnitRow[]>([
    emptyUnit(1, branches[0]?.id),
  ])
  const [validationError, setValidationError] = useState<string | null>(null)
  const vehicleLabel = vehicleType === 'AUTO' ? 'auto' : 'moto'
  const models = useMemo(
    () => catalog.filter((item) => item.vehicleType === vehicleType && item.active),
    [catalog, vehicleType],
  )

  const updateUnit = (key: number, patch: Partial<UnitRow>) => {
    setUnits((current) =>
      current.map((unit) => (unit.key === key ? { ...unit, ...patch } : unit)),
    )
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)
    const normalizedVins = units.map((unit) => unit.vin.trim().toUpperCase())
    if (new Set(normalizedVins).size !== normalizedVins.length) {
      setValidationError('Cada unidad debe tener un VIN o chasis diferente.')
      return
    }
    if (createCatalog && (!catalogDraft.brand.trim() || !catalogDraft.model.trim())) {
      setValidationError('Completá marca y modelo para crear el modelo.')
      return
    }
    if (!createCatalog && !catalogModelId) {
      setValidationError('Seleccioná un modelo del catálogo.')
      return
    }

    const unitDrafts: UnitDraft[] = units.map((unit) => ({
      vin: unit.vin.trim().toUpperCase(),
      branchId: unit.branchId,
      year: Number(unit.year),
      mileage: condition === 'NUEVO' ? 0 : Number(unit.mileage),
      receivedAt: unit.receivedAt,
      acquisitionOrigin,
      ...(acquisitionOrigin === 'PROVEEDOR' && supplierId
        ? { supplierId }
        : {}),
      ...(unit.licensePlate.trim()
        ? { licensePlate: unit.licensePlate.trim().toUpperCase() }
        : {}),
    }))
    onSubmit({
      vehicleType,
      condition,
      ...(createCatalog
        ? {
            catalogModel: {
              brand: catalogDraft.brand.trim(),
              model: catalogDraft.model.trim(),
              ...(catalogDraft.version?.trim()
                ? { version: catalogDraft.version.trim() }
                : {}),
            },
          }
        : { catalogModelId }),
      units: unitDrafts,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="stock-modal stock-modal--wide"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unit-modal-title"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">STOCK FÍSICO</p>
            <h2 id="unit-modal-title">
              Ingresar {vehicleType === 'AUTO' ? 'autos' : 'motos'}
            </h2>
            <p>
              Cada {vehicleLabel} queda identificada como una unidad real e
              irrepetible.
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar alta de unidades"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        {(validationError || error) && (
          <div className="form-alert form-alert--error" role="alert">
            {validationError ?? error}
          </div>
        )}

        <form onSubmit={submit}>
          <section className="stock-form-section">
            <div className="stock-form-section__heading">
              <span>1</span>
              <div>
                <h3>Modelo y condición</h3>
                <p>Elegí un modelo activo del catálogo y su condición real.</p>
              </div>
            </div>
            <div className="condition-switch" aria-label="Condición">
              <button
                className={condition === 'NUEVO' ? 'is-active' : ''}
                onClick={() => setCondition('NUEVO')}
                type="button"
              >
                Nuevo / 0 km
              </button>
              <button
                className={condition === 'USADO' ? 'is-active' : ''}
                onClick={() => setCondition('USADO')}
                type="button"
              >
                Usado
              </button>
            </div>

            {!createCatalog ? (
              <label className="field">
                <span>Marca, modelo y versión *</span>
                <select
                  aria-label="Marca, modelo y versión"
                  value={catalogModelId}
                  onChange={(event) => setCatalogModelId(event.target.value)}
                  required
                >
                  <option value="">Seleccionar del catálogo</option>
                  {models.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.brand} {item.model}
                      {item.version ? ` · ${item.version}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="stock-form-grid">
                <label className="field">
                  <span>Marca *</span>
                  <input
                    aria-label="Nueva marca"
                    value={catalogDraft.brand}
                    onChange={(event) =>
                      setCatalogDraft((current) => ({
                        ...current,
                        brand: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Modelo *</span>
                  <input
                    aria-label="Nuevo modelo"
                    value={catalogDraft.model}
                    onChange={(event) =>
                      setCatalogDraft((current) => ({
                        ...current,
                        model: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Versión</span>
                  <input
                    aria-label="Nueva versión"
                    value={catalogDraft.version}
                    onChange={(event) =>
                      setCatalogDraft((current) => ({
                        ...current,
                        version: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            )}

            <div className="stock-form-grid">
              <label className="field">
                <span>Origen de adquisición *</span>
                <select
                  aria-label="Origen de adquisición"
                  value={acquisitionOrigin}
                  onChange={(event) =>
                    setAcquisitionOrigin(
                      event.target.value as typeof acquisitionOrigin,
                    )
                  }
                  required
                >
                  <option value="PROVEEDOR">Proveedor</option>
                  <option value="TOMA_PARTE_PAGO">
                    Toma como parte de pago
                  </option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
              {acquisitionOrigin === 'PROVEEDOR' && (
                <label className="field">
                  <span>Proveedor</span>
                  <select
                    aria-label="Proveedor de las unidades"
                    value={supplierId}
                    onChange={(event) => setSupplierId(event.target.value)}
                  >
                    <option value="">Sin proveedor identificado</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {canCreateCatalog ? (
              <button
                className="button button--quiet"
                type="button"
                onClick={() => setCreateCatalog((current) => !current)}
              >
                {createCatalog ? 'Usar modelo existente' : 'Crear marca y modelo'}
              </button>
            ) : (
              <p className="permission-note">
                <ShieldCheck size={16} aria-hidden="true" />
                El alta de marcas y modelos requiere un permiso adicional.
              </p>
            )}
          </section>

          <section className="stock-form-section">
            <div className="stock-form-section__heading">
              <span>2</span>
              <div>
                <h3>Unidades físicas</h3>
                <p>Podés ingresar varias unidades del mismo modelo.</p>
              </div>
              <button
                className="button button--secondary"
                onClick={() =>
                  setUnits((current) => [
                    ...current,
                    emptyUnit(
                      Math.max(...current.map((unit) => unit.key)) + 1,
                      branches[0]?.id,
                    ),
                  ])
                }
                type="button"
              >
                <Plus size={17} />
                Agregar unidad
              </button>
            </div>

            <div className="unit-drafts">
              {units.map((unit, index) => (
                <fieldset className="unit-draft" key={unit.key}>
                  <legend>Unidad {index + 1}</legend>
                  <div className="stock-form-grid stock-form-grid--unit">
                    <label className="field field--wide">
                      <span>VIN / chasis real *</span>
                      <input
                        aria-label={`VIN / chasis unidad ${index + 1}`}
                        value={unit.vin}
                        onChange={(event) =>
                          updateUnit(unit.key, { vin: event.target.value })
                        }
                        minLength={6}
                        maxLength={64}
                        autoCapitalize="characters"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Sucursal *</span>
                      <select
                        aria-label={`Sucursal unidad ${index + 1}`}
                        value={unit.branchId}
                        onChange={(event) =>
                          updateUnit(unit.key, {
                            branchId: event.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Seleccionar</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Año *</span>
                      <input
                        aria-label={`Año unidad ${index + 1}`}
                        value={unit.year}
                        onChange={(event) =>
                          updateUnit(unit.key, { year: event.target.value })
                        }
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        type="number"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Kilómetros *</span>
                      <input
                        aria-label={`Kilómetros unidad ${index + 1}`}
                        value={condition === 'NUEVO' ? '0' : unit.mileage}
                        onChange={(event) =>
                          updateUnit(unit.key, { mileage: event.target.value })
                        }
                        disabled={condition === 'NUEVO'}
                        min="0"
                        type="number"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Patente</span>
                      <input
                        aria-label={`Patente unidad ${index + 1}`}
                        value={unit.licensePlate}
                        onChange={(event) =>
                          updateUnit(unit.key, {
                            licensePlate: event.target.value,
                          })
                        }
                        maxLength={12}
                      />
                    </label>
                    <label className="field">
                      <span>Fecha de ingreso *</span>
                      <input
                        aria-label={`Fecha de ingreso unidad ${index + 1}`}
                        value={unit.receivedAt}
                        onChange={(event) =>
                          updateUnit(unit.key, {
                            receivedAt: event.target.value,
                          })
                        }
                        type="date"
                        required
                      />
                    </label>
                  </div>
                  <button
                    className="button button--danger-quiet"
                    aria-label={`Quitar unidad ${index + 1}`}
                    disabled={units.length === 1}
                    onClick={() =>
                      setUnits((current) =>
                        current.filter((item) => item.key !== unit.key),
                      )
                    }
                    type="button"
                  >
                    <Minus size={17} />
                    Quitar
                  </button>
                </fieldset>
              ))}
            </div>
          </section>

          <footer className="stock-modal__actions">
            <button
              className="button button--secondary"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={submitting}
              type="submit"
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting
                ? 'Ingresando…'
                : `Ingresar ${units.length} ${units.length === 1 ? 'unidad' : 'unidades'}`}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
