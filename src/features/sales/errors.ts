import { ApiError, NetworkError } from '../../shared/api/client'

export function salesErrorMessage(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'La operación no es válida en su estado actual o contiene datos incorrectos.'
    }
    if (error.status === 403) {
      return 'No tenés permiso para realizar esta acción.'
    }
    if (error.status === 404) {
      return 'La operación o uno de sus datos relacionados ya no está disponible.'
    }
    if (error.status === 409) {
      return 'La operación cambió o la unidad ya fue reservada. Actualizá los datos e intentá nuevamente.'
    }
    return error.message
  }
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}
