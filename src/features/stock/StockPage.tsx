import { LockKeyhole, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { StockWorkspace } from './StockWorkspace'
import { stockErrorMessage } from './errors'
import type { StockGateway } from './gateway'
import type {
  StockCapabilities,
  StockWorkspaceData,
  VehicleKind,
} from './types'

type LoadStatus = 'loading' | 'success' | 'error' | 'forbidden'

export function StockPage({
  vehicleType,
  gateway,
}: {
  vehicleType: VehicleKind
  gateway: StockGateway
}) {
  const { user } = useAuth()
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [data, setData] = useState<StockWorkspaceData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const capabilities = useMemo<StockCapabilities>(
    () => {
      const can = (permission: string) =>
        hasPermission(user?.role.permissions, permission)
      const catalogRead = can('catalogo.consultar')
      const suppliersRead = can('proveedores.consultar')
      const supplyRead = can('abastecimiento.consultar')
      return {
        viewCatalog: catalogRead,
        viewAvailability: suppliersRead,
        viewSupply: supplyRead,
        createUnits: can('inventario.gestionar') && catalogRead,
        createCatalog: can('catalogo.gestionar') && catalogRead,
        createSharedCatalog:
          Boolean(user?.globalAccess) &&
          can('catalogo.gestionar') &&
          catalogRead,
        manageAvailability:
          can('proveedores.gestionar') &&
          suppliersRead &&
          catalogRead,
        manageSupply: can('abastecimiento.gestionar') && supplyRead,
        receiveSupply: can('abastecimiento.recibir') && supplyRead,
      }
    },
    [user],
  )
  const targetOrganizationId = user?.globalAccess
    ? user.organization.id
    : undefined

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setLoadError('')
    void gateway
      .loadWorkspace(
        vehicleType,
        capabilities,
        targetOrganizationId,
        controller.signal,
      )
      .then((workspace) => {
        setData(workspace)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          error.status === 403
        ) {
          setStatus('forbidden')
          return
        }
        setLoadError(stockErrorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [
    capabilities,
    gateway,
    refreshKey,
    targetOrganizationId,
    vehicleType,
  ])

  const reload = () => setRefreshKey((current) => current + 1)
  const mutateAndReload = async (mutation: () => Promise<void>) => {
    await mutation()
    reload()
  }

  if (status === 'loading') {
    return (
      <div className="stock-page-state" aria-live="polite">
        <div className="loading-mark" />
        <span>Cargando stock y abastecimientos…</span>
      </div>
    )
  }

  if (status === 'forbidden') {
    return (
      <div className="content-card">
        <StatePanel
          icon={LockKeyhole}
          title="No tenés acceso a estos datos"
          description="Tu sesión no tiene alcance para consultar el inventario solicitado."
          tone="danger"
        />
      </div>
    )
  }

  if (status === 'error' || !data) {
    return (
      <div className="content-card">
        <StatePanel
          icon={RefreshCw}
          title="No pudimos cargar el stock"
          description={loadError}
          tone="danger"
          action={
            <button
              className="button button--primary"
              onClick={reload}
              type="button"
            >
              <RefreshCw size={17} />
              Reintentar
            </button>
          }
        />
      </div>
    )
  }

  return (
    <StockWorkspace
      capabilities={capabilities}
      data={data}
      onCreateUnits={(input) =>
        mutateAndReload(() =>
          gateway.createUnits(input, targetOrganizationId),
        )
      }
      onReceiveSupply={(supplyId, input) =>
        mutateAndReload(() => gateway.receiveSupply(supplyId, input))
      }
      onTransitionSupply={(supplyId, nextStatus) =>
        mutateAndReload(() =>
          gateway.transitionSupply(supplyId, nextStatus),
        )
      }
      onUpsertAvailability={(input) =>
        mutateAndReload(() => gateway.upsertAvailability(input))
      }
      vehicleType={vehicleType}
    />
  )
}
