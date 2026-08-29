import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  AUTH_TOKEN_KEY,
  ApiError,
  UNAUTHORIZED_EVENT,
} from '../../shared/api/client'
import { getCurrentUser, loginRequest, logoutRequest } from './api'
import type { AuthStatus, AuthUser, LoginCredentials } from './types'

type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  notice: string | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  retrySession: () => Promise<void>
  clearNotice: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function storedToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    storedToken() ? 'loading' : 'unauthenticated',
  )
  const [user, setUser] = useState<AuthUser | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const clearSession = useCallback((message?: string) => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    setUser(null)
    setStatus('unauthenticated')
    setNotice(message ?? null)
  }, [])

  const restoreSession = useCallback(
    async (signal?: AbortSignal) => {
      const token = storedToken()
      if (!token) {
        setStatus('unauthenticated')
        return
      }

      setStatus('loading')
      try {
        const currentUser = await getCurrentUser(token, signal)
        setUser(currentUser)
        setStatus('authenticated')
      } catch (error) {
        if (signal?.aborted) return
        if (error instanceof ApiError && error.status === 401) {
          clearSession('Tu sesión venció. Ingresá nuevamente.')
          return
        }
        setStatus('error')
      }
    },
    [clearSession],
  )

  useEffect(() => {
    const controller = new AbortController()
    if (storedToken()) void restoreSession(controller.signal)
    return () => controller.abort()
  }, [restoreSession])

  useEffect(() => {
    const handleUnauthorized = () =>
      clearSession('Tu sesión venció. Ingresá nuevamente.')
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () =>
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [clearSession])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await loginRequest(credentials)
    sessionStorage.setItem(AUTH_TOKEN_KEY, response.accessToken)
    setUser(response.user)
    setNotice(null)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    const token = storedToken()
    let remoteLogoutFailed = false
    try {
      if (token) await logoutRequest(token)
    } catch {
      remoteLogoutFailed = true
    } finally {
      clearSession(
        remoteLogoutFailed
          ? 'La sesión se cerró en este dispositivo, pero no se pudo contactar al servidor.'
          : 'Sesión cerrada correctamente.',
      )
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      notice,
      login,
      logout,
      retrySession: () => restoreSession(),
      clearNotice: () => setNotice(null),
    }),
    [login, logout, notice, restoreSession, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.')
  }
  return context
}
