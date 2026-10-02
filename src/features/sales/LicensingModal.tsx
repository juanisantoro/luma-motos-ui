import { useEffect, useState, type FormEvent } from 'react'
import { FileText, LoaderCircle, X } from 'lucide-react'
import { ApiError } from '../../shared/api/client'
import { alertSuccess } from '../../shared/alerts'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { localIsoDate } from '../../shared/utils/date'
import { hasPermission } from '../auth/PermissionRoute'
import { listAllCashAccounts } from '../finance/api'
import { cashAccountLabel, usableCashAccounts } from '../finance/cashAccounts'
import { newIdempotencyKey } from '../finance/format'
import type { CashAccount } from '../finance/types'
import {
  collectSalesLicensing,
  registerSalesLicensePlate,
  updateSalesLicensing,
} from './api'
import { salesErrorMessage } from './errors'
import { fulfillmentLabel, operationFulfillment } from './fulfillment'
import {
  canRegisterPlate,
  formatIsoDate,
  isValidPlate,
  licensingModeDescriptions,
  licensingModeLabels,
  licensingStatusClass,
  licensingStatusLabels,
  plateStatusClass,
  plateStatusLabel,
  plateStatusOf,
} from './licensing'
import { formatMoney } from './presentation'
import {
  cashCollectionErrorMessage,
  listHandoverRecipients,
  paymentMethodLabels,
  type HandoverRecipient,
  type PaymentMethod,
} from './tracking'
import type {
  RegisterSalesLicensingCollectionInput,
  SalesLicensingMode,
  SalesOperation,
} from './types'

