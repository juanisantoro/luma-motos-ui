import { formatDay, type WorkMonths } from './workMonths'

const monthFormatter = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function workMonthOptionLabel(period: string, from: string, to: string) {
  const [year, month] = period.split('-').map(Number)
  const name = monthFormatter.format(new Date(Date.UTC(year!, month! - 1, 1)))
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} · ${formatDay(from)} al ${formatDay(to)}`
}

/** Para el Excel: "Octubre de 2026 · 28/09 al 27/10", o el período si no se conoce. */
export function workPeriodLabel(months: WorkMonths | null, period: string) {
  const month = months?.months.find((item) => item.period === period)
  return month ? workMonthOptionLabel(month.period, month.from, month.to) : period
}

/**
 * Filtro "Corte": un mes de trabajo, de corte a corte. Convive con los filtros
 * de fecha de almanaque (Mes y año, Desde, Hasta), que siguen igual.
 */
export function WorkMonthSelect({
  id,
  months,
  value,
  onChange,
  className = 'filter-field',
}: {
  id: string
  months: WorkMonths | null
  value: string
  onChange: (period: string) => void
  className?: string
}) {
  return (
    <label className={className} htmlFor={id}>
      <span>Corte</span>
      <select
        aria-label="Corte"
        disabled={!months}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Sin corte</option>
        {months?.months.map((month) => (
          <option key={month.period} value={month.period}>
            {workMonthOptionLabel(month.period, month.from, month.to)}
            {month.current ? ' (en curso)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
