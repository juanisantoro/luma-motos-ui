import { useState, type FormEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'

export function SalesDecisionModal({
  kind = 'reject',
  operationNumber,
  submitting,
  error,
  onClose,
  onConfirm,
}: {
  kind?: 'reject' | 'release'
  operationNumber: string
  submitting: boolean
  error: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const dialogRef = useDialogFocus(onClose, submitting)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = reason.trim()
    if (value) void onConfirm(value)
  }

  const isRelease = kind === 'release'

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="client-modal sales-decision-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-decision-title"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">APROBACIONES</p>
            <h2 id="sales-decision-title">
              {isRelease ? 'Liberar reserva' : 'Rechazar operación'} #
              {operationNumber}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar rechazo"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <p className="modal-description">
          {isRelease
            ? 'La unidad volverá a estar disponible y el motivo quedará visible en el historial.'
            : 'El motivo quedará visible en el historial y la reserva de stock se liberará automáticamente.'}
        </p>
        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <label className="field">
            <span>{isRelease ? 'Motivo de la liberación' : 'Motivo del rechazo'} *</span>
            <textarea
              autoFocus
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                isRelease
                  ? 'Detallá por qué se libera la unidad'
                  : 'Detallá el motivo para el vendedor'
              }
              required
              rows={5}
              value={reason}
            />
          </label>
          <div className="client-modal__actions">
            <button
              className="button button--secondary"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="button button--danger"
              disabled={submitting || !reason.trim()}
              type="submit"
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting
                ? isRelease
                  ? 'Liberando…'
                  : 'Rechazando…'
                : isRelease
                  ? 'Liberar reserva'
                  : 'Confirmar rechazo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
