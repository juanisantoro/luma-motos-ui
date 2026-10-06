const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(
  /\/+$/,
  '',
)

// The API mounts uploaded catalog photos as plain static files outside its
// '/api' prefix, so building an <img> URL needs the bare origin instead.
const API_ORIGIN = API_URL.replace(/\/api$/, '')

export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

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
      // Every response here is per-tenant, authenticated JSON that changes
      // often. Never let the browser's HTTP cache serve or revalidate it -
      // a stale 304 with no body has caused blank screens (e.g. stock).
      cache: 'no-store',
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

// For endpoints that receive a file (multipart/form-data) instead of JSON -
// e.g. uploading a catalog photo. Deliberately does not go through
// apiRequest: that helper always JSON-encodes its body.
export async function apiUpload<T>(
  path: `/${string}`,
  file: File,
  fieldName: string,
  { token, signal }: { token?: string | null; signal?: AbortSignal } = {},
): Promise<T> {
  const formData = new FormData()
  formData.append(fieldName, file)
  const requestHeaders = new Headers()
  requestHeaders.set('Accept', 'application/json')
  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: requestHeaders,
      body: formData,
      cache: 'no-store',
      ...(signal ? { signal } : {}),
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

  return (await response.json()) as T
}
