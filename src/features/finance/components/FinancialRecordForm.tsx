import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  addSettlement,
  createFinancialRecord,
  listAllCashAccounts,
  listAllCatalogVersions,
  listAllInventoryUnits,
  listAllSuppliers,
  listIncomeTypes,
  listInventoryBranches,
  listInventoryUnits,
  listSalesOperations,
} from '../api'
import {
  financialErrorMessage,
  financialLabels,
  formatMoney,
  newIdempotencyKey,
} from '../format'
import {
  accountForRecipient,
  cashAccountLabel,
  currencies,
  currencyLabels,
  currencyName,
  usableCashAccounts,
} from '../cashAccounts'
import {
  cashCollectionErrorMessage,
  collectPaymentComponent,
  collectibleComponents,
  componentLabel,
  defaultPaymentMethod,
  listHandoverRecipients,
  listOperationTracking,
  paymentMethodLabels,
  type HandoverRecipient,
  type OperationTrackingRow,
  type TrackingPaymentComponent,
} from '../../sales/tracking'
import { componentCollectionErrorMessage } from '../../sales/ComponentCollectionModal'
import { alertError, alertSuccess } from '../../../shared/alerts'
import { localIsoDate } from '../../../shared/utils/date'
import type {
  CreateExpenseInput,
  CreateIncomeInput,
  CreatePurchaseInput,
  FinancialKind,
  FinancialVehicleType,
  BranchOption,
  CashAccount,
  IncomePaymentMethod,
  IncomeTypeOption,
  SupplierOption,
  UnitOption,
  VersionOption,
  SalesOperationOption,
} from '../types'
import { useAuth } from '../../auth/AuthContext'
import { hasPermission } from '../../auth/PermissionRoute'
import {
  branchScopeKey,
  defaultBranchId as scopedDefaultBranchId,
  filterAllowedBranches,
  isBranchSelectionLocked,
} from '../../auth/branchScope'
import { displayVersion } from '../../../shared/utils/vehicleVersion'

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

const INCOME_METHODS = Object.keys(paymentMethodLabels) as IncomePaymentMethod[]

// El pago de la venta (total o parcial) usa el mismo circuito que
// Seguimiento de cobros → Cobrar: baja el saldo de la operación.
const OPERATION_PAYMENT_TYPE = 'Cobro de operación'
// Tipos que no se cargan a mano: las cuotas se cobran en Cobranza de cuotas
// y la patente del cliente en Operaciones → Patentamiento → Gestionar.
const HIDDEN_INCOME_TYPES = new Set([
  'Cuota crédito',
  'Pago total de la moto',
  'Patente',
])

function operationPaymentLabel(vehicleType?: FinancialVehicleType) {
  return vehicleType === 'AUTO'
    ? 'Pago del auto (venta)'
    : 'Pago de la moto (venta)'
}

// Cómo se le nombra a la administrativa cada parte del plan de pago.
function planPartLabel(component: TrackingPaymentComponent) {
  if (component.type === 'EFECTIVO') return 'Lo pactado en efectivo'
  if (component.type === 'TRANSFERENCIA_BANCARIA')
    return 'Lo pactado por transferencia'
  if (component.type === 'TARJETA') return 'Lo pactado con tarjeta'
  return componentLabel(component)
}

function operationTitle(operation: OperationTrackingRow) {
  return `#${operation.number}${
    operation.ticketNumber ? ` · boleto ${operation.ticketNumber}` : ''
  } · ${operation.client.fullName}`
}

