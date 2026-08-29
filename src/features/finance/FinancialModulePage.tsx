import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { listFinancialRecords } from './api'
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

export function FinancialModulePage({ kind }: { kind: FinancialKind }) {
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

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setForbidden(false)
    setLoadError('')
    void listFinancialRecords(kind, query, controller.signal)
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
  }, [kind, query, refreshKey])

  const reload = (message?: string) => {
    if (message) setNotice(message)
    setRefreshKey((current) => current + 1)
  }

  const pageTotal = useMemo(() => {
    if (!result || result.items.length === 0) return null
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

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{labels.eyebrow}</p>
          <h1>{labels.title}</h1>
          <p>{labels.description}</p>
        </div>
        {canCreate && (
          <button className="button button--primary" type="button" onClick={() => setShowForm(true)}>
            <Plus size={18} />
            Nuevo {labels.singular}
          </button>
        )}
      </header>

      <FinancialFilters
        kind={kind}
        value={query}
        onApply={(next) => setQuery({ ...next, page: 1, limit: PAGE_SIZE })}
      />

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
            description="No encontramos registros para los filtros seleccionados."
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
