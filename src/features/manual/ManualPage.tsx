import { BookOpen, LoaderCircle } from 'lucide-react'
import { useEffect, useState, type SyntheticEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { StatePanel } from '../../shared/components/StatePanel'
import { hasManual, loadManual } from './manuals'

type ManualState =
  | { status: 'loading' }
  | { status: 'ready'; html: string }
  | { status: 'error' }

// Dentro de un iframe con srcDoc los enlaces "#capitulo" se resuelven contra
// la URL de la app y la recargarían adentro del marco: se resuelven a mano.
function handleAnchors(event: SyntheticEvent<HTMLIFrameElement>) {
  const frameDocument = event.currentTarget.contentDocument
  if (!frameDocument) return
  frameDocument.addEventListener('click', (click) => {
    const target = click.target
    if (!(target instanceof frameDocument.defaultView!.Element)) return
    const link = target.closest('a')
    const href = link?.getAttribute('href') ?? ''
    if (!href.startsWith('#')) return
    click.preventDefault()
    frameDocument.getElementById(href.slice(1))?.scrollIntoView()
  })
}

export function ManualPage() {
  const { user } = useAuth()
  const roleCode = user?.role.code
  const roleName = user?.role.name ?? ''
  const available = hasManual(roleCode)
  const [state, setState] = useState<ManualState>({ status: 'loading' })

  useEffect(() => {
    if (!roleCode || !available) return
    let cancelled = false
    setState({ status: 'loading' })
    loadManual(roleCode)
      .then((html) => {
        if (cancelled) return
        setState(html ? { status: 'ready', html } : { status: 'error' })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [available, roleCode])

  if (!available)
    return (
      <StatePanel
        icon={BookOpen}
        title="Todavía no hay un manual para tu perfil"
        description={`El manual de uso del perfil ${roleName} todavía no está cargado. Consultá a un administrador.`}
      />
    )

  if (state.status === 'error')
    return (
      <StatePanel
        icon={BookOpen}
        title="No pudimos cargar el manual"
        description="Revisá tu conexión y volvé a entrar a esta pantalla."
        tone="danger"
      />
    )

  if (state.status === 'loading')
    return (
      <p role="status">
        <LoaderCircle className="spin" size={18} aria-hidden="true" /> Cargando
        manual…
      </p>
    )

  return (
    <iframe
      onLoad={handleAnchors}
      srcDoc={state.html}
      style={{
        display: 'block',
        width: '100%',
        height: 'calc(100dvh - 130px)',
        minHeight: 480,
        border: '1px solid var(--border, #e7e2e3)',
        borderRadius: 12,
        background: '#ffffff',
      }}
      title={`Manual de uso · ${roleName}`}
    />
  )
}
