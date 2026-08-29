import { ApiError, NetworkError } from '../../shared/api/client'

export function clientsErrorMessage(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'Revisá los datos ingresados antes de continuar.'
    }
    if (error.status === 403) {
      return 'No tenés permiso para realizar esta acción.'
    }
    if (error.status === 404) {
      return 'El cliente no existe o no pertenece a tu organización.'
    }
    if (error.status === 409) {
      return 'Ya existe un cliente con ese documento en la organización.'
    }
  }
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}
