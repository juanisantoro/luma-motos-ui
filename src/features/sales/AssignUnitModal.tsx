import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, Warehouse, X } from 'lucide-react'
import { ApiError } from '../../shared/api/client'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { assignSalesUnit, listAssignableUnits, type AssignableUnit } from './api'
import { salesErrorMessage } from './errors'
import { vehicleLabel } from './presentation'
import type { SalesOperation } from './types'

function assignmentErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const code = error.details?.code
    if (code === 'SUPPLY_REQUEST_IN_PROGRESS')
      return 'La operación ya tiene un pedido al proveedor sin recibir: recibilo o cancelalo antes de asignar stock.'
    if (code === 'OPERATION_ALREADY_HAS_UNIT')
      return 'La operación ya tiene una unidad asignada.'
    if (code === 'OPERATION_NOT_ASSIGNABLE')
      return 'La operación no admite asignar unidad en su estado actual.'
    if (code === 'INVENTORY_UNIT_ALREADY_RESERVED')
      return 'Esa unidad acaba de ser reservada por otra operación. Elegí otra.'
    if (error.status === 400 && /vin/i.test(String(error.details?.message)))
      return 'El chasis no es válido.'
    if (error.status === 409 && /unique|conflict/i.test(error.message))
      return 'El chasis ya existe en otra unidad.'
  }
  return salesErrorMessage(error)
}

export function AssignUnitModal({
  operation,
  canEditUnit,
  onClose,
  onAssigned,
}: {
  operation: SalesOperation
  // inventario.gestionar: puede corregir chasis y motor al asignar.
  canEditUnit: boolean
  onClose: () => void
  onAssigned: (operation: SalesOperation) => void
}) {
  const [units, setUnits] = useState<AssignableUnit[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [unitId, setUnitId] = useState('')
  const [vin, setVin] = useState('')
  const [engineNumber, setEngineNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialogFocus(onClose, submitting)
  const selected = units.find((unit) => unit.id === unitId) ?? null

  useEffect(() => {
    const controller = new AbortController()
    listAssignableUnits(operation, controller.signal)
      .then((items) => {
        // Primero las del color deseado.
        const wanted = operation.requestedColor?.toLocaleLowerCase('es-AR')
        const sorted = [...items].sort(
          (left, right) =>
            Number(right.color?.toLocaleLowerCase('es-AR') === wanted) -
            Number(left.color?.toLocaleLowerCase('es-AR') === wanted),
        )
        setUnits(sorted)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(salesErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [operation])

  const choose = (unit: AssignableUnit) => {
    setUnitId(unit.id)
    setVin(unit.vin)
    setEngineNumber(unit.engineNumber ?? '')
    setError('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return
    if (canEditUnit && !engineNumber.trim()) {
      setError('Cargá el número de motor de la unidad.')
      return
    }
    const vinChanged = canEditUnit && vin.trim() !== selected.vin
    const engineChanged =
      canEditUnit && engineNumber.trim() !== (selected.engineNumber ?? '')
    setSubmitting(true)
    setError('')
    try {
      const updated = await assignSalesUnit(operation.id, {
        expectedVersion: operation.rowVersion,
        unitId: selected.id,
        ...(vinChanged ? { vin: vin.trim() } : {}),
        ...(engineChanged ? { engineNumber: engineNumber.trim() } : {}),
      })
      onAssigned(updated)
    } catch (assignError) {
      setError(assignmentErrorMessage(assignError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="assign-unit-title"
        aria-modal="true"
        className="client-modal assignment-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">ASIGNAR DE STOCK</p>
            <h2 id="assign-unit-title">
              Operación #{operation.number}
            </h2>
            <p className="modal-description">
              {vehicleLabel(operation)} ·{' '}
              {operation.vehicle.condition === 'NUEVO' ? 'Nuevo' : 'Usado'} ·{' '}
              {operation.branch.name}
              {operation.requestedColor
                ? ` · color deseado ${operation.requestedColor}`
                : ''}
            </p>
          </div>
          <button
            aria-label="Cerrar asignación"
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

        <form onSubmit={(event) => void submit(event)}>
          {status === 'loading' && (
            <p className="modal-description" role="status">
              <LoaderCircle className="spin" size={16} /> Buscando unidades en
              stock…
            </p>
          )}
          {status === 'success' && units.length === 0 && (
            <p className="modal-description">
              No hay unidades en stock de esta versión y condición en{' '}
              {operation.branch.name}. Pedila a un proveedor.
            </p>
          )}
          {units.length > 0 && (
            <fieldset className="assignment-units">
              <legend>Unidades en stock</legend>
              {units.map((unit) => (
                <label className="assignment-unit" key={unit.id}>
                  <input
                    checked={unitId === unit.id}
                    name="unit"
                    onChange={() => choose(unit)}
                    type="radio"
                    value={unit.id}
                  />
                  <Warehouse size={17} aria-hidden="true" />
                  <span>
                    <strong>Chasis {unit.vin}</strong>
                    <small>
                      {[
                        unit.engineNumber
                          ? `Motor ${unit.engineNumber}`
                          : 'Motor sin cargar',
                        unit.color,
                        unit.manufactureYear,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {selected && (
            <div className="client-form-grid">
              <label className="field">
                <span>Chasis (VIN) *</span>
                <input
                  disabled={!canEditUnit}
                  maxLength={80}
                  onChange={(event) => setVin(event.target.value)}
                  required
                  value={vin}
                />
              </label>
              <label className="field">
                <span>Número de motor{canEditUnit ? ' *' : ''}</span>
                <input
                  disabled={!canEditUnit}
                  maxLength={60}
                  onChange={(event) => setEngineNumber(event.target.value)}
                  value={engineNumber}
                />
              </label>
              {!canEditUnit && (
                <small className="field--wide">
                  Para corregir chasis o motor hace falta el permiso de
                  gestión de inventario.
                </small>
              )}
            </div>
          )}

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
              disabled={submitting || !selected}
              type="submit"
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              Asignar unidad
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
