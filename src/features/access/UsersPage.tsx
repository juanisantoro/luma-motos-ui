import {
  ChevronLeft,
  ChevronRight,
  MailPlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { accessApiGateway } from './api'
import {
  AccessNotice,
  AccessTabs,
  ConfirmDialog,
  formatAccessDate,
  managedUserName,
} from './components'
import { accessErrorMessage } from './errors'
import { alertError, alertSuccess } from '../../shared/alerts'
import type {
  AccessGateway,
  BranchOption,
  InvitationStatus,
  ManagedRole,
  ManagedUser,
  UserListResponse,
} from './types'

const PAGE_SIZE = 20
type LoadStatus = 'loading' | 'success' | 'error'
type Action = { type: 'status' | 'resend'; user: ManagedUser }

const invitationLabels: Record<InvitationStatus, string> = {
  PENDING: 'Pendiente',
  DELIVERED: 'Enviada',
  FAILED: 'Fallida',
  ACCEPTED: 'Aceptada',
  EXPIRED: 'Vencida',
}

function invitationTone(status: InvitationStatus) {
  if (status === 'ACCEPTED') return 'status-badge--success'
  if (status === 'FAILED' || status === 'EXPIRED') return 'status-badge--danger'
  return 'status-badge--warning'
}

function UserActions({
  item,
  canManage,
  onAction,
}: {
  item: ManagedUser
  canManage: boolean
  onAction: (action: Action) => void
}) {
  if (!canManage) return null
  return (
    <div className="access-actions">
      <Link
        className="icon-button table-action"
        aria-label={`Editar a ${managedUserName(item)}`}
        title="Editar usuario"
        to={`/usuarios/${item.id}/editar`}
      >
        <Pencil size={17} />
      </Link>
      {item.invitation.status !== 'ACCEPTED' && (
        <button
          className="icon-button table-action"
          aria-label={`Reenviar invitación a ${managedUserName(item)}`}
          onClick={() => onAction({ type: 'resend', user: item })}
          title="Reenviar invitación"
          type="button"
        >
          <MailPlus size={18} />
        </button>
      )}
      <button
        className="icon-button table-action"
        aria-label={`${item.active ? 'Desactivar' : 'Activar'} a ${managedUserName(item)}`}
        onClick={() => onAction({ type: 'status', user: item })}
        title={item.active ? 'Desactivar usuario' : 'Activar usuario'}
        type="button"
      >
        {item.active ? <UserRoundX size={18} /> : <UserRoundCheck size={18} />}
      </button>
    </div>
  )
}

function UserList({
  items,
  canManage,
  onAction,
}: {
  items: ManagedUser[]
  canManage: boolean
  onAction: (action: Action) => void
}) {
  const mobile = useMediaQuery('(max-width: 768px)')
  if (mobile) {
    return (
      <div className="access-card-list">
        {items.map((item) => (
          <article className="access-card" key={item.id}>
            <header>
              <div>
                <strong>{managedUserName(item)}</strong>
                <span>{item.email}</span>
              </div>
              <span
                className={`status-badge ${item.active ? 'status-badge--success' : ''}`}
              >
                {item.active ? 'Activo' : 'Inactivo'}
              </span>
            </header>
            <dl>
              <div><dt>Sucursal</dt><dd>{item.branch?.name ?? 'Todas'}</dd></div>
              <div><dt>Rol</dt><dd>{item.role?.name ?? 'Sin rol'}</dd></div>
              <div>
                <dt>Invitación</dt>
                <dd>
                  <span className={`status-badge ${invitationTone(item.invitation.status)}`}>
                    {invitationLabels[item.invitation.status]}
                  </span>
                </dd>
              </div>
              <div><dt>Último acceso</dt><dd>{formatAccessDate(item.lastLoginAt)}</dd></div>
            </dl>
            <UserActions item={item} canManage={canManage} onAction={onAction} />
          </article>
        ))}
      </div>
    )
  }
  return (
    <div className="access-table-wrap">
      <table className="access-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Sucursal</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Invitación</th>
            <th>Último acceso</th>
            {canManage && <th><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td><strong>{managedUserName(item)}</strong><small>{item.email}</small></td>
              <td>{item.branch?.name ?? 'Todas'}</td>
              <td>{item.role?.name ?? 'Sin rol'}</td>
              <td>
                <span className={`status-badge ${item.active ? 'status-badge--success' : ''}`}>
                  {item.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <span className={`status-badge ${invitationTone(item.invitation.status)}`}>
                  {invitationLabels[item.invitation.status]}
                </span>
              </td>
              <td>{formatAccessDate(item.lastLoginAt)}</td>
              {canManage && (
                <td><UserActions item={item} canManage onAction={onAction} /></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function UsersPage({
  gateway = accessApiGateway,
}: {
  gateway?: AccessGateway
}) {
  const { user } = useAuth()
  const canManage = hasPermission(user?.role.permissions, 'usuarios.gestionar')
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [result, setResult] = useState<UserListResponse | null>(null)
  const [roles, setRoles] = useState<ManagedRole[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState('')
  const [roleCode, setRoleCode] = useState('')
  const [active, setActive] = useState('')
  const [invitationStatus, setInvitationStatus] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    void Promise.all([
      gateway.listRoles({ page: 1, limit: 100 }, controller.signal),
      gateway.listBranches(user.organization.id, controller.signal),
    ]).then(([roleResult, branchResult]) => {
      setRoles(roleResult.items)
      setBranches(branchResult)
    }).catch((referenceError: unknown) => {
      if (!controller.signal.aborted) {
        setError(accessErrorMessage(referenceError))
      }
    })
    return () => controller.abort()
  }, [gateway, user])

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    void gateway.listUsers(
      {
        page,
        limit: PAGE_SIZE,
        organizationId: user.organization.id,
        ...(search ? { search } : {}),
        ...(branchId ? { branchId } : {}),
        ...(roleCode ? { roleCode } : {}),
        ...(active ? { active: active === 'true' } : {}),
        ...(invitationStatus
          ? { invitationStatus: invitationStatus as InvitationStatus }
          : {}),
      },
      controller.signal,
    ).then((response) => {
      setResult(response)
      setStatus('success')
    }).catch((loadError: unknown) => {
      if (controller.signal.aborted) return
      setError(accessErrorMessage(loadError))
      setStatus('error')
    })
    return () => controller.abort()
  }, [
    active,
    branchId,
    gateway,
    invitationStatus,
    page,
    refreshKey,
    roleCode,
    search,
    user,
  ])

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }
  const changeFilter = (setter: (value: string) => void, value: string) => {
    setPage(1)
    setter(value)
  }
  const confirmAction = async () => {
    if (!action) return
    setActionBusy(true)
    setError('')
    try {
      let successMessage = ''
      if (action.type === 'status') {
        const response = await gateway.updateUserStatus(
          action.user.id,
          !action.user.active,
        )
        successMessage =
          `${managedUserName(response.user)} quedó ${response.user.active ? 'activo' : 'inactivo'}. ${response.revokedSessions ? `Se cerraron ${response.revokedSessions} sesiones.` : ''}`.trim()
        setNotice(successMessage)
      } else {
        await gateway.resendUserInvitation(action.user.id)
        successMessage = `La invitación se envió nuevamente a ${action.user.email}.`
        setNotice(successMessage)
      }
      setAction(null)
      setRefreshKey((current) => current + 1)
      void alertSuccess(successMessage)
    } catch (actionError) {
      const message = accessErrorMessage(actionError)
      setError(message)
      setAction(null)
      void alertError(message)
    } finally {
      setActionBusy(false)
    }
  }
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">SEGURIDAD Y ACCESOS</p>
          <h1>Usuarios y permisos</h1>
          <p>Administrá accesos asignados por la organización.</p>
        </div>
        {canManage && (
          <Link className="button button--primary" to="/usuarios/nuevo">
            <Plus size={18} /> Crear usuario
          </Link>
        )}
      </header>
      <AccessTabs />
      {notice && <AccessNotice message={notice} onClose={() => setNotice('')} />}
      {error && (
        <AccessNotice message={error} tone="error" onClose={() => setError('')} />
      )}
      <section className="access-panel" aria-label="Listado de usuarios">
        <form className="access-filters" onSubmit={submitFilters}>
          <label className="search-field">
            <span className="sr-only">Buscar usuarios</span>
            <Search size={18} />
            <input
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Buscar nombre o email"
              type="search"
              value={searchDraft}
            />
          </label>
          <label className="filter-field">
            <span className="sr-only">Filtrar por sucursal</span>
            <select value={branchId} onChange={(event) => changeFilter(setBranchId, event.target.value)}>
              <option value="">Todas las sucursales</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span className="sr-only">Filtrar por rol</span>
            <select value={roleCode} onChange={(event) => changeFilter(setRoleCode, event.target.value)}>
              <option value="">Todos los roles</option>
              {roles.map((role) => <option key={role.id} value={role.code}>{role.name}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span className="sr-only">Filtrar por estado</span>
            <select value={active} onChange={(event) => changeFilter(setActive, event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </label>
          <label className="filter-field">
            <span className="sr-only">Filtrar por invitación</span>
            <select value={invitationStatus} onChange={(event) => changeFilter(setInvitationStatus, event.target.value)}>
              <option value="">Todas las invitaciones</option>
              {Object.entries(invitationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="button button--secondary" type="submit">Buscar</button>
        </form>
        <div className="access-content" aria-live="polite">
          {status === 'loading' && <div className="access-loading"><div className="loading-mark" /><span>Cargando usuarios…</span></div>}
          {status === 'error' && <StatePanel icon={RefreshCw} title="No pudimos cargar los usuarios" description={error} tone="danger" action={<button className="button button--primary" onClick={() => setRefreshKey((value) => value + 1)} type="button"><RefreshCw size={17} /> Reintentar</button>} />}
          {status === 'success' && result?.items.length === 0 && <StatePanel icon={UsersRound} title="No hay usuarios para mostrar" description="Probá con otros filtros o creá un usuario nuevo." />}
          {status === 'success' && result && result.items.length > 0 && <UserList items={result.items} canManage={canManage} onAction={setAction} />}
        </div>
        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>{result.total} {result.total === 1 ? 'usuario' : 'usuarios'}</span>
            <div>
              <button className="icon-button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ChevronLeft size={19} /></button>
              <strong>Página {result.page} de {totalPages}</strong>
              <button className="icon-button" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={19} /></button>
            </div>
          </footer>
        )}
      </section>
      {action && (
        <ConfirmDialog
          title={action.type === 'status' ? `${action.user.active ? 'Desactivar' : 'Activar'} usuario` : 'Reenviar invitación'}
          description={action.type === 'status' ? 'El cambio de acceso cerrará las sesiones activas del usuario y puede ser rechazado si afecta al último administrador.' : 'Se generará una nueva contraseña temporal, se invalidará la anterior y se cerrarán sus sesiones. El secreto sólo se enviará por email.'}
          confirmLabel={action.type === 'status' ? (action.user.active ? 'Desactivar' : 'Activar') : 'Reenviar invitación'}
          busy={actionBusy}
          danger={action.type === 'status' && action.user.active}
          onCancel={() => setAction(null)}
          onConfirm={() => void confirmAction()}
        />
      )}
    </>
  )
}
