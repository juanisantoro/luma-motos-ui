import { ChevronLeft, ChevronRight, FileCheck2, Filter, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { formatMoney } from '../finance/format'
import {
  listVehiclePaymentConcepts,
  listVehiclePaymentProviders,
  listVehiclePayments,
  updateVehiclePayment,
} from './api'
import { VehiclePaymentForm } from './VehiclePaymentForm'
import type {
  CatalogOption,
  PageResponse,
  VehiclePayment,
  VehiclePaymentQuery,
  VehiclePaymentStatus,
  VehiclePaymentVehicleType,
} from './types'

const PAGE_SIZE = 20

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function statusTone(status: VehiclePaymentStatus) {
  return status === 'PAGADO' ? ' status-badge--success' : ' status-badge--warning'
}

function statusLabel(status: VehiclePaymentStatus) {
  return status === 'PAGADO' ? 'Pagado' : 'Pendiente'
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return 'No tenés permiso para ver estos registros.'
  }
  return 'No pudimos cargar los pagos. Intentá nuevamente.'
}

export function VehiclePaymentsPage({
  vehicleType,
}: {
  vehicleType: VehiclePaymentVehicleType
}) {
  const { user } = useAuth()
  const permissions = user?.role.permissions ?? []
  const canManage = hasPermission(permissions, 'pagos_vehiculo.gestionar')

  const [query, setQuery] = useState<VehiclePaymentQuery>({ page: 1, limit: PAGE_SIZE })
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [result, setResult] = useState<PageResponse<VehiclePayment> | null>(null)
  const [loadError, setLoadError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')

  const [concepts, setConcepts] = useState<CatalogOption[]>([])
  const [providers, setProviders] = useState<CatalogOption[]>([])
  const [draft, setDraft] = useState<VehiclePaymentQuery>({ page: 1, limit: PAGE_SIZE })

  const changeDraft = <K extends keyof VehiclePaymentQuery>(
    key: K,
    next: VehiclePaymentQuery[K],
  ) => setDraft((current) => ({ ...current, [key]: next || undefined }))

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      listVehiclePaymentConcepts(controller.signal),
      listVehiclePaymentProviders(controller.signal),
    ])
      .then(([conceptRows, providerRows]) => {
        setConcepts(conceptRows)
        setProviders(providerRows)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setForbidden(false)
    setLoadError('')
    listVehiclePayments(vehicleType, query, controller.signal)
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setForbidden(error instanceof ApiError && error.status === 403)
        setLoadError(errorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [query, vehicleType, refreshKey])

  const reload = (message?: string) => {
    if (message) setNotice(message)
    setRefreshKey((current) => current + 1)
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1

  const applyFilters = () => setQuery({ ...draft, page: 1, limit: PAGE_SIZE })
  const clearFilters = () => {
    const cleared = { page: 1, limit: PAGE_SIZE }
    setDraft(cleared)
    setQuery(cleared)
  }

  const togglePaid = async (payment: VehiclePayment) => {
    const nextStatus: VehiclePaymentStatus = payment.status === 'PAGADO' ? 'PENDIENTE' : 'PAGADO'
    try {
      await updateVehiclePayment(payment.id, { status: nextStatus })
      reload(nextStatus === 'PAGADO' ? 'Pago marcado como pagado.' : 'Pago marcado como pendiente.')
    } catch {
      setNotice('No pudimos actualizar el estado. Intentá nuevamente.')
    }
  }

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    [],
  )
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, index) => current - 4 + index)
  }, [])

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">DOCUMENTACIÓN</p>
          <h1>Patentes, seguros y formularios de {vehicleType === 'MOTO' ? 'motos' : 'autos'}</h1>
          <p>Seguimiento de pagos de documentación asociada a cada vehículo.</p>
        </div>
        {canManage && (
          <button className="button button--primary" type="button" onClick={() => setShowForm(true)}>
            <Plus size={18} />
            Cargar pago nuevo
          </button>
        )}
      </header>

      <details className="financial-filters" open>
        <summary>
          <Filter size={17} aria-hidden="true" />
          Filtros
        </summary>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            applyFilters()
          }}
        >
          <div className="filter-field">
            <label htmlFor="vp-search">Buscar</label>
            <input
              id="vp-search"
              onChange={(event) => changeDraft('search', event.target.value)}
              placeholder="VIN, patente, marca, modelo, operación…"
              value={draft.search ?? ''}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="vp-concept">Concepto</label>
            <select
              id="vp-concept"
              onChange={(event) => changeDraft('conceptId', event.target.value)}
              value={draft.conceptId ?? ''}
            >
              <option value="">Todos</option>
              {concepts.map((concept) => (
                <option key={concept.id} value={concept.id}>{concept.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="vp-provider">Proveedor</label>
            <select
              id="vp-provider"
              onChange={(event) => changeDraft('providerId', event.target.value)}
              value={draft.providerId ?? ''}
            >
              <option value="">Todos</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="vp-status">Estado</label>
            <select
              id="vp-status"
              onChange={(event) => changeDraft('status', event.target.value as VehiclePaymentStatus)}
              value={draft.status ?? ''}
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PAGADO">Pagado</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="vp-month">Mes</label>
            <select
              id="vp-month"
              onChange={(event) => changeDraft('month', event.target.value ? Number(event.target.value) : 0)}
              value={draft.month ?? ''}
            >
              <option value="">Todos</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="vp-year">Año</label>
            <select
              id="vp-year"
              onChange={(event) => changeDraft('year', event.target.value ? Number(event.target.value) : 0)}
              value={draft.year ?? ''}
            >
              <option value="">Todos</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="financial-filter-actions">
            <button className="button button--primary" type="submit">Aplicar</button>
            <button className="button button--secondary" type="button" onClick={clearFilters}>Limpiar</button>
          </div>
        </form>
      </details>

      {notice && (
        <div className="form-alert financial-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>Cerrar</button>
        </div>
      )}

      <section className="financial-panel" aria-label="Listado de pagos">
        {status === 'loading' && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando pagos…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            icon={RefreshCw}
            title={forbidden ? 'No tenés acceso a estos registros' : 'No pudimos cargar los pagos'}
            description={loadError}
            tone="danger"
            action={!forbidden ? (
              <button className="button button--primary" type="button" onClick={() => reload()}>
                <RefreshCw size={17} />
                Reintentar
              </button>
            ) : undefined}
          />
        )}
        {status === 'success' && result?.items.length === 0 && (
          <StatePanel
            icon={FileCheck2}
            title="No hay resultados"
            description="No encontramos pagos para los filtros seleccionados."
          />
        )}
        {status === 'success' && result && result.items.length > 0 && (
          <div className="financial-table-wrap">
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Vehículo</th>
                  <th>Operación</th>
                  <th>Proveedor</th>
                  <th>Importe</th>
                  <th>Estado</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {result.items.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.date)}</td>
                    <td>{payment.concept.name}</td>
                    <td>
                      <strong>{payment.unit.vin}</strong>
                      <small>{[payment.vehicle.brand, payment.vehicle.model, payment.vehicle.version].filter(Boolean).join(' ')}</small>
                    </td>
                    <td>{payment.operation ? `#${payment.operation.number}` : '—'}</td>
                    <td>{payment.provider.name}</td>
                    <td>{formatMoney(payment.amount.toString())}</td>
                    <td>
                      <span className={`status-badge${statusTone(payment.status)}`}>
                        {statusLabel(payment.status)}
                      </span>
                    </td>
                    {canManage && (
                      <td className="financial-actions">
                        <button
                          className="button button--secondary"
                          onClick={() => togglePaid(payment)}
                          type="button"
                        >
                          {payment.status === 'PAGADO' ? 'Marcar pendiente' : 'Marcar pagado'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>{result.total} {result.total === 1 ? 'pago' : 'pagos'}</span>
            <div>
              <button
                className="icon-button"
                type="button"
                aria-label="Página anterior"
                disabled={(query.page ?? 1) <= 1}
                onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))}
              >
                <ChevronLeft size={19} />
              </button>
              <strong>Página {result.page} de {totalPages}</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="Página siguiente"
                disabled={(query.page ?? 1) >= totalPages}
                onClick={() => setQuery((current) => ({ ...current, page: Math.min(totalPages, (current.page ?? 1) + 1) }))}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </footer>
        )}
      </section>

      {showForm && (
        <VehiclePaymentForm
          vehicleType={vehicleType}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            reload('Pago guardado correctamente.')
          }}
        />
      )}
    </>
  )
}
