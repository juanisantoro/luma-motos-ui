import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { accessApiGateway } from './api'
import { AccessNotice, AccessTabs, ConfirmDialog } from './components'
import { accessErrorMessage } from './errors'
import type {
  AccessGateway,
  ManagedRole,
  PermissionGroup,
  RoleListResponse,
} from './types'

const PAGE_SIZE = 20
type LoadStatus = 'loading' | 'success' | 'error'

function CloneDialog({
  role,
  busy,
  onCancel,
  onClone,
}: {
  role: ManagedRole
  busy: boolean
  onCancel: () => void
  onClone: (name: string) => void
}) {
  const dialogRef = useDialogFocus(onCancel, busy)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onClone(String(data.get('name') ?? '').trim())
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="access-confirm" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="clone-role-title">
        <h2 id="clone-role-title">Clonar {role.name}</h2>
        <p>Se copiarán sus permisos actuales. El backend generará un código estable para el nuevo rol.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Nombre del nuevo rol *</span>
            <input autoFocus defaultValue={`Copia de ${role.name}`} maxLength={80} name="name" required />
          </label>
          <footer>
            <button className="button button--secondary" disabled={busy} onClick={onCancel} type="button">Cancelar</button>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy && <LoaderCircle className="spin" size={17} />}
              Clonar rol
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

function permissionSummary(role: ManagedRole, groups: PermissionGroup[]) {
  const modules = groups
    .filter((group) =>
      group.permissions.some((permission) =>
        role.permissions.some(({ code }) => code === permission.code),
      ),
    )
    .map((group) => group.label)
  if (!modules.length) return 'Sin permisos'
  return modules.slice(0, 3).join(', ') + (modules.length > 3 ? ` +${modules.length - 3}` : '')
}

