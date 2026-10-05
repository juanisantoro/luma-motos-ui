import {
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { alertError } from '../../shared/alerts'
import { ApiError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { financialErrorMessage, formatMoney } from '../finance/format'
import {
  EXPORT_MAX_ROWS,
  fetchAllPages,
  getAuditFilters,
  listAuditEvents,
  listMoneyMovements,
} from './api'
import { AuditEventModal } from './AuditEventModal'
import {
  actorName,
  argentinaDay,
  downloadCsv,
  eventsCsv,
  formatDateTime,
  movementsCsv,
  netAmount,
  summaryCsv,
} from './format'
import { MoneyTable } from './MoneyTable'
import { OperationHistoryModal } from './OperationHistoryModal'
import type {
  AuditEvent,
  AuditFilters,
  AuditLogQuery,
  AuditPage as Page,
  MoneyPage,
  MoneyQuery,
} from './types'

const PAGE_SIZE = 50

type Tab = 'activity' | 'money'
type Status = 'loading' | 'success' | 'error'

function defaultRange() {
  return { from: argentinaDay(-6), to: argentinaDay() }
}

function auditErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 400)
    return 'Revisá los filtros: hay un dato con formato inválido.'
  return financialErrorMessage(error)
}

function actorOptions(filters: AuditFilters | null) {
  return (filters?.actors ?? []).map((actor) => (
    <option key={actor.id} value={actor.id}>
      {actor.name ?? actor.email}
      {actor.active ? '' : ' (inactivo)'}
    </option>
  ))
}

function Pagination({
  page,
  total,
  limit,
  noun,
  onPage,
}: {
  page: number
  total: number
  limit: number
  noun: [string, string]
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  return (
    <footer className="pagination">
      <span>
        {total} {total === 1 ? noun[0] : noun[1]}
      </span>
      <div>
        <button
          aria-label="Página anterior"
          className="icon-button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          type="button"
        >
          <ChevronLeft size={19} />
        </button>
        <strong>
          Página {page} de {pages}
        </strong>
        <button
          aria-label="Página siguiente"
          className="icon-button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          type="button"
        >
          <ChevronRight size={19} />
        </button>
      </div>
    </footer>
  )
}

function Panel({
  label,
  status,
  error,
  empty,
  onRetry,
  children,
}: {
  label: string
  status: Status
  error: string
  empty: boolean
  onRetry: () => void
  children: ReactNode
}) {
  return (
    <section aria-label={label} className="financial-panel">
      {status === 'loading' && (
        <div className="financial-loading">
          <div className="loading-mark" />
          <span>Cargando…</span>
        </div>
      )}
      {status === 'error' && (
        <StatePanel
          action={
            <button
              className="button button--primary"
              onClick={onRetry}
              type="button"
            >
              <RefreshCw size={17} />
              Reintentar
            </button>
          }
          description={error}
          icon={RefreshCw}
          title="No pudimos cargar la auditoría"
          tone="danger"
        />
      )}
      {status === 'success' && empty && (
        <StatePanel
          description="Probá ampliando el rango de fechas o quitando filtros."
          icon={ShieldCheck}
          title="No hay registros para esos filtros"
        />
      )}
      {status === 'success' && !empty && children}
    </section>
  )
}

function ExportButton({ onExport }: { onExport: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      className="button button--secondary"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        onExport()
          .catch((error: unknown) => void alertError(auditErrorMessage(error)))
          .finally(() => setBusy(false))
      }}
      type="button"
    >
      {busy ? (
        <LoaderCircle className="spin" size={17} />
      ) : (
        <Download size={17} />
      )}
      {busy ? 'Exportando…' : 'Exportar a Excel'}
    </button>
  )
}

