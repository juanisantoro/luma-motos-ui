import { LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addSettlement, listAllCashAccounts } from '../api'
import {
  accountForRecipient,
  cashAccountLabel,
  currencyName,
  usableCashAccounts,
} from '../cashAccounts'
import { alertError, alertSuccess } from '../../../shared/alerts'
import {
  financialErrorMessage,
  financialLabels,
  formatMoney,
  newIdempotencyKey,
} from '../format'
import type {
  CashAccount,
  Expense,
  FinancialKind,
  FinancialRecord,
  Income,
} from '../types'

type SettlementModalProps = {
  kind: FinancialKind
  record: FinancialRecord
  recovery: boolean
  onClose: () => void
  onSaved: () => void
}

// Una parte del pago: cuánto sale de qué caja. Cada parte es un movimiento de
// caja propio, con su clave de idempotencia (un reintento no la duplica).
type PaymentPart = {
  key: string
  accountId: string
  amount: string
  idempotencyKey: string
  saved: boolean
}

// Los importes se suman en centavos para no arrastrar errores de coma flotante.
function toCents(value: string | undefined) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

function centsToAmount(cents: number) {
  return (cents / 100).toFixed(2)
}

function newPart(amount = ''): PaymentPart {
  return {
    key: newIdempotencyKey(),
    accountId: '',
    amount,
    idempotencyKey: newIdempotencyKey(),
    saved: false,
  }
}

