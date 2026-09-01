import { LoaderCircle, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { listAllSalesOperations } from '../finance/api'
import type { SalesOperationOption } from '../finance/types'
import { listAllPhysicalUnits } from '../stock/api'
import type { PhysicalUnit } from '../stock/types'
import {
  createVehiclePayment,
  createVehiclePaymentConcept,
  createVehiclePaymentProvider,
  listVehiclePaymentConcepts,
  listVehiclePaymentProviders,
} from './api'
import { alertError, alertSuccess } from '../../shared/alerts'
import type { CatalogOption, VehiclePaymentStatus, VehiclePaymentVehicleType } from './types'

function today() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function unitLabel(unit: PhysicalUnit) {
  return [unit.catalogModel.brand, unit.catalogModel.model, unit.catalogModel.version]
    .filter(Boolean)
    .join(' ')
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}

function CatalogSelect({
  label,
  options,
  value,
  onChange,
  onAdd,
}: {
  label: string
  options: CatalogOption[]
  value: string
  onChange: (id: string) => void
  onAdd: (name: string) => Promise<CatalogOption>
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const confirmAdd = async () => {
    const name = draft.trim()
    if (!name) return
    setBusy(true)
    setError('')
    try {
      const created = await onAdd(name)
      onChange(created.id)
      setAdding(false)
      setDraft('')
    } catch (addError) {
      const message = errorMessage(addError)
      setError(message)
      void alertError(message)
    } finally {
      setBusy(false)
    }
  }

  if (adding) {
    return (
      <label className="field">
        <span>{label} *</span>
        <div className="vehicle-payment-inline-add">
          <input
            autoFocus
            maxLength={160}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nombre"
            value={draft}
          />
          <button
            className="button button--secondary"
            disabled={busy || !draft.trim()}
            onClick={confirmAdd}
            type="button"
          >
            {busy ? <LoaderCircle className="spin" size={15} /> : 'Agregar'}
          </button>
          <button
            className="icon-button"
            aria-label="Cancelar"
            disabled={busy}
            onClick={() => {
              setAdding(false)
              setDraft('')
              setError('')
            }}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        {error && <small className="form-alert form-alert--error">{error}</small>}
      </label>
    )
  }

  return (
    <label className="field">
      <span>{label} *</span>
      <div className="vehicle-payment-inline-add">
        <select
          onChange={(event) => onChange(event.target.value)}
          required
          value={value}
        >
          <option value="" disabled>Seleccionar</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
        <button
          className="icon-button"
          aria-label={`Agregar ${label.toLowerCase()}`}
          onClick={() => setAdding(true)}
          type="button"
        >
          <Plus size={16} />
        </button>
      </div>
    </label>
  )
}

export function VehiclePaymentForm({
  vehicleType,
  onClose,
  onSaved,
}: {
  vehicleType: VehiclePaymentVehicleType
  onClose: () => void
  onSaved: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [concepts, setConcepts] = useState<CatalogOption[]>([])
  const [providers, setProviders] = useState<CatalogOption[]>([])
  const [conceptId, setConceptId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const [status, setStatus] = useState<VehiclePaymentStatus>('PENDIENTE')
  const [notes, setNotes] = useState('')

  const [unitSearch, setUnitSearch] = useState('')
  const [debouncedUnitSearch, setDebouncedUnitSearch] = useState('')
  const [unitOptions, setUnitOptions] = useState<PhysicalUnit[]>([])
  const [unitLoading, setUnitLoading] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<PhysicalUnit | null>(null)

  const [operations, setOperations] = useState<SalesOperationOption[]>([])
  const [operationId, setOperationId] = useState('')

  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('drawer-active')
    return () => document.body.classList.remove('drawer-active')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      listVehiclePaymentConcepts(controller.signal),
      listVehiclePaymentProviders(controller.signal),
    ])
      .then(([conceptRows, providerRows]) => {
        setConcepts(conceptRows)
        setProviders(providerRows)
      })
      .catch((catalogError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(catalogError))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedUnitSearch(unitSearch.trim()), 350)
    return () => clearTimeout(timeout)
  }, [unitSearch])

  useEffect(() => {
    if (debouncedUnitSearch.length < 3) {
      setUnitOptions([])
      setUnitLoading(false)
      return
    }
    const controller = new AbortController()
    setUnitLoading(true)
    listAllPhysicalUnits(vehicleType, undefined, debouncedUnitSearch, controller.signal)
      .then((units) => {
        if (controller.signal.aborted) return
        setUnitOptions(units)
        setUnitLoading(false)
      })
      .catch((unitError: unknown) => {
        if (controller.signal.aborted) return
        setUnitOptions([])
        setUnitLoading(false)
        setError(errorMessage(unitError))
      })
    return () => controller.abort()
  }, [debouncedUnitSearch, vehicleType])

  useEffect(() => {
    if (!selectedUnit) {
      setOperations([])
      setOperationId('')
      return
    }
    const controller = new AbortController()
    listAllSalesOperations(vehicleType, controller.signal)
      .then((allOperations) => {
        if (controller.signal.aborted) return
        const matching = allOperations.filter(
          (operation) => operation.vehicle.unit?.id === selectedUnit.id,
        )
        setOperations(matching)
        setOperationId(matching.length === 1 ? (matching[0]?.id ?? '') : '')
      })
      .catch(() => {
        if (!controller.signal.aborted) setOperations([])
      })
    return () => controller.abort()
  }, [selectedUnit, vehicleType])

  const selectUnit = (unit: PhysicalUnit) => {
    setSelectedUnit(unit)
    setUnitSearch(`${unit.vin} · ${unitLabel(unit)}`)
    setUnitOptions([])
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedUnit) {
      setError('Elegí un vehículo por VIN/chasis.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await createVehiclePayment({
        conceptId,
        unitId: selectedUnit.id,
        ...(operationId ? { operationId } : {}),
        providerId,
        amount: Number(amount),
        paymentDate,
        status,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      onSaved()
      void alertSuccess('El pago se registró correctamente.')
    } catch (submitError) {
      const message = errorMessage(submitError)
      setError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="financial-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-payment-form-title"
      >
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">DOCUMENTACIÓN</p>
            <h2 id="vehicle-payment-form-title">
              Nuevo pago de {vehicleType === 'MOTO' ? 'moto' : 'auto'}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar formulario"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>
        {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="financial-form-grid">
            <label className="field">
              <span>Fecha *</span>
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                required
              />
            </label>

            <CatalogSelect
              label="Concepto"
              options={concepts}
              value={conceptId}
              onChange={setConceptId}
              onAdd={async (name) => {
                const created = await createVehiclePaymentConcept(name)
                setConcepts((current) => [...current, created])
                return created
              }}
            />

            <label className="field field--wide">
              <span>VIN / Chasis *</span>
              <input
                autoComplete="off"
                onChange={(event) => {
                  setUnitSearch(event.target.value)
                  setSelectedUnit(null)
                }}
                placeholder="Buscá por chasis, patente, marca, modelo o versión"
                value={unitSearch}
                required
              />
              <small>Ingresá al menos 3 letras para buscar.</small>
              {unitLoading && (
                <div className="vehicle-payment-unit-status">
                  <LoaderCircle className="spin" size={16} aria-hidden="true" /> Buscando…
                </div>
              )}
              {!unitLoading && unitOptions.length > 0 && (
                <div className="vehicle-payment-unit-results" role="listbox">
                  {unitOptions.map((unit) => (
                    <button
                      className="vehicle-payment-unit-option"
                      key={unit.id}
                      onClick={() => selectUnit(unit)}
                      role="option"
                      type="button"
                    >
                      <strong>{unit.vin}</strong>
                      <span>{unitLabel(unit)} · {unit.branch.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </label>

            <label className="field">
              <span>Operación asociada</span>
              <select
                disabled={!selectedUnit || operations.length === 0}
                onChange={(event) => setOperationId(event.target.value)}
                value={operationId}
              >
                <option value="">Sin operación asociada</option>
                {operations.map((operation) => (
                  <option key={operation.id} value={operation.id}>
                    #{operation.number} · {operation.client.fullName}
                  </option>
                ))}
              </select>
            </label>

            <CatalogSelect
              label="Proveedor"
              options={providers}
              value={providerId}
              onChange={setProviderId}
              onAdd={async (name) => {
                const created = await createVehiclePaymentProvider(name)
                setProviders((current) => [...current, created])
                return created
              }}
            />

            <label className="field">
              <span>Importe *</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Estado</span>
              <select
                onChange={(event) => setStatus(event.target.value as VehiclePaymentStatus)}
                value={status}
              >
                <option value="PENDIENTE">Pendiente</option>
                <option value="PAGADO">Pagado</option>
              </select>
            </label>

            <label className="field field--wide">
              <span>Observaciones</span>
              <textarea
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                value={notes}
              />
            </label>
          </div>
          <footer className="financial-modal__actions">
            <button className="button button--secondary" type="button" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={submitting}
              type="submit"
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Guardando…' : 'Guardar pago'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
