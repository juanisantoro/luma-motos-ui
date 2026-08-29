import { LockKeyhole, MapPinOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'

export function ForbiddenPage() {
  return (
    <StatePanel
      icon={LockKeyhole}
      title="No tenés permiso para ingresar"
      description="Tu sesión es válida, pero el backend no asignó el permiso necesario para este módulo."
      tone="danger"
      action={
        <Link className="button button--secondary" to="/">
          Volver al inicio
        </Link>
      }
    />
  )
}

export function NotFoundPage() {
  return (
    <StatePanel
      icon={MapPinOff}
      title="No encontramos esta página"
      description="La dirección puede ser incorrecta o el módulo ya no está disponible."
      action={
        <Link className="button button--secondary" to="/">
          Volver al inicio
        </Link>
      }
    />
  )
}
