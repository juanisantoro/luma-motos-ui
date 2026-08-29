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
import {
  changeTemporaryPasswordRequest,
  getCurrentUser,
  loginRequest,
  logoutRequest,
} from './api'
import type {
  AuthStatus,
  AuthUser,
  LoginCredentials,
  LoginResult,
  TemporaryPasswordChallenge,
} from './types'

type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  temporaryPasswordChallenge: TemporaryPasswordChallenge | null
  notice: string | null
  login: (credentials: LoginCredentials) => Promise<LoginResult>
  completeTemporaryPassword: (newPassword: string) => Promise<void>
  cancelTemporaryPasswordChange: () => void
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
  const [temporaryPasswordChallenge, setTemporaryPasswordChallenge] =
    useState<TemporaryPasswordChallenge | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const clearSession = useCallback((message?: string) => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    setUser(null)
    setTemporaryPasswordChallenge(null)
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

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResult> => {
      try {
        const response = await loginRequest(credentials)
        sessionStorage.setItem(AUTH_TOKEN_KEY, response.accessToken)
        setTemporaryPasswordChallenge(null)
        setUser(response.user)
        setNotice(null)
        setStatus('authenticated')
        return 'authenticated'
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.details?.code === 'PASSWORD_CHANGE_REQUIRED'
        ) {
          const details = error.details.details
          setTemporaryPasswordChallenge({
            organizationCode:
              typeof details?.organizationCode === 'string'
                ? details.organizationCode
                : credentials.organizationCode,
            email:
              typeof details?.email === 'string' ? details.email : credentials.email,
            temporaryPassword: credentials.password,
            expiresAt:
              typeof details?.expiresAt === 'string' ? details.expiresAt : null,
          })
          setUser(null)
          setNotice(null)
          setStatus('password-change-required')
          return 'password-change-required'
        }
        throw error
      }
    },
    [],
  )

  const completeTemporaryPassword = useCallback(
    async (newPassword: string) => {
      if (!temporaryPasswordChallenge) {
        throw new Error('No hay un cambio de contraseña pendiente.')
      }
      await changeTemporaryPasswordRequest({
        organizationCode: temporaryPasswordChallenge.organizationCode,
        email: temporaryPasswordChallenge.email,
        temporaryPassword: temporaryPasswordChallenge.temporaryPassword,
        newPassword,
      })
      setTemporaryPasswordChallenge(null)
      setStatus('unauthenticated')
      setNotice('Contraseña configurada. Ya podés ingresar con tu nueva contraseña.')
    },
    [temporaryPasswordChallenge],
  )

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
      temporaryPasswordChallenge,
      notice,
      login,
      completeTemporaryPassword,
      cancelTemporaryPasswordChange: () => clearSession(),
      logout,
      retrySession: () => restoreSession(),
      clearNotice: () => setNotice(null),
    }),
    [
      completeTemporaryPassword,
      clearSession,
      login,
      logout,
      notice,
      restoreSession,
      status,
      temporaryPasswordChallenge,
      user,
    ],
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
