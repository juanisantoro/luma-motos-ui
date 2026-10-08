import { LayoutDashboard } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { alertError } from '../../shared/alerts'
import { ApiError, NetworkError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { getDashboardHome } from './api'
import { AdminDashboard } from './AdminDashboard'
import { AdministrativeDashboard } from './AdministrativeDashboard'
import { ManagerDashboard } from './ManagerDashboard'
import { SellerDashboard } from './SellerDashboard'
import type { DashboardHome, DashboardMonth } from './types'

function dashboardErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof NetworkError) return error.message
  return 'No pudimos cargar tu inicio. Intentá nuevamente.'
}

export function DashboardPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [home, setHome] = useState<DashboardHome | null>(null)
  // Mes del inicio del ADMINISTRADOR. Al cambiarlo se sigue mostrando el
  // inicio anterior hasta que llegan los números nuevos.
  const [month, setMonth] = useState<DashboardMonth>('current')
  const [refreshing, setRefreshing] = useState(false)
  const shownMonth = useRef<DashboardMonth | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setRefreshing(true)
    getDashboardHome(controller.signal, month)
      .then((result) => {
        shownMonth.current = month
        setHome(result)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // Si falla un cambio de mes, queda a la vista el mes que ya estaba.
        if (shownMonth.current) setMonth(shownMonth.current)
        else setStatus('error')
        void alertError(dashboardErrorMessage(error), 'No se pudo cargar el inicio')
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false)
      })
    return () => controller.abort()
  }, [month])

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
      return (
        <AdminDashboard
          home={home}
          loading={refreshing}
          month={month}
          onMonthChange={setMonth}
        />
      )
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
