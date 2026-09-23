import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { accessApiGateway } from './api'
import { AccessNotice, ConfirmDialog, managedUserName } from './components'
import { accessErrorMessage } from './errors'
import { alertError, alertSuccess } from '../../shared/alerts'
import { commissionApiGateway } from '../commissions/api'
import type {
  CommissionGateway,
  ManagerCommissionMode,
  ManagerCommissionScope,
  SaveManagerCommissionConfigInput,
} from '../commissions/types'
import type {
  AccessGateway,
  BranchOption,
  ManagedRole,
  ManagedUser,
  UpdateUserAccessInput,
} from './types'

const ADMIN_ROLE_CODE = 'ADMINISTRADOR'

/**
 * Sólo los campos que realmente cambian. Reenviar rol o alcance sin cambios
 * hacía fallar el guardado (p. ej. un admin editando su propia sucursal) y
 * mezclaba en un mismo PATCH validaciones que no correspondían al cambio.
 */
export function accessChanges(
  current: Pick<ManagedUser, 'role' | 'branch' | 'globalAccess'>,
  next: { roleCode: string; branchId: string; globalAccess: boolean },
): UpdateUserAccessInput {
  const changes: UpdateUserAccessInput = {}
  if (next.roleCode && next.roleCode !== (current.role?.code ?? '')) {
    changes.roleCode = next.roleCode
  }
  const nextBranchId = next.branchId || null
  if (nextBranchId !== (current.branch?.id ?? null)) {
    changes.branchId = nextBranchId
  }
  if (next.globalAccess !== current.globalAccess) {
    changes.globalAccess = next.globalAccess
  }
  return changes
}

function optional(data: FormData, name: string) {
  const value = String(data.get(name) ?? '').trim()
  return value || undefined
}

