import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Search,
  Store,
  Warehouse,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { CreditAlert, useCreditCheck } from '../credit-checks'
import { stockApiGateway } from '../stock/api'
import { stockErrorMessage } from '../stock/errors'
import type {
  PhysicalUnit,
  StockCapabilities,
  StockWorkspaceData,
  SupplierAvailability,
  VehicleKind,
} from '../stock/types'
import {
  createSalesOperation,
  getSalesPricePolicy,
  listSalesSellers,
} from './api'
import { salesErrorMessage } from './errors'
import { formatMoney } from './presentation'
import type {
  SalesDebt,
  SalesPaymentPlatform,
  SalesPricePolicy,
  SalesSeller,
} from './types'

type VehicleOption =
  | { key: string; source: 'PHYSICAL'; unit: PhysicalUnit }
  | { key: string; source: 'SUPPLIER'; availability: SupplierAvailability }

type Completion = {
  kind: 'draft' | 'submitted' | 'supply' | 'attention'
  number: string
  message: string
}

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

function versionLabel(
  item: PhysicalUnit['catalogModel'] | SupplierAvailability['catalogModel'],
) {
  return [item.brand, item.model, item.version].filter(Boolean).join(' ')
}

function vehicleOptionLabel(option: VehicleOption) {
  if (option.source === 'PHYSICAL') {
    const { unit } = option
    return `${unit.vehicleType === 'MOTO' ? 'Moto' : 'Auto'} · ${versionLabel(unit.catalogModel)} · ${unit.condition === 'NUEVO' ? 'Nuevo' : 'Usado'} · ${unit.branch.name} · Chasis ${unit.vin}`
  }
  const { availability } = option
  return `${availability.vehicleType === 'MOTO' ? 'Moto' : 'Auto'} · ${versionLabel(availability.catalogModel)} · ${availability.condition === 'NUEVO' ? 'Nuevo' : 'Usado'} · Proveedor ${availability.supplier.name} (${availability.quantity}) · Chasis al recibir`
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
  const canManageSupply = hasPermission(
    permissions,
    'abastecimiento.gestionar',
  )
  const capabilities = useMemo<StockCapabilities>(
    () => ({
      viewCatalog: hasPermission(permissions, 'catalogo.consultar'),
      viewAvailability: canViewAvailability,
      viewSupply: false,
      createUnits: false,
      createCatalog: false,
      createSharedCatalog: false,
      manageAvailability: false,
      manageSupply: false,
      receiveSupply: false,
    }),
    [canViewAvailability, permissions],
  )
  const organizationId = user?.globalAccess
    ? user.organization.id
    : undefined
  const isSeller = user?.role.code === 'VENDEDOR'

  const [documentType, setDocumentType] = useState<'DNI' | 'CI'>('DNI')
  const [documentNumber, setDocumentNumber] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [operationDate, setOperationDate] = useState(today)
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [vehicleKey, setVehicleKey] = useState('')
  const [branchId, setBranchId] = useState('')
  const [agreedPrice, setAgreedPrice] = useState('')
  const [paymentPlatform, setPaymentPlatform] =
    useState<SalesPaymentPlatform>('EFECTIVO')
  const [creditAmount, setCreditAmount] = useState('')
  const [guarantor, setGuarantor] = useState('')
  const [sellerId, setSellerId] = useState('')
  const [contactSellerId, setContactSellerId] = useState('')
  const [debtStatus, setDebtStatus] = useState<SalesDebt>('NO')
  const [papersDelivered, setPapersDelivered] = useState(false)
  const [notes, setNotes] = useState('')

  const [workspace, setWorkspace] = useState<StockWorkspaceData | null>(null)
  const [workspaceStatus, setWorkspaceStatus] = useState<
    'loading' | 'success' | 'error'
  >('loading')
  const [workspaceError, setWorkspaceError] = useState('')
  const [workspaceKey, setWorkspaceKey] = useState(0)
  const [sellers, setSellers] = useState<SalesSeller[]>([])
  const [sellerStatus, setSellerStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [sellerError, setSellerError] = useState('')
  const [policy, setPolicy] = useState<SalesPricePolicy | null>(null)
  const [policyStatus, setPolicyStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [policyError, setPolicyError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [completion, setCompletion] = useState<Completion | null>(null)

  const creditCheck = useCreditCheck({
    documentType,
    documentNumber,
    enabled: normalizeDocument(documentNumber).length >= 5,
  })

  useEffect(() => {
    const controller = new AbortController()
    setWorkspaceStatus('loading')
    setWorkspaceError('')
    void stockApiGateway
      .loadWorkspace(
        vehicleType,
        capabilities,
        organizationId,
        controller.signal,
      )
      .then((data) => {
        setWorkspace(data)
        setWorkspaceStatus('success')
        setBranchId((current) => {
          if (current && data.branches.some((branch) => branch.id === current)) {
            return current
          }
          if (
            user?.branch &&
            data.branches.some((branch) => branch.id === user.branch?.id)
          ) {
            return user.branch.id
          }
          return data.branches[0]?.id ?? ''
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setWorkspaceError(stockErrorMessage(error))
        setWorkspaceStatus('error')
      })
    return () => controller.abort()
  }, [
    capabilities,
    organizationId,
    user?.branch,
    vehicleType,
    workspaceKey,
  ])

  const vehicleOptions = useMemo<VehicleOption[]>(() => {
    if (!workspace) return []
    const physical = workspace.units
      .filter(
        (unit) =>
          unit.vehicleType === vehicleType && unit.status === 'EN_STOCK',
      )
      .map((unit) => ({
        key: `unit:${unit.id}`,
        source: 'PHYSICAL' as const,
        unit,
      }))
    const supplier = canViewAvailability
      ? workspace.availability
          .filter(
            (item) =>
              item.vehicleType === vehicleType && item.quantity > 0,
          )
          .map((availability) => ({
            key: `availability:${availability.id}`,
            source: 'SUPPLIER' as const,
            availability,
          }))
      : []
    return [...physical, ...supplier].sort((left, right) =>
      vehicleOptionLabel(left).localeCompare(vehicleOptionLabel(right), 'es'),
    )
  }, [canViewAvailability, vehicleType, workspace])

  const selectedVehicle =
    vehicleOptions.find((option) => option.key === vehicleKey) ?? null
  const selectedCatalog = selectedVehicle
    ? selectedVehicle.source === 'PHYSICAL'
      ? selectedVehicle.unit.catalogModel
      : selectedVehicle.availability.catalogModel
    : null
  const selectedCondition = selectedVehicle
    ? selectedVehicle.source === 'PHYSICAL'
      ? selectedVehicle.unit.condition
      : selectedVehicle.availability.condition
    : null
  const selectedVin =
    selectedVehicle?.source === 'PHYSICAL'
      ? selectedVehicle.unit.vin
      : selectedVehicle
        ? 'Pendiente: se carga al recibir'
        : 'Seleccioná un vehículo'

  useEffect(() => {
    if (!branchId) {
      setSellers([])
      setSellerStatus('idle')
      return
    }
    const controller = new AbortController()
    setSellerStatus('loading')
    setSellerError('')
    void listSalesSellers(
      {
        branchId,
        limit: 100,
        ...(organizationId ? { organizationId } : {}),
      },
      controller.signal,
    )
      .then((response) => {
        setSellers(response.items)
        setSellerStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSellerError(salesErrorMessage(error))
        setSellerStatus('error')
      })
    return () => controller.abort()
  }, [branchId, organizationId])

  useEffect(() => {
    if (!branchId || !selectedCatalog) {
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
        versionId: selectedCatalog.id,
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
        setPolicyError(salesErrorMessage(error))
        setPolicyStatus('error')
      })
    return () => controller.abort()
  }, [branchId, operationDate, organizationId, selectedCatalog, vehicleType])

  const listDifference =
    policy && agreedPrice !== ''
      ? Math.max(0, Number(policy.listPrice) - Number(agreedPrice))
      : 0
  const belowList = listDifference > 0
  const belowMinimum =
    policy !== null &&
    agreedPrice !== '' &&
    Number(agreedPrice) < Number(policy.minimumPrice)
  const creditRequired = paymentPlatform.includes('CREDITO')
  const creditBlocksSale =
    creditCheck.state.status === 'success' && creditCheck.state.data.blocksSale

  const chooseVehicle = (value: string) => {
    setVehicleSearch(value)
    const option =
      vehicleOptions.find((item) => vehicleOptionLabel(item) === value) ?? null
    setVehicleKey(option?.key ?? '')
    setPolicy(null)
    setAgreedPrice('')
    if (option?.source === 'PHYSICAL') {
      setBranchId(option.unit.branch.id)
    } else if (!branchId) {
      setBranchId(user?.branch?.id ?? workspace?.branches[0]?.id ?? '')
    }
  }

  const save = async (submitForApproval: boolean) => {
    setFormError('')
    if (
      !normalizeDocument(documentNumber) ||
      !fullName.trim() ||
      !phone.trim() ||
      !selectedVehicle ||
      !selectedCatalog ||
      !selectedCondition ||
      !branchId ||
      !policy
    ) {
      setFormError(
        'Completá documento, nombre, teléfono y seleccioná un vehículo con política vigente.',
      )
      return
    }
    const price = Number(agreedPrice)
    if (!Number.isFinite(price) || price <= 0) {
      setFormError('Ingresá un precio de cierre mayor a cero.')
      return
    }
    if (creditRequired && (!Number.isFinite(Number(creditAmount)) || Number(creditAmount) <= 0)) {
      setFormError('Ingresá el monto del crédito para la plataforma elegida.')
      return
    }
    if (creditRequired && Number(creditAmount) > price) {
      setFormError('El monto del crédito no puede superar el precio de cierre.')
      return
    }
    if (creditBlocksSale) {
      setFormError('El backend indicó que este antecedente bloquea la operación.')
      return
    }
    if (selectedVehicle.source === 'SUPPLIER' && !canManageSupply) {
      setFormError(
        'No tenés permiso para crear la solicitud de abastecimiento.',
      )
      return
    }

    setSubmitting(true)
    try {
      const operation = await createSalesOperation({
        vehicleType,
        branchId,
        client: {
          documentType,
          documentNumber: normalizeDocument(documentNumber),
          fullName: fullName.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        versionId: selectedCatalog.id,
        condition: selectedCondition,
        agreedPrice: price,
        paymentPlatform,
        ...(creditRequired ? { creditAmount: Number(creditAmount) } : {}),
        ...(guarantor.trim() ? { guarantor: guarantor.trim() } : {}),
        ...(selectedVehicle.source === 'PHYSICAL'
          ? { unitId: selectedVehicle.unit.id }
          : {
              supplierAvailabilityId: selectedVehicle.availability.id,
            }),
        ...(!isSeller && sellerId ? { sellerId } : {}),
        ...(contactSellerId ? { contactId: contactSellerId } : {}),
        operationDate,
        deliveryStatus: 'NO_PROGRAMADA',
        papersDelivered,
        debt: debtStatus,
        submit: submitForApproval,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(organizationId ? { organizationId } : {}),
      })

      if (selectedVehicle.source === 'SUPPLIER') {
        setCompletion({
          kind: submitForApproval ? 'submitted' : 'supply',
          number: operation.number,
          message: submitForApproval
            ? belowList
              ? `La operación y su abastecimiento fueron creados; quedó pendiente de aprobación por una diferencia de ${formatMoney(String(listDifference), policy.currency)} debajo de lista.`
              : 'La operación y su abastecimiento fueron creados y enviados al circuito comercial. El chasis se asignará al recibir la unidad.'
            : 'La operación, la reserva de proveedor y su abastecimiento quedaron guardados como borrador. El chasis se asignará al recibir la unidad.',
        })
        return
      }

      if (!submitForApproval) {
        setCompletion({
          kind: 'draft',
          number: operation.number,
          message:
            'La operación y la reserva quedaron guardadas como borrador.',
        })
        return
      }

      setCompletion({
        kind: 'submitted',
        number: operation.number,
        message: belowList
          ? `La operación fue enviada a aprobación con una diferencia de ${formatMoney(String(listDifference), policy.currency)} debajo de lista.`
          : 'La operación fue enviada para completar el circuito comercial.',
      })
    } catch (error) {
      setFormError(salesErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void save(true)
  }

  if (workspaceStatus === 'error') {
    return (
      <StatePanel
        icon={Warehouse}
        title={`No pudimos preparar la operación de ${vehicleType === 'MOTO' ? 'moto' : 'auto'}`}
        description={workspaceError}
        tone="danger"
        action={
          <button
            className="button button--primary"
            onClick={() => setWorkspaceKey((value) => value + 1)}
            type="button"
          >
            Reintentar
          </button>
        }
      />
    )
  }

  if (completion) {
    const icon =
      completion.kind === 'submitted' ? CheckCircle2 : Clock3
    return (
      <StatePanel
        icon={icon}
        title={`Operación #${completion.number}`}
        description={completion.message}
        tone={completion.kind === 'attention' ? 'danger' : 'default'}
        action={
          <div className="operation-complete__actions">
            <Link
              className="button button--primary"
              to={`/${vehicleType === 'MOTO' ? 'motos' : 'autos'}/mis-operaciones`}
            >
              Ver mis operaciones
            </Link>
            <button
              className="button button--secondary"
              onClick={() => window.location.reload()}
              type="button"
            >
              Cargar otra
            </button>
          </div>
        }
      />
    )
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">VENTAS</p>
          <h1>
            Nueva operación de {vehicleType === 'MOTO' ? 'moto' : 'auto'}
          </h1>
          <p>Carga de venta y reserva de unidad.</p>
        </div>
      </header>

      <CreditAlert
        state={creditCheck.state}
        onRetry={creditCheck.retry}
        showClearResult
      />
      {selectedVehicle?.source === 'SUPPLIER' && (
        <div className="operation-warning" role="status">
          <Store size={20} />
          <div>
            <strong>Abastecimiento externo</strong>
            <p>
              Disponibilidad informada por{' '}
              {selectedVehicle.availability.supplier.name}. El chasis se
              asignará al recibir la unidad.
            </p>
          </div>
        </div>
      )}
      {belowList && policy && (
        <div className="operation-warning" role="status">
          <AlertTriangle size={20} />
          <div>
            <strong>Precio por debajo de lista</strong>
            <p>
              La diferencia es{' '}
              {formatMoney(String(listDifference), policy.currency)}. La
              operación quedará pendiente de aprobación.
              {belowMinimum ? ' También está por debajo del precio piso.' : ''}
            </p>
          </div>
        </div>
      )}

      <form className="operation-form-card" onSubmit={submit}>
        <fieldset disabled={submitting}>
          <div className="operation-compact-grid">
            <div className="field operation-span-3">
              <span>Tipo de operación *</span>
              <div className="operation-readonly">
                {vehicleType === 'MOTO' ? 'Venta de moto' : 'Venta de auto'}
              </div>
            </div>

            <label className="field">
              <span>Tipo documento *</span>
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
              <span>DNI / CI *</span>
              <input
                aria-label="DNI / CI *"
                autoComplete="off"
                onChange={(event) => setDocumentNumber(event.target.value)}
                placeholder="Ingresar para verificar"
                required
                value={documentNumber}
              />
              <small>
                Se verifican únicamente antecedentes crediticios; el cliente se
                vincula al guardar.
              </small>
            </label>
            <label className="field">
              <span>Nombre del cliente *</span>
              <input
                maxLength={180}
                onChange={(event) => setFullName(event.target.value)}
                required
                value={fullName}
              />
            </label>
            <label className="field">
              <span>Fecha *</span>
              <input
                onChange={(event) => setOperationDate(event.target.value)}
                required
                type="date"
                value={operationDate}
              />
            </label>
            <label className="field operation-span-2">
              <span>Buscar y seleccionar vehículo *</span>
              <div className="operation-vehicle-search">
                <Search size={17} />
                <input
                  aria-label="Buscar y seleccionar vehículo *"
                  list="sales-vehicle-options"
                  onChange={(event) => chooseVehicle(event.target.value)}
                  placeholder="Tipo, marca, modelo, sucursal o chasis…"
                  required
                  value={vehicleSearch}
                />
              </div>
              <datalist id="sales-vehicle-options">
                {vehicleOptions.map((option) => (
                  <option key={option.key} value={vehicleOptionLabel(option)} />
                ))}
              </datalist>
              <small>
                {workspaceStatus === 'loading'
                  ? 'Cargando stock y disponibilidad…'
                  : selectedVehicle
                    ? `${selectedVehicle.source === 'PHYSICAL' ? 'Stock físico' : 'Proveedor'} · ${selectedCondition === 'NUEVO' ? 'Nuevo' : 'Usado'}`
                    : 'Elegí una unidad física o disponibilidad de proveedor'}
              </small>
            </label>
            <div className="field">
              <span>Precio de lista sugerido</span>
              <div className="operation-readonly">
                {policy
                  ? formatMoney(policy.listPrice, policy.currency)
                  : policyStatus === 'loading'
                    ? 'Consultando…'
                    : 'Seleccioná un vehículo'}
              </div>
              {policy && (
                <small>
                  Piso: {formatMoney(policy.minimumPrice, policy.currency)}
                </small>
              )}
              {policyStatus === 'error' && <small>{policyError}</small>}
            </div>
            <label className="field">
              <span>Precio de cierre *</span>
              <input
                min="0.01"
                onChange={(event) => setAgreedPrice(event.target.value)}
                required
                step="0.01"
                type="number"
                value={agreedPrice}
              />
            </label>
            <label className="field">
              <span>Plataforma de pago *</span>
              <select
                onChange={(event) => {
                  const platform = event.target.value as SalesPaymentPlatform
                  setPaymentPlatform(platform)
                  if (!platform.includes('CREDITO')) setCreditAmount('')
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
            <label className="field">
              <span>Monto del crédito{creditRequired ? ' *' : ''}</span>
              <input
                disabled={!creditRequired}
                min="0"
                onChange={(event) => setCreditAmount(event.target.value)}
                step="0.01"
                type="number"
                value={creditAmount}
              />
            </label>
            <label className="field">
              <span>Teléfono *</span>
              <input
                maxLength={40}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="11 0000-0000"
                required
                value={phone}
              />
            </label>
            <label className="field">
              <span>Respaldo / garante</span>
              <input
                maxLength={500}
                onChange={(event) => setGuarantor(event.target.value)}
                value={guarantor}
              />
            </label>
            <label className="field">
              <span>Quién hizo la venta *</span>
              <select
                aria-label="Quién hizo la venta *"
                disabled={isSeller}
                onChange={(event) => setSellerId(event.target.value)}
                value={sellerId}
              >
                <option value="">
                  {isSeller ? user?.name ?? 'Vendedor de la sesión' : 'Vendedor de la sesión'}
                </option>
                {!isSeller && sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.fullName}
                  </option>
                ))}
              </select>
              {sellerStatus === 'error' && <small>{sellerError}</small>}
            </label>
            <label className="field">
              <span>Quién fue el contacto</span>
              <select
                onChange={(event) => setContactSellerId(event.target.value)}
                value={contactSellerId}
              >
                <option value="">Seleccionar vendedor</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.fullName}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span>Usuario que carga</span>
              <div className="operation-readonly">
                {user?.name ?? user?.email ?? 'Sesión activa'}
              </div>
            </div>
            <div className="field">
              <span>Estado de entrega</span>
              <div className="operation-readonly">No programada</div>
              <small>Se programa después de aprobar la operación.</small>
            </div>
            <label className="field">
              <span>Debe</span>
              <select
                onChange={(event) =>
                  setDebtStatus(
                    event.target.value as SalesDebt,
                  )
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
              <div className="operation-readonly">{selectedVin}</div>
              <small>
                Identifica la unidad física y evita una doble venta.
              </small>
            </div>
            <label className="operation-check">
              <input
                checked={papersDelivered}
                onChange={(event) => setPapersDelivered(event.target.checked)}
                type="checkbox"
              />
              <span>Papeles entregados</span>
            </label>
            <label className="field operation-span-3">
              <span>Notas</span>
              <textarea
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                value={notes}
              />
            </label>
          </div>

          {formError && (
            <div className="form-alert form-alert--error" role="alert">
              {formError}
            </div>
          )}
          <div className="operation-form__actions">
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
              disabled={submitting || policyStatus !== 'success'}
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
