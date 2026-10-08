// Exportación a Excel (.xlsx) de cualquier grilla.
//
// Cada pantalla define sus columnas (encabezado + cómo sacar el valor de una
// fila) y pasa TODAS las filas que trae el filtro, no sólo la página visible:
// para las grillas paginadas en el servidor, `fetchAllPages` las pide de a
// páginas con el mismo filtro.
//
// La librería se carga recién al exportar, para no sumar peso a la app.

export type ExcelCellType = 'text' | 'number' | 'integer' | 'money' | 'date' | 'datetime'

export type ExcelValue = string | number | boolean | Date | null | undefined

export type ExcelColumn<T> = {
  header: string
  value: (row: T) => ExcelValue
  // Por defecto, texto. Fechas: aceptan 'YYYY-MM-DD' o ISO completo.
  type?: ExcelCellType
  // Ancho en caracteres; si no se indica se calcula con el contenido.
  width?: number
}

export type ExcelExport<T> = {
  // Sin extensión ni fecha: se agregan solas ("Ingresos de motos" →
  // "Ingresos de motos 2026-10-08.xlsx").
  fileName: string
  title: string
  // Filtros aplicados, ya en texto ("Estado: Pendiente"). Vacíos se omiten.
  filters?: Array<string | null | undefined | false>
  columns: Array<ExcelColumn<T>>
  rows: T[]
  // Si la exportación se cortó en el máximo de filas, cuántas había en total.
  total?: number
}

// Tope de filas por exportación: más de esto ya no es una grilla que alguien
// revise a mano y la descarga se vuelve lenta.
export const EXCEL_MAX_ROWS = 10_000
const PAGE_SIZE = 100

/**
 * Pide todas las páginas de una grilla paginada en el servidor, con el mismo
 * filtro, hasta `EXCEL_MAX_ROWS`.
 */
export async function fetchAllPages<T>(
  load: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
  pageSize = PAGE_SIZE,
): Promise<{ items: T[]; total: number }> {
  const items: T[] = []
  let total = 0
  for (let page = 1; items.length < EXCEL_MAX_ROWS; page += 1) {
    const result = await load(page, pageSize)
    total = result.total
    items.push(...result.items)
    if (result.items.length < pageSize || items.length >= total) break
  }
  return { items: items.slice(0, EXCEL_MAX_ROWS), total }
}

const MONEY_FORMAT = '#,##0.00'
const INTEGER_FORMAT = '#,##0'
const DATE_FORMAT = 'dd/mm/yyyy'
const DATETIME_FORMAT = 'dd/mm/yyyy hh:mm'
const HEADER_FILL = '#F1F2F4'
const BORDER = '#D5D9DE'

function toDate(value: ExcelValue, withTime: boolean): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string' || !value) return null
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10))
  if (!day) return null
  if (!withTime || value.length <= 10) {
    // Fecha de negocio: sin huso, para que Excel muestre el mismo día.
    return new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])))
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  // Hora de Argentina expresada como UTC: Excel no guarda husos.
  const local = new Date(parsed.getTime() - 3 * 60 * 60 * 1000)
  return local
}

function toNumber(value: ExcelValue): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function displayLength(value: ExcelValue, type: ExcelCellType) {
  if (value === null || value === undefined) return 0
  if (type === 'date') return 10
  if (type === 'datetime') return 16
  if (type === 'money' || type === 'number' || type === 'integer') {
    const number = toNumber(value)
    return number === null ? 0 : Math.round(Math.abs(number)).toString().length * 1.35 + 4
  }
  return String(value).length
}

type Cell = Record<string, unknown> | null

function cellFor(value: ExcelValue, type: ExcelCellType): Cell {
  if (value === null || value === undefined || value === '') return null
  if (type === 'date' || type === 'datetime') {
    const date = toDate(value, type === 'datetime')
    return date
      ? { type: Date, value: date, format: type === 'date' ? DATE_FORMAT : DATETIME_FORMAT }
      : { type: String, value: String(value) }
  }
  if (type === 'money' || type === 'number' || type === 'integer') {
    const number = toNumber(value)
    if (number === null) return { type: String, value: String(value) }
    const format = type === 'money' ? MONEY_FORMAT : type === 'integer' ? INTEGER_FORMAT : undefined
    return { type: Number, value: number, ...(format ? { format } : {}), align: 'right' }
  }
  if (typeof value === 'boolean') return { type: String, value: value ? 'Sí' : 'No' }
  if (value instanceof Date) return { type: Date, value, format: DATE_FORMAT }
  return { type: String, value: String(value) }
}

function timestamp(now: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    file: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    label: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
}

