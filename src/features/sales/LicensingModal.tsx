import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { ApiError } from '../../shared/api/client'
import { alertSuccess } from '../../shared/alerts'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { localIsoDate } from '../../shared/utils/date'
import { hasPermission } from '../auth/PermissionRoute'
import { createFinancialRecord } from '../finance/api'
import {
  createVehiclePayment,
  listVehiclePaymentConcepts,
  listVehiclePaymentProviders,
} from '../vehicle-payments/api'
import type { CatalogOption } from '../vehicle-payments/types'
import { updateSalesLicensing } from './api'
import { salesErrorMessage } from './errors'
import {
  licensingModeDescriptions,
  licensingModeLabels,
  licensingStatusClass,
  licensingStatusLabels,
  licensingWindowLabel,
} from './licensing'
import { formatMoney } from './presentation'
import type { SalesLicensingMode, SalesOperation } from './types'

// Tipo de ingreso y concepto de pago que ya existen en los catálogos.
const LICENSING_CATALOG_NAME = 'patente'

function licensingErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const code = error.details?.code
    if (code === 'LICENSING_COLLECTION_REGISTERED') {
      return 'Ya hay un cobro de patente registrado al cliente: no se puede pasar a bonificada.'
    }
    if (code === 'LICENSING_OPERATION_CANCELLED') {
      return 'La operación está cancelada.'
    }
    if (code === 'LICENSING_AMOUNT_NOT_ALLOWED') {
      return 'El importe sólo aplica cuando el cliente paga la patente.'
    }
  }
  return salesErrorMessage(error)
}

