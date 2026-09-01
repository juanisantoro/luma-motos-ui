import { Check, Eye, EyeOff, LoaderCircle, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ApiError, NetworkError } from '../../shared/api/client'
import { Brand } from '../../shared/components/Brand'
import { useAuth } from './AuthContext'
import { alertError } from '../../shared/alerts'

const rules = [
  { label: '12 caracteres como mínimo', test: (value: string) => value.length >= 12 },
  { label: 'Una letra mayúscula', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Una letra minúscula', test: (value: string) => /[a-z]/.test(value) },
  { label: 'Un número', test: (value: string) => /\d/.test(value) },
  {
    label: 'Un carácter especial',
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
]

function changePasswordError(error: unknown) {
  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.'
  }
  if (error instanceof ApiError) {
    if (error.details?.code === 'TEMPORARY_PASSWORD_EXPIRED') {
      return 'La contraseña temporal venció. Pedile a un administrador que reenvíe la invitación.'
    }
    if (error.details?.code === 'PASSWORD_POLICY_VIOLATION') {
      return 'La nueva contraseña no cumple la política de seguridad.'
    }
    if (
      error.details?.code === 'INVALID_TEMPORARY_CREDENTIALS' ||
      error.details?.code === 'TEMPORARY_PASSWORD_ALREADY_USED'
    ) {
      return 'El acceso temporal ya no es válido. Volvé a ingresar o solicitá una nueva invitación.'
    }
  }
  return 'No pudimos configurar la contraseña. Intentá nuevamente.'
}

export function InitialPasswordPage() {
  const {
    status,
    temporaryPasswordChallenge,
    completeTemporaryPassword,
    cancelTemporaryPasswordChange,
  } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const passedRules = useMemo(
    () => rules.filter((rule) => rule.test(password)).length,
    [password],
  )

  if (status !== 'password-change-required' || !temporaryPasswordChallenge) {
    return <Navigate to="/login" replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (passedRules !== rules.length) {
      setError('Completá todas las reglas de seguridad.')
      return
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    try {
      await completeTemporaryPassword(password)
    } catch (submitError) {
      const message = changePasswordError(submitError)
      setError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card password-card" aria-labelledby="password-title">
        <div className="login-card__brand">
          <Brand />
          <h1 id="password-title">Configurá tu contraseña</h1>
          <p>Este paso es obligatorio antes de ingresar al sistema.</p>
        </div>
        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}
        <dl className="challenge-summary">
          <div>
            <dt>Organización</dt>
            <dd>{temporaryPasswordChallenge.organizationCode}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{temporaryPasswordChallenge.email}</dd>
          </div>
        </dl>
        <form onSubmit={submit}>
          <label className="field">
            <span>Nueva contraseña</span>
            <span className="password-input">
              <input
                autoComplete="new-password"
                autoFocus
                maxLength={128}
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                required
                type={visible ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setVisible((current) => !current)}
                type="button"
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <div className="password-strength" aria-live="polite">
            <span>
              Seguridad: {passedRules < 3 ? 'Baja' : passedRules < 5 ? 'Media' : 'Alta'}
            </span>
            <div>
              {rules.map((rule, index) => (
                <i
                  className={index < passedRules ? 'password-strength__passed' : ''}
                  key={rule.label}
                />
              ))}
            </div>
          </div>
          <ul className="password-rules">
            {rules.map((rule) => {
              const passed = rule.test(password)
              return (
                <li className={passed ? 'password-rule--passed' : ''} key={rule.label}>
                  {passed ? <Check size={15} /> : <X size={15} />}
                  {rule.label}
                </li>
              )
            })}
          </ul>
          <label className="field">
            <span>Confirmar nueva contraseña</span>
            <input
              autoComplete="new-password"
              maxLength={128}
              minLength={12}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type={visible ? 'text' : 'password'}
              value={confirmation}
            />
          </label>
          <button
            className="button button--primary login-card__submit"
            disabled={submitting}
            type="submit"
          >
            {submitting && <LoaderCircle className="spin" size={18} />}
            {submitting ? 'Configurando…' : 'Configurar contraseña'}
          </button>
          <button
            className="button password-card__cancel"
            disabled={submitting}
            onClick={cancelTemporaryPasswordChange}
            type="button"
          >
            Volver al ingreso
          </button>
        </form>
      </section>
    </main>
  )
}
