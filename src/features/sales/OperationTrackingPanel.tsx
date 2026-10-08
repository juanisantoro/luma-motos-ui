import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  HandCoins,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../shared/api/client'
import { alertError, alertSuccess } from '../../shared/alerts'
import { StatePanel } from '../../shared/components/StatePanel'
import { ExportExcelButton } from '../../shared/export/ExportExcelButton'
import { downloadExcel, fetchAllPages } from '../../shared/export/excel'
import { useAuth } from '../auth/AuthContext'
import {
  branchScopeKey,
  filterAllowedBranches,
  isBranchSelectionLocked,
} from '../auth/branchScope'
import { hasPermission } from '../auth/PermissionRoute'
import { listSalesBranches } from '../stock/api'
import type { VehicleKind } from '../stock/types'
import { ComponentCollectionModal } from './ComponentCollectionModal'
import { FinancingPaymentModal } from './FinancingPaymentModal'
import { salesErrorMessage } from './errors'
import { trackingExcelColumns } from './export'
import { fulfillmentLabel, fulfillmentStatusClass } from './fulfillment'
import { licensingStatusClass, licensingStatusLabels } from './licensing'
import {
  formatMoney,
  formatOperationDate,
  operationStatusClass,
  operationStatusLabels,
} from './presentation'
import {
  canConfirmHandover,
  collectibleComponents,
  componentLabel,
  isExternalFinancing,
  confirmCashHandover,
  handoverStatusClass,
  handoverStatusLabels,
  listHandoverRecipients,
  listOperationTracking,
  paymentMethodLabels,
  type HandoverRecipient,
  type OperationTrackingPage,
  type OperationTrackingQuery,
  type OperationTrackingRow,
  type OwnCreditSummary,
  type TrackingIncome,
  type TrackingPaymentComponent,
} from './tracking'
import type { SalesOperationStatus } from './types'

const PAGE_SIZE = 20

type Filters = {
  branchId: string
  status: SalesOperationStatus | ''
  search: string
  from: string
  to: string
  withBalance: boolean
  withPendingCash: boolean
  withFinancingPending: boolean
}

const EMPTY_FILTERS: Filters = {
  branchId: '',
  status: '',
  search: '',
  from: '',
  to: '',
  withBalance: false,
  withPendingCash: false,
  withFinancingPending: false,
}

/** Filters → API query. Unchecked boxes mean "no filter", not "false". */
export function trackingQuery(
  filters: Filters,
  vehicleType: VehicleKind,
  page: number,
): OperationTrackingQuery {
  return {
    vehicleType,
    page,
    limit: PAGE_SIZE,
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.withBalance ? { withBalance: true } : {}),
    ...(filters.withPendingCash ? { withPendingCash: true } : {}),
    ...(filters.withFinancingPending ? { withFinancingPending: true } : {}),
  }
}

function displayDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

/** Filtros aplicados, en texto, para el encabezado del Excel. */
function describeTrackingFilters(
  filters: Filters,
  branches: Array<{ id: string; name: string }>,
) {
  return [
    filters.search.trim() && `Búsqueda: ${filters.search.trim()}`,
    filters.branchId &&
      `Sucursal: ${branches.find((branch) => branch.id === filters.branchId)?.name ?? filters.branchId}`,
    filters.status && `Estado: ${operationStatusLabels[filters.status]}`,
    filters.from && `Desde: ${displayDate(filters.from)}`,
    filters.to && `Hasta: ${displayDate(filters.to)}`,
    filters.withBalance && 'Con saldo',
    filters.withPendingCash && 'Con efectivo sin rendir',
    filters.withFinancingPending && 'Financiera pendiente de pago',
  ]
}

function handoverErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const code = error.details?.code
    if (code === 'HANDOVER_RECIPIENT_ONLY')
      return 'Sólo quien recibe la rendición puede confirmarla.'
    if (code === 'VERSION_CONFLICT')
      return 'El ingreso cambió mientras lo mirabas. Actualizá la grilla.'
    if (code === 'HANDOVER_NOT_PENDING')
      return 'Ese efectivo ya no está pendiente de rendición.'
    if (code === 'HANDOVER_NOT_COLLECTED')
      return 'El ingreso no tiene un cobro activo para rendir.'
  }
  return salesErrorMessage(error)
}

