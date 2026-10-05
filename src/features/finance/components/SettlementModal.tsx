import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
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
  newIdempotencyKey,
} from '../format'
import type {
  CashAccount,
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

export function SettlementModal({
  kind,
  record,
  recovery,
  onClose,
  onSaved,
}: SettlementModalProps) {
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [accountId, setAccountId] = useState('')
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
        // Sólo las cuentas de la sucursal del registro y las compartidas.
        // y de la misma moneda que el registro.
        const usable = usableCashAccounts(items, {
          branchId: record.branch?.id ?? null,
          currency: record.currency,
          // El cobro de un ingreso sólo entra a cajas de su sucursal.
          collection: kind === 'income' && !recovery,
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const data = new FormData(event.currentTarget)
    setSubmitting(true)
    try {
      await addSettlement(
        kind,
        record.id,
        {
          idempotencyKey,
          accountId: String(data.get('accountId')),
          amount: Number(String(data.get('amount'))).toFixed(2),
          ...(String(data.get('occurredAt') ?? '') ? { occurredAt: String(data.get('occurredAt')) } : {}),
          ...(String(data.get('reference') ?? '').trim() ? { reference: String(data.get('reference')).trim() } : {}),
          ...(String(data.get('notes') ?? '').trim() ? { notes: String(data.get('notes')).trim() } : {}),
        },
        recovery,
      )
      onSaved()
      void alertSuccess('La liquidación se registró correctamente.')
    } catch (submitError) {
      const message = financialErrorMessage(submitError)
      setError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const action = recovery ? 'Registrar recuperación' : kind === 'income' ? 'Registrar cobro' : 'Registrar pago'
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="settlement-modal" role="dialog" aria-modal="true" aria-labelledby="settlement-title">
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">{labels.title}</p>
            <h2 id="settlement-title">{action}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
        <form onSubmit={submit}>
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
            {!loadingAccounts && accounts.length === 0 && (
              <small>
                No hay cuentas de caja activas en{' '}
                {currencyName(record.currency)} para esta sucursal. Creala en
                Cuentas de caja y volvé a intentar.
              </small>
            )}
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
            <button className="button button--secondary" type="button" onClick={onClose}>Cancelar</button>
            <button className="button button--primary" type="submit" disabled={submitting || loadingAccounts}>
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Registrando…' : action}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
