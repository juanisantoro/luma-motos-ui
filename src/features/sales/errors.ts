import { ApiError, NetworkError } from '../../shared/api/client'
import { branchScopeErrorMessage } from '../auth/branchScope'
import { apiErrorReason } from './apiErrorText'

export function salesErrorMessage(error: unknown) {
  const branchScopeMessage = branchScopeErrorMessage(error)
  if (branchScopeMessage) return branchScopeMessage
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    // El motivo que da el servidor, en castellano, para saber qué dato falló
    // cuando lo reportan con una captura.
    const reason = apiErrorReason(error)
    if (error.status === 400) {
      const code = error.details?.code
      const detail = reason ?? (code ? `Código: ${code}.` : '')
      return `La operación no es válida en su estado actual o contiene datos incorrectos.${detail ? ` Motivo: ${detail}` : ''}`
    }
    if (error.status === 403) {
      return 'No tenés permiso para realizar esta acción.'
    }
    if (error.status === 404) {
      return 'La operación o uno de sus datos relacionados ya no está disponible.'
    }
    if (error.status === 409) {
      if (reason) return reason
      return 'La operación cambió o la unidad ya fue reservada. Actualizá los datos e intentá nuevamente.'
    }
    if (error.status >= 500) {
      return 'Ocurrió un error en el servidor. Quedó registrado para revisarlo; intentá nuevamente en unos minutos.'
    }
    return reason ?? error.message
  }
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}
