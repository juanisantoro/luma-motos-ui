import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileCheck2,
  LoaderCircle,
  RefreshCw,
  Store,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, NetworkError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { CreditAlert, useCreditCheck } from '../credit-checks'
import {
  listSalesBranches,
  listSalesPhysicalUnits,
  listSalesSupplierAvailability,
} from '../stock/api'
import type {
  BranchOption,
  PhysicalUnit,
  SupplierAvailability,
  VehicleKind,
} from '../stock/types'
import {
  createSalesOperation,
  createSalesTradeIn,
  getSalesPricePolicy,
  listSalesContacts,
  listSalesFinancialInstitutions,
  listSalesSellers,
  replaceSalesPaymentPlan,
  submitSalesOperation,
} from './api'
import { salesErrorMessage } from './errors'
import {
  OperationVehiclePicker,
  type OperationVehicleOption,
} from './OperationVehiclePicker'
import { formatMoney } from './presentation'
import type {
  SalesDebt,
  SalesFinancialInstitution,
  SalesOperation,
  SalesPaymentComponentInput,
  SalesPaymentPlatform,
  SalesPricePolicy,
  SalesSeller,
} from './types'

type Completion = {
  kind: 'draft' | 'partial' | 'submitted'
  number: string
  message: string
}

type FormField =
  | 'documentNumber'
  | 'fullName'
  | 'phone'
  | 'vehicle'
  | 'branch'
  | 'policy'
  | 'agreedPrice'
  | 'seller'
  | 'financialInstitution'
  | 'creditAmount'
  | 'tradeInDescription'
  | 'tradeInAmount'

type FieldErrors = Partial<Record<FormField, string>>

const paymentOptions: Array<{ value: SalesPaymentPlatform; label: string }> = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'EFECTIVO_CREDITO', label: 'Efectivo + crédito' },
  { value: 'MOTO_EFECTIVO', label: 'Moto + efectivo' },
  { value: 'MOTO_CREDITO', label: 'Moto + crédito' },
  { value: 'MOTO_EFECTIVO_CREDITO', label: 'Moto + efectivo + crédito' },
]

const today = new Date().toISOString().slice(0, 10)

function normalizeDocument(value: string) {
  return value.replace(/[\s.-]/g, '').toUpperCase()
}

function monthFromDate(value: string) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.valueOf())) return '—'
  const label = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function resourceError(error: unknown) {
  if (error instanceof NetworkError) {
    return 'El backend no respondió. Verificá que la API local esté activa y reintentá.'
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return 'La sesión venció. Volvé a ingresar.'
    if (error.status === 403) return 'Tu rol no tiene permiso para consultar este recurso.'
    return `${error.message} (HTTP ${error.status})`
  }
  return 'Ocurrió un error inesperado al consultar este recurso.'
}

function selectedModel(option: OperationVehicleOption | null) {
  if (!option) return null
  return option.source === 'PHYSICAL'
    ? option.unit.catalogModel
    : option.availability.catalogModel
}

function selectedCondition(option: OperationVehicleOption | null) {
  if (!option) return null
  return option.source === 'PHYSICAL'
    ? option.unit.condition
    : option.availability.condition
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <small className="field-error">{message}</small> : null
}

function ReservationConflictModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialogFocus(onClose)
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="reservation-conflict-title"
        aria-modal="true"
        className="modal-card reservation-conflict-modal"
        ref={dialogRef}
        role="alertdialog"
      >
        <AlertTriangle size={28} aria-hidden="true" />
        <h2 id="reservation-conflict-title">
          Esta unidad acaba de ser reservada por otra operación
        </h2>
        <p>
          Conservamos todos los demás datos y actualizamos el stock. Seleccioná
          otra unidad disponible para continuar.
        </p>
        <button
          autoFocus
          className="button button--primary"
          onClick={onClose}
          type="button"
        >
          Elegir otra unidad
        </button>
      </div>
    </div>
  )
}

function SectionHeading({
  id,
  number,
  title,
  description,
}: {
  id: string
  number: number
  title: string
  description: string
}) {
  return (
    <header className="operation-section__heading">
      <span aria-hidden="true">{number}</span>
      <div>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  )
}

function paymentPlan(
  platform: SalesPaymentPlatform,
  price: number,
  creditAmount: number,
  financialInstitutionId: string,
  tradeInAmount: number,
  tradeInVehicleId?: string,
) {
  const components: SalesPaymentComponentInput[] = []
  if (tradeInVehicleId) {
    components.push({
      type: 'TOMA_PARTE_PAGO',
      amount: tradeInAmount,
      tradeInVehicleId,
    })
  }
  if (platform.includes('CREDITO')) {
    components.push({
      type: 'FINANCIACION',
      amount: creditAmount,
      financialInstitutionId,
    })
  }
  const cashAmount = price - creditAmount - tradeInAmount
  if (cashAmount > 0) components.push({ type: 'EFECTIVO', amount: cashAmount })
  return components
}

