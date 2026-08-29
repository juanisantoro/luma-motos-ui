import { LoaderCircle, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDialogFocus } from './dialog'
import type {
  CatalogModel,
  SupplierOption,
  UpsertAvailabilityInput,
  VehicleCondition,
  VehicleKind,
} from './types'

type ProviderAvailabilityModalProps = {
  vehicleType: VehicleKind
  catalog: CatalogModel[]
  suppliers: SupplierOption[]
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: UpsertAvailabilityInput) => void
}

export function ProviderAvailabilityModal({
  vehicleType,
  catalog,
  suppliers,
  submitting,
  error,
  onClose,
  onSubmit,
}: ProviderAvailabilityModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [condition, setCondition] = useState<VehicleCondition>('NUEVO')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const notes = String(data.get('notes') ?? '').trim()
    onSubmit({
      vehicleType,
      condition,
      catalogModelId: String(data.get('catalogModelId')),
      supplierId: String(data.get('supplierId')),
      quantity: Number(data.get('quantity')),
      ...(notes ? { notes } : {}),
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="stock-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-modal-title"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">PROVEEDORES</p>
            <h2 id="availability-modal-title">Informar disponibilidad</h2>
            <p>
              Registrá modelos y cantidades informadas. Esto no crea stock físico.
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

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="separation-note">
          Las unidades de proveedor no tienen VIN ni sucursal hasta su recepción.
        </div>

        <form onSubmit={submit}>
          <div className="stock-form-grid">
            <label className="field">
              <span>Proveedor *</span>
              <select name="supplierId" required>
                <option value="">Seleccionar</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Marca, modelo y versión *</span>
              <select name="catalogModelId" required>
                <option value="">Seleccionar</option>
                {catalog
                  .filter(
                    (item) =>
                      item.vehicleType === vehicleType && item.active,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.brand} {item.model}
                      {item.version ? ` · ${item.version}` : ''}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Condición *</span>
              <select
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
              <span>Cantidad disponible *</span>
              <input name="quantity" min="0" type="number" required />
            </label>
            <label className="field field--wide">
              <span>Observaciones</span>
              <textarea
                name="notes"
                maxLength={1000}
                placeholder="Plazo de entrega, colores o condiciones informadas"
                rows={3}
              />
            </label>
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
              {submitting ? 'Guardando…' : 'Guardar disponibilidad'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
