import { ApiError, NetworkError } from '../../shared/api/client'

export function creditInquiryErrorMessage(error: unknown) {
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
      return 'El antecedente solicitado ya no está disponible.'
    }
    if (error.status === 409) {
      return 'La solicitud entra en conflicto con un registro existente.'
    }
  }
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}

export function isForbiddenError(error: unknown) {
  return error instanceof ApiError && error.status === 403
}

