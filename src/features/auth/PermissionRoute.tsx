import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function hasPermission(
  permissions: readonly string[] | undefined,
  required: string,
) {
  return permissions?.includes(required) ?? false
}

export function PermissionRoute({
  permission,
  anyOf,
}: {
  permission?: string
  anyOf?: string[]
}) {
  const { user } = useAuth()
  const allowed = permission
    ? hasPermission(user?.role.permissions, permission)
    : anyOf?.some((candidate) =>
        hasPermission(user?.role.permissions, candidate),
      ) ?? false
  return allowed ? (
    <Outlet />
  ) : (
    <Navigate to="/sin-permiso" replace />
  )
}
