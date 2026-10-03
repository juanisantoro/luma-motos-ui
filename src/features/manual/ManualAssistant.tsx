import { Send, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, NetworkError } from '../../shared/api/client'
import { useAuth } from '../auth/AuthContext'
import { askAssistant, type AssistantMessage } from './api'
import { hasManual } from './manuals'
import './manual-assistant.css'

// Lumi: el asistente virtual. Vive en el layout, así que está en todas las
// pantallas y la conversación sobrevive al cambiar de página. Responde con el
// manual del perfil; la API elige el manual por el rol de la sesión.

// La API acepta hasta 8 mensajes previos y 600 caracteres por pregunta.
const HISTORY_LIMIT = 8
const QUESTION_MAX_LENGTH = 600

// Perfiles sin manual propio a los que la API les responde con los manuales
// de todos los perfiles (ver assistant.manuals.ts en luma-motos-api).
const ALL_MANUALS_ROLES = new Set(['ADMINISTRADOR'])

export function hasAssistant(roleCode: string | undefined) {
  return Boolean(
    roleCode && (hasManual(roleCode) || ALL_MANUALS_ROLES.has(roleCode)),
  )
}

const SUGGESTIONS: Record<string, string[]> = {
  ADMINISTRATIVA: [
    '¿Cómo cargo la patente cuando llega?',
    '¿Cómo registro el cobro de una venta?',
    '¿Cómo cargo un gasto?',
  ],
  VENDEDOR: [
    '¿Cómo cargo una venta nueva?',
    '¿Qué significa cada estado de mis ventas?',
    '¿Cómo se calculan mis comisiones?',
  ],
  ADMINISTRADOR: [
    '¿Cómo carga una venta el vendedor?',
    '¿Cómo se le asigna una moto a una venta?',
    '¿Dónde se registra el pago de una patente?',
  ],
}

function errorMessage(error: unknown) {
  if (error instanceof NetworkError) return error.message
  if (error instanceof ApiError) {
    if (error.details?.code === 'ASSISTANT_NOT_CONFIGURED')
      return 'Lumi todavía no está habilitado. Mientras tanto, buscá la respuesta en el Manual de uso.'
    if (error.status === 429)
      return 'Hiciste muchas preguntas seguidas. Esperá un minuto y probá de nuevo.'
  }
  return 'No pude responder. Probá de nuevo en un momento.'
}

// La cara de Lumi es un faro de moto: aro oscuro, óptica cálida y dos ojos.
function LumiFace({ size }: { size: number }) {
  const lens = useId()
  return (
    <svg
      aria-hidden="true"
      className="lumi-face"
      height={size}
      viewBox="0 0 48 48"
      width={size}
    >
      <defs>
        <radialGradient cx="38%" cy="32%" id={lens} r="75%">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="0.55" stopColor="#ffc247" />
          <stop offset="1" stopColor="#f08a1c" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" fill="#20242b" r="23" />
      <circle cx="24" cy="24" fill="#3a404b" r="20.5" />
      <circle cx="24" cy="24" fill={`url(#${lens})`} r="17.5" />
      <path
        d="M11 20a14 14 0 0 1 12-10"
        fill="none"
        opacity="0.7"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <rect fill="#20242b" height="8" rx="2.2" width="4.4" x="16.4" y="19" />
      <rect fill="#20242b" height="8" rx="2.2" width="4.4" x="27.2" y="19" />
      <path
        d="M18.5 31.5q5.5 4 11 0"
        fill="none"
        stroke="#20242b"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </svg>
  )
}

export function ManualAssistant() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const roleCode = user?.role.code
  const trimmed = question.trim()

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [messages, loading, error, open])

  if (!user || !hasAssistant(roleCode)) return null

  const firstName = (user.name ?? '').trim().split(/\s+/)[0]
  const suggestions = SUGGESTIONS[roleCode ?? ''] ?? []

  async function ask(text: string) {
    const clean = text.trim()
    if (loading || clean.length < 3) return
    const history = messages.slice(-HISTORY_LIMIT)
    setMessages((current) => [...current, { role: 'user', content: clean }])
    setQuestion('')
    setError('')
    setLoading(true)
    try {
      const { answer } = await askAssistant(clean, history)
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: answer },
      ])
    } catch (caught) {
      // La pregunta sin respuesta se saca de la conversación y vuelve al
      // campo, para reintentar sin escribirla de nuevo.
      setMessages((current) => current.slice(0, -1))
      setQuestion(clean)
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void ask(question)
  }

  return (
    <div className={`lumi ${open ? 'lumi--open' : ''}`}>
      {open && (
        <section
          aria-label="Lumi, asistente virtual"
          className="lumi__panel"
          id={panelId}
          role="dialog"
        >
          <header className="lumi__head">
            <LumiFace size={44} />
            <div className="lumi__title">
              <strong>Lumi</strong>
              <small>Te ayudo a usar el sistema</small>
            </div>
            <button
              aria-label="Cerrar Lumi"
              className="lumi__close"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div aria-live="polite" className="lumi__body" ref={bodyRef}>
            <p className="lumi__bubble lumi__bubble--assistant">
              {firstName ? `Hola ${firstName}, soy Lumi.` : 'Hola, soy Lumi.'}{' '}
              Preguntame cómo hacer algo en el sistema y te lo explico paso a
              paso.
            </p>

            {messages.length === 0 && suggestions.length > 0 && (
              <div className="lumi__suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    disabled={loading}
                    key={suggestion}
                    onClick={() => void ask(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message, index) => (
              <p
                className={`lumi__bubble lumi__bubble--${message.role}`}
                key={index}
              >
                {message.content}
              </p>
            ))}

            {loading && (
              <p className="lumi__typing" role="status">
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span className="lumi__sr">Lumi está escribiendo…</span>
              </p>
            )}
            {error && (
              <p className="lumi__error" role="alert">
                {error}
              </p>
            )}
          </div>

          <form className="lumi__form" onSubmit={submit}>
            <input
              aria-label="Tu pregunta para Lumi"
              maxLength={QUESTION_MAX_LENGTH}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Escribí tu pregunta"
              ref={inputRef}
              value={question}
            />
            <button
              aria-label="Enviar pregunta"
              disabled={loading || trimmed.length < 3}
              type="submit"
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="lumi__note">
            Respondo con el manual de uso. No veo tus datos.
          </p>
        </section>
      )}

      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-label={open ? 'Cerrar Lumi' : 'Abrir Lumi, asistente virtual'}
        className="lumi__launcher"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <LumiFace size={40} />
        <span>Preguntale a Lumi</span>
      </button>
    </div>
  )
}
