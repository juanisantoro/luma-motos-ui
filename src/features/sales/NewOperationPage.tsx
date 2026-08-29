import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Search,
  Store,
  Truck,
  Warehouse,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { listClients } from '../clients/api'
import type { Client } from '../clients/types'
import { stockApiGateway } from '../stock/api'
import { stockErrorMessage } from '../stock/errors'
import type {
  PhysicalUnit,
  StockCapabilities,
  StockWorkspaceData,
  SupplierAvailability,
  VehicleCondition,
  VehicleKind,
} from '../stock/types'
import {
  createLinkedSupplyRequest,
  createSalesOperation,
  getSalesPricePolicy,
  listSalesSellers,
  submitSalesOperation,
} from './api'
import { salesErrorMessage } from './errors'
import { formatMoney } from './presentation'
import type {
  SalesPricePolicy,
  SalesSeller,
} from './types'

type Source = 'PHYSICAL' | 'SUPPLIER'
type Completion = {
  kind: 'submitted' | 'supply' | 'attention'
  number: string
  message: string
}

const today = new Date().toISOString().slice(0, 10)

function versionLabel(
  item: PhysicalUnit['catalogModel'] | SupplierAvailability['catalogModel'],
) {
  return [item.brand, item.model, item.version].filter(Boolean).join(' ')
}