export function NewOperationPage({
  vehicleType,
}: {
  vehicleType: VehicleKind
}) {
  const { user } = useAuth()
  const permissions = useMemo(() => user?.role.permissions ?? [], [user])
  const canViewAvailability = hasPermission(
    permissions,
    'proveedores.consultar',
  )
  const canConfigurePrice =
    hasPermission(permissions, 'catalogo.gestionar') &&
    hasPermission(permissions, 'catalogo.consultar') &&
    hasPermission(permissions, 'inventario.consultar')
  const organizationId = user?.globalAccess
    ? user.organization.id
    : undefined
  const peopleOrganizationId = user?.organization.id
  const isSeller = user?.role.code === 'VENDEDOR'
  const hasFixedBranch = Boolean(user?.branch?.id) && !user?.globalAccess

  const [documentType, setDocumentType] = useState<'DNI' | 'CI'>('DNI')
  const [documentNumber, setDocumentNumber] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [operationDate, setOperationDate] = useState(today)
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [vehicleKey, setVehicleKey] = useState('')
  const [branchId, setBranchId] = useState(user?.branch?.id ?? '')
  const [agreedPrice, setAgreedPrice] = useState('')
  const [paymentPlatform, setPaymentPlatform] =
    useState<SalesPaymentPlatform>('EFECTIVO')
  const [creditAmount, setCreditAmount] = useState('')
  const [financialInstitutionId, setFinancialInstitutionId] = useState('')
  const [guarantor, setGuarantor] = useState('')
  const [tradeInDescription, setTradeInDescription] = useState('')
  const [tradeInAmount, setTradeInAmount] = useState('')
  const [sellerId, setSellerId] = useState('')
  const [contactId, setContactId] = useState('')
  const [debtStatus, setDebtStatus] = useState<SalesDebt>('NO')
  const [papersDelivered, setPapersDelivered] = useState(false)
  const [notes, setNotes] = useState('')

  const [branches, setBranches] = useState<BranchOption[]>([])
  const [branchStatus, setBranchStatus] = useState<
    'loading' | 'success' | 'error'
  >('loading')
  const [branchError, setBranchError] = useState('')
  const [units, setUnits] = useState<PhysicalUnit[]>([])
  const [availability, setAvailability] = useState<SupplierAvailability[]>([])
  const [vehicleLoading, setVehicleLoading] = useState(true)
  const [vehicleErrors, setVehicleErrors] = useState<
    Array<{ source: string; message: string }>
  >([])
  const [vehicleLoadKey, setVehicleLoadKey] = useState(0)
  const [sellers, setSellers] = useState<SalesSeller[]>([])
  const [contacts, setContacts] = useState<SalesSeller[]>([])
  const [peopleStatus, setPeopleStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [peopleError, setPeopleError] = useState('')
  const [peopleLoadKey, setPeopleLoadKey] = useState(0)
  const [financialInstitutions, setFinancialInstitutions] = useState<
    SalesFinancialInstitution[]
  >([])
  const [financialStatus, setFinancialStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [financialError, setFinancialError] = useState('')
  const [financialLoadKey, setFinancialLoadKey] = useState(0)
  const [policy, setPolicy] = useState<SalesPricePolicy | null>(null)
  const [policyStatus, setPolicyStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [policyError, setPolicyError] = useState('')
  const [policyLoadKey, setPolicyLoadKey] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [completion, setCompletion] = useState<Completion | null>(null)
  const [reservationConflict, setReservationConflict] = useState(false)

  const creditCheck = useCreditCheck({
    documentType,
    documentNumber,
    enabled: normalizeDocument(documentNumber).length >= 5,
  })
  const creditRequired = paymentPlatform.includes('CREDITO')
  const tradeInRequired = paymentPlatform.startsWith('MOTO_')
  const creditBlocksSale =
    creditCheck.state.status === 'success' && creditCheck.state.data.blocksSale

  useEffect(() => {
    const controller = new AbortController()
    setBranchStatus('loading')
    setBranchError('')
    void listSalesBranches(organizationId, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return
        setBranches(items)
        setBranchId((current) => {
          if (items.some((branch) => branch.id === current)) return current
          return (
            items.find((branch) => branch.id === user?.branch?.id)?.id ?? ''
          )
        })
        setBranchStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setBranches([])
        setBranchId('')
        setBranchError(resourceError(error))
        setBranchStatus('error')
      })
    return () => controller.abort()
  }, [organizationId, user?.branch?.id, vehicleLoadKey])

  useEffect(() => {
    const controller = new AbortController()
    setVehicleLoading(true)
    setVehicleErrors([])
    void Promise.allSettled([
      listSalesPhysicalUnits(vehicleType, organizationId, controller.signal),
      canViewAvailability
        ? listSalesSupplierAvailability(
            vehicleType,
            organizationId,
            controller.signal,
          )
        : Promise.resolve([]),
    ]).then(
      ([unitResult, availabilityResult]) => {
      if (controller.signal.aborted) return
      const errors: Array<{ source: string; message: string }> = []
      if (unitResult.status === 'fulfilled') {
        setUnits(unitResult.value)
      } else {
        setUnits([])
        errors.push({
          source: 'Stock físico',
          message: resourceError(unitResult.reason),
        })
      }
      if (availabilityResult.status === 'fulfilled') {
        setAvailability(availabilityResult.value)
      } else {
        setAvailability([])
        errors.push({
          source: 'Disponibilidad de proveedores',
          message: resourceError(availabilityResult.reason),
        })
      }
      if (!canViewAvailability) {
        errors.push({
          source: 'Disponibilidad de proveedores',
          message: 'Tu rol no tiene el permiso proveedores.consultar.',
        })
      }
      setVehicleErrors(errors)
      setVehicleLoading(false)
      },
    )
    return () => controller.abort()
  }, [
    canViewAvailability,
    organizationId,
    vehicleLoadKey,
    vehicleType,
  ])

  const vehicleErrorsWithBranches = useMemo(
    () =>
      branchStatus === 'error'
        ? [
            { source: 'Sucursales', message: branchError },
            ...vehicleErrors,
          ]
        : vehicleErrors,
    [branchError, branchStatus, vehicleErrors],
  )

  const vehicleOptions = useMemo<OperationVehicleOption[]>(() => {
    const physical = units
      .filter((unit) => unit.vehicleType === vehicleType)
      .map((unit) => ({
        key: `unit:${unit.id}`,
        source: 'PHYSICAL' as const,
        unit,
      }))
    const supplier = availability
      .filter(
        (item) => item.vehicleType === vehicleType && item.quantity > 0,
      )
      .map((item) => ({
        key: `availability:${item.id}`,
        source: 'SUPPLIER' as const,
        availability: item,
      }))
    return [...physical, ...supplier]
  }, [availability, units, vehicleType])

  const selectedVehicle =
    vehicleOptions.find((option) => option.key === vehicleKey) ?? null
  const catalogModel = selectedModel(selectedVehicle)
  const condition = selectedCondition(selectedVehicle)

  useEffect(() => {
    const controller = new AbortController()
    setSellers([])
    setContacts([])
    setSellerId('')
    setContactId('')
    setPeopleStatus('loading')
    setPeopleError('')
    const query = {
      page: 1,
      limit: 100,
      ...(peopleOrganizationId
        ? { organizationId: peopleOrganizationId }
        : {}),
    }
    void Promise.allSettled([
      listSalesSellers(query, controller.signal),
      listSalesContacts(query, controller.signal),
    ]).then(([sellerResult, contactResult]) => {
      if (controller.signal.aborted) return
      const errors: string[] = []
      if (sellerResult.status === 'fulfilled') {
        setSellers(sellerResult.value.items)
        setSellerId((current) => {
          if (sellerResult.value.items.some((person) => person.id === current)) {
            return current
          }
          const currentUser = isSeller
            ? sellerResult.value.items.find((person) => person.isCurrentUser) ??
              sellerResult.value.items.find(
                (person) =>
                  user?.name &&
                  person.fullName.localeCompare(user.name, 'es', {
                    sensitivity: 'base',
                  }) === 0,
              ) ??
              (sellerResult.value.items.length === 1
                ? sellerResult.value.items[0]
                : undefined)
            : undefined
          return currentUser?.id ?? ''
        })
      } else {
        setSellers([])
        errors.push(`Vendedores: ${resourceError(sellerResult.reason)}`)
      }
      if (contactResult.status === 'fulfilled') {
        setContacts(contactResult.value.items)
        setContactId((current) =>
          contactResult.value.items.some((person) => person.id === current)
            ? current
            : '',
        )
      } else {
        setContacts([])
        errors.push(`Contactos: ${resourceError(contactResult.reason)}`)
      }
      setPeopleError(errors.join(' '))
      setPeopleStatus(errors.length ? 'error' : 'success')
    })
    return () => controller.abort()
  }, [
    isSeller,
    peopleOrganizationId,
    peopleLoadKey,
    user?.name,
  ])

  useEffect(() => {
    if (!creditRequired) {
      setFinancialStatus('idle')
      setFinancialInstitutionId('')
      return
    }
    const controller = new AbortController()
    setFinancialStatus('loading')
    setFinancialError('')
    void listSalesFinancialInstitutions(controller.signal)
      .then((response) => {
        setFinancialInstitutions(response.items)
        setFinancialInstitutionId((current) =>
          response.items.some((item) => item.id === current) ? current : '',
        )
        setFinancialStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFinancialInstitutions([])
        setFinancialError(resourceError(error))
        setFinancialStatus('error')
      })
    return () => controller.abort()
  }, [creditRequired, financialLoadKey])

  useEffect(() => {
    if (!branchId || !catalogModel) {
      setPolicy(null)
      setPolicyStatus('idle')
      return
    }
    const controller = new AbortController()
    setPolicy(null)
    setPolicyStatus('loading')
    setPolicyError('')
    void getSalesPricePolicy(
      {
        branchId,
        versionId: catalogModel.id,
        vehicleType,
        operationDate,
        ...(organizationId ? { organizationId } : {}),
      },
      controller.signal,
    )
      .then((response) => {
        setPolicy(response)
        setAgreedPrice(response.listPrice)
        setPolicyStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setAgreedPrice('')
        setPolicyError(resourceError(error))
        setPolicyStatus('error')
      })
    return () => controller.abort()
  }, [
    branchId,
    catalogModel,
    operationDate,
    organizationId,
    policyLoadKey,
    vehicleType,
  ])

  const price = Number(agreedPrice)
  const credit = creditRequired ? Number(creditAmount) : 0
  const tradeIn = tradeInRequired ? Number(tradeInAmount) : 0
  const listDifference =
    policy && Number.isFinite(price)
      ? Math.max(0, Number(policy.listPrice) - price)
      : 0
  const belowList = listDifference > 0
  const belowMinimum =
    policy !== null &&
    Number.isFinite(price) &&
    price < Number(policy.minimumPrice)

  const clearError = (field: FormField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const selectVehicle = (option: OperationVehicleOption) => {
    setVehicleKey(option.key)
    clearError('vehicle')
    setPolicy(null)
    setAgreedPrice('')
    if (option.source === 'PHYSICAL') {
      setBranchId(option.unit.branch.id)
    } else if (!branchId && user?.branch?.id) {
      setBranchId(user.branch.id)
    }
  }

  const validate = () => {
    const errors: FieldErrors = {}
    if (normalizeDocument(documentNumber).length < 5) {
      errors.documentNumber = 'Ingresá un DNI o CI válido.'
    }
    if (!fullName.trim()) errors.fullName = 'Ingresá el nombre del cliente.'
    if (!phone.trim()) errors.phone = 'Ingresá un teléfono de contacto.'
    if (!selectedVehicle) errors.vehicle = 'Seleccioná un vehículo de los resultados.'
    if (!branchId) errors.branch = 'Seleccioná la sucursal de la operación.'
    if (!policy) errors.policy = 'Cargá una política de precio vigente.'
    if (!Number.isFinite(price) || price <= 0) {
      errors.agreedPrice = 'Ingresá un precio de cierre mayor a cero.'
    }
    if (!sellerId) errors.seller = 'Seleccioná quién hizo la venta.'
    if (creditRequired) {
      if (!financialInstitutionId) {
        errors.financialInstitution = 'Seleccioná la financiera.'
      }
      if (!Number.isFinite(credit) || credit <= 0) {
        errors.creditAmount = 'Ingresá el monto financiado.'
      } else if (credit > price) {
        errors.creditAmount = 'El crédito no puede superar el precio de cierre.'
      }
    }
    if (tradeInRequired) {
      if (!tradeInDescription.trim()) {
        errors.tradeInDescription = 'Describí la unidad recibida como parte de pago.'
      }
      if (!Number.isFinite(tradeIn) || tradeIn <= 0) {
        errors.tradeInAmount = 'Ingresá el valor aceptado de la unidad.'
      }
    }
    const remaining = price - credit - tradeIn
    if (
      (paymentPlatform === 'CREDITO' ||
        paymentPlatform === 'MOTO_CREDITO') &&
      Number.isFinite(remaining) &&
      remaining !== 0
    ) {
      errors.creditAmount =
        'En esta combinación, crédito y parte de pago deben completar el precio.'
    }
    if (
      paymentPlatform.includes('EFECTIVO') &&
      Number.isFinite(remaining) &&
      remaining <= 0
    ) {
      errors.agreedPrice =
        'La combinación debe dejar un importe positivo para efectivo.'
    }
    if (creditBlocksSale) {
      errors.documentNumber =
        'El antecedente crediticio bloquea esta operación según el backend.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setFormError('Revisá los campos marcados antes de guardar la operación.')
      const first = Object.keys(errors)[0]
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus(),
      )
      return false
    }
    setFormError('')
    return true
  }

  const save = async (sendOperation: boolean) => {
    if (!validate() || !selectedVehicle || !catalogModel || !condition || !policy) {
      return
    }
    setSubmitting(true)
    let persisted: SalesOperation | null = null
    try {
      persisted = await createSalesOperation({
        vehicleType,
        branchId,
        client: {
          documentType,
          documentNumber: normalizeDocument(documentNumber),
          fullName: fullName.trim(),
          phone: phone.trim(),
        },
        versionId: catalogModel.id,
        condition,
        agreedPrice: price,
        paymentPlatform,
        ...(creditRequired ? { creditAmount: credit } : {}),
        ...(guarantor.trim() ? { guarantor: guarantor.trim() } : {}),
        ...(selectedVehicle.source === 'PHYSICAL'
          ? { unitId: selectedVehicle.unit.id }
          : {
              supplierAvailabilityId: selectedVehicle.availability.id,
            }),
        sellerId,
        ...(contactId ? { contactId } : {}),
        operationDate,
        deliveryStatus: 'NO_PROGRAMADA',
        papersDelivered,
        debt: debtStatus,
        submit: false,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(organizationId ? { organizationId } : {}),
      })

      let tradeInVehicleId: string | undefined
      if (tradeInRequired) {
        persisted = await createSalesTradeIn(persisted.id, {
          expectedVersion: persisted.rowVersion,
          description: tradeInDescription.trim(),
          appraisedAmount: tradeIn,
          acceptedAmount: tradeIn,
        })
        tradeInVehicleId = persisted.tradeIns.at(-1)?.id
        if (!tradeInVehicleId) {
          throw new Error('El backend no devolvió la unidad tomada registrada.')
        }
      }

      persisted = await replaceSalesPaymentPlan(persisted.id, {
        expectedVersion: persisted.rowVersion,
        components: paymentPlan(
          paymentPlatform,
          price,
          credit,
          financialInstitutionId,
          tradeIn,
          tradeInVehicleId,
        ),
      })

      if (sendOperation) {
        persisted = await submitSalesOperation(
          persisted.id,
          persisted.rowVersion,
        )
      }

      setCompletion({
        kind: sendOperation ? 'submitted' : 'draft',
        number: persisted.number,
        message: sendOperation
          ? belowList
            ? `La operación y el cliente quedaron registrados. Se envió a aprobación por una diferencia de ${formatMoney(String(listDifference), policy.currency)} debajo de lista.`
            : 'La operación y el cliente quedaron registrados y se enviaron al circuito comercial.'
          : 'La operación, el cliente y sus condiciones comerciales quedaron guardados como borrador.',
      })
    } catch (error) {
      if (
        !persisted &&
        error instanceof ApiError &&
        error.status === 409 &&
        error.details?.code === 'INVENTORY_UNIT_ALREADY_RESERVED' &&
        selectedVehicle.source === 'PHYSICAL'
      ) {
        const unavailableUnitId = selectedVehicle.unit.id
        setUnits((current) =>
          current.filter((unit) => unit.id !== unavailableUnitId),
        )
        setVehicleKey('')
        setPolicy(null)
        setAgreedPrice('')
        setReservationConflict(true)
        setVehicleLoadKey((current) => current + 1)
        return
      }
      if (persisted) {
        setCompletion({
          kind: 'partial',
          number: persisted.number,
          message: `La operación quedó guardada como borrador, pero no se completaron todos sus datos relacionados. No vuelvas a enviarla: informá el número de operación para completar el seguimiento sin duplicarla. ${salesErrorMessage(error)}`,
        })
      } else {
        setFormError(salesErrorMessage(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void save(true)
  }

  if (completion) {
    return (
      <StatePanel
        icon={
          completion.kind === 'submitted'
            ? CheckCircle2
            : completion.kind === 'partial'
              ? AlertTriangle
              : Clock3
        }
        title={`Operación #${completion.number}`}
        description={completion.message}
        action={
          <div className="operation-complete__actions">
            <Link
              className="button button--primary"
              to={`/${vehicleType === 'MOTO' ? 'motos' : 'autos'}/mis-operaciones`}
            >
              Ver mis operaciones
            </Link>
            {completion.kind !== 'partial' && (
              <button
                className="button button--secondary"
                onClick={() => window.location.reload()}
                type="button"
              >
                Cargar otra
              </button>
            )}
          </div>
        }
      />
    )
  }

  return (
    <>
      {reservationConflict && (
        <ReservationConflictModal
          onClose={() => setReservationConflict(false)}
        />
      )}
      <header className="page-heading operation-page-heading">
        <div>
          <p className="eyebrow">VENTAS · CIRCUITO PRODUCTIVO</p>
          <h1>
            Nueva operación de {vehicleType === 'MOTO' ? 'moto' : 'auto'}
          </h1>
          <p>
            Cargá cliente, vehículo y condiciones en un único recorrido continuo.
          </p>
        </div>
        <span className="operation-circuit-badge">
          {vehicleType === 'MOTO' ? 'Motos' : 'Autos'}
        </span>
      </header>

      <form className="operation-form" noValidate onSubmit={submit}>
        <fieldset disabled={submitting}>
          {formError && (
            <div className="form-alert form-alert--error operation-form-summary" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <section className="operation-section" aria-labelledby="operation-client-title">
            <SectionHeading
              id="operation-client-title"
              number={1}
              title="Cliente y consulta crediticia"
              description="El DNI o CI inicia la operación. El cliente se crea o vincula recién al guardar."
            />
            <div className="operation-form-grid operation-form-grid--client">
              <label className="field">
                <span>DNI / CI *</span>
                <input
                  aria-invalid={Boolean(fieldErrors.documentNumber)}
                  autoComplete="off"
                  autoFocus
                  data-field="documentNumber"
                  onChange={(event) => {
                    setDocumentNumber(event.target.value)
                    clearError('documentNumber')
                  }}
                  placeholder="Ingresá el documento"
                  value={documentNumber}
                />
                <FieldError message={fieldErrors.documentNumber} />
              </label>
              <label className="field operation-document-type">
                <span>Tipo *</span>
                <select
                  onChange={(event) =>
                    setDocumentType(event.target.value as 'DNI' | 'CI')
                  }
                  value={documentType}
                >
                  <option value="DNI">DNI</option>
                  <option value="CI">CI</option>
                </select>
              </label>
              <label className="field">
                <span>Nombre y apellido *</span>
                <input
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  data-field="fullName"
                  maxLength={180}
                  onChange={(event) => {
                    setFullName(event.target.value)
                    clearError('fullName')
                  }}
                  value={fullName}
                />
                <FieldError message={fieldErrors.fullName} />
              </label>
              <label className="field">
                <span>Teléfono *</span>
                <input
                  aria-invalid={Boolean(fieldErrors.phone)}
                  data-field="phone"
                  maxLength={40}
                  onChange={(event) => {
                    setPhone(event.target.value)
                    clearError('phone')
                  }}
                  placeholder="11 0000-0000"
                  value={phone}
                />
                <FieldError message={fieldErrors.phone} />
              </label>
            </div>
            <CreditAlert
              state={creditCheck.state}
              onRetry={creditCheck.retry}
              showClearResult
            />
          </section>

          <section className="operation-section" aria-labelledby="operation-vehicle-title">
            <SectionHeading
              id="operation-vehicle-title"
              number={2}
              title="Vehículo y precio"
              description="Buscá una unidad física o disponibilidad real de proveedor."
            />
            <OperationVehiclePicker
              errors={vehicleErrorsWithBranches}
              loading={vehicleLoading}
              onRetry={() => setVehicleLoadKey((current) => current + 1)}
              onSearch={setVehicleSearch}
              onSelect={selectVehicle}
              options={vehicleOptions}
              search={vehicleSearch}
              selectedKey={vehicleKey}
              vehicleType={vehicleType}
            />
            <FieldError message={fieldErrors.vehicle} />

            {selectedVehicle && (
              <div className="operation-selected-vehicle" role="status">
                <div>
                  <strong>
                    {[
                      catalogModel?.brand,
                      catalogModel?.model,
                      catalogModel?.version,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </strong>
                  <span>
                    {condition === 'NUEVO' ? 'Nuevo' : 'Usado'} ·{' '}
                    {selectedVehicle.source === 'PHYSICAL'
                      ? `Stock físico · ${selectedVehicle.unit.branch.name}`
                      : `Stock de ${selectedVehicle.availability.supplier.name} (${selectedVehicle.availability.quantity}) · Chasis al recibir`}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Origen</dt>
                    <dd>
                      {selectedVehicle.source === 'PHYSICAL'
                        ? 'Unidad física'
                        : 'Disponibilidad proveedor'}
                    </dd>
                  </div>
                  <div>
                    <dt>Chasis</dt>
                    <dd>
                      {selectedVehicle.source === 'PHYSICAL'
                        ? selectedVehicle.unit.vin
                        : 'Pendiente al recibir'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {selectedVehicle && selectedVehicle.source !== 'PHYSICAL' && (
              <label className="field operation-branch-field">
                <span>Sucursal de la operación *</span>
                <select
                  aria-invalid={Boolean(fieldErrors.branch)}
                  data-field="branch"
                  onChange={(event) => {
                    setBranchId(event.target.value)
                    clearError('branch')
                  }}
                  disabled={branchStatus === 'loading' || hasFixedBranch}
                  value={branchId}
                >
                  <option value="">
                    {branchStatus === 'loading'
                      ? 'Cargando sucursales…'
                      : 'Seleccionar sucursal'}
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {branchStatus === 'error' && (
                  <small className="field-error">{branchError}</small>
                )}
                {hasFixedBranch && (
                  <small>
                    La sucursal queda fijada por el alcance de tu usuario.
                  </small>
                )}
                {!branchId && branchStatus === 'success' && (
                  <small>
                    Seleccioná la sucursal donde se reservará y recibirá la
                    unidad.
                  </small>
                )}
                <FieldError message={fieldErrors.branch} />
              </label>
            )}

            <div className="operation-price-row">
              <div className="field">
                <span>Precio de lista</span>
                <div className="price-reference" aria-live="polite">
                  {policyStatus === 'loading' ? (
                    <>
                      <LoaderCircle className="spin" size={18} />
                      <strong>Consultando política…</strong>
                    </>
                  ) : policy ? (
                    <>
                      <strong>{formatMoney(policy.listPrice, policy.currency)}</strong>
                      <small>
                        Piso adicional:{' '}
                        {formatMoney(policy.minimumPrice, policy.currency)}
                      </small>
                    </>
                  ) : (
                    <strong>Seleccioná un vehículo</strong>
                  )}
                </div>
                {policyStatus === 'error' && (
                  <div className="operation-field-retry" role="alert">
                    <span>{policyError}</span>
                    <button
                      onClick={() => setPolicyLoadKey((current) => current + 1)}
                      type="button"
                    >
                      <RefreshCw size={15} /> Reintentar
                    </button>
                    {canConfigurePrice && catalogModel && (
                      <Link
                        className="button button--secondary"
                        to={`/stock/${vehicleType === 'MOTO' ? 'motos' : 'autos'}?tab=catalog&priceVersionId=${encodeURIComponent(catalogModel.id)}&branchId=${encodeURIComponent(branchId)}`}
                      >
                        Configurar precio
                      </Link>
                    )}
                    {!canConfigurePrice && (
                      <small>
                        Solicitá a un usuario con permiso de catálogo que
                        configure el precio para esta sucursal.
                      </small>
                    )}
                  </div>
                )}
                <FieldError message={fieldErrors.policy} />
              </div>
              <label className="field">
                <span>Precio de cierre *</span>
                <input
                  aria-invalid={Boolean(fieldErrors.agreedPrice)}
                  data-field="agreedPrice"
                  disabled={policyStatus !== 'success'}
                  min="0.01"
                  onChange={(event) => {
                    setAgreedPrice(event.target.value)
                    clearError('agreedPrice')
                  }}
                  step="0.01"
                  type="number"
                  value={agreedPrice}
                />
                <FieldError message={fieldErrors.agreedPrice} />
              </label>
            </div>

            {belowList && policy && (
              <div className="price-warning" role="status">
                <AlertTriangle size={20} aria-hidden="true" />
                <div>
                  <strong>Precio por debajo de lista</strong>
                  <p>
                    Diferencia:{' '}
                    {formatMoney(String(listDifference), policy.currency)}. La
                    operación quedará pendiente de aprobación.
                    {belowMinimum
                      ? ' También está por debajo del precio piso.'
                      : ''}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="operation-section" aria-labelledby="operation-terms-title">
            <SectionHeading
              id="operation-terms-title"
              number={3}
              title="Condiciones comerciales"
              description="Asignación, fecha y composición real del pago."
            />
            <div className="operation-form-grid">
              <label className="field">
                <span>Fecha de operación *</span>
                <input
                  onChange={(event) => setOperationDate(event.target.value)}
                  type="date"
                  value={operationDate}
                />
              </label>
              <label className="field">
                <span>Quién hizo la venta *</span>
                <select
                  aria-invalid={Boolean(fieldErrors.seller)}
                  data-field="seller"
                  disabled={peopleStatus === 'loading' || isSeller}
                  onChange={(event) => {
                    setSellerId(event.target.value)
                    clearError('seller')
                  }}
                  value={sellerId}
                >
                  <option value="">
                    {peopleStatus === 'loading'
                      ? 'Cargando vendedores…'
                      : peopleStatus === 'success' && sellers.length === 0
                        ? 'No hay vendedores elegibles en la organización'
                        : 'Seleccionar vendedor'}
                  </option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.fullName}
                      {seller.isCurrentUser ? ' · usuario actual' : ''}
                    </option>
                  ))}
                </select>
                {isSeller && sellerId && (
                  <small>Se asigna automáticamente al vendedor de la sesión.</small>
                )}
                {peopleStatus === 'success' && sellers.length === 0 && (
                  <small className="field-error">
                    La organización no tiene vendedores elegibles.
                  </small>
                )}
                <FieldError message={fieldErrors.seller} />
              </label>
              <label className="field">
                <span>Quién fue el contacto</span>
                <select
                  disabled={peopleStatus === 'loading'}
                  onChange={(event) => setContactId(event.target.value)}
                  value={contactId}
                >
                  <option value="">
                    {peopleStatus === 'success' && contacts.length === 0
                      ? 'No hay contactos elegibles en la organización'
                      : 'Sin contacto asignado'}
                  </option>
                  {contacts.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                    </option>
                  ))}
                </select>
                {peopleStatus === 'success' && contacts.length === 0 && (
                  <small className="field-error">
                    La organización no tiene contactos elegibles.
                  </small>
                )}
              </label>
              <div className="field">
                <span>Usuario que carga</span>
                <div className="operation-readonly">
                  <UserRound size={16} aria-hidden="true" />
                  {user?.name ?? user?.email ?? 'Sesión activa'}
                </div>
              </div>
            </div>

            {peopleStatus === 'error' && (
              <div className="operation-resource-error" role="alert">
                <div>
                  <strong>No pudimos cargar todas las personas elegibles</strong>
                  <p>{peopleError}</p>
                </div>
                <button
                  className="button button--secondary"
                  onClick={() => setPeopleLoadKey((current) => current + 1)}
                  type="button"
                >
                  <RefreshCw size={16} /> Reintentar
                </button>
              </div>
            )}

            <div className="operation-payment-block">
              <label className="field">
                <span>Plataforma de pago *</span>
                <select
                  onChange={(event) => {
                    const platform = event.target.value as SalesPaymentPlatform
                    setPaymentPlatform(platform)
                    if (!platform.includes('CREDITO')) {
                      setCreditAmount('')
                      setFinancialInstitutionId('')
                    }
                    if (!platform.startsWith('MOTO_')) {
                      setTradeInDescription('')
                      setTradeInAmount('')
                    }
                  }}
                  value={paymentPlatform}
                >
                  {paymentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {creditRequired && (
                <>
                  <label className="field">
                    <span>Monto del crédito *</span>
                    <input
                      aria-invalid={Boolean(fieldErrors.creditAmount)}
                      data-field="creditAmount"
                      min="0.01"
                      onChange={(event) => {
                        setCreditAmount(event.target.value)
                        clearError('creditAmount')
                      }}
                      step="0.01"
                      type="number"
                      value={creditAmount}
                    />
                    <FieldError message={fieldErrors.creditAmount} />
                  </label>
                  <label className="field">
                    <span>Financiera *</span>
                    <select
                      aria-invalid={Boolean(fieldErrors.financialInstitution)}
                      data-field="financialInstitution"
                      disabled={financialStatus === 'loading'}
                      onChange={(event) => {
                        setFinancialInstitutionId(event.target.value)
                        clearError('financialInstitution')
                      }}
                      value={financialInstitutionId}
                    >
                      <option value="">
                        {financialStatus === 'loading'
                          ? 'Cargando financieras…'
                          : 'Seleccionar financiera'}
                      </option>
                      {financialInstitutions.map((institution) => (
                        <option key={institution.id} value={institution.id}>
                          {institution.name}
                        </option>
                      ))}
                    </select>
                    <FieldError message={fieldErrors.financialInstitution} />
                  </label>
                  <label className="field">
                    <span>Respaldo / garante</span>
                    <input
                      maxLength={500}
                      onChange={(event) => setGuarantor(event.target.value)}
                      value={guarantor}
                    />
                  </label>
                  {financialStatus === 'error' && (
                    <div className="operation-field-retry" role="alert">
                      <span>{financialError}</span>
                      <button
                        onClick={() =>
                          setFinancialLoadKey((current) => current + 1)
                        }
                        type="button"
                      >
                        <RefreshCw size={15} /> Reintentar
                      </button>
                    </div>
                  )}
                </>
              )}

              {tradeInRequired && (
                <>
                  <label className="field operation-span-2">
                    <span>Unidad recibida como parte de pago *</span>
                    <input
                      aria-invalid={Boolean(fieldErrors.tradeInDescription)}
                      data-field="tradeInDescription"
                      maxLength={500}
                      onChange={(event) => {
                        setTradeInDescription(event.target.value)
                        clearError('tradeInDescription')
                      }}
                      placeholder="Marca, modelo, año, dominio o chasis"
                      value={tradeInDescription}
                    />
                    <FieldError message={fieldErrors.tradeInDescription} />
                  </label>
                  <label className="field">
                    <span>Valor aceptado *</span>
                    <input
                      aria-invalid={Boolean(fieldErrors.tradeInAmount)}
                      data-field="tradeInAmount"
                      min="0.01"
                      onChange={(event) => {
                        setTradeInAmount(event.target.value)
                        clearError('tradeInAmount')
                      }}
                      step="0.01"
                      type="number"
                      value={tradeInAmount}
                    />
                    <FieldError message={fieldErrors.tradeInAmount} />
                  </label>
                </>
              )}
            </div>
          </section>

          <section className="operation-section" aria-labelledby="operation-delivery-title">
            <SectionHeading
              id="operation-delivery-title"
              number={4}
              title="Entrega y documentación"
              description="Estado inicial, documentación y pendientes de la operación."
            />
            <div className="operation-form-grid">
              <div className="field">
                <span>Estado de entrega</span>
                <div className="operation-readonly">
                  <Store size={16} aria-hidden="true" />
                  No programada
                </div>
                <small>Se programa después de aprobar la operación.</small>
              </div>
              <label className="field">
                <span>Debe</span>
                <select
                  onChange={(event) =>
                    setDebtStatus(event.target.value as SalesDebt)
                  }
                  value={debtStatus}
                >
                  <option value="NO">No</option>
                  <option value="RESERVA">Reserva</option>
                  <option value="CUOTA_INICIAL">Cuota inicial</option>
                  <option value="PAPELES">Papeles</option>
                  <option value="ACCESORIOS">Accesorios</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
              <div className="field">
                <span>Mes</span>
                <div className="operation-readonly">
                  {monthFromDate(operationDate)}
                </div>
              </div>
              <div className="field">
                <span>Chasis de la operación</span>
                <div className="operation-readonly">
                  {selectedVehicle?.source === 'PHYSICAL'
                    ? selectedVehicle.unit.vin
                    : selectedVehicle
                      ? 'Pendiente al recibir'
                      : 'Seleccioná un vehículo'}
                </div>
              </div>
              <label className="operation-check">
                <input
                  checked={papersDelivered}
                  onChange={(event) => setPapersDelivered(event.target.checked)}
                  type="checkbox"
                />
                <FileCheck2 size={17} aria-hidden="true" />
                <span>Papeles entregados</span>
              </label>
              <label className="field operation-span-3">
                <span>Observaciones</span>
                <textarea
                  maxLength={2000}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  value={notes}
                />
              </label>
            </div>
          </section>

          <div className="operation-form__actions">
            <div className="operation-save-note">
              <CreditCard size={18} aria-hidden="true" />
              <span>
                El cliente se incorpora o actualiza dentro de la misma operación.
              </span>
            </div>
            <button
              className="button button--secondary"
              disabled={submitting}
              onClick={() => void save(false)}
              type="button"
            >
              Guardar borrador
            </button>
            <button
              className="button button--primary"
              disabled={submitting}
              type="submit"
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Guardando…' : 'Guardar y enviar operación'}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  )
}
