import { ChevronLeft, ChevronRight, FileCheck2, Filter, Info, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { downloadExcel, fetchAllPages, type ExcelColumn } from '../../shared/export/excel'
import { ExportExcelButton } from '../../shared/export/ExportExcelButton'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { formatMoney } from '../finance/format'
import {
  listVehiclePaymentAccounts,
  listVehiclePaymentConcepts,
  listVehiclePaymentProviders,
  listVehiclePayments,
  updateVehiclePayment,
} from './api'
import { alertError, alertSuccess } from '../../shared/alerts'
import { getSalesOperation } from '../sales/api'
import { LicensingModal } from '../sales/LicensingModal'
import { plateStatusClass, plateStatusLabel } from '../sales/licensing'
import type { SalesOperation } from '../sales/types'
import { payerAccountLabel, VehiclePaymentForm } from './VehiclePaymentForm'
import type {
  CatalogOption,
  PageResponse,
  PayerAccount,
  VehiclePayment,
  VehiclePaymentQuery,
  VehiclePaymentStatus,
  VehiclePaymentVehicleType,
} from './types'
import { displayVersion } from '../../shared/utils/vehicleVersion'

const PAGE_SIZE = 20

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function statusTone(status: VehiclePaymentStatus) {
  return status === 'PAGADO' ? ' status-badge--success' : ' status-badge--warning'
}

function statusLabel(status: VehiclePaymentStatus) {
  return status === 'PAGADO' ? 'Pagado' : 'Pendiente'
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return 'No tenés permiso para ver estos registros.'
  }
  return 'No pudimos cargar los gastos. Intentá nuevamente.'
}

// Gastos cargados antes de exigir la caja: para marcarlos como pagados hay
// que elegir desde qué caja se pagaron.
function PayFromAccountDialog({
  payment,
  accounts,
  onCancel,
  onConfirm,
}: {
  payment: VehiclePayment
  accounts: PayerAccount[]
  onCancel: () => void
  onConfirm: (accountId?: string, amount?: number) => Promise<void>
}) {
  // Las cajas propias del usuario. Elegir una es opcional.
  const [accountId, setAccountId] = useState('')
  // Algunos gastos viejos se cargaron con importe 0: para descontarlo de una
  // caja hay que completarlo.
  const needsAmount = Boolean(accountId) && payment.amount <= 0
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="financial-modal" role="dialog" aria-modal="true" aria-labelledby="pay-from-account-title">
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">GASTOS</p>
            <h2 id="pay-from-account-title">¿Desde qué caja se pagó?</h2>
          </div>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (needsAmount && !(Number(amount) > 0)) return
            setBusy(true)
            void onConfirm(accountId || undefined, needsAmount ? Number(amount) : undefined).finally(() =>
              setBusy(false),
            )
          }}
        >
          <p>
            Este gasto ({payment.concept.name}
            {payment.amount <= 0 ? '' : `, ${formatMoney(payment.amount.toString(), payment.currency)}`}) no tiene
            caja. Si lo pagaste vos, elegí tu caja y el importe se descuenta de ella; si no, marcalo pagado sin caja.
          </p>
          {needsAmount && (
            <label className="field">
              <span>Importe *</span>
              <input
                min="0.01"
                onChange={(event) => setAmount(event.target.value)}
                required
                step="0.01"
                type="number"
                value={amount}
              />
            </label>
          )}
          <label className="field">
            <span>Caja</span>
            <select onChange={(event) => setAccountId(event.target.value)} value={accountId}>
              <option value="">Sin caja (no descuenta plata)</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{payerAccountLabel(account)}</option>
              ))}
            </select>
          </label>
          <footer className="financial-modal__actions">
            <button className="button button--secondary" disabled={busy} onClick={onCancel} type="button">
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={busy || (needsAmount && !(Number(amount) > 0))}
              type="submit"
            >
              Marcar pagado
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