function positiveAmount(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

const collectionLabels = {
  SIN_REGISTRAR: 'Sin registrar',
  PENDIENTE: 'Registrado, pendiente de caja',
  PAGO_PARCIAL: 'Cobrado parcialmente',
  PAGADO: 'Cobrado',
} as const

const paymentLabels = {
  SIN_REGISTRAR: 'Sin registrar',
  PENDIENTE: 'Registrado como pendiente',
  PAGADO: 'Pagado',
} as const

export function LicensingModal({
  operation: initialOperation,
  permissions,
  globalAccess = false,
  onClose,
  onChanged,
}: {
  operation: SalesOperation
  permissions: readonly string[] | undefined
  globalAccess?: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [operation, setOperation] = useState(initialOperation)
  const licensing = operation.licensing
  const canManage = hasPermission(permissions, 'ventas.patentamiento.gestionar')
  const canCollect = hasPermission(permissions, 'ingresos.gestionar')
  const canPay = hasPermission(permissions, 'pagos_vehiculo.gestionar')

  const [mode, setMode] = useState<SalesLicensingMode | ''>(licensing.mode ?? '')
  const [amount, setAmount] = useState(licensing.amount ?? '')
  const [busy, setBusy] = useState<'mode' | 'collection' | 'payment' | null>(
    null,
  )
  const [error, setError] = useState('')

  const [collectionDate, setCollectionDate] = useState(localIsoDate())
  const [collectionAmount, setCollectionAmount] = useState(
    licensing.amount ?? '',
  )

  const [paymentDate, setPaymentDate] = useState(localIsoDate())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'PAGADO' | 'PENDIENTE'>(
    'PAGADO',
  )
  const [providerId, setProviderId] = useState('')
  const [providers, setProviders] = useState<CatalogOption[]>([])
  const [concept, setConcept] = useState<CatalogOption | null>(null)
  const [catalogError, setCatalogError] = useState('')

  const dialogRef = useDialogFocus(onClose, busy !== null)
  const effectiveMode = licensing.mode
  const unit = operation.vehicle.unit

  useEffect(() => {
    if (effectiveMode !== 'BONIFICADA' || !canPay) return
    const controller = new AbortController()
    setCatalogError('')
    Promise.all([
      listVehiclePaymentConcepts(controller.signal),
      listVehiclePaymentProviders(controller.signal),
    ])
      .then(([concepts, providerOptions]) => {
        const patent = concepts.find(
          (item) =>
            item.name.trim().toLocaleLowerCase('es-AR') ===
            LICENSING_CATALOG_NAME,
        )
        setConcept(patent ?? null)
        setProviders(providerOptions)
        setProviderId((current) => current || providerOptions[0]?.id || '')
        if (!patent) {
          setCatalogError('No existe el concepto de pago "Patente".')
        }
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setCatalogError(salesErrorMessage(loadError))
      })
    return () => controller.abort()
  }, [canPay, effectiveMode])

  const organizationScope =
    globalAccess ? { organizationId: operation.organizationId } : {}

  const saveMode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mode) return
    const parsedAmount = mode === 'PAGA_CLIENTE' && amount.trim()
      ? positiveAmount(amount)
      : null
    if (mode === 'PAGA_CLIENTE' && amount.trim() && parsedAmount === null) {
      setError('Ingresá un importe mayor a cero o dejalo vacío.')
      return
    }
    setBusy('mode')
    setError('')
    try {
      const updated = await updateSalesLicensing(operation.id, {
        expectedVersion: operation.rowVersion,
        mode,
        ...(parsedAmount !== null ? { amount: parsedAmount } : {}),
      })
      setOperation(updated)
      setAmount(updated.licensing.amount ?? '')
      setCollectionAmount(updated.licensing.amount ?? '')
      onChanged()
      void alertSuccess('Se actualizó el patentamiento de la operación.')
    } catch (saveError) {
      setError(licensingErrorMessage(saveError))
    } finally {
      setBusy(null)
    }
  }

  const registerCollection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = positiveAmount(collectionAmount)
    if (value === null) {
      setError('Ingresá el importe cobrado al cliente.')
      return
    }
    setBusy('collection')
    setError('')
    try {
      await createFinancialRecord('income', {
        ...organizationScope,
        branchId: operation.branch.id,
        incomeDate: collectionDate,
        type: 'Patente',
        operationId: operation.id,
        ...(unit ? { unitId: unit.id } : {}),
        ...(operation.ticketNumber ? { reference: operation.ticketNumber } : {}),
        description: `Cobro de patente · operación #${operation.number}`,
        totalAmount: value.toFixed(2),
      })
      onChanged()
      void alertSuccess(
        'Se registró el cobro de patente. La acreditación en caja se gestiona desde Ingresos.',
      )
      onClose()
    } catch (saveError) {
      setError(licensingErrorMessage(saveError))
    } finally {
      setBusy(null)
    }
  }

  const registerPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = positiveAmount(paymentAmount)
    if (!unit || !concept) return
    if (!providerId) {
      setError('Elegí el proveedor o gestoría.')
      return
    }
    if (value === null) {
      setError('Ingresá el importe pagado.')
      return
    }
    setBusy('payment')
    setError('')
    try {
      await createVehiclePayment({
        ...organizationScope,
        conceptId: concept.id,
        unitId: unit.id,
        operationId: operation.id,
        providerId,
        amount: value,
        paymentDate,
        status: paymentStatus,
        ...(operation.ticketNumber
          ? { notes: `Boleto ${operation.ticketNumber}` }
          : {}),
      })
      onChanged()
      void alertSuccess('Se registró el pago de la patente.')
      onClose()
    } catch (saveError) {
      setError(licensingErrorMessage(saveError))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="licensing-modal-title"
        aria-modal="true"
        className="client-modal licensing-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">PATENTAMIENTO</p>
            <h2 id="licensing-modal-title">
              Operación #{operation.number}
              {operation.ticketNumber ? ` · boleto ${operation.ticketNumber}` : ''}
            </h2>
          </div>
          <button
            aria-label="Cerrar patentamiento"
            className="icon-button"
            disabled={busy !== null}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <dl className="confirm-preview__section">
          <div className="confirm-preview__row">
            <dt>Estado</dt>
            <dd>
              <span
                className={`status-badge ${licensingStatusClass(licensing.status)}`}
              >
                {licensingStatusLabels[licensing.status]}
              </span>
            </dd>
          </div>
          <div className="confirm-preview__row">
            <dt>Llegada</dt>
            <dd>
              {licensing.plateLoaded
                ? `Patente cargada${unit?.licensePlate ? ` (${unit.licensePlate})` : ''}`
                : licensingWindowLabel(
                    licensing.estimatedFrom,
                    licensing.estimatedTo,
                  )}
              {licensing.overdue && (
                <span className="licensing-overdue">
                  {' '}
                  · pasó la fecha estimada
                </span>
              )}
            </dd>
          </div>
          <div className="confirm-preview__row">
            <dt>Cobro al cliente</dt>
            <dd>
              {collectionLabels[licensing.collection.status]}
              {licensing.collection.status !== 'SIN_REGISTRAR' &&
                ` · ${formatMoney(licensing.collection.amount, operation.currency)}`}
            </dd>
          </div>
          <div className="confirm-preview__row">
            <dt>Pago de patente</dt>
            <dd>
              {paymentLabels[licensing.payment.status]}
              {licensing.payment.status !== 'SIN_REGISTRAR' &&
                ` · ${formatMoney(licensing.payment.amount, operation.currency)}`}
            </dd>
          </div>
        </dl>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}

        {canManage && (
          <form className="licensing-modal__section" onSubmit={saveMode}>
            <h3>Modalidad</h3>
            <div className="client-form-grid">
              <div className="field">
                <span id="licensing-modal-mode-label">Patentamiento *</span>
                <select
                  aria-labelledby="licensing-modal-mode-label"
                  onChange={(event) => {
                    const next = event.target.value as SalesLicensingMode | ''
                    setMode(next)
                    if (next !== 'PAGA_CLIENTE') setAmount('')
                  }}
                  value={mode}
                >
                  {!licensing.mode && <option value="">Sin definir</option>}
                  <option value="BONIFICADA">
                    {licensingModeLabels.BONIFICADA}
                  </option>
                  <option value="PAGA_CLIENTE">
                    {licensingModeLabels.PAGA_CLIENTE}
                  </option>
                </select>
                {mode && <small>{licensingModeDescriptions[mode]}</small>}
              </div>
              {mode === 'PAGA_CLIENTE' && (
                <label className="field">
                  <span>Importe de patente</span>
                  <input
                    min="0.01"
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Opcional"
                    step="0.01"
                    type="number"
                    value={amount}
                  />
                </label>
              )}
            </div>
            <div className="client-modal__actions">
              <button
                className="button button--primary"
                disabled={busy !== null || !mode}
                type="submit"
              >
                {busy === 'mode' && <LoaderCircle className="spin" size={17} />}
                Guardar modalidad
              </button>
            </div>
          </form>
        )}

        {effectiveMode === 'PAGA_CLIENTE' && canCollect && (
          <form
            aria-label="Registrar cobro al cliente"
            className="licensing-modal__section"
            onSubmit={registerCollection}
          >
            <h3>Registrar cobro al cliente</h3>
            <div className="client-form-grid">
              <label className="field">
                <span>Fecha *</span>
                <input
                  onChange={(event) => setCollectionDate(event.target.value)}
                  required
                  type="date"
                  value={collectionDate}
                />
              </label>
              <label className="field">
                <span>Importe cobrado *</span>
                <input
                  min="0.01"
                  onChange={(event) => setCollectionAmount(event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={collectionAmount}
                />
              </label>
            </div>
            <small>
              Se registra como ingreso de tipo Patente vinculado a la
              operación; la acreditación en caja se hace desde Ingresos.
            </small>
            <div className="client-modal__actions">
              <button
                className="button button--primary"
                disabled={busy !== null}
                type="submit"
              >
                {busy === 'collection' && (
                  <LoaderCircle className="spin" size={17} />
                )}
                Registrar cobro
              </button>
            </div>
          </form>
        )}

        {effectiveMode === 'BONIFICADA' && canPay && (
          <form
            aria-label="Registrar pago de patente"
            className="licensing-modal__section"
            onSubmit={registerPayment}
          >
            <h3>Registrar pago de patente</h3>
            {!unit ? (
              <p className="modal-description">
                La operación todavía no tiene una unidad asignada. El pago se
                registra cuando se recibe la unidad.
              </p>
            ) : catalogError ? (
              <p className="field-error">{catalogError}</p>
            ) : (
              <>
                <div className="client-form-grid">
                  <label className="field">
                    <span>Proveedor / gestoría *</span>
                    <select
                      onChange={(event) => setProviderId(event.target.value)}
                      value={providerId}
                    >
                      <option value="">Seleccionar</option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Importe *</span>
                    <input
                      min="0.01"
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      required
                      step="0.01"
                      type="number"
                      value={paymentAmount}
                    />
                  </label>
                  <label className="field">
                    <span>Fecha *</span>
                    <input
                      onChange={(event) => setPaymentDate(event.target.value)}
                      required
                      type="date"
                      value={paymentDate}
                    />
                  </label>
                  <label className="field">
                    <span>Estado</span>
                    <select
                      onChange={(event) =>
                        setPaymentStatus(
                          event.target.value as 'PAGADO' | 'PENDIENTE',
                        )
                      }
                      value={paymentStatus}
                    >
                      <option value="PAGADO">Pagado</option>
                      <option value="PENDIENTE">Pendiente</option>
                    </select>
                  </label>
                </div>
                <div className="client-modal__actions">
                  <button
                    className="button button--primary"
                    disabled={busy !== null || !concept}
                    type="submit"
                  >
                    {busy === 'payment' && (
                      <LoaderCircle className="spin" size={17} />
                    )}
                    Registrar pago
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
