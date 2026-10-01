import { LoaderCircle, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { listAllSalesOperations } from '../finance/api'
import type { SalesOperationOption } from '../finance/types'
import { getSalesOperation, listSalesOperations } from '../sales/api'
import { fulfillmentLabel, operationFulfillment } from '../sales/fulfillment'
import {
  plateStatusClass,
  plateStatusLabel,
  plateStatusOf,
} from '../sales/licensing'
import type { SalesOperation } from '../sales/types'
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

// Unidad elegida: por búsqueda de VIN o tomada de la operación del boleto.
type SelectedUnit = { id: string; vin: string; label: string }

function operationVehicleLabel(operation: SalesOperation) {
  return [
    operation.vehicle.model.brand.name,
    operation.vehicle.model.name,
    operation.vehicle.versionName,
  ]
    .filter(Boolean)
    .join(' ')
}

// Concepto que el pago de patente usa por defecto (ya existe en el catálogo).
const LICENSING_CONCEPT = 'patente'

function isLicensingConcept(option: CatalogOption) {
  return option.name.trim().toLocaleLowerCase('es-AR') === LICENSING_CONCEPT
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
  initialOperationId,
  onClose,
  onSaved,
}: {
  vehicleType: VehiclePaymentVehicleType
  // Fase 5: "Registrar pago de patente" desde la operación abre este mismo
  // formulario precargado con la operación, su unidad y el concepto Patente.
  initialOperationId?: string
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
  const [selectedUnit, setSelectedUnit] = useState<SelectedUnit | null>(null)

  const [operations, setOperations] = useState<SalesOperationOption[]>([])
  const [operationId, setOperationId] = useState('')

  // Fase 5: búsqueda por número de boleto.
  const [ticketSearch, setTicketSearch] = useState('')
  const [debouncedTicketSearch, setDebouncedTicketSearch] = useState('')
  const [ticketOptions, setTicketOptions] = useState<SalesOperation[]>([])
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketError, setTicketError] = useState('')
  const [ticketOperation, setTicketOperation] = useState<SalesOperation | null>(
    null,
  )
  const [initialLoading, setInitialLoading] = useState(Boolean(initialOperationId))

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
        // Desde la operación el pago es de patente.
        if (initialOperationId) {
          const patent = conceptRows.find(isLicensingConcept)
          if (patent) setConceptId((current) => current || patent.id)
        }
      })
      .catch((catalogError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(catalogError))
      })
    return () => controller.abort()
  }, [initialOperationId])

  // Elegir una operación (por boleto o desde la grilla) precarga operación y
  // unidad. Sin unidad todavía no se puede cargar el pago.
  const applyTicketOperation = (operation: SalesOperation) => {
    setTicketOperation(operation)
    setTicketOptions([])
    setTicketSearch(
      operation.ticketNumber
        ? `Boleto ${operation.ticketNumber}`
        : `Operación #${operation.number}`,
    )
    const unit = operation.vehicle.unit
    if (unit) {
      setSelectedUnit({
        id: unit.id,
        vin: unit.vin,
        label: operationVehicleLabel(operation),
      })
      setUnitSearch(`${unit.vin} · ${operationVehicleLabel(operation)}`)
      setUnitOptions([])
    } else {
      setSelectedUnit(null)
      setUnitSearch('')
    }
    setOperations([
      {
        id: operation.id,
        number: operation.number,
        operationDate: operation.operationDate,
        client: operation.client,
        vehicle: {
          versionName: operation.vehicle.versionName ?? '',
          unit: unit
            ? { id: unit.id, vin: unit.vin, licensePlate: unit.licensePlate }
            : null,
        },
      },
    ])
    setOperationId(operation.id)
  }

  useEffect(() => {
    if (!initialOperationId) return
    const controller = new AbortController()
    setInitialLoading(true)
    getSalesOperation(initialOperationId, controller.signal)
      .then((operation) => {
        if (controller.signal.aborted) return
        applyTicketOperation(operation)
        setInitialLoading(false)
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setInitialLoading(false)
        setError(errorMessage(loadError))
      })
    return () => controller.abort()
    // applyTicketOperation sólo actualiza estado: no hace falta como dependencia.
  }, [initialOperationId])

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedTicketSearch(ticketSearch.trim()),
      350,
    )
    return () => clearTimeout(timeout)
  }, [ticketSearch])

  useEffect(() => {
    if (ticketOperation || debouncedTicketSearch.length < 2) {
      setTicketOptions([])
      setTicketLoading(false)
      return
    }
    const controller = new AbortController()
    setTicketLoading(true)
    setTicketError('')
    listSalesOperations(
      { vehicleType, search: debouncedTicketSearch, page: 1, limit: 10 },
      controller.signal,
    )
      .then((page) => {
        if (controller.signal.aborted) return
        const needle = debouncedTicketSearch.toLocaleLowerCase('es-AR')
        // La búsqueda de operaciones también encuentra por cliente o VIN;
        // acá se muestran primero las que coinciden por boleto.
        const byTicket = (operation: SalesOperation) =>
          operation.ticketNumber?.toLocaleLowerCase('es-AR').includes(needle)
            ? 0
            : 1
        setTicketOptions(
          [...page.items].sort((left, right) => byTicket(left) - byTicket(right)),
        )
        setTicketLoading(false)
      })
      .catch((searchError: unknown) => {
        if (controller.signal.aborted) return
        setTicketOptions([])
        setTicketLoading(false)
        setTicketError(errorMessage(searchError))
      })
    return () => controller.abort()
  }, [debouncedTicketSearch, ticketOperation, vehicleType])

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
    // Con una operación elegida por boleto, la operación ya está resuelta.
    if (ticketOperation) return
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
  }, [selectedUnit, ticketOperation, vehicleType])

  const selectUnit = (unit: PhysicalUnit) => {
    setSelectedUnit({ id: unit.id, vin: unit.vin, label: unitLabel(unit) })
    setUnitSearch(`${unit.vin} · ${unitLabel(unit)}`)
    setUnitOptions([])
  }

  const clearTicket = () => {
    setTicketOperation(null)
    setTicketSearch('')
    setSelectedUnit(null)
    setUnitSearch('')
    setOperations([])
    setOperationId('')
  }

  const ticketPlateStatus = ticketOperation
    ? plateStatusOf(ticketOperation.licensing)
    : null
  const ticketWithoutUnit = ticketOperation !== null && !ticketOperation.vehicle.unit

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (ticketWithoutUnit) {
      setError('La operación del boleto todavía no tiene unidad asignada.')
      return
    }
    if (!selectedUnit) {
      setError('Elegí un vehículo por VIN/chasis o buscá el boleto.')
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
          {initialLoading && (
            <div className="vehicle-payment-unit-status">
              <LoaderCircle className="spin" size={16} aria-hidden="true" /> Cargando la operación…
            </div>
          )}
          <div className="financial-form-grid">
            <div className="field field--wide">
              <label htmlFor="vehicle-payment-ticket">Buscar por boleto</label>
              <div className="vehicle-payment-inline-add">
                <input
                  autoComplete="off"
                  id="vehicle-payment-ticket"
                  onChange={(event) => {
                    setTicketSearch(event.target.value)
                    if (ticketOperation) {
                      setTicketOperation(null)
                      setSelectedUnit(null)
                      setUnitSearch('')
                    }
                  }}
                  placeholder="Número de boleto u operación"
                  value={ticketSearch}
                />
                {ticketOperation && (
                  <button
                    className="icon-button"
                    aria-label="Quitar boleto"
                    onClick={clearTicket}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <small>
                Al elegir el boleto se precargan la operación y la unidad (por
                ejemplo, para el pago de patente).
              </small>
              {ticketLoading && (
                <div className="vehicle-payment-unit-status">
                  <LoaderCircle className="spin" size={16} aria-hidden="true" /> Buscando…
                </div>
              )}
              {ticketError && <small className="field-error">{ticketError}</small>}
              {!ticketLoading && ticketOptions.length > 0 && (
                <div
                  aria-label="Operaciones encontradas"
                  className="vehicle-payment-unit-results"
                  role="listbox"
                >
                  {ticketOptions.map((operation) => (
                    <button
                      className="vehicle-payment-unit-option"
                      key={operation.id}
                      onClick={() => applyTicketOperation(operation)}
                      role="option"
                      type="button"
                    >
                      <strong>
                        {operation.ticketNumber
                          ? `Boleto ${operation.ticketNumber}`
                          : 'Sin boleto'}{' '}
                        · #{operation.number}
                      </strong>
                      <span>
                        {operation.client.fullName} · {operationVehicleLabel(operation)} ·{' '}
                        {operation.vehicle.unit
                          ? operation.vehicle.unit.vin
                          : fulfillmentLabel(operationFulfillment(operation))}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {!ticketLoading &&
                !ticketOperation &&
                debouncedTicketSearch.length >= 2 &&
                ticketOptions.length === 0 &&
                !ticketError && <small>No encontramos operaciones con ese boleto.</small>}
              {ticketOperation && (
                <div className="vehicle-payment-ticket" role="status">
                  <strong>
                    Operación #{ticketOperation.number} · {ticketOperation.client.fullName}
                  </strong>
                  {ticketWithoutUnit ? (
                    <span className="status-badge status-badge--warning">
                      {fulfillmentLabel(operationFulfillment(ticketOperation))}: todavía
                      no tiene unidad para asignar el pago
                    </span>
                  ) : (
                    ticketPlateStatus &&
                    ticketPlateStatus !== 'NO_APLICA' && (
                      <span
                        className={`status-badge ${plateStatusClass(ticketPlateStatus)}`}
                      >
                        {plateStatusLabel(ticketPlateStatus, ticketOperation.licensing)}
                      </span>
                    )
                  )}
                </div>
              )}
            </div>

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
                disabled={ticketOperation !== null}
                onChange={(event) => {
                  setUnitSearch(event.target.value)
                  setSelectedUnit(null)
                }}
                placeholder="Buscá por chasis, patente, marca, modelo o versión"
                value={unitSearch}
                required={!ticketOperation}
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
              disabled={submitting || initialLoading || ticketWithoutUnit}
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
