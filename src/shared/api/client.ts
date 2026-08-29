const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(
  /\/+$/,
  '',
)

export const AUTH_TOKEN_KEY = 'luma.auth.token'
export const UNAUTHORIZED_EVENT = 'luma:unauthorized'

export type ApiErrorPayload = {
  message?: string | string[]
  error?: string
  code?: string
  details?: Record<string, unknown>
}

export class ApiError extends Error {
  readonly status: number
  readonly details?: ApiErrorPayload

  constructor(status: number, message: string, details?: ApiErrorPayload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    if (details !== undefined) {
      this.details = details
    }
  }
}

export class NetworkError extends Error {
  constructor() {
    super('No se pudo conectar con el servidor.')
    this.name = 'NetworkError'
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  token?: string | null
}

function payloadMessage(payload: ApiErrorPayload | undefined, fallback: string) {
  if (Array.isArray(payload?.message)) {
    return payload.message.join(' ')
  }
  return payload?.message ?? fallback
}

export async function apiRequest<T>(
  path: `/${string}`,
  { body, token, headers, ...options }: RequestOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')

  if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json')
  }
  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: requestHeaders,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new NetworkError()
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      | ApiErrorPayload
      | undefined

    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    }

    throw new ApiError(
      response.status,
      payloadMessage(payload, `La solicitud falló (${response.status}).`),
      payload,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
