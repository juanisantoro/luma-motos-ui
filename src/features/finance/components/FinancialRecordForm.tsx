import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  createFinancialRecord,
  listAllCatalogVersions,
  listAllInventoryUnits,
  listAllSalesOperations,
  listAllSuppliers,
  listInventoryBranches,
} from '../api'
import { financialErrorMessage, financialLabels } from '../format'
import type {
  CreateExpenseInput,
  CreateIncomeInput,
  CreatePurchaseInput,
  FinancialKind,
  FinancialVehicleType,
  BranchOption,
  SupplierOption,
  UnitOption,
  VersionOption,
  SalesOperationOption,
} from '../types'
import { useAuth } from '../../auth/AuthContext'
import { hasPermission } from '../../auth/PermissionRoute'

type FinancialRecordFormProps = {
  kind: FinancialKind
  vehicleType?: FinancialVehicleType
  defaultBranchId?: string
  onClose: () => void
  onSaved: () => void
}

function text(data: FormData, name: string) {
  return String(data.get(name) ?? '').trim()
}

function optional(data: FormData, name: string) {
  return text(data, name) || undefined
}

function decimal(value: string) {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  return Number(normalized).toFixed(2)
}

export function FinancialRecordForm({
  kind,
  vehicleType,
  defaultBranchId,
  onClose,
  onSaved,
}: FinancialRecordFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [branchId, setBranchId] = useState(defaultBranchId ?? '')
  const [error, setError] = useState('')
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [versions, setVersions] = useState<VersionOption[]>([])
  const [operations, setOperations] = useState<SalesOperationOption[]>([])
  const [recordDate, setRecordDate] = useState(() => {
    const now = new Date()
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')
  })
  const dialogRef = useRef<HTMLDivElement>(null)
  const labels = financialLabels(kind)
  const { user } = useAuth()
  const [paidBy, setPaidBy] = useState(
    user?.name ?? user?.email ?? '',
  )
  const [recovered, setRecovered] = useState(false)
  const canViewOperations = hasPermission(
    user?.role.permissions,
    'ventas.consultar',
  )

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    document.body.classList.add('drawer-active')
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('input, select')?.focus())
    return () => {
      document.body.classList.remove('drawer-active')
      previous?.focus()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const requests: Promise<void>[] = []
    if (kind !== 'expense') {
      requests.push(
        listInventoryBranches(controller.signal).then(setBranches),
        listAllInventoryUnits(vehicleType, controller.signal).then(setUnits),
      )
    }
    if (kind === 'purchase') {
      requests.push(
        listAllSuppliers(controller.signal).then(setSuppliers),
        listAllCatalogVersions(vehicleType, controller.signal).then(setVersions),
      )
    } else if (kind === 'income' && canViewOperations) {
      requests.push(
        listAllSalesOperations(vehicleType, controller.signal).then(setOperations),
      )
    }
    void Promise.all(requests)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setError(financialErrorMessage(loadError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOptions(false)
      })
    return () => controller.abort()
  }, [canViewOperations, kind, vehicleType])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const data = new FormData(event.currentTarget)
    const unitId = kind === 'expense' ? undefined : optional(data, 'unitId')
    const versionId = optional(data, 'versionId')
    const documentNumber = optional(data, 'documentNumber')
    const additionalCosts = optional(data, 'additionalCosts')
    const operationId = optional(data, 'operationId')
    const reference = optional(data, 'reference')
    const notes = optional(data, 'notes')
    const branchId = optional(data, 'branchId')

    if (kind === 'purchase' && Boolean(unitId) === Boolean(versionId)) {
      setError('Indicá una unidad o una versión/modelo, pero no ambas.')
      return
    }

    let input: CreatePurchaseInput | CreateIncomeInput | CreateExpenseInput
    if (kind === 'purchase') {
      input = {
        branchId: text(data, 'branchId'),
        purchaseDate: text(data, 'date'),
        supplierId: text(data, 'supplierId'),
        ...(unitId ? { unitId } : { versionId: versionId as string }),
        ...(documentNumber ? { documentNumber } : {}),
        baseAmount: decimal(text(data, 'baseAmount')),
        ...(additionalCosts
          ? { additionalCosts: decimal(additionalCosts) }
          : {}),
        currency: text(data, 'currency'),
        ...(notes ? { notes } : {}),
      }
    } else if (kind === 'income') {
      input = {
        branchId: text(data, 'branchId'),
        incomeDate: text(data, 'date'),
        type: text(data, 'type'),
        description: text(data, 'description'),
        totalAmount: decimal(text(data, 'totalAmount')),
        currency: text(data, 'currency'),
        ...(unitId ? { unitId } : {}),
        ...(operationId ? { operationId } : {}),
        ...(reference ? { reference } : {}),
        ...(notes ? { notes } : {}),
      }
    } else {
      const expenseDate = text(data, 'date')
      const year = Number(expenseDate.slice(0, 4))
      const month = Number(expenseDate.slice(5, 7))
      input = {
        ...(branchId ? { branchId } : {}),
        expenseDate,
        category: text(data, 'category'),
        description: text(data, 'description'),
        totalAmount: decimal(text(data, 'totalAmount')),
        reference: text(data, 'reference'),
        paidBy: text(data, 'paidBy'),
        status: 'PENDIENTE',
        recovered,
        month,
        year,
        ...(recovered ? { recoverable: true } : {}),
        ...(notes ? { notes } : {}),
      }
    }

    setSubmitting(true)
    try {
      await createFinancialRecord(kind, input)
      onSaved()
    } catch (submitError) {
      setError(financialErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const [recordYear, recordMonth] = recordDate.split('-')
  const monthLabel = recordMonth
    ? new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(
        new Date(2026, Number(recordMonth) - 1, 1),
      )
    : '—'
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="financial-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="financial-form-title"
      >
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">{labels.eyebrow}</p>
            <h2 id="financial-form-title">
              Nuevo {labels.singular}
              {vehicleType
                ? ` de ${vehicleType === 'MOTO' ? 'moto' : 'auto'}`
                : ''}
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
                name="date"
                type="date"
                value={recordDate}
                onChange={(event) => setRecordDate(event.target.value)}
                required
              />
            </label>
            {kind !== 'expense' && <label className="field">
              <span>Sucursal *</span>
              <select
                name="branchId"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                required
                disabled={loadingOptions}
              >
                <option value="">Seleccionar sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>
                ))}
              </select>
            </label>}
            {kind === 'purchase' && (
              <>
                <label className="field">
                  <span>Proveedor *</span>
                  <select name="supplierId" required disabled={loadingOptions}>
                    <option value="">Seleccionar proveedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.legalName}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Documento</span>
                  <input name="documentNumber" maxLength={80} />
                </label>
                <label className="field">
                  <span>Unidad / VIN</span>
                  <select name="unitId" disabled={loadingOptions}>
                    <option value="">Sin unidad específica</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.vin} · {unit.version.model.brand.name} {unit.version.model.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Versión / modelo</span>
                  <select name="versionId" disabled={loadingOptions}>
                    <option value="">Sin versión</option>
                    {versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.model.brand.name} {version.model.name} · {version.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Importe base *</span>
                  <input name="baseAmount" type="number" min="0.01" step="0.01" required />
                </label>
                <label className="field">
                  <span>Costos adicionales</span>
                  <input name="additionalCosts" type="number" min="0" step="0.01" />
                </label>
              </>
            )}
            {kind === 'income' && (
              <>
                <label className="field">
                  <span>Tipo *</span>
                  <input name="type" maxLength={60} required />
                </label>
                <label className="field">
                  <span>TT / referencia</span>
                  <input name="reference" maxLength={120} />
                </label>
                <label className="field">
                  <span>Unidad / VIN</span>
                  <select name="unitId" disabled={loadingOptions}>
                    <option value="">Sin unidad asociada</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.vin} · {unit.version.model.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {kind === 'expense' && (
              <>
                <label className="field">
                  <span>Motivo / categoría *</span>
                  <input name="category" maxLength={80} required />
                </label>
                <label className="field">
                  <span>TT / referencia *</span>
                  <input name="reference" maxLength={160} required />
                </label>
                <label className="field field--wide">
                  <span>Detalle / descripción *</span>
                  <input name="description" maxLength={500} required />
                </label>
                <label className="field">
                  <span>Importe *</span>
                  <input
                    name="totalAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>
                <label className="field">
                  <span>Pagado por *</span>
                  <input
                    name="paidBy"
                    maxLength={180}
                    onChange={(event) => setPaidBy(event.target.value)}
                    required
                    value={paidBy}
                  />
                </label>
                <div className="field">
                  <span>Estado</span>
                  <output className="operation-readonly" aria-label="Estado del gasto">
                    Pendiente
                  </output>
                </div>
                <label className="field">
                  <span>Recuperada</span>
                  <select
                    aria-label="Recuperada"
                    onChange={(event) => setRecovered(event.target.value === 'true')}
                    value={String(recovered)}
                  >
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                  </select>
                </label>
                <div className="field">
                  <span>Mes</span>
                  <div className="operation-readonly">
                    {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
                  </div>
                </div>
                <div className="field">
                  <span>Año</span>
                  <div className="operation-readonly">{recordYear || '—'}</div>
                </div>
              </>
            )}
            {kind === 'income' && (
              <>
                <label className="field field--wide">
                  <span>Descripción *</span>
                  <input name="description" maxLength={500} required />
                </label>
                <label className="field">
                  <span>Importe total *</span>
                  <input name="totalAmount" type="number" min="0.01" step="0.01" required />
                </label>
                {canViewOperations && (
                  <label className="field">
                    <span>Operación</span>
                    <select name="operationId" disabled={loadingOptions}>
                      <option value="">Sin operación asociada</option>
                      {operations.map((operation) => (
                        <option key={operation.id} value={operation.id}>
                          {operation.number} · {operation.client.fullName} · {operation.vehicle.unit?.vin ?? operation.vehicle.versionName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {kind !== 'expense' && <label className="field">
              <span>Moneda *</span>
              <input name="currency" defaultValue="ARS" maxLength={3} required />
            </label>}
            <label className="field field--wide">
              <span>Observaciones</span>
              <textarea name="notes" rows={3} maxLength={2000} />
            </label>
          </div>
          <footer className="financial-modal__actions">
            <button className="button button--secondary" type="button" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button className="button button--primary" type="submit" disabled={submitting || loadingOptions}>
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Guardando…' : `Guardar ${labels.singular}`}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
