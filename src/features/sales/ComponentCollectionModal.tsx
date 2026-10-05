import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { ApiError } from '../../shared/api/client'
import { alertSuccess } from '../../shared/alerts'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { localIsoDate } from '../../shared/utils/date'
import { listAllCashAccounts } from '../finance/api'
import { cashAccountLabel, usableCashAccounts } from '../finance/cashAccounts'
import { newIdempotencyKey } from '../finance/format'
import type { CashAccount } from '../finance/types'
import { salesErrorMessage } from './errors'
import { formatMoney } from './presentation'
import {
  cashCollectionErrorMessage,
  collectPaymentComponent,
  collectibleComponents,
  componentLabel,
  defaultPaymentMethod,
  paymentMethodLabels,
  type HandoverRecipient,
  type OperationTrackingRow,
  type PaymentMethod,
} from './tracking'

export function componentCollectionErrorMessage(error: unknown) {
  const shared = cashCollectionErrorMessage(error)
  if (shared) return shared
  if (error instanceof ApiError) {
    const code = error.details?.code
    if (code === 'OVERPAYMENT') {
      return 'El importe supera el saldo del componente.'
    }
    if (code === 'HANDOVER_RECIPIENT_REQUIRED') {
      return 'Indicá a quién se rinde el efectivo.'
    }
    if (code === 'INVALID_HANDOVER_RECIPIENT') {
      return 'La persona elegida no puede recibir rendiciones de efectivo.'
    }
    if (code === 'HANDOVER_ONLY_FOR_CASH') {
      return 'Sólo el efectivo se rinde. Quitá el destinatario o elegí efectivo.'
    }
    if (code === 'COMPONENT_NOT_COLLECTIBLE') {
      return 'Ese componente del plan no recibe cobros en caja.'
    }
    if (code === 'OPERATION_CANCELLED') {
      return 'La operación está cancelada.'
    }
    if (code === 'CURRENCY_MISMATCH') {
      return 'La cuenta elegida tiene otra moneda que la operación.'
    }
    if (code === 'IDEMPOTENCY_CONFLICT') {
      return 'Ese cobro ya se envió con otros datos. Cerrá y volvé a abrir el cobro.'
    }
  }
  return salesErrorMessage(error)
}

const METHODS = Object.keys(paymentMethodLabels) as PaymentMethod[]

