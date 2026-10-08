import type { ExcelColumn } from '../../shared/export/excel'
import { managedUserName } from './components'
import type { InvitationStatus, ManagedRole, ManagedUser, PermissionGroup } from './types'

export const invitationLabels: Record<InvitationStatus, string> = {
  PENDING: 'Pendiente',
  DELIVERED: 'Enviada',
  FAILED: 'Fallida',
  ACCEPTED: 'Aceptada',
  EXPIRED: 'Vencida',
}

// Columnas del Excel de Usuarios: las de la grilla, con el email aparte.
export const userExcelColumns: Array<ExcelColumn<ManagedUser>> = [
  { header: 'Usuario', value: (row) => managedUserName(row) },
  { header: 'Email', value: (row) => row.email },
  { header: 'Sucursal', value: (row) => row.branch?.name ?? 'Todas' },
  { header: 'Rol', value: (row) => row.role?.name ?? 'Sin rol' },
  { header: 'Estado', value: (row) => (row.active ? 'Activo' : 'Inactivo') },
  { header: 'Invitación', value: (row) => invitationLabels[row.invitation.status] },
  { header: 'Último acceso', value: (row) => row.lastLoginAt, type: 'datetime' },
]

/** Módulos con al menos un permiso del rol (la grilla muestra los 3 primeros). */
export function roleModules(role: ManagedRole, groups: PermissionGroup[]) {
  return groups
    .filter((group) =>
      group.permissions.some((permission) =>
        role.permissions.some(({ code }) => code === permission.code),
      ),
    )
    .map((group) => group.label)
}

// Columnas del Excel de Roles: las de la grilla, con el código y todos los
// módulos del rol.
export function roleExcelColumns(groups: PermissionGroup[]): Array<ExcelColumn<ManagedRole>> {
  return [
    { header: 'Rol', value: (row) => row.name },
    { header: 'Código', value: (row) => row.code },
    { header: 'Rol base', value: (row) => row.system },
    { header: 'Descripción', value: (row) => row.description || 'Sin descripción' },
    { header: 'Usuarios', value: (row) => row.userCount, type: 'integer' },
    { header: 'Estado', value: (row) => (row.active ? 'Activo' : 'Inactivo') },
    { header: 'Permisos', value: (row) => row.permissions.length, type: 'integer' },
    { header: 'Módulos', value: (row) => roleModules(row, groups).join(', ') || 'Sin permisos' },
  ]
}
