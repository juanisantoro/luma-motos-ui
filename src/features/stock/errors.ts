import { ApiError, NetworkError } from '../../shared/api/client'

export function stockErrorMessage(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'La acción no es válida en el estado actual o contiene datos incorrectos.'
    }
    if (error.status === 403) {
      return 'No tenés permiso para realizar esta acción.'
    }
    if (error.status === 404) {
      return 'El registro ya no existe o no está disponible para tu organización.'
    }
    if (error.status === 409) {
      return 'El VIN, nombre o recepción ya fue registrado. Actualizá los datos e intentá nuevamente.'
    }
    return error.message
  }
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}

