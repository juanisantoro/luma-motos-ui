import {
  AlertTriangle,
  CreditCard,
  FileCheck2,
  HardHat,
  LoaderCircle,
  RefreshCw,
  Store,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, NetworkError } from '../../shared/api/client'
import {
  ConfirmPreviewModal,
  type ConfirmPreviewSection,
} from '../../shared/components/ConfirmPreviewModal'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { useAuth } from '../auth/AuthContext'
import {
  branchScopeKey,
  defaultBranchId,
  filterAllowedBranches,
  filterPeopleInScope,
  isBranchSelectionLocked,
} from '../auth/branchScope'
import { hasPermission } from '../auth/PermissionRoute'
import { CreditAlert, useCreditCheck } from '../credit-checks'
import { confirmOperationCredit, listCreditPlans } from '../credit-plans/api'
import { buildInstallmentSchedule, simulateCredit } from '../credit-plans/creditCalculator'
import { formatMoney as formatCreditAmount } from '../credit-plans/format'
import type { CreditPlan } from '../credit-plans/types'
import {
  listSalesBranches,
  listSalesCatalogVersions,
  listSalesPhysicalUnits,
  listSalesSupplierAvailability,
  listUnitColors,
} from '../stock/api'
import type {
  BranchOption,
  CatalogModel,
  PhysicalUnit,
  SupplierAvailability,
  VehicleCondition,
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
import { alertError, alertSuccess } from '../../shared/alerts'
import {
  OperationVehiclePicker,
  optionCatalogModel,
  type OperationVehicleOption,
} from './OperationVehiclePicker'
import {
  licensingEstimate,
  licensingModeDescriptions,
  licensingModeLabels,
  licensingWindowLabel,
  useLicensingHolidays,
} from './licensing'
import { formatMoney } from './presentation'
import { localIsoDate } from '../../shared/utils/date'
import {
  CreatedOperationPanel,
  type CreatedOperationKind,
} from './CreatedOperationPanel'
import type {
  SalesDebt,
  SalesFinancialInstitution,
  SalesLicensingMode,
  SalesOperation,
  SalesPaymentComponentInput,
  SalesPaymentPlatform,
  SalesPricePolicy,
  SalesSeller,
} from './types'

type Completion = {
  kind: CreatedOperationKind
  operation: SalesOperation
  message: string
}

type FormField =
  | 'documentNumber'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'vehicle'
  | 'branch'
  | 'policy'
  | 'agreedPrice'
  | 'seller'
  | 'financialInstitution'
  | 'creditAmount'
  | 'personalCreditAmount'
  | 'personalCreditFirstDueDate'
  | 'tradeInDescription'
  | 'tradeInAmount'
  | 'licensingMode'
  | 'licensingAmount'

type FieldErrors = Partial<Record<FormField, string>>

const paymentOptions: Array<{ value: SalesPaymentPlatform; label: string }> = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'EFECTIVO_CREDITO', label: 'Efectivo + crédito' },
  { value: 'MOTO_EFECTIVO', label: 'Moto + efectivo' },
  { value: 'MOTO_CREDITO', label: 'Moto + crédito' },
  { value: 'MOTO_EFECTIVO_CREDITO', label: 'Moto + efectivo + crédito' },
]

// Fecha de hoy en huso local: usar UTC (toISOString) acá adelanta el día
// varias horas antes de medianoche en Argentina (UTC-3).
const today = localIsoDate()

function normalizeDocument(value: string) {
  return value.replace(/[\s.-]/g, '').toUpperCase()
}

const DNI_NUMBER_PATTERN = /^\d{6,9}$/


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
  return option ? optionCatalogModel(option) : null
}

