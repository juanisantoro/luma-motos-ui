import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { StatePanel } from '../../shared/components/StatePanel'
import { listClients, updateClientStatus } from './api'
import { ClientFormModal } from './ClientFormModal'
import { ClientList } from './ClientList'
import { clientsErrorMessage } from './errors'
import { alertError, alertSuccess } from '../../shared/alerts'
import type { Client, ClientListResponse } from './types'

type LoadStatus = 'loading' | 'success' | 'error'
type ActiveFilter = 'all' | 'active' | 'inactive'

const PAGE_SIZE = 20

export function ClientsPage() {
  const { user } = useAuth()
  const canManage = hasPermission(
    user?.role.permissions,
    'clientes.gestionar',
  )
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [result, setResult] = useState<ClientListResponse | null>(null)
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyClientId, setBusyClientId] = useState<string | null>(null)
  const [modalClient, setModalClient] = useState<Client | null | undefined>()

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setLoadError('')

    void listClients(
      {
        page,
        limit: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(activeFilter === 'all'
          ? {}
          : { active: activeFilter === 'active' }),
      },
      controller.signal,
    )
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(clientsErrorMessage(error))
        setStatus('error')
      })

    return () => controller.abort()
  }, [activeFilter, page, refreshKey, search])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }

  const changeActiveFilter = (value: ActiveFilter) => {
    setPage(1)
    setActiveFilter(value)
  }

  const reload = () => setRefreshKey((current) => current + 1)

  const toggleStatus = async (client: Client) => {
    setBusyClientId(client.id)
    setActionError('')
    try {
      await updateClientStatus(client.id, !client.active)
      reload()
      void alertSuccess(`El cliente quedó ${client.active ? 'inactivo' : 'activo'}.`)
    } catch (error) {
      const message = clientsErrorMessage(error)
      setActionError(message)
      void alertError(message)
    } finally {
      setBusyClientId(null)
    }
  }

  const closeModal = () => setModalClient(undefined)
  const savedClient = () => {
    closeModal()
    reload()
  }
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">GESTIÓN COMERCIAL</p>
          <h1>Clientes</h1>
          <p>Consulta y administración de la cartera de clientes.</p>
        </div>
        {canManage && (
          <button
            className="button button--primary"
            onClick={() => setModalClient(null)}
            type="button"
          >
            <Plus size={18} aria-hidden="true" />
            Nuevo cliente
          </button>
        )}
      </header>

      <section className="clients-panel" aria-label="Listado de clientes">
        <form className="client-filters" onSubmit={submitSearch}>
          <label className="search-field">
            <span className="sr-only">Buscar clientes</span>
            <Search size={18} aria-hidden="true" />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Buscar por nombre, documento o email"
              type="search"
            />
          </label>
          <label className="filter-field">
            <span className="sr-only">Filtrar por estado</span>
            <select
              value={activeFilter}
              onChange={(event) =>
                changeActiveFilter(event.target.value as ActiveFilter)
              }
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </label>
          <button className="button button--secondary" type="submit">
            Buscar
          </button>
        </form>

        {actionError && (
          <div className="inline-error" role="alert">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError('')}>
              Cerrar
            </button>
          </div>
        )}

        <div className="clients-content" aria-live="polite">
          {status === 'loading' && (
            <div className="client-loading">
              <div className="loading-mark" />
              <span>Cargando clientes…</span>
            </div>
          )}

          {status === 'error' && (
            <StatePanel
              icon={RefreshCw}
              title="No pudimos cargar los clientes"
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
              icon={UsersRound}
              title={search || activeFilter !== 'all' ? 'No hay coincidencias' : 'Todavía no hay clientes'}
              description={
                search || activeFilter !== 'all'
                  ? 'Probá con otros términos o modificá el filtro de estado.'
                  : canManage
                    ? 'Creá el primer cliente para comenzar a gestionar la cartera.'
                    : 'No hay clientes disponibles para tu organización.'
              }
            />
          )}

          {status === 'success' &&
            result &&
            result.items.length > 0 && (
              <ClientList
                clients={result.items}
                canManage={canManage}
                busyClientId={busyClientId}
                onEdit={setModalClient}
                onToggleStatus={(selected) => void toggleStatus(selected)}
              />
            )}
        </div>

        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>
              {result.total} {result.total === 1 ? 'cliente' : 'clientes'}
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

      {modalClient !== undefined && (
        <ClientFormModal
          client={modalClient}
          onClose={closeModal}
          onSaved={savedClient}
        />
      )}
    </>
  )
}
