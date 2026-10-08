import {
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Plus,
  RefreshCw,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { describeFilters, downloadExcel, fetchAllPages } from '../../shared/export/excel'
import { ExportExcelButton } from '../../shared/export/ExportExcelButton'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { alertError, alertSuccess } from '../../shared/alerts'
import {
  confirmCashHandover,
  listHandoverRecipients,
  type HandoverRecipient,
} from '../sales/tracking'
import { listFinancialRecords } from './api'
import { financialExcelColumns } from './export'
import { FinancialDetailsModal } from './components/FinancialDetailsModal'
import { FinancialFilters } from './components/FinancialFilters'
import { FinancialRecordForm } from './components/FinancialRecordForm'
import { FinancialRecordList } from './components/FinancialRecordList'
import { SettlementModal } from './components/SettlementModal'
import {
  financialErrorMessage,
  financialLabels,
  formatMoney,
} from './format'
import type {
  Expense,
  FinancialKind,
  FinancialListQuery,
  FinancialRecord,
  FinancialVehicleType,
  Income,
  PageResponse,
  SupplierPurchase,
} from './types'

const PAGE_SIZE = 20

const permissionByKind = {
  purchase: {
    manage: 'compras.gestionar',
    settle: 'compras.pagar',
    recover: '',
  },
  income: {
    manage: 'ingresos.gestionar',
    settle: 'ingresos.cobrar',
    recover: '',
  },
  expense: {
    manage: 'gastos.gestionar',
    settle: 'gastos.pagar',
    recover: 'gastos.recuperar',
  },
} as const

// Qué representa el total de cada pantalla, en una línea.
const TOTAL_NOTES: Record<FinancialKind, string> = {
  income:
    'El total suma el importe de todos los ingresos que cumplen los filtros, no sólo los de esta página. Incluye lo cobrado y lo que falta cobrar.',
  expense:
    'El total suma el importe de todos los gastos que cumplen los filtros, no sólo los de esta página. Incluye lo pagado y lo que falta pagar.',
  purchase:
    'El total suma el importe de todas las compras que cumplen los filtros, no sólo las de esta página. Incluye lo pagado y lo que falta pagar.',
}

export function FinancialModulePage({
  kind,
  vehicleType,
}: {
  kind: FinancialKind
  vehicleType?: FinancialVehicleType
}) {
  const { user } = useAuth()
  const labels = financialLabels(kind)
  const permissions = user?.role.permissions ?? []
  const kindPermissions = permissionByKind[kind]
  const canManage = hasPermission(permissions, kindPermissions.manage)
  const canSettle = hasPermission(permissions, kindPermissions.settle)
  const canRecover = Boolean(kindPermissions.recover)
    && hasPermission(permissions, kindPermissions.recover)
  const canReverse = hasPermission(permissions, 'caja.reversar')
  const canViewCosts = kind !== 'purchase'
    || hasPermission(permissions, 'compras.costos.consultar')
  const canCreate = canManage && (kind !== 'purchase' || canViewCosts)

  const [query, setQuery] = useState<FinancialListQuery>({
    page: 1,
    limit: PAGE_SIZE,
    ...(vehicleType ? { vehicleType } : {}),
  })
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [result, setResult] = useState<PageResponse<FinancialRecord> | null>(null)
  const [loadError, setLoadError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [settlement, setSettlement] = useState<{ record: FinancialRecord; recovery: boolean } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  // Ingresos: quien recibe rendiciones confirma el efectivo desde la lista.
  const canConfirmHandover =
    kind === 'income' && hasPermission(permissions, 'caja.recibir_rendicion')
  const [currentRecipient, setCurrentRecipient] =
    useState<HandoverRecipient | null>(null)
  const currentRecipientId = currentRecipient?.id ?? null
  // Se vuelve a pedir tras cada cambio para que el aviso de pendientes baje.
  // Sólo cuenta los cobros de esta pantalla: los de motos no se avisan en
  // Ingresos de autos, ni al revés.
  useEffect(() => {
    if (!canConfirmHandover) return
    const controller = new AbortController()
    listHandoverRecipients(controller.signal, vehicleType)
      .then((items) =>
        setCurrentRecipient(items.find((item) => item.isCurrentUser) ?? null),
      )
      .catch(() => undefined)
    return () => controller.abort()
  }, [canConfirmHandover, refreshKey, vehicleType])
  const pendingHandovers = currentRecipient?.pendingCount ?? 0
  const onlyMyHandovers =
    Boolean(currentRecipientId) &&
    query.handoverStatus === 'PENDIENTE_RENDICION' &&
    query.handoverToId === currentRecipientId
  const toggleMyHandovers = () =>
    setQuery((current) => {
      const next: FinancialListQuery = { ...current, page: 1 }
      delete next.handoverStatus
      delete next.handoverToId
      if (!onlyMyHandovers && currentRecipientId) {
        next.handoverStatus = 'PENDIENTE_RENDICION'
        next.handoverToId = currentRecipientId
      }
      return next
    })

  const confirmHandover = async (income: Income) => {
    try {
      await confirmCashHandover(income.id, income.rowVersion ?? 0)
      void alertSuccess('Confirmaste la recepción del efectivo.')
    } catch (error) {
      void alertError(
        error instanceof ApiError && error.details?.code === 'VERSION_CONFLICT'
          ? 'El ingreso cambió mientras lo mirabas. Se actualizó la lista.'
          : financialErrorMessage(error),
      )
    }
    setRefreshKey((current) => current + 1)
  }

  const effectiveQuery = useMemo(
    () => (vehicleType ? { ...query, vehicleType } : query),
    [query, vehicleType],
  )

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setForbidden(false)
    setLoadError('')
    void listFinancialRecords(kind, effectiveQuery, controller.signal)
      .then((response) => {
        setResult(response as PageResponse<FinancialRecord>)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setForbidden(error instanceof ApiError && error.status === 403)
        setLoadError(financialErrorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [effectiveQuery, kind, refreshKey])

  const reload = (message?: string) => {
    if (message) setNotice(message)
    setRefreshKey((current) => current + 1)
  }

  // Total de todo lo que trae el filtro, por moneda (lo calcula el servidor).
  const filterTotals = result?.totals ?? null

  // Sin ese total (un servidor anterior), se suma sólo lo que se ve en la página.
  const pageTotal = useMemo(() => {
    if (!result || result.items.length === 0 || result.totals) return null
    // Pesos y dólares mezclados no se suman.
    if (new Set(result.items.map((item) => item.currency)).size > 1)
      return null
    if (kind === 'purchase') {
      if (!canViewCosts) return null
      const values = (result.items as SupplierPurchase[])
        .map((item) => item.totalAmount)
        .filter((value): value is string => value !== undefined)
      if (values.length !== result.items.length) return null
      return values.reduce((sum, value) => sum + Number(value), 0)
    }
    return result.items.reduce(
      (sum, item) => sum + Number((item as Expense).totalAmount),
      0,
    )
  }, [canViewCosts, kind, result])

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1

  // Excel: todo lo que trae el filtro aplicado, no sólo la página visible.
  const filtersRef = useRef<HTMLDivElement>(null)
  const pageTitle = `${kind === 'expense' ? 'Gastos generales' : labels.title}${vehicleType ? ` de ${vehicleType === 'MOTO' ? 'motos' : 'autos'}` : ''}`
  const exportExcel = async () => {
    const { items, total } = await fetchAllPages((page, limit) =>
      listFinancialRecords(kind, { ...effectiveQuery, page, limit }) as Promise<PageResponse<FinancialRecord>>,
    )
    await downloadExcel({
      fileName: pageTitle,
      title: pageTitle,
      filters: describeFilters(filtersRef.current),
      columns: financialExcelColumns(kind, canViewCosts),
      rows: items,
      total,
    })
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{labels.eyebrow}</p>
          <h1>
            {labels.title}
            {vehicleType ? ` de ${vehicleType === 'MOTO' ? 'motos' : 'autos'}` : ''}
          </h1>
          <p>{labels.description}</p>
        </div>
        <div className="page-heading__actions">
          <ExportExcelButton
            disabled={status !== 'success' || !result || result.total === 0}
            onExport={exportExcel}
          />
          {canCreate && (
            <button className="button button--primary" type="button" onClick={() => setShowForm(true)}>
              <Plus size={18} />
              Nuevo {labels.singular}
            </button>
          )}
        </div>
      </header>

      <div className="export-filters-scope" ref={filtersRef}>
      <FinancialFilters
        kind={kind}
        {...(vehicleType ? { vehicleType } : {})}
        value={query}
        onApply={(next) =>
          setQuery({
            ...next,
            page: 1,
            limit: PAGE_SIZE,
            ...(vehicleType ? { vehicleType } : {}),
          })
        }
      />
      </div>

      {canConfirmHandover && (pendingHandovers > 0 || onlyMyHandovers) && (
        <div className="handover-banner" role="status">
          <HandCoins aria-hidden="true" size={20} />
          <div>
            <strong>
              {pendingHandovers > 0
                ? `Tenés ${pendingHandovers} ${pendingHandovers === 1 ? 'cobro en efectivo' : 'cobros en efectivo'} para confirmar`
                : 'No te queda efectivo por confirmar'}
            </strong>
            <span>
              {pendingHandovers > 0
                ? `Son ${formatMoney(currentRecipient?.pendingAmount ?? '0')} que te rindieron. Cuando tengas la plata en mano, tocá Confirmar recepción en cada ingreso.`
                : 'Ya confirmaste todo lo que te rindieron.'}
            </span>
          </div>
          <button
            className="button button--secondary button--compact"
            type="button"
            onClick={toggleMyHandovers}
          >
            {onlyMyHandovers ? 'Ver todos los ingresos' : 'Ver los que tengo que confirmar'}
          </button>
        </div>
      )}

      {notice && (
        <div className="form-alert financial-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>Cerrar</button>
        </div>
      )}

      {status === 'success' && result && (
        <section className="financial-summary" aria-label="Resumen de resultados">
          <article>
            <small>Registros encontrados</small>
            <strong>{result.total}</strong>
          </article>
          {filterTotals?.map((total) => (
            <article key={total.currency}>
              <small>
                {result.total === 1
                  ? 'Total del registro encontrado'
                  : `Total de los ${result.total} registros encontrados`}
                {filterTotals.length > 1 ? ` · ${total.currency}` : ''}
              </small>
              <strong>{formatMoney(total.amount, total.currency)}</strong>
            </article>
          ))}
          {pageTotal !== null && (
            <article>
              <small>Total visible en esta página</small>
              <strong>{formatMoney(pageTotal.toFixed(2), result.items[0]?.currency)}</strong>
            </article>
          )}
          {kind === 'purchase' && !canViewCosts && (
            <p>Los costos de compra no están disponibles para tu perfil.</p>
          )}
        </section>
      )}
      {status === 'success' && result && filterTotals && filterTotals.length > 0 && (
        <p className="financial-summary-note">{TOTAL_NOTES[kind]}</p>
      )}

      <section className="financial-panel" aria-label={`Listado de ${labels.plural}`}>
        {status === 'loading' && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando {labels.plural}…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            icon={RefreshCw}
            title={forbidden ? 'No tenés acceso a estos registros' : `No pudimos cargar ${labels.plural}`}
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
            icon={WalletCards}
            title="No hay resultados"
            description={`No encontramos registros${vehicleType ? ` de ${vehicleType === 'MOTO' ? 'motos' : 'autos'}` : ''} para los filtros seleccionados.`}
          />
        )}
        {status === 'success' && result && result.items.length > 0 && (
          <FinancialRecordList
            kind={kind}
            records={result.items}
            canSettle={canSettle}
            canRecover={canRecover}
            canViewCosts={canViewCosts}
            onSettle={(record, recovery = false) => setSettlement({ record, recovery })}
            onDetails={(record) => setDetailId(record.id)}
            {...(canConfirmHandover
              ? {
                  currentRecipientId,
                  onConfirmHandover: (income: Income) =>
                    void confirmHandover(income),
                }
              : {})}
          />
        )}
        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>{result.total} {result.total === 1 ? labels.singular : labels.plural}</span>
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

      {showForm && (
        <FinancialRecordForm
          kind={kind}
          {...(vehicleType ? { vehicleType } : {})}
          {...(user?.branch?.id ? { defaultBranchId: user.branch.id } : {})}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            reload(`${labels.title}: registro guardado correctamente.`)
          }}
        />
      )}
      {settlement && (
        <SettlementModal
          kind={kind}
          record={settlement.record}
          recovery={settlement.recovery}
          onClose={() => setSettlement(null)}
          onSaved={() => {
            setSettlement(null)
            reload('Movimiento registrado correctamente.')
          }}
        />
      )}
      {detailId && (
        <FinancialDetailsModal
          kind={kind}
          recordId={detailId}
          canReverse={canReverse}
          onClose={() => setDetailId(null)}
          onChanged={() => reload('Movimiento reversado correctamente.')}
        />
      )}
    </>
  )
}
