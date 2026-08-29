import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react'
import type { CreditCheckState } from './types'
import './credit-checks.css'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

type CreditAlertProps = {
  state: CreditCheckState
  onRetry?: () => void
  showClearResult?: boolean
}

export function CreditAlert({
  state,
  onRetry,
  showClearResult = false,
}: CreditAlertProps) {
  if (state.status === 'idle') return null

  if (state.status === 'loading') {
    return (
      <div className="credit-check credit-check--loading" role="status">
        <LoaderCircle className="credit-check__spin" size={20} aria-hidden="true" />
        <span>Consultando antecedentes crediticios…</span>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="credit-check credit-check--error" role="alert">
        <AlertTriangle size={20} aria-hidden="true" />
        <div>
          <strong>No se pudo completar la consulta</strong>
          <p>{state.message}</p>
        </div>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            <RefreshCw size={17} aria-hidden="true" />
            Reintentar
          </button>
        )}
      </div>
    )
  }

  if (state.status === 'not-found') {
    return showClearResult ? (
      <div className="credit-check credit-check--clear" role="status">
        <CheckCircle2 size={20} aria-hidden="true" />
        <span>No hay antecedentes crediticios registrados para este documento.</span>
      </div>
    ) : null
  }

  const { data } = state
  const rejection = data.lastRejection
  if (!data.isFlagged || !rejection) {
    return showClearResult ? (
      <div className="credit-check credit-check--clear" role="status">
        <CheckCircle2 size={20} aria-hidden="true" />
        <span>No hay rechazos previos registrados para este documento.</span>
      </div>
    ) : null
  }

  return (
    <div
      className={`credit-check credit-check--warning ${data.blocksSale ? 'credit-check--blocking' : ''}`}
      role="alert"
      aria-label="Alerta de antecedente crediticio"
    >
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <strong>Este documento registra un rechazo crediticio previo</strong>
        <dl>
          <div>
            <dt>Financiera</dt>
            <dd>{rejection.financialEntity.name}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{formatDate(rejection.rejectedAt)}</dd>
          </div>
          <div className="credit-check__reason">
            <dt>Motivo</dt>
            <dd>{rejection.reason ?? 'Sin motivo informado'}</dd>
          </div>
        </dl>
        <p className="credit-check__note">
          {data.blocksSale
            ? 'El backend indicó que la operación no puede continuar.'
            : 'La alerta es informativa y no bloquea la operación por sí sola.'}
        </p>
      </div>
    </div>
  )
}

