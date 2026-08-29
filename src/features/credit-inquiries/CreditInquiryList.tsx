import { ChevronDown, ChevronUp, History, RefreshCw } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { getCreditHistory } from './api'
import { creditInquiryErrorMessage } from './errors'
import type { CreditHistoryResponse, CreditInquiry } from './types'

type HistoryState =
  | { status: 'loading' }
  | { status: 'success'; data: CreditHistoryResponse }
  | { status: 'error'; message: string }

type CreditInquiryListProps = {
  inquiries: CreditInquiry[]
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function outcomeLabel(outcome: CreditInquiry['outcome']) {
  if (outcome === 'APROBADA') return 'Aprobada'
  if (outcome === 'PENDIENTE') return 'Pendiente'
  return 'Rechazada'
}

function outcomeClass(outcome: CreditInquiry['outcome']) {
  if (outcome === 'APROBADA') return 'credit-inquiries-badge--approved'
  if (outcome === 'PENDIENTE') return 'credit-inquiries-badge--pending'
  return 'credit-inquiries-badge--rejected'
}

function InquiryHistory({
  state,
  panelId,
  onRetry,
}: {
  state: HistoryState
  panelId: string
  onRetry: () => void
}) {
  if (state.status === 'loading') {
    return (
      <div
        className="credit-inquiries-history__state"
        id={panelId}
        role="status"
      >
        Cargando historial…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div
        className="credit-inquiries-history__state"
        id={panelId}
        role="alert"
      >
        <span>{state.message}</span>
        <button type="button" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <section
      className="credit-inquiries-history"
      id={panelId}
      aria-label="Historial de consultas"
    >
      <header>
        <strong>{state.data.summary.totalAttempts} intentos registrados</strong>
        <span>
          {state.data.summary.rejectedAttempts} rechazados ·{' '}
          {state.data.summary.approvedAttempts} aprobados ·{' '}
          {state.data.summary.pendingAttempts} pendientes
        </span>
      </header>
      <ol>
        {state.data.items.map((item) => (
          <li key={item.id}>
            <div>
              <span
                className={`credit-inquiries-badge ${outcomeClass(item.outcome)}`}
              >
                {outcomeLabel(item.outcome)}
              </span>
              <strong>{item.financialEntity.name}</strong>
            </div>
            <p>{item.reason ?? 'Sin motivo informado'}</p>
            <small>
              {formatDate(item.consultedAt)} · {item.registeredBy.fullName} ·{' '}
              {item.branch.name}
            </small>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function CreditInquiryList({ inquiries }: CreditInquiryListProps) {
  const isCardLayout = useMediaQuery('(max-width: 768px)')
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null)
  const [histories, setHistories] = useState<Record<string, HistoryState>>({})
  const controllersRef = useRef(new Map<string, AbortController>())

  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort())
    },
    [],
  )

  const loadHistory = (clientId: string) => {
    controllersRef.current.get(clientId)?.abort()
    const controller = new AbortController()
    controllersRef.current.set(clientId, controller)
    setHistories((current) => ({
      ...current,
      [clientId]: { status: 'loading' },
    }))
    void getCreditHistory(clientId, 1, 50, controller.signal)
      .then((data) => {
        setHistories((current) => ({
          ...current,
          [clientId]: { status: 'success', data },
        }))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setHistories((current) => ({
          ...current,
          [clientId]: {
            status: 'error',
            message: creditInquiryErrorMessage(error),
          },
        }))
      })
      .finally(() => controllersRef.current.delete(clientId))
  }

  const toggleHistory = (inquiryId: string, clientId: string) => {
    if (expandedInquiryId === inquiryId) {
      setExpandedInquiryId(null)
      return
    }
    setExpandedInquiryId(inquiryId)
    if (!histories[clientId]) loadHistory(clientId)
  }

  if (isCardLayout) {
    return (
      <div className="credit-inquiries-card-list">
        {inquiries.map((inquiry) => {
          const expanded = expandedInquiryId === inquiry.id
          const history = histories[inquiry.client.id]
          const panelId = `credit-history-${inquiry.id}`
          return (
            <article className="credit-inquiries-card" key={inquiry.id}>
              <header>
                <div>
                  <strong>{inquiry.client.fullName}</strong>
                  <span>
                    {inquiry.client.documentType} {inquiry.client.documentNumber}
                  </span>
                </div>
                <span className="credit-inquiries-badge credit-inquiries-badge--rejected">
                  Rechazada
                </span>
              </header>
              <dl>
                <div>
                  <dt>Financiera</dt>
                  <dd>{inquiry.financialEntity.name}</dd>
                </div>
                <div>
                  <dt>Último rechazo</dt>
                  <dd>{formatDate(inquiry.consultedAt)}</dd>
                </div>
                <div>
                  <dt>Motivo</dt>
                  <dd>{inquiry.reason ?? 'Sin motivo informado'}</dd>
                </div>
                <div>
                  <dt>Intentos</dt>
                  <dd>{inquiry.attemptCount}</dd>
                </div>
                <div>
                  <dt>Registrado por</dt>
                  <dd>
                    {inquiry.registeredBy.fullName} · {inquiry.branch.name}
                  </dd>
                </div>
              </dl>
              <button
                className="credit-inquiries-history-button"
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggleHistory(inquiry.id, inquiry.client.id)}
              >
                <History size={17} aria-hidden="true" />
                {expanded ? 'Ocultar historial' : 'Ver historial'}
                {expanded ? (
                  <ChevronUp size={17} aria-hidden="true" />
                ) : (
                  <ChevronDown size={17} aria-hidden="true" />
                )}
              </button>
              {expanded && history && (
                <InquiryHistory
                  state={history}
                  panelId={panelId}
                  onRetry={() => loadHistory(inquiry.client.id)}
                />
              )}
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <div className="credit-inquiries-table-wrap">
      <table className="credit-inquiries-table">
        <thead>
          <tr>
            <th>Documento / cliente</th>
            <th>Financiera</th>
            <th>Motivo informado</th>
            <th>Intentos</th>
            <th>Último rechazo</th>
            <th>Registrado por</th>
            <th>
              <span className="sr-only">Historial</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inquiry) => {
            const expanded = expandedInquiryId === inquiry.id
            const history = histories[inquiry.client.id]
            const panelId = `credit-history-${inquiry.id}`
            return (
              <Fragment key={inquiry.id}>
                <tr className="credit-inquiries-table__group">
                  <td>
                    <strong>
                      {inquiry.client.documentType}{' '}
                      {inquiry.client.documentNumber}
                    </strong>
                    <span>{inquiry.client.fullName}</span>
                  </td>
                  <td>{inquiry.financialEntity.name}</td>
                  <td className="credit-inquiries-table__reason">
                    {inquiry.reason ?? 'Sin motivo informado'}
                  </td>
                  <td>
                    <strong>{inquiry.attemptCount}</strong>
                  </td>
                  <td>{formatDate(inquiry.consultedAt)}</td>
                  <td>
                    <strong>{inquiry.registeredBy.fullName}</strong>
                    <span>{inquiry.branch.name}</span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`${expanded ? 'Ocultar' : 'Ver'} historial de ${inquiry.client.fullName}`}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() =>
                        toggleHistory(inquiry.id, inquiry.client.id)
                      }
                    >
                      {expanded ? (
                        <ChevronUp size={19} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={19} aria-hidden="true" />
                      )}
                    </button>
                  </td>
                </tr>
                {expanded && history && (
                  <tr className="credit-inquiries-table__history-row">
                    <td colSpan={7}>
                      <InquiryHistory
                        state={history}
                        panelId={panelId}
                        onRetry={() => loadHistory(inquiry.client.id)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
