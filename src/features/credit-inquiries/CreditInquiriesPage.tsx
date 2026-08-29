import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { StatePanel } from '../../shared/components/StatePanel'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import {
  listCreditBranches,
  listCreditRegistrants,
  listFinancialInstitutions,
  listRejectedInquiries,
} from './api'
import { CreditInquiryList } from './CreditInquiryList'
import { CreditInquiryModal } from './CreditInquiryModal'
import {
  creditInquiryErrorMessage,
  isForbiddenError,
} from './errors'
import type {
  BranchReference,
  FinancialInstitution,
  RegistrantReference,
  RejectedInquiryListResponse,
  RejectedInquiryQuery,
} from './types'
import './credit-inquiries.css'

const PAGE_SIZE = 20

type LoadStatus = 'loading' | 'success' | 'error' | 'forbidden'

type FilterValues = {
  search: string
  financialEntityId: string
  dateFrom: string
  dateTo: string
  branchId: string
  registeredById: string
}

const emptyFilters: FilterValues = {
  search: '',
  financialEntityId: '',
  dateFrom: '',
  dateTo: '',
  branchId: '',
  registeredById: '',
}

export function CreditInquiriesPage() {
  const { user } = useAuth()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const canRegister = hasPermission(
    user?.role.permissions,
    'consultas_crediticias.registrar',
  )
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [result, setResult] = useState<RejectedInquiryListResponse | null>(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<FilterValues>(emptyFilters)
  const [draft, setDraft] = useState<FilterValues>(emptyFilters)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [catalogError, setCatalogError] = useState('')
  const [financialInstitutions, setFinancialInstitutions] = useState<
    FinancialInstitution[]
  >([])
  const [branches, setBranches] = useState<BranchReference[]>([])
  const [registrants, setRegistrants] = useState<RegistrantReference[]>([])
  const [filtersOpen, setFiltersOpen] = useState(!isMobile)
  const [modalOpen, setModalOpen] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setCatalogError('')
    void Promise.all([
      listFinancialInstitutions(controller.signal),
      listCreditBranches(controller.signal),
      listCreditRegistrants({ page: 1, limit: 100 }, controller.signal),
    ])
      .then(([institutions, branchResult, registrantResult]) => {
        setFinancialInstitutions(institutions.items)
        setBranches(branchResult.items)
        setRegistrants(registrantResult.items)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setCatalogError(creditInquiryErrorMessage(error))
      })
    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setLoadError('')
    const query: RejectedInquiryQuery = {
      page,
      limit: PAGE_SIZE,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.financialEntityId
        ? { financialEntityId: filters.financialEntityId }
        : {}),
      ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
      ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.registeredById
        ? { registeredById: filters.registeredById }
        : {}),
    }

    void listRejectedInquiries(query, controller.signal)
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(creditInquiryErrorMessage(error))
        setStatus(isForbiddenError(error) ? 'forbidden' : 'error')
      })
    return () => controller.abort()
  }, [filters, page, refreshKey])

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
      setFeedback('La fecha desde no puede ser posterior a la fecha hasta.')
      return
    }
    setFeedback('')
    setPage(1)
    setFilters({
      ...draft,
      search: draft.search.trim(),
    })
  }

  const clearFilters = () => {
    setDraft(emptyFilters)
    setFilters(emptyFilters)
    setPage(1)
    setFeedback('')
  }

  const reload = () => setRefreshKey((current) => current + 1)
  const hasFilters = Object.values(filters).some(Boolean)
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1

  const savedInquiry = (replayed: boolean) => {
    setModalOpen(false)
    setFeedback(
      replayed
        ? 'El rechazo ya había sido registrado; no se creó un duplicado.'
        : 'Rechazo registrado correctamente.',
    )
    setPage(1)
    reload()
  }

  return (
    <>
      <header className="page-heading credit-inquiries-heading">
        <div>
          <p className="eyebrow">GESTIÓN COMERCIAL</p>
          <h1>Clientes en rojo</h1>
          <p>
            Antecedentes de consultas crediticias rechazadas e historial de intentos.
          </p>
        </div>
        {canRegister && (
          <button
            className="button button--primary"
            onClick={() => setModalOpen(true)}
            type="button"
          >
            <Plus size={18} aria-hidden="true" />
            Registrar rechazo
          </button>
        )}
      </header>

      <section
        className="credit-inquiries-panel"
        aria-label="Listado consolidado de consultas rechazadas"
      >
        <details
          className="credit-inquiries-filters"
          open={filtersOpen}
          onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
        >
          <summary>
            <span>
              <Filter size={18} aria-hidden="true" />
              Filtros
            </span>
            {hasFilters && (
              <span className="credit-inquiries-filters__count">
                Filtros aplicados
              </span>
            )}
          </summary>
          <form onSubmit={applyFilters}>
            <label className="credit-inquiries-search">
              <span>Documento o nombre</span>
              <span>
                <Search size={18} aria-hidden="true" />
                <input
                  value={draft.search}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Buscar cliente"
                  type="search"
                />
              </span>
            </label>
            <label className="field">
              <span>Financiera</span>
              <select
                value={draft.financialEntityId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    financialEntityId: event.target.value,
                  }))
                }
              >
                <option value="">Todas</option>
                {financialInstitutions.map((institution) => (
                  <option value={institution.id} key={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Desde</span>
              <input
                type="date"
                value={draft.dateFrom}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input
                type="date"
                value={draft.dateTo}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Sucursal</span>
              <select
                value={draft.branchId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    branchId: event.target.value,
                  }))
                }
              >
                <option value="">Todas</option>
                {branches.map((branch) => (
                  <option value={branch.id} key={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Vendedor</span>
              <select
                value={draft.registeredById}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    registeredById: event.target.value,
                  }))
                }
              >
                <option value="">Todos</option>
                {registrants.map((registrant) => (
                  <option value={registrant.id} key={registrant.id}>
                    {registrant.fullName}
                  </option>
                ))}
              </select>
            </label>
            <div className="credit-inquiries-filters__actions">
              <button className="button button--secondary" type="button" onClick={clearFilters}>
                Limpiar
              </button>
              <button className="button button--primary" type="submit">
                Aplicar filtros
              </button>
            </div>
          </form>
        </details>

        {catalogError && (
          <div className="credit-inquiries-notice" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <span>
              No pudimos cargar todos los filtros. {catalogError}
            </span>
          </div>
        )}

        {feedback && (
          <div className="credit-inquiries-feedback" role="status">
            <span>{feedback}</span>
            <button
              type="button"
              aria-label="Cerrar mensaje"
              onClick={() => setFeedback('')}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="credit-inquiries-content" aria-live="polite">
          {status === 'loading' && (
            <div className="credit-inquiries-loading" role="status">
              <div className="loading-mark" />
              <span>Cargando consultas crediticias…</span>
            </div>
          )}

          {status === 'forbidden' && (
            <StatePanel
              icon={ShieldAlert}
              title="Acceso restringido"
              description={loadError}
              tone="danger"
            />
          )}

          {status === 'error' && (
            <StatePanel
              icon={RefreshCw}
              title="No pudimos cargar las consultas"
              description={loadError}
              tone="danger"
              action={
                <button
                  className="button button--primary"
                  onClick={reload}
                  type="button"
                >
                  <RefreshCw size={17} aria-hidden="true" />
                  Reintentar
                </button>
              }
            />
          )}

          {status === 'success' && result?.items.length === 0 && (
            <StatePanel
              icon={CircleAlert}
              title={hasFilters ? 'No hay coincidencias' : 'No hay rechazos registrados'}
              description={
                hasFilters
                  ? 'Modificá o limpiá los filtros para ampliar la búsqueda.'
                  : canRegister
                    ? 'Registrá el primer rechazo para iniciar el historial crediticio.'
                    : 'No hay antecedentes disponibles para tu organización.'
              }
            />
          )}

          {status === 'success' && result && result.items.length > 0 && (
            <CreditInquiryList inquiries={result.items} />
          )}
        </div>

        {status === 'success' && result && result.total > 0 && (
          <footer className="credit-inquiries-pagination">
            <span>
              {result.total}{' '}
              {result.total === 1 ? 'consulta rechazada' : 'consultas rechazadas'}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
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
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                type="button"
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </footer>
        )}
      </section>

      {modalOpen && (
        <CreditInquiryModal
          financialInstitutions={financialInstitutions}
          branches={branches}
          registrants={registrants}
          onClose={() => setModalOpen(false)}
          onSaved={savedInquiry}
        />
      )}
    </>
  )
}