function incomeErrorMessage(error: unknown) {
  return cashCollectionErrorMessage(error) ?? financialErrorMessage(error)
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
  const [incomeTypes, setIncomeTypes] = useState<IncomeTypeOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [versions, setVersions] = useState<VersionOption[]>([])
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
  // A user with a single allowed branch cannot pick another one.
  const branchLocked = isBranchSelectionLocked(user, branches)
  const scopeKey = branchScopeKey(user)
  const userBranchId = user?.branch?.id ?? null
  const canViewOperations = hasPermission(
    user?.role.permissions,
    'ventas.consultar',
  )

  // Ingresos: medio, quién recibió la plata, a quién se rinde y en qué
  // cuenta entra, igual que el cobro de una venta.
  const canCollect = hasPermission(user?.role.permissions, 'ingresos.cobrar')
  const [method, setMethod] = useState<IncomePaymentMethod>('EFECTIVO')
  const [handoverToId, setHandoverToId] = useState('')
  const [collectNow, setCollectNow] = useState(canCollect)
  const [accountId, setAccountId] = useState('')
  // Moneda del registro: define en qué cuentas puede entrar el cobro.
  const [currency, setCurrency] = useState('ARS')
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [recipients, setRecipients] = useState<HandoverRecipient[]>([])
  const [idempotencyKey] = useState(newIdempotencyKey)
  const isCash = method === 'EFECTIVO'

  // Pago de la venta: el formulario se agranda y cobra contra la operación.
  const canCollectOperations = canCollect && canViewOperations
  const [incomeType, setIncomeType] = useState('')
  const operationPayment =
    kind === 'income' && incomeType === OPERATION_PAYMENT_TYPE
  const [paySearch, setPaySearch] = useState('')
  const [debouncedPaySearch, setDebouncedPaySearch] = useState('')
  const [payOptions, setPayOptions] = useState<OperationTrackingRow[]>([])
  const [payLoading, setPayLoading] = useState(false)
  const [payOperation, setPayOperation] = useState<OperationTrackingRow | null>(
    null,
  )
  const [payComponentId, setPayComponentId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const payComponents = payOperation ? collectibleComponents(payOperation) : []
  const payComponent = payComponents.find((item) => item.id === payComponentId)
  const payBlockedReason = !payOperation
    ? ''
    : payOperation.status === 'CANCELADA'
      ? 'La operación está cancelada: no se le pueden cargar cobros.'
      : payComponents.length === 0
        ? payOperation.ownCredit
          ? 'Esta operación no tiene saldo para cobrar acá. Las cuotas del crédito propio se cobran en Cobranza de cuotas.'
          : 'Esta operación no tiene saldo pendiente de cobro.'
        : ''
  const visibleIncomeTypes = incomeTypes.filter(
    (type) =>
      !HIDDEN_INCOME_TYPES.has(type.name) &&
      (type.name !== OPERATION_PAYMENT_TYPE || canCollectOperations),
  )
  const showCollection = operationPayment || (canCollect && collectNow)

  const branchAccounts = usableCashAccounts(
    accounts,
    operationPayment
      ? {
          branchId: payOperation?.branch.id ?? null,
          ...(payOperation ? { currency: payOperation.currency } : {}),
        }
      : { branchId: branchId || null, currency },
  )
  const accountCurrency = operationPayment
    ? (payOperation?.currency ?? 'ARS')
    : currency
  // Efectivo: la caja no se elige, es la de quien recibe la rendición.
  const recipientAccount =
    isCash && handoverToId
      ? accountForRecipient(branchAccounts, handoverToId)
      : null
  const recipientName =
    recipients.find((recipient) => recipient.id === handoverToId)?.fullName ??
    ''
  const collectionAccountId = isCash ? (recipientAccount?.id ?? '') : accountId

  const [incomeUnitSearch, setIncomeUnitSearch] = useState('')
  const [debouncedIncomeUnitSearch, setDebouncedIncomeUnitSearch] = useState('')
  const [incomeUnitOptions, setIncomeUnitOptions] = useState<UnitOption[]>([])
  const [incomeUnitLoading, setIncomeUnitLoading] = useState(false)
  const [selectedIncomeUnit, setSelectedIncomeUnit] = useState<UnitOption | null>(null)

  const [incomeOperationSearch, setIncomeOperationSearch] = useState('')
  const [debouncedIncomeOperationSearch, setDebouncedIncomeOperationSearch] = useState('')
  const [incomeOperationOptions, setIncomeOperationOptions] = useState<SalesOperationOption[]>([])
  const [incomeOperationLoading, setIncomeOperationLoading] = useState(false)
  const [selectedIncomeOperation, setSelectedIncomeOperation] = useState<SalesOperationOption | null>(null)

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
        listInventoryBranches(controller.signal).then((items) => {
          const allowed = filterAllowedBranches(scopeKey, items)
          setBranches(allowed)
          setBranchId((current) =>
            allowed.some((branch) => branch.id === current)
              ? current
              : scopedDefaultBranchId(scopeKey, allowed, userBranchId),
          )
        }),
      )
    }
    if (kind === 'purchase') {
      requests.push(
        listAllInventoryUnits(vehicleType, controller.signal).then(setUnits),
        listAllSuppliers(controller.signal).then(setSuppliers),
        listAllCatalogVersions(vehicleType, controller.signal).then(setVersions),
      )
    } else if (kind === 'income') {
      requests.push(
        listIncomeTypes(controller.signal).then(setIncomeTypes),
        // Los catálogos de cobro no bloquean el alta si el rol no los ve.
        listHandoverRecipients(controller.signal)
          .then((items) => {
            setRecipients(items)
            if (items.length === 1)
              setHandoverToId((current) => current || items[0]!.id)
          })
          .catch(() => undefined),
        listAllCashAccounts(controller.signal)
          .then(setAccounts)
          .catch(() => undefined),
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
  }, [canViewOperations, kind, scopeKey, userBranchId, vehicleType])

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedIncomeUnitSearch(incomeUnitSearch.trim()),
      350,
    )
    return () => clearTimeout(timeout)
  }, [incomeUnitSearch])

  useEffect(() => {
    if (kind !== 'income') return
    if (debouncedIncomeUnitSearch.length < 3) {
      setIncomeUnitOptions([])
      setIncomeUnitLoading(false)
      return
    }
    const controller = new AbortController()
    setIncomeUnitLoading(true)
    listInventoryUnits(vehicleType, controller.signal, debouncedIncomeUnitSearch)
      .then((page) => {
        if (controller.signal.aborted) return
        setIncomeUnitOptions(page.items)
        setIncomeUnitLoading(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setIncomeUnitOptions([])
        setIncomeUnitLoading(false)
      })
    return () => controller.abort()
  }, [debouncedIncomeUnitSearch, kind, vehicleType])

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedIncomeOperationSearch(incomeOperationSearch.trim()),
      350,
    )
    return () => clearTimeout(timeout)
  }, [incomeOperationSearch])

  useEffect(() => {
    if (kind !== 'income' || !canViewOperations) return
    if (debouncedIncomeOperationSearch.length < 3) {
      setIncomeOperationOptions([])
      setIncomeOperationLoading(false)
      return
    }
    const controller = new AbortController()
    setIncomeOperationLoading(true)
    listSalesOperations(vehicleType, controller.signal, debouncedIncomeOperationSearch)
      .then((page) => {
        if (controller.signal.aborted) return
        setIncomeOperationOptions(page.items)
        setIncomeOperationLoading(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setIncomeOperationOptions([])
        setIncomeOperationLoading(false)
      })
    return () => controller.abort()
  }, [canViewOperations, debouncedIncomeOperationSearch, kind, vehicleType])

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedPaySearch(paySearch.trim()),
      350,
    )
    return () => clearTimeout(timeout)
  }, [paySearch])

  useEffect(() => {
    if (!operationPayment) return
    if (debouncedPaySearch.length < 2) {
      setPayOptions([])
      setPayLoading(false)
      return
    }
    const controller = new AbortController()
    setPayLoading(true)
    listOperationTracking(
      {
        vehicleType: vehicleType ?? 'MOTO',
        page: 1,
        limit: 8,
        search: debouncedPaySearch,
      },
      controller.signal,
    )
      .then((page) => {
        if (controller.signal.aborted) return
        setPayOptions(page.items)
        setPayLoading(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setPayOptions([])
        setPayLoading(false)
      })
    return () => controller.abort()
  }, [debouncedPaySearch, operationPayment, vehicleType])

  const selectPayComponent = (
    operation: OperationTrackingRow,
    componentId: string,
  ) => {
    const component = collectibleComponents(operation).find(
      (item) => item.id === componentId,
    )
    setPayComponentId(component?.id ?? '')
    // Se propone el saldo completo; se puede bajar para un pago parcial.
    setPayAmount(component?.collectableAmount ?? '')
    setAccountId('')
    if (component)
      setMethod(defaultPaymentMethod(component.type) ?? 'EFECTIVO')
  }

  const selectPayOperation = (operation: OperationTrackingRow | null) => {
    setPayOperation(operation)
    setPaySearch('')
    setPayOptions([])
    setError('')
    if (operation)
      selectPayComponent(
        operation,
        collectibleComponents(operation)[0]?.id ?? '',
      )
    else {
      setPayComponentId('')
      setPayAmount('')
    }
  }

  const submitOperationPayment = async (data: FormData) => {
    if (!payOperation) {
      setError('Buscá y elegí la operación que se está pagando.')
      return
    }
    if (payBlockedReason) {
      setError(payBlockedReason)
      return
    }
    if (!payComponent) {
      setError('Elegí qué parte del plan de pago se cobra.')
      return
    }
    const value = Number(payAmount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      setError('Ingresá el importe cobrado.')
      return
    }
    if (value > Number(payComponent.collectableAmount)) {
      setError(
        `El importe supera el saldo de esa parte (${formatMoney(payComponent.collectableAmount, payOperation.currency)}).`,
      )
      return
    }
    if (isCash && !handoverToId) {
      setError('Indicá a quién se rinde el efectivo.')
      return
    }
    if (!collectionAccountId) {
      setError(
        isCash
          ? `${recipientName} todavía no tiene una caja para la sucursal de la operación. Pedile a un administrador que la cree en Cuentas de caja.`
          : 'Elegí la cuenta donde entró la plata.',
      )
      return
    }
    const reference = optional(data, 'reference')
    const notes = optional(data, 'notes')
    setSubmitting(true)
    try {
      await collectPaymentComponent(payOperation.id, payComponent.id, {
        idempotencyKey,
        accountId: collectionAccountId,
        amount: value.toFixed(2),
        collectionDate: text(data, 'date'),
        paymentMethod: method,
        ...(isCash ? { handoverToId } : {}),
        ...(reference ? { reference } : {}),
        ...(notes ? { notes } : {}),
      })
      onSaved()
      void alertSuccess(
        isCash
          ? 'Se registró el pago de la operación. El efectivo queda pendiente de rendición.'
          : 'Se registró el pago de la operación y se acreditó en la cuenta.',
      )
    } catch (submitError) {
      const message = componentCollectionErrorMessage(submitError)
      setError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const data = new FormData(event.currentTarget)
    if (operationPayment) {
      await submitOperationPayment(data)
      return
    }
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
        // Sin unidad ni operación, la grilla lo ubica por este circuito.
        ...(vehicleType ? { vehicleType } : {}),
        ...(reference ? { reference } : {}),
        ...(notes ? { notes } : {}),
        // Quién cobró no se envía: siempre es quien carga el ingreso.
        paymentMethod: method,
        ...(isCash && handoverToId ? { handoverToId } : {}),
      }
      if (isCash && !handoverToId) {
        setError('Indicá a quién se rinde el efectivo.')
        return
      }
      if (collectNow && !collectionAccountId) {
        setError(
          isCash
            ? `${recipientName} todavía no tiene una caja para esta sucursal. Pedile a un administrador que la cree en Cuentas de caja, o guardá el ingreso como "Pendiente de cobro".`
            : 'Elegí la cuenta donde entró la plata.',
        )
        return
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
      const created = await createFinancialRecord(kind, input)
      if (kind === 'income' && collectNow) {
        try {
          // El cobro lleva la fecha del ingreso: si se carga hoy un ingreso
          // del lunes, en caja entra con fecha del lunes, no de hoy.
          const incomeDate = (input as CreateIncomeInput).incomeDate
          await addSettlement('income', created.id, {
            idempotencyKey,
            accountId: collectionAccountId,
            amount: (input as CreateIncomeInput).totalAmount,
            ...(incomeDate && incomeDate !== localIsoDate()
              ? { occurredAt: `${incomeDate}T12:00:00.000-03:00` }
              : {}),
            ...(reference ? { reference } : {}),
          })
        } catch (collectError) {
          // El ingreso ya quedó guardado: se avisa y se cobra desde la lista.
          onSaved()
          void alertError(
            `El ingreso se guardó como pendiente, pero no se pudo registrar el cobro: ${incomeErrorMessage(collectError)} Registralo con "Cobrar" desde la lista.`,
          )
          return
        }
        onSaved()
        void alertSuccess(
          isCash
            ? 'El ingreso se guardó y se cobró. El efectivo queda pendiente de rendición.'
            : 'El ingreso se guardó y se acreditó en la cuenta.',
        )
        return
      }
      onSaved()
      void alertSuccess('El registro se guardó correctamente.')
    } catch (submitError) {
      const message =
        kind === 'income'
          ? incomeErrorMessage(submitError)
          : financialErrorMessage(submitError)
      setError(message)
      void alertError(message)
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
            {operationPayment && (
              <div className="field">
                <span>Sucursal</span>
                <output aria-label="Sucursal" className="operation-readonly">
                  {payOperation
                    ? `${payOperation.branch.code} · ${payOperation.branch.name}`
                    : 'La de la operación'}
                </output>
              </div>
            )}
            {kind !== 'expense' && !operationPayment && <label className="field">
              <span>Sucursal *</span>
              <select
                {...(branchLocked ? {} : { name: 'branchId' })}
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                required
                disabled={loadingOptions || branchLocked}
              >
                <option value="">Seleccionar sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>
                ))}
              </select>
              {branchLocked && <input type="hidden" name="branchId" value={branchId} />}
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
                  <select
                    name="type"
                    required
                    disabled={loadingOptions}
                    value={incomeType}
                    onChange={(event) => {
                      setIncomeType(event.target.value)
                      setError('')
                    }}
                  >
                    <option value="" disabled>Seleccionar tipo</option>
                    {visibleIncomeTypes.map((type) => (
                      <option key={type.id} value={type.name}>
                        {type.name === OPERATION_PAYMENT_TYPE
                          ? operationPaymentLabel(vehicleType)
                          : type.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!operationPayment && <label className="field field--wide">
                  <span>Unidad / VIN</span>
                  <div className="search-combobox">
                    <input
                      autoComplete="off"
                      onChange={(event) => {
                        setIncomeUnitSearch(event.target.value)
                        setSelectedIncomeUnit(null)
                      }}
                      placeholder="Buscá por chasis, patente, marca, modelo o versión"
                      value={
                        selectedIncomeUnit
                          ? `${selectedIncomeUnit.vin} · ${selectedIncomeUnit.version.model.name}`
                          : incomeUnitSearch
                      }
                    />
                    <small>Opcional. Ingresá al menos 3 letras para buscar.</small>
                    {incomeUnitLoading && (
                      <div className="search-combobox-status">
                        <LoaderCircle className="spin" size={16} aria-hidden="true" /> Buscando…
                      </div>
                    )}
                    {!incomeUnitLoading && !selectedIncomeUnit && incomeUnitOptions.length > 0 && (
                      <div className="search-combobox-results" role="listbox">
                        {incomeUnitOptions.map((unit) => (
                          <button
                            className="search-combobox-option"
                            key={unit.id}
                            onClick={() => {
                              setSelectedIncomeUnit(unit)
                              setIncomeUnitSearch('')
                              setIncomeUnitOptions([])
                            }}
                            role="option"
                            type="button"
                          >
                            <strong>{unit.vin}</strong>
                            <span>{unit.version.model.name} · {unit.branch.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedIncomeUnit && (
                      <div className="search-combobox-selected">
                        <span><strong>{selectedIncomeUnit.vin}</strong> · {selectedIncomeUnit.version.model.name}</span>
                        <button onClick={() => setSelectedIncomeUnit(null)} type="button">Quitar</button>
                      </div>
                    )}
                  </div>
                  <input name="unitId" type="hidden" value={selectedIncomeUnit?.id ?? ''} />
                </label>}
                {operationPayment && (
                  <>
                    <label className="field field--wide">
                      <span>Operación que se paga *</span>
                      <div className="search-combobox">
                        <input
                          aria-label="Operación que se paga *"
                          autoComplete="off"
                          onChange={(event) => {
                            setPaySearch(event.target.value)
                            if (payOperation) selectPayOperation(null)
                          }}
                          placeholder="Buscá por boleto, cliente, chasis o número de operación"
                          value={
                            payOperation
                              ? operationTitle(payOperation)
                              : paySearch
                          }
                        />
                        {payLoading && (
                          <div className="search-combobox-status">
                            <LoaderCircle className="spin" size={16} aria-hidden="true" /> Buscando…
                          </div>
                        )}
                        {!payLoading &&
                          !payOperation &&
                          debouncedPaySearch.length >= 2 &&
                          payOptions.length === 0 && (
                            <div className="search-combobox-status">
                              No se encontraron operaciones.
                            </div>
                          )}
                        {!payLoading && !payOperation && payOptions.length > 0 && (
                          <div className="search-combobox-results" role="listbox">
                            {payOptions.map((operation) => (
                              <button
                                className="search-combobox-option"
                                key={operation.id}
                                onClick={() => selectPayOperation(operation)}
                                role="option"
                                type="button"
                              >
                                <strong>{operationTitle(operation)}</strong>
                                <span>
                                  {displayVersion(operation.vehicle.versionName)} · saldo{' '}
                                  {formatMoney(operation.balanceAmount, operation.currency)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {payOperation && (
                          <div className="search-combobox-selected">
                            <span><strong>#{payOperation.number}</strong> · {payOperation.client.fullName}</span>
                            <button onClick={() => selectPayOperation(null)} type="button">Cambiar</button>
                          </div>
                        )}
                      </div>
                    </label>
                    {payOperation && (
                      <div className="field field--wide">
                        <span>Resumen de la operación</span>
                        <output
                          aria-label="Resumen de la operación"
                          className="operation-readonly"
                          style={{ display: 'grid', gap: 4, height: 'auto' }}
                        >
                          <span>
                            {payOperation.client.fullName}
                            {payOperation.ticketNumber
                              ? ` · boleto ${payOperation.ticketNumber}`
                              : ''}
                            {` · ${displayVersion(payOperation.vehicle.versionName)}`}
                          </span>
                          <span>
                            Acordado {formatMoney(payOperation.agreedPrice, payOperation.currency)}
                            {' · '}Cobrado {formatMoney(payOperation.collectedAmount, payOperation.currency)}
                            {' · '}
                            <strong>
                              Saldo {formatMoney(payOperation.balanceAmount, payOperation.currency)}
                            </strong>
                          </span>
                          {payComponents.length === 1 && payComponent && (
                            <span>
                              Se cobra: {planPartLabel(payComponent).toLowerCase()} · faltan{' '}
                              {formatMoney(payComponent.collectableAmount, payOperation.currency)}
                            </span>
                          )}
                        </output>
                      </div>
                    )}
                    {payBlockedReason && (
                      <div className="field field--wide">
                        <div className="form-alert form-alert--error" role="status">
                          {payBlockedReason}
                        </div>
                      </div>
                    )}
                    {payOperation && payComponents.length > 1 && (
                      <label className="field field--wide">
                        <span>¿Qué se está cobrando del plan? *</span>
                        <select
                          onChange={(event) =>
                            selectPayComponent(payOperation, event.target.value)
                          }
                          required
                          value={payComponentId}
                        >
                          {payComponents.map((component) => (
                            <option key={component.id} value={component.id}>
                              {planPartLabel(component)}: faltan{' '}
                              {formatMoney(component.collectableAmount, payOperation.currency)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </>
                )}
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
            {kind === 'income' && (!operationPayment || payComponent) && (
              <>
                {!operationPayment && <label className="field field--wide">
                  <span>Descripción *</span>
                  <input name="description" maxLength={500} required />
                </label>}
                {!operationPayment && <label className="field">
                  <span>Importe total *</span>
                  <input name="totalAmount" type="number" min="0.01" step="0.01" required />
                </label>}
                {operationPayment && payComponent && (
                  <label className="field">
                    <span>Importe a cobrar *</span>
                    <input
                      max={payComponent.collectableAmount}
                      min="0.01"
                      onChange={(event) => setPayAmount(event.target.value)}
                      required
                      step="0.01"
                      type="number"
                      value={payAmount}
                    />
                    <small>
                      Faltan{' '}
                      {formatMoney(payComponent.collectableAmount, payOperation?.currency)}
                      . Bajalo si es un pago parcial.
                    </small>
                  </label>
                )}
                {canViewOperations && !operationPayment && (
                  <label className="field field--wide">
                    <span>Operación</span>
                    <div className="search-combobox">
                      <input
                        autoComplete="off"
                        onChange={(event) => {
                          setIncomeOperationSearch(event.target.value)
                          setSelectedIncomeOperation(null)
                        }}
                        placeholder="Buscá por número de operación, cliente o VIN"
                        value={
                          selectedIncomeOperation
                            ? `${selectedIncomeOperation.number} · ${selectedIncomeOperation.client.fullName}`
                            : incomeOperationSearch
                        }
                      />
                      <small>Opcional. Ingresá al menos 3 letras para buscar.</small>
                      {incomeOperationLoading && (
                        <div className="search-combobox-status">
                          <LoaderCircle className="spin" size={16} aria-hidden="true" /> Buscando…
                        </div>
                      )}
                      {!incomeOperationLoading && !selectedIncomeOperation && incomeOperationOptions.length > 0 && (
                        <div className="search-combobox-results" role="listbox">
                          {incomeOperationOptions.map((operation) => (
                            <button
                              className="search-combobox-option"
                              key={operation.id}
                              onClick={() => {
                                setSelectedIncomeOperation(operation)
                                setIncomeOperationSearch('')
                                setIncomeOperationOptions([])
                              }}
                              role="option"
                              type="button"
                            >
                              <strong>{operation.number} · {operation.client.fullName}</strong>
                              <span>{operation.vehicle.unit?.vin ?? displayVersion(operation.vehicle.versionName) ?? 'Sin unidad asignada'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {selectedIncomeOperation && (
                        <div className="search-combobox-selected">
                          <span><strong>{selectedIncomeOperation.number}</strong> · {selectedIncomeOperation.client.fullName}</span>
                          <button onClick={() => setSelectedIncomeOperation(null)} type="button">Quitar</button>
                        </div>
                      )}
                    </div>
                    <input name="operationId" type="hidden" value={selectedIncomeOperation?.id ?? ''} />
                  </label>
                )}
                <label className="field">
                  <span>TT / referencia</span>
                  <input
                    defaultValue={
                      operationPayment ? (payOperation?.ticketNumber ?? '') : ''
                    }
                    key={operationPayment ? (payOperation?.id ?? 'pago') : 'libre'}
                    maxLength={160}
                    name="reference"
                  />
                </label>
                {/* En el pago de la venta viene con lo pactado y se puede cambiar. */}
                <label className="field">
                  <span>{operationPayment ? 'Medio con el que pagó *' : 'Medio *'}</span>
                  <select
                    onChange={(event) =>
                      setMethod(event.target.value as IncomePaymentMethod)
                    }
                    required
                    value={method}
                  >
                    {INCOME_METHODS.map((item) => (
                      <option key={item} value={item}>
                        {paymentMethodLabels[item]}
                      </option>
                    ))}
                  </select>
                  {operationPayment && (
                    <small>Cambialo sólo si pagó de otra forma a la pactada.</small>
                  )}
                </label>
                <div className="field">
                  <span>Quién cobró</span>
                  <output
                    aria-label="Quién cobró"
                    className="operation-readonly"
                  >
                    {user?.name ?? user?.email ?? 'Vos'}
                  </output>
                </div>
                {isCash && (
                  <label className="field">
                    <span>Se rinde a *</span>
                    <select
                      onChange={(event) => setHandoverToId(event.target.value)}
                      required
                      value={handoverToId}
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
                {canCollect && !operationPayment && (
                  <label className="field">
                    <span>Estado del cobro *</span>
                    <select
                      onChange={(event) =>
                        setCollectNow(event.target.value === 'COBRADO')
                      }
                      value={collectNow ? 'COBRADO' : 'PENDIENTE'}
                    >
                      <option value="COBRADO">Cobrado (entra a caja ahora)</option>
                      <option value="PENDIENTE">Pendiente de cobro</option>
                    </select>
                  </label>
                )}
                {showCollection && isCash && (
                  <div className="field field--wide">
                    <span>Caja donde entra</span>
                    <output
                      aria-label="Caja donde entra"
                      className="operation-readonly"
                    >
                      {!handoverToId
                        ? 'Elegí a quién se rinde'
                        : recipientAccount
                          ? cashAccountLabel(recipientAccount)
                          : `${recipientName} todavía no tiene una caja${accountCurrency === 'ARS' ? '' : ` en ${currencyName(accountCurrency)}`} para ${operationPayment ? 'la sucursal de la operación' : 'esta sucursal'}`}
                    </output>
                    <small>
                      Es la caja de quien recibe el efectivo; no se elige.
                    </small>
                  </div>
                )}
                {showCollection && !isCash && (
                  <label className="field field--wide">
                    <span>Cuenta donde entró *</span>
                    <select
                      onChange={(event) => setAccountId(event.target.value)}
                      required
                      value={accountId}
                    >
                      <option value="">Seleccionar cuenta</option>
                      {branchAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {cashAccountLabel(account)}
                        </option>
                      ))}
                    </select>
                    {!loadingOptions && branchAccounts.length === 0 && (
                      <small>
                        No hay cuentas de caja activas en{' '}
                        {currencyName(accountCurrency)} para esta sucursal.
                        Pedile a un administrador que las cree en Cuentas de
                        caja.
                      </small>
                    )}
                  </label>
                )}
              </>
            )}
            {kind !== 'expense' && !operationPayment && <label className="field">
              <span>Moneda *</span>
              <select
                name="currency"
                onChange={(event) => {
                  setCurrency(event.target.value)
                  // La cuenta elegida era de la otra moneda.
                  setAccountId('')
                }}
                required
                value={currency}
              >
                {currencies.map((item) => (
                  <option key={item} value={item}>
                    {currencyLabels[item]}
                  </option>
                ))}
              </select>
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
            <button className="button button--primary" type="submit" disabled={submitting || loadingOptions || Boolean(payBlockedReason && operationPayment)}>
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting
                ? 'Guardando…'
                : operationPayment
                  ? 'Registrar pago'
                  : `Guardar ${labels.singular}`}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
