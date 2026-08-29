import {
  AlertTriangle,
  Bike,
  CarFront,
  LoaderCircle,
  RefreshCw,
  X,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import {
  commissionErrorMessage,
  decimalAmount,
  formatCommissionDate,
  formatCommissionMoney,
  localIsoDate,
  statusLabels,
  tierLabel,
  vehicleLabels,
} from './format'
import type {
  AgreementInput,
  CommissionDetail,
  CommissionGateway,
  CommissionOperation,
  CommissionStatus,
  CommissionSummary,
  CommissionSettlement,
  CommissionVehicleType,
} from './types'

export function VehicleTypeNav({
  active,
  path,
}: {
  active: CommissionVehicleType
  path: string
}) {
  return (
    <nav className="commission-type-nav" aria-label="Tipo de vehículo">
      {(['MOTO', 'AUTO'] as const).map((type) => {
        const Icon = type === 'MOTO' ? Bike : CarFront
        return (
          <NavLink
            key={type}
            className={type === active ? 'active' : ''}
            to={`${path}/${type.toLowerCase()}s`}
          >
            <Icon size={18} aria-hidden="true" />
            {vehicleLabels[type]}
          </NavLink>
        )
      })}
    </nav>
  )
}

export function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  const tone =
    status === 'PAID'
      ? 'status-badge--success'
      : status === 'PENDING_PAYMENT'
        ? 'status-badge--warning'
        : ''
  return <span className={`status-badge ${tone}`}>{statusLabels[status]}</span>
}

export function CommissionLoadState({
  status,
  error,
  empty,
  onRetry,
  children,
}: {
  status: 'loading' | 'success' | 'error'
  error: string
  empty: boolean
  onRetry: () => void
  children: ReactNode
}) {
  if (status === 'loading') {
    return (
      <div className="commission-loading" role="status">
        <LoaderCircle className="spin" size={25} />
        <span>Cargando comisiones…</span>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <StatePanel
        icon={RefreshCw}
        title="No pudimos cargar las comisiones"
        description={error}
        tone="danger"
        action={
          <button className="button button--primary" type="button" onClick={onRetry}>
            Reintentar
          </button>
        }
      />
    )
  }
  if (empty) {
    return (
      <StatePanel
        icon={AlertTriangle}
        title="No hay resultados"
        description="No encontramos comisiones para los filtros seleccionados."
      />
    )
  }
  return children
}

