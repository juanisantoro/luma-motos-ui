import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  RefreshCw,
  Scale,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError, NetworkError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { ExportExcelButton } from '../../shared/export/ExportExcelButton'
import { downloadExcel } from '../../shared/export/excel'
import { formatDay, useWorkPeriod } from '../../shared/work-months/workMonths'
import { workMonthOptionLabel, workPeriodLabel } from '../../shared/work-months/WorkMonthSelect'
import { KpiCard } from '../dashboard/components'
import { getBalance, type BalanceCurrency, type BalanceData } from './api'
import {
  ALL_BRANCHES,
  branchView,
  NO_ACCOUNT,
  partnerView,
  type BalanceRow,
  type BalanceTable,
  type UnitsMode,
} from './balance'

type ViewBy = 'branch' | 'partner'

const formatters = new Map<BalanceCurrency, Intl.NumberFormat>()

export function formatBalanceMoney(value: number, currency: BalanceCurrency) {
  let formatter = formatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
    formatters.set(currency, formatter)
  }
  return formatter.format(Math.round(value) || 0)
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message
  return 'No pudimos cargar el balance. Intentá nuevamente.'
}

function Switch<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<[T, string]>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="balance-filter">
      <span>{label}</span>
      <div className="month-switch" role="group" aria-label={label}>
        {options.map(([key, text]) => (
          <button
            aria-pressed={value === key}
            className={`month-switch__option${value === key ? ' month-switch__option--active' : ''}`}
            key={key}
            onClick={() => onChange(key)}
            type="button"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function cellClass(row: BalanceRow, value: number | null) {
  if (value === null) return undefined
  if (row.kind === 'result' || (row.kind === 'subtotal' && row.label.startsWith('Neto')))
    return value < 0 ? 'balance-negative' : 'balance-positive'
  return value === 0 ? 'balance-zero' : undefined
}

function BalanceGrid({
  table,
  currency,
  caption,
}: {
  table: BalanceTable
  currency: BalanceCurrency
  caption: string
}) {
  const show = (row: BalanceRow, value: number | null) => {
    if (value === null) return ''
    if (value === 0 && row.kind === 'line') return '—'
    return formatBalanceMoney(value, currency)
  }
  return (
    <div className="financial-table-wrap">
      <table className="financial-table balance-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Concepto</th>
            {table.columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr className={`balance-row balance-row--${row.kind}`} key={`${row.kind}-${row.label}-${index}`}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, column) => (
                <td className={cellClass(row, value)} key={table.columns[column]!.key}>
                  {show(row, value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BalancePage() {
  const [period, setPeriod, months] = useWorkPeriod()
  const [currency, setCurrency] = useState<BalanceCurrency>('ARS')
  const [viewBy, setViewBy] = useState<ViewBy>('branch')
  const [scope, setScope] = useState(ALL_BRANCHES)
  const [mode, setMode] = useState<UnitsMode>('cogs')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [data, setData] = useState<BalanceData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getBalance(period, currency, controller.signal)
      .then((result) => {
        setData(result)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(errorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [period, currency, refreshKey])

  // Si la sucursal elegida no está en el mes que llegó, volver a "Todas".
  const scopeValid = !data || scope === ALL_BRANCHES || data.branches.some((branch) => branch.key === scope)
  const activeScope = scopeValid ? scope : ALL_BRANCHES

  const byBranch = useMemo(
    () => (data ? branchView(data, activeScope, mode) : null),
    [data, activeScope, mode],
  )
  const byPartner = useMemo(() => (data ? partnerView(data, activeScope) : null), [data, activeScope])

  const money = (value: number) => formatBalanceMoney(value, currency)
  const monthLabel = data ? workMonthOptionLabel(data.period, data.from, data.to) : ''
  const monthInfo = months?.months.find((item) => item.period === period)
  const table = viewBy === 'branch' ? byBranch?.table : byPartner?.table

  const exportExcel = async () => {
    if (!data || !table) return
    await downloadExcel<BalanceRow>({
      fileName: `Balance ${data.period}${viewBy === 'partner' ? ' por socio' : ''}`,
      title: viewBy === 'partner' ? 'Balance por socio' : 'Balance del mes',
      filters: [
        `Corte: ${workPeriodLabel(months, data.period)}`,
        `Moneda: ${currency === 'ARS' ? 'Pesos' : 'Dólares'}`,
        activeScope !== ALL_BRANCHES &&
          `Sucursal: ${data.branches.find((branch) => branch.key === activeScope)?.name ?? ''}`,
        viewBy === 'branch' &&
          `Motos y autos comprados: ${mode === 'cogs' ? 'restar lo vendido' : 'dejar afuera'}`,
      ],
      columns: [
        { header: 'Concepto', value: (row) => (row.kind === 'line' ? `   ${row.label}` : row.label) },
        ...table.columns.map((column, index) => ({
          header: column.label,
          type: 'money' as const,
          value: (row: BalanceRow) => row.values[index] ?? null,
        })),
      ],
      rows: table.rows,
    })
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN FINANCIERA</p>
          <h1>Balance del mes</h1>
          <p>
            Ingresos y egresos de un mes de trabajo, de corte a corte, por sucursal o por socio. Lo
            del plan de pago de cada venta cuenta en el mes de la venta, aunque se acredite después
            del corte.
          </p>
        </div>
        <div className="page-heading__actions">
          <ExportExcelButton disabled={status !== 'success' || !table} onExport={exportExcel} />
        </div>
      </header>

      <section aria-label="Filtros del balance" className="financial-panel balance-filters">
        <label className="filter-field balance-filter balance-filter--month" htmlFor="balance-period">
          <span>Corte</span>
          <select
            id="balance-period"
            onChange={(event) => setPeriod(event.target.value)}
            value={period}
          >
            {!monthInfo && <option value={period}>{period}</option>}
            {months?.months.map((month) => (
              <option key={month.period} value={month.period}>
                {workMonthOptionLabel(month.period, month.from, month.to)}
                {month.current ? ' (en curso)' : ''}
              </option>
            ))}
          </select>
        </label>
        <Switch
          label="Ver por"
          onChange={setViewBy}
          options={[
            ['branch', 'Sucursal'],
            ['partner', 'Socio'],
          ]}
          value={viewBy}
        />
        <label className="filter-field balance-filter" htmlFor="balance-branch">
          <span>Sucursal</span>
          <select
            disabled={!data}
            id="balance-branch"
            onChange={(event) => setScope(event.target.value)}
            value={activeScope}
          >
            <option value={ALL_BRANCHES}>Todas</option>
            {data?.branches.map((branch) => (
              <option key={branch.key} value={branch.key}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <Switch
          label="Moneda"
          onChange={setCurrency}
          options={[
            ['ARS', 'Pesos'],
            ['USD', 'Dólares'],
          ]}
          value={currency}
        />
        {viewBy === 'branch' && (
          <Switch
            label="Motos y autos comprados"
            onChange={setMode}
            options={[
              ['cogs', 'Restar lo vendido'],
              ['none', 'Dejar afuera'],
            ]}
            value={mode}
          />
        )}
      </section>

      {status === 'loading' && (
        <section className="financial-panel">
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando balance…</span>
          </div>
        </section>
      )}

      {status === 'error' && (
        <section className="financial-panel">
          <StatePanel
            action={
              <button className="button button--primary" onClick={() => setRefreshKey((key) => key + 1)} type="button">
                <RefreshCw size={17} />
                Reintentar
              </button>
            }
            description={loadError}
            icon={Scale}
            title="No pudimos cargar el balance"
            tone="danger"
          />
        </section>
      )}

      {status === 'success' && data && byBranch && byPartner && table && (
        <>
          <p className="financial-summary-note">
            {monthLabel}
            {data.current ? ' (en curso)' : ''}.
            {monthInfo?.cutDate ? ` Corte del ${formatDay(monthInfo.cutDate)}.` : ' Sin corte: termina el último día del mes.'}
            {data.current && ' Lo que se cargue hasta el corte va a sumar acá.'}
          </p>

          {viewBy === 'partner' && (
            <div className="balance-callout">
              <strong>Lo que movió la caja de cada socio, no lo que ganó cada uno.</strong>
              <span>
                Suma lo que se cobró en las cajas de cada socio y lo que se pagó desde ellas, en este
                corte. “Sin caja” es lo que todavía no se cobró o no se pagó, o se cargó sin caja. El
                costo de lo vendido no se reparte por socio: la unidad se compra desde una caja y se
                cobra en otra.
              </span>
            </div>
          )}

          {viewBy === 'branch' && mode === 'cogs' && byBranch.unitsWithoutCost > 0 && (
            <div className="balance-callout balance-callout--warning" role="status">
              <AlertTriangle aria-hidden="true" size={18} />
              <span>
                {byBranch.unitsWithoutCost === 1
                  ? 'Una unidad vendida en este corte no tiene costo cargado'
                  : `${byBranch.unitsWithoutCost} unidades vendidas en este corte no tienen costo cargado`}
                : el costo de lo vendido queda corto y el resultado, más alto. Se carga en la compra al
                proveedor o en la ficha de la unidad.
              </span>
            </div>
          )}

          <section className="kpi-grid" aria-label="Resumen">
            {viewBy === 'branch' ? (
              <>
                <KpiCard icon={ArrowUpCircle} label="Ingresos" meta="Ventas, patentes, cuotas y otros" value={money(byBranch.income)} />
                <KpiCard
                  icon={ArrowDownCircle}
                  label="Egresos"
                  meta={mode === 'cogs' ? 'Gastos, comisiones y costo de lo vendido' : 'Gastos y comisiones'}
                  value={money(-(byBranch.expenses + byBranch.costOfSales))}
                />
                <KpiCard
                  icon={Scale}
                  label={mode === 'cogs' ? 'Resultado del mes' : 'Ingresos menos egresos'}
                  meta={mode === 'cogs' ? 'Lo que les quedó en el mes' : 'Sin descontar lo que costaron las unidades'}
                  metaTone={byBranch.result < 0 ? 'negative' : 'positive'}
                  value={money(byBranch.result)}
                />
                <KpiCard
                  icon={Clock}
                  label="Falta cobrar"
                  meta={
                    currency === 'USD'
                      ? 'Se calcula sólo en pesos'
                      : byBranch.pendingSales.operations
                        ? `${byBranch.pendingSales.operations} ${byBranch.pendingSales.operations === 1 ? 'venta' : 'ventas'} de este corte con saldo`
                        : 'Todo cobrado'
                  }
                  value={currency === 'USD' ? '—' : money(byBranch.pendingSales.amount)}
                />
              </>
            ) : (
              <>
                {byPartner.partners.map((partner) => (
                  <KpiCard
                    icon={partner.key === NO_ACCOUNT ? Clock : WalletCards}
                    key={partner.key}
                    label={partner.name}
                    meta={
                      partner.key === NO_ACCOUNT
                        ? `Sin cobrar ${money(partner.collected)} · sin pagar ${money(partner.paid)}`
                        : `Cobró ${money(partner.collected)} · pagó ${money(partner.paid)}`
                    }
                    value={money(partner.net)}
                  />
                ))}
              </>
            )}
          </section>

          <section aria-label={viewBy === 'branch' ? 'Detalle por sucursal' : 'Detalle por socio'} className="financial-panel">
            <div className="balance-panel-head">
              <h2>{viewBy === 'branch' ? 'Detalle por sucursal' : 'Detalle por socio'}</h2>
              <span>{currency === 'ARS' ? 'En pesos.' : 'En dólares.'} Pesos y dólares no se suman.</span>
            </div>
            {data.entries.length === 0 && data.sales.units === 0 ? (
              <p className="financial-empty-note">Todavía no hay nada cargado en este corte.</p>
            ) : (
              <BalanceGrid
                caption={viewBy === 'branch' ? 'Balance por sucursal' : 'Balance por socio'}
                currency={currency}
                table={table}
              />
            )}
          </section>

          {viewBy === 'branch' && (
            <section className="balance-cards" aria-label="Más información">
              <article className="financial-panel balance-card">
                <h3>Pendiente de este corte</h3>
                <p>Todavía no entró o no se pagó. Cuando entre o se pague, queda en este mismo mes.</p>
                <dl>
                  <div>
                    <dt>Falta cobrar de las ventas</dt>
                    <dd>{currency === 'USD' ? '—' : money(byBranch.pendingSales.amount)}</dd>
                  </div>
                  <div>
                    <dt>Gastos sin pagar (ya restados arriba)</dt>
                    <dd>{money(byBranch.unpaidExpenses)}</dd>
                  </div>
                </dl>
              </article>
              <article className="financial-panel balance-card">
                <h3>Motos y autos comprados</h3>
                <dl>
                  <div>
                    <dt>Compras a proveedores en este corte</dt>
                    <dd>{money(byBranch.purchases)}</dd>
                  </div>
                </dl>
                <p>
                  {mode === 'cogs'
                    ? 'No restan el mes en que se compran: son stock. Restan cuando se venden, por lo que costaron (renglón “Costo de lo vendido”).'
                    : 'Quedan afuera del balance: son stock. Se muestran acá sólo como dato.'}
                </p>
              </article>
              <article className="financial-panel balance-card">
                <h3>¿Y la caja?</h3>
                <p>
                  El balance dice cómo les fue en el mes. La plata real, el día que entró o salió, está
                  en Auditoría → Movimientos de dinero. No tienen por qué dar igual: la financiera de
                  una venta del 25/10 que acredita el 30/10 está en el balance del mes de la venta y en
                  la caja del 30/10.
                </p>
              </article>
            </section>
          )}
        </>
      )}
    </>
  )
}