function selectedCondition(
  option: OperationVehicleOption | null,
): VehicleCondition | null {
  if (!option) return null
  if (option.source === 'PHYSICAL') return option.unit.condition
  if (option.source === 'SUPPLIER') return option.availability.condition
  return 'NUEVO'
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
  // Fase 5: feriados nacionales para previsualizar la misma ventana que la API.
  const licensingHolidays = useLicensingHolidays()
  const canViewAvailability = hasPermission(
    permissions,
    'proveedores.consultar',
  )
  const canConfigurePrice =
    hasPermission(permissions, 'catalogo.gestionar') &&
    hasPermission(permissions, 'catalogo.consultar') &&
    hasPermission(permissions, 'inventario.consultar')
  const canOfferPersonalCredit = hasPermission(permissions, 'creditos.consultar')
  const organizationId = user?.globalAccess
    ? user.organization.id
    : undefined
  const peopleOrganizationId = user?.organization.id
  const isSeller = user?.role.code === 'VENDEDOR' || user?.role.code === 'CALLCENTER'

  const [documentType, setDocumentType] = useState<'DNI' | 'CI'>('DNI')
  const [documentNumber, setDocumentNumber] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
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
  const [personalCreditPlans, setPersonalCreditPlans] = useState<CreditPlan[]>([])
  const [personalCreditStatus, setPersonalCreditStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [personalCreditPlanId, setPersonalCreditPlanId] = useState('')
  const [personalCreditAmount, setPersonalCreditAmount] = useState('')
  const [personalCreditFirstDueDate, setPersonalCreditFirstDueDate] = useState('')
  const [guarantor, setGuarantor] = useState('')
  const [ticketNumber, setTicketNumber] = useState('')
  const [includesHelmet, setIncludesHelmet] = useState(false)
  const [licensingMode, setLicensingMode] = useState<SalesLicensingMode | ''>(
    '',
  )
  const [licensingAmount, setLicensingAmount] = useState('')
  // Acción pendiente de confirmar en la previsualización: guardar borrador
  // (false) o guardar y enviar (true). null = formulario visible.
  const [pendingSave, setPendingSave] = useState<boolean | null>(null)
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
  // Only the branches in the user's scope are offered; with a single one the
  // selector stays fixed (the API rejects any other branch anyway).
  const hasFixedBranch = isBranchSelectionLocked(user, branches)
  const scopeKey = branchScopeKey(user)
  const userBranchId = user?.branch?.id ?? null
  const [color, setColor] = useState('')
  const [colorOptions, setColorOptions] = useState<
    { id: string; name: string }[]
  >([])
  const [colorsLoading, setColorsLoading] = useState(true)
  const [units, setUnits] = useState<PhysicalUnit[]>([])
  // Fase 3 (sólo motos): 0 km se vende desde el catálogo; usadas, desde el
  // stock físico. Autos sin cambios (unidad o disponibilidad de proveedor).
  const isMoto = vehicleType === 'MOTO'
  const [motoCondition, setMotoCondition] = useState<VehicleCondition>('NUEVO')
  const [catalogVersions, setCatalogVersions] = useState<CatalogModel[]>([])
  const [availability, setAvailability] = useState<SupplierAvailability[]>([])
  const [vehicleLoading, setVehicleLoading] = useState(true)
  const [vehicleErrors, setVehicleErrors] = useState<
    Array<{ source: string; message: string }>
  >([])
  const [vehicleLoadKey, setVehicleLoadKey] = useState(0)
  const [debouncedVehicleSearch, setDebouncedVehicleSearch] = useState('')
  const [pinnedVehicleOption, setPinnedVehicleOption] =
    useState<OperationVehicleOption | null>(null)
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
        const allowed = filterAllowedBranches(scopeKey, items)
        setBranches(allowed)
        setBranchId((current) => {
          if (allowed.some((branch) => branch.id === current)) return current
          return defaultBranchId(scopeKey, allowed, userBranchId)
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
  }, [organizationId, userBranchId, scopeKey, vehicleLoadKey])

  useEffect(() => {
    const controller = new AbortController()
    setColorsLoading(true)
    listUnitColors(controller.signal)
      .then((options) => {
        if (controller.signal.aborted) return
        setColorOptions(options)
        setColorsLoading(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setColorsLoading(false)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedVehicleSearch(vehicleSearch.trim())
    }, 350)
    return () => clearTimeout(timeout)
  }, [vehicleSearch])

  const vehicleSearchQuery =
    debouncedVehicleSearch.length >= 3 ? debouncedVehicleSearch : ''

  useEffect(() => {
    if (!vehicleSearchQuery) {
      setCatalogVersions([])
      setUnits([])
      setAvailability([])
      setVehicleErrors([])
      setVehicleLoading(false)
      return
    }
    const controller = new AbortController()
    setVehicleLoading(true)
    setVehicleErrors([])
    void Promise.allSettled([
      vehicleType === 'MOTO'
        ? listSalesCatalogVersions(
            vehicleType,
            organizationId,
            vehicleSearchQuery,
            controller.signal,
          )
        : Promise.resolve([]),
      listSalesPhysicalUnits(
        vehicleType,
        organizationId,
        vehicleSearchQuery,
        controller.signal,
      ),
      canViewAvailability
        ? listSalesSupplierAvailability(
            vehicleType,
            organizationId,
            vehicleSearchQuery,
            controller.signal,
          )
        : Promise.resolve([]),
    ]).then(
      ([versionResult, unitResult, availabilityResult]) => {
      if (controller.signal.aborted) return
      const errors: Array<{ source: string; message: string }> = []
      if (versionResult.status === 'fulfilled') {
        setCatalogVersions(versionResult.value)
      } else {
        setCatalogVersions([])
        errors.push({
          source: 'Catálogo 0 km',
          message: resourceError(versionResult.reason),
        })
      }
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
    vehicleSearchQuery,
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
    let fresh: OperationVehicleOption[]
    if (isMoto && motoCondition === 'NUEVO') {
      // 0 km: versiones del catálogo; stock y proveedores sólo de referencia.
      fresh = catalogVersions
        .filter((version) => version.vehicleType === vehicleType)
        .map((version) => ({
          key: `version:${version.id}`,
          source: 'CATALOG' as const,
          catalogModel: version,
          stockCount: units.filter(
            (unit) =>
              unit.catalogModel.id === version.id &&
              unit.condition === 'NUEVO' &&
              (!branchId || unit.branch.id === branchId),
          ).length,
          supplierNames: [
            ...new Set(
              availability
                .filter(
                  (item) =>
                    item.catalogModel.id === version.id &&
                    item.condition === 'NUEVO' &&
                    item.quantity > 0,
                )
                .map((item) => item.supplier.name),
            ),
          ],
        }))
    } else {
      const physical = units
        .filter(
          (unit) =>
            unit.vehicleType === vehicleType &&
            (!isMoto || unit.condition === 'USADO'),
        )
        .map((unit) => ({
          key: `unit:${unit.id}`,
          source: 'PHYSICAL' as const,
          unit,
        }))
      // Autos: además la disponibilidad de proveedores, como siempre.
      const supplier = isMoto
        ? []
        : availability
            .filter(
              (item) => item.vehicleType === vehicleType && item.quantity > 0,
            )
            .map((item) => ({
              key: `availability:${item.id}`,
              source: 'SUPPLIER' as const,
              availability: item,
            }))
      fresh = [...physical, ...supplier]
    }
    if (
      pinnedVehicleOption &&
      !fresh.some((option) => option.key === pinnedVehicleOption.key)
    ) {
      return [pinnedVehicleOption, ...fresh]
    }
    return fresh
  }, [
    availability,
    branchId,
    catalogVersions,
    isMoto,
    motoCondition,
    pinnedVehicleOption,
    units,
    vehicleType,
  ])

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
        const scopedSellers = filterPeopleInScope(scopeKey, sellerResult.value.items)
        setSellers(scopedSellers)
        setSellerId((current) => {
          if (scopedSellers.some((person) => person.id === current)) {
            return current
          }
          // Default the seller to whoever is loading the sale, for every
          // role - not just VENDEDOR. Non-sellers can still pick someone
          // else from the dropdown afterwards (it stays enabled below);
          // what this fixes is operations silently landing on a leftover
          // or wrong seller because the field defaulted to blank.
          const currentUser =
            scopedSellers.find((person) => person.isCurrentUser) ??
            scopedSellers.find(
              (person) =>
                user?.name &&
                person.fullName.localeCompare(user.name, 'es', {
                  sensitivity: 'base',
                }) === 0,
            ) ??
            (isSeller && scopedSellers.length === 1
              ? scopedSellers[0]
              : undefined)
          return currentUser?.id ?? ''
        })
      } else {
        setSellers([])
        errors.push(`Vendedores: ${resourceError(sellerResult.reason)}`)
      }
      if (contactResult.status === 'fulfilled') {
        const scopedContacts = filterPeopleInScope(scopeKey, contactResult.value.items)
        setContacts(scopedContacts)
        setContactId((current) =>
          scopedContacts.some((person) => person.id === current)
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
    scopeKey,
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
    if (!canOfferPersonalCredit) return
    const controller = new AbortController()
    setPersonalCreditStatus('loading')
    listCreditPlans({ page: 1, limit: 100, active: true }, controller.signal)
      .then((response) => {
        setPersonalCreditPlans(response.items)
        setPersonalCreditStatus('success')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setPersonalCreditPlans([])
        setPersonalCreditStatus('error')
      })
    return () => controller.abort()
  }, [canOfferPersonalCredit])

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
  const eligiblePersonalCreditPlans = personalCreditPlans.filter((plan) => {
    if (!Number.isFinite(price) || price <= 0) return true
    if (plan.minimumAmount !== null && price < plan.minimumAmount) return false
    if (plan.maximumAmount !== null && price > plan.maximumAmount) return false
    return true
  })
  const selectedPersonalCreditPlan =
    personalCreditPlans.find((plan) => plan.id === personalCreditPlanId) ?? null
  const personalCreditSimulation =
    selectedPersonalCreditPlan && Number(personalCreditAmount) > 0
      ? simulateCredit(
          Number(personalCreditAmount),
          selectedPersonalCreditPlan.installmentCount,
          selectedPersonalCreditPlan.interestRate,
          selectedPersonalCreditPlan.calculationMethod,
        )
      : null
  const personalCreditSchedule =
    personalCreditSimulation && personalCreditFirstDueDate
      ? buildInstallmentSchedule(
          personalCreditSimulation,
          new Date(`${personalCreditFirstDueDate}T00:00:00.000Z`),
        )
      : []
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
    // Re-elegir la misma opción no debe borrar el precio ya cargado.
    if (option.key === vehicleKey) return
    setVehicleKey(option.key)
    setPinnedVehicleOption(option)
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
    const normalizedDocument = normalizeDocument(documentNumber)
    if (normalizedDocument.length < 5) {
      errors.documentNumber = 'Ingresá un DNI o CI válido.'
    } else if (documentType === 'DNI' && !DNI_NUMBER_PATTERN.test(normalizedDocument)) {
      errors.documentNumber = 'El DNI debe tener solo números (6 a 9 dígitos).'
    }
    if (!firstName.trim()) errors.firstName = 'Ingresá el nombre del cliente.'
    if (!lastName.trim()) errors.lastName = 'Ingresá el apellido del cliente.'
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
    if (!licensingMode) {
      errors.licensingMode = 'Elegí la modalidad de patentamiento.'
    }
    if (licensingMode === 'PAGA_CLIENTE' && licensingAmount.trim()) {
      const amount = Number(licensingAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.licensingAmount = 'Ingresá un importe mayor a cero o dejalo vacío.'
      }
    }
    if (creditBlocksSale) {
      errors.documentNumber =
        'El antecedente crediticio bloquea esta operación según el backend.'
    }
    if (personalCreditPlanId) {
      const financedAmount = Number(personalCreditAmount)
      if (!Number.isFinite(financedAmount) || financedAmount <= 0) {
        errors.personalCreditAmount = 'Ingresá el monto a financiar.'
      } else if (selectedPersonalCreditPlan) {
        if (
          selectedPersonalCreditPlan.minimumAmount !== null &&
          financedAmount < selectedPersonalCreditPlan.minimumAmount
        ) {
          errors.personalCreditAmount = `El monto no puede ser menor a ${selectedPersonalCreditPlan.minimumAmount}.`
        } else if (
          selectedPersonalCreditPlan.maximumAmount !== null &&
          financedAmount > selectedPersonalCreditPlan.maximumAmount
        ) {
          errors.personalCreditAmount = `El monto no puede superar ${selectedPersonalCreditPlan.maximumAmount}.`
        }
      }
      if (!personalCreditFirstDueDate) {
        errors.personalCreditFirstDueDate = 'Elegí la fecha del primer vencimiento.'
      }
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

  // Guardar/Enviar primero valida y abre la previsualización; recién
  // "Confirmar" dispara el POST.
  const requestSave = (sendOperation: boolean) => {
    if (!validate() || !selectedVehicle || !catalogModel || !condition || !policy) {
      return
    }
    setPendingSave(sendOperation)
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
          fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
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
          : selectedVehicle.source === 'SUPPLIER'
            ? {
                supplierAvailabilityId: selectedVehicle.availability.id,
                ...(color.trim() ? { color: color.trim() } : {}),
              }
            : // Moto 0 km: sin unidad ni proveedor; asigna la administrativa.
              color.trim()
              ? { color: color.trim() }
              : {}),
        sellerId,
        ...(contactId ? { contactId } : {}),
        operationDate,
        deliveryStatus: 'NO_PROGRAMADA',
        papersDelivered,
        debt: debtStatus,
        submit: false,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(ticketNumber.trim() ? { ticketNumber: ticketNumber.trim() } : {}),
        includesHelmet,
        licensingMode: licensingMode as SalesLicensingMode,
        ...(licensingMode === 'PAGA_CLIENTE' && licensingAmount.trim()
          ? { licensingAmount: Number(licensingAmount) }
          : {}),
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

      if (personalCreditPlanId) {
        await confirmOperationCredit(persisted.id, {
          planId: personalCreditPlanId,
          financedAmount: Number(personalCreditAmount),
          firstDueDate: personalCreditFirstDueDate,
        })
      }

      if (sendOperation) {
        persisted = await submitSalesOperation(
          persisted.id,
          persisted.rowVersion,
        )
      }

      const completionMessage = sendOperation
        ? belowList
          ? `La operación y el cliente quedaron registrados. Se envió a aprobación por una diferencia de ${formatMoney(String(listDifference), policy.currency)} debajo de lista.`
          : 'La operación y el cliente quedaron registrados y se enviaron al circuito comercial.'
        : 'La operación, el cliente y sus condiciones comerciales quedaron guardados como borrador.'
      setCompletion({
        kind: sendOperation ? 'submitted' : 'draft',
        operation: persisted,
        message: completionMessage,
      })
      void alertSuccess(completionMessage)
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
        setPinnedVehicleOption(null)
        setPolicy(null)
        setAgreedPrice('')
        setReservationConflict(true)
        setVehicleLoadKey((current) => current + 1)
        void alertError('La unidad elegida ya no está disponible. Elegí otra para continuar.')
        return
      }
      if (persisted) {
        const partialMessage = `La operación quedó guardada como borrador, pero no se completaron todos sus datos relacionados. No vuelvas a enviarla: informá el número de operación para completar el seguimiento sin duplicarla. ${salesErrorMessage(error)}`
        setCompletion({
          kind: 'partial',
          operation: persisted,
          message: partialMessage,
        })
        void alertError(partialMessage)
      } else {
        const message = salesErrorMessage(error)
        setFormError(message)
        void alertError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    requestSave(true)
  }

  const confirmPendingSave = () => {
    if (pendingSave === null) return
    const sendOperation = pendingSave
    setPendingSave(null)
    void save(sendOperation)
  }

  const previewSections = (): ConfirmPreviewSection[] => {
    const currency = policy?.currency ?? 'ARS'
    const money = (value: number) => formatMoney(String(value), currency)
    const branch = branches.find((item) => item.id === branchId)
    const seller = sellers.find((item) => item.id === sellerId)
    const contact = contacts.find((item) => item.id === contactId)
    const institution = financialInstitutions.find(
      (item) => item.id === financialInstitutionId,
    )
    const platformLabel =
      paymentOptions.find((option) => option.value === paymentPlatform)?.label ??
      paymentPlatform
    const components = paymentPlan(
      paymentPlatform,
      price,
      credit,
      financialInstitutionId,
      tradeIn,
      tradeInRequired ? 'pending' : undefined,
    )
    const componentLabels: Record<SalesPaymentComponentInput['type'], string> = {
      EFECTIVO: 'Efectivo',
      TRANSFERENCIA_BANCARIA: 'Transferencia',
      TARJETA: 'Tarjeta',
      FINANCIACION: institution
        ? `Financiación · ${institution.name}`
        : 'Financiación',
      TOMA_PARTE_PAGO: 'Toma en parte de pago',
      OTRO: 'Otro',
    }
    const estimate = licensingEstimate(operationDate, licensingHolidays)
    const vehicleName = catalogModel
      ? [catalogModel.brand, catalogModel.model, catalogModel.version]
          .filter(Boolean)
          .join(' ')
      : ''
    return [
      {
        title: 'Cliente',
        rows: [
          {
            label: 'Nombre',
            value: `${firstName.trim()} ${lastName.trim()}`.trim(),
          },
          {
            label: 'Documento',
            value: `${documentType} ${normalizeDocument(documentNumber)}`,
          },
          { label: 'Teléfono', value: phone.trim() },
        ],
      },
      {
        title: 'Vehículo',
        rows: [
          { label: 'Modelo', value: vehicleName },
          {
            label: 'Condición',
            value: condition === 'USADO' ? 'Usado' : 'Nuevo',
          },
          {
            label: 'Origen',
            value:
              selectedVehicle?.source === 'PHYSICAL'
                ? `Stock físico · chasis ${selectedVehicle.unit.vin}`
                : selectedVehicle?.source === 'SUPPLIER'
                  ? `Proveedor · ${selectedVehicle.availability.supplier.name}`
                  : selectedVehicle?.source === 'CATALOG'
                    ? `0 km · la unidad la asigna la administrativa (${
                        selectedVehicle.stockCount > 0
                          ? `${selectedVehicle.stockCount} en stock en la sucursal`
                          : 'sin stock, se pide a proveedor'
                      })`
                    : '',
          },
          ...(selectedVehicle && selectedVehicle.source !== 'PHYSICAL' && color.trim()
            ? [
                {
                  label:
                    selectedVehicle.source === 'CATALOG'
                      ? 'Color deseado'
                      : 'Color',
                  value: color.trim(),
                },
              ]
            : []),
        ],
      },
      {
        title: 'Precio',
        rows: [
          {
            label: 'Precio de lista',
            value: policy ? formatMoney(policy.listPrice, currency) : '',
          },
          {
            label: 'Precio mínimo',
            value: policy ? formatMoney(policy.minimumPrice, currency) : '',
          },
          { label: 'Precio acordado', value: money(price), emphasis: belowList },
          ...(belowList
            ? [
                {
                  label: 'Debajo de lista',
                  value: `${money(listDifference)} · requiere aprobación`,
                  emphasis: true,
                },
              ]
            : []),
        ],
      },
      {
        title: 'Plan de pago',
        rows: [
          { label: 'Plataforma', value: platformLabel },
          ...components.map((component) => ({
            label: componentLabels[component.type],
            value: money(component.amount),
          })),
          ...(tradeInRequired && tradeInDescription.trim()
            ? [{ label: 'Unidad tomada', value: tradeInDescription.trim() }]
            : []),
          ...(guarantor.trim()
            ? [{ label: 'Garante', value: guarantor.trim() }]
            : []),
          ...(selectedPersonalCreditPlan
            ? [
                {
                  label: 'Crédito personal',
                  value: `${selectedPersonalCreditPlan.name} · ${formatCreditAmount(Number(personalCreditAmount))}`,
                },
              ]
            : []),
        ],
      },
      {
        title: 'Entrega y patentamiento',
        rows: [
          { label: 'Casco de regalo', value: includesHelmet ? 'Sí' : 'No' },
          {
            label: 'Patentamiento',
            value: licensingMode ? licensingModeLabels[licensingMode] : '',
          },
          ...(licensingMode === 'PAGA_CLIENTE'
            ? [
                {
                  label: 'Importe de patente',
                  value: licensingAmount.trim()
                    ? money(Number(licensingAmount))
                    : 'A definir cuando llegue la patente',
                },
              ]
            : []),
          {
            label: 'Llegada estimada',
            value: estimate
              ? licensingWindowLabel(estimate.from, estimate.to)
              : '',
          },
          {
            label: 'Papeles entregados',
            value: papersDelivered ? 'Sí' : 'No',
          },
        ],
      },
      {
        title: 'Operación',
        rows: [
          { label: 'Fecha', value: operationDate.split('-').reverse().join('/') },
          { label: 'Sucursal', value: branch?.name ?? '' },
          { label: 'Vendedor', value: seller?.fullName ?? '' },
          ...(contact ? [{ label: 'Contacto', value: contact.fullName }] : []),
          ...(ticketNumber.trim()
            ? [{ label: 'Número de boleto', value: ticketNumber.trim() }]
            : []),
          ...(notes.trim()
            ? [{ label: 'Observaciones', value: notes.trim() }]
            : []),
        ],
      },
    ]
  }

  if (completion) {
    return (
      <CreatedOperationPanel
        initialOperation={completion.operation}
        kind={completion.kind}
        message={completion.message}
        permissions={permissions}
        vehicleType={vehicleType}
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
      {pendingSave !== null && (
        <ConfirmPreviewModal
          backLabel="Volver"
          confirmLabel={
            pendingSave ? 'Confirmar y enviar' : 'Confirmar borrador'
          }
          description="Revisá lo que se va a guardar. Podés volver al formulario sin perder los datos."
          eyebrow={pendingSave ? 'GUARDAR Y ENVIAR' : 'GUARDAR BORRADOR'}
          onBack={() => setPendingSave(null)}
          onConfirm={confirmPendingSave}
          sections={previewSections()}
          title={`Confirmá la operación de ${vehicleType === 'MOTO' ? 'moto' : 'auto'}`}
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
                  inputMode={documentType === 'DNI' ? 'numeric' : 'text'}
                  onChange={(event) => {
                    const raw = event.target.value
                    setDocumentNumber(
                      documentType === 'DNI' ? raw.replace(/[^\d]/g, '') : raw,
                    )
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
                  onChange={(event) => {
                    const nextType = event.target.value as 'DNI' | 'CI'
                    setDocumentType(nextType)
                    if (nextType === 'DNI') {
                      setDocumentNumber((current) => current.replace(/[^\d]/g, ''))
                    }
                    clearError('documentNumber')
                  }}
                  value={documentType}
                >
                  <option value="DNI">DNI</option>
                  <option value="CI">CI</option>
                </select>
              </label>
              <label className="field">
                <span>Nombre *</span>
                <input
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  data-field="firstName"
                  maxLength={90}
                  onChange={(event) => {
                    setFirstName(event.target.value)
                    clearError('firstName')
                  }}
                  value={firstName}
                />
                <FieldError message={fieldErrors.firstName} />
              </label>
              <label className="field">
                <span>Apellido *</span>
                <input
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  data-field="lastName"
                  maxLength={90}
                  onChange={(event) => {
                    setLastName(event.target.value)
                    clearError('lastName')
                  }}
                  value={lastName}
                />
                <FieldError message={fieldErrors.lastName} />
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
              description={
                isMoto
                  ? 'Moto 0 km: elegí la versión del catálogo. Moto usada: elegí la unidad en stock.'
                  : 'Buscá una unidad física o disponibilidad real de proveedor.'
              }
            />
            {isMoto && (
              <label className="field">
                <span>Condición *</span>
                <select
                  aria-label="Condición"
                  onChange={(event) => {
                    setMotoCondition(event.target.value as VehicleCondition)
                    // Cambia el origen (catálogo o stock): se vuelve a elegir.
                    setVehicleKey('')
                    setPinnedVehicleOption(null)
                    setPolicy(null)
                    setAgreedPrice('')
                  }}
                  value={motoCondition}
                >
                  <option value="NUEVO">0 km (catálogo)</option>
                  <option value="USADO">Usada (stock)</option>
                </select>
              </label>
            )}
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
                      : selectedVehicle.source === 'SUPPLIER'
                        ? `Stock de ${selectedVehicle.availability.supplier.name} (${selectedVehicle.availability.quantity}) · Chasis al recibir`
                        : 'La unidad la asigna la administrativa'}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Origen</dt>
                    <dd>
                      {selectedVehicle.source === 'PHYSICAL'
                        ? 'Unidad física'
                        : selectedVehicle.source === 'SUPPLIER'
                          ? 'Disponibilidad proveedor'
                          : selectedVehicle.stockCount > 0
                            ? `0 km · ${selectedVehicle.stockCount} en stock`
                            : '0 km · a pedir a proveedor'}
                    </dd>
                  </div>
                  <div>
                    <dt>Chasis</dt>
                    <dd>
                      {selectedVehicle.source === 'PHYSICAL'
                        ? selectedVehicle.unit.vin
                        : selectedVehicle.source === 'SUPPLIER'
                          ? 'Pendiente al recibir'
                          : 'Al asignar la unidad'}
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

            {selectedVehicle && selectedVehicle.source !== 'PHYSICAL' && (
              <label className="field">
                <span>
                  {selectedVehicle.source === 'CATALOG'
                    ? 'Color deseado (opcional)'
                    : 'Color solicitado (opcional)'}
                </span>
                <select
                  aria-label={
                    selectedVehicle.source === 'CATALOG'
                      ? 'Color deseado'
                      : 'Color solicitado al proveedor'
                  }
                  disabled={colorsLoading}
                  onChange={(event) => setColor(event.target.value)}
                  value={color}
                >
                  <option value="">
                    {colorsLoading ? 'Cargando…' : 'Sin especificar'}
                  </option>
                  {colorOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <small>
                  {selectedVehicle.source === 'CATALOG'
                    ? 'Se usa al elegir la unidad o al pedirla al proveedor.'
                    : 'Se guarda en el pedido y queda precargado al recibir la unidad.'}
                </small>
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
                {!isSeller && sellerId && (
                  <small>
                    Se preselecciona tu usuario. Cambialo solo si la venta la
                    hizo otro vendedor.
                  </small>
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

              {canOfferPersonalCredit && (
                <>
                  <label className="field operation-span-2">
                    <span>Crédito personal (opcional)</span>
                    <select
                      onChange={(event) => {
                        const planId = event.target.value
                        setPersonalCreditPlanId(planId)
                        clearError('personalCreditAmount')
                        clearError('personalCreditFirstDueDate')
                        const plan = personalCreditPlans.find(
                          (item) => item.id === planId,
                        )
                        setPersonalCreditAmount(
                          plan && Number.isFinite(price) ? String(price) : '',
                        )
                      }}
                      value={personalCreditPlanId}
                    >
                      <option value="">Sin crédito personal</option>
                      {eligiblePersonalCreditPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} · {plan.installmentCount} cuotas ·{' '}
                          {plan.interestRate}%{' '}
                          {plan.calculationMethod === 'FRANCES' ? 'mensual' : 'total'}
                        </option>
                      ))}
                    </select>
                    {personalCreditStatus === 'success' &&
                      eligiblePersonalCreditPlans.length === 0 && (
                        <small>No hay planes activos que apliquen a este monto.</small>
                      )}
                  </label>
                  {selectedPersonalCreditPlan && (
                    <label className="field">
                      <span>Primer vencimiento *</span>
                      <input
                        aria-invalid={Boolean(fieldErrors.personalCreditFirstDueDate)}
                        data-field="personalCreditFirstDueDate"
                        min={operationDate}
                        onChange={(event) => {
                          setPersonalCreditFirstDueDate(event.target.value)
                          clearError('personalCreditFirstDueDate')
                        }}
                        type="date"
                        value={personalCreditFirstDueDate}
                      />
                      <FieldError message={fieldErrors.personalCreditFirstDueDate} />
                    </label>
                  )}
                  {selectedPersonalCreditPlan && (
                    <label className="field">
                      <span>Monto a financiar *</span>
                      <input
                        aria-invalid={Boolean(fieldErrors.personalCreditAmount)}
                        data-field="personalCreditAmount"
                        min="0.01"
                        onChange={(event) => {
                          setPersonalCreditAmount(event.target.value)
                          clearError('personalCreditAmount')
                        }}
                        step="0.01"
                        type="number"
                        value={personalCreditAmount}
                      />
                      <FieldError message={fieldErrors.personalCreditAmount} />
                    </label>
                  )}
                  {personalCreditSimulation && (
                    <p className="operation-span-3" style={{ margin: 0, fontSize: 13 }}>
                      Cuota:{' '}
                      <strong>
                        {formatCreditAmount(personalCreditSimulation.installmentAmount)}
                      </strong>{' '}
                      · Interés total:{' '}
                      {formatCreditAmount(personalCreditSimulation.totalInterest)} · Total a
                      pagar: {formatCreditAmount(personalCreditSimulation.totalAmount)}
                    </p>
                  )}
                  {personalCreditSchedule.length > 0 && (
                    <ul
                      className="operation-span-3"
                      style={{
                        margin: 0,
                        maxHeight: 140,
                        overflowY: 'auto',
                        padding: '6px 10px',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        fontSize: 12,
                        listStyle: 'none',
                      }}
                    >
                      {personalCreditSchedule.map((installment) => (
                        <li key={installment.number}>
                          Cuota {installment.number} —{' '}
                          {installment.dueDate.toISOString().slice(0, 10)} —{' '}
                          {formatCreditAmount(installment.amount)}
                        </li>
                      ))}
                    </ul>
                  )}
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
                    : selectedVehicle?.source === 'CATALOG'
                      ? 'Lo asigna la administrativa'
                      : selectedVehicle
                        ? 'Pendiente al recibir'
                        : 'Seleccioná un vehículo'}
                </div>
              </div>
              <label className="field">
                <span>Número de boleto</span>
                <input
                  maxLength={40}
                  onChange={(event) => setTicketNumber(event.target.value)}
                  value={ticketNumber}
                />
              </label>
              <div className="field">
                <span id="operation-licensing-mode-label">Patentamiento *</span>
                <select
                  aria-invalid={Boolean(fieldErrors.licensingMode)}
                  aria-labelledby="operation-licensing-mode-label"
                  data-field="licensingMode"
                  onChange={(event) => {
                    const mode = event.target.value as SalesLicensingMode | ''
                    setLicensingMode(mode)
                    if (mode !== 'PAGA_CLIENTE') {
                      setLicensingAmount('')
                      clearError('licensingAmount')
                    }
                    clearError('licensingMode')
                  }}
                  value={licensingMode}
                >
                  <option value="">Seleccionar modalidad</option>
                  <option value="BONIFICADA">
                    {licensingModeLabels.BONIFICADA}
                  </option>
                  <option value="PAGA_CLIENTE">
                    {licensingModeLabels.PAGA_CLIENTE}
                  </option>
                </select>
                {licensingMode && (
                  <small>{licensingModeDescriptions[licensingMode]}</small>
                )}
                <FieldError message={fieldErrors.licensingMode} />
              </div>
              {licensingMode === 'PAGA_CLIENTE' && (
                <div className="field">
                  <span id="operation-licensing-amount-label">
                    Importe de patente
                  </span>
                  <input
                    aria-invalid={Boolean(fieldErrors.licensingAmount)}
                    aria-labelledby="operation-licensing-amount-label"
                    data-field="licensingAmount"
                    min="0.01"
                    onChange={(event) => {
                      setLicensingAmount(event.target.value)
                      clearError('licensingAmount')
                    }}
                    placeholder="Opcional"
                    step="0.01"
                    type="number"
                    value={licensingAmount}
                  />
                  <small>Opcional. El cobro se registra cuando llega la patente.</small>
                  <FieldError message={fieldErrors.licensingAmount} />
                </div>
              )}
              <div className="field">
                <span>Llegada estimada de la patente</span>
                <div className="operation-readonly">
                  {(() => {
                    const estimate = licensingEstimate(operationDate, licensingHolidays)
                    return estimate
                      ? licensingWindowLabel(estimate.from, estimate.to)
                      : 'Elegí la fecha de la operación'
                  })()}
                </div>
                <small>Informativa: 10 a 15 días hábiles (sin fines de semana ni feriados nacionales) desde la operación.</small>
              </div>
              <label className="operation-check">
                <input
                  checked={includesHelmet}
                  onChange={(event) => setIncludesHelmet(event.target.checked)}
                  type="checkbox"
                />
                <HardHat size={17} aria-hidden="true" />
                <span>Casco de regalo</span>
              </label>
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
              onClick={() => requestSave(false)}
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