/** Arma la hoja: título, fecha y filtros arriba; encabezado fijo; filas. */
export function buildSheet<T>(options: ExcelExport<T>, now = new Date()) {
  const { columns, rows } = options
  const stamp = timestamp(now)
  const span = Math.max(1, columns.length)
  const total = options.total ?? rows.length
  const count =
    total > rows.length
      ? `${rows.length} de ${total} registros (se exportan como máximo ${EXCEL_MAX_ROWS})`
      : `${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`
  const filters = (options.filters ?? []).filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  )
  const banner = (value: string, style: Record<string, unknown> = {}) => [
    { type: String, value, columnSpan: span, ...style },
    ...Array.from({ length: span - 1 }, () => null),
  ]
  const data: Cell[][] = [
    banner(options.title, { fontWeight: 'bold', fontSize: 14 }),
    banner(`Generado el ${stamp.label} · ${count}`, { textColor: '#5F6773' }),
  ]
  data.push(
    banner(filters.length ? `Filtros: ${filters.join(' · ')}` : 'Filtros: ninguno', {
      textColor: '#5F6773',
      wrap: true,
    }),
  )
  data.push([])
  const headerRow = data.length + 1
  data.push(
    columns.map((column) => ({
      type: String,
      value: column.header,
      fontWeight: 'bold',
      backgroundColor: HEADER_FILL,
      bottomBorderStyle: 'thin',
      bottomBorderColor: BORDER,
      wrap: true,
      alignVertical: 'center',
      ...(column.type && column.type !== 'text' ? { align: 'right' } : {}),
    })),
  )
  for (const row of rows) {
    data.push(columns.map((column) => cellFor(column.value(row), column.type ?? 'text')))
  }
  const widths = columns.map((column) => {
    if (column.width) return { width: column.width }
    const longest = rows.reduce(
      (max, row) => Math.max(max, displayLength(column.value(row), column.type ?? 'text')),
      column.header.length,
    )
    return { width: Math.min(60, Math.max(8, Math.ceil(longest) + 2)) }
  })
  return {
    data,
    columns: widths,
    stickyRowsCount: headerRow,
    fileName: `${safeFileName(options.fileName)} ${stamp.file}.xlsx`,
  }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Genera el .xlsx y lo descarga en el navegador. */
export async function downloadExcel<T>(options: ExcelExport<T>) {
  const sheet = buildSheet(options)
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  const blob = await writeExcelFile(sheet.data as never, {
    columns: sheet.columns,
    stickyRowsCount: sheet.stickyRowsCount,
    sheet: options.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '),
  } as never, { fontFamily: 'Calibri', fontSize: 11 } as never).toBlob()
  saveBlob(blob, sheet.fileName)
}

function controlLabel(control: HTMLElement): string {
  const id = control.getAttribute('id')
  const byFor = id
    ? control.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)
    : null
  const wrapper = control.closest('label')
  const field = control.closest('.filter-field, .field')
  const source =
    byFor ??
    wrapper?.querySelector('span') ??
    wrapper ??
    field?.querySelector('label, span') ??
    null
  const text =
    source?.textContent ?? control.getAttribute('aria-label') ?? control.getAttribute('placeholder') ?? ''
  return text.replace(/\*/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Describe en texto los filtros cargados en un panel de filtros ("Estado:
 * Pendiente", "Desde: 01/10/2026"), leyendo lo que muestra cada control: así
 * los nombres de sucursal, caja o proveedor salen como los ve el usuario.
 * Se ignoran los controles vacíos o en "Todos".
 */
export function describeFilters(root: HTMLElement | null | undefined): string[] {
  if (!root) return []
  const result: string[] = []
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((control) => {
    if (control.disabled && !(control instanceof HTMLSelectElement)) return
    const label = controlLabel(control)
    if (control instanceof HTMLSelectElement) {
      if (!control.value) return
      const text = control.selectedOptions[0]?.textContent?.trim()
      // "Todos", "Todas las sucursales", "Todos los estados": sin filtro.
      if (!text || /^(todos|todas)\b/i.test(text)) return
      result.push(label ? `${label}: ${text}` : text)
      return
    }
    const type = control.type
    if (['hidden', 'submit', 'button', 'reset'].includes(type)) return
    if (type === 'checkbox' || type === 'radio') {
      if (control.checked && label) result.push(label)
      return
    }
    const value = control.value.trim()
    if (!value) return
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    const shown = day ? `${day[3]}/${day[2]}/${day[1]}` : /^(\d{4})-(\d{2})$/.test(value) ? `${value.slice(5)}/${value.slice(0, 4)}` : value
    result.push(label ? `${label}: ${shown}` : shown)
  })
  return result
}
