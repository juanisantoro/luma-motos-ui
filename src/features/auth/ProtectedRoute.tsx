import { RotateCw, ServerOff } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { status, retrySession } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <main className="centered-page" aria-live="polite">
        <div className="loading-mark" />
        <p>Restaurando sesión…</p>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="centered-page">
        <StatePanel
          icon={ServerOff}
          title="No pudimos validar tu sesión"
          description="El servidor no está disponible. Tu sesión local sigue guardada para poder reintentar."
          tone="danger"
          action={
            <button
              className="button button--primary"
              onClick={() => void retrySession()}
              type="button"
            >
              <RotateCw size={17} aria-hidden="true" />
              Reintentar
            </button>
          }
        />
      </main>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
