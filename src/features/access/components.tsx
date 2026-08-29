import { NavLink } from 'react-router-dom'
import { LoaderCircle, X } from 'lucide-react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import type { ManagedUser } from './types'

export function AccessTabs() {
  const { user } = useAuth()
  const canViewUsers = hasPermission(
    user?.role.permissions,
    'usuarios.consultar',
  )
  const canViewRoles = hasPermission(user?.role.permissions, 'roles.consultar')
  return (
    <nav className="access-tabs" aria-label="Usuarios y permisos">
      {canViewUsers && (
        <NavLink
          className={({ isActive }) =>
            `access-tab ${isActive ? 'access-tab--active' : ''}`
          }
          end
          to="/usuarios"
        >
          Usuarios
        </NavLink>
      )}
      {canViewRoles && (
        <NavLink
          className={({ isActive }) =>
            `access-tab ${isActive ? 'access-tab--active' : ''}`
          }
          to="/usuarios/roles"
        >
          Roles y permisos
        </NavLink>
      )}
    </nav>
  )
}

export function AccessNotice({
  message,
  tone = 'success',
  onClose,
}: {
  message: string
  tone?: 'success' | 'error'
  onClose?: () => void
}) {
  return (
    <div
      className={`access-notice access-notice--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} type="button">
          Cerrar
        </button>
      )}
    </div>
  )
}

export function formatAccessDate(value: string | null) {
  if (!value) return 'Nunca'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function managedUserName(user: ManagedUser) {
  return user.personnel?.fullName ?? user.email
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  busy: boolean
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useDialogFocus(onCancel, busy)
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="access-confirm"
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="access-confirm-title"
        aria-describedby="access-confirm-description"
      >
        <header>
          <h2 id="access-confirm-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Cerrar confirmación"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            <X size={20} />
          </button>
        </header>
        <p id="access-confirm-description">{description}</p>
        <footer>
          <button
            className="button button--secondary"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className={`button ${danger ? 'button--danger' : 'button--primary'}`}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy && <LoaderCircle className="spin" size={17} />}
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