// Columnas del Excel: las de la grilla, con importe como número y moneda aparte.
const EXCEL_COLUMNS: Array<ExcelColumn<VehiclePayment>> = [
  { header: 'Fecha', value: (row) => row.date, type: 'date' },
  { header: 'Concepto', value: (row) => row.concept.name },
  { header: 'Detalle', value: (row) => row.notes },
  { header: 'Sucursal', value: (row) => row.branch.name },
  { header: 'VIN', value: (row) => row.unit?.vin },
  { header: 'Patente', value: (row) => row.unit?.licensePlate },
  {
    header: 'Vehículo',
    value: (row) =>
      row.vehicle
        ? [row.vehicle.brand, row.vehicle.model, displayVersion(row.vehicle.version, row.vehicle.model)]
            .filter(Boolean)
            .join(' ')
        : null,
  },
  { header: 'Operación', value: (row) => (row.operation ? `#${row.operation.number}` : null) },
  { header: 'Boleto', value: (row) => row.operation?.ticketNumber },
  { header: 'Proveedor', value: (row) => row.provider?.name },
  { header: 'Caja', value: (row) => row.account?.name },
  { header: 'Pagado por', value: (row) => row.account?.responsible },
  { header: 'Moneda', value: (row) => row.currency },
  { header: 'Importe', value: (row) => row.amount, type: 'money' },
  { header: 'Estado', value: (row) => statusLabel(row.status) },
]

// Fase 5: "Registrar pago de patente" desde la operación llega con
// ?operacion=<id> y abre el formulario precargado.
export const OPERATION_PARAM = 'operacion'

