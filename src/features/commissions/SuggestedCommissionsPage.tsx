import { CheckCircle2, Eye, Presentation, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { alertError, alertSuccess } from '../../shared/alerts'
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
  managerModeLabels,
  managerScopeLabels,
  managerSettlementStatusLabels,
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
  ManagerCommissionSuggestion,
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
  const [policyStatus, setPolicyStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [policyError, setPolicyError] = useState('')
  const [policyRefreshKey, setPolicyRefreshKey] = useState(0)
  const [optionsStatus, setOptionsStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [optionsError, setOptionsError] = useState('')
  const [optionsRefreshKey, setOptionsRefreshKey] = useState(0)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CommissionDetail | null>(null)
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [detailError, setDetailError] = useState('')
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  // Manager (GERENTE) commission suggestions - separate section below the
  // vendor table, own state/effect, only rendered when the gateway exposes
  // the manager methods (kept optional for backward test compatibility).
  const [managerItems, setManagerItems] = useState<ManagerCommissionSuggestion[]>([])
  const [managerStatus, setManagerStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [managerError, setManagerError] = useState('')
  const [managerRefreshKey, setManagerRefreshKey] = useState(0)
  const [managerAgreeingId, setManagerAgreeingId] = useState<string | null>(null)

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
    setItems([])
    setPolicies([])
    setSelectedId(null)
    setDetail(null)
  }, [vehicleType])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    void gateway
      .listSuggestions(query, controller.signal)
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
  }, [gateway, query, refreshKey, vehicleType])

  useEffect(() => {
    const controller = new AbortController()
    setPolicyStatus('loading')
    setPolicyError('')
    void gateway
      // This page only ever deals with vendor suggestions/settlements, so
      // the vendor scale catalog (ambito VENDEDOR) is the only one it can
      // ask for here - a GERENCIA policy must never surface in this list.
      .listPolicies(vehicleType, 'VENDEDOR', controller.signal)
      .then((result) => {
        setPolicies(result.items)
        setPolicyStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setPolicies([])
        setPolicyError(commissionErrorMessage(loadError))
        setPolicyStatus('error')
      })
    return () => controller.abort()
  }, [gateway, policyRefreshKey, vehicleType])

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

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    setDetail(null)
    setDetailStatus('loading')
    setDetailError('')
    void gateway.getSuggestion(selectedId, controller.signal)
      .then((result) => {
        setDetail(result)
        setDetailStatus('idle')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setDetailError(commissionErrorMessage(loadError))
        setDetailStatus('error')
      })
    return () => controller.abort()
  }, [detailRefreshKey, gateway, selectedId])

  useEffect(() => {
    if (!gateway.listManagerSuggestions) {
      setManagerItems([])
      setManagerStatus('success')
      return
    }
    const controller = new AbortController()
    setManagerStatus('loading')
    setManagerError('')
    void gateway
      .listManagerSuggestions({ period: query.period ?? currentPeriod(), vehicleType, page: 1, limit: 100 }, controller.signal)
      .then((result) => {
        setManagerItems(result.items)
        setManagerStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setManagerError(commissionErrorMessage(loadError))
        setManagerStatus('error')
      })
    return () => controller.abort()
  }, [gateway, managerRefreshKey, query.period, vehicleType])

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
    && policyStatus === 'success'
    && !policy
    && (items.length === 0 || items.every((item) => item.configurationStatus === 'NOT_CONFIGURED'))

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    setQuery({ ...draft, vehicleType, page: 1, limit: 50 })
    setSelectedId(null)
    setDetail(null)
  }

  const handleAgreeManager = async (item: ManagerCommissionSuggestion) => {
    if (!gateway.agreeManagerCommission) return
    setManagerAgreeingId(item.id)
    try {
      await gateway.agreeManagerCommission(item.id, {
        ...(item.settlement ? { expectedVersion: item.settlement.version } : {}),
      })
      void alertSuccess(`Se acordó la comisión de ${item.manager.name} por ${formatCommissionMoney(item.suggestedAmount)}.`)
      setManagerRefreshKey((key) => key + 1)
    } catch (agreeError: unknown) {
      void alertError(commissionErrorMessage(agreeError))
    } finally {
      setManagerAgreeingId(null)
    }
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

      {policyStatus === 'error' && (
        <StatePanel
          icon={RefreshCw}
          title="No pudimos cargar las escalas"
          description={policyError}
          tone="danger"
          action={<button className="button button--secondary" type="button" onClick={() => setPolicyRefreshKey((key) => key + 1)}>Reintentar escalas</button>}
        />
      )}
      {optionsStatus === 'error' && (
        <StatePanel
          icon={RefreshCw}
          title="No pudimos cargar vendedores y sucursales"
          description={optionsError}
          tone="danger"
          action={<button className="button button--secondary" type="button" onClick={() => setOptionsRefreshKey((key) => key + 1)}>Reintentar opciones</button>}
        />
      )}

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
              disabled={optionsStatus === 'loading'}
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
              disabled={optionsStatus === 'loading'}
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
          {detailStatus === 'error' && <StatePanel icon={RefreshCw} title="No pudimos cargar el detalle" description={detailError} tone="danger" action={<button className="button button--secondary" type="button" onClick={() => setDetailRefreshKey((key) => key + 1)}>Reintentar detalle</button>} />}
          {detail && detailStatus === 'idle' && (
            <>
              <CommissionProgress commission={detail} />
              <p className="commission-low-note">Las operaciones bajo precio de lista están resaltadas. Sólo cuentan después de su aprobación o cierre.</p>
              <CommissionOperations operations={detail.operations} />
            </>
          )}
        </section>
      )}

      {gateway.listManagerSuggestions && (
        <section className="commission-panel commission-manager-panel" aria-label="Sugeridos de gerentes">
          <header className="commission-manager-panel__header">
            <div>
              <p className="eyebrow">COMISIONES · GERENTES</p>
              <h2>Gerentes</h2>
              <p>Comisión calculada en vivo según la configuración vigente de cada gerente.</p>
            </div>
          </header>
          <CommissionLoadState
            status={managerStatus}
            error={managerError}
            empty={managerItems.length === 0}
            onRetry={() => setManagerRefreshKey((key) => key + 1)}
          >
            <div className="commission-desktop-table">
              <table className="financial-table commission-table">
                <thead>
                  <tr>
                    <th>Gerente</th>
                    <th>Alcance</th>
                    <th>Modalidad</th>
                    <th>Ventas computables</th>
                    <th>Comisión calculada</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {managerItems.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.manager.name}</strong><small>{formatPeriod(item.period)}</small></td>
                      <td>{managerScopeLabels[item.scope]}</td>
                      <td>{managerModeLabels[item.mode]}</td>
                      <td>{item.computableSales}</td>
                      <td><strong>{formatCommissionMoney(item.suggestedAmount)}</strong></td>
                      <td>{item.settlement ? <CommissionStatusBadge status={item.settlement.status === 'PAID' ? 'PAID' : 'AGREED'} /> : <span className="status-badge">Sugerida</span>}</td>
                      <td>
                        <div className="financial-actions">
                          {(!item.settlement || item.settlement.status === 'SUGGESTED') && gateway.agreeManagerCommission && (
                            <button
                              className="button button--primary button--compact"
                              type="button"
                              disabled={managerAgreeingId === item.id}
                              onClick={() => handleAgreeManager(item)}
                            >
                              <CheckCircle2 size={16} /> {managerAgreeingId === item.id ? 'Acordando…' : 'Acordar'}
                            </button>
                          )}
                          {item.settlement && item.settlement.status !== 'SUGGESTED' && (
                            <span className="commission-empty-note">{managerSettlementStatusLabels[item.settlement.status]}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="commission-card-list">
              {managerItems.map((item) => (
                <article className="commission-card" key={item.id}>
                  <header>
                    <div><strong>{item.manager.name}</strong><small>{managerScopeLabels[item.scope]} · {formatPeriod(item.period)}</small></div>
                    {item.settlement ? <CommissionStatusBadge status={item.settlement.status === 'PAID' ? 'PAID' : 'AGREED'} /> : <span className="status-badge">Sugerida</span>}
                  </header>
                  <dl>
                    <div><dt>Modalidad</dt><dd>{managerModeLabels[item.mode]}</dd></div>
                    <div><dt>Ventas</dt><dd>{item.computableSales}</dd></div>
                    <div><dt>Comisión</dt><dd><strong>{formatCommissionMoney(item.suggestedAmount)}</strong></dd></div>
                  </dl>
                  {(!item.settlement || item.settlement.status === 'SUGGESTED') && gateway.agreeManagerCommission && (
                    <button
                      className="button button--primary"
                      type="button"
                      disabled={managerAgreeingId === item.id}
                      onClick={() => handleAgreeManager(item)}
                    >
                      {managerAgreeingId === item.id ? 'Acordando…' : 'Acordar'}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </CommissionLoadState>
        </section>
      )}
    </>
  )
}
