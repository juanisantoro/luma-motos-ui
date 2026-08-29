import { ApiError, NetworkError } from '../../shared/api/client'

const messages: Record<string, string> = {
  INVALID_PERMISSION_CODES:
    'La selección contiene permisos que ya no existen. Actualizá el catálogo e intentá nuevamente.',
  ROLE_CODE_ALREADY_EXISTS: 'Ya existe un rol con ese código.',
  ROLE_NAME_ALREADY_EXISTS: 'Ya existe un rol con ese nombre.',
  ROLE_INACTIVE: 'El rol seleccionado está inactivo.',
  ROLE_HAS_ACTIVE_USERS:
    'No se puede desactivar el rol mientras tenga usuarios activos asignados.',
  SYSTEM_ROLE_PROTECTED: 'Este rol base está protegido y no admite esa modificación.',
  LAST_ACTIVE_ADMIN:
    'La acción dejaría a la organización sin un administrador activo.',
  SELF_ADMIN_ACCESS_CHANGE_FORBIDDEN:
    'No podés quitarte tu propio acceso administrativo.',
  CROSS_TENANT_ACCESS:
    'El usuario, rol o sucursal no pertenece a tu organización.',
  INVITATION_DELIVERY_FAILED:
    'El usuario fue procesado, pero no se pudo entregar la invitación. Revisá el correo y reintentá el envío.',
  VERSION_CONFLICT:
    'El rol fue modificado por otra persona. Recargá la información antes de guardar.',
}

export function accessErrorMessage(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    const code = error.details?.code
    if (code && messages[code]) return messages[code]
    if (error.status === 400) return 'Revisá los datos ingresados.'
    if (error.status === 403) return 'No tenés permiso para realizar esta acción.'
    if (error.status === 404) return 'El recurso solicitado ya no está disponible.'
    if (error.status === 409) return 'La acción entra en conflicto con el estado actual.'
  }
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}
