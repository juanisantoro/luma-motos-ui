import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatePanel } from '../../shared/components/StatePanel'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { financialErrorMessage, formatDate, formatMoney } from '../finance/format'
import { getOperationTrace } from './api'
import { actorName, auditChanges, formatDateTime } from './format'
import { MoneyTable } from './MoneyTable'
import type { OperationTrace } from './types'

const decisionLabels = {
  PENDIENTE: 'Pendiente de decisión',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
} as const

// Trazabilidad de una venta: quién la cargó, quién la aprobó, cada cambio y
// cada peso que entró o salió por ella, en orden cronológico.
export function OperationHistoryModal({
  operationId,
  onClose,
}: {
  operationId: string
  onClose: () => void
}) {
  const dialogRef = useDialogFocus(onClose)
  const [trace, setTrace] = useState<OperationTrace | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setTrace(null)
    setError('')
    getOperationTrace(operationId, controller.signal)
      .then(setTrace)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(financialErrorMessage(cause))
      })
    return () => controller.abort()
  }, [operationId, attempt])

  const operation = trace?.operation

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="operation-history-title"
        aria-modal="true"
        className="financial-modal audit-history"
        ref={dialogRef}
        role="dialog"
      >
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">HISTORIAL DE LA VENTA</p>
            <h2 id="operation-history-title">
              {operation
                ? `Venta N.º ${operation.number} · ${operation.client}`
                : 'Historial de la venta'}
            </h2>
          </div>
          <button
            aria-label="Cerrar"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        {!trace && !error && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando historial…</span>
          </div>
        )}
        {error && (
          <StatePanel
            action={
              <button
                className="button button--primary"
                onClick={() => setAttempt((value) => value + 1)}
                type="button"
              >
                <RefreshCw size={17} />
                Reintentar
              </button>
            }
            description={error}
            icon={RefreshCw}
            title="No pudimos cargar el historial"
            tone="danger"
          />
        )}

        {trace && operation && (
          <>
            <dl className="audit-facts">
              <div>
                <dt>Vehículo</dt>
                <dd>
                  {operation.vehicle}
                  {operation.vin && <small>{operation.vin}</small>}
                </dd>
              </div>
              <div>
                <dt>Sucursal</dt>
                <dd>{operation.branch.name}</dd>
              </div>
              <div>
                <dt>Fecha de la venta</dt>
                <dd>{formatDate(operation.date)}</dd>
              </div>
              <div>
                <dt>Boleto</dt>
                <dd>{operation.ticketNumber ?? '—'}</dd>
              </div>
              <div>
                <dt>Precio acordado</dt>
                <dd>{formatMoney(operation.agreedPrice ?? undefined)}</dd>
              </div>
              <div>
                <dt>Cargada por</dt>
                <dd>
                  {operation.createdBy?.fullName ?? '—'}
                  <small>{formatDateTime(operation.createdAt)}</small>
                </dd>
              </div>
              <div>
                <dt>Última modificación</dt>
                <dd>{formatDateTime(operation.updatedAt)}</dd>
              </div>
              <div>
                <dt>Entrega</dt>
                <dd>
                  {operation.deliveredAt
                    ? `Entregada el ${formatDateTime(operation.deliveredAt)}`
                    : 'Sin entregar'}
                </dd>
              </div>
            </dl>

            <h3 className="audit-section">Aprobaciones</h3>
            {trace.approvals.length === 0 && (
              <p className="audit-note">
                Esta venta no pasó por una aprobación de precio.
              </p>
            )}
            {trace.approvals.length > 0 && (
              <ul className="audit-approvals">
                {trace.approvals.map((approval) => (
                  <li key={approval.id}>
                    <span
                      className={`status-badge${
                        approval.decision === 'APROBADA'
                          ? ' status-badge--success'
                          : ' status-badge--warning'
                      }`}
                    >
                      {decisionLabels[approval.decision]}
                    </span>
                    <p>
                      <strong>Pidió:</strong>{' '}
                      {approval.requestedBy?.fullName ?? '—'} el{' '}
                      {formatDateTime(approval.requestedAt)}
                    </p>
                    <p>
                      <strong>
                        {approval.decision === 'RECHAZADA'
                          ? 'Rechazó:'
                          : 'Aprobó:'}
                      </strong>{' '}
                      {approval.decidedAt
                        ? `${approval.decidedBy?.fullName ?? '—'} el ${formatDateTime(approval.decidedAt)}`
                        : 'todavía nadie'}
                    </p>
                    <p>
                      Lista {formatMoney(approval.listPrice ?? undefined)} ·
                      mínimo {formatMoney(approval.minimumPrice ?? undefined)}{' '}
                      · acordado{' '}
                      {formatMoney(approval.agreedPrice ?? undefined)}
                    </p>
                    {approval.reason && <p>Motivo: {approval.reason}</p>}
                  </li>
                ))}
              </ul>
            )}

            <h3 className="audit-section">
              Línea de tiempo ({trace.eventsTotal}{' '}
              {trace.eventsTotal === 1 ? 'evento' : 'eventos'})
            </h3>
            {trace.events.length === 0 && (
              <p className="audit-note">
                No hay eventos registrados para esta venta (las ventas
                importadas del Excel no traen historial previo).
              </p>
            )}
            <ol className="audit-timeline">
              {trace.events.map((event) => {
                const changes = auditChanges(
                  event.previousData,
                  event.metadata,
                ).filter((change) => change.changed)
                return (
                  <li key={event.id}>
                    <time dateTime={event.createdAt}>
                      {formatDateTime(event.createdAt)}
                    </time>
                    <strong>{event.actionLabel}</strong>
                    <span>
                      {actorName(event)}
                      {event.actor?.role ? ` (${event.actor.role})` : ''}
                    </span>
                    {event.entity !== 'operaciones' && event.subject && (
                      <small>
                        {event.subject.title}
                        {event.subject.amount
                          ? ` · ${formatMoney(event.subject.amount)}`
                          : ''}
                      </small>
                    )}
                    {changes.map((change) => (
                      <small key={change.key}>
                        {change.label}: {change.before} → {change.after}
                      </small>
                    ))}
                  </li>
                )
              })}
            </ol>
            {trace.eventsTotal > trace.events.length && (
              <p className="audit-note">
                Se muestran los primeros {trace.events.length} eventos. El
                resto está en la pestaña Actividad filtrando por N.º de
                operación.
              </p>
            )}

            <h3 className="audit-section">Dinero de esta venta</h3>
            {trace.movements.length === 0 ? (
              <p className="audit-note">
                Todavía no hay cobros ni pagos registrados para esta venta.
              </p>
            ) : (
              <MoneyTable movements={trace.movements} />
            )}
          </>
        )}

        <footer className="financial-modal__actions">
          <button
            className="button button--primary"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}