export function UserFormPage({
  gateway = accessApiGateway,
  commissionGateway = commissionApiGateway,
}: {
  gateway?: AccessGateway
  commissionGateway?: CommissionGateway
}) {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user: currentUser } = useAuth()
  const canManage = hasPermission(
    currentUser?.role.permissions,
    'usuarios.gestionar',
  )
  const canConfigureCommissions = hasPermission(
    currentUser?.role.permissions,
    'comisiones.configurar',
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
  const [roleCode, setRoleCode] = useState('')
  const [branchId, setBranchId] = useState('')
  const branchRequired = roleCode === 'VENDEDOR' || roleCode === 'CALLCENTER'
  const [createdEmail, setCreatedEmail] = useState('')
  const [confirmation, setConfirmation] = useState<'status' | 'resend' | null>(
    null,
  )
  const [actionBusy, setActionBusy] = useState(false)
  const [managerConfigLoading, setManagerConfigLoading] = useState(false)
  const [managerMode, setManagerMode] = useState<ManagerCommissionMode>('ESCALA')
  const [managerPercentage, setManagerPercentage] = useState('')
  const [managerPolicyId, setManagerPolicyId] = useState('')
  const [managerScope, setManagerScope] = useState<ManagerCommissionScope>('SUCURSAL_PROPIA')
  const [managerActive, setManagerActive] = useState(true)
  const [managerSaving, setManagerSaving] = useState(false)
  const [managerPolicies, setManagerPolicies] = useState<Array<{ id: string; label: string }>>([])
  const visibleRoles = useMemo(
    () =>
      roles.filter(
        (role) => role.active || role.code === managedUser?.role?.code,
      ),
    [managedUser, roles],
  )
  const editingSelf = editing && Boolean(managedUser) && managedUser?.id === currentUser?.id
  const targetOrganizationType =
    managedUser?.organization.type ?? currentUser?.organization.type
  // Espeja la regla del backend: acceso global sólo para ADMINISTRADOR de
  // Casa Central, otorgado por un administrador global y nunca sobre sí mismo.
  const canGrantGlobalAccess =
    Boolean(currentUser?.globalAccess) &&
    targetOrganizationType === 'CASA_CENTRAL' &&
    roleCode === ADMIN_ROLE_CODE &&
    !editingSelf
  const showGlobalAccess = Boolean(currentUser?.globalAccess) || globalAccess
  const isManager = roleCode === 'GERENTE'
  const showManagerSection = editing && Boolean(managedUser?.personnel) && isManager && canConfigureCommissions

  useEffect(() => {
    if (!currentUser) return
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    const userRequest: Promise<ManagedUser | null> = id
      ? gateway.getUser(id, controller.signal)
      : Promise.resolve(null)
    void userRequest
      .then((selectedUser) => {
        // Las sucursales válidas son las de la organización del usuario
        // editado, no las del administrador: un admin global que edita un
        // usuario de otra organización recibía un 400 del backend.
        const organizationId =
          selectedUser?.organization.id ?? currentUser.organization.id
        const requests: [
          Promise<{ items: ManagedRole[] }>,
          Promise<BranchOption[]>,
        ] = [
          gateway.listRoles({ page: 1, limit: 100 }, controller.signal),
          gateway.listBranches(organizationId, controller.signal),
        ]
        return Promise.all(requests).then(
          ([roleResult, branchResult]) =>
            [roleResult, branchResult, selectedUser] as const,
        )
      })
      .then(([roleResult, branchResult, selectedUser]) => {
        setRoles(roleResult.items)
        setBranches(branchResult)
        setManagedUser(selectedUser)
        setGlobalAccess(selectedUser?.globalAccess ?? false)
        setRoleCode(selectedUser?.role?.code ?? '')
        setBranchId(selectedUser?.branch?.id ?? '')
        setLoading(false)
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(accessErrorMessage(requestError))
        setLoading(false)
      })
    return () => controller.abort()
  }, [currentUser, gateway, id])

  useEffect(() => {
    if (!showManagerSection || !managedUser?.personnel) return
    const managerPersonnelId = managedUser.personnel.id
    const controller = new AbortController()
    setManagerConfigLoading(true)
    const policyLabel = (policy: { version: number; status: string }, vehicle: string) =>
      `${vehicle} · v${policy.version} (${
        policy.status === 'ACTIVE' ? 'activa' : policy.status === 'DRAFT' ? 'borrador' : 'inactiva'
      })`
    void Promise.all([
      commissionGateway.getManagerConfig
        ? commissionGateway.getManagerConfig(managerPersonnelId, controller.signal)
        : Promise.resolve(null),
      // Ambito GERENCIA specifically - the vendor scale catalog (the one
      // CommissionScalesPage's "Vendedores" tab manages) must never appear
      // as an option here.
      commissionGateway.listPolicies('MOTO', 'GERENCIA', controller.signal),
      commissionGateway.listPolicies('AUTO', 'GERENCIA', controller.signal),
    ])
      .then(([config, motoPolicies, autoPolicies]) => {
        setManagerPolicies([
          ...motoPolicies.items.map((policy) => ({ id: policy.id, label: policyLabel(policy, 'Motos') })),
          ...autoPolicies.items.map((policy) => ({ id: policy.id, label: policyLabel(policy, 'Autos') })),
        ])
        if (config) {
          setManagerMode(config.mode)
          setManagerPercentage(config.percentage ?? '')
          setManagerPolicyId(config.policyId ?? '')
          setManagerScope(config.scope)
          setManagerActive(config.active)
        }
        setManagerConfigLoading(false)
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setError(accessErrorMessage(requestError))
        setManagerConfigLoading(false)
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showManagerSection, managedUser, commissionGateway])

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
    setError('')
    setNotice('')
    if (editing && id && managedUser) {
      const changes = accessChanges(managedUser, {
        roleCode,
        branchId,
        globalAccess,
      })
      if (Object.keys(changes).length === 0) {
        setNotice('No hay cambios de acceso para guardar.')
        return
      }
      setSubmitting(true)
      try {
        const response = await gateway.updateUserAccess(id, changes)
        setManagedUser(response.user)
        setRoleCode(response.user.role?.code ?? '')
        setBranchId(response.user.branch?.id ?? '')
        setGlobalAccess(response.user.globalAccess)
        const sessionsMessage = editingSelf
          ? 'Cambiaste tu propio acceso: tus sesiones se cerraron y vas a tener que volver a ingresar.'
          : response.revokedSessions
            ? `Se cerraron ${response.revokedSessions} sesiones activas.`
            : 'No había sesiones activas.'
        const successMessage = `Acceso actualizado. ${sessionsMessage}`
        setNotice(successMessage)
        void alertSuccess(successMessage)
      } catch (submitError) {
        const message = accessErrorMessage(submitError)
        setError(message)
        void alertError(message)
      } finally {
        setSubmitting(false)
      }
      return
    }
    setSubmitting(true)
    try {
      const fullName = `${String(data.get('firstName') ?? '').trim()} ${String(data.get('lastName') ?? '').trim()}`.trim()
      const email = String(data.get('email') ?? '').trim().toLowerCase()
      const employeeCode = optional(data, 'employeeCode')
      const phone = optional(data, 'phone')
      await gateway.createUser({
        fullName,
        email,
        organizationId: currentUser.organization.id,
        roleCode,
        ...(branchId ? { branchId } : {}),
        ...(globalAccess ? { globalAccess: true } : {}),
        ...(employeeCode ? { employeeCode } : {}),
        ...(phone ? { phone } : {}),
      })
      setCreatedEmail(email)
      void alertSuccess('Usuario creado. Se envió la contraseña temporal por email.')
    } catch (submitError) {
      const message = accessErrorMessage(submitError)
      setError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const confirmAction = async () => {
    if (!managedUser || !confirmation) return
    setActionBusy(true)
    setError('')
    try {
      let successMessage = ''
      if (confirmation === 'status') {
        const response = await gateway.updateUserStatus(
          managedUser.id,
          !managedUser.active,
        )
        setManagedUser(response.user)
        successMessage = `Usuario ${response.user.active ? 'activado' : 'desactivado'}. ${response.revokedSessions ? `Se cerraron ${response.revokedSessions} sesiones.` : ''}`
        setNotice(successMessage)
      } else {
        await gateway.resendUserInvitation(managedUser.id)
        successMessage = `Invitación enviada a ${managedUser.email}. La contraseña temporal anterior quedó invalidada.`
        setNotice(successMessage)
      }
      setConfirmation(null)
      void alertSuccess(successMessage)
    } catch (actionError) {
      const message = accessErrorMessage(actionError)
      setError(message)
      setConfirmation(null)
      void alertError(message)
    } finally {
      setActionBusy(false)
    }
  }

  const saveManagerCommission = async () => {
    if (!managedUser?.personnel) return
    // The "Guardar comisión de gerencia" button lives outside the main
    // <form> (it is a plain type="button"), so the <select>/<input>
    // `required` attributes never get enforced by the browser - this is
    // the real validation gate. The backend rejects an empty policyId /
    // percentage too (INVALID_MANAGER_COMMISSION_CONFIG), but failing
    // fast here avoids a round-trip for a mistake we can already see.
    if (managerMode === 'ESCALA' && !managerPolicyId) {
      setError('Seleccioná una política de escala antes de guardar.')
      return
    }
    if (managerMode === 'PORCENTAJE' && !managerPercentage.trim()) {
      setError('Indicá un porcentaje antes de guardar.')
      return
    }
    setManagerSaving(true)
    setError('')
    setNotice('')
    try {
      const input: SaveManagerCommissionConfigInput =
        managerMode === 'PORCENTAJE'
          ? {
              mode: 'PORCENTAJE',
              percentage: managerPercentage,
              scope: managerScope,
              active: managerActive,
            }
          : {
              mode: 'ESCALA',
              policyId: managerPolicyId,
              scope: managerScope,
              active: managerActive,
            }
      if (commissionGateway.saveManagerConfig) {
        await commissionGateway.saveManagerConfig(managedUser.personnel.id, input)
      }
      const successMessage = 'Comisión de gerencia guardada.'
      setNotice(successMessage)
      void alertSuccess(successMessage)
    } catch (saveError) {
      const message = accessErrorMessage(saveError)
      setError(message)
      void alertError(message)
    } finally {
      setManagerSaving(false)
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
            <select
              disabled={editingSelf}
              name="roleCode"
              onChange={(event) => {
                const nextRole = event.target.value
                setRoleCode(nextRole)
                if (nextRole !== ADMIN_ROLE_CODE) setGlobalAccess(false)
              }}
              required
              value={roleCode}
            >
              <option value="" disabled>Seleccioná un rol</option>
              {visibleRoles.map((role) => <option key={role.id} value={role.code}>{role.name}{role.system ? ' · Rol base' : ''}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Sucursal{branchRequired ? ' *' : ''}</span>
            <select
              name="branchId"
              onChange={(event) => setBranchId(event.target.value)}
              required={branchRequired}
              value={branchId}
            >
              <option value="">{branchRequired ? 'Seleccioná una sucursal' : 'Sin sucursal asignada'}</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          {showGlobalAccess && (
            <label className="checkbox-field access-scope">
              <input
                checked={globalAccess}
                disabled={!canGrantGlobalAccess && !globalAccess}
                onChange={(event) => setGlobalAccess(event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>Acceso global (todas las organizaciones)</strong>
                <small>
                  {editingSelf
                    ? 'No podés modificar tu propio acceso global.'
                    : 'Sólo para el rol Administrador de Casa Central. Permite consultar y operar otras organizaciones.'}
                </small>
              </span>
            </label>
          )}
          {editingSelf && (
            <p className="field-hint">Estás editando tu propio usuario: podés cambiar tu sucursal, pero no tu rol ni tu acceso global.</p>
          )}
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
      {showManagerSection && (
        <div className="access-form-card">
          <header className="page-heading">
            <div>
              <h2>Comisión de gerencia</h2>
              <p>Configurá cómo cobra este gerente sobre las operaciones de su alcance. Es independiente de la comisión de vendedores.</p>
            </div>
          </header>
          {managerConfigLoading ? (
            <div className="access-loading"><div className="loading-mark" /><span>Cargando configuración…</span></div>
          ) : (
            <>
              <div className="access-form-grid">
                <fieldset className="field">
                  <legend>Modalidad de cálculo</legend>
                  <label className="checkbox-field">
                    <input
                      checked={managerMode === 'PORCENTAJE'}
                      name="managerMode"
                      onChange={() => setManagerMode('PORCENTAJE')}
                      type="radio"
                    />
                    <span>Porcentaje sobre el precio de cierre</span>
                  </label>
                  <label className="checkbox-field">
                    <input
                      checked={managerMode === 'ESCALA'}
                      name="managerMode"
                      onChange={() => setManagerMode('ESCALA')}
                      type="radio"
                    />
                    <span>Escala por cantidad de unidades (igual que vendedores)</span>
                  </label>
                </fieldset>
                {managerMode === 'PORCENTAJE' ? (
                  <label className="field">
                    <span>Porcentaje *</span>
                    <input
                      max={100}
                      min={0.01}
                      onChange={(event) => setManagerPercentage(event.target.value)}
                      required
                      step="0.01"
                      type="number"
                      value={managerPercentage}
                    />
                  </label>
                ) : managerPolicies.length === 0 ? (
                  <div className="commission-policy-missing" role="status">
                    <SlidersHorizontal size={22} />
                    <div>
                      <strong>Todavía no hay ninguna escala de gerencia creada</strong>
                      <span>
                        Las escalas de gerencia son un catálogo aparte del de vendedores. Creá una escala de
                        motos o de autos para poder asignarle esta comisión al gerente:{' '}
                        <Link to="/comisiones/escalas/gerencia/motos">crear escala de motos de gerencia</Link>
                        {' · '}
                        <Link to="/comisiones/escalas/gerencia/autos">crear escala de autos de gerencia</Link>.
                      </span>
                    </div>
                  </div>
                ) : (
                  <label className="field">
                    <span>Política de escala *</span>
                    <select
                      onChange={(event) => setManagerPolicyId(event.target.value)}
                      required
                      value={managerPolicyId}
                    >
                      <option value="" disabled>Seleccioná una política</option>
                      {managerPolicies.map((policy) => (
                        <option key={policy.id} value={policy.id}>{policy.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                <fieldset className="field">
                  <legend>Alcance</legend>
                  <label className="checkbox-field">
                    <input
                      checked={managerScope === 'SUCURSAL_PROPIA'}
                      name="managerScope"
                      onChange={() => setManagerScope('SUCURSAL_PROPIA')}
                      type="radio"
                    />
                    <span>Solo su sucursal</span>
                  </label>
                  <label className="checkbox-field">
                    <input
                      checked={managerScope === 'TODAS_LAS_SUCURSALES'}
                      name="managerScope"
                      onChange={() => setManagerScope('TODAS_LAS_SUCURSALES')}
                      type="radio"
                    />
                    <span>Todas las sucursales de la organización</span>
                  </label>
                </fieldset>
                <label className="checkbox-field">
                  <input
                    checked={managerActive}
                    onChange={(event) => setManagerActive(event.target.checked)}
                    type="checkbox"
                  />
                  <span><strong>Configuración activa</strong><small>Si se desactiva, deja de calcularse esta comisión sin perder los datos guardados.</small></span>
                </label>
              </div>
              <div className="access-form-actions">
                <div>
                  <button
                    className="button button--primary"
                    disabled={managerSaving}
                    onClick={() => void saveManagerCommission()}
                    type="button"
                  >
                    {managerSaving && <LoaderCircle className="spin" size={17} />}
                    {managerSaving ? 'Guardando…' : 'Guardar comisión de gerencia'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
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
