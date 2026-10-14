import { AUTH_TOKEN_KEY, apiRequest } from './client'

// Avisa a la API (que lo deja en el log como "ui-validation") cuando un
// formulario no dejó guardar: así se puede revisar después por qué un
// usuario no pudo cargar algo, aunque el pedido nunca haya salido.
// No bloquea ni muestra nada: si falla, se ignora.
export function reportValidationBlock(
  screen: string,
  messages: Record<string, string | undefined>,
  data: Record<string, unknown>,
) {
  let token: string | null = null
  try {
    token = sessionStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return
  }
  if (!token) return
  void apiRequest<void>('/client-logs', {
    method: 'POST',
    token,
    body: { kind: 'VALIDATION', screen, messages, data },
  }).catch(() => undefined)
}
