import { LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import type { CatalogModel, UpdateCatalogModelInput } from './types'

type CatalogModelModalProps = {
  model: CatalogModel
  canEditSharedCatalog: boolean
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: UpdateCatalogModelInput) => void
}

export function CatalogModelModal({
  model,
  canEditSharedCatalog,
  submitting,
  error,
  onClose,
  onSubmit,
}: CatalogModelModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [validationError, setValidationError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)
    const data = new FormData(event.currentTarget)
    const brandName = String(data.get('brandName') ?? '').trim()
    const modelName = String(data.get('modelName') ?? '').trim()
    const versionName = String(data.get('versionName') ?? '').trim()
    if (!versionName || (canEditSharedCatalog && (!brandName || !modelName))) {
      setValidationError('Completá marca, modelo y versión.')
      return
    }
    onSubmit({
      versionId: model.id,
      modelId: model.modelId,
      brandId: model.brandId,
      ...(canEditSharedCatalog ? { brandName, modelName } : {}),
      versionName,
      active: data.get('active') === 'on',
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="catalog-model-modal-title"
        aria-modal="true"
        className="stock-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">CATÁLOGO</p>
            <h2 id="catalog-model-modal-title">Editar modelo</h2>
            <p>{model.vehicleType === 'MOTO' ? 'Circuito MOTO' : 'Circuito AUTO'}</p>
          </div>
          <button
            aria-label="Cerrar edición de modelo"
            className="icon-button"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        <div className="permission-note">
          <TriangleAlert size={17} aria-hidden="true" />
          Marca y modelo pueden estar referenciados por otras versiones. Los
          cambios no modifican operaciones históricas.
          {!canEditSharedCatalog &&
            ' Tu alcance permite editar la versión; marca y modelo globales quedan protegidos.'}
        </div>

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
                defaultValue={model.brand}
                disabled={!canEditSharedCatalog}
                name="brandName"
                required={canEditSharedCatalog}
              />
            </label>
            <label className="field">
              <span>Modelo *</span>
              <input
                defaultValue={model.model}
                disabled={!canEditSharedCatalog}
                name="modelName"
                required={canEditSharedCatalog}
              />
            </label>
            <label className="field field--wide">
              <span>Versión *</span>
              <input
                defaultValue={model.version ?? model.model}
                name="versionName"
                required
              />
            </label>
            <label className="check stock-new-product-check field--wide">
              <input defaultChecked={model.active} name="active" type="checkbox" />
              Versión activa
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
              {submitting ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
