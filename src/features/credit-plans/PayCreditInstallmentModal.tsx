import { LoaderCircle, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { formatDate, formatMoney } from './format'
import type { CreditInstallment, PayCreditInstallmentInput } from './types'

const today = new Date().toISOString().slice(0, 10)

type PayCreditInstallmentModalProps = {
  installment: CreditInstallment
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: PayCreditInstallmentInput) => void
}

export function PayCreditInstallmentModal({
  installment,
  submitting,
  error,
  onClose,
  onSubmit,
}: PayCreditInstallmentModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const balance = Math.max(0, installment.amount - installment.paidAmount)
  const [amount, setAmount] = useState(String(balance))
  const [paymentDate, setPaymentDate] = useState(today)
  const [validationError, setValidationError] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setValidationError('Ingresá un importe mayor a cero.')
      return
    }
    if (parsed > balance + 0.01) {
      setValidationError('El importe no puede superar el saldo pendiente de la cuota.')
      return
    }
    setValidationError('')
    onSubmit({ amount: parsed, paymentDate })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="pay-installment-modal-title"
        aria-modal="true"
        className="stock-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">COBRANZA DE CUOTAS</p>
            <h2 id="pay-installment-modal-title">
              Cobrar cuota #{installment.number} · Operación #{installment.operationNumber}
            </h2>
            <p>
              {installment.clientName} · vence el {formatDate(installment.dueDate)} · saldo{' '}
              {formatMoney(balance)}
            </p>
          </div>
          <button
            aria-label="Cerrar"
            className="icon-button"
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
        {validationError && (
          <div className="form-alert form-alert--error" role="alert">
            {validationError}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="stock-form-grid">
            <label className="field">
              <span>Importe cobrado *</span>
              <input
                autoFocus
                max={balance}
                min="0.01"
                onChange={(event) => setAmount(event.target.value)}
                step="0.01"
                type="number"
                value={amount}
              />
            </label>
            <label className="field">
              <span>Fecha de cobro *</span>
              <input
                max={today}
                onChange={(event) => setPaymentDate(event.target.value)}
                type="date"
                value={paymentDate}
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
            <button className="button button--primary" disabled={submitting} type="submit">
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Registrando…' : 'Registrar cobro'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
