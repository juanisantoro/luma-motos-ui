import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { alertSuccess } from '../../shared/alerts'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { localIsoDate } from '../../shared/utils/date'
import { listAllCashAccounts } from '../finance/api'
import { cashAccountLabel, usableCashAccounts } from '../finance/cashAccounts'
import { formatMoney, newIdempotencyKey } from '../finance/format'
import type { CashAccount } from '../finance/types'
import {
  listHandoverRecipients,
  paymentMethodLabels,
  type HandoverRecipient,
  type PaymentMethod,
} from '../sales/tracking'
import { deliverServiceOrder } from './api'
import { conditionLabels, orderNumber, partsTotal, serviceErrorMessage } from './format'
import type { ServiceOrder, VehicleCondition } from './types'

const METHODS = Object.keys(paymentMethodLabels) as PaymentMethod[]
const CONDITIONS = Object.keys(conditionLabels) as VehicleCondition[]

/**
 * Cobro y entrega de una moto con el service terminado. El cobro entra como
 * un ingreso "Service" en la caja elegida; sin importe (garantía) sólo se
 * registra la entrega.
 */
export function ServiceDeliveryModal({
  order,
  suggestedPrice,
  onClose,
  onDelivered,
}: {
  order: ServiceOrder
  suggestedPrice: string | null
  onClose: () => void
  onDelivered: (order: ServiceOrder) => void
}) {
  const [amount, setAmount] = useState(suggestedPrice ? String(Number(suggestedPrice)) : '')
  const [method, setMethod] = useState<PaymentMethod>('EFECTIVO')
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [recipients, setRecipients] = useState<HandoverRecipient[]>([])
  const [handoverToId, setHandoverToId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(localIsoDate())
  const [condition, setCondition] = useState<VehicleCondition>('BUENO')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  // Una clave por apertura: un reintento no cobra dos veces.
  const [idempotencyKey] = useState(newIdempotencyKey)
  const dialogRef = useDialogFocus(onClose, busy)
  const charged = Number(amount) > 0
  const isCash = charged && method === 'EFECTIVO'
  const parts = partsTotal(order)

  useEffect(() => {
    const controller = new AbortController()
    listAllCashAccounts(controller.signal)
      .then((items) => {
        const usable = usableCashAccounts(items, { currency: 'ARS', branchId: order.branch.id })
        setAccounts(usable)
        setAccountId((current) => current || usable[0]?.id || '')
        if (!usable.length)
          setLoadError(`No hay cajas en pesos activas en ${order.branch.name}: pedile a un administrador que cree una.`)
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setLoadError(serviceErrorMessage(failure))
      })
    listHandoverRecipients(controller.signal, 'MOTO')
      .then((items) => {
        setRecipients(items)
        if (items.length === 1) setHandoverToId(items[0]?.id ?? '')
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [order.branch.id, order.branch.name])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(amount)
    if (amount === '' || !Number.isFinite(value) || value < 0) {
      setError('Ingresá el importe que se cobra (0 si no se cobra).')
      return
    }
    if (charged && !accountId) {
      setError('Elegí la caja donde entra el cobro.')
      return
    }
    if (isCash && !handoverToId) {
      setError('Indicá a quién se rinde el efectivo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const delivered = await deliverServiceOrder(order.id, {
        expectedVersion: order.version,
        idempotencyKey,
        amount: value.toFixed(2),
        ...(charged ? { accountId, paymentMethod: method } : {}),
        ...(isCash ? { handoverToId } : {}),
        deliveryDate,
        vehicleCondition: condition,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      void alertSuccess(
        charged
          ? isCash
            ? 'Moto entregada. El cobro quedó pendiente de rendición.'
            : 'Moto entregada y cobro registrado en caja.'
          : 'Moto entregada sin cobro.',
      )
      onDelivered(delivered)
    } catch (saveError) {
      setError(serviceErrorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="service-delivery-title"
        aria-modal="true"
        className="client-modal licensing-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">SERVICE · ENTREGA</p>
            <h2 id="service-delivery-title">Cobrar y entregar la orden {orderNumber(order.number)}</h2>
            <p>
              {order.client.name} · {order.serviceType.name}
              {parts > 0 && ` · repuestos cargados por ${formatMoney(parts.toFixed(2), 'ARS')}`}
            </p>
          </div>
          <button aria-label="Cerrar entrega" className="icon-button" disabled={busy} onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}

        <form aria-label="Cobro y entrega" className="licensing-modal__section" onSubmit={submit}>
          {loadError && charged && <p className="field-error">{loadError}</p>}
          <div className="client-form-grid">
            <label className="field">
              <span>Importe a cobrar *</span>
              <input min="0" onChange={(event) => setAmount(event.target.value)} step="0.01" type="number" value={amount} />
              <small>
                {suggestedPrice
                  ? `Precio del ${order.serviceType.name}: ${formatMoney(suggestedPrice, 'ARS')}.`
                  : 'Poné 0 si es garantía o no se cobra.'}
              </small>
            </label>
            <label className="field">
              <span>Fecha de entrega *</span>
              <input max={localIsoDate()} onChange={(event) => setDeliveryDate(event.target.value)} type="date" value={deliveryDate} />
            </label>
            {charged && (
              <>
                <label className="field">
                  <span>Medio de pago *</span>
                  <select onChange={(event) => setMethod(event.target.value as PaymentMethod)} value={method}>
                    {METHODS.map((item) => (
                      <option key={item} value={item}>{paymentMethodLabels[item]}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Caja *</span>
                  <select onChange={(event) => setAccountId(event.target.value)} value={accountId}>
                    <option value="">Elegí la caja</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{cashAccountLabel(account)}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {isCash && (
              <label className="field field--wide">
                <span>Se rinde a *</span>
                <select onChange={(event) => setHandoverToId(event.target.value)} value={handoverToId}>
                  <option value="">Elegí quién recibe el efectivo</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.fullName}
                      {recipient.isCurrentUser ? ' (vos)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <fieldset className="field field--wide service-condition">
              <legend>Estado de la moto al entregar *</legend>
              <div>
                {CONDITIONS.map((item) => (
                  <label key={item}>
                    <input checked={condition === item} name="condition" onChange={() => setCondition(item)} type="radio" />
                    {conditionLabels[item]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field field--wide">
              <span>Observaciones</span>
              <input maxLength={2000} onChange={(event) => setNotes(event.target.value)} value={notes} />
            </label>
          </div>
          <div className="client-modal__actions">
            <button className="button button--secondary" disabled={busy} onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy && <LoaderCircle className="spin" size={17} />}
              {charged ? 'Cobrar y entregar' : 'Entregar sin cobro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
