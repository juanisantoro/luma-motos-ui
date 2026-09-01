import { ArrowLeft, LoaderCircle, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { accessApiGateway } from './api'
import { AccessNotice } from './components'
import { accessErrorMessage } from './errors'
import { alertError, alertSuccess } from '../../shared/alerts'
import type { AccessGateway, ManagedRole, PermissionGroup } from './types'

export function RoleFormPage({
  gateway = accessApiGateway,
}: {
  gateway?: AccessGateway
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const { user } = useAuth()
  const canManage = hasPermission(user?.role.permissions, 'roles.gestionar')
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [role, setRole] = useState<ManagedRole | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const roleRequest = id ? gateway.getRole(id, controller.signal) : Promise.resolve(null)
    void Promise.all([gateway.listPermissions(controller.signal), roleRequest])
      .then(([permissionGroups, selectedRole]) => {
        setGroups(permissionGroups)
        setRole(selectedRole)
        setSelected(
          new Set(
            selectedRole?.permissions.map((permission) => permission.code) ?? [],
          ),
        )
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(accessErrorMessage(loadError))
        setLoading(false)
      })
    return () => controller.abort()
  }, [gateway, id])

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    if (!term) return groups
    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) =>
          `${group.label} ${permission.code} ${permission.description}`
            .toLocaleLowerCase('es')
            .includes(term),
        ),
      }))
      .filter((group) => group.permissions.length)
  }, [groups, search])
  const catalogCodes = useMemo(
    () => new Set(groups.flatMap((group) => group.permissions.map((permission) => permission.code))),
    [groups],
  )

  if (!canManage) return <Navigate to="/sin-permiso" replace />
  if (loading) return <div className="access-loading access-loading--page"><div className="loading-mark" /><span>Cargando permisos…</span></div>
  if (editing && !role && error) return <StatePanel icon={RefreshCw} title="No pudimos cargar el rol" description={error} tone="danger" />
  if (role && !role.actions.canEdit) {
    return <StatePanel icon={ShieldAlert} title="Este rol no se puede editar" description="El backend protegió este rol para tu nivel de acceso." />
  }

  const toggle = (code: string) => {
    if (!catalogCodes.has(code)) return
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }
  const setGroup = (group: PermissionGroup, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      group.permissions.forEach((permission) =>
        checked ? next.add(permission.code) : next.delete(permission.code),
      )
      return next
    })
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const invalid = [...selected].filter((code) => !catalogCodes.has(code))
    if (invalid.length) {
      setError('El catálogo cambió. Recargá la pantalla antes de guardar.')
      return
    }
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const description = String(data.get('description') ?? '').trim()
    setSubmitting(true)
    setError('')
    try {
      const response = editing && id && role
        ? await gateway.updateRole(id, {
            name,
            description,
            permissionCodes: [...selected],
            version: role.version,
          })
        : await gateway.createRole({
            name,
            description,
            permissionCodes: [...selected],
          })
      const saved = 'role' in response ? response.role : response
      const successMessage = editing
        ? 'Rol actualizado.'
        : 'Rol creado y disponible para asignar.'
      navigate(`/usuarios/roles/${saved.id}`, {
        replace: true,
        state: { notice: successMessage },
      })
      void alertSuccess(successMessage)
    } catch (submitError) {
      const message = accessErrorMessage(submitError)
      setError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <Link className="back-link" to="/usuarios/roles"><ArrowLeft size={17} /> Roles y permisos</Link>
          <p className="eyebrow">SEGURIDAD Y ACCESOS</p>
          <h1>{editing ? 'Editar rol' : 'Crear rol'}</h1>
          <p>Seleccioná únicamente autorizaciones publicadas por el backend.</p>
        </div>
      </header>
      {error && <AccessNotice message={error} tone="error" onClose={() => setError('')} />}
      <form className="access-form-card role-form" onSubmit={submit}>
        {role?.system && (
          <div className="access-warning">
            <ShieldAlert size={20} />
            <span>Rol base protegido. El código y el estado no se pueden modificar; el backend validará que conserve los permisos administrativos obligatorios.</span>
          </div>
        )}
        <div className="access-form-grid">
          <label className="field"><span>Nombre *</span><input defaultValue={role?.name ?? ''} maxLength={80} name="name" required /></label>
          <label className="field field--wide"><span>Descripción *</span><textarea defaultValue={role?.description ?? ''} maxLength={500} name="description" required rows={3} /></label>
        </div>
        <section className="permission-editor" aria-labelledby="permissions-title">
          <header>
            <div><h2 id="permissions-title">Permisos</h2><p>{selected.size} seleccionados de {catalogCodes.size}</p></div>
            <button className="button button--secondary button--compact" onClick={() => setSelected(new Set())} type="button">Quitar todos</button>
          </header>
          <label className="search-field permission-search">
            <span className="sr-only">Buscar permisos</span><Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar módulo, código o descripción" type="search" />
          </label>
          <div className="permission-groups">
            {filteredGroups.map((group) => {
              const selectedCount = group.permissions.filter((permission) => selected.has(permission.code)).length
              return (
                <section className="permission-group" key={group.module}>
                  <header>
                    <div><h3>{group.label}</h3><span>{selectedCount}/{group.permissions.length}</span></div>
                    <div>
                      <button onClick={() => setGroup(group, true)} type="button">Todos</button>
                      <button onClick={() => setGroup(group, false)} type="button">Ninguno</button>
                    </div>
                  </header>
                  <div className="permission-list">
                    {group.permissions.map((permission) => (
                      <label className="permission-item" key={permission.code}>
                        <input checked={selected.has(permission.code)} onChange={() => toggle(permission.code)} type="checkbox" />
                        <span><strong>{permission.code}</strong><small>{permission.description}</small></span>
                      </label>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
          {!filteredGroups.length && <p className="permission-empty">No hay permisos que coincidan con la búsqueda.</p>}
        </section>
        <div className="access-form-actions"><div /><div><Link className="button button--secondary" to="/usuarios/roles">Cancelar</Link><button className="button button--primary" disabled={submitting} type="submit">{submitting && <LoaderCircle className="spin" size={17} />}{submitting ? 'Guardando…' : 'Guardar rol'}</button></div></div>
      </form>
    </>
  )
}
