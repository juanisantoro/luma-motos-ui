import { Eye, Presentation, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import {
  CommissionLoadState,
  CommissionOperations,
  CommissionProgress,
  CommissionStatusBadge,
  VehicleTypeNav,
} from './components'
import {
  commissionErrorMessage,
  formatCommissionMoney,
  formatPeriod,
  tierLabel,
  withOptional,
} from './format'
import type {
  CommissionDetail,
  CommissionGateway,
  CommissionListQuery,
  CommissionOptions,
  CommissionScalePolicy,
  CommissionSummary,
  CommissionVehicleType,
} from './types'

function currentPeriod() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const emptyOptions: CommissionOptions = {
  sellers: [],
  branches: [],
}

export function SuggestedCommissionsPage({
  vehicleType,
  gateway,
}: {
  vehicleType: CommissionVehicleType
  gateway: CommissionGateway
}) {
  const [query, setQuery] = useState<CommissionListQuery>({
    vehicleType,
    period: currentPeriod(),
    page: 1,
    limit: 50,
  })
  const [draft, setDraft] = useState(query)
  const [items, setItems] = useState<CommissionSummary[]>([])
  const [policies, setPolicies] = useState<CommissionScalePolicy[]>([])
  const [options, setOptions] = useState(emptyOptions)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CommissionDetail | null>(null)
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    setQuery((current) => ({ ...current, vehicleType, page: 1 }))
    setDraft((current) => ({ ...current, vehicleType, page: 1 }))
    setItems([])
    setPolicies([])
    setSelectedId(null)
    setDetail(null)
  }, [vehicleType])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    void Promise.all([
      gateway.listSuggestions(query, controller.signal),
      gateway.listPolicies(vehicleType, controller.signal),
      gateway.listOptions(controller.signal),
    ])
      .then(([result, policyResult, optionResult]) => {
        setItems(result.items)
        setPolicies(policyResult.items)
        setOptions(optionResult)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(commissionErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [gateway, query, refreshKey, vehicleType])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    setDetailStatus('loading')
    void gateway.getSuggestion(selectedId, controller.signal)
      .then((result) => {
        setDetail(result)
        setDetailStatus('idle')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(commissionErrorMessage(loadError))
        setDetailStatus('error')
      })
    return () => controller.abort()
  }, [gateway, selectedId])

  const policy = useMemo(() => {
    const periodDate = `${query.period ?? currentPeriod()}-01`
    return policies.find(
      (candidate) =>
        candidate.status === 'ACTIVE'
        && candidate.vehicleType === vehicleType
        && candidate.validFrom <= periodDate
        && (!candidate.validTo || candidate.validTo >= periodDate),
    ) ?? null
  }, [policies, query.period, vehicleType])

  const configurationMissing =
    status === 'success'
    && !policy
    && (items.length === 0 || items.every((item) => item.configurationStatus === 'NOT_CONFIGURED'))

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    setQuery({ ...draft, vehicleType, page: 1, limit: 50 })
    setSelectedId(null)
    setDetail(null)
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">COMISIONES · CÁLCULO PRODUCTIVO</p>
          <h1>Sugerido de comisiones</h1>
          <p>El backend calcula un único monto fijo total según la escala alcanzada.</p>
        </div>
      </header>
      <VehicleTypeNav active={vehicleType} path="/comisiones/sugerido" />

      {configurationMissing ? (
        <div className="commission-policy-missing" role="status">
          <SlidersHorizontal size={22} />
          <div>
            <strong>Escalas no configuradas</strong>
            <span>No hay montos vigentes para {vehicleType === 'AUTO' ? 'autos' : 'motos'} en este período.</span>
          </div>
        </div>
      ) : status === 'success' && policy ? (
        <section className="commission-tier-strip" aria-label="Escalas vigentes">
          {policy.tiers.map((tier) => (
            <article key={tier.id}>
              <small>{tierLabel(tier)} ventas</small>
              <strong>{formatCommissionMoney(tier.fixedAmount)}</strong>
              <span>total del período</span>
            </article>
          ))}
        </section>
      ) : null}

      <details className="financial-filters commission-filters" open>
        <summary><SlidersHorizontal size={17} /> Filtros</summary>
        <form onSubmit={applyFilters}>
          <label className="filter-field">
            Período
            <input
              aria-label="Período"
              type="month"
              required
              value={draft.period}
              onChange={(event) => setDraft({ ...draft, period: event.target.value })}
            />
          </label>
          <label className="filter-field">
            Sucursal
            <select
              aria-label="Sucursal"
              value={draft.branchId ?? ''}
              onChange={(event) => setDraft(withOptional(draft, 'branchId', event.target.value || undefined))}
            >
              <option value="">Todas</option>
              {options.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="filter-field">
            Vendedor
            <select
              aria-label="Vendedor"
              value={draft.sellerId ?? ''}
              onChange={(event) => setDraft(withOptional(draft, 'sellerId', event.target.value || undefined))}
            >
              <option value="">Todos</option>
              {options.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
            </select>
          </label>
          <label className="filter-field">
            Cantidad mínima
            <input
              aria-label="Cantidad mínima"
              type="number"
              min="0"
              value={draft.minSales ?? ''}
              onChange={(event) => setDraft(withOptional(draft, 'minSales', event.target.value ? Number(event.target.value) : undefined))}
            />
          </label>
          <label className="filter-field">
            Cantidad máxima
            <input
              aria-label="Cantidad máxima"
              type="number"
              min="0"
              value={draft.maxSales ?? ''}
              onChange={(event) => setDraft(withOptional(draft, 'maxSales', event.target.value ? Number(event.target.value) : undefined))}
            />
          </label>
          <div className="financial-filter-actions">
            <button className="button button--primary" type="submit">Aplicar filtros</button>
          </div>
        </form>
      </details>

      <section className="commission-panel" aria-label={`Sugeridos de ${vehicleType.toLowerCase()}`}>
        <CommissionLoadState
          status={status}
          error={error}
          empty={items.length === 0}
          onRetry={() => setRefreshKey((key) => key + 1)}
        >
          <div className="commission-desktop-table">
            <table className="financial-table commission-table">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Sucursal</th>
                  <th>Ventas computables</th>
                  <th>Escala</th>
                  <th>Comisión sugerida fija total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.seller.name}</strong><small>{formatPeriod(item.period)}</small></td>
                    <td>{item.branch.name}</td>
                    <td>{item.computableSales}</td>
                    <td>{tierLabel(item.scale)}</td>
                    <td><strong>{formatCommissionMoney(item.suggestedAmount)}</strong></td>
                    <td><CommissionStatusBadge status={item.status} /></td>
                    <td>
                      <div className="financial-actions">
                        <button className="button button--secondary button--compact" type="button" onClick={() => setSelectedId(item.id)}>
                          <Eye size={16} /> Detalle
                        </button>
                        <Link className="button button--secondary button--compact" to={`/comisiones/reunion/${vehicleType.toLowerCase()}s?suggestion=${encodeURIComponent(item.id)}`}>
                          <Presentation size={16} /> Presentar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="commission-card-list">
            {items.map((item) => (
              <article className="commission-card" key={item.id}>
                <header>
                  <div><strong>{item.seller.name}</strong><small>{item.branch.name} · {formatPeriod(item.period)}</small></div>
                  <CommissionStatusBadge status={item.status} />
                </header>
                <dl>
                  <div><dt>Ventas</dt><dd>{item.computableSales}</dd></div>
                  <div><dt>Escala</dt><dd>{tierLabel(item.scale)}</dd></div>
                  <div><dt>Fijo total</dt><dd><strong>{formatCommissionMoney(item.suggestedAmount)}</strong></dd></div>
                </dl>
                <div className="financial-actions">
                  <button className="button button--secondary" type="button" onClick={() => setSelectedId(item.id)}>Ver detalle</button>
                  <Link className="button button--secondary" to={`/comisiones/reunion/${vehicleType.toLowerCase()}s?suggestion=${encodeURIComponent(item.id)}`}>Presentar</Link>
                </div>
              </article>
            ))}
          </div>
        </CommissionLoadState>
      </section>

      {selectedId && (
        <section className="commission-detail-panel" aria-label="Detalle del vendedor">
          <header>
            <div>
              <p className="eyebrow">DETALLE DEL PERÍODO</p>
              <h2>{detail?.seller.name ?? 'Cargando vendedor…'}</h2>
            </div>
            <button className="button button--secondary" type="button" onClick={() => { setSelectedId(null); setDetail(null) }}>Cerrar detalle</button>
          </header>
          {detailStatus === 'loading' && <div className="commission-loading"><RefreshCw className="spin" size={22} /> Cargando operaciones…</div>}
          {detailStatus === 'error' && <StatePanel icon={RefreshCw} title="No pudimos cargar el detalle" description={error} tone="danger" />}
          {detail && detailStatus === 'idle' && (
            <>
              <CommissionProgress commission={detail} />
              <p className="commission-low-note">Las operaciones bajo precio de lista están resaltadas. Sólo cuentan después de su aprobación o cierre.</p>
              <CommissionOperations operations={detail.operations} />
            </>
          )}
        </section>
      )}
    </>
  )
}