function ActivityTab({
  filters,
  onOpenOperation,
}: {
  filters: AuditFilters | null
  onOpenOperation: (operationId: string) => void
}) {
  const [query, setQuery] = useState<AuditLogQuery>(() => ({
    page: 1,
    limit: PAGE_SIZE,
    ...defaultRange(),
  }))
  const [draft, setDraft] = useState(query)
  const [status, setStatus] = useState<Status>('loading')
  const [result, setResult] = useState<Page<AuditEvent> | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [detail, setDetail] = useState<AuditEvent | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    listAuditEvents(query, controller.signal)
      .then((page) => {
        setResult(page)
        setStatus('success')
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(auditErrorMessage(cause))
        setStatus('error')
      })
    return () => controller.abort()
  }, [query, attempt])

  const apply = (event: FormEvent) => {
    event.preventDefault()
    setQuery({ ...draft, page: 1 })
  }
  const clear = () => {
    const next = { page: 1, limit: PAGE_SIZE, ...defaultRange() }
    setDraft(next)
    setQuery(next)
  }
  const actions = (filters?.actions ?? []).filter(
    (action) => !draft.category || action.category === draft.category,
  )

  return (
    <>
      <section className="financial-filters audit-filters">
        <form aria-label="Filtros de actividad" onSubmit={apply}>
          <label className="filter-field">
            Desde
            <input
              onChange={(event) =>
                setDraft({ ...draft, from: event.target.value })
              }
              type="date"
              value={draft.from ?? ''}
            />
          </label>
          <label className="filter-field">
            Hasta
            <input
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value })
              }
              type="date"
              value={draft.to ?? ''}
            />
          </label>
          <label className="filter-field">
            Módulo
            <select
              onChange={(event) =>
                setDraft({
                  ...draft,
                  category: event.target.value as NonNullable<AuditLogQuery['category']>,
                  action: '',
                })
              }
              value={draft.category ?? ''}
            >
              <option value="">Todos</option>
              {filters?.categories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            Acción
            <select
              onChange={(event) =>
                setDraft({ ...draft, action: event.target.value })
              }
              value={draft.action ?? ''}
            >
              <option value="">Todas</option>
              {actions.map((action) => (
                <option key={action.code} value={action.code}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            Usuario
            <select
              onChange={(event) =>
                setDraft({ ...draft, actorId: event.target.value })
              }
              value={draft.actorId ?? ''}
            >
              <option value="">Todos</option>
              {actorOptions(filters)}
            </select>
          </label>
          <label className="filter-field">
            N.º de operación
            <input
              inputMode="numeric"
              onChange={(event) =>
                setDraft({ ...draft, operationNumber: event.target.value })
              }
              placeholder="Ej.: 1250"
              value={draft.operationNumber ?? ''}
            />
          </label>
          <div className="financial-filter-actions">
            <button
              className="button button--secondary"
              onClick={clear}
              type="button"
            >
              Limpiar
            </button>
            <ExportButton
              onExport={async () => {
                const all = await fetchAllPages((page, limit) =>
                  listAuditEvents({ ...query, page, limit }),
                )
                downloadCsv(
                  `auditoria-actividad-${argentinaDay()}.csv`,
                  eventsCsv(all.items),
                )
              }}
            />
            <button className="button button--primary" type="submit">
              <Search size={17} />
              Buscar
            </button>
          </div>
        </form>
      </section>

      <Panel
        empty={result?.items.length === 0}
        error={error}
        label="Registro de actividad"
        onRetry={() => setAttempt((value) => value + 1)}
        status={status}
      >
        <div className="financial-table-wrap">
          <table className="financial-table audit-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Sobre qué</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {result?.items.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{formatDateTime(event.createdAt)}</strong>
                  </td>
                  <td>
                    {actorName(event)}
                    <small>
                      {[event.actor?.role, event.branch?.name]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </td>
                  <td>
                    <span className="status-badge">{event.categoryLabel}</span>
                  </td>
                  <td>
                    <strong>{event.actionLabel}</strong>
                  </td>
                  <td>
                    {event.restricted
                      ? 'Registro de otra sucursal'
                      : (event.subject?.title ?? '—')}
                    {event.subject?.detail && (
                      <small>{event.subject.detail}</small>
                    )}
                    {event.subject?.amount && (
                      <small>{formatMoney(event.subject.amount)}</small>
                    )}
                    {event.subject?.operationId &&
                      event.entity !== 'operaciones' && (
                        <small>
                          Venta N.º {event.subject.operationNumber}
                        </small>
                      )}
                  </td>
                  <td className="financial-actions">
                    <button
                      aria-label={`Ver detalle de ${event.actionLabel} del ${formatDateTime(event.createdAt)}`}
                      className="button button--secondary button--compact"
                      onClick={() => setDetail(event)}
                      type="button"
                    >
                      Detalle
                    </button>
                    {event.subject?.operationId && (
                      <button
                        aria-label={`Ver historial de la venta ${event.subject.operationNumber}`}
                        className="button button--secondary button--compact"
                        onClick={() =>
                          onOpenOperation(event.subject!.operationId!)
                        }
                        type="button"
                      >
                        Historial
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result && (
          <Pagination
            limit={result.limit}
            noun={['evento', 'eventos']}
            onPage={(page) => setQuery({ ...query, page })}
            page={result.page}
            total={result.total}
          />
        )}
      </Panel>

      {detail && (
        <AuditEventModal
          event={detail}
          onClose={() => setDetail(null)}
          onOpenOperation={(operationId) => {
            setDetail(null)
            onOpenOperation(operationId)
          }}
        />
      )}
    </>
  )
}

function MoneyTab({
  filters,
  onOpenOperation,
}: {
  filters: AuditFilters | null
  onOpenOperation: (operationId: string) => void
}) {
  const [showSummary, setShowSummary] = useState(true)
  const [query, setQuery] = useState<MoneyQuery>(() => ({
    page: 1,
    limit: PAGE_SIZE,
    ...defaultRange(),
  }))
  const [draft, setDraft] = useState(query)
  const [status, setStatus] = useState<Status>('loading')
  const [result, setResult] = useState<MoneyPage | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    listMoneyMovements(query, controller.signal)
      .then((page) => {
        setResult(page)
        setStatus('success')
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(auditErrorMessage(cause))
        setStatus('error')
      })
    return () => controller.abort()
  }, [query, attempt])

  const apply = (event: FormEvent) => {
    event.preventDefault()
    setQuery({ ...draft, page: 1 })
  }
  const clear = () => {
    const next = { page: 1, limit: PAGE_SIZE, ...defaultRange() }
    setDraft(next)
    setQuery(next)
  }

  const accounts = (filters?.accounts ?? []).filter(
    (account) => !draft.branchId || account.branchId === draft.branchId,
  )

  return (
    <>
      <section className="financial-filters audit-filters">
        <form aria-label="Filtros de movimientos de dinero" onSubmit={apply}>
          <label className="filter-field">
            Cargado desde
            <input
              onChange={(event) =>
                setDraft({ ...draft, from: event.target.value })
              }
              type="date"
              value={draft.from ?? ''}
            />
          </label>
          <label className="filter-field">
            Cargado hasta
            <input
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value })
              }
              type="date"
              value={draft.to ?? ''}
            />
          </label>
          <label className="filter-field">
            Sucursal
            <select
              onChange={(event) =>
                setDraft({
                  ...draft,
                  branchId: event.target.value,
                  // La cuenta elegida puede ser de otra sucursal.
                  accountId: '',
                })
              }
              value={draft.branchId ?? ''}
            >
              <option value="">Todas</option>
              {filters?.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            Cuenta
            <select
              onChange={(event) =>
                setDraft({ ...draft, accountId: event.target.value })
              }
              value={draft.accountId ?? ''}
            >
              <option value="">Todas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                  {account.currency !== 'ARS' ? ` (${account.currency})` : ''}
                  {account.active ? '' : ' (inactiva)'}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            Sentido
            <select
              onChange={(event) =>
                setDraft({
                  ...draft,
                  direction: event.target.value as NonNullable<MoneyQuery['direction']>,
                })
              }
              value={draft.direction ?? ''}
            >
              <option value="">Entradas y salidas</option>
              <option value="CREDITO">Sólo entradas</option>
              <option value="DEBITO">Sólo salidas</option>
            </select>
          </label>
          <label className="filter-field">
            Registró
            <select
              onChange={(event) =>
                setDraft({ ...draft, actorId: event.target.value })
              }
              value={draft.actorId ?? ''}
            >
              <option value="">Todos</option>
              {actorOptions(filters)}
            </select>
          </label>
          <label className="filter-field">
            N.º de operación
            <input
              inputMode="numeric"
              onChange={(event) =>
                setDraft({ ...draft, operationNumber: event.target.value })
              }
              placeholder="Ej.: 1250"
              value={draft.operationNumber ?? ''}
            />
          </label>
          <label className="filter-field">
            Buscar
            <input
              onChange={(event) =>
                setDraft({ ...draft, search: event.target.value })
              }
              maxLength={120}
              placeholder="Cliente, concepto, referencia…"
              value={draft.search ?? ''}
            />
          </label>
          <label className="operation-check audit-filters__check">
            <input
              checked={draft.onlyReversals ?? false}
              onChange={(event) =>
                setDraft({ ...draft, onlyReversals: event.target.checked })
              }
              type="checkbox"
            />
            <span>Sólo reversados y reversas</span>
          </label>
          <div className="financial-filter-actions">
            <button
              className="button button--secondary"
              onClick={clear}
              type="button"
            >
              Limpiar
            </button>
            <ExportButton
              onExport={async () => {
                const all = await fetchAllPages((page, limit) =>
                  listMoneyMovements({ ...query, page, limit }),
                )
                downloadCsv(
                  `auditoria-dinero-${argentinaDay()}.csv`,
                  movementsCsv(all.items),
                )
              }}
            />
            <button className="button button--primary" type="submit">
              <Search size={17} />
              Buscar
            </button>
          </div>
        </form>
      </section>

      {status === 'success' && result && (
        <section
          aria-label="Totales del filtro"
          className="financial-summary"
        >
          <article>
            <small>Movimientos</small>
            <strong>{result.total}</strong>
          </article>
          {result.totals ? (
            // Un par de totales por moneda: pesos y dólares no se suman.
            result.totals.map((totals) => {
              const suffix =
                result.totals!.length > 1 || totals.currency !== 'ARS'
                  ? ` (${totals.currency})`
                  : ''
              return [
                <article key={`${totals.currency}-in`}>
                  <small>Entradas vigentes{suffix}</small>
                  <strong>
                    {formatMoney(totals.credit, totals.currency)}
                  </strong>
                </article>,
                <article key={`${totals.currency}-out`}>
                  <small>Salidas vigentes{suffix}</small>
                  <strong>{formatMoney(totals.debit, totals.currency)}</strong>
                </article>,
              ]
            })
          ) : (
            <p>
              Los totales no se muestran porque tu perfil no ve los costos de
              compra.
            </p>
          )}
        </section>
      )}

      {status === 'success' && result?.summary && result.summary.length > 0 && (
        <section
          aria-label="Resumen por caja"
          className="financial-panel audit-summary"
        >
          <header>
            <div>
              <h2>Resumen por caja</h2>
              <p>
                Lo vigente del filtro, por sucursal, caja y moneda. No incluye
                lo reversado.
              </p>
            </div>
            <div className="audit-summary__actions">
              <button
                className="button button--secondary button--compact"
                onClick={() =>
                  downloadCsv(
                    `cierre-por-caja-${argentinaDay()}.csv`,
                    summaryCsv(result.summary ?? []),
                  )
                }
                type="button"
              >
                <Download size={15} />
                Exportar resumen
              </button>
              <button
                aria-expanded={showSummary}
                className="button button--secondary button--compact"
                onClick={() => setShowSummary((value) => !value)}
                type="button"
              >
                {showSummary ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </header>
          {showSummary && (
            <div className="financial-table-wrap">
              <table className="financial-table audit-table">
                <thead>
                  <tr>
                    <th>Sucursal</th>
                    <th>Caja</th>
                    <th>Moneda</th>
                    <th className="audit-table__money">Entradas</th>
                    <th className="audit-table__money">Salidas</th>
                    <th className="audit-table__money">Neto</th>
                    <th className="audit-table__money">Pendiente de rendir</th>
                  </tr>
                </thead>
                <tbody>
                  {result.summary.map((row) => (
                    <tr key={row.account.id}>
                      <td>{row.branch?.name ?? 'Compartida'}</td>
                      <td>
                        <strong>{row.account.name}</strong>
                      </td>
                      <td>{row.currency}</td>
                      <td className="audit-table__money audit-table__money--in">
                        {formatMoney(row.credit, row.currency)}
                      </td>
                      <td className="audit-table__money audit-table__money--out">
                        {formatMoney(row.debit, row.currency)}
                      </td>
                      <td className="audit-table__money">
                        <strong>
                          {formatMoney(netAmount(row), row.currency)}
                        </strong>
                      </td>
                      <td className="audit-table__money">
                        {Number(row.pendingHandover) > 0
                          ? formatMoney(row.pendingHandover, row.currency)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Panel
        empty={result?.items.length === 0}
        error={error}
        label="Movimientos de dinero"
        onRetry={() => setAttempt((value) => value + 1)}
        status={status}
      >
        {result && (
          <>
            <MoneyTable
              movements={result.items}
              onOpenOperation={onOpenOperation}
            />
            <Pagination
              limit={result.limit}
              noun={['movimiento', 'movimientos']}
              onPage={(page) => setQuery({ ...query, page })}
              page={result.page}
              total={result.total}
            />
          </>
        )}
      </Panel>
    </>
  )
}

// Auditoría: quién hizo qué y cuándo, y por dónde pasó cada peso.
export function AuditPage() {
  const [tab, setTab] = useState<Tab>('activity')
  const [filters, setFilters] = useState<AuditFilters | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    // Sin las opciones la pantalla igual funciona con fecha y N.º de operación.
    getAuditFilters(controller.signal)
      .then(setFilters)
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const tabs: Array<[Tab, string]> = [
    ['activity', 'Actividad'],
    ['money', 'Movimientos de dinero'],
  ]

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">CONTROL</p>
          <h1>Auditoría</h1>
          <p>
            Todo lo que se hizo en el sistema, con fecha y hora, quién lo hizo y
            quién lo aprobó. Las horas son de Argentina. Se exportan hasta{' '}
            {EXPORT_MAX_ROWS.toLocaleString('es-AR')} filas por vez.
          </p>
        </div>
      </header>

      <div aria-label="Vistas de auditoría" className="audit-tabs" role="tablist">
        {tabs.map(([code, label]) => (
          <button
            aria-selected={tab === code}
            className={`button ${tab === code ? 'button--primary' : 'button--secondary'}`}
            key={code}
            onClick={() => setTab(code)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'activity' ? (
        <ActivityTab filters={filters} onOpenOperation={setHistoryId} />
      ) : (
        <MoneyTab filters={filters} onOpenOperation={setHistoryId} />
      )}

      {historyId && (
        <OperationHistoryModal
          key={historyId}
          onClose={() => setHistoryId(null)}
          operationId={historyId}
        />
      )}
    </>
  )
}