export function CommissionOperations({ operations }: { operations: CommissionOperation[] }) {
  if (operations.length === 0) {
    return <p className="commission-empty-note">No hay operaciones en este período.</p>
  }
  return (
    <>
      <div className="commission-operation-table">
        <table className="financial-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente / vehículo</th>
              <th>Precio lista</th>
              <th>Cierre</th>
              <th>Diferencia</th>
              <th>Estado</th>
              <th>Computable</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => (
              <tr key={operation.id} className={operation.belowList ? 'commission-operation--low' : ''}>
                <td>{formatCommissionDate(operation.date)}</td>
                <td>
                  <strong>{operation.customerName}</strong>
                  <small>{operation.vehicleLabel}</small>
                </td>
                <td>{formatCommissionMoney(operation.listPrice)}</td>
                <td>{formatCommissionMoney(operation.closingPrice)}</td>
                <td>{operation.difference ? formatCommissionMoney(operation.difference) : '—'}</td>
                <td>{operation.status}</td>
                <td>
                  <span className={`status-badge ${operation.computable ? 'status-badge--success' : ''}`}>
                    {operation.computable ? 'Sí' : 'No'}
                  </span>
                  {!operation.computable && operation.nonComputableReason && (
                    <small>{operation.nonComputableReason}</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="commission-operation-cards">
        {operations.map((operation) => (
          <article
            key={operation.id}
            className={`commission-operation-card ${operation.belowList ? 'commission-operation-card--low' : ''}`}
          >
            <header>
              <div>
                <strong>{operation.customerName}</strong>
                <small>{formatCommissionDate(operation.date)} · {operation.vehicleLabel}</small>
              </div>
              <span className={`status-badge ${operation.computable ? 'status-badge--success' : ''}`}>
                {operation.computable ? 'Computable' : 'No computable'}
              </span>
            </header>
            <dl>
              <div><dt>Lista</dt><dd>{formatCommissionMoney(operation.listPrice)}</dd></div>
              <div><dt>Cierre</dt><dd>{formatCommissionMoney(operation.closingPrice)}</dd></div>
              <div><dt>Diferencia</dt><dd>{operation.difference ? formatCommissionMoney(operation.difference) : '—'}</dd></div>
              <div><dt>Estado</dt><dd>{operation.status}</dd></div>
            </dl>
            {!operation.computable && operation.nonComputableReason && <p>{operation.nonComputableReason}</p>}
          </article>
        ))}
      </div>
    </>
  )
}

export function CommissionProgress({ commission }: { commission: CommissionSummary }) {
  return (
    <div className="commission-progress">
      <article>
        <small>Ventas computables</small>
        <strong>{commission.computableSales}</strong>
      </article>
      <article>
        <small>Escala alcanzada</small>
        <strong>{tierLabel(commission.scale)}</strong>
      </article>
      <article className="commission-progress__amount">
        <small>Comisión fija total</small>
        <strong>{formatCommissionMoney(commission.suggestedAmount)}</strong>
      </article>
      <article>
        <small>Próxima escala</small>
        <strong>{commission.nextScale ? tierLabel(commission.nextScale) : 'Escala máxima'}</strong>
        {commission.unitsToNextScale !== null && (
          <span>Faltan {commission.unitsToNextScale} {commission.unitsToNextScale === 1 ? 'venta' : 'ventas'}</span>
        )}
      </article>
    </div>
  )
}

export function AgreementModal({
  detail,
  gateway,
  onClose,
  onSaved,
}: {
  detail: CommissionDetail
  gateway: CommissionGateway
  onClose: () => void
  onSaved: (settlement: CommissionSettlement) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialogFocus(onClose, submitting)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const agreedAmount = decimalAmount(form.get('agreedAmount'))
    if (!agreedAmount) {
      setError('Ingresá un importe acordado mayor a cero.')
      return
    }
    const input: AgreementInput = {
      agreedAmount,
      meetingDate: String(form.get('meetingDate')),
      expectedVersion: detail.version,
      ...(String(form.get('notes') ?? '').trim()
        ? { notes: String(form.get('notes')).trim() }
        : {}),
    }
    setSubmitting(true)
    setError('')
    try {
      onSaved(await gateway.registerAgreement(detail.id, input))
    } catch (submitError) {
      setError(commissionErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div ref={dialogRef} className="settlement-modal" role="dialog" aria-modal="true" aria-labelledby="agreement-title">
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">{detail.seller.name} · {vehicleLabels[detail.vehicleType]}</p>
            <h2 id="agreement-title">Registrar acuerdo</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="commission-confirm-summary">
          <span>Sugerido fijo total</span>
          <strong>{formatCommissionMoney(detail.suggestedAmount)}</strong>
        </div>
        {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="field">
            <span>Importe acordado *</span>
            <input name="agreedAmount" type="number" min="0.01" step="0.01" defaultValue={detail.settlement?.agreedAmount ?? detail.suggestedAmount ?? ''} required />
          </label>
          <label className="field">
            <span>Fecha de reunión *</span>
            <input name="meetingDate" type="date" defaultValue={detail.settlement?.meetingDate ?? localIsoDate()} required />
          </label>
          <label className="field">
            <span>Observaciones</span>
            <textarea name="notes" rows={3} maxLength={2000} defaultValue={detail.settlement?.notes ?? ''} />
          </label>
          <footer className="financial-modal__actions">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancelar</button>
            <button className="button button--primary" type="submit" disabled={submitting}>
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Registrando…' : 'Registrar acuerdo'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
