import { LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import type {
  CatalogModel,
  CatalogModelDraft,
  SupplierAvailability,
  SupplierOption,
  UpsertAvailabilityInput,
  VehicleCondition,
  VehicleKind,
} from './types'

type ProviderAvailabilityModalProps = {
  vehicleType: VehicleKind
  catalog: CatalogModel[]
  suppliers: SupplierOption[]
  canCreateCatalog: boolean
  submitting: boolean
  error: string | null
  availability?: SupplierAvailability
  onClose: () => void
  onSubmit: (input: UpsertAvailabilityInput) => void
}

const today = () => new Date().toISOString().slice(0, 10)

export function ProviderAvailabilityModal({
  vehicleType,
  catalog,
  suppliers,
  canCreateCatalog,
  submitting,
  error,
  availability,
  onClose,
  onSubmit,
}: ProviderAvailabilityModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [condition, setCondition] = useState<VehicleCondition>(
    availability?.condition ?? 'NUEVO',
  )
  const [createCatalog, setCreateCatalog] = useState(false)
  const [catalogModelId, setCatalogModelId] = useState(
    availability?.catalogModel.id ?? '',
  )
  const [draft, setDraft] = useState<CatalogModelDraft>({
    brandName: '',
    modelName: '',
    versionName: '',
    scope: 'RESTRINGIDO',
    listPrice: 0,
    minimumPrice: 0,
  })
  const [validationError, setValidationError] = useState<string | null>(null)
  const noun = vehicleType === 'AUTO' ? 'autos' : 'motos'
  const activeCatalog = useMemo(
    () =>
      catalog.filter(
        (item) => item.vehicleType === vehicleType && item.active,
      ),
    [catalog, vehicleType],
  )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)
    const data = new FormData(event.currentTarget)
    if (createCatalog) {
      if (!draft.brandName?.trim() || !draft.modelName?.trim()) {
        setValidationError('Completá marca y modelo.')
        return
      }
      if (
        draft.listPrice <= 0 ||
        draft.minimumPrice <= 0 ||
        draft.minimumPrice > draft.listPrice
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
    const notes = String(data.get('notes') ?? '').trim()
    onSubmit({
      vehicleType,
      condition,
      ...(createCatalog
        ? {
            catalogModel: {
              ...draft,
              brandName: draft.brandName!.trim(),
              modelName: draft.modelName!.trim(),
              versionName: draft.modelName!.trim(),
            },
          }
        : { catalogModelId }),
      supplierId: String(data.get('supplierId')),
      quantity: Number(data.get('quantity')),
      reportedAt: String(data.get('reportedAt')),
      ...(notes ? { notes } : {}),
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="stock-modal stock-modal--wide"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-modal-title"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">PROVEEDORES</p>
            <h2 id="availability-modal-title">
              {availability
                ? 'Actualizar disponibilidad'
                : `Informar ${noun} de proveedor`}
            </h2>
            <p>
              Se registra disponibilidad por modelo y cantidad. El chasis se
              asignará cuando llegue la unidad.
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar disponibilidad"
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
          <div className="stock-form-grid">
            {!createCatalog && (
              <label className="field field--wide">
                <span>Marca y modelo *</span>
                <select
                  aria-label="Marca y modelo"
                  disabled={Boolean(availability)}
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

            {!availability && canCreateCatalog && (
              <label className="check stock-new-product-check field--wide">
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
            )}
            {!availability && !canCreateCatalog && (
              <p className="permission-note field--wide">
                <ShieldCheck size={16} aria-hidden="true" />
                El alta de marcas, modelos y precios requiere un permiso
                adicional.
              </p>
            )}

            {createCatalog && (
              <>
                <label className="field">
                  <span>Tipo de vehículo</span>
                  <input value={vehicleType === 'AUTO' ? 'Auto' : 'Moto'} readOnly />
                </label>
                <label className="field">
                  <span>Marca *</span>
                  <input
                    aria-label="Nueva marca"
                    value={draft.brandName}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        brandName: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Modelo *</span>
                  <input
                    aria-label="Nuevo modelo"
                    value={draft.modelName}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        modelName: event.target.value,
                      }))
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
                    value={draft.listPrice || ''}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        listPrice: Number(event.target.value),
                      }))
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
                    value={draft.minimumPrice || ''}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        minimumPrice: Number(event.target.value),
                      }))
                    }
                    required
                  />
                </label>
              </>
            )}

            <label className="field">
              <span>Proveedor *</span>
              <select
                defaultValue={availability?.supplier.id ?? ''}
                name="supplierId"
                required
              >
                <option value="">Seleccionar</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cantidad informada *</span>
              <input
                defaultValue={availability?.quantity ?? 1}
                name="quantity"
                min="0"
                type="number"
                required
              />
            </label>
            <label className="field">
              <span>Condición</span>
              <select
                aria-label="Condición de disponibilidad"
                value={condition}
                onChange={(event) =>
                  setCondition(event.target.value as VehicleCondition)
                }
              >
                <option value="NUEVO">Nuevo / 0 km</option>
                <option value="USADO">Usado</option>
              </select>
            </label>
            <label className="field">
              <span>Fecha de actualización</span>
              <input
                defaultValue={
                  availability?.updatedAt.slice(0, 10) ?? today()
                }
                name="reportedAt"
                type="date"
                required
              />
            </label>
            <label className="field field--wide">
              <span>Observaciones</span>
              <input
                name="notes"
                defaultValue={availability?.notes ?? ''}
                maxLength={1000}
                placeholder="Plazo de entrega, colores, condiciones..."
              />
            </label>
          </div>

          <div className="separation-note">
            <strong>Sin chasis:</strong>
            <span>
              Esta disponibilidad puede utilizarse en una operación, pero no
              será una unidad física hasta registrar su recepción.
            </span>
          </div>

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
                ? 'Guardando…'
                : availability
                  ? 'Actualizar disponibilidad'
                  : 'Guardar disponibilidad'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
