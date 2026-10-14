import { LoaderCircle, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import type { CatalogModel, CreateCatalogModelInput, VehicleKind } from './types'

type NewCatalogModelModalProps = {
  vehicleType: VehicleKind
  catalog: CatalogModel[]
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: CreateCatalogModelInput) => void
}

const same = (left: string | null | undefined, right: string) =>
  (left ?? '').trim().localeCompare(right.trim(), 'es', { sensitivity: 'base' }) === 0

/**
 * Alta de un modelo en el catálogo con su precio, sin unidades: para poder
 * venderlo o pedirlo al proveedor antes de que llegue la primera.
 */
export function NewCatalogModelModal({
  vehicleType,
  catalog,
  submitting,
  error,
  onClose,
  onSubmit,
}: NewCatalogModelModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [validationError, setValidationError] = useState<string | null>(null)
  const singular = vehicleType === 'AUTO' ? 'auto' : 'moto'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)
    const data = new FormData(event.currentTarget)
    const brandName = String(data.get('brandName') ?? '').trim()
    const modelName = String(data.get('modelName') ?? '').trim()
    // Sin versión, la versión es el mismo modelo (y no se muestra aparte).
    const versionName = String(data.get('versionName') ?? '').trim() || modelName
    const listPrice = Number(data.get('listPrice'))
    const minimumPrice = Number(data.get('minimumPrice'))
    if (!brandName || !modelName) {
      setValidationError('Completá marca y modelo.')
      return
    }
    if (!(listPrice > 0) || !(minimumPrice > 0)) {
      setValidationError('Cargá el precio de lista y el mínimo.')
      return
    }
    if (minimumPrice > listPrice) {
      setValidationError('El precio mínimo no puede ser mayor que el de lista.')
      return
    }
    const existing = catalog.find(
      (item) =>
        item.vehicleType === vehicleType &&
        same(item.brand, brandName) &&
        same(item.model, modelName) &&
        (same(item.version, versionName) || (!item.version && same(modelName, versionName))),
    )
    if (existing) {
      setValidationError(
        'Ese modelo ya está en el catálogo. Para cambiarle el precio, buscalo en Catálogo de modelos y tocá Actualizar precios.',
      )
      return
    }
    onSubmit({
      vehicleType,
      catalogModel: {
        brandName,
        modelName,
        versionName,
        scope: 'RESTRINGIDO',
        listPrice,
        minimumPrice,
      },
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="new-catalog-model-title"
        aria-modal="true"
        className="stock-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">CATÁLOGO</p>
            <h2 id="new-catalog-model-title">Nuevo modelo de {singular}</h2>
            <p>
              Queda en el catálogo con su precio, sin stock. Las unidades se cargan después,
              cuando lleguen.
            </p>
          </div>
          <button
            aria-label="Cerrar nuevo modelo"
            className="icon-button"
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
            <label className="field">
              <span>Marca *</span>
              <input
                autoCapitalize="characters"
                name="brandName"
                placeholder={vehicleType === 'AUTO' ? 'Ej. Toyota' : 'Ej. Hero'}
                required
              />
            </label>
            <label className="field">
              <span>Modelo *</span>
              <input
                name="modelName"
                placeholder={vehicleType === 'AUTO' ? 'Ej. Etios' : 'Ej. NEX 125'}
                required
              />
            </label>
            <label className="field">
              <span>Versión</span>
              <input name="versionName" placeholder="Opcional" />
            </label>
            <label className="field">
              <span>Precio de lista *</span>
              <input min="0.01" name="listPrice" required step="0.01" type="number" />
            </label>
            <label className="field">
              <span>Precio mínimo *</span>
              <input min="0.01" name="minimumPrice" required step="0.01" type="number" />
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
            <button className="button button--primary" disabled={submitting} type="submit">
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Creando…' : 'Crear modelo'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