export function VehiclePaymentsPage({
  vehicleType,
}: {
  vehicleType: VehiclePaymentVehicleType
}) {
  const { user } = useAuth()
  const permissions = user?.role.permissions ?? []
  const canManage = hasPermission(permissions, 'pagos_vehiculo.gestionar')
  // Llegada de la patente también desde acá (fase 5).
  const canManageLicensing = hasPermission(
    permissions,
    'ventas.patentamiento.gestionar',
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const initialOperationId = canManage
    ? (searchParams.get(OPERATION_PARAM) ?? undefined)
    : undefined
  const [licensingOperation, setLicensingOperation] =
    useState<SalesOperation | null>(null)
  const [licensingLoadingId, setLicensingLoadingId] = useState<string | null>(
    null,
  )

  const [query, setQuery] = useState<VehiclePaymentQuery>({ page: 1, limit: PAGE_SIZE })
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [result, setResult] = useState<PageResponse<VehiclePayment> | null>(null)
  const [loadError, setLoadError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const formOpen = showForm || initialOperationId !== undefined
  const closeForm = () => {
    setShowForm(false)
    if (searchParams.has(OPERATION_PARAM))
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.delete(OPERATION_PARAM)
          return next
        },
        { replace: true },
      )
  }

  const openLicensing = async (operationId: string) => {
    setLicensingLoadingId(operationId)
    try {
      setLicensingOperation(await getSalesOperation(operationId))
    } catch {
      const message = 'No pudimos abrir la operación. Intentá nuevamente.'
      setNotice(message)
      void alertError(message)
    } finally {
      setLicensingLoadingId(null)
    }
  }
  const [notice, setNotice] = useState('')

  const [concepts, setConcepts] = useState<CatalogOption[]>([])
  const [providers, setProviders] = useState<CatalogOption[]>([])
  const [accounts, setAccounts] = useState<PayerAccount[]>([])
  const [payingWithoutAccount, setPayingWithoutAccount] = useState<VehiclePayment | null>(null)
  const [draft, setDraft] = useState<VehiclePaymentQuery>({ page: 1, limit: PAGE_SIZE })

  const changeDraft = <K extends keyof VehiclePaymentQuery>(
    key: K,
    next: VehiclePaymentQuery[K],
  ) => setDraft((current) => ({ ...current, [key]: next || undefined }))

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      listVehiclePaymentConcepts(controller.signal),
      listVehiclePaymentProviders(controller.signal),
      listVehiclePaymentAccounts(controller.signal),
    ])
      .then(([conceptRows, providerRows, accountRows]) => {
        setConcepts(conceptRows)
        setProviders(providerRows)
        setAccounts(accountRows)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setForbidden(false)
    setLoadError('')
    listVehiclePayments(vehicleType, query, controller.signal)
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setForbidden(error instanceof ApiError && error.status === 403)
        setLoadError(errorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [query, vehicleType, refreshKey])

  const reload = (message?: string) => {
    if (message) setNotice(message)
    setRefreshKey((current) => current + 1)
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1

  const exportExcel = async () => {
    const title = `Gastos de ${vehicleType === 'MOTO' ? 'motos' : 'autos'}`
    const { items, total } = await fetchAllPages((page, limit) =>
      listVehiclePayments(vehicleType, { ...query, page, limit }),
    )
    // Los filtros aplicados (no lo escrito sin aplicar), con sus nombres.
    const name = (options: Array<{ id: string; name: string }>, id?: string) =>
      options.find((option) => option.id === id)?.name ?? id
    await downloadExcel({
      fileName: title,
      title,
      filters: [
        query.search && `Buscar: ${query.search}`,
        query.conceptId && `Concepto: ${name(concepts, query.conceptId)}`,
        query.providerId && `Proveedor: ${name(providers, query.providerId)}`,
        query.accountId && `Caja: ${name(accounts, query.accountId)}`,
        query.status && `Estado: ${statusLabel(query.status)}`,
        query.month ? `Mes: ${query.month}` : null,
        query.year ? `Año: ${query.year}` : null,
      ],
      columns: EXCEL_COLUMNS,
      rows: items,
      total,
    })
  }

  const applyFilters = () => setQuery({ ...draft, page: 1, limit: PAGE_SIZE })
  const clearFilters = () => {
    const cleared = { page: 1, limit: PAGE_SIZE }
    setDraft(cleared)
    setQuery(cleared)
  }

  // Pagar y devolver plata de una caja es sólo de su dueño.
  const ownAccounts = useMemo(() => accounts.filter((account) => account.own), [accounts])
  const othersAccount = (payment: VehiclePayment) =>
    accounts.some((account) => account.id === payment.account?.id && !account.own)

  const togglePaid = async (
    payment: VehiclePayment,
    accountId?: string,
    amount?: number,
    askedAccount = false,
  ) => {
    const nextStatus: VehiclePaymentStatus = payment.status === 'PAGADO' ? 'PENDIENTE' : 'PAGADO'
    // Sin caja y con cajas propias: preguntar si sale de alguna de ellas.
    if (nextStatus === 'PAGADO' && !payment.account && ownAccounts.length > 0 && !askedAccount) {
      setPayingWithoutAccount(payment)
      return
    }
    const accountName =
      accounts.find((account) => account.id === accountId)?.name ?? payment.account?.name
    try {
      await updateVehiclePayment(payment.id, {
        status: nextStatus,
        ...(accountId ? { accountId } : {}),
        ...(amount ? { amount } : {}),
      })
      const successMessage =
        nextStatus === 'PAGADO'
          ? `Gasto marcado como pagado${accountName ? `: se descontó de ${accountName}` : ''}.`
          : `Gasto marcado como pendiente${accountName ? `: se devolvió el importe a ${accountName}` : ''}.`
      setPayingWithoutAccount(null)
      reload(successMessage)
      void alertSuccess(successMessage)
    } catch (error) {
      const message =
        error instanceof ApiError && error.message
          ? error.message
          : 'No pudimos actualizar el estado. Intentá nuevamente.'
      setNotice(message)
      void alertError(message)
    }
  }

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    [],
  )
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, index) => current - 4 + index)
  }, [])

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">GASTOS</p>
          <h1>Gastos de {vehicleType === 'MOTO' ? 'motos' : 'autos'}</h1>
          <p>
            Lo que paga la agencia por {vehicleType === 'MOTO' ? 'las motos' : 'los autos'}: patentes, seguros,
            formularios y cualquier otro gasto. Lo carga el administrador que lo pagó, desde su caja.
          </p>
        </div>
        <div className="page-heading__actions">
          <ExportExcelButton
            disabled={status !== 'success' || !result || result.total === 0}
            onExport={exportExcel}
          />
          {canManage && (
            <button className="button button--primary" type="button" onClick={() => setShowForm(true)}>
              <Plus size={18} />
              Cargar gasto nuevo
            </button>
          )}
        </div>
      </header>

      <div className="alert-strip alert-strip--warning" role="note">
        <div className="alert-strip__text">
          <span className="alert-strip__icon" aria-hidden="true">
            <Info size={18} />
          </span>
          <span>
            Esta pantalla es para PAGOS: lo que la agencia paga (gestoría, aseguradora u otros). Si se elige la caja
            de quien lo pagó, al marcarlo como pagado se descuenta de esa caja; sólo su dueño puede elegirla y
            cambiarla. El cobro de la patente al cliente no se carga acá: se registra desde la operación, en Ventas →
            Operaciones → Gestionar.
          </span>
        </div>
      </div>

      <details className="financial-filters" open>
        <summary>
          <Filter size={17} aria-hidden="true" />
          Filtros
        </summary>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            applyFilters()
          }}
        >
          <div className="filter-field">
            <label htmlFor="vp-search">Buscar</label>
            <input
              id="vp-search"
              onChange={(event) => changeDraft('search', event.target.value)}
              placeholder="Concepto, detalle, proveedor, VIN, boleto, operación…"
              value={draft.search ?? ''}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="vp-concept">Concepto</label>
            <select
              id="vp-concept"
              onChange={(event) => changeDraft('conceptId', event.target.value)}
              value={draft.conceptId ?? ''}
            >
              <option value="">Todos</option>
              {concepts.map((concept) => (
                <option key={concept.id} value={concept.id}>{concept.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="vp-provider">Proveedor</label>
            <select
              id="vp-provider"
              onChange={(event) => changeDraft('providerId', event.target.value)}
              value={draft.providerId ?? ''}
            >
              <option value="">Todos</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="vp-account">Caja</label>
            <select
              id="vp-account"
              onChange={(event) => changeDraft('accountId', event.target.value)}
              value={draft.accountId ?? ''}
            >
              <option value="">Todas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{payerAccountLabel(account)}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="vp-status">Estado</label>
            <select
              id="vp-status"
              onChange={(event) => changeDraft('status', event.target.value as VehiclePaymentStatus)}
              value={draft.status ?? ''}
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PAGADO">Pagado</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="vp-month">Mes</label>
            <select
              id="vp-month"
              onChange={(event) => changeDraft('month', event.target.value ? Number(event.target.value) : 0)}
              value={draft.month ?? ''}
            >
              <option value="">Todos</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="vp-year">Año</label>
            <select
              id="vp-year"
              onChange={(event) => changeDraft('year', event.target.value ? Number(event.target.value) : 0)}
              value={draft.year ?? ''}
            >
              <option value="">Todos</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="financial-filter-actions">
            <button className="button button--primary" type="submit">Aplicar</button>
            <button className="button button--secondary" type="button" onClick={clearFilters}>Limpiar</button>
          </div>
        </form>
      </details>

      {notice && (
        <div className="form-alert financial-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>Cerrar</button>
        </div>
      )}

      <section className="financial-panel" aria-label="Listado de gastos">
        {status === 'loading' && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando gastos…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            icon={RefreshCw}
            title={forbidden ? 'No tenés acceso a estos registros' : 'No pudimos cargar los gastos'}
            description={loadError}
            tone="danger"
            action={!forbidden ? (
              <button className="button button--primary" type="button" onClick={() => reload()}>
                <RefreshCw size={17} />
                Reintentar
              </button>
            ) : undefined}
          />
        )}
        {status === 'success' && result?.items.length === 0 && (
          <StatePanel
            icon={FileCheck2}
            title="No hay resultados"
            description="No encontramos gastos para los filtros seleccionados."
          />
        )}
        {status === 'success' && result && result.items.length > 0 && (
          <div className="financial-table-wrap">
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Vehículo</th>
                  <th>Operación</th>
                  <th>Proveedor</th>
                  <th>Pagado desde</th>
                  <th>Importe</th>
                  <th>Estado</th>
                  {(canManage || canManageLicensing) && <th />}
                </tr>
              </thead>
              <tbody>
                {result.items.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.date)}</td>
                    <td>
                      {payment.concept.name}
                      {payment.notes && <small>{payment.notes}</small>}
                    </td>
                    <td>
                      {payment.unit && payment.vehicle ? (
                        <>
                          <strong>{payment.unit.vin}</strong>
                          <small>{[payment.vehicle.brand, payment.vehicle.model, displayVersion(payment.vehicle.version, payment.vehicle.model)].filter(Boolean).join(' ')}</small>
                        </>
                      ) : (
                        <small>General · {payment.branch.name}</small>
                      )}
                    </td>
                    <td>
                      {payment.operation ? (
                        <>
                          <strong>#{payment.operation.number}</strong>
                          {payment.operation.ticketNumber && (
                            <small>Boleto {payment.operation.ticketNumber}</small>
                          )}
                          {payment.operation.licensing &&
                            payment.operation.licensing.plate.status !== 'NO_APLICA' && (
                              <small
                                className={`status-badge ${plateStatusClass(payment.operation.licensing.plate.status)}`}
                              >
                                {plateStatusLabel(
                                  payment.operation.licensing.plate.status,
                                  payment.operation.licensing,
                                )}
                              </small>
                            )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{payment.provider?.name ?? '—'}</td>
                    <td>
                      {payment.account ? (
                        <>
                          {payment.account.name}
                          {payment.account.responsible && <small>{payment.account.responsible}</small>}
                        </>
                      ) : (
                        <small>Sin caja</small>
                      )}
                    </td>
                    <td>{formatMoney(payment.amount.toString(), payment.currency)}</td>
                    <td>
                      <span className={`status-badge${statusTone(payment.status)}`}>
                        {statusLabel(payment.status)}
                      </span>
                    </td>
                    {(canManage || canManageLicensing) && (
                      <td className="financial-actions">
                        {canManage && (
                          <button
                            className="button button--secondary"
                            disabled={othersAccount(payment)}
                            onClick={() => togglePaid(payment)}
                            title={
                              othersAccount(payment)
                                ? `Se paga desde ${payment.account?.name}: sólo ${payment.account?.responsible ?? 'su dueño'} puede cambiarlo`
                                : undefined
                            }
                            type="button"
                          >
                            {payment.status === 'PAGADO' ? 'Marcar pendiente' : 'Marcar pagado'}
                          </button>
                        )}
                        {canManageLicensing && payment.operation && (
                          <button
                            aria-label={`Patente de la operación #${payment.operation.number}`}
                            className="button button--secondary"
                            disabled={licensingLoadingId === payment.operation.id}
                            onClick={() => void openLicensing(payment.operation!.id)}
                            type="button"
                          >
                            Patente
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>{result.total} {result.total === 1 ? 'gasto' : 'gastos'}</span>
            <div>
              <button
                className="icon-button"
                type="button"
                aria-label="Página anterior"
                disabled={(query.page ?? 1) <= 1}
                onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))}
              >
                <ChevronLeft size={19} />
              </button>
              <strong>Página {result.page} de {totalPages}</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="Página siguiente"
                disabled={(query.page ?? 1) >= totalPages}
                onClick={() => setQuery((current) => ({ ...current, page: Math.min(totalPages, (current.page ?? 1) + 1) }))}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </footer>
        )}
      </section>

      {formOpen && (
        <VehiclePaymentForm
          key={initialOperationId ?? 'nuevo'}
          vehicleType={vehicleType}
          {...(initialOperationId ? { initialOperationId } : {})}
          onClose={closeForm}
          onSaved={() => {
            closeForm()
            reload('Gasto guardado correctamente.')
          }}
        />
      )}
      {payingWithoutAccount && (
        <PayFromAccountDialog
          accounts={ownAccounts}
          onCancel={() => setPayingWithoutAccount(null)}
          onConfirm={(accountId, amount) => togglePaid(payingWithoutAccount, accountId, amount, true)}
          payment={payingWithoutAccount}
        />
      )}
      {licensingOperation && (
        <LicensingModal
          onChanged={() => reload()}
          onClose={() => setLicensingOperation(null)}
          operation={licensingOperation}
          permissions={permissions}
        />
      )}
    </>
  )
}