export function ComponentCollectionModal({
  operation,
  recipients,
  onClose,
  onCollected,
}: {
  operation: OperationTrackingRow
  recipients: HandoverRecipient[]
  onClose: () => void
  onCollected: () => void
}) {
  const components = useMemo(
    () => collectibleComponents(operation),
    [operation],
  )
  const [componentId, setComponentId] = useState(components[0]?.id ?? '')
  const component = components.find((item) => item.id === componentId)
  const [amount, setAmount] = useState(component?.collectableAmount ?? '')
  const [method, setMethod] = useState<PaymentMethod | ''>(
    component ? (defaultPaymentMethod(component.type) ?? '') : '',
  )
  const [handoverToId, setHandoverToId] = useState(
    recipients.length === 1 ? (recipients[0]?.id ?? '') : '',
  )
  const [collectionDate, setCollectionDate] = useState(localIsoDate())
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [accountsError, setAccountsError] = useState('')
  const [reference, setReference] = useState(operation.ticketNumber ?? '')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Una clave por apertura: un reintento no duplica el cobro.
  const [idempotencyKey] = useState(newIdempotencyKey)
  const dialogRef = useDialogFocus(onClose, busy)
  const isCash = method === 'EFECTIVO'

  useEffect(() => {
    const controller = new AbortController()
    listAllCashAccounts(controller.signal)
      .then((items) => {
        const usable = usableCashAccounts(items, {
          currency: operation.currency,
          branchId: operation.branch.id,
        })
        setAccounts(usable)
        setAccountId((current) => current || usable[0]?.id || '')
        if (!usable.length)
          setAccountsError(
            'No hay cuentas de caja activas para la sucursal de la operación.',
          )
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setAccountsError(salesErrorMessage(loadError))
      })
    return () => controller.abort()
  }, [operation.branch.id, operation.currency])

  const selectComponent = (id: string) => {
    setComponentId(id)
    const next = components.find((item) => item.id === id)
    setAmount(next?.collectableAmount ?? '')
    setMethod(next ? (defaultPaymentMethod(next.type) ?? '') : '')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(amount)
    if (!component) {
      setError('Elegí el componente del plan de pago que se cobra.')
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Ingresá el importe cobrado.')
      return
    }
    if (value > Number(component.collectableAmount)) {
      setError('El importe supera el saldo del componente.')
      return
    }
    if (!accountId) {
      setError('Elegí la cuenta de caja donde ingresa el dinero.')
      return
    }
    if (isCash && !handoverToId) {
      setError('Indicá a quién se rinde el efectivo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await collectPaymentComponent(operation.id, component.id, {
        idempotencyKey,
        accountId,
        amount: value.toFixed(2),
        collectionDate,
        ...(method ? { paymentMethod: method } : {}),
        ...(isCash ? { handoverToId } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      void alertSuccess(
        isCash
          ? 'Se registró el cobro. El efectivo queda pendiente de rendición.'
          : 'Se registró el cobro y se acreditó en caja.',
      )
      onCollected()
    } catch (saveError) {
      setError(componentCollectionErrorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="component-collection-title"
        aria-modal="true"
        className="client-modal licensing-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">COBRO DE OPERACIÓN</p>
            <h2 id="component-collection-title">
              Operación #{operation.number}
              {operation.ticketNumber ? ` · boleto ${operation.ticketNumber}` : ''}
            </h2>
            <p>{operation.client.fullName}</p>
          </div>
          <button
            aria-label="Cerrar cobro"
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

        <form
          aria-label="Registrar cobro del plan de pago"
          className="licensing-modal__section"
          onSubmit={submit}
        >
          {accountsError && <p className="field-error">{accountsError}</p>}
          <div className="client-form-grid">
            <label className="field field--wide">
              <span>Componente del plan *</span>
              <select
                onChange={(event) => selectComponent(event.target.value)}
                required
                value={componentId}
              >
                {components.map((item) => (
                  <option key={item.id} value={item.id}>
                    {componentLabel(item)} · por cobrar{' '}
                    {formatMoney(item.collectableAmount, operation.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Importe cobrado *</span>
              <input
                min="0.01"
                onChange={(event) => setAmount(event.target.value)}
                required
                step="0.01"
                type="number"
                value={amount}
              />
            </label>
            <label className="field">
              <span>Fecha *</span>
              <input
                onChange={(event) => setCollectionDate(event.target.value)}
                required
                type="date"
                value={collectionDate}
              />
            </label>
            <label className="field">
              <span>Medio *</span>
              <select
                onChange={(event) =>
                  setMethod(event.target.value as PaymentMethod)
                }
                required
                value={method}
              >
                {METHODS.map((item) => (
                  <option key={item} value={item}>
                    {paymentMethodLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cuenta de caja *</span>
              <select
                onChange={(event) => setAccountId(event.target.value)}
                required
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
            {isCash && (
              <label className="field field--wide">
                <span>Se rinde a *</span>
                <select
                  onChange={(event) => setHandoverToId(event.target.value)}
                  required
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
                <small>
                  Queda registrado que lo recibiste vos; sólo el destinatario
                  confirma la recepción.
                </small>
              </label>
            )}
            <label className="field">
              <span>Referencia</span>
              <input
                maxLength={160}
                onChange={(event) => setReference(event.target.value)}
                value={reference}
              />
            </label>
            <label className="field">
              <span>Observaciones</span>
              <input
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                value={notes}
              />
            </label>
          </div>
          <div className="client-modal__actions">
            <button
              className="button button--secondary"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={busy || !component}
              type="submit"
            >
              {busy && <LoaderCircle className="spin" size={17} />}
              Registrar cobro
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
