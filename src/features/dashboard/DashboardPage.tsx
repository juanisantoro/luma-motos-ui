import { LayoutDashboard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { alertError } from '../../shared/alerts'
import { ApiError, NetworkError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { getDashboardHome } from './api'
import { AdminDashboard } from './AdminDashboard'
import { AdministrativeDashboard } from './AdministrativeDashboard'
import { ManagerDashboard } from './ManagerDashboard'
import { SellerDashboard } from './SellerDashboard'
import type { DashboardHome } from './types'

function dashboardErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof NetworkError) return error.message
  return 'No pudimos cargar tu inicio. Intentá nuevamente.'
}

export function DashboardPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [home, setHome] = useState<DashboardHome | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getDashboardHome(controller.signal)
      .then((result) => {
        setHome(result)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setStatus('error')
        void alertError(dashboardErrorMessage(error), 'No se pudo cargar el inicio')
      })
    return () => controller.abort()
  }, [])

  if (status === 'loading') {
    return (
      <StatePanel
        icon={LayoutDashboard}
        title="Cargando tu inicio…"
        description="Estamos preparando la información de tu rol."
      />
    )
  }

  if (status === 'error' || !home) {
    return (
      <StatePanel
        icon={LayoutDashboard}
        title="No pudimos cargar tu inicio"
        description="Revisá tu conexión e intentá nuevamente."
        tone="danger"
      />
    )
  }

  switch (home.role) {
    case 'ADMINISTRADOR':
      return <AdminDashboard home={home} />
    case 'GERENTE':
      return 'monthlySales' in home ? (
        <ManagerDashboard home={home} />
      ) : (
        <StatePanel
          icon={LayoutDashboard}
          title={`Hola, ${home.greeting.name}`}
          description="Todavía no tenés una sucursal asignada. Pedile a un administrador que te asigne una para ver tu inicio."
        />
      )
    case 'ADMINISTRATIVA':
      return 'dueTodayAlert' in home ? (
        <AdministrativeDashboard home={home} />
      ) : (
        <StatePanel
          icon={LayoutDashboard}
          title={`Hola, ${home.greeting.name}`}
          description="Todavía no tenés una sucursal asignada. Pedile a un administrador que te asigne una para ver tu inicio."
        />
      )
    case 'VENDEDOR':
      return 'attentionCount' in home ? (
        <SellerDashboard home={home} />
      ) : (
        <StatePanel
          icon={LayoutDashboard}
          title={`Hola, ${home.greeting.name}`}
          description="Todavía no tenés una sucursal asignada. Pedile a un administrador que te asigne una para ver tu inicio."
        />
      )
    default:
      return (
        <StatePanel
          icon={LayoutDashboard}
          title={`Hola, ${home.greeting.name}`}
          description="Usá el menú lateral para acceder a los módulos disponibles según tu rol."
        />
      )
  }
}
