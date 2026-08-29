import { LoaderCircle, RotateCcw, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { getFinancialRecord, reverseMovement } from '../api'
import {
  financialErrorMessage,
  formatDate,
  formatMoney,
  newIdempotencyKey,
} from '../format'
import type {
  FinancialKind,
  FinancialMovement,
  FinancialRecord,
} from '../types'

type FinancialDetailsModalProps = {
  kind: FinancialKind
  recordId: string
  canReverse: boolean
  onClose: () => void
  onChanged: () => void
}

export function FinancialDetailsModal({
  kind,
  recordId,
  canReverse,
  onClose,
  onChanged,
}: FinancialDetailsModalProps) {
  const [record, setRecord] = useState<FinancialRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [movementToReverse, setMovementToReverse] = useState<FinancialMovement | null>(null)
  const [reverseIdempotencyKey, setReverseIdempotencyKey] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    void getFinancialRecord(kind, recordId)
      .then(setRecord)
      .catch((loadError: unknown) => setError(financialErrorMessage(loadError)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [kind, recordId])

  const submitReverse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!movementToReverse) return
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim()
    setSubmitting(true)
    setError('')
    try {
      await reverseMovement(kind, recordId, movementToReverse.id, {
        idempotencyKey: reverseIdempotencyKey,
        reason,
      })
      setMovementToReverse(null)
      setReverseIdempotencyKey('')
      onChanged()
      load()
    } catch (reverseError) {
      setError(financialErrorMessage(reverseError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="financial-modal" role="dialog" aria-modal="true" aria-labelledby="movement-title">
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">TRAZABILIDAD</p>
            <h2 id="movement-title">Movimientos</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar movimientos">
            <X size={20} />
          </button>
        </header>
        {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
        {loading && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando movimientos…</span>
          </div>
        )}
        {!loading && record?.movements?.length === 0 && (
          <p className="financial-empty-note">Este registro todavía no tiene movimientos.</p>
        )}
        {!loading && record?.movements && record.movements.length > 0 && (
          <div className="movement-list">
            {record.movements.map((movement) => (
              <article className={movement.reversed ? 'movement-card movement-card--reversed' : 'movement-card'} key={movement.id}>
                <header>
                  <div>
                    <strong>{movement.type.replaceAll('_', ' ')}</strong>
                    <span>{formatDate(movement.occurredAt)}</span>
                  </div>
                  <span className="status-badge">{movement.reversed ? 'Reversado' : movement.direction}</span>
                </header>
                <dl>
                  <div><dt>Cuenta</dt><dd>{movement.account.code} · {movement.account.name}</dd></div>
                  {movement.amount !== undefined && (
                    <div><dt>Importe</dt><dd>{formatMoney(movement.amount, record.currency)}</dd></div>
                  )}
                  <div><dt>Registrado por</dt><dd>{movement.registeredBy.fullName}</dd></div>
                  {movement.reference && <div><dt>Referencia</dt><dd>{movement.reference}</dd></div>}
                </dl>
                {canReverse && !movement.reversed && !movement.reversalOfId && (
                  <button
                    className="button button--danger button--compact"
                    type="button"
                    onClick={() => {
                      setMovementToReverse(movement)
                      setReverseIdempotencyKey(newIdempotencyKey())
                    }}
                  >
                    <RotateCcw size={16} />
                    Reversar
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
        {movementToReverse && (
          <form className="reverse-confirmation" onSubmit={submitReverse}>
            <strong>Confirmar reversa</strong>
            <p>La reversa conserva la trazabilidad y no puede deshacerse desde esta pantalla.</p>
            <label className="field">
              <span>Motivo *</span>
              <textarea name="reason" rows={3} maxLength={500} required />
            </label>
            <div>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  setMovementToReverse(null)
                  setReverseIdempotencyKey('')
                }}
              >
                Cancelar
              </button>
              <button className="button button--danger" type="submit" disabled={submitting}>
                {submitting && <LoaderCircle className="spin" size={17} />}
                {submitting ? 'Reversando…' : 'Confirmar reversa'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