export function SettlementModal({
  kind,
  record,
  recovery,
  onClose,
  onSaved,
}: SettlementModalProps) {
  // El pago de un gasto se puede repartir entre varias cajas (por ejemplo,
  // una parte la puso un socio y otra salió de la caja de otro).
  const splitPayment = kind === 'expense' && !recovery
  const expense = splitPayment ? (record as Expense) : null
  const balanceCents = expense ? toCents(expense.balanceAmount) : 0

  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [parts, setParts] = useState<PaymentPart[]>(() => [
    newPart(balanceCents > 0 ? centsToAmount(balanceCents) : ''),
  ])
  // Efectivo que se rinde: entra a la caja del destinatario, no se elige.
  const [lockedToRecipient, setLockedToRecipient] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [idempotencyKey] = useState(newIdempotencyKey)
  const labels = financialLabels(kind)

  useEffect(() => {
    const controller = new AbortController()
    void listAllCashAccounts(controller.signal)
      .then((items) => {
        // Sólo las cuentas de la sucursal del registro; si es "General" (sin
        // sucursal), sólo las compartidas.
        // y de la misma moneda que el registro.
        const usable = usableCashAccounts(items, {
          branchId: record.branch?.id ?? null,
          currency: record.currency,
        })
        setAccounts(usable)
        // Efectivo que se rinde a alguien: se propone la caja de esa persona.
        const recipientId =
          kind === 'income' && !recovery
            ? (record as Income).handover?.recipient?.id
            : undefined
        const proposed = recipientId
          ? accountForRecipient(usable, recipientId)
          : null
        if (proposed) {
          setAccountId(proposed.id)
          setLockedToRecipient(true)
        }
      })
      .catch((loadError: unknown) => setError(financialErrorMessage(loadError)))
      .finally(() => setLoadingAccounts(false))
    return () => controller.abort()
  }, [kind, record, recovery])

  const totalCents = useMemo(
    () => parts.reduce((sum, part) => sum + toCents(part.amount), 0),
    [parts],
  )
  const remainingCents = balanceCents - totalCents
  const exceedsBalance = splitPayment && balanceCents > 0 && remainingCents < 0
  const savedParts = parts.filter((part) => part.saved).length
  const pendingParts = parts.length - savedParts
  const usedAccountIds = new Set(parts.map((part) => part.accountId).filter(Boolean))
  const canAddPart =
    !submitting &&
    remainingCents > 0 &&
    accounts.length > usedAccountIds.size &&
    parts.every((part) => part.accountId && toCents(part.amount) > 0)

  const updatePart = (key: string, changes: Partial<PaymentPart>) =>
    setParts((current) =>
      current.map((part) => (part.key === key ? { ...part, ...changes } : part)),
    )

  const addPart = () =>
    setParts((current) => [
      ...current,
      newPart(remainingCents > 0 ? centsToAmount(remainingCents) : ''),
    ])

  const removePart = (key: string) =>
    setParts((current) => current.filter((part) => part.key !== key))

  // Si ya se guardó alguna parte, al cerrar hay que refrescar el listado.
  const close = () => (savedParts > 0 ? onSaved() : onClose())

  const optionalFields = (data: FormData) => ({
    // El campo no trae huso: se manda como hora de Argentina.
    ...(String(data.get('occurredAt') ?? '') ? { occurredAt: `${String(data.get('occurredAt'))}:00.000-03:00` } : {}),
    ...(String(data.get('reference') ?? '').trim() ? { reference: String(data.get('reference')).trim() } : {}),
    ...(String(data.get('notes') ?? '').trim() ? { notes: String(data.get('notes')).trim() } : {}),
  })

  const submitSplit = async (data: FormData) => {
    if (totalCents <= 0) {
      setError('Ingresá el importe que sale de cada caja.')
      return
    }
    if (exceedsBalance) {
      setError(
        `Entre todas las cajas no puede superar el saldo pendiente de ${formatMoney(centsToAmount(balanceCents), record.currency)}.`,
      )
      return
    }
    const shared = optionalFields(data)
    let saved = savedParts
    for (const part of parts.filter((item) => !item.saved)) {
      try {
        await addSettlement(kind, record.id, {
          idempotencyKey: part.idempotencyKey,
          accountId: part.accountId,
          amount: centsToAmount(toCents(part.amount)),
          ...shared,
        })
        saved += 1
        updatePart(part.key, { saved: true })
      } catch (submitError) {
        const base = financialErrorMessage(submitError)
        const message =
          saved > 0
            ? `${base} Se registraron ${saved} de ${parts.length} pagos (los marcados como registrados ya quedaron guardados). Revisá el que falló y volvé a intentar.`
            : base
        setError(message)
        void alertError(message)
        return
      }
    }
    onSaved()
    void alertSuccess(
      parts.length > 1
        ? `Se registraron ${parts.length} pagos, uno por cada caja.`
        : 'El pago se registró correctamente.',
    )
  }

  const submitSingle = async (data: FormData) => {
    try {
      await addSettlement(
        kind,
        record.id,
        {
          idempotencyKey,
          accountId: String(data.get('accountId')),
          amount: Number(String(data.get('amount'))).toFixed(2),
          ...optionalFields(data),
        },
        recovery,
      )
      onSaved()
      void alertSuccess('La liquidación se registró correctamente.')
    } catch (submitError) {
      const message = financialErrorMessage(submitError)
      setError(message)
      void alertError(message)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const data = new FormData(event.currentTarget)
    setSubmitting(true)
    try {
      await (splitPayment ? submitSplit(data) : submitSingle(data))
    } finally {
      setSubmitting(false)
    }
  }

  const noAccountsHint = !loadingAccounts && accounts.length === 0 && (
    <small>
      No hay cuentas de caja activas en {currencyName(record.currency)} para
      esta sucursal. Creala en Cuentas de caja y volvé a intentar.
    </small>
  )

  const action = recovery ? 'Registrar recuperación' : kind === 'income' ? 'Registrar cobro' : 'Registrar pago'
  const submitLabel =
    splitPayment && pendingParts > 1 ? `Registrar ${pendingParts} pagos` : action
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="settlement-modal" role="dialog" aria-modal="true" aria-labelledby="settlement-title">
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">{labels.title}</p>
            <h2 id="settlement-title">{action}</h2>
          </div>
          <button className="icon-button" type="button" onClick={close} disabled={submitting} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        {expense && (
          <div className="commission-payment-summary settlement-split__summary">
            <div><span>Total del gasto</span><strong>{formatMoney(expense.totalAmount, record.currency)}</strong></div>
            <div><span>Ya pagado</span><strong>{formatMoney(expense.paidAmount, record.currency)}</strong></div>
            <div><span>Saldo pendiente</span><strong>{formatMoney(expense.balanceAmount, record.currency)}</strong></div>
          </div>
        )}
        {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          {splitPayment ? (
            <fieldset className="settlement-split">
              <legend>¿De qué caja salió la plata?</legend>
              <p className="settlement-split__hint">
                Si el pago salió de más de una caja, sumá una fila por cada una
                con el importe que puso. Si pagás menos que el saldo, el gasto
                queda en pago parcial y podés completarlo después.
              </p>
              {parts.map((part, index) => {
                const number = index + 1
                const suffix = parts.length > 1 ? ` ${number}` : ''
                return (
                  <div className={`settlement-split__row${part.saved ? ' settlement-split__row--saved' : ''}`} key={part.key}>
                    <label className="field">
                      <span>{`Cuenta${suffix} *`}</span>
                      <select
                        required
                        disabled={loadingAccounts || part.saved || submitting}
                        value={part.accountId}
                        onChange={(event) => updatePart(part.key, { accountId: event.target.value })}
                      >
                        <option value="">{loadingAccounts ? 'Cargando cuentas…' : 'Seleccionar cuenta'}</option>
                        {accounts
                          .filter((account) => account.id === part.accountId || !usedAccountIds.has(account.id))
                          .map((account) => (
                            <option key={account.id} value={account.id}>
                              {cashAccountLabel(account)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>{`Importe${suffix} *`}</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        disabled={part.saved || submitting}
                        value={part.amount}
                        onChange={(event) => updatePart(part.key, { amount: event.target.value })}
                      />
                    </label>
                    {part.saved ? (
                      <span className="status-badge status-badge--success settlement-split__state">Registrado</span>
                    ) : parts.length > 1 ? (
                      <button
                        className="icon-button settlement-split__remove"
                        type="button"
                        disabled={submitting}
                        onClick={() => removePart(part.key)}
                        aria-label={`Quitar cuenta ${number}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    ) : (
                      <span className="settlement-split__state" aria-hidden="true" />
                    )}
                  </div>
                )
              })}
              {noAccountsHint}
              <button
                className="button button--secondary button--compact settlement-split__add"
                type="button"
                disabled={!canAddPart}
                onClick={addPart}
              >
                <Plus size={16} /> Sumar otra caja
              </button>
              {balanceCents > 0 && (
                <p className={`settlement-split__total${exceedsBalance ? ' settlement-split__total--error' : ''}`} aria-live="polite">
                  A registrar: <strong>{formatMoney(centsToAmount(totalCents), record.currency)}</strong>
                  {' · '}
                  {exceedsBalance
                    ? `Supera el saldo en ${formatMoney(centsToAmount(-remainingCents), record.currency)}`
                    : remainingCents > 0
                      ? `Queda pendiente: ${formatMoney(centsToAmount(remainingCents), record.currency)}`
                      : 'El gasto queda pagado completo'}
                </p>
              )}
            </fieldset>
          ) : (
            <>
              <label className="field">
                <span>Cuenta *</span>
                <select
                  {...(lockedToRecipient ? {} : { name: 'accountId' })}
                  required
                  disabled={loadingAccounts || lockedToRecipient}
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  <option value="">{loadingAccounts ? 'Cargando cuentas…' : 'Seleccionar cuenta'}</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {cashAccountLabel(account)}
                    </option>
                  ))}
                </select>
                {noAccountsHint}
                {lockedToRecipient && (
                  <>
                    <input type="hidden" name="accountId" value={accountId} />
                    <small>Es la caja de quien recibe el efectivo.</small>
                  </>
                )}
              </label>
              <label className="field">
                <span>Importe *</span>
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </label>
            </>
          )}
          <label className="field">
            <span>Fecha y hora</span>
            <input name="occurredAt" type="datetime-local" />
          </label>
          <label className="field">
            <span>TT / referencia</span>
            <input name="reference" maxLength={120} />
          </label>
          <label className="field">
            <span>Observaciones</span>
            <textarea name="notes" rows={3} maxLength={2000} />
          </label>
          <footer className="financial-modal__actions">
            <button className="button button--secondary" type="button" onClick={close} disabled={submitting}>
              {savedParts > 0 ? 'Cerrar' : 'Cancelar'}
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={submitting || loadingAccounts || exceedsBalance}
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Registrando…' : submitLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