function ownCreditLabel(credit: OwnCreditSummary, currency: string) {
  return `${formatMoney(credit.collectedAmount, currency)} cobrado · ${credit.paidInstallments} de ${credit.installments} cuotas`
}

function ComponentRows({
  row,
  canManage,
  onFinancing,
}: {
  row: OperationTrackingRow
  canManage: boolean
  onFinancing: (component: TrackingPaymentComponent) => void
}) {
  if (!row.paymentComponents.length) return null
  return (
    <table className="tracking-incomes tracking-components">
      <caption className="sr-only">
        Plan de pago de la operación #{row.number}
      </caption>
      <thead>
        <tr>
          <th scope="col">Plan de pago</th>
          <th scope="col">Esperado</th>
          <th scope="col">Ingresado</th>
          <th scope="col">Estado</th>
        </tr>
      </thead>
      <tbody>
        {row.paymentComponents.map((component) => (
          <tr key={component.id}>
            <td>{componentLabel(component)}</td>
            <td>{formatMoney(component.expectedAmount, row.currency)}</td>
            <td>
              {formatMoney(component.collectedAmount, row.currency)}
              {component.financingPayment &&
                Number(component.collectedAmount) <
                  Number(component.expectedAmount) && (
                  <small>
                    Neto de{' '}
                    {formatMoney(component.expectedAmount, row.currency)}
                  </small>
                )}
            </td>
            <td>
              <div className="tracking-handover">
                {component.ownCredit ? (
                  <span className="status-badge">
                    {row.ownCredit
                      ? ownCreditLabel(row.ownCredit, row.currency)
                      : 'Se cobra por cuotas'}
                  </span>
                ) : isExternalFinancing(component) ? (
                  component.financingPayment ? (
                    <>
                      <span className="status-badge status-badge--success">
                        Financiera pagó
                      </span>
                      <small>
                        {formatOperationDate(component.financingPayment.informedAt)}
                        {component.financingPayment.informedBy
                          ? ` · ${component.financingPayment.informedBy.fullName}`
                          : ''}
                        {component.financingPayment.notes
                          ? ` · ${component.financingPayment.notes}`
                          : ''}
                      </small>
                    </>
                  ) : (
                    <span className="status-badge status-badge--warning">
                      Financiera pendiente
                    </span>
                  )
                ) : (
                  <span className="status-badge">
                    {Number(component.balanceAmount) > 0
                      ? `Saldo ${formatMoney(component.balanceAmount, row.currency)}`
                      : 'Cobrado'}
                  </span>
                )}
                {canManage &&
                  isExternalFinancing(component) &&
                  row.status !== 'CANCELADA' && (
                    <button
                      className="button button--secondary button--compact"
                      onClick={() => onFinancing(component)}
                      type="button"
                    >
                      {component.financingPayment
                        ? 'Deshacer'
                        : 'Financiera pagó'}
                    </button>
                  )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function IncomeRows({
  row,
  currentPersonnelId,
  canConfirm,
  confirmingId,
  onConfirm,
}: {
  row: OperationTrackingRow
  currentPersonnelId: string | null
  canConfirm: boolean
  confirmingId: string | null
  onConfirm: (income: TrackingIncome) => void
}) {
  if (!row.incomes.length)
    return <p className="tracking-detail__empty">Sin ingresos registrados.</p>
  return (
    <table className="tracking-incomes">
      <caption className="sr-only">
        Ingresos de la operación #{row.number}
      </caption>
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col">Concepto</th>
          <th scope="col">Medio</th>
          <th scope="col">Importe</th>
          <th scope="col">Recibió</th>
          <th scope="col">Rinde a</th>
          <th scope="col">Rendición</th>
        </tr>
      </thead>
      <tbody>
        {row.incomes.map((income) => (
          <tr key={income.id}>
            <td>{formatOperationDate(income.incomeDate)}</td>
            <td>
              {income.type}
              {income.isLicensing && <small>Aparte del precio acordado</small>}
              {income.isOwnCreditInstallment && (
                <small>Crédito propio · no suma en Cobrado</small>
              )}
            </td>
            <td>
              {income.paymentMethod
                ? paymentMethodLabels[income.paymentMethod]
                : '—'}
              {income.account && <small>{income.account.name}</small>}
            </td>
            <td>
              <strong>{formatMoney(income.collectedAmount, row.currency)}</strong>
              {income.collectedAmount !== income.totalAmount && (
                <small>
                  de {formatMoney(income.totalAmount, row.currency)}
                </small>
              )}
            </td>
            <td>{income.collectedBy?.fullName ?? '—'}</td>
            <td>{income.handover?.recipient?.fullName ?? '—'}</td>
            <td>
              {income.handover ? (
                <div className="tracking-handover">
                  <span
                    className={`status-badge ${handoverStatusClass(income.handover.status)}`}
                  >
                    {handoverStatusLabels[income.handover.status]}
                  </span>
                  {income.handover.confirmedAt && (
                    <small>
                      {formatOperationDate(income.handover.confirmedAt)} ·{' '}
                      {income.handover.confirmedBy?.fullName}
                    </small>
                  )}
                  {canConfirm &&
                    canConfirmHandover(income, currentPersonnelId) && (
                      <button
                        className="button button--secondary button--compact"
                        disabled={confirmingId === income.id}
                        onClick={() => onConfirm(income)}
                        type="button"
                      >
                        {confirmingId === income.id ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <ShieldCheck size={15} />
                        )}
                        Confirmar recepción
                      </button>
                    )}
                </div>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function OperationTrackingPanel({
  vehicleType,
}: {
  vehicleType: VehicleKind
}) {
  const { user } = useAuth()
  const permissions = user?.role.permissions
  const canCollect = hasPermission(permissions, 'ingresos.cobrar')
  const canConfirm = hasPermission(permissions, 'caja.recibir_rendicion')
  const scopeKey = branchScopeKey(user)

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [result, setResult] = useState<OperationTrackingPage | null>(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [branches, setBranches] = useState<
    Array<{ id: string; code?: string; name: string }>
  >([])
  const [recipients, setRecipients] = useState<HandoverRecipient[]>([])
  const [collecting, setCollecting] = useState<OperationTrackingRow | null>(
    null,
  )
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [financing, setFinancing] = useState<{
    row: OperationTrackingRow
    component: TrackingPaymentComponent
  } | null>(null)
  const branchLocked = isBranchSelectionLocked(scopeKey, branches)
  const currentPersonnelId =
    recipients.find((recipient) => recipient.isCurrentUser)?.id ?? null

  useEffect(() => {
    const controller = new AbortController()
    listSalesBranches(undefined, controller.signal)
      .then((items) => {
        const allowed = filterAllowedBranches(scopeKey, items)
        setBranches(allowed)
        // Un usuario con una sola sucursal la ve fija (fase 1).
        if (isBranchSelectionLocked(scopeKey, items) && allowed[0]) {
          const only = allowed[0].id
          setDraft((current) => ({ ...current, branchId: only }))
          setFilters((current) => ({ ...current, branchId: only }))
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setBranches([])
      })
    listHandoverRecipients(controller.signal)
      .then(setRecipients)
      .catch(() => {
        if (!controller.signal.aborted) setRecipients([])
      })
    return () => controller.abort()
  }, [scopeKey])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    listOperationTracking(
      trackingQuery(filters, vehicleType, page),
      controller.signal,
    )
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(salesErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [filters, page, refreshKey, vehicleType])

  const change = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setFilters(draft)
  }

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const confirm = async (income: TrackingIncome) => {
    setConfirmingId(income.id)
    try {
      await confirmCashHandover(income.id, income.rowVersion)
      void alertSuccess('Confirmaste la recepción del efectivo.')
      setRefreshKey((value) => value + 1)
      listHandoverRecipients()
        .then(setRecipients)
        .catch(() => undefined)
    } catch (confirmError) {
      void alertError(handoverErrorMessage(confirmError))
    } finally {
      setConfirmingId(null)
    }
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1
  const rows = result?.items ?? []
  const myPending = recipients.find((recipient) => recipient.isCurrentUser)

  // Excel: todo lo que trae el filtro aplicado, no sólo la página visible.
  const exportExcel = async () => {
    const title = `Seguimiento de cobros de ${vehicleType === 'MOTO' ? 'motos' : 'autos'}`
    const { items, total } = await fetchAllPages((nextPage, limit) =>
      listOperationTracking({
        ...trackingQuery(filters, vehicleType, nextPage),
        limit,
      }),
    )
    await downloadExcel({
      fileName: title,
      title,
      filters: describeTrackingFilters(filters, branches),
      columns: trackingExcelColumns,
      rows: items,
      total,
    })
  }

  return (
    <section className="sales-panel" aria-label="Seguimiento de operaciones">
      {canConfirm && myPending && myPending.pendingCount > 0 && (
        <div className="form-alert tracking-pending" role="status">
          <WalletCards size={17} />
          Tenés {myPending.pendingCount}{' '}
          {myPending.pendingCount === 1 ? 'rendición' : 'rendiciones'} de
          efectivo por confirmar ({formatMoney(myPending.pendingAmount, 'ARS')}).
        </div>
      )}
      <form className="sales-filters tracking-filters" onSubmit={submit}>
        <label className="search-field">
          <span className="sr-only">Buscar por boleto o cliente</span>
          <Search size={18} />
          <input
            maxLength={80}
            onChange={(event) => change('search', event.target.value)}
            placeholder="Operación, boleto o cliente"
            type="search"
            value={draft.search}
          />
        </label>
        <label className="filter-field">
          <span className="sr-only">Sucursal</span>
          <select
            disabled={branchLocked}
            onChange={(event) => change('branchId', event.target.value)}
            value={draft.branchId}
          >
            {!branchLocked && <option value="">Todas las sucursales</option>}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span className="sr-only">Estado de operación</span>
          <select
            onChange={(event) =>
              change('status', event.target.value as Filters['status'])
            }
            value={draft.status}
          >
            <option value="">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="PENDIENTE_APROBACION">Pendiente</option>
            <option value="APROBADA">Aprobada</option>
            <option value="RECHAZADA">Rechazada</option>
            <option value="CANCELADA">Cancelada</option>
            <option value="CERRADA">Cerrada</option>
          </select>
        </label>
        <label className="sales-date-field">
          <span>Desde</span>
          <input
            onChange={(event) => change('from', event.target.value)}
            type="date"
            value={draft.from}
          />
        </label>
        <label className="sales-date-field">
          <span>Hasta</span>
          <input
            onChange={(event) => change('to', event.target.value)}
            type="date"
            value={draft.to}
          />
        </label>
        <label className="tracking-check">
          <input
            checked={draft.withBalance}
            onChange={(event) => change('withBalance', event.target.checked)}
            type="checkbox"
          />
          Con saldo
        </label>
        <label className="tracking-check">
          <input
            checked={draft.withPendingCash}
            onChange={(event) =>
              change('withPendingCash', event.target.checked)
            }
            type="checkbox"
          />
          Con efectivo sin rendir
        </label>
        <label className="tracking-check">
          <input
            checked={draft.withFinancingPending}
            onChange={(event) =>
              change('withFinancingPending', event.target.checked)
            }
            type="checkbox"
          />
          Financiera pendiente de pago
        </label>
        <button className="button button--secondary" type="submit">
          Buscar
        </button>
        <ExportExcelButton
          disabled={status !== 'success' || !result || result.total === 0}
          onExport={exportExcel}
        />
      </form>

      <div className="sales-content" aria-live="polite">
        {status === 'loading' && (
          <div className="client-loading">
            <div className="loading-mark" />
            <span>Cargando seguimiento…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            icon={RefreshCw}
            title="No pudimos cargar el seguimiento"
            description={error}
            tone="danger"
            action={
              <button
                className="button button--primary"
                onClick={() => setRefreshKey((value) => value + 1)}
                type="button"
              >
                <RefreshCw size={17} />
                Reintentar
              </button>
            }
          />
        )}
        {status === 'success' && rows.length === 0 && (
          <StatePanel
            icon={WalletCards}
            title="No hay operaciones para seguir"
            description="Probá con otros filtros."
          />
        )}
        {status === 'success' && rows.length > 0 && (
          <div className="sales-table-wrap">
            <table className="sales-table tracking-table">
              <thead>
                <tr>
                  <th scope="col">Operación</th>
                  <th scope="col">Boleto</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Vendedor</th>
                  <th scope="col">Sucursal</th>
                  <th scope="col">Acordado</th>
                  <th scope="col">Cobrado</th>
                  <th scope="col">Saldo</th>
                  <th scope="col">Efectivo sin rendir</th>
                  <th scope="col">Crédito propio</th>
                  <th scope="col">Unidad</th>
                  <th scope="col">Patentamiento</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const open = expanded.has(row.id)
                  const balance = Number(row.balanceAmount)
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td>
                          <strong>#{row.number}</strong>
                          <small>{formatOperationDate(row.operationDate)}</small>
                          <span
                            className={`status-badge ${operationStatusClass(row.status)}`}
                          >
                            {operationStatusLabels[row.status]}
                          </span>
                        </td>
                        <td>{row.ticketNumber ?? '—'}</td>
                        <td>
                          <strong>{row.client.fullName}</strong>
                          {row.client.documentNumber && (
                            <small>
                              {row.client.documentType}{' '}
                              {row.client.documentNumber}
                            </small>
                          )}
                        </td>
                        <td>{row.seller?.fullName ?? '—'}</td>
                        <td>{row.branch.name}</td>
                        <td>{formatMoney(row.agreedPrice, row.currency)}</td>
                        <td>{formatMoney(row.collectedAmount, row.currency)}</td>
                        <td>
                          <strong
                            className={
                              balance > 0 ? 'tracking-balance--due' : undefined
                            }
                          >
                            {formatMoney(row.balanceAmount, row.currency)}
                          </strong>
                        </td>
                        <td>
                          {row.pendingHandoverCount > 0 ? (
                            <span className="status-badge status-badge--warning">
                              {formatMoney(
                                row.pendingHandoverAmount,
                                row.currency,
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {row.ownCredit ? (
                            <>
                              {formatMoney(
                                row.ownCredit.collectedAmount,
                                row.currency,
                              )}
                              <small>
                                {row.ownCredit.paidInstallments} de{' '}
                                {row.ownCredit.installments} cuotas
                              </small>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${fulfillmentStatusClass(row.fulfillment.status)}`}
                          >
                            {fulfillmentLabel(row.fulfillment)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${licensingStatusClass(row.licensing.status)}`}
                          >
                            {licensingStatusLabels[row.licensing.status]}
                          </span>
                        </td>
                        <td>
                          <div className="unit-cell__actions">
                            <button
                              aria-expanded={open}
                              aria-label={`${open ? 'Ocultar' : 'Ver'} ingresos de la operación #${row.number}`}
                              className="button button--secondary button--compact"
                              onClick={() => toggle(row.id)}
                              type="button"
                            >
                              {open ? (
                                <ChevronUp size={15} />
                              ) : (
                                <ChevronDown size={15} />
                              )}
                              Ingresos ({row.incomes.length})
                            </button>
                            {canCollect &&
                              row.status !== 'CANCELADA' &&
                              collectibleComponents(row).length > 0 && (
                                <button
                                  className="button button--secondary button--compact"
                                  onClick={() => setCollecting(row)}
                                  type="button"
                                >
                                  <HandCoins size={15} />
                                  Cobrar
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="tracking-detail">
                          <td colSpan={13}>
                            <ComponentRows
                              canManage={canCollect}
                              onFinancing={(component) =>
                                setFinancing({ row, component })
                              }
                              row={row}
                            />
                            <IncomeRows
                              canConfirm={canConfirm}
                              confirmingId={confirmingId}
                              currentPersonnelId={currentPersonnelId}
                              onConfirm={(income) => void confirm(income)}
                              row={row}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {status === 'success' && result && result.total > 0 && (
        <footer className="pagination">
          <span>
            {result.total} {result.total === 1 ? 'operación' : 'operaciones'}
          </span>
          <div>
            <button
              aria-label="Página anterior"
              className="icon-button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              <ChevronLeft size={19} />
            </button>
            <strong>
              Página {result.page} de {totalPages}
            </strong>
            <button
              aria-label="Página siguiente"
              className="icon-button"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              type="button"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </footer>
      )}

      {financing && (
        <FinancingPaymentModal
          component={financing.component}
          onClose={() => setFinancing(null)}
          onDone={() => {
            setFinancing(null)
            setRefreshKey((value) => value + 1)
          }}
          operation={financing.row}
        />
      )}

      {collecting && (
        <ComponentCollectionModal
          onClose={() => setCollecting(null)}
          onCollected={() => {
            setCollecting(null)
            setRefreshKey((value) => value + 1)
          }}
          operation={collecting}
          recipients={recipients}
        />
      )}
    </section>
  )
}
