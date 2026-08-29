import { useState, type FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { ApiError, NetworkError } from '../../shared/api/client'
import { Brand } from '../../shared/components/Brand'
import { useAuth } from './AuthContext'

function loginError(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Los datos ingresados no son válidos.'
    }
    if (error.status === 429) {
      return 'Se alcanzó el límite de intentos. Esperá cinco minutos antes de reintentar.'
    }
    if (error.status === 400) {
      return 'Revisá los datos ingresados.'
    }
  }
  return 'No pudimos iniciar sesión. Intentá nuevamente.'
}

export function LoginPage() {
  const { status, login, notice, clearNotice } = useAuth()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'authenticated') {
    const destination =
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
      '/'
    return <Navigate to={destination} replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    clearNotice()
    const data = new FormData(event.currentTarget)

    try {
      await login({
        organizationCode: String(data.get('organizationCode') ?? '')
          .trim()
          .toUpperCase(),
        email: String(data.get('email') ?? '').trim().toLowerCase(),
        password: String(data.get('password') ?? ''),
      })
    } catch (submitError) {
      setError(loginError(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card__brand">
          <Brand />
          <h1 id="login-title">Ingresá a tu cuenta</h1>
          <p>Sistema integral de gestión comercial</p>
        </div>

        {(error || notice) && (
          <div
            className={error ? 'form-alert form-alert--error' : 'form-alert'}
            role={error ? 'alert' : 'status'}
          >
            {error ?? notice}
          </div>
        )}

        <form onSubmit={submit}>
          <label className="field">
            <span>Organización</span>
            <input
              name="organizationCode"
              autoComplete="organization"
              maxLength={40}
              required
              autoFocus
              placeholder="LUMA"
            />
          </label>
          <label className="field">
            <span>Correo electrónico</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              maxLength={255}
              required
              placeholder="nombre@lumamotos.com.ar"
            />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={1}
              maxLength={128}
              required
            />
          </label>
          <button
            className="button button--primary login-card__submit"
            disabled={submitting}
            type="submit"
          >
            {submitting && (
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
            )}
            {submitting ? 'Ingresando…' : 'Ingresar al sistema'}
          </button>
        </form>
      </section>
    </main>
  )
}
