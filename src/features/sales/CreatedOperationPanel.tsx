import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { alertError, alertSuccess } from '../../shared/alerts'
import {
  cancelSalesOperation,
  closeSalesOperation,
  getSalesOperation,
  submitSalesOperation,
} from './api'
import { salesErrorMessage } from './errors'
import { availableOperationActions, type OperationAction } from './operationActions'
import { operationStatusClass, operationStatusLabels } from './presentation'
import type { VehicleKind } from '../stock/types'
import type { SalesOperation } from './types'

export type CreatedOperationKind = 'draft' | 'partial' | 'submitted'

const actionLabels: Record<OperationAction, string> = {
  submit: 'Enviar operación',
  close: 'Cerrar operación',
  cancel: 'Cancelar operación',
}

function statusIcon(operation: SalesOperation, kind: CreatedOperationKind): LucideIcon {
  if (kind === 'partial') return AlertTriangle
  if (operation.status === 'APROBADA' || operation.status === 'CERRADA') return CheckCircle2
  if (operation.status === 'CANCELADA' || operation.status === 'RECHAZADA') return XCircle
  return Clock3
}

function successMessage(action: OperationAction, operation: SalesOperation) {
  if (action === 'submit') {
    return operation.status === 'PENDIENTE_APROBACION'
      ? 'La operación se envió a aprobación por estar debajo del precio de lista.'
      : 'La operación se envió al circuito comercial y quedó aprobada.'
  }
  if (action === 'close') return 'La operación quedó cerrada y la unidad marcada como vendida.'
  return 'La operación quedó cancelada.'
}

/**
 * Panel posterior al alta. Conserva en memoria la operación creada (id,
 * estado y rowVersion) y ofrece las acciones válidas para su estado sin
 * recargar la página. Cada acción reemplaza la operación con la respuesta
 * del backend, así el siguiente expectedVersion siempre es el vigente.
 */
export function CreatedOperationPanel({
  initialOperation,
  kind,
  message,
  permissions,
  vehicleType,
}: {
  initialOperation: SalesOperation
  kind: CreatedOperationKind
  message: string
  permissions: readonly string[]
  vehicleType: VehicleKind
}) {
  const [operation, setOperation] = useState(initialOperation)
  const [description, setDescription] = useState(message)
  const [busy, setBusy] = useState<OperationAction | null>(null)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Una operación parcial quedó sin plan de pago completo: el mensaje pide no
  // reenviarla, así que no se ofrecen acciones sobre ella desde acá.
  const actions =
    kind === 'partial' ? [] : availableOperationActions(operation, permissions)

  const run = async (action: OperationAction) => {
    if (action === 'cancel' && !cancelReason.trim()) {
      setError('Indicá el motivo de la cancelación.')
      return
    }
    setBusy(action)
    setError('')
    try {
      const updated =
        action === 'submit'
          ? await submitSalesOperation(operation.id, operation.rowVersion)
          : action === 'close'
            ? await closeSalesOperation(operation.id, operation.rowVersion)
            : await cancelSalesOperation(operation.id, {
                expectedVersion: operation.rowVersion,
                reason: cancelReason.trim(),
              })
      setOperation(updated)
      setCancelling(false)
      setCancelReason('')
      const text = successMessage(action, updated)
      setDescription(text)
      void alertSuccess(text)
    } catch (actionError) {
      let text = salesErrorMessage(actionError)
      if (actionError instanceof ApiError && actionError.status === 409) {
        // Otro usuario (o una aprobación) cambió la operación: se recarga
        // para mostrar su estado y rowVersion reales.
        try {
          setOperation(await getSalesOperation(operation.id))
          text = 'La operación cambió mientras la tenías abierta. Se actualizó su estado; revisá las acciones disponibles.'
        } catch {
          // Se conserva el mensaje original del 409.
        }
      }
      setError(text)
      void alertError(text)
    } finally {
      setBusy(null)
    }
  }

  return (
    <StatePanel
      icon={statusIcon(operation, kind)}
      title={`Operación #${operation.number}`}
      description={description}
      action={
        <div className="operation-complete">
          <p className="operation-complete__status">
            Estado:{' '}
            <span
              className={`status-badge ${operationStatusClass(operation.status)}`}
              data-testid="created-operation-status"
            >
              {operationStatusLabels[operation.status]}
            </span>
          </p>
          {error && (
            <div className="form-alert form-alert--error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {cancelling && (
            <label className="field">
              <span>Motivo de cancelación *</span>
              <textarea
                maxLength={500}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={2}
                value={cancelReason}
              />
            </label>
          )}
          <div className="operation-complete__actions">
            {actions.map((action) => {
              const label = actionLabels[action]
              if (action === 'cancel' && !cancelling) {
                return (
                  <button
                    className="button button--danger"
                    disabled={busy !== null}
                    key={action}
                    onClick={() => {
                      setError('')
                      setCancelling(true)
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                )
              }
              return (
                <button
                  className={`button ${action === 'cancel' ? 'button--danger' : 'button--primary'}`}
                  disabled={busy !== null}
                  key={action}
                  onClick={() => void run(action)}
                  type="button"
                >
                  {busy === action && <LoaderCircle className="spin" size={17} />}
                  {action === 'cancel' ? 'Confirmar cancelación' : label}
                </button>
              )
            })}
            <Link
              className="button button--secondary"
              to={`/${vehicleType === 'MOTO' ? 'motos' : 'autos'}/mis-operaciones`}
            >
              Ver mis operaciones
            </Link>
            {kind !== 'partial' && (
              <button
                className="button button--secondary"
                onClick={() => window.location.reload()}
                type="button"
              >
                Cargar otra
              </button>
            )}
          </div>
        </div>
      }
    />
  )
}
