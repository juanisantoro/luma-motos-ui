import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function hasPermission(
  permissions: readonly string[] | undefined,
  required: string,
) {
  return permissions?.includes(required) ?? false
}

export function PermissionRoute({ permission }: { permission: string }) {
  const { user } = useAuth()
  return hasPermission(user?.role.permissions, permission) ? (
    <Outlet />
  ) : (
    <Navigate to="/sin-permiso" replace />
  )
}