export function licensingErrorMessage(error: unknown) {
  const shared = cashCollectionErrorMessage(error)
  if (shared) return shared
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
    if (code === 'LICENSING_COLLECTION_NOT_ALLOWED') {
      return 'Sólo se registra cobro cuando el cliente paga la patente.'
    }
    if (code === 'INVALID_LICENSE_PLATE') {
      return 'Revisá la patente: debe tener entre 5 y 10 letras o números.'
    }
    if (code === 'LICENSE_PLATE_IN_USE') {
      const vin = error.details?.details?.vin
      return `Esa patente ya está cargada en otra unidad${typeof vin === 'string' ? ` (${vin})` : ''}.`
    }
    if (code === 'LICENSE_PLATE_RECEIVED_IN_FUTURE') {
      return 'La fecha de recepción no puede ser futura.'
    }
    if (code === 'LICENSE_PLATE_RECEIVED_BEFORE_OPERATION') {
      return 'La fecha de recepción no puede ser anterior a la operación.'
    }
    if (code === 'LICENSE_PLATE_NOT_ALLOWED') {
      return 'La patente se carga en operaciones enviadas, aprobadas o cerradas.'
    }
    if (code === 'LICENSING_MODE_REQUIRED') {
      return 'Definí primero si la patente es bonificada o la paga el cliente.'
    }
    if (code === 'OPERATION_UNIT_REQUIRED') {
      return 'La operación todavía no tiene una unidad asignada.'
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

const METHODS = Object.keys(paymentMethodLabels) as PaymentMethod[]

type CollectionDraft = {
  accountId: string
  date: string
  amount: string
  method: PaymentMethod
  handoverToId: string
}

// Cobro de patente al cliente: medio, cuenta y, si es efectivo, a quién se
// rinde (circuito de la fase 4). Lo registra quien carga el cobro.
function CollectionFields({
  draft,
  onChange,
  accounts,
  accountsError,
  recipients,
}: {
  draft: CollectionDraft
  onChange: (next: Partial<CollectionDraft>) => void
  accounts: CashAccount[]
  accountsError: string
  recipients: HandoverRecipient[]
}) {
  return (
    <>
      {accountsError && <p className="field-error">{accountsError}</p>}
      <div className="client-form-grid">
        <label className="field">
          <span>Importe cobrado *</span>
          <input
            min="0.01"
            onChange={(event) => onChange({ amount: event.target.value })}
            required
            step="0.01"
            type="number"
            value={draft.amount}
          />
        </label>
        <label className="field">
          <span>Fecha del cobro *</span>
          <input
            onChange={(event) => onChange({ date: event.target.value })}
            required
            type="date"
            value={draft.date}
          />
        </label>
        <label className="field">
          <span>Medio *</span>
          <select
            onChange={(event) =>
              onChange({ method: event.target.value as PaymentMethod })
            }
            required
            value={draft.method}
          >
            {METHODS.map((item) => (
              <option key={item} value={item}>
                {paymentMethodLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cuenta de caja *</span>
          <select
            onChange={(event) => onChange({ accountId: event.target.value })}
            required
            value={draft.accountId}
          >
            <option value="">Seleccionar cuenta</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {cashAccountLabel(account)}
              </option>
            ))}
          </select>
        </label>
        {draft.method === 'EFECTIVO' && (
          <label className="field field--wide">
            <span>Se rinde a *</span>
            <select
              onChange={(event) => onChange({ handoverToId: event.target.value })}
              required
              value={draft.handoverToId}
            >
              <option value="">Seleccionar quién recibe el efectivo</option>
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.fullName}
                  {recipient.isCurrentUser ? ' (vos)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <small>
        Crea el ingreso de tipo Patente vinculado a la operación, el cliente y
        el boleto, y lo acredita en la cuenta elegida. Queda registrado que lo
        recibiste vos.
      </small>
    </>
  )
}

export function LicensingModal({
  operation: initialOperation,
  permissions,
  onClose,
  onChanged,
  onRegisterPayment,
}: {
  operation: SalesOperation
  permissions: readonly string[] | undefined
  // Kept for callers that pass it; the payment to the gestoría is no longer
  // registered from here (it lives in vehicle payments).
  globalAccess?: boolean
  onClose: () => void
  onChanged: () => void
  // Fase 5: abre el formulario de pagos de vehículo precargado. Sin callback
  // (por ejemplo, abierto desde pagos de vehículo) no se ofrece.
  onRegisterPayment?: (operation: SalesOperation) => void
}) {
  const [operation, setOperation] = useState(initialOperation)
  const licensing = operation.licensing
  const canManage = hasPermission(permissions, 'ventas.patentamiento.gestionar')
  // Cobro en un paso: crea el ingreso y lo acredita en caja.
  const canCollect =
    canManage && hasPermission(permissions, 'ingresos.cobrar')
  const canPay = hasPermission(permissions, 'pagos_vehiculo.gestionar')

  const [mode, setMode] = useState<SalesLicensingMode | ''>(licensing.mode ?? '')
  const [amount, setAmount] = useState(licensing.amount ?? '')
  const [busy, setBusy] = useState<'mode' | 'collection' | 'plate' | null>(
    null,
  )
  const [error, setError] = useState('')

  const effectiveMode = licensing.mode
  const unit = operation.vehicle.unit
  const plateStatus = plateStatusOf(licensing)
  const plateReceived =
    plateStatus === 'RECIBIDA' ||
    plateStatus === 'RECIBIDA_COBRO_PENDIENTE' ||
    plateStatus === 'RECIBIDA_COBRADA'
  const collectionCovered = licensing.status === 'COBRADO'
  const paysClient = effectiveMode === 'PAGA_CLIENTE'
  const needsCollection = paysClient && canCollect && !collectionCovered

  const [plateNumber, setPlateNumber] = useState(
    licensing.plate?.number ?? unit?.licensePlate ?? '',
  )
  const [plateReceivedAt, setPlateReceivedAt] = useState(
    licensing.plate?.receivedAt ?? localIsoDate(),
  )
  // PAGA_CLIENTE: el cobro puede registrarse antes de que llegue la patente,
  // en el mismo paso que la carga o después.
  const [collectWithPlate, setCollectWithPlate] = useState(false)
  const [collection, setCollection] = useState<CollectionDraft>({
    accountId: '',
    date: localIsoDate(),
    amount: licensing.amount ?? '',
    method: 'EFECTIVO',
    handoverToId: '',
  })
  const changeCollection = (next: Partial<CollectionDraft>) =>
    setCollection((current) => ({ ...current, ...next }))
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [accountsError, setAccountsError] = useState('')
  const [recipients, setRecipients] = useState<HandoverRecipient[]>([])
  // Una clave por apertura del modal: un reintento no duplica el cobro.
  const [collectionKey] = useState(newIdempotencyKey)

  const dialogRef = useDialogFocus(onClose, busy !== null)

  useEffect(() => {
    if (!needsCollection) return
    const controller = new AbortController()
    setAccountsError('')
    listAllCashAccounts(controller.signal)
      .then((items) => {
        // Las cuentas históricas importadas quedan al final.
        const usable = usableCashAccounts(items, {
          currency: operation.currency,
          branchId: operation.branch.id,
        })
        setAccounts(usable)
        setCollection((current) => ({
          ...current,
          accountId: current.accountId || usable[0]?.id || '',
        }))
        if (!usable.length) {
          setAccountsError(
            'No hay cuentas de caja activas para la sucursal de la operación.',
          )
        }
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setAccountsError(salesErrorMessage(loadError))
      })
    listHandoverRecipients(controller.signal)
      .then((items) => {
        setRecipients(items)
        setCollection((current) => ({
          ...current,
          handoverToId:
            current.handoverToId ||
            (items.length === 1 ? (items[0]?.id ?? '') : ''),
        }))
      })
      .catch(() => {
        if (!controller.signal.aborted) setRecipients([])
      })
    return () => controller.abort()
  }, [needsCollection, operation.branch.id, operation.currency])

  const collectionInput = (): RegisterSalesLicensingCollectionInput | string => {
    const value = positiveAmount(collection.amount)
    if (value === null) return 'Ingresá el importe cobrado al cliente.'
    if (!collection.accountId)
      return 'Elegí la cuenta de caja donde ingresa el dinero.'
    const cash = collection.method === 'EFECTIVO'
    if (cash && !collection.handoverToId)
      return 'Indicá a quién se rinde el efectivo.'
    return {
      idempotencyKey: collectionKey,
      accountId: collection.accountId,
      amount: value.toFixed(2),
      collectionDate: collection.date,
      paymentMethod: collection.method,
      ...(cash ? { handoverToId: collection.handoverToId } : {}),
    }
  }

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
      changeCollection({ amount: updated.licensing.amount ?? '' })
      onChanged()
      void alertSuccess('Se actualizó el patentamiento de la operación.')
    } catch (saveError) {
      setError(licensingErrorMessage(saveError))
    } finally {
      setBusy(null)
    }
  }

  const registerPlate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValidPlate(plateNumber)) {
      setError('Ingresá la patente: entre 5 y 10 letras o números.')
      return
    }
    const withCollection = needsCollection && !plateReceived && collectWithPlate
    const payload = withCollection ? collectionInput() : undefined
    if (typeof payload === 'string') {
      setError(payload)
      return
    }
    setBusy('plate')
    setError('')
    try {
      const updated = await registerSalesLicensePlate(operation.id, {
        expectedVersion: operation.rowVersion,
        licensePlate: plateNumber.trim(),
        receivedAt: plateReceivedAt,
        ...(payload ? { collection: payload } : {}),
      })
      setOperation(updated)
      onChanged()
      void alertSuccess(
        payload
          ? 'Se cargó la patente y se registró el cobro al cliente.'
          : effectiveMode === 'PAGA_CLIENTE'
            ? 'Se cargó la patente. El cobro al cliente queda pendiente.'
            : 'Se cargó la patente.',
      )
      onClose()
    } catch (saveError) {
      setError(licensingErrorMessage(saveError))
    } finally {
      setBusy(null)
    }
  }

  const registerCollection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = collectionInput()
    if (typeof payload === 'string') {
      setError(payload)
      return
    }
    setBusy('collection')
    setError('')
    try {
      const updated = await collectSalesLicensing(operation.id, payload)
      setOperation(updated)
      onChanged()
      void alertSuccess(
        payload.paymentMethod === 'EFECTIVO'
          ? 'Se registró el cobro de patente. El efectivo queda pendiente de rendición.'
          : 'Se registró el cobro de patente y se acreditó en caja.',
      )
      onClose()
    } catch (saveError) {
      setError(licensingErrorMessage(saveError))
    } finally {
      setBusy(null)
    }
  }

  const fulfillment = operationFulfillment(operation)

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
            <dt>Patente</dt>
            <dd>
              {plateStatus ? (
                <span className={`status-badge ${plateStatusClass(plateStatus)}`}>
                  {plateStatusLabel(plateStatus, licensing)}
                </span>
              ) : (
                '—'
              )}
              {plateReceived && (licensing.plate?.number ?? unit?.licensePlate) && (
                <> · {licensing.plate?.number ?? unit?.licensePlate}</>
              )}
              {licensing.plate?.receivedAt && (
                <> · recibida el {formatIsoDate(licensing.plate.receivedAt)}</>
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
            <dt>Pago a la gestoría</dt>
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

        {canManage && effectiveMode && operation.status !== 'CANCELADA' && (
          <section
            aria-label="Llegada de la patente"
            className="licensing-modal__section"
          >
            <h3>{plateReceived ? 'Corregir patente' : 'Llegada de la patente'}</h3>
            {!canRegisterPlate(operation) ? (
              <p className="modal-description">
                {!unit
                  ? `La operación todavía no tiene unidad (${fulfillmentLabel(fulfillment).toLocaleLowerCase('es-AR')}). La patente se carga cuando la unidad está asignada.`
                  : 'La patente se carga en operaciones enviadas, aprobadas o cerradas.'}
              </p>
            ) : (
              <form aria-label="Cargar patente" onSubmit={registerPlate}>
                <div className="client-form-grid">
                  <label className="field">
                    <span>Número de patente *</span>
                    <input
                      autoComplete="off"
                      maxLength={20}
                      onChange={(event) =>
                        setPlateNumber(event.target.value.toUpperCase())
                      }
                      placeholder="A123BCD"
                      required
                      value={plateNumber}
                    />
                  </label>
                  <label className="field">
                    <span>Fecha de recepción *</span>
                    <input
                      max={localIsoDate()}
                      onChange={(event) => setPlateReceivedAt(event.target.value)}
                      required
                      type="date"
                      value={plateReceivedAt}
                    />
                  </label>
                </div>
                {effectiveMode === 'BONIFICADA' && !plateReceived && (
                  <small>Bonificada: sólo se carga el número, no se cobra nada.</small>
                )}
                {needsCollection && !plateReceived && (
                  <>
                    <label className="operation-check">
                      <input
                        checked={collectWithPlate}
                        onChange={(event) =>
                          setCollectWithPlate(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>Registrar también el cobro de la patente al cliente</span>
                    </label>
                    {collectWithPlate ? (
                      <CollectionFields
                        accounts={accounts}
                        accountsError={accountsError}
                        draft={collection}
                        onChange={changeCollection}
                        recipients={recipients}
                      />
                    ) : (
                      <small>
                        Si el cliente todavía no pagó, la patente queda
                        recibida con el pago pendiente hasta que registres el
                        cobro.
                      </small>
                    )}
                  </>
                )}
                <div className="client-modal__actions">
                  <button
                    className="button button--primary"
                    disabled={busy !== null}
                    type="submit"
                  >
                    {busy === 'plate' && <LoaderCircle className="spin" size={17} />}
                    {plateReceived ? 'Guardar patente' : 'Cargar patente'}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* El cobro se puede registrar en cualquier momento: antes de que
            llegue la patente, junto con la carga (checkbox) o después. */}
        {needsCollection && !(collectWithPlate && !plateReceived && canRegisterPlate(operation)) && (
          <form
            aria-label="Registrar cobro al cliente"
            className="licensing-modal__section"
            onSubmit={registerCollection}
          >
            <h3>Registrar cobro al cliente</h3>
            <CollectionFields
              accounts={accounts}
              accountsError={accountsError}
              draft={collection}
              onChange={changeCollection}
              recipients={recipients}
            />
            <div className="client-modal__actions">
              <button
                className="button button--primary"
                disabled={busy !== null || !collection.accountId}
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

        {canPay && onRegisterPayment && (
          <section
            aria-label="Pago de patente a la gestoría"
            className="licensing-modal__section"
          >
            <h3>Pago de patente a la gestoría</h3>
            {!unit ? (
              <p className="modal-description">
                La operación todavía no tiene una unidad asignada. El pago se
                registra cuando se recibe la unidad.
              </p>
            ) : (
              <>
                <p className="modal-description">
                  Se registra en pagos de vehículo, con el formulario precargado
                  con esta operación.
                </p>
                <div className="client-modal__actions">
                  <button
                    className="button button--secondary"
                    disabled={busy !== null}
                    onClick={() => onRegisterPayment(operation)}
                    type="button"
                  >
                    <FileText size={16} />
                    Registrar pago de patente
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
