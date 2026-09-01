import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError, NetworkError } from '../../shared/api/client'
import { Brand } from '../../shared/components/Brand'
import { useAuth } from './AuthContext'
import { alertError, alertSuccess } from '../../shared/alerts'

const GENERIC_SUCCESS_MESSAGE =
  'Si el correo está registrado, te enviamos un mail con una contraseña temporal para que configures una nueva.'

function requestError(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return 'Se alcanzó el límite de intentos. Esperá cinco minutos antes de reintentar.'
    }
    if (error.status === 400) {
      return 'Ingresá un correo electrónico válido.'
    }
  }
  return 'No pudimos procesar el pedido. Intentá nuevamente.'
}

export function ForgotPasswordPage() {
  const { status, requestPasswordReset } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim().toLowerCase()

    try {
      await requestPasswordReset(email)
      setSent(true)
      void alertSuccess(GENERIC_SUCCESS_MESSAGE)
    } catch (submitError) {
      const message = requestError(submitError)
      setError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="forgot-password-title">
        <div className="login-card__brand">
          <Brand />
          <h1 id="forgot-password-title">Recuperar contraseña</h1>
          <p>Te mandamos una contraseña temporal por correo.</p>
        </div>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}
        {sent && (
          <div className="form-alert" role="status">
            {GENERIC_SUCCESS_MESSAGE}
          </div>
        )}

        {!sent && (
          <form onSubmit={submit}>
            <label className="field">
              <span>Correo electrónico</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                maxLength={255}
                required
                autoFocus
                placeholder="nombre@lumamotos.com.ar"
              />
            </label>
            <button
              className="button button--primary login-card__submit"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Enviando…' : 'Enviar contraseña temporal'}
            </button>
          </form>
        )}

        <Link className="login-card__forgot-password" to="/login">
          Volver al ingreso
        </Link>
      </section>
    </main>
  )
}
