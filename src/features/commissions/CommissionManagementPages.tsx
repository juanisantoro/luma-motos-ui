import {
  CheckCircle2,
  CreditCard,
  FileSearch,
  LoaderCircle,
  ReceiptText,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import {
  AgreementModal,
  CommissionLoadState,
  CommissionOperations,
  CommissionProgress,
  CommissionStatusBadge,
  VehicleTypeNav,
} from './components'
import {
  commissionErrorMessage,
  formatCommissionDate,
  formatCommissionMoney,
  formatPeriod,
  newCommissionIdempotencyKey,
  localIsoDate,
  tierLabel,
  vehicleLabels,
  withOptional,
} from './format'
import type {
  CommissionDetail,
  CommissionGateway,
  CommissionOptions,
  CommissionPaymentOptions,
  CommissionSettlement,
  CommissionSummary,
  CommissionVehicleType,
  PaidCommission,
  PaidCommissionQuery,
  PaymentInput,
} from './types'

function currentPeriod() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const emptyOptions: CommissionOptions = { sellers: [], branches: [] }
const emptyPaymentOptions: CommissionPaymentOptions = { accounts: [] }

export function SellerMeetingPage({
  vehicleType,
  gateway,
}: {
  vehicleType: CommissionVehicleType
  gateway: CommissionGateway
}) {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialSuggestion = searchParams.get('suggestion')
  const [period, setPeriod] = useState(currentPeriod)
  const [items, setItems] = useState<CommissionSummary[]>([])
  const [selectedId, setSelectedId] = useState(initialSuggestion ?? '')
  const [detail, setDetail] = useState<CommissionDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [agreementOpen, setAgreementOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const canAgree = hasPermission(user?.role.permissions, 'comisiones.acordar')

  useEffect(() => {
    if (initialSuggestion) {
      setSelectedId(initialSuggestion)
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    void gateway.listSuggestions(
          { vehicleType, period, page: 1, limit: 100 },
          controller.signal,
        )
      .then((result) => {
          setItems(result.items)
          setSelectedId((current) => {
           const selected =
             result.items.find((item) => item.id === current) ?? result.items[0]
           return selected?.id ?? ''
          })
          setStatus('success')
        })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(commissionErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [gateway, initialSuggestion, period, refreshKey, vehicleType])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    const controller = new AbortController()
    setDetail(null)
    setAgreementOpen(false)
    setStatus('loading')
    setError('')
    void gateway
      .getSuggestion(selectedId, controller.signal)
      .then((result) => {
        setDetail(result)
        if (initialSuggestion) {
          setPeriod((current) => current === result.period ? current : result.period)
        }
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(commissionErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [detailRefreshKey, gateway, initialSuggestion, selectedId, vehicleType])

  const selectSeller = (id: string) => {
    setSelectedId(id)
  }

  const changePeriod = (nextPeriod: string) => {
    setAgreementOpen(false)
    setDetail(null)
    setSelectedId('')
    setPeriod(nextPeriod)
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">COMISIONES · REUNIÓN</p>
          <h1>Visualizar con vendedor</h1>
          <p>Una presentación limpia del período, sin controles administrativos ajenos al acuerdo.</p>
        </div>
      </header>
      <VehicleTypeNav active={vehicleType} path="/comisiones/reunion" />
      {!initialSuggestion && (
        <section className="commission-meeting-controls" aria-label="Seleccionar reunión">
          <label className="field">
            <span>Período</span>
            <input aria-label="Período" type="month" value={period} onChange={(event) => changePeriod(event.target.value)} />
          </label>
          <label className="field">
            <span>Vendedor</span>
            <select aria-label="Vendedor" value={selectedId} onChange={(event) => selectSeller(event.target.value)}>
              <option value="">Seleccionar vendedor</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.seller.name} · {item.branch.name}</option>)}
            </select>
          </label>
        </section>
      )}
      <section className="commission-meeting">
        <CommissionLoadState
          status={status}
          error={error}
          empty={!detail}
          onRetry={() => {
            if (selectedId) {
              setDetailRefreshKey((key) => key + 1)
            } else {
              setRefreshKey((key) => key + 1)
            }
          }}
        >
          {detail && (
            <>
              <header className="commission-meeting__hero">
                <div>
                  <p>{vehicleLabels[detail.vehicleType]} · {formatPeriod(detail.period)}</p>
                  <h2>{detail.seller.name}</h2>
                  <span>{detail.branch.name}</span>
                </div>
                <CommissionStatusBadge status={detail.status} />
              </header>
              {detail.configurationStatus === 'NOT_CONFIGURED' ? (
                <StatePanel
                  icon={FileSearch}
                  title="Escalas no configuradas"
                  description={`Todavía no hay una política de ${vehicleLabels[vehicleType].toLowerCase()} para este período.`}
                />
              ) : (
                <>
                  <CommissionProgress commission={detail} />
                  <div className="commission-explanation">
                    <CheckCircle2 size={20} />
                    <p>
                      Con <strong>{detail.computableSales} ventas computables</strong>, se alcanzó la escala{' '}
                      <strong>{tierLabel(detail.scale)}</strong>. Corresponde un total fijo de{' '}
                      <strong>{formatCommissionMoney(detail.suggestedAmount)}</strong> por todo el período.
                    </p>
                  </div>
                  <div className="commission-meeting__section-title">
                    <div>
                      <h3>Operaciones del período</h3>
                      <p>Verde: computable. Ámbar: bajo lista. Las demás explican por qué no computan.</p>
                    </div>
                    {canAgree && detail.status !== 'PAID' && (
                      <button className="button button--primary" type="button" onClick={() => setAgreementOpen(true)}>
                        Registrar acuerdo
                      </button>
                    )}
                  </div>
                  <CommissionOperations operations={detail.operations} />
                </>
              )}
            </>
          )}
        </CommissionLoadState>
      </section>
      {agreementOpen && detail && (
        <AgreementModal
          detail={detail}
          gateway={gateway}
          onClose={() => setAgreementOpen(false)}
          onSaved={(next) => {
            setDetail((current) => current ? {
              ...current,
              settlement: next,
              status: next.status,
              version: next.version,
            } : current)
            setAgreementOpen(false)
          }}
        />
      )}
    </>
  )
}

function PaymentModal({
  commission,
  options,
  gateway,
  onClose,
  onPaid,
}: {
  commission: CommissionSettlement
  options: CommissionPaymentOptions
  gateway: CommissionGateway
  onClose: () => void
  onPaid: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [idempotencyKey] = useState(newCommissionIdempotencyKey)
  const dialogRef = useDialogFocus(onClose, submitting)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!confirmed || submitting) return
    const data = new FormData(event.currentTarget)
    const input: PaymentInput = {
      idempotencyKey,
      expectedVersion: commission.version,
      accountId: String(data.get('accountId')),
      paidAt: String(data.get('paidAt')),
      reference: String(data.get('reference')).trim(),
      ...(String(data.get('receipt') ?? '').trim() ? { receipt: String(data.get('receipt')).trim() } : {}),
      ...(String(data.get('notes') ?? '').trim() ? { notes: String(data.get('notes')).trim() } : {}),
    }
    setSubmitting(true)
    setError('')
    try {
      await gateway.pay(commission.id, input)
      onPaid()
    } catch (submitError) {
      setError(commissionErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div ref={dialogRef} className="settlement-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <header className="client-modal__header">
          <div><p className="eyebrow">PAGO COMPLETO</p><h2 id="payment-title">Hacer efectivo el pago</h2></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={submitting} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="commission-payment-summary">
          <div><span>Vendedor</span><strong>{commission.seller.name}</strong></div>
          <div><span>Período / tipo</span><strong>{formatPeriod(commission.period)} · {vehicleLabels[commission.vehicleType]}</strong></div>
          <div><span>Sugerido</span><strong>{formatCommissionMoney(commission.suggestedAmount)}</strong></div>
          <div><span>Acordado a pagar</span><strong>{formatCommissionMoney(commission.agreedAmount)}</strong></div>
        </div>
        {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="field"><span>Cuenta / caja *</span>
            <select name="accountId" required>
              <option value="">Seleccionar cuenta</option>
              {options.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Fecha de pago *</span><input name="paidAt" type="date" defaultValue={localIsoDate()} required /></label>
          <label className="field"><span>Referencia *</span><input name="reference" maxLength={120} required /></label>
          <label className="field"><span>Comprobante</span><input name="receipt" maxLength={120} /></label>
          <label className="field"><span>Observaciones</span><textarea name="notes" rows={3} maxLength={2000} /></label>
          <label className="commission-confirm-check">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            Confirmo el pago completo de {formatCommissionMoney(commission.agreedAmount)}. Esta acción no admite pagos parciales.
          </label>
          <footer className="financial-modal__actions">
            <button className="button button--secondary" type="button" disabled={submitting} onClick={onClose}>Cancelar</button>
            <button className="button button--primary" type="submit" disabled={!confirmed || submitting}>
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Procesando pago…' : 'Confirmar pago completo'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

export function CommissionPaymentsPage({
  vehicleType,
  gateway,
}: {
  vehicleType: CommissionVehicleType
  gateway: CommissionGateway
}) {
  const [period, setPeriod] = useState(currentPeriod)
  const [items, setItems] = useState<CommissionSettlement[]>([])
  const [options, setOptions] = useState(emptyPaymentOptions)
  const [optionsStatus, setOptionsStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [optionsError, setOptionsError] = useState('')
  const [optionsRefreshKey, setOptionsRefreshKey] = useState(0)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [payment, setPayment] = useState<CommissionSettlement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    void gateway
      .listPayable(
        { vehicleType, period, page: 1, limit: 50 },
        controller.signal,
      )
      .then((result) => {
        setItems(result.items)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(commissionErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [gateway, period, refreshKey, vehicleType])

  useEffect(() => {
    const controller = new AbortController()
    setOptionsStatus('loading')
    setOptionsError('')
    void gateway
      .listPaymentOptions(controller.signal)
      .then((result) => {
        setOptions(result)
        setOptionsStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setOptions(emptyPaymentOptions)
        setOptionsError(commissionErrorMessage(loadError))
        setOptionsStatus('error')
      })
    return () => controller.abort()
  }, [gateway, optionsRefreshKey])

  return (
    <>
      <header className="page-heading"><div><p className="eyebrow">COMISIONES · TESORERÍA</p><h1>Pagar comisiones</h1><p>Liquidaciones acordadas y pendientes de pago completo.</p></div></header>
      <VehicleTypeNav active={vehicleType} path="/comisiones/pagar" />
      {optionsStatus === 'error' && <StatePanel icon={FileSearch} title="No pudimos cargar las cuentas de pago" description={optionsError} tone="danger" action={<button className="button button--secondary" type="button" onClick={() => setOptionsRefreshKey((key) => key + 1)}>Reintentar cuentas</button>} />}
      <div className="commission-single-filter">
        <label className="field"><span>Período</span><input aria-label="Período" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
      </div>
      <section className="commission-panel">
        <CommissionLoadState status={status} error={error} empty={items.length === 0} onRetry={() => setRefreshKey((key) => key + 1)}>
          <div className="commission-desktop-table">
            <table className="financial-table commission-table">
              <thead><tr><th>Vendedor</th><th>Sucursal</th><th>Período</th><th>Cantidad</th><th>Escala</th><th>Sugerido</th><th>Acordado</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.seller.name}</strong></td><td>{item.branch.name}</td><td>{formatPeriod(item.period)}</td>
                  <td>{item.computableSales}</td><td>{tierLabel(item.scale)}</td><td>{formatCommissionMoney(item.suggestedAmount)}</td>
                  <td><strong>{formatCommissionMoney(item.agreedAmount)}</strong></td><td><CommissionStatusBadge status={item.status} /></td>
                  <td><button className="button button--primary button--compact" type="button" disabled={optionsStatus !== 'success'} onClick={() => setPayment(item)}><CreditCard size={16} /> Hacer efectivo</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="commission-card-list">{items.map((item) => (
            <article className="commission-card" key={item.id}>
              <header><div><strong>{item.seller.name}</strong><small>{item.branch.name} · {formatPeriod(item.period)}</small></div><CommissionStatusBadge status={item.status} /></header>
              <dl><div><dt>Ventas</dt><dd>{item.computableSales}</dd></div><div><dt>Sugerido</dt><dd>{formatCommissionMoney(item.suggestedAmount)}</dd></div><div><dt>A pagar</dt><dd><strong>{formatCommissionMoney(item.agreedAmount)}</strong></dd></div></dl>
              <button className="button button--primary" type="button" disabled={optionsStatus !== 'success'} onClick={() => setPayment(item)}>Hacer efectivo el pago</button>
            </article>
          ))}</div>
        </CommissionLoadState>
      </section>
      {payment && <PaymentModal commission={payment} options={options} gateway={gateway} onClose={() => setPayment(null)} onPaid={() => { setPayment(null); setRefreshKey((key) => key + 1) }} />}
    </>
  )
}

export function PaidCommissionsPage({
  vehicleType,
  gateway,
}: {
  vehicleType: CommissionVehicleType
  gateway: CommissionGateway
}) {
  const [query, setQuery] = useState<PaidCommissionQuery>({ vehicleType, page: 1, limit: 50 })
  const [draft, setDraft] = useState(query)
  const [items, setItems] = useState<PaidCommission[]>([])
  const [options, setOptions] = useState(emptyOptions)
  const [optionsStatus, setOptionsStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [optionsError, setOptionsError] = useState('')
  const [optionsRefreshKey, setOptionsRefreshKey] = useState(0)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [audit, setAudit] = useState<PaidCommission | null>(null)

  useEffect(() => {
    setQuery((current) =>
      current.vehicleType === vehicleType
        ? current
        : { ...current, vehicleType, page: 1 },
    )
    setDraft((current) =>
      current.vehicleType === vehicleType
        ? current
        : { ...current, vehicleType, page: 1 },
    )
  }, [vehicleType])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    void gateway
      .listPaid(query, controller.signal)
      .then((result) => {
        setItems(result.items)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(commissionErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [gateway, query, refreshKey])

  useEffect(() => {
    const controller = new AbortController()
    setOptionsStatus('loading')
    setOptionsError('')
    void gateway
      .listOptions(controller.signal)
      .then((result) => {
        setOptions(result)
        setOptionsStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setOptions(emptyOptions)
        setOptionsError(commissionErrorMessage(loadError))
        setOptionsStatus('error')
      })
    return () => controller.abort()
  }, [gateway, optionsRefreshKey])

  const apply = (event: FormEvent) => {
    event.preventDefault()
    setQuery({ ...draft, vehicleType, page: 1, limit: 50 })
  }

  return (
    <>
      <header className="page-heading"><div><p className="eyebrow">COMISIONES · HISTÓRICO</p><h1>Comisiones pagadas</h1><p>Histórico inalterable con escala, importes y medio de pago registrados.</p></div></header>
      <VehicleTypeNav active={vehicleType} path="/comisiones/pagadas" />
      {optionsStatus === 'error' && <StatePanel icon={FileSearch} title="No pudimos cargar vendedores y sucursales" description={optionsError} tone="danger" action={<button className="button button--secondary" type="button" onClick={() => setOptionsRefreshKey((key) => key + 1)}>Reintentar opciones</button>} />}
      <details className="financial-filters commission-filters" open>
        <summary>Filtros</summary>
        <form onSubmit={apply}>
          <label className="filter-field">Vendedor<select aria-label="Vendedor" disabled={optionsStatus === 'loading'} value={draft.sellerId ?? ''} onChange={(event) => setDraft(withOptional(draft, 'sellerId', event.target.value || undefined))}><option value="">Todos</option>{options.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
          <label className="filter-field">Sucursal<select aria-label="Sucursal" disabled={optionsStatus === 'loading'} value={draft.branchId ?? ''} onChange={(event) => setDraft(withOptional(draft, 'branchId', event.target.value || undefined))}><option value="">Todas</option>{options.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="filter-field">Fecha desde<input aria-label="Fecha desde" type="date" value={draft.paidFrom ?? ''} onChange={(event) => setDraft(withOptional(draft, 'paidFrom', event.target.value || undefined))} /></label>
          <label className="filter-field">Fecha hasta<input aria-label="Fecha hasta" type="date" value={draft.paidTo ?? ''} onChange={(event) => setDraft(withOptional(draft, 'paidTo', event.target.value || undefined))} /></label>
          <label className="filter-field">Año<input aria-label="Año" type="number" min="2000" max="2100" value={draft.year ?? ''} onChange={(event) => setDraft(withOptional(draft, 'year', event.target.value ? Number(event.target.value) : undefined))} /></label>
          <label className="filter-field">Mes<select aria-label="Mes" value={draft.month ?? ''} onChange={(event) => setDraft(withOptional(draft, 'month', event.target.value ? Number(event.target.value) : undefined))}><option value="">Todos</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date(2026, index, 1))}</option>)}</select></label>
          <div className="financial-filter-actions"><button className="button button--primary" type="submit">Aplicar filtros</button></div>
        </form>
      </details>
      <section className="commission-panel">
        <CommissionLoadState status={status} error={error} empty={items.length === 0} onRetry={() => setRefreshKey((key) => key + 1)}>
          <div className="commission-desktop-table">
            <table className="financial-table commission-table commission-history-table">
              <thead><tr><th>Fecha pago</th><th>Vendedor</th><th>Sucursal</th><th>Cantidad</th><th>Escala snapshot</th><th>Sugerida</th><th>Acordada / pagada</th><th>Período</th><th>Cuenta / comprobante</th><th>Detalle</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}><td>{formatCommissionDate(item.paidAt)}</td><td><strong>{item.seller.name}</strong></td><td>{item.branch.name}</td><td>{item.computableSales}</td><td>{tierLabel(item.scaleSnapshot)}</td><td>{formatCommissionMoney(item.suggestedAmount)}</td><td><strong>{formatCommissionMoney(item.paidAmount)}</strong></td><td>{formatPeriod(item.period)}</td><td><strong>{item.account.name}</strong><small>{item.reference || 'Sin referencia'}</small></td><td><button className="button button--secondary button--compact" type="button" onClick={() => setAudit(item)}><ReceiptText size={16} /> Auditoría</button></td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="commission-card-list">{items.map((item) => (
            <article className="commission-card" key={item.id}><header><div><strong>{item.seller.name}</strong><small>{formatCommissionDate(item.paidAt)} · {item.branch.name}</small></div><CommissionStatusBadge status="PAID" /></header><dl><div><dt>Período</dt><dd>{formatPeriod(item.period)}</dd></div><div><dt>Escala</dt><dd>{tierLabel(item.scaleSnapshot)}</dd></div><div><dt>Pagada</dt><dd><strong>{formatCommissionMoney(item.paidAmount)}</strong></dd></div><div><dt>Cuenta</dt><dd>{item.account.name}</dd></div></dl><button className="button button--secondary" type="button" onClick={() => setAudit(item)}>Ver auditoría</button></article>
          ))}</div>
        </CommissionLoadState>
      </section>
      {audit && (
        <div className="modal-backdrop" role="presentation">
          <div className="settlement-modal" role="dialog" aria-modal="true" aria-labelledby="audit-title">
            <header className="client-modal__header"><div><p className="eyebrow">{audit.seller.name}</p><h2 id="audit-title">Detalle y auditoría</h2></div><button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setAudit(null)}><X size={20} /></button></header>
            <div className="commission-payment-summary"><div><span>Pago</span><strong>{formatCommissionMoney(audit.paidAmount)}</strong></div><div><span>Cuenta</span><strong>{audit.account.code} · {audit.account.name}</strong></div><div><span>Referencia</span><strong>{audit.reference || 'Sin referencia'}</strong></div></div>
            {audit.auditTrail?.length ? <ol className="commission-audit-list">{audit.auditTrail.map((event, index) => <li key={`${event.at}-${event.actorId}-${index}`}><strong>{event.action}</strong><span>{formatCommissionDate(event.at)} · Usuario {event.actorId}</span></li>)}</ol> : <p className="commission-empty-note">La API no informó eventos adicionales de auditoría.</p>}
          </div>
        </div>
      )}
    </>
  )
}
