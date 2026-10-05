import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { localIsoDate } from '../../shared/utils/date'
import { listAllCashAccounts } from '../finance/api'
import { cashAccountLabel, usableCashAccounts } from '../finance/cashAccounts'
import { newIdempotencyKey } from '../finance/format'
import type { CashAccount } from '../finance/types'
import {
  listHandoverRecipients,
  paymentMethodLabels,
  type HandoverRecipient,
  type PaymentMethod,
} from '../sales/tracking'
import { formatDate, formatMoney } from './format'
import type { CreditInstallment, PayCreditInstallmentInput } from './types'

// UTC (toISOString) adelanta "hoy" varias horas antes de medianoche en
// Argentina (UTC-3), lo que permitía cargar/limitar el pago a una fecha
// futura equivocada.
const today = localIsoDate()

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
  // Fase 4: la cuota entra a caja.
  const [method, setMethod] = useState<PaymentMethod>('EFECTIVO')
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [recipients, setRecipients] = useState<HandoverRecipient[]>([])
  const [handoverToId, setHandoverToId] = useState('')
  const [loadError, setLoadError] = useState('')
  // Una clave por apertura: un reintento no duplica el cobro.
  const [idempotencyKey] = useState(newIdempotencyKey)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      listAllCashAccounts(controller.signal),
      listHandoverRecipients(controller.signal),
    ])
      .then(([accountItems, recipientItems]) => {
        // La cuota se cobra en una caja de la sucursal de la venta.
        const usable = usableCashAccounts(accountItems, {
          currency: 'ARS',
          ...(installment.branchId
            ? { branchId: installment.branchId, collection: true }
            : {}),
        })
        setAccounts(usable)
        setAccountId((current) => current || usable[0]?.id || '')
        setRecipients(recipientItems)
        if (recipientItems.length === 1)
          setHandoverToId((current) => current || recipientItems[0]!.id)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoadError('No pudimos cargar las cuentas de caja.')
      })
    return () => controller.abort()
  }, [installment.branchId])

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
    if (!accountId) {
      setValidationError('Elegí la cuenta de caja donde ingresa el dinero.')
      return
    }
    if (method === 'EFECTIVO' && !handoverToId) {
      setValidationError('Indicá a quién se rinde el efectivo.')
      return
    }
    setValidationError('')
    onSubmit({
      amount: parsed,
      paymentDate,
      idempotencyKey,
      accountId,
      paymentMethod: method,
      ...(method === 'EFECTIVO' ? { handoverToId } : {}),
    })
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
        {loadError && (
          <div className="form-alert form-alert--error" role="alert">
            {loadError}
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
            <label className="field">
              <span>Medio *</span>
              <select
                id="installment-payment-method"
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                value={method}
              >
                {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((item) => (
                  <option key={item} value={item}>
                    {paymentMethodLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cuenta de caja *</span>
              <select
                id="installment-account"
                onChange={(event) => setAccountId(event.target.value)}
                value={accountId}
              >
                <option value="">Seleccionar cuenta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {cashAccountLabel(account)}
                  </option>
                ))}
              </select>
            </label>
            {method === 'EFECTIVO' && (
              <label className="field">
                <span>Se rinde a *</span>
                <select
                  id="installment-handover"
                  onChange={(event) => setHandoverToId(event.target.value)}
                  value={handoverToId}
                >
                  <option value="">Seleccionar quién recibe el efectivo</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.fullName}
                      {recipient.isCurrentUser ? ' (vos)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
