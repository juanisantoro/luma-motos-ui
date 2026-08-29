import { Check, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatePanel } from '../../shared/components/StatePanel'
import {
  approveSalesOperation,
  listSalesOperations,
  rejectSalesOperation,
} from './api'
import { salesErrorMessage } from './errors'
import {
  formatMoney,
  formatOperationDate,
  vehicleLabel,
} from './presentation'
import { SalesDecisionModal } from './SalesDecisionModal'
import type { SalesOperation } from './types'

export function ApprovalsPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [operations, setOperations] = useState<SalesOperation[]>([])
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejection, setRejection] = useState<SalesOperation | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    void listSalesOperations(
      { status: 'PENDIENTE_APROBACION', page: 1, limit: 100 },
      controller.signal,
    )
      .then((response) => {
        setOperations(response.items)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(salesErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [refreshKey])

  const reload = () => setRefreshKey((value) => value + 1)

  const approve = async (operation: SalesOperation) => {
    setBusyId(operation.id)
    setActionError('')
    try {
      await approveSalesOperation(operation.id, {
        expectedVersion: operation.rowVersion,
      })
      reload()
    } catch (approveError) {
      setActionError(salesErrorMessage(approveError))
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (reason: string) => {
    if (!rejection) return
    setBusyId(rejection.id)
    setActionError('')
    try {
      await rejectSalesOperation(rejection.id, {
        expectedVersion: rejection.rowVersion,
        reason,
      })
      setRejection(null)
      reload()
    } catch (rejectError) {
      setActionError(salesErrorMessage(rejectError))
    } finally {
      setBusyId(null)
    }
  }

  const difference = operations.reduce(
    (total, operation) =>
      total +
      Math.max(
        0,
        Number(operation.listPrice ?? 0) - Number(operation.agreedPrice),
      ),
    0,
  )
  const currency = operations[0]?.currency ?? 'ARS'

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">CONTROL COMERCIAL</p>
          <h1>Aprobaciones pendientes</h1>
          <p>Revisión de precios y liberación coherente de reservas.</p>
        </div>
      </header>

      {status === 'success' && (
        <div className="approval-metrics">
          <div>
            <strong>{operations.length}</strong>
            <span>Pendientes</span>
          </div>
          <div>
            <strong>{formatMoney(String(difference), currency)}</strong>
            <span>Diferencia contra lista</span>
          </div>
        </div>
      )}

      {actionError && (
        <div className="inline-error" role="alert">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} type="button">
            Cerrar
          </button>
        </div>
      )}

      <section className="sales-panel approval-panel">
        {status === 'loading' && (
          <div className="client-loading" aria-live="polite">
            <div className="loading-mark" />
            <span>Cargando aprobaciones…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            icon={RefreshCw}
            title="No pudimos cargar las aprobaciones"
            description={error}
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
        )}
        {status === 'success' && operations.length === 0 && (
          <StatePanel
            icon={ShieldCheck}
            title="No hay aprobaciones pendientes"
            description="Todas las operaciones enviadas ya fueron revisadas."
          />
        )}
        {status === 'success' && operations.length > 0 && (
          <div className="approval-list">
            {operations.map((operation) => (
              <article className="approval-card" key={operation.id}>
                <div className="approval-card__title">
                  <div>
                    <span>Operación #{operation.number}</span>
                    <h2>{operation.client.fullName}</h2>
                    <p>{vehicleLabel(operation)}</p>
                  </div>
                  <span className="status-badge status-badge--warning">
                    Pendiente
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{formatOperationDate(operation.operationDate)}</dd>
                  </div>
                  <div>
                    <dt>Vendedor</dt>
                    <dd>{operation.seller?.fullName ?? 'Sin asignar'}</dd>
                  </div>
                  <div>
                    <dt>Precio lista</dt>
                    <dd>{formatMoney(operation.listPrice, operation.currency)}</dd>
                  </div>
                  <div>
                    <dt>Precio acordado</dt>
                    <dd>
                      <strong>
                        {formatMoney(operation.agreedPrice, operation.currency)}
                      </strong>
                    </dd>
                  </div>
                  <div>
                    <dt>Precio mínimo</dt>
                    <dd>{formatMoney(operation.minimumPrice, operation.currency)}</dd>
                  </div>
                  <div>
                    <dt>Reserva</dt>
                    <dd>
                      {operation.vehicle.unit?.vin ??
                        operation.reservation?.status ??
                        'Sin unidad'}
                    </dd>
                  </div>
                </dl>
                <div className="approval-card__actions">
                  <button
                    className="button button--success"
                    disabled={busyId === operation.id}
                    onClick={() => void approve(operation)}
                    type="button"
                  >
                    <Check size={17} />
                    Aprobar
                  </button>
                  <button
                    className="button button--danger"
                    disabled={busyId === operation.id}
                    onClick={() => {
                      setActionError('')
                      setRejection(operation)
                    }}
                    type="button"
                  >
                    <X size={17} />
                    Rechazar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {rejection && (
        <SalesDecisionModal
          operationNumber={rejection.number}
          submitting={busyId === rejection.id}
          error={actionError}
          onClose={() => {
            setActionError('')
            setRejection(null)
          }}
          onConfirm={reject}
        />
      )}
    </>
  )
}