export function RolesPage({
  gateway = accessApiGateway,
}: {
  gateway?: AccessGateway
}) {
  const { user } = useAuth()
  const canManage = hasPermission(user?.role.permissions, 'roles.gestionar')
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [result, setResult] = useState<RoleListResponse | null>(null)
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [active, setActive] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [statusRole, setStatusRole] = useState<ManagedRole | null>(null)
  const [cloneRole, setCloneRole] = useState<ManagedRole | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void gateway
      .listPermissions(controller.signal)
      .then(setGroups)
      .catch((catalogError: unknown) => {
        if (!controller.signal.aborted) {
          setError(accessErrorMessage(catalogError))
        }
      })
    return () => controller.abort()
  }, [gateway])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    void gateway
      .listRoles(
        {
          page,
          limit: PAGE_SIZE,
          ...(search ? { search } : {}),
          ...(active ? { active: active === 'true' } : {}),
        },
        controller.signal,
      )
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(accessErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [active, gateway, page, refreshKey, search])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }
  const changeStatus = async () => {
    if (!statusRole) return
    setBusy(true)
    setError('')
    try {
      const role = await gateway.updateRoleStatus(statusRole.id, {
        active: !statusRole.active,
        version: statusRole.version,
      })
      setNotice(`${role.name} quedó ${role.active ? 'activo' : 'inactivo'}.`)
      setStatusRole(null)
      setRefreshKey((value) => value + 1)
    } catch (actionError) {
      setError(accessErrorMessage(actionError))
      setStatusRole(null)
    } finally {
      setBusy(false)
    }
  }
  const clone = async (name: string) => {
    if (!cloneRole) return
    setBusy(true)
    setError('')
    try {
      const role = await gateway.cloneRole(cloneRole.id, { name })
      setNotice(`${role.name} fue creado con los permisos de ${cloneRole.name}.`)
      setCloneRole(null)
      setRefreshKey((value) => value + 1)
    } catch (actionError) {
      setError(accessErrorMessage(actionError))
    } finally {
      setBusy(false)
    }
  }
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">SEGURIDAD Y ACCESOS</p>
          <h1>Roles y permisos</h1>
          <p>Configurá autorizaciones usando el catálogo vigente del backend.</p>
        </div>
        {canManage && <Link className="button button--primary" to="/usuarios/roles/nuevo"><Plus size={18} /> Crear rol</Link>}
      </header>
      <AccessTabs />
      {notice && <AccessNotice message={notice} onClose={() => setNotice('')} />}
      {error && <AccessNotice message={error} tone="error" onClose={() => setError('')} />}
      <section className="access-panel" aria-label="Listado de roles">
        <form className="role-filters" onSubmit={submitSearch}>
          <label className="search-field">
            <span className="sr-only">Buscar roles</span><Search size={18} />
            <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Buscar nombre o descripción" type="search" />
          </label>
          <label className="filter-field">
            <span className="sr-only">Filtrar por estado</span>
            <select value={active} onChange={(event) => { setPage(1); setActive(event.target.value) }}>
              <option value="">Todos los estados</option><option value="true">Activos</option><option value="false">Inactivos</option>
            </select>
          </label>
          <button className="button button--secondary" type="submit">Buscar</button>
        </form>
        <div className="access-content" aria-live="polite">
          {status === 'loading' && <div className="access-loading"><div className="loading-mark" /><span>Cargando roles…</span></div>}
          {status === 'error' && <StatePanel icon={RefreshCw} title="No pudimos cargar los roles" description={error} tone="danger" />}
          {status === 'success' && result?.items.length === 0 && <StatePanel icon={ShieldCheck} title="No hay roles para mostrar" description="Probá con otros filtros o creá un rol nuevo." />}
          {status === 'success' && result && result.items.length > 0 && (
            <div className="access-table-wrap">
              <table className="access-table role-table">
                <thead><tr><th>Rol</th><th>Descripción</th><th>Usuarios</th><th>Estado</th><th>Permisos</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {result.items.map((role) => (
                    <tr key={role.id}>
                      <td><strong>{role.name}</strong><small>{role.code}{role.system ? ' · Rol base' : ''}</small></td>
                      <td>{role.description || 'Sin descripción'}</td>
                      <td>{role.userCount}</td>
                      <td><span className={`status-badge ${role.active ? 'status-badge--success' : ''}`}>{role.active ? 'Activo' : 'Inactivo'}</span></td>
                      <td><strong>{role.permissions.length}</strong><small>{permissionSummary(role, groups)}</small></td>
                      <td>
                        <div className="access-actions">
                          <Link className="icon-button table-action" aria-label={`Ver rol ${role.name}`} title="Ver detalle" to={`/usuarios/roles/${role.id}`}><Eye size={18} /></Link>
                          {canManage && role.actions.canEdit && <Link className="icon-button table-action" aria-label={`Editar rol ${role.name}`} title="Editar rol" to={`/usuarios/roles/${role.id}/editar`}><Pencil size={17} /></Link>}
                          {canManage && role.actions.canClone && <button className="icon-button table-action" aria-label={`Clonar rol ${role.name}`} onClick={() => setCloneRole(role)} title="Clonar rol" type="button"><Copy size={17} /></button>}
                          {canManage && role.actions.canChangeStatus && <button className="icon-button table-action" aria-label={`${role.active ? 'Desactivar' : 'Activar'} rol ${role.name}`} onClick={() => setStatusRole(role)} title={role.active ? 'Desactivar rol' : 'Activar rol'} type="button">{role.active ? <ShieldOff size={18} /> : <ShieldCheck size={18} />}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>{result.total} {result.total === 1 ? 'rol' : 'roles'}</span>
            <div>
              <button className="icon-button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button"><ChevronLeft size={19} /></button>
              <strong>Página {result.page} de {totalPages}</strong>
              <button className="icon-button" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={19} /></button>
            </div>
          </footer>
        )}
      </section>
      {statusRole && <ConfirmDialog title={`${statusRole.active ? 'Desactivar' : 'Activar'} rol`} description={statusRole.active ? 'Los usuarios activos asignados impedirán desactivarlo. Los roles base no pueden desactivarse.' : 'El rol volverá a estar disponible para asignaciones.'} confirmLabel={statusRole.active ? 'Desactivar' : 'Activar'} danger={statusRole.active} busy={busy} onCancel={() => setStatusRole(null)} onConfirm={() => void changeStatus()} />}
      {cloneRole && <CloneDialog role={cloneRole} busy={busy} onCancel={() => setCloneRole(null)} onClone={(name) => void clone(name)} />}
    </>
  )
}
