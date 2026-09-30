import { LoaderCircle, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { alertSuccess } from '../../shared/alerts'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { salesErrorMessage } from './errors'
import { formatMoney, formatOperationDate } from './presentation'
import {
  cashCollectionErrorMessage,
  componentLabel,
  markFinancingPayment,
  revertFinancingPayment,
  type OperationTrackingRow,
  type TrackingPaymentComponent,
} from './tracking'

// Fase 4: la financiera informó que pagó. No se carga monto: lo que entró
// (el neto) se registra aparte como ingreso, si se quiere.
export function FinancingPaymentModal({
  operation,
  component,
  onClose,
  onDone,
}: {
  operation: OperationTrackingRow
  component: TrackingPaymentComponent
  onClose: () => void
  onDone: () => void
}) {
  const reverting = component.financingPayment !== null
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialogFocus(onClose, busy)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (reverting && !text.trim()) {
      setError('Indicá por qué deshacés la marca.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (reverting)
        await revertFinancingPayment(operation.id, component.id, text.trim())
      else
        await markFinancingPayment(
          operation.id,
          component.id,
          text.trim() || undefined,
        )
      void alertSuccess(
        reverting
          ? 'La financiera volvió a quedar pendiente de pago.'
          : 'Quedó registrado que la financiera pagó.',
      )
      onDone()
    } catch (saveError) {
      setError(cashCollectionErrorMessage(saveError) ?? salesErrorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  const received = Number(component.collectedAmount)

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="financing-payment-title"
        aria-modal="true"
        className="client-modal licensing-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">FINANCIERA</p>
            <h2 id="financing-payment-title">
              {reverting ? 'Deshacer "financiera pagó"' : 'La financiera pagó'}
            </h2>
            <p>
              Operación #{operation.number}
              {operation.ticketNumber ? ` · boleto ${operation.ticketNumber}` : ''}{' '}
              · {componentLabel(component)}
            </p>
          </div>
          <button
            aria-label="Cerrar"
            className="icon-button"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}

        <form className="licensing-modal__section" onSubmit={submit}>
          <dl className="confirm-preview__section">
            <div className="confirm-preview__row">
              <dt>Financiado</dt>
              <dd>{formatMoney(component.expectedAmount, operation.currency)}</dd>
            </div>
            <div className="confirm-preview__row">
              <dt>Ingresado en caja</dt>
              <dd>
                {received > 0
                  ? formatMoney(component.collectedAmount, operation.currency)
                  : 'Sin ingreso registrado'}
              </dd>
            </div>
            {reverting && component.financingPayment && (
              <div className="confirm-preview__row">
                <dt>Marcado</dt>
                <dd>
                  {formatOperationDate(component.financingPayment.informedAt)}
                  {component.financingPayment.informedBy
                    ? ` · ${component.financingPayment.informedBy.fullName}`
                    : ''}
                </dd>
              </div>
            )}
          </dl>
          <p className="tracking-hint">
            {reverting
              ? 'El componente vuelve a contar en el saldo de la operación.'
              : 'No se carga monto. El componente se da por cobrado y deja de contar en el saldo aunque la financiera haya depositado menos. El depósito se registra aparte con "Cobrar", acá o una sola vez si la liquidación cubre varias operaciones.'}
          </p>
          <label className="field field--wide">
            <span>{reverting ? 'Motivo *' : 'Observación'}</span>
            <textarea
              id="financing-payment-text"
              maxLength={reverting ? 1000 : 2000}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                reverting ? 'Por qué se deshace' : 'Ej.: liquidación semanal 12'
              }
              rows={3}
              value={text}
            />
          </label>
          <div className="client-modal__actions">
            <button
              className="button button--secondary"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy && <LoaderCircle className="spin" size={17} />}
              {reverting ? 'Deshacer' : 'Confirmar que pagó'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
