import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { accessApiGateway } from './api'
import { AccessNotice, ConfirmDialog, managedUserName } from './components'
import { accessErrorMessage } from './errors'
import type {
  AccessGateway,
  BranchOption,
  ManagedRole,
  ManagedUser,
} from './types'

function optional(data: FormData, name: string) {
  const value = String(data.get(name) ?? '').trim()
  return value || undefined
}

export function UserFormPage({
  gateway = accessApiGateway,
}: {
  gateway?: AccessGateway
}) {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user: currentUser } = useAuth()
  const canManage = hasPermission(
    currentUser?.role.permissions,
    'usuarios.gestionar',
  )
  const [roles, setRoles] = useState<ManagedRole[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [managedUser, setManagedUser] = useState<ManagedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [globalAccess, setGlobalAccess] = useState(false)
  const [createdEmail, setCreatedEmail] = useState('')
  const [confirmation, setConfirmation] = useState<'status' | 'resend' | null>(
    null,
  )
  const [actionBusy, setActionBusy] = useState(false)
  const visibleRoles = useMemo(
    () =>
      roles.filter(
        (role) => role.active || role.code === managedUser?.role?.code,
      ),
    [managedUser, roles],
  )

  useEffect(() => {
    if (!currentUser) return
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    const requests: [
      Promise<{ items: ManagedRole[] }>,
      Promise<BranchOption[]>,
      Promise<ManagedUser | null>,
    ] = [
      gateway.listRoles({ page: 1, limit: 100 }, controller.signal),
      gateway.listBranches(currentUser.organization.id, controller.signal),
      id ? gateway.getUser(id, controller.signal) : Promise.resolve(null),
    ]
    void Promise.all(requests)
      .then(([roleResult, branchResult, selectedUser]) => {
        setRoles(roleResult.items)
        setBranches(branchResult)
        setManagedUser(selectedUser)
        setGlobalAccess(selectedUser?.globalAccess ?? false)
        setLoading(false)
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(accessErrorMessage(requestError))
        setLoading(false)
      })
    return () => controller.abort()
  }, [currentUser, gateway, id])

  if (!canManage) return <Navigate to="/sin-permiso" replace />
  if (loading) {
    return <div className="access-loading access-loading--page"><div className="loading-mark" /><span>Cargando formulario…</span></div>
  }
  if (loadError) {
    return <StatePanel icon={RefreshCw} title="No pudimos preparar el formulario" description={loadError} tone="danger" />
  }
  if (createdEmail) {
    return (
      <StatePanel
        icon={CheckCircle2}
        title="Usuario creado e invitación enviada"
        description={`La contraseña temporal se envió por email a ${createdEmail}. Por seguridad no se muestra en pantalla.`}
        action={<Link className="button button--primary" to="/usuarios">Volver a usuarios</Link>}
      />
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentUser) return
    const data = new FormData(event.currentTarget)
    const branchId = optional(data, 'branchId')
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      if (editing && id) {
        const response = await gateway.updateUserAccess(id, {
          roleCode: String(data.get('roleCode') ?? ''),
          branchId: branchId ?? null,
          globalAccess,
        })
        setManagedUser(response.user)
        setNotice(
          `Acceso actualizado. ${response.revokedSessions ? `Se cerraron ${response.revokedSessions} sesiones activas.` : 'No había sesiones activas.'}`,
        )
      } else {
        const fullName = `${String(data.get('firstName') ?? '').trim()} ${String(data.get('lastName') ?? '').trim()}`.trim()
        const email = String(data.get('email') ?? '').trim().toLowerCase()
        const employeeCode = optional(data, 'employeeCode')
        const phone = optional(data, 'phone')
        await gateway.createUser({
          fullName,
          email,
          organizationId: currentUser.organization.id,
          roleCode: String(data.get('roleCode') ?? ''),
          ...(branchId ? { branchId } : {}),
          ...(globalAccess ? { globalAccess: true } : {}),
          ...(employeeCode ? { employeeCode } : {}),
          ...(phone ? { phone } : {}),
        })
        setCreatedEmail(email)
      }
    } catch (submitError) {
      setError(accessErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmAction = async () => {
    if (!managedUser || !confirmation) return
    setActionBusy(true)
    setError('')
    try {
      if (confirmation === 'status') {
        const response = await gateway.updateUserStatus(
          managedUser.id,
          !managedUser.active,
        )
        setManagedUser(response.user)
        setNotice(
          `Usuario ${response.user.active ? 'activado' : 'desactivado'}. ${response.revokedSessions ? `Se cerraron ${response.revokedSessions} sesiones.` : ''}`,
        )
      } else {
        await gateway.resendUserInvitation(managedUser.id)
        setNotice(
          `Invitación enviada a ${managedUser.email}. La contraseña temporal anterior quedó invalidada.`,
        )
      }
      setConfirmation(null)
    } catch (actionError) {
      setError(accessErrorMessage(actionError))
      setConfirmation(null)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <Link className="back-link" to="/usuarios"><ArrowLeft size={17} /> Usuarios</Link>
          <p className="eyebrow">SEGURIDAD Y ACCESOS</p>
          <h1>{editing ? 'Editar usuario' : 'Crear usuario'}</h1>
          <p>{editing ? 'Los cambios de acceso pueden cerrar sesiones activas.' : 'Asigná un rol y alcance inicial al nuevo integrante.'}</p>
        </div>
      </header>
      {error && <AccessNotice message={error} tone="error" onClose={() => setError('')} />}
      {notice && <AccessNotice message={notice} onClose={() => setNotice('')} />}
      <form className="access-form-card" onSubmit={submit}>
        {editing && managedUser && (
          <div className="access-user-summary">
            <div><strong>{managedUserName(managedUser)}</strong><span>{managedUser.email}</span></div>
            <span className={`status-badge ${managedUser.active ? 'status-badge--success' : ''}`}>{managedUser.active ? 'Activo' : 'Inactivo'}</span>
          </div>
        )}
        {!editing && (
          <>
            <div className="email-delivery-note">
              <Mail size={20} />
              <div><strong>Se enviará una contraseña temporal por email</strong><p>El usuario deberá cambiarla antes de poder ingresar. La contraseña nunca se muestra en este sistema.</p></div>
            </div>
            <div className="access-form-grid">
              <label className="field"><span>Nombre *</span><input name="firstName" maxLength={90} required /></label>
              <label className="field"><span>Apellido *</span><input name="lastName" maxLength={90} required /></label>
              <label className="field"><span>Correo electrónico *</span><input name="email" type="email" maxLength={254} required /></label>
              <label className="field"><span>Teléfono</span><input name="phone" type="tel" maxLength={40} /></label>
              <label className="field"><span>Código de empleado</span><input name="employeeCode" maxLength={40} /></label>
            </div>
          </>
        )}
        <div className="access-form-grid">
          <label className="field">
            <span>Rol *</span>
            <select name="roleCode" defaultValue={managedUser?.role?.code ?? ''} required>
              <option value="" disabled>Seleccioná un rol</option>
              {visibleRoles.map((role) => <option key={role.id} value={role.code}>{role.name}{role.system ? ' · Rol base' : ''}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Sucursal</span>
            <select name="branchId" defaultValue={managedUser?.branch?.id ?? ''}>
              <option value="">Sin sucursal asignada</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="checkbox-field access-scope">
            <input checked={globalAccess} onChange={(event) => setGlobalAccess(event.target.checked)} type="checkbox" />
            <span><strong>Acceso a toda la organización</strong><small>Si no se activa, el alcance queda limitado a la sucursal asignada.</small></span>
          </label>
        </div>
        {editing && (
          <div className="access-warning">
            <ShieldAlert size={20} />
            <span>Modificar rol, sucursal, alcance o estado cierra las sesiones afectadas. El backend protege al último administrador y tu propio acceso administrativo.</span>
          </div>
        )}
        <div className="access-form-actions">
          {editing && managedUser && (
            <div className="access-form-actions__secondary">
              <button className="button button--secondary" onClick={() => setConfirmation('resend')} type="button">Reenviar invitación</button>
              <button className={`button ${managedUser.active ? 'button--danger' : 'button--success'}`} onClick={() => setConfirmation('status')} type="button">{managedUser.active ? 'Desactivar' : 'Activar'}</button>
            </div>
          )}
          <div>
            <Link className="button button--secondary" to="/usuarios">Cancelar</Link>
            <button className="button button--primary" disabled={submitting} type="submit">
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Guardando…' : editing ? 'Guardar acceso' : 'Crear y enviar invitación'}
            </button>
          </div>
        </div>
      </form>
      {confirmation && managedUser && (
        <ConfirmDialog
          title={confirmation === 'resend' ? 'Reenviar invitación' : `${managedUser.active ? 'Desactivar' : 'Activar'} usuario`}
          description={confirmation === 'resend' ? 'Se generará una nueva contraseña temporal, se invalidará la anterior y se cerrarán las sesiones. El secreto se enviará únicamente por email.' : 'Este cambio cerrará las sesiones activas y puede ser rechazado para proteger al último administrador.'}
          confirmLabel={confirmation === 'resend' ? 'Reenviar invitación' : managedUser.active ? 'Desactivar' : 'Activar'}
          busy={actionBusy}
          danger={confirmation === 'status' && managedUser.active}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void confirmAction()}
        />
      )}
    </>
  )
}
