import { workMonthRangeLabel, type WorkMonths } from './workMonths'

/**
 * Debajo de un selector de mes: de qué día a qué día va ese mes de trabajo.
 * No muestra nada si el mes es el de almanaque o no se conocen los cortes.
 */
export function WorkMonthHint({ months, period }: { months: WorkMonths | null; period: string }) {
  const month = months?.months.find((item) => item.period === period)
  if (!month) return null
  const [year, monthNumber] = period.split('-').map(Number)
  const calendarEnd = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate()
  const isCalendar =
    month.from === `${period}-01` && month.to === `${period}-${String(calendarEnd).padStart(2, '0')}`
  if (isCalendar) return null
  return <small className="work-month-hint">Mes de trabajo {workMonthRangeLabel(months, period)}</small>
}
