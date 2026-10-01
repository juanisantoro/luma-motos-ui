import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import type { VehicleKind } from '../stock/types'
import { listSalesOperations } from './api'
import { releaseSalesReservation } from './api'
import { salesErrorMessage } from './errors'
import { alertError, alertSuccess } from '../../shared/alerts'
import { LicensingModal } from './LicensingModal'
import { OperationTrackingPanel } from './OperationTrackingPanel'
import { SalesDecisionModal } from './SalesDecisionModal'
import { SalesOperationList } from './SalesOperationList'
import {
  availableUnitActions,
  unitActionPermissions,
  UnitFulfillmentDialogs,
  type ActiveUnitAction,
} from './UnitFulfillmentDialogs'
import type {
  SalesFulfillmentStatus,
  SalesOperation,
  SalesOperationPage,
  SalesOperationQuery,
  SalesOperationStatus,
} from './types'

type FilterStatus = SalesOperationStatus | 'TODOS'
type LicensingFilter =
  | 'TODAS'
  | 'BONIFICADA'
  | 'PAGA_CLIENTE'
  | 'SIN_DEFINIR'
  | 'DEMORADAS'
  | 'COBRO_PENDIENTE'

const LICENSING_FILTERS: readonly LicensingFilter[] = [
  'BONIFICADA',
  'PAGA_CLIENTE',
  'SIN_DEFINIR',
  'DEMORADAS',
  'COBRO_PENDIENTE',
]
// Fase 5: el filtro de patentamiento vive en la URL (?patente=...) para que
// los contadores del inicio de la administrativa abran esta grilla filtrada.
export const LICENSING_FILTER_PARAM = 'patente'

function parseLicensingFilter(value: string | null): LicensingFilter {
  return LICENSING_FILTERS.includes(value as LicensingFilter)
    ? (value as LicensingFilter)
    : 'TODAS'
}

function licensingQuery(
  filter: LicensingFilter,
): Pick<
  SalesOperationQuery,
  'licensingMode' | 'licensingOverdue' | 'licensingCollectionPending'
> {
  if (filter === 'TODAS') return {}
  if (filter === 'DEMORADAS') return { licensingOverdue: true }
  if (filter === 'COBRO_PENDIENTE') return { licensingCollectionPending: true }
  return { licensingMode: filter }
}
const PAGE_SIZE = 20

// Filtro de unidad (fase 3, sólo motos). Vive en la URL (?unidad=...) para
// que el atajo "A asignar" del menú abra esta misma grilla ya filtrada.
type UnitFilter = Exclude<SalesFulfillmentStatus, 'ASIGNADA'> | 'SIN_ASIGNAR'
const UNIT_FILTERS: readonly UnitFilter[] = [
  'SIN_ASIGNAR',
  'PENDIENTE_ASIGNACION',
  'PEDIDA',
  'PENDIENTE_INGRESO',
  'RECIBIDA',
]
export const UNIT_FILTER_PARAM = 'unidad'
// Fase 4: solapa de seguimiento (?vista=seguimiento).
export const VIEW_PARAM = 'vista'
export const TRACKING_VIEW = 'seguimiento'

