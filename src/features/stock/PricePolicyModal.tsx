import { LoaderCircle, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import type { CatalogModel, ConfigurePriceInput } from './types'

type PricePolicyModalProps = {
  model: CatalogModel
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: ConfigurePriceInput) => void
}

export function PricePolicyModal({
  model,
  submitting,
  error,
  onClose,
  onSubmit,
}: PricePolicyModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [validationError, setValidationError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)
    const data = new FormData(event.currentTarget)
    const listPrice = Number(data.get('listPrice'))
    const minimumPrice = Number(data.get('minimumPrice'))
    if (listPrice <= 0 || minimumPrice <= 0 || minimumPrice > listPrice) {
      setValidationError(
        'Ingresá precios válidos; el mínimo no puede superar al sugerido.',
      )
      return
    }
    onSubmit({ versionId: model.id, listPrice, minimumPrice })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="stock-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-policy-modal-title"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">CATÁLOGO</p>
            <h2 id="price-policy-modal-title">Configurar precio</h2>
            <p>
              {model.brand} {model.model}
              {model.version && model.version !== model.model
                ? ` · ${model.version}`
                : ''}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar configuración de precio"
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
              <span>Precio sugerido *</span>
              <input
                name="listPrice"
                min="0.01"
                step="0.01"
                type="number"
                required
              />
            </label>
            <label className="field">
              <span>Precio mínimo *</span>
              <input
                name="minimumPrice"
                min="0.01"
                step="0.01"
                type="number"
                required
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
              {submitting ? 'Guardando…' : 'Guardar precio'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
