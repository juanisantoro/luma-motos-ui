import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import type { VehicleKind } from '../stock/types'
import { listSalesOperations } from './api'
import { releaseSalesReservation } from './api'
import { salesErrorMessage } from './errors'
import { SalesDecisionModal } from './SalesDecisionModal'
import { SalesOperationList } from './SalesOperationList'
import type {
  SalesOperationPage,
  SalesOperationStatus,
} from './types'

type FilterStatus = SalesOperationStatus | 'TODOS'
const PAGE_SIZE = 20

function periodRange(period: string) {
  if (!period) return {}
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return {}
  return {
    from: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
  }
}

export function OperationsPage({
  mine = false,
  vehicleType,
}: {
  mine?: boolean
  vehicleType: VehicleKind
}) {
  const { user } = useAuth()
  const effectiveMine = mine || user?.role.code === 'VENDEDOR'
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [result, setResult] = useState<SalesOperationPage | null>(null)
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [operationStatus, setOperationStatus] =
    useState<FilterStatus>('TODOS')
  const [period, setPeriod] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [release, setRelease] = useState<
    SalesOperationPage['items'][number] | null
  >(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    const range = periodRange(period)
    void listSalesOperations(
      {
        page,
        limit: PAGE_SIZE,
        vehicleType,
        ...(search ? { search } : {}),
        ...(operationStatus === 'TODOS'
          ? {}
          : { status: operationStatus }),
        ...range,
        ...(effectiveMine ? { mine: true } : {}),
      },
      controller.signal,
    )
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(salesErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [
    effectiveMine,
    operationStatus,
    page,
    period,
    refreshKey,
    search,
    vehicleType,
  ])

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1
  const visibleOperations = result?.items ?? []
  const vehicleNoun = vehicleType === 'MOTO' ? 'motos' : 'autos'
  const canRelease = hasPermission(
    user?.role.permissions,
    'reservas_stock.gestionar',
  )

  const confirmRelease = async (reason: string) => {
    if (!release) return
    setBusyId(release.id)
    setActionError('')
    try {
      await releaseSalesReservation(release.id, {
        expectedVersion: release.rowVersion,
        reason,
      })
      setRelease(null)
      setRefreshKey((value) => value + 1)
    } catch (releaseError) {
      setActionError(salesErrorMessage(releaseError))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">VENTAS</p>
          <h1>
            {effectiveMine ? 'Mis operaciones' : 'Operaciones'} de {vehicleNoun}
          </h1>
          <p>
            {effectiveMine
              ? 'Tus ventas, reservas y estados de aprobación.'
              : 'Historial comercial, reservas y estados de aprobación.'}
          </p>
        </div>
        {hasPermission(user?.role.permissions, 'ventas.gestionar') && (
          <Link
            className="button button--primary"
            to={`/${vehicleNoun}/operaciones/nueva`}
          >
            <Plus size={18} />
            Nueva operación
          </Link>
        )}
      </header>

      <section className="sales-panel" aria-label="Historial de operaciones">
        <form className="sales-filters" onSubmit={submitFilters}>
          <label className="search-field">
            <span className="sr-only">Buscar operaciones</span>
            <Search size={18} />
            <input
              maxLength={80}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Operación, cliente, VIN o patente"
              type="search"
              value={searchDraft}
            />
          </label>
          <label className="filter-field">
            <span className="sr-only">Estado de operación</span>
            <select
              value={operationStatus}
              onChange={(event) => {
                setPage(1)
                setOperationStatus(event.target.value as FilterStatus)
              }}
            >
              <option value="TODOS">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="PENDIENTE_APROBACION">Pendiente</option>
              <option value="APROBADA">Aprobada</option>
              <option value="RECHAZADA">Rechazada</option>
              <option value="CANCELADA">Cancelada</option>
              <option value="CERRADA">Cerrada</option>
            </select>
          </label>
          <label className="sales-date-field">
            <span>Período</span>
            <input
              type="month"
              value={period}
              onChange={(event) => {
                setPage(1)
                setPeriod(event.target.value)
              }}
            />
          </label>
          <button className="button button--secondary" type="submit">
            Buscar
          </button>
        </form>

        <div className="sales-content" aria-live="polite">
          {status === 'loading' && (
            <div className="client-loading">
              <div className="loading-mark" />
              <span>Cargando operaciones…</span>
            </div>
          )}
          {status === 'error' && (
            <StatePanel
              icon={RefreshCw}
              title="No pudimos cargar las operaciones"
              description={error}
              tone="danger"
              action={
                <button
                  className="button button--primary"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  type="button"
                >
                  <RefreshCw size={17} />
                  Reintentar
                </button>
              }
            />
          )}
          {status === 'success' && visibleOperations.length === 0 && (
            <StatePanel
              icon={ShoppingCart}
              title="No hay operaciones"
              description={
                search ||
                operationStatus !== 'TODOS' ||
                period
                  ? 'Probá con otros términos o modificá los filtros.'
                  : `Creá la primera operación de ${vehicleNoun === 'motos' ? 'moto' : 'auto'} para iniciar este circuito comercial.`
              }
            />
          )}
          {status === 'success' && visibleOperations.length > 0 && (
            <SalesOperationList
              operations={visibleOperations}
              canRelease={canRelease}
              busyId={busyId}
              onRelease={(operation) => {
                setActionError('')
                setRelease(operation)
              }}
            />
          )}
        </div>

        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>
              {result.total}{' '}
              {result.total === 1 ? 'operación' : 'operaciones'}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                <ChevronLeft size={19} />
              </button>
              <strong>
                Página {result.page} de {totalPages}
              </strong>
              <button
                className="icon-button"
                aria-label="Página siguiente"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
                type="button"
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </footer>
        )}
      </section>
      {release && (
        <SalesDecisionModal
          kind="release"
          operationNumber={release.number}
          submitting={busyId === release.id}
          error={actionError}
          onClose={() => {
            setActionError('')
            setRelease(null)
          }}
          onConfirm={confirmRelease}
        />
      )}
    </>
  )
}
