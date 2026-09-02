const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number | string) {
  const amount = typeof value === 'string' ? Number(value) : value
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

export function formatUnits(value: number) {
  return `${value} ${value === 1 ? 'unidad' : 'unidades'}`
}

/** Percent change from `previous` to `current`, e.g. +12.5% / -8%. */
export function formatMonthDelta(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? '+100%' : '0%'
  const delta = ((current - previous) / previous) * 100
  const rounded = Math.round(delta * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

export function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function greetingFirstName(name: string) {
  return name.split(' ')[0] ?? name
}

export function todayLongLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.valueOf())) return isoDate
  const label = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}
