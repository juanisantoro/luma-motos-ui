import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import {
  allowedBranchIds,
  branchScopeKey,
  filterAllowedBranches,
} from '../auth/branchScope'
import { listInventoryBranches } from '../finance/api'
import type { BranchOption } from '../finance/types'
import { listServiceOrders } from './api'
import {
  formatDay,
  formatKm,
  orderNumber,
  statusLabels,
  statusTones,
} from './format'
import { ServiceReceptionModal } from './ServiceReceptionModal'
import type { PageResponse, ServiceOrder, ServiceOrderQuery } from './types'

const PAGE_SIZE = 20

// Pestañas de la lista: lo que espera al mecánico, lo que espera a la
// administrativa y el historial.
const TABS = [
  { id: 'taller', label: 'En el taller', status: 'RECIBIDA,EN_TALLER' },
  { id: 'entregar', label: 'Para entregar', status: 'TERMINADA' },
  { id: 'entregadas', label: 'Entregadas', status: 'ENTREGADA' },
  { id: 'canceladas', label: 'Canceladas', status: 'CANCELADA' },
  { id: 'todas', label: 'Todas', status: '' },
] as const

type TabId = (typeof TABS)[number]['id']

export function ServiceOrdersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const permissions = user?.role.permissions
  const canReceive = hasPermission(permissions, 'service.gestionar')
  const canWork = hasPermission(permissions, 'service.trabajar')
  const scopeKey = branchScopeKey(user)
  const [searchParams] = useSearchParams()
  // `?tab=entregar` abre directo en esa pestaña (desde el Inicio).
  const [tab, setTab] = useState<TabId>(() => {
    const requested = searchParams.get('tab')
    return TABS.some((item) => item.id === requested) ? (requested as TabId) : 'taller'
  })
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PageResponse<ServiceOrder> | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [receiving, setReceiving] = useState(false)
  const [applied, setApplied] = useState<ServiceOrderQuery>({})

  // El filtro de sucursal sólo tiene sentido con más de una.
  useEffect(() => {
    const allowed = allowedBranchIds(scopeKey)
    if (allowed && allowed.length < 2) return
    const controller = new AbortController()
    listInventoryBranches(controller.signal)
      .then((items) => setBranches(filterAllowedBranches(scopeKey, items)))
      .catch(() => undefined)
    return () => controller.abort()
  }, [scopeKey])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    const statusFilter = TABS.find((item) => item.id === tab)?.status
    listServiceOrders(
      {
        ...applied,
        ...(statusFilter ? { status: statusFilter } : {}),
        page,
        limit: PAGE_SIZE,
      },
      controller.signal,
    )
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(
          error instanceof ApiError && error.status === 403
            ? 'No tenés permiso para ver las órdenes de service.'
            : 'No pudimos cargar las órdenes. Intentá nuevamente.',
        )
        setStatus('error')
      })
    return () => controller.abort()
  }, [applied, page, tab, refreshKey])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">TALLER</p>
          <h1>Service</h1>
          <p>
            {canWork && !canReceive
              ? 'Las motos que esperan service en tu sucursal. Abrí una para cargar lo que le hiciste y firmarla.'
              : 'Motos que entran a service: se reciben acá, el mecánico las trabaja y firma, y se cobran y entregan desde la orden.'}
          </p>
        </div>
        {canReceive && (
          <div className="page-heading__actions">
            <button className="button button--primary" onClick={() => setReceiving(true)} type="button">
              <Plus size={18} />
              Recibir moto
            </button>
          </div>
        )}
      </header>

      <div className="service-tabs" role="tablist" aria-label="Estado de las órdenes">
        {TABS.map((item) => (
          <button
            aria-selected={tab === item.id}
            className={`service-tab${tab === item.id ? ' service-tab--active' : ''}`}
            key={item.id}
            onClick={() => {
              setTab(item.id)
              setPage(1)
            }}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        className="service-search"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setApplied({
            ...(search.trim() ? { search: search.trim() } : {}),
            ...(branchId ? { branchId } : {}),
          })
        }}
      >
        <label className="search-field">
          <span className="sr-only">Buscar</span>
          <Search size={18} aria-hidden="true" />
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="N.º de orden, cliente, dominio, chasis o modelo"
            type="search"
            value={search}
          />
        </label>
        {branches.length > 1 && (
          <label className="filter-field">
            <span>Sucursal</span>
            <select onChange={(event) => setBranchId(event.target.value)} value={branchId}>
              <option value="">Todas</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>
        )}
        <button className="button button--secondary" type="submit">Buscar</button>
      </form>

      <section className="financial-panel" aria-label="Órdenes de service">
        {status === 'loading' && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando órdenes…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            icon={RefreshCw}
            title="No pudimos cargar las órdenes"
            description={loadError}
            tone="danger"
            action={
              <button className="button button--primary" onClick={() => setRefreshKey((key) => key + 1)} type="button">
                <RefreshCw size={17} />
                Reintentar
              </button>
            }
          />
        )}
        {status === 'success' && result?.items.length === 0 && (
          <StatePanel
            icon={Wrench}
            title={tab === 'taller' ? 'No hay motos esperando service' : 'No hay órdenes'}
            description={
              tab === 'taller'
                ? 'Cuando la administración reciba una moto, va a aparecer acá.'
                : 'No encontramos órdenes con esos filtros.'
            }
          />
        )}
        {status === 'success' && result && result.items.length > 0 && (
          <div className="financial-table-wrap">
            <table className="financial-table service-table">
              <thead>
                <tr>
                  <th>N.º</th>
                  <th>Recibida</th>
                  <th>Cliente</th>
                  <th>Moto</th>
                  <th>Km</th>
                  <th>Service</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.items.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{orderNumber(order.number)}</strong></td>
                    <td>
                      {formatDay(order.receptionDate)}
                      {branches.length > 1 && <small>{order.branch.name}</small>}
                    </td>
                    <td>
                      {order.client.name}
                      {order.client.phone && <small>{order.client.phone}</small>}
                    </td>
                    <td>
                      <strong>{order.vehicle.plate ?? order.vehicle.chassis ?? '—'}</strong>
                      {order.vehicle.model && <small>{order.vehicle.model}</small>}
                    </td>
                    <td>{formatKm(order.currentKm)}</td>
                    <td>{order.serviceType.name}</td>
                    <td>
                      <span className={`status-badge ${statusTones[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td className="financial-actions">
                      <Link
                        aria-label={`Abrir la orden ${orderNumber(order.number)}`}
                        className="button button--secondary"
                        to={`/service/${order.id}`}
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>{result.total} {result.total === 1 ? 'orden' : 'órdenes'}</span>
            <div>
              <button
                aria-label="Página anterior"
                className="icon-button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                <ChevronLeft size={19} />
              </button>
              <strong>Página {result.page} de {totalPages}</strong>
              <button
                aria-label="Página siguiente"
                className="icon-button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                type="button"
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </footer>
        )}
      </section>

      {receiving && (
        <ServiceReceptionModal
          onClose={() => setReceiving(false)}
          onSaved={(order) => {
            setReceiving(false)
            navigate(`/service/${order.id}`)
          }}
        />
      )}
    </>
  )
}
