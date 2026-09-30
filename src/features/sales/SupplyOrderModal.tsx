import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, Store, X } from 'lucide-react'
import { ApiError } from '../../shared/api/client'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { listAllSuppliers } from '../finance/api'
import type { SupplierOption } from '../finance/types'
import { listUnitColors } from '../stock/api'
import {
  listSupplierSuggestions,
  requestSalesSupply,
  type SupplierSuggestion,
} from './api'
import { salesErrorMessage } from './errors'
import { vehicleLabel } from './presentation'
import type { SalesOperation } from './types'

function orderErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const code = error.details?.code
    if (code === 'SUPPLY_REQUEST_IN_PROGRESS')
      return 'La operación ya tiene un pedido al proveedor sin recibir.'
    if (code === 'OPERATION_ALREADY_HAS_UNIT')
      return 'La operación ya tiene una unidad asignada.'
    if (code === 'OPERATION_NOT_ASSIGNABLE')
      return 'La operación no admite pedidos en su estado actual.'
  }
  return salesErrorMessage(error)
}

export function SupplyOrderModal({
  operation,
  onClose,
  onOrdered,
}: {
  operation: SalesOperation
  onClose: () => void
  onOrdered: (operation: SalesOperation) => void
}) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suggestions, setSuggestions] = useState<SupplierSuggestion[]>([])
  const [colors, setColors] = useState<Array<{ id: string; name: string }>>([])
  const [supplierId, setSupplierId] = useState('')
  const [color, setColor] = useState(operation.requestedColor ?? '')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialogFocus(onClose, submitting)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.allSettled([
      listAllSuppliers(controller.signal),
      listSupplierSuggestions(operation, controller.signal),
      listUnitColors(controller.signal),
    ]).then(([supplierResult, suggestionResult, colorResult]) => {
      if (controller.signal.aborted) return
      if (supplierResult.status === 'fulfilled') {
        setSuppliers(supplierResult.value.filter((item) => item.active))
      } else {
        setError(salesErrorMessage(supplierResult.reason))
      }
      if (suggestionResult.status === 'fulfilled')
        setSuggestions(suggestionResult.value)
      if (colorResult.status === 'fulfilled') setColors(colorResult.value)
    })
    return () => controller.abort()
  }, [operation])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supplierId) {
      setError('Elegí a qué proveedor se lo pedís.')
      return
    }
    const cost = estimatedCost.trim() ? Number(estimatedCost) : undefined
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      setError('El costo estimado no es válido.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const updated = await requestSalesSupply(operation.id, {
        expectedVersion: operation.rowVersion,
        supplierId,
        ...(color ? { color } : {}),
        ...(cost !== undefined ? { estimatedCost: cost } : {}),
        ...(reference.trim() ? { supplierReference: reference.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      onOrdered(updated)
    } catch (orderError) {
      setError(orderErrorMessage(orderError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="supply-order-title"
        aria-modal="true"
        className="client-modal assignment-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">PEDIR A PROVEEDOR</p>
            <h2 id="supply-order-title">Operación #{operation.number}</h2>
            <p className="modal-description">
              {vehicleLabel(operation)} ·{' '}
              {operation.vehicle.condition === 'NUEVO' ? 'Nuevo' : 'Usado'} ·
              llega a {operation.branch.name}
            </p>
          </div>
          <button
            aria-label="Cerrar pedido"
            className="icon-button"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="assignment-suggestions" aria-label="Sugerencias">
            <small>Proveedores que informan disponibilidad (sugerencia):</small>
            <div>
              {suggestions.map((suggestion) => (
                <button
                  className={`button button--compact ${supplierId === suggestion.supplierId ? 'button--primary' : 'button--secondary'}`}
                  key={suggestion.supplierId}
                  onClick={() => setSupplierId(suggestion.supplierId)}
                  type="button"
                >
                  <Store size={14} />
                  {suggestion.supplierName} ({suggestion.quantity})
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={(event) => void submit(event)}>
          <div className="client-form-grid">
            <div className="field field--wide">
              <span id="supply-order-supplier-label">Proveedor *</span>
              <select
                aria-labelledby="supply-order-supplier-label"
                onChange={(event) => setSupplierId(event.target.value)}
                required
                value={supplierId}
              >
                <option value="">Seleccionar proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.legalName}
                  </option>
                ))}
              </select>
              <small>
                El proveedor es del pedido: la misma versión se puede pedir a
                cualquiera.
              </small>
            </div>
            <label className="field">
              <span>Color</span>
              <select
                onChange={(event) => setColor(event.target.value)}
                value={color}
              >
                <option value="">Sin especificar</option>
                {operation.requestedColor &&
                  !colors.some(
                    (option) => option.name === operation.requestedColor,
                  ) && (
                    <option value={operation.requestedColor}>
                      {operation.requestedColor}
                    </option>
                  )}
                {colors.map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Costo estimado</span>
              <input
                min="0"
                onChange={(event) => setEstimatedCost(event.target.value)}
                step="0.01"
                type="number"
                value={estimatedCost}
              />
            </label>
            <label className="field">
              <span>Referencia del proveedor</span>
              <input
                maxLength={120}
                onChange={(event) => setReference(event.target.value)}
                value={reference}
              />
            </label>
            <label className="field field--wide">
              <span>Notas</span>
              <textarea
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                value={notes}
              />
            </label>
          </div>
          <div className="client-modal__actions">
            <button
              className="button button--secondary"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={submitting || !supplierId}
              type="submit"
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              Realizar pedido
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
