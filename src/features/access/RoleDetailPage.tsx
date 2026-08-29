import { ArrowLeft, Copy, Pencil, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { accessApiGateway } from './api'
import { AccessNotice, managedUserName } from './components'
import { accessErrorMessage } from './errors'
import type {
  AccessGateway,
  ManagedRole,
  ManagedUser,
  PermissionGroup,
} from './types'

export function RoleDetailPage({
  gateway = accessApiGateway,
}: {
  gateway?: AccessGateway
}) {
  const { id } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const canManage = hasPermission(user?.role.permissions, 'roles.gestionar')
  const canViewUsers = hasPermission(
    user?.role.permissions,
    'usuarios.consultar',
  )
  const [role, setRole] = useState<ManagedRole | null>(null)
  const [assignedUsers, setAssignedUsers] = useState<ManagedUser[]>([])
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const notice = (location.state as { notice?: string } | null)?.notice

  useEffect(() => {
    if (!id || !user) return
    const controller = new AbortController()
    void Promise.all([
      gateway.getRole(id, controller.signal),
      gateway.listPermissions(controller.signal),
    ])
      .then(async ([selectedRole, permissionGroups]) => {
        setRole(selectedRole)
        setGroups(permissionGroups)
        if (!canViewUsers) {
          setLoading(false)
          return
        }
        const users = await gateway.listUsers(
            {
              page: 1,
              limit: 100,
              organizationId: user.organization.id,
              roleCode: selectedRole.code,
            },
            controller.signal,
          )
        const remainingPages = Math.ceil(users.total / users.limit)
        const remainingUsers =
          remainingPages > 1
            ? await Promise.all(
                Array.from({ length: remainingPages - 1 }, (_, index) =>
                  gateway.listUsers(
                    {
                      page: index + 2,
                      limit: users.limit,
                      organizationId: user.organization.id,
                      roleCode: selectedRole.code,
                    },
                    controller.signal,
                  ),
                ),
              )
            : []
        setAssignedUsers([
          ...users.items,
          ...remainingUsers.flatMap((page) => page.items),
        ])
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(accessErrorMessage(loadError))
        setLoading(false)
      })
    return () => controller.abort()
  }, [canViewUsers, gateway, id, user])

  if (loading) return <div className="access-loading access-loading--page"><div className="loading-mark" /><span>Cargando rol…</span></div>
  if (!role) return <StatePanel icon={RefreshCw} title="No pudimos cargar el rol" description={error} tone="danger" />

  return (
    <>
      <header className="page-heading">
        <div>
          <Link className="back-link" to="/usuarios/roles"><ArrowLeft size={17} /> Roles y permisos</Link>
          <p className="eyebrow">DETALLE DE ROL</p>
          <h1>{role.name}</h1>
          <p>{role.description || 'Sin descripción'}</p>
        </div>
        {canManage && (role.actions.canEdit || role.actions.canClone) && (
          <div className="page-actions">
          {role.actions.canEdit && <Link className="button button--secondary" to={`/usuarios/roles/${role.id}/editar`}><Pencil size={17} /> Editar</Link>}
          {role.actions.canClone && <Link className="button button--primary" to="/usuarios/roles"><Copy size={17} /> Clonar desde listado</Link>}
          </div>
        )}
      </header>
      {notice && <AccessNotice message={notice} />}
      <div className="role-detail-summary">
        <article><small>Código</small><strong>{role.code}</strong></article>
        <article><small>Estado</small><strong>{role.active ? 'Activo' : 'Inactivo'}</strong></article>
        <article><small>Tipo</small><strong>{role.system ? 'Rol base protegido' : 'Personalizado'}</strong></article>
        <article><small>Usuarios</small><strong>{role.userCount}</strong></article>
      </div>
      <div className={`role-detail-grid ${canViewUsers ? '' : 'role-detail-grid--single'}`}>
        <section className="access-form-card">
          <header className="detail-section-heading"><div><ShieldCheck size={20} /><h2>Matriz de permisos</h2></div><span>{role.permissions.length} autorizaciones</span></header>
          <div className="role-permission-matrix">
            {groups.map((group) => {
              const permissions = group.permissions.filter((permission) => role.permissions.some(({ code }) => code === permission.code))
              return (
                <article className={permissions.length ? '' : 'role-permission-group--empty'} key={group.module}>
                  <header><strong>{group.label}</strong><span>{permissions.length}/{group.permissions.length}</span></header>
                  {permissions.length ? <ul>{permissions.map((permission) => <li key={permission.code}><strong>{permission.code}</strong><span>{permission.description}</span></li>)}</ul> : <p>Sin permisos asignados</p>}
                </article>
              )
            })}
          </div>
        </section>
        {canViewUsers && <section className="access-form-card">
          <header className="detail-section-heading"><div><UsersRound size={20} /><h2>Usuarios asignados</h2></div><span>{assignedUsers.length}</span></header>
          {assignedUsers.length ? (
            <div className="assigned-user-list">
              {assignedUsers.map((assigned) => <Link key={assigned.id} to={`/usuarios/${assigned.id}/editar`}><span><strong>{managedUserName(assigned)}</strong><small>{assigned.email}</small></span><span className={`status-badge ${assigned.active ? 'status-badge--success' : ''}`}>{assigned.active ? 'Activo' : 'Inactivo'}</span></Link>)}
            </div>
          ) : <StatePanel icon={UsersRound} title="Sin usuarios asignados" description="Este rol todavía no fue asignado a ningún usuario." />}
        </section>}
      </div>
    </>
  )
}
