import {
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  Search,
  Store,
  Warehouse,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { alertError, alertSuccess } from '../../shared/alerts'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { ReceiveSupplyModal } from '../stock/ReceiveSupplyModal'
import { stockApiGateway } from '../stock/api'
import { stockErrorMessage } from '../stock/errors'
import type { ReceiveSupplyInput, VehicleKind } from '../stock/types'
import { listSalesOperations } from './api'
import { AssignUnitModal } from './AssignUnitModal'
import { salesErrorMessage } from './errors'
import {
  fulfillmentLabel,
  fulfillmentStatusClass,
  operationFulfillment,
} from './fulfillment'
import {
  formatOperationDate,
  operationStatusClass,
  operationStatusLabels,
  vehicleLabel,
} from './presentation'
import { SupplyOrderModal } from './SupplyOrderModal'
import type {
  SalesFulfillmentStatus,
  SalesOperation,
  SalesOperationPage,
} from './types'

type TrayFilter = Exclude<SalesFulfillmentStatus, 'ASIGNADA'> | 'SIN_ASIGNAR'
type Action = 'assign' | 'order' | 'receive'

const PAGE_SIZE = 20

// Bandeja "Operaciones a asignar" (fase 3): operaciones enviadas por el
// vendedor que todavía no tienen unidad física. La administrativa asigna una
// unidad en stock, la pide a un proveedor o registra la llegada del pedido.
export function AssignmentsPage({ vehicleType }: { vehicleType: VehicleKind }) {
  const { user } = useAuth()
  const permissions = user?.role.permissions
  const canAssign = hasPermission(permissions, 'ventas.asignar_unidad')
  const canOrder =
    canAssign && hasPermission(permissions, 'abastecimiento.gestionar')
  const canReceive = hasPermission(permissions, 'abastecimiento.recibir')
  const canEditUnit = hasPermission(permissions, 'inventario.gestionar')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [result, setResult] = useState<SalesOperationPage | null>(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<TrayFilter>('SIN_ASIGNAR')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [active, setActive] = useState<{
    action: Action
    operation: SalesOperation
  } | null>(null)
  const [receiving, setReceiving] = useState(false)
  const [receiveError, setReceiveError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    void listSalesOperations(
      {
        vehicleType,
        fulfillmentStatus: filter,
        page,
        limit: PAGE_SIZE,
        ...(search ? { search } : {}),
      },
      controller.signal,
    )
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(salesErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [filter, page, refreshKey, search, vehicleType])

  const reload = () => setRefreshKey((value) => value + 1)
  const close = () => {
    setActive(null)
    setReceiveError(null)
  }
  const done = (message: string) => {
    close()
    reload()
    void alertSuccess(message)
  }

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }

  const receive = async (input: ReceiveSupplyInput) => {
    const supplyId = active
      ? operationFulfillment(active.operation).supplyRequestId
      : null
    if (!supplyId) return
    setReceiving(true)
    setReceiveError(null)
    try {
      await stockApiGateway.receiveSupply(supplyId, input)
      done('La unidad se recibió y quedó asignada a la operación.')
    } catch (receiveFailure) {
      const message = stockErrorMessage(receiveFailure)
      setReceiveError(message)
      void alertError(message)
    } finally {
      setReceiving(false)
    }
  }

  const items = result?.items ?? []
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1
  const vehicleNoun = vehicleType === 'MOTO' ? 'motos' : 'autos'
  const receivingFulfillment =
    active?.action === 'receive'
      ? operationFulfillment(active.operation)
      : null

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">VENTAS</p>
          <h1>Operaciones a asignar · {vehicleNoun}</h1>
          <p>
            Operaciones enviadas sin unidad física. Asigná una del stock de tu
            sucursal o pedila a un proveedor.
          </p>
        </div>
      </header>

      <section className="sales-panel" aria-label="Operaciones a asignar">
        <form className="sales-filters" onSubmit={submitFilters}>
          <label className="search-field">
            <span className="sr-only">Buscar operaciones</span>
            <Search size={18} />
            <input
              maxLength={80}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Operación, cliente o boleto"
              type="search"
              value={searchDraft}
            />
          </label>
          <label className="filter-field">
            <span className="sr-only">Situación de la unidad</span>
            <select
              onChange={(event) => {
                setPage(1)
                setFilter(event.target.value as TrayFilter)
              }}
              value={filter}
            >
              <option value="SIN_ASIGNAR">Todas sin unidad</option>
              <option value="PENDIENTE_ASIGNACION">
                Pendientes de asignar unidad
              </option>
              <option value="PEDIDA">Pedidas a proveedor</option>
              <option value="PENDIENTE_INGRESO">
                Pendientes de ingreso del proveedor
              </option>
              <option value="RECIBIDA">Recibidas, falta asignar</option>
            </select>
          </label>
          <button className="button button--secondary" type="submit">
            Buscar
          </button>
        </form>

        <div className="sales-content" aria-live="polite">
          {status === 'loading' && (
            <div className="client-loading">
              <div className="loading-mark" />
              <span>Cargando operaciones…</span>
            </div>
          )}
          {status === 'error' && (
            <StatePanel
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
              description={error}
              icon={RefreshCw}
              title="No pudimos cargar las operaciones"
              tone="danger"
            />
          )}
          {status === 'success' && items.length === 0 && (
            <StatePanel
              description="Todas las operaciones enviadas tienen unidad asignada."
              icon={PackageSearch}
              title="No hay operaciones para asignar"
            />
          )}
          {status === 'success' && items.length > 0 && (
            <div className="sales-table-wrap">
              <table className="sales-table sales-table--assignments">
                <thead>
                  <tr>
                    <th>Operación</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Vehículo</th>
                    <th>Sucursal</th>
                    <th>Estado operación</th>
                    <th>Unidad</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((operation) => {
                    const fulfillment = operationFulfillment(operation)
                    const pending = fulfillment.status === 'PENDIENTE_ASIGNACION'
                    const ordered =
                      fulfillment.status === 'PEDIDA' ||
                      fulfillment.status === 'PENDIENTE_INGRESO'
                    return (
                      <tr key={operation.id}>
                        <td>
                          <strong>#{operation.number}</strong>
                          {operation.ticketNumber && (
                            <small>Boleto {operation.ticketNumber}</small>
                          )}
                        </td>
                        <td>{formatOperationDate(operation.operationDate)}</td>
                        <td>{operation.client.fullName}</td>
                        <td>
                          <strong>{vehicleLabel(operation)}</strong>
                          <small>
                            {operation.vehicle.condition === 'NUEVO'
                              ? 'Nuevo'
                              : 'Usado'}
                            {operation.requestedColor
                              ? ` · ${operation.requestedColor}`
                              : ''}
                          </small>
                        </td>
                        <td>{operation.branch.name}</td>
                        <td>
                          <span
                            className={`status-badge ${operationStatusClass(operation.status)}`}
                          >
                            {operationStatusLabels[operation.status]}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${fulfillmentStatusClass(fulfillment.status)}`}
                          >
                            {fulfillmentLabel(fulfillment)}
                          </span>
                        </td>
                        <td>
                          <div className="assignment-actions">
                            {canAssign &&
                              (pending || fulfillment.status === 'RECIBIDA') && (
                                <button
                                  aria-label={`Asignar de stock a la operación #${operation.number}`}
                                  className="button button--primary button--compact"
                                  onClick={() =>
                                    setActive({ action: 'assign', operation })
                                  }
                                  type="button"
                                >
                                  <Warehouse size={15} />
                                  Asignar de stock
                                </button>
                              )}
                            {canOrder && pending && (
                              <button
                                aria-label={`Pedir a proveedor para la operación #${operation.number}`}
                                className="button button--secondary button--compact"
                                onClick={() =>
                                  setActive({ action: 'order', operation })
                                }
                                type="button"
                              >
                                <Store size={15} />
                                Pedir a proveedor
                              </button>
                            )}
                            {canReceive && ordered && (
                              <button
                                aria-label={`Registrar llegada de la operación #${operation.number}`}
                                className="button button--primary button--compact"
                                onClick={() =>
                                  setActive({ action: 'receive', operation })
                                }
                                type="button"
                              >
                                <PackageCheck size={15} />
                                Registrar llegada
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>
              {result.total}{' '}
              {result.total === 1 ? 'operación' : 'operaciones'}
            </span>
            <div>
              <button
                aria-label="Página anterior"
                className="icon-button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                <ChevronLeft size={19} />
              </button>
              <strong>
                Página {result.page} de {totalPages}
              </strong>
              <button
                aria-label="Página siguiente"
                className="icon-button"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
                type="button"
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </footer>
        )}
      </section>

      {active?.action === 'assign' && (
        <AssignUnitModal
          canEditUnit={canEditUnit}
          onAssigned={() =>
            done('La unidad quedó reservada y asignada a la operación.')
          }
          onClose={close}
          operation={active.operation}
        />
      )}
      {active?.action === 'order' && (
        <SupplyOrderModal
          onClose={close}
          onOrdered={(updated) =>
            done(
              `Pedido realizado a ${updated.fulfillment?.supplier?.legalName ?? 'proveedor'}.`,
            )
          }
          operation={active.operation}
        />
      )}
      {active?.action === 'receive' && receivingFulfillment?.supplyRequestId && (
        <ReceiveSupplyModal
          branches={[
            { id: active.operation.branch.id, name: active.operation.branch.name },
          ]}
          error={receiveError}
          onClose={close}
          onSubmit={(input) => void receive(input)}
          submitting={receiving}
          supply={{
            id: receivingFulfillment.supplyRequestId,
            vehicleType: active.operation.vehicle.model.vehicleType,
            condition: active.operation.vehicle.condition,
            color: active.operation.requestedColor ?? null,
            destinationBranch: {
              id: active.operation.branch.id,
              name: active.operation.branch.name,
            },
            catalogModel: {
              brand: active.operation.vehicle.model.brand.name,
              model: [
                active.operation.vehicle.model.name,
                active.operation.vehicle.versionName,
              ]
                .filter(Boolean)
                .join(' '),
            },
            supplier: {
              name: receivingFulfillment.supplier?.legalName ?? 'Proveedor',
            },
            operationNumber: active.operation.number,
          }}
        />
      )}
    </>
  )
}
