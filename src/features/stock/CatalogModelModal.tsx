import { ImagePlus, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { resolveMediaUrl } from '../../shared/api/client'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import type { CatalogModel, UpdateCatalogModelInput } from './types'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

type CatalogModelModalProps = {
  model: CatalogModel
  canEditSharedCatalog: boolean
  canManageCost: boolean
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: UpdateCatalogModelInput) => void
  onUploadPhoto: (file: File) => void
}

export function CatalogModelModal({
  model,
  canEditSharedCatalog,
  canManageCost,
  submitting,
  error,
  onClose,
  onSubmit,
  onUploadPhoto,
}: CatalogModelModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [validationError, setValidationError] = useState<string | null>(null)
  const photoUrl = resolveMediaUrl(model.photoUrl)

  const selectPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setValidationError('La foto debe ser JPEG, PNG o WEBP.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setValidationError('La foto no puede superar los 5 MB.')
      return
    }
    setValidationError(null)
    onUploadPhoto(file)
  }

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
    const costPriceRaw = String(data.get('costPrice') ?? '').trim()
    if (canManageCost && costPriceRaw) {
      const parsed = Number(costPriceRaw)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setValidationError('El precio de costo debe ser un número mayor o igual a 0.')
        return
      }
    }
    onSubmit({
      versionId: model.id,
      modelId: model.modelId,
      brandId: model.brandId,
      ...(canEditSharedCatalog ? { brandName, modelName } : {}),
      versionName,
      active: data.get('active') === 'on',
      ...(canManageCost && costPriceRaw
        ? { costPrice: Number(costPriceRaw) }
        : {}),
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

        <div className="catalog-photo-uploader">
          {photoUrl ? (
            <img alt={`Foto de ${model.model} ${model.version ?? ''}`} src={photoUrl} />
          ) : (
            <div className="catalog-photo-uploader__placeholder">
              <ImagePlus size={22} aria-hidden="true" />
              <span>Sin foto</span>
            </div>
          )}
          <label className="button button--secondary">
            {submitting && <LoaderCircle className="spin" size={15} />}
            {photoUrl ? 'Cambiar foto' : 'Subir foto'}
            <input
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={submitting}
              hidden
              onChange={selectPhoto}
              type="file"
            />
          </label>
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
            {canManageCost && (
              <label className="field">
                <span>Precio de costo</span>
                <input
                  defaultValue={model.costPrice ?? ''}
                  min={0}
                  name="costPrice"
                  placeholder="Sin cargar"
                  step="0.01"
                  type="number"
                />
              </label>
            )}
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
