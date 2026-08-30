import { LoaderCircle, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { localIsoDate } from '../../shared/utils/date'
import type {
  BranchOption,
  CatalogModel,
  CatalogPricePolicy,
  ConfigurePriceInput,
} from './types'

type PricePolicyModalProps = {
  model: CatalogModel
  branches: BranchOption[]
  initialBranchId?: string
  currentPolicy: CatalogPricePolicy | null
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: ConfigurePriceInput) => void
}

export function PricePolicyModal({
  model,
  branches,
  initialBranchId,
  currentPolicy,
  submitting,
  error,
  onClose,
  onSubmit,
}: PricePolicyModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [scope, setScope] = useState<'ORGANIZATION' | 'BRANCH'>(
    initialBranchId ? 'BRANCH' : 'ORGANIZATION',
  )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)
    const data = new FormData(event.currentTarget)
    const listPrice = Number(data.get('listPrice'))
    const minimumPrice = Number(data.get('minimumPrice'))
    const branchId = String(data.get('branchId') ?? '')
    const validFrom = String(data.get('validFrom') ?? '')
    const validUntil = String(data.get('validUntil') ?? '')
    if (listPrice <= 0 || minimumPrice <= 0 || minimumPrice > listPrice) {
      setValidationError(
        'Ingresá precios válidos; el mínimo no puede superar al sugerido.',
      )
      return
    }
    if (scope === 'BRANCH' && !branchId) {
      setValidationError('Seleccioná la sucursal para esta política.')
      return
    }
    if (validUntil && validUntil < validFrom) {
      setValidationError('La fecha de fin no puede ser anterior a la vigencia.')
      return
    }
    onSubmit({
      versionId: model.id,
      ...(scope === 'BRANCH' ? { branchId } : {}),
      currency: String(data.get('currency') ?? 'ARS').toUpperCase(),
      listPrice,
      minimumPrice,
      validFrom,
      ...(validUntil ? { validUntil } : {}),
    })
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
            <h2 id="price-policy-modal-title">Actualizar precios</h2>
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

        <div className="price-policy-current">
          <span>Precio efectivo al abrir</span>
          <strong>
            {currentPolicy
              ? new Intl.NumberFormat('es-AR', {
                  style: 'currency',
                  currency: currentPolicy.currency,
                }).format(currentPolicy.listPrice)
              : 'Sin precio vigente'}
          </strong>
          <small>
            La nueva vigencia no modifica precios guardados en operaciones
            anteriores.
          </small>
        </div>

        <form onSubmit={submit}>
          <div className="stock-form-grid">
            <label className="field">
              <span>Alcance *</span>
              <select
                aria-label="Alcance de precio"
                onChange={(event) =>
                  setScope(event.target.value as 'ORGANIZATION' | 'BRANCH')
                }
                value={scope}
              >
                <option value="ORGANIZATION">Organización</option>
                <option value="BRANCH">Sucursal</option>
              </select>
            </label>
            <label className="field">
              <span>Sucursal</span>
              <select
                defaultValue={initialBranchId ?? ''}
                disabled={scope !== 'BRANCH'}
                name="branchId"
                required={scope === 'BRANCH'}
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
              <span>Precio de lista *</span>
              <input
                defaultValue={currentPolicy?.listPrice}
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
                defaultValue={currentPolicy?.minimumPrice}
                name="minimumPrice"
                min="0.01"
                step="0.01"
                type="number"
                required
              />
            </label>
            <label className="field">
              <span>Moneda *</span>
              <input
                defaultValue={currentPolicy?.currency ?? 'ARS'}
                maxLength={3}
                minLength={3}
                name="currency"
                required
              />
            </label>
            <label className="field">
              <span>Vigente desde *</span>
              <input
                defaultValue={localIsoDate()}
                name="validFrom"
                type="date"
                required
              />
            </label>
            <label className="field">
              <span>Vigente hasta</span>
              <input name="validUntil" type="date" />
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
              {submitting ? 'Guardando…' : 'Crear nueva vigencia'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
