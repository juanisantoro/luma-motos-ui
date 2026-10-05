import { X } from 'lucide-react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { formatMoney } from '../finance/format'
import { actorName, auditChanges, formatDateTime } from './format'
import type { AuditEvent } from './types'

// Detalle de un evento: quién, cuándo, desde dónde y qué cambió.
export function AuditEventModal({
  event,
  onClose,
  onOpenOperation,
}: {
  event: AuditEvent
  onClose: () => void
  onOpenOperation?: (operationId: string) => void
}) {
  const dialogRef = useDialogFocus(onClose)
  const changes = auditChanges(event.previousData, event.metadata)
  const compare = Boolean(event.previousData && event.metadata)
  const subjectTitle = event.restricted
    ? 'Registro de otra sucursal'
    : (event.subject?.title ?? 'Sin registro asociado')
  const operationId = event.subject?.operationId

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="audit-event-title"
        aria-modal="true"
        className="financial-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">{event.categoryLabel.toUpperCase()}</p>
            <h2 id="audit-event-title">{event.actionLabel}</h2>
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

        <dl className="audit-facts">
          <div>
            <dt>Fecha y hora</dt>
            <dd>{formatDateTime(event.createdAt)}</dd>
          </div>
          <div>
            <dt>Quién lo hizo</dt>
            <dd>
              {actorName(event)}
              {event.actor?.name && <small>{event.actor.email}</small>}
            </dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{event.actor?.role ?? '—'}</dd>
          </div>
          <div>
            <dt>Sucursal del usuario</dt>
            <dd>{event.branch?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Sobre qué</dt>
            <dd>
              {subjectTitle}
              {event.subject?.detail && <small>{event.subject.detail}</small>}
            </dd>
          </div>
          {event.subject?.amount && (
            <div>
              <dt>Importe</dt>
              <dd>{formatMoney(event.subject.amount)}</dd>
            </div>
          )}
          <div>
            <dt>Dirección IP</dt>
            <dd>{event.ipAddress ?? '—'}</dd>
          </div>
          <div>
            <dt>Código interno</dt>
            <dd>
              <code>{event.action}</code>
            </dd>
          </div>
        </dl>

        {event.restricted && (
          <p className="audit-note">
            El registro es de una sucursal que no está en tu alcance: ves quién
            y cuándo, pero no el detalle.
          </p>
        )}
        {!event.restricted && changes.length === 0 && (
          <p className="audit-note">
            Este evento no guardó el detalle de los valores: queda registrado
            quién lo hizo, cuándo y sobre qué registro.
          </p>
        )}
        {changes.length > 0 && (
          <div className="financial-table-wrap">
            <table className="financial-table audit-diff">
              <thead>
                <tr>
                  <th>Dato</th>
                  {compare && <th>Antes</th>}
                  <th>{compare ? 'Después' : 'Valor registrado'}</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr
                    className={change.changed ? 'audit-diff__changed' : ''}
                    key={change.key}
                  >
                    <td>{change.label}</td>
                    {compare && <td>{change.before}</td>}
                    <td>
                      {compare || !event.previousData
                        ? change.after
                        : change.before}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="financial-modal__actions">
          {operationId && onOpenOperation && (
            <button
              className="button button--secondary"
              onClick={() => onOpenOperation(operationId)}
              type="button"
            >
              Ver historial de la venta N.º {event.subject?.operationNumber}
            </button>
          )}
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
