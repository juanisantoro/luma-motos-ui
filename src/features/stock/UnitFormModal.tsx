import { LoaderCircle, Minus, Plus, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { listUnitColors } from './api'
import { UNIT_FINISHES } from './colors'
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
  color: string
  acabado: string
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
    color: '',
    acabado: '',
    receivedAt: today(),
  }
}

const emptyCatalogDraft = (
  scope: CatalogModelDraft['scope'],
): CatalogModelDraft => ({
  brandName: '',
  modelName: '',
  versionName: '',
  scope,
  listPrice: 0,
  minimumPrice: 0,
})

export function UnitFormModal({
  vehicleType,
  catalog,
  branches,
  canCreateCatalog,
  submitting,
  error,
  onClose,
  onSubmit,
}: UnitFormModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [condition, setCondition] = useState<VehicleCondition>('NUEVO')
  const [createCatalog, setCreateCatalog] = useState(false)
  const [catalogModelId, setCatalogModelId] = useState('')
  const [catalogDraft, setCatalogDraft] = useState<CatalogModelDraft>(() =>
    emptyCatalogDraft('RESTRINGIDO'),
  )
  const [units, setUnits] = useState<UnitRow[]>([
    emptyUnit(1, branches[0]?.id),
  ])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [colorOptions, setColorOptions] = useState<
    { id: string; name: string }[]
  >([])
  const [colorsLoading, setColorsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setColorsLoading(true)
    listUnitColors(controller.signal)
      .then((options) => {
        if (controller.signal.aborted) return
        setColorOptions(options)
        setColorsLoading(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setColorsLoading(false)
      })
    return () => controller.abort()
  }, [])
  const noun = vehicleType === 'AUTO' ? 'autos' : 'motos'
  const singular = vehicleType === 'AUTO' ? 'auto' : 'moto'
  const activeCatalog = useMemo(
    () =>
      catalog.filter(
        (item) => item.vehicleType === vehicleType && item.active,
      ),
    [catalog, vehicleType],
  )

  const updateUnit = (key: number, patch: Partial<UnitRow>) => {
    setUnits((current) =>
      current.map((unit) => (unit.key === key ? { ...unit, ...patch } : unit)),
    )
  }

  const updateDraft = (patch: Partial<CatalogModelDraft>) => {
    setCatalogDraft((current) => ({ ...current, ...patch }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)
    const normalizedVins = units.map((unit) => unit.vin.trim().toUpperCase())
    if (normalizedVins.some((vin) => !vin)) {
      setValidationError('Cada unidad física debe tener chasis o VIN.')
      return
    }
    if (new Set(normalizedVins).size !== normalizedVins.length) {
      setValidationError('Cada unidad debe tener un VIN o chasis diferente.')
      return
    }
    if (createCatalog) {
      const brandName = catalogDraft.brandName?.trim()
      const modelName = catalogDraft.modelName?.trim()
      if (!brandName || !modelName) {
        setValidationError('Completá marca y modelo.')
        return
      }
      if (
        catalogDraft.listPrice <= 0 ||
        catalogDraft.minimumPrice <= 0 ||
        catalogDraft.minimumPrice > catalogDraft.listPrice
      ) {
        setValidationError(
          'Configurá un precio sugerido y un precio mínimo válidos.',
        )
        return
      }
    } else if (!catalogModelId) {
      setValidationError('Seleccioná una marca y modelo con precio vigente.')
      return
    }

    const unitDrafts: UnitDraft[] = units.map((unit) => ({
      vin: unit.vin.trim().toUpperCase(),
      branchId: unit.branchId,
      year: Number(unit.year),
      mileage: condition === 'NUEVO' ? 0 : Number(unit.mileage),
      receivedAt: unit.receivedAt,
      acquisitionOrigin: 'OTRO',
      ...(vehicleType === 'AUTO' && unit.licensePlate.trim()
        ? { licensePlate: unit.licensePlate.trim().toUpperCase() }
        : {}),
      ...(unit.color.trim() ? { color: unit.color.trim() } : {}),
      ...(unit.acabado.trim() ? { acabado: unit.acabado.trim() } : {}),
    }))
    onSubmit({
      vehicleType,
      condition,
      ...(createCatalog
        ? {
            catalogModel: {
              ...catalogDraft,
              brandName: catalogDraft.brandName!.trim(),
              modelName: catalogDraft.modelName!.trim(),
              versionName: catalogDraft.modelName!.trim(),
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
            <h2 id="unit-modal-title">Ingresar {noun} al stock</h2>
            <p>
              Cada {singular} presente en una sucursal debe quedar identificada
              por su chasis.
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
                <h3>Marca y modelo de {singular}</h3>
                <p>
                  Elegí un modelo del catálogo. El estado de precio se informa
                  sin ocultar modelos existentes.
                </p>
              </div>
            </div>

            {!createCatalog && (
              <label className="field field--wide">
                <span>Marca y modelo *</span>
                <select
                  aria-label="Marca y modelo"
                  value={catalogModelId}
                  onChange={(event) => setCatalogModelId(event.target.value)}
                  required
                >
                  <option value="">
                    Seleccionar del catálogo de {noun}
                  </option>
                  {activeCatalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.brand} {item.model}
                      {item.version && item.version !== item.model
                        ? ` · ${item.version}`
                        : ''}
                      {!item.pricePolicy ? ' · Sin precio configurado' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!createCatalog && activeCatalog.length === 0 && (
              <div className="stock-catalog-empty field--wide" role="status">
                <strong>No hay modelos cargados</strong>
                <span>
                  {canCreateCatalog
                    ? 'Marcá “La marca o modelo no existe” para crearlo con su política de precio.'
                    : 'Solicitá a un usuario autorizado que cargue el catálogo.'}
                </span>
              </div>
            )}

            {canCreateCatalog ? (
              <label className="check stock-new-product-check">
                <input
                  checked={createCatalog}
                  onChange={(event) => {
                    setCreateCatalog(event.target.checked)
                    setCatalogModelId('')
                  }}
                  type="checkbox"
                />
                La marca o modelo no existe
              </label>
            ) : (
              <p className="permission-note">
                <ShieldCheck size={16} aria-hidden="true" />
                El alta de marcas, modelos y precios requiere un permiso
                adicional.
              </p>
            )}

            {createCatalog && (
              <div className="stock-form-grid">
                <label className="field">
                  <span>Tipo de vehículo</span>
                  <input value={vehicleType === 'AUTO' ? 'Auto' : 'Moto'} readOnly />
                </label>
                <label className="field">
                  <span>Marca *</span>
                  <input
                    aria-label="Nueva marca"
                    value={catalogDraft.brandName}
                    onChange={(event) =>
                      updateDraft({ brandName: event.target.value })
                    }
                    placeholder={vehicleType === 'AUTO' ? 'Ej. Toyota' : 'Ej. Honda'}
                    required
                  />
                </label>
                <label className="field">
                  <span>Modelo *</span>
                  <input
                    aria-label="Nuevo modelo"
                    value={catalogDraft.modelName}
                    onChange={(event) =>
                      updateDraft({ modelName: event.target.value })
                    }
                    placeholder={
                      vehicleType === 'AUTO' ? 'Ej. Etios XLS' : 'Ej. Wave 110 S'
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Precio sugerido *</span>
                  <input
                    aria-label="Precio sugerido"
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={catalogDraft.listPrice || ''}
                    onChange={(event) =>
                      updateDraft({ listPrice: Number(event.target.value) })
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Precio mínimo *</span>
                  <input
                    aria-label="Precio mínimo"
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={catalogDraft.minimumPrice || ''}
                    onChange={(event) =>
                      updateDraft({ minimumPrice: Number(event.target.value) })
                    }
                    required
                  />
                </label>
              </div>
            )}
          </section>

          <section className="stock-form-section">
            <div className="stock-form-section__heading">
              <span>2</span>
              <div>
                <h3>Condición de las unidades</h3>
                <p>
                  La condición corresponde a cada unidad física, no al modelo
                  del catálogo.
                </p>
              </div>
            </div>
            <div className="condition-switch" aria-label="Condición">
              <button
                className={condition === 'NUEVO' ? 'is-active' : ''}
                onClick={() => setCondition('NUEVO')}
                type="button"
              >
                0 km / Nuevo
              </button>
              <button
                className={condition === 'USADO' ? 'is-active' : ''}
                onClick={() => setCondition('USADO')}
                type="button"
              >
                Usado
              </button>
            </div>
          </section>

          <section className="stock-form-section">
            <div className="stock-form-section__heading">
              <span>3</span>
              <div>
                <h3>Unidades a ingresar</h3>
                <p>Podés cargar varias del mismo modelo de una sola vez.</p>
              </div>
              <button
                className="button button--secondary"
                disabled={units.length >= 100}
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
                    <label className="field">
                      <span>Chasis / VIN *</span>
                      <input
                        aria-label={`Chasis / VIN unidad ${index + 1}`}
                        value={unit.vin}
                        onChange={(event) =>
                          updateUnit(unit.key, { vin: event.target.value })
                        }
                        minLength={6}
                        maxLength={64}
                        autoCapitalize="characters"
                        placeholder="Identificador único"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Sucursal *</span>
                      <select
                        aria-label={`Sucursal unidad ${index + 1}`}
                        value={unit.branchId}
                        onChange={(event) =>
                          updateUnit(unit.key, { branchId: event.target.value })
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
                      <span>Fecha de ingreso</span>
                      <input
                        aria-label={`Fecha de ingreso unidad ${index + 1}`}
                        value={unit.receivedAt}
                        onChange={(event) =>
                          updateUnit(unit.key, { receivedAt: event.target.value })
                        }
                        type="date"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Año</span>
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
                      <span>Kilómetros</span>
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
                    {vehicleType === 'AUTO' && (
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
                          placeholder="Opcional"
                        />
                      </label>
                    )}
                    <label className="field">
                      <span>Color</span>
                      <select
                        aria-label={`Color unidad ${index + 1}`}
                        disabled={colorsLoading}
                        value={unit.color}
                        onChange={(event) =>
                          updateUnit(unit.key, { color: event.target.value })
                        }
                      >
                        <option value="">
                          {colorsLoading ? 'Cargando…' : 'Sin especificar'}
                        </option>
                        {colorOptions.map((option) => (
                          <option key={option.id} value={option.name}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Acabado</span>
                      <select
                        aria-label={`Acabado unidad ${index + 1}`}
                        value={unit.acabado}
                        onChange={(event) =>
                          updateUnit(unit.key, { acabado: event.target.value })
                        }
                      >
                        <option value="">Sin especificar</option>
                        {UNIT_FINISHES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
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
