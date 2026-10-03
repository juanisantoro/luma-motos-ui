import { BookOpen, LoaderCircle } from 'lucide-react'
import { useEffect, useState, type SyntheticEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { StatePanel } from '../../shared/components/StatePanel'
import { loadManual, manualsForRole } from './manuals'

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
  // El Administrador puede leer los manuales de todos los perfiles; el resto
  // sólo el propio.
  const manuals = manualsForRole(roleCode)
  const available = manuals.length > 0
  const [selectedCode, setSelectedCode] = useState(roleCode ?? '')
  const selected =
    manuals.find((manual) => manual.code === selectedCode) ?? manuals[0]
  const manualCode = selected?.code
  const [state, setState] = useState<ManualState>({ status: 'loading' })

  useEffect(() => {
    if (!manualCode) return
    let cancelled = false
    setState({ status: 'loading' })
    loadManual(manualCode)
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
  }, [manualCode])

  if (!available)
    return (
      <StatePanel
        icon={BookOpen}
        title="Todavía no hay un manual para tu perfil"
        description={`El manual de uso del perfil ${roleName} todavía no está cargado. Consultá a un administrador.`}
      />
    )

  const tabs =
    manuals.length > 1 ? (
      <div
        aria-label="Manuales por perfil"
        role="tablist"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
      >
        {manuals.map((manual) => (
          <button
            aria-selected={manual.code === manualCode}
            className={`button ${manual.code === manualCode ? 'button--primary' : 'button--secondary'}`}
            key={manual.code}
            onClick={() => setSelectedCode(manual.code)}
            role="tab"
            type="button"
          >
            {manual.label}
          </button>
        ))}
      </div>
    ) : null

  if (state.status === 'error')
    return (
      <>
        {tabs}
        <StatePanel
          icon={BookOpen}
          title="No pudimos cargar el manual"
          description="Revisá tu conexión y volvé a entrar a esta pantalla."
          tone="danger"
        />
      </>
    )

  if (state.status === 'loading')
    return (
      <>
        {tabs}
        <p role="status">
          <LoaderCircle className="spin" size={18} aria-hidden="true" />{' '}
          Cargando manual…
        </p>
      </>
    )

  return (
    <>
      {tabs}
      <iframe
        onLoad={handleAnchors}
        srcDoc={state.html}
        style={{
          display: 'block',
          width: '100%',
          height: `calc(100dvh - ${tabs ? 185 : 130}px)`,
          minHeight: 480,
          border: '1px solid var(--border, #e7e2e3)',
          borderRadius: 12,
          background: '#ffffff',
        }}
        title={`Manual de uso · ${selected?.label ?? roleName}`}
      />
    </>
  )
}