export function NewOperationPage() {
  const { user } = useAuth()
  const [vehicleType, setVehicleType] = useState<VehicleKind>('MOTO')
  const [condition, setCondition] = useState<VehicleCondition>('NUEVO')
  const [workspace, setWorkspace] = useState<StockWorkspaceData | null>(null)
  const [workspaceStatus, setWorkspaceStatus] = useState<
    'loading' | 'success' | 'error'
  >('loading')
  const [workspaceError, setWorkspaceError] = useState('')
  const [workspaceKey, setWorkspaceKey] = useState(0)
  const [branchId, setBranchId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [source, setSource] = useState<Source>('PHYSICAL')
  const [unitId, setUnitId] = useState('')
  const [availabilityId, setAvailabilityId] = useState('')
  const [operationDate, setOperationDate] = useState(today)
  const [agreedPrice, setAgreedPrice] = useState('')
  const [notes, setNotes] = useState('')

  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [clientStatus, setClientStatus] = useState<
    'loading' | 'success' | 'error'
  >('loading')
  const [clientError, setClientError] = useState('')
  const [client, setClient] = useState<Client | null>(null)

  const [sellers, setSellers] = useState<SalesSeller[]>([])
  const [sellerId, setSellerId] = useState('')
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
          if (user?.branch && data.branches.some((branch) => branch.id === user.branch?.id)) {
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

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setClientStatus('loading')
      setClientError('')
      void listClients(
        {
          page: 1,
          limit: 12,
          active: true,
          ...(clientSearch.trim() ? { search: clientSearch.trim() } : {}),
          ...(organizationId ? { organizationId } : {}),
        },
        controller.signal,
      )
        .then((response) => {
          setClients(response.items)
          setClientStatus('success')
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          setClientError(salesErrorMessage(error))
          setClientStatus('error')
        })
    }, 250)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [clientSearch, organizationId])

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
    if (!branchId || !versionId) {
      setPolicy(null)
      setPolicyStatus('idle')
      return
    }
    const controller = new AbortController()
    setPolicyStatus('loading')
    setPolicyError('')
    void getSalesPricePolicy(
      {
        branchId,
        versionId,
        operationDate,
        ...(organizationId ? { organizationId } : {}),
      },
      controller.signal,
    )
      .then((response) => {
        setPolicy(response)
        setAgreedPrice((current) => current || response.listPrice)
        setPolicyStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setPolicy(null)
        setPolicyError(salesErrorMessage(error))
        setPolicyStatus('error')
      })
    return () => controller.abort()
  }, [branchId, operationDate, organizationId, versionId])

  const versions = useMemo(() => {
    if (!workspace) return []
    const candidates = [
      ...workspace.catalog,
      ...workspace.units.map((unit) => unit.catalogModel),
      ...workspace.availability.map((item) => item.catalogModel),
    ]
    return [
      ...new Map(
        candidates
          .filter((item) => item.vehicleType === vehicleType)
          .map((item) => [item.id, item]),
      ).values(),
    ].sort((left, right) =>
      versionLabel(left).localeCompare(versionLabel(right), 'es'),
    )
  }, [vehicleType, workspace])

  const physicalUnits = useMemo(
    () =>
      workspace?.units.filter(
        (unit) =>
          unit.status === 'EN_STOCK' &&
          unit.condition === condition &&
          unit.branch.id === branchId &&
          unit.catalogModel.id === versionId,
      ) ?? [],
    [branchId, condition, versionId, workspace],
  )
  const availability = useMemo(
    () =>
      workspace?.availability.filter(
        (item) =>
          item.quantity > 0 &&
          item.condition === condition &&
          item.catalogModel.id === versionId,
      ) ?? [],
    [condition, versionId, workspace],
  )
  const belowMinimum =
    policy !== null &&
    agreedPrice !== '' &&
    Number(agreedPrice) < Number(policy.minimumPrice)

  useEffect(() => {
    setVersionId('')
    setUnitId('')
    setAvailabilityId('')
    setPolicy(null)
    setAgreedPrice('')
  }, [vehicleType])

  useEffect(() => {
    setUnitId('')
    setAvailabilityId('')
  }, [branchId, condition, versionId])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    if (!client || !branchId || !versionId || !policy) {
      setFormError('Completá cliente, sucursal, vehículo y política de precios.')
      return
    }
    const price = Number(agreedPrice)
    if (!Number.isFinite(price) || price < 0) {
      setFormError('Ingresá un precio acordado válido.')
      return
    }
    if (source === 'PHYSICAL' && !unitId) {
      setFormError('Seleccioná una unidad física disponible.')
      return
    }
    const selectedAvailability = availability.find(
      (item) => item.id === availabilityId,
    )
    if (source === 'SUPPLIER' && (!selectedAvailability || !canManageSupply)) {
      setFormError(
        canManageSupply
          ? 'Seleccioná una disponibilidad de proveedor.'
          : 'No tenés permiso para crear solicitudes de abastecimiento.',
      )
      return
    }

    setSubmitting(true)
    try {
      const operation = await createSalesOperation({
        branchId,
        clientId: client.id,
        versionId,
        condition,
        agreedPrice: price,
        ...(unitId && source === 'PHYSICAL' ? { unitId } : {}),
        ...(sellerId ? { sellerId } : {}),
        operationDate,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(organizationId ? { organizationId } : {}),
      })

      if (source === 'SUPPLIER' && selectedAvailability) {
        try {
          await createLinkedSupplyRequest({
            supplierId: selectedAvailability.supplier.id,
            supplierAvailabilityId: selectedAvailability.id,
            operationId: operation.id,
            versionId,
            condition,
            arrivalBranchId: branchId,
            notes: `Abastecimiento vinculado a operación #${operation.number}`,
            ...(organizationId ? { organizationId } : {}),
          })
          setCompletion({
            kind: 'supply',
            number: operation.number,
            message:
              'La operación quedó en borrador y la solicitud de abastecimiento fue creada. Al recibir la unidad deberá reservarse antes de enviar a aprobación.',
          })
        } catch (error) {
          setCompletion({
            kind: 'attention',
            number: operation.number,
            message: `La operación quedó guardada como borrador, pero no se creó el abastecimiento: ${salesErrorMessage(error)}`,
          })
        }
        return
      }

      try {
        await submitSalesOperation(operation.id, operation.rowVersion)
        setCompletion({
          kind: 'submitted',
          number: operation.number,
          message:
            'La unidad quedó reservada y la operación fue enviada a aprobación.',
        })
      } catch (error) {
        setCompletion({
          kind: 'attention',
          number: operation.number,
          message: `La operación y su reserva quedaron guardadas como borrador, pero no se pudo enviar a aprobación: ${salesErrorMessage(error)}`,
        })
      }
    } catch (error) {
      setFormError(salesErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (workspaceStatus === 'error') {
    return (
      <StatePanel
        icon={Warehouse}
        title="No pudimos preparar Nueva operación"
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
    const icon = completion.kind === 'submitted' ? CheckCircle2 : Clock3
    return (
      <StatePanel
        icon={icon}
        title={`Operación #${completion.number}`}
        description={completion.message}
        tone={completion.kind === 'attention' ? 'danger' : 'default'}
        action={
          <div className="operation-complete__actions">
            <Link className="button button--primary" to="/mis-operaciones">
              Ver mis operaciones
            </Link>
            <button
              className="button button--secondary"
              onClick={() => {
                setCompletion(null)
                setClient(null)
                setUnitId('')
                setAvailabilityId('')
                setNotes('')
              }}
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
          <h1>Nueva operación</h1>
          <p>Seleccioná cliente, vendedor, precio y origen de la unidad.</p>
        </div>
      </header>

      <form className="operation-form" onSubmit={submit}>
        <fieldset disabled={submitting}>
          <section className="operation-section" aria-labelledby="operation-client">
            <div className="operation-section__heading">
              <span>1</span>
              <div>
                <h2 id="operation-client">Cliente</h2>
                <p>La operación sólo admite clientes activos.</p>
              </div>
            </div>
            <label className="search-field operation-client-search">
              <span className="sr-only">Buscar cliente</span>
              <Search size={18} />
              <input
                maxLength={180}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Nombre, documento o email"
                type="search"
                value={clientSearch}
              />
            </label>
            <div className="operation-choice-list" aria-live="polite">
              {clientStatus === 'loading' && (
                <span className="operation-inline-state">
                  <LoaderCircle className="spin" size={18} />
                  Buscando clientes…
                </span>
              )}
              {clientStatus === 'error' && (
                <span className="operation-inline-error" role="alert">
                  {clientError}
                </span>
              )}
              {clientStatus === 'success' && clients.length === 0 && (
                <span className="operation-inline-state">
                  No encontramos clientes activos.
                </span>
              )}
              {clientStatus === 'success' &&
                clients.map((item) => (
                  <button
                    className={`operation-choice ${client?.id === item.id ? 'is-selected' : ''}`}
                    key={item.id}
                    onClick={() => setClient(item)}
                    type="button"
                  >
                    <strong>{item.fullName}</strong>
                    <span>
                      {item.documentType && item.documentNumber
                        ? `${item.documentType} ${item.documentNumber}`
                        : item.email ?? 'Sin documento ni email'}
                    </span>
                  </button>
                ))}
            </div>
          </section>

          <section className="operation-section" aria-labelledby="operation-data">
            <div className="operation-section__heading">
              <span>2</span>
              <div>
                <h2 id="operation-data">Datos comerciales</h2>
                <p>El backend valida vendedor y política para la sucursal.</p>
              </div>
            </div>
            <div className="operation-form-grid">
              <label className="field">
                <span>Sucursal *</span>
                <select
                  onChange={(event) => setBranchId(event.target.value)}
                  required
                  value={branchId}
                >
                  <option value="">Seleccionar</option>
                  {workspace?.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Vendedor</span>
                <select
                  onChange={(event) => setSellerId(event.target.value)}
                  value={sellerId}
                >
                  <option value="">Vendedor de la sesión</option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.fullName} · {seller.employeeCode}
                    </option>
                  ))}
                </select>
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
            </div>
            {sellerStatus === 'loading' && (
              <p className="operation-helper">Cargando vendedores elegibles…</p>
            )}
            {sellerStatus === 'error' && (
              <p className="operation-inline-error" role="alert">
                {sellerError}
              </p>
            )}
          </section>

          <section className="operation-section" aria-labelledby="operation-vehicle">
            <div className="operation-section__heading">
              <span>3</span>
              <div>
                <h2 id="operation-vehicle">Vehículo y precio</h2>
                <p>Lista y piso son informativos; el backend los recalcula.</p>
              </div>
            </div>
            <div className="operation-switches">
              <div className="condition-switch" aria-label="Tipo de vehículo">
                {(['MOTO', 'AUTO'] as const).map((value) => (
                  <button
                    className={vehicleType === value ? 'is-active' : ''}
                    key={value}
                    onClick={() => setVehicleType(value)}
                    type="button"
                  >
                    {value === 'MOTO' ? 'Moto' : 'Auto'}
                  </button>
                ))}
              </div>
              <div className="condition-switch" aria-label="Condición">
                {(['NUEVO', 'USADO'] as const).map((value) => (
                  <button
                    className={condition === value ? 'is-active' : ''}
                    key={value}
                    onClick={() => setCondition(value)}
                    type="button"
                  >
                    {value === 'NUEVO' ? 'Nuevo' : 'Usado'}
                  </button>
                ))}
              </div>
            </div>
            {workspaceStatus === 'loading' ? (
              <span className="operation-inline-state">
                <LoaderCircle className="spin" size={18} />
                Cargando catálogo y stock…
              </span>
            ) : (
              <div className="operation-form-grid">
                <label className="field field--wide">
                  <span>Versión *</span>
                  <select
                    onChange={(event) => {
                      setVersionId(event.target.value)
                      setAgreedPrice('')
                    }}
                    required
                    value={versionId}
                  >
                    <option value="">Seleccionar marca, modelo y versión</option>
                    {versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {versionLabel(version)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="price-reference">
                  <span>Precio lista</span>
                  <strong>
                    {policy
                      ? formatMoney(policy.listPrice, policy.currency)
                      : '—'}
                  </strong>
                </div>
                <div className="price-reference">
                  <span>Precio piso</span>
                  <strong>
                    {policy
                      ? formatMoney(policy.minimumPrice, policy.currency)
                      : '—'}
                  </strong>
                </div>
                <label className="field">
                  <span>Precio acordado *</span>
                  <input
                    min="0"
                    onChange={(event) => setAgreedPrice(event.target.value)}
                    required
                    step="0.01"
                    type="number"
                    value={agreedPrice}
                  />
                </label>
              </div>
            )}
            {policyStatus === 'loading' && (
              <p className="operation-helper">Consultando política vigente…</p>
            )}
            {policyStatus === 'error' && (
              <p className="operation-inline-error" role="alert">
                {policyError}
              </p>
            )}
            {belowMinimum && (
              <div className="price-warning" role="status">
                <AlertTriangle size={19} />
                <div>
                  <strong>Precio por debajo del piso</strong>
                  <p>
                    Se enviará igualmente, pero requiere aprobación explícita
                    con esta diferencia visible.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="operation-section" aria-labelledby="operation-stock">
            <div className="operation-section__heading">
              <span>4</span>
              <div>
                <h2 id="operation-stock">Origen y reserva</h2>
                <p>La disponibilidad de proveedor no reserva una unidad física.</p>
              </div>
            </div>
            <div className="source-selector">
              <button
                className={source === 'PHYSICAL' ? 'is-selected' : ''}
                onClick={() => setSource('PHYSICAL')}
                type="button"
              >
                <Warehouse size={20} />
                <span>
                  <strong>Stock físico</strong>
                  Reserva inmediata de VIN
                </span>
              </button>
              <button
                className={source === 'SUPPLIER' ? 'is-selected' : ''}
                disabled={!canViewAvailability}
                onClick={() => setSource('SUPPLIER')}
                type="button"
              >
                <Truck size={20} />
                <span>
                  <strong>Proveedor</strong>
                  Solicitud de abastecimiento
                </span>
              </button>
            </div>

            <div className="operation-choice-list operation-stock-list">
              {source === 'PHYSICAL' &&
                (physicalUnits.length ? (
                  physicalUnits.map((unit) => (
                    <button
                      className={`operation-choice operation-stock-choice ${unitId === unit.id ? 'is-selected' : ''}`}
                      key={unit.id}
                      onClick={() => setUnitId(unit.id)}
                      type="button"
                    >
                      <Warehouse size={18} />
                      <strong>{unit.vin}</strong>
                      <span>
                        {unit.branch.name}
                        {unit.licensePlate ? ` · ${unit.licensePlate}` : ''}
                      </span>
                    </button>
                  ))
                ) : (
                  <span className="operation-inline-state">
                    No hay unidades físicas elegibles para esta selección.
                  </span>
                ))}
              {source === 'SUPPLIER' &&
                (availability.length ? (
                  availability.map((item) => (
                    <button
                      className={`operation-choice operation-stock-choice ${availabilityId === item.id ? 'is-selected' : ''}`}
                      disabled={!canManageSupply}
                      key={item.id}
                      onClick={() => setAvailabilityId(item.id)}
                      type="button"
                    >
                      <Store size={18} />
                      <strong>{item.supplier.name}</strong>
                      <span>{item.quantity} disponibles informadas</span>
                    </button>
                  ))
                ) : (
                  <span className="operation-inline-state">
                    No hay disponibilidad de proveedores para esta selección.
                  </span>
                ))}
            </div>
            {source === 'SUPPLIER' && !canManageSupply && (
              <p className="operation-inline-error" role="alert">
                Podés consultar disponibilidad, pero necesitás
                abastecimiento.gestionar para crear la solicitud.
              </p>
            )}
            <label className="field">
              <span>Notas internas</span>
              <textarea
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                value={notes}
              />
            </label>
          </section>

          {formError && (
            <div className="form-alert form-alert--error" role="alert">
              {formError}
            </div>
          )}
          <div className="operation-form__actions">
            <Link className="button button--secondary" to="/operaciones">
              Cancelar
            </Link>
            <button
              className="button button--primary"
              disabled={submitting || policyStatus !== 'success'}
              type="submit"
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting
                ? 'Guardando…'
                : source === 'PHYSICAL'
                  ? 'Reservar y enviar'
                  : 'Crear operación y abastecimiento'}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  )
}
