import { LoaderCircle, PackageCheck, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import type { ReceiveSupplyInput, SupplyOrder } from './types'

type ReceiveSupplyModalProps = {
  supply: SupplyOrder
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: ReceiveSupplyInput) => void
}

export function ReceiveSupplyModal({
  supply,
  submitting,
  error,
  onClose,
  onSubmit,
}: ReceiveSupplyModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const licensePlate = String(data.get('licensePlate') ?? '').trim()
    onSubmit({
      vin: String(data.get('vin')).trim().toUpperCase(),
      branchId: supply.destinationBranch.id,
      year: Number(data.get('year')),
      mileage:
        supply.condition === 'NUEVO' ? 0 : Number(data.get('mileage')),
      ...(licensePlate
        ? { licensePlate: licensePlate.toUpperCase() }
        : {}),
      idempotencyKey,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="stock-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receive-modal-title"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">RECEPCIÓN</p>
            <h2 id="receive-modal-title">Recibir abastecimiento</h2>
            <p>
              {supply.catalogModel.brand} {supply.catalogModel.model} ·{' '}
              {supply.supplier.name}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar recepción"
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

        <div className="separation-note separation-note--success">
          <PackageCheck size={18} aria-hidden="true" />
          Al confirmar se creará una unidad física identificada en la sucursal.
        </div>

        <form onSubmit={submit}>
          <div className="stock-form-grid">
            <label className="field field--wide">
              <span>VIN / chasis real *</span>
              <input
                name="vin"
                minLength={6}
                maxLength={64}
                autoCapitalize="characters"
                required
              />
            </label>
            <label className="field">
              <span>Sucursal de recepción *</span>
              <select
                aria-label="Sucursal de recepción"
                value={supply.destinationBranch.id}
                disabled
                required
              >
                <option value={supply.destinationBranch.id}>
                  {supply.destinationBranch.name}
                </option>
              </select>
            </label>
            <label className="field">
              <span>Año *</span>
              <input
                name="year"
                defaultValue={new Date().getFullYear()}
                min="1900"
                max={new Date().getFullYear() + 1}
                type="number"
                required
              />
            </label>
            <label className="field">
              <span>Kilómetros *</span>
              <input
                name="mileage"
                defaultValue="0"
                disabled={supply.condition === 'NUEVO'}
                min="0"
                type="number"
                required
              />
            </label>
            <label className="field">
              <span>Patente</span>
              <input name="licensePlate" maxLength={12} />
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
              {submitting ? 'Recibiendo…' : 'Recibir y crear unidad'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