function parseUnitFilter(value: string | null): UnitFilter | null {
  return UNIT_FILTERS.includes(value as UnitFilter) ? (value as UnitFilter) : null
}

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
  const effectiveMine = mine || user?.role.code === 'VENDEDOR' || user?.role.code === 'CALLCENTER'
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
  const [licensingOperation, setLicensingOperation] =
    useState<SalesOperation | null>(null)
  // Grilla administrativa: la ve quien no está limitado a "mis operaciones".
  const showLicensing = !effectiveMine
  const showUnitFilter = showLicensing && vehicleType === 'MOTO'
  const [searchParams, setSearchParams] = useSearchParams()
  const licensingFilter = showLicensing
    ? parseLicensingFilter(searchParams.get(LICENSING_FILTER_PARAM))
    : 'TODAS'
  const setLicensingFilter = (value: LicensingFilter) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === 'TODAS') next.delete(LICENSING_FILTER_PARAM)
        else next.set(LICENSING_FILTER_PARAM, value)
        return next
      },
      { replace: true },
    )
  const navigate = useNavigate()
  // Fase 5: el pago a la gestoría se carga en pagos de vehículo, con el
  // formulario precargado desde la operación.
  const canPayLicensing = hasPermission(
    user?.role.permissions,
    'pagos_vehiculo.gestionar',
  )
  const registerLicensingPayment = (operation: SalesOperation) =>
    navigate(`/${vehicleType === 'MOTO' ? 'motos' : 'autos'}/pagos-vehiculo?operacion=${operation.id}`)
  const unitFilter = showUnitFilter
    ? parseUnitFilter(searchParams.get(UNIT_FILTER_PARAM))
    : null
  const canTrack =
    showLicensing &&
    hasPermission(user?.role.permissions, 'ingresos.consultar')
  const trackingView =
    canTrack && searchParams.get(VIEW_PARAM) === TRACKING_VIEW
  const changeView = (tracking: boolean) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (tracking) next.set(VIEW_PARAM, TRACKING_VIEW)
        else next.delete(VIEW_PARAM)
        return next
      },
      { replace: true },
    )
  const unitPermissions = unitActionPermissions(user?.role.permissions)
  const [unitAction, setUnitAction] = useState<ActiveUnitAction | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [release, setRelease] = useState<
    SalesOperationPage['items'][number] | null
  >(null)

  useEffect(() => {
    if (trackingView) return
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
        ...(showLicensing ? licensingQuery(licensingFilter) : {}),
        ...(unitFilter ? { fulfillmentStatus: unitFilter } : {}),
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
    licensingFilter,
    operationStatus,
    showLicensing,
    page,
    period,
    refreshKey,
    search,
    trackingView,
    unitFilter,
    vehicleType,
  ])

  // El atajo del menú puede cambiar el filtro estando en otra página.
  useEffect(() => {
    setPage(1)
  }, [unitFilter, licensingFilter])

  const changeUnitFilter = (value: UnitFilter | null) => {
    setPage(1)
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(UNIT_FILTER_PARAM, value)
        else next.delete(UNIT_FILTER_PARAM)
        return next
      },
      { replace: true },
    )
  }

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
      void alertSuccess('La reserva se liberó correctamente.')
    } catch (releaseError) {
      const message = salesErrorMessage(releaseError)
      setActionError(message)
      void alertError(message)
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
        {effectiveMine &&
          hasPermission(user?.role.permissions, 'ventas.gestionar') && (
          <Link
            className="button button--primary"
            to={`/${vehicleNoun}/operaciones/nueva`}
          >
            <Plus size={18} />
            Nueva operación
          </Link>
        )}
      </header>

      {canTrack && (
        <nav className="access-tabs tracking-tabs" aria-label="Vistas de operaciones">
          <button
            aria-current={trackingView ? undefined : 'page'}
            className={`access-tab${trackingView ? '' : ' access-tab--active'}`}
            onClick={() => changeView(false)}
            type="button"
          >
            Operaciones
          </button>
          <button
            aria-current={trackingView ? 'page' : undefined}
            className={`access-tab${trackingView ? ' access-tab--active' : ''}`}
            onClick={() => changeView(true)}
            type="button"
          >
            Seguimiento de cobros
          </button>
        </nav>
      )}

      {trackingView ? (
        <OperationTrackingPanel vehicleType={vehicleType} />
      ) : (
        <section className="sales-panel" aria-label="Historial de operaciones">
          <form className="sales-filters" onSubmit={submitFilters}>
            <label className="search-field">
              <span className="sr-only">Buscar operaciones</span>
              <Search size={18} />
              <input
                maxLength={80}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Operación, cliente, VIN, patente o boleto"
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
            {showLicensing && (
              <label className="filter-field">
                <span className="sr-only">Patentamiento</span>
                <select
                  value={licensingFilter}
                  onChange={(event) => {
                    setPage(1)
                    setLicensingFilter(event.target.value as LicensingFilter)
                  }}
                >
                  <option value="TODAS">Todo patentamiento</option>
                  <option value="BONIFICADA">Patente bonificada</option>
                  <option value="PAGA_CLIENTE">Patente paga el cliente</option>
                  <option value="SIN_DEFINIR">Patentamiento sin definir</option>
                  <option value="DEMORADAS">Patente demorada</option>
                  <option value="COBRO_PENDIENTE">
                    Patente recibida, cobro pendiente
                  </option>
                </select>
              </label>
            )}
            {showUnitFilter && (
              <label className="filter-field">
                <span className="sr-only">Situación de la unidad</span>
                <select
                  value={unitFilter ?? 'TODAS'}
                  onChange={(event) =>
                    changeUnitFilter(parseUnitFilter(event.target.value))
                  }
                >
                  <option value="TODAS">Toda situación de unidad</option>
                  <option value="SIN_ASIGNAR">Sin unidad</option>
                  <option value="PENDIENTE_ASIGNACION">
                    Pendientes de asignar unidad
                  </option>
                  <option value="PEDIDA">Pedidas a proveedor</option>
                  <option value="PENDIENTE_INGRESO">
                    Pendientes de ingreso del proveedor
                  </option>
                  <option value="RECIBIDA">Recibidas, falta asignar</option>
                </select>
              </label>
            )}
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
                  licensingFilter !== 'TODAS' ||
                  unitFilter ||
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
                showLicensing={showLicensing}
                onManageLicensing={setLicensingOperation}
                {...(showLicensing && canPayLicensing
                  ? { onRegisterLicensingPayment: registerLicensingPayment }
                  : {})}
                {...(showLicensing
                  ? {
                      unitActions: (operation: SalesOperation) =>
                        availableUnitActions(operation, unitPermissions),
                      onUnitAction: (
                        operation: SalesOperation,
                        action: ActiveUnitAction['action'],
                      ) => setUnitAction({ operation, action }),
                    }
                  : {})}
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
      )}
      {licensingOperation && (
        <LicensingModal
          globalAccess={user?.globalAccess ?? false}
          onChanged={() => setRefreshKey((value) => value + 1)}
          onClose={() => setLicensingOperation(null)}
          {...(canPayLicensing
            ? { onRegisterPayment: registerLicensingPayment }
            : {})}
          operation={licensingOperation}
          permissions={user?.role.permissions}
        />
      )}
      <UnitFulfillmentDialogs
        active={unitAction}
        canEditUnit={unitPermissions.canEditUnit}
        onClose={() => setUnitAction(null)}
        onDone={() => {
          setUnitAction(null)
          setRefreshKey((value) => value + 1)
        }}
      />
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
