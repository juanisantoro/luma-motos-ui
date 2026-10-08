import { describe, expect, it, vi } from 'vitest'
import { buildSheet, EXCEL_MAX_ROWS, fetchAllPages } from './excel'

type Row = { date: string; client: string; amount: string | null }

const columns = [
  { header: 'Fecha', value: (row: Row) => row.date, type: 'date' as const },
  { header: 'Cliente', value: (row: Row) => row.client },
  { header: 'Importe', value: (row: Row) => row.amount, type: 'money' as const },
]

describe('exportación a Excel', () => {
  it('arma título, fecha, filtros, encabezado fijo y una fila por registro', () => {
    const sheet = buildSheet(
      {
        fileName: 'Ingresos de motos',
        title: 'Ingresos de motos',
        filters: ['Estado: Pendiente', null, '', false],
        columns,
        rows: [
          { date: '2026-10-01', client: 'Ana', amount: '1250.50' },
          { date: '2026-10-02', client: 'José', amount: null },
        ],
      },
      new Date(2026, 9, 8, 9, 5),
    )

    expect(sheet.fileName).toBe('Ingresos de motos 2026-10-08.xlsx')
    expect(sheet.data[0]?.[0]).toMatchObject({ value: 'Ingresos de motos' })
    expect(sheet.data[1]?.[0]).toMatchObject({
      value: 'Generado el 08/10/2026 09:05 · 2 registros',
    })
    expect(sheet.data[2]?.[0]).toMatchObject({ value: 'Filtros: Estado: Pendiente' })
    // Encabezado en la fila 5, que queda fija al desplazarse.
    expect(sheet.stickyRowsCount).toBe(5)
    expect(sheet.data[4]?.map((cell) => cell?.value)).toEqual(['Fecha', 'Cliente', 'Importe'])
    const [date, client, amount] = sheet.data[5] ?? []
    expect(date).toMatchObject({ type: Date, format: 'dd/mm/yyyy' })
    expect((date as { value: Date }).value.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(client).toMatchObject({ type: String, value: 'Ana' })
    expect(amount).toMatchObject({ type: Number, value: 1250.5, format: '#,##0.00' })
    // Un importe vacío queda como celda vacía, no como 0.
    expect(sheet.data[6]?.[2]).toBeNull()
  })

  it('avisa cuando la exportación se cortó en el máximo', () => {
    const sheet = buildSheet({
      fileName: 'x',
      title: 'Clientes',
      columns,
      rows: [{ date: '2026-10-01', client: 'Ana', amount: '1' }],
      total: 25_000,
    })
    expect(sheet.data[1]?.[0]?.value).toContain(
      `1 de 25000 registros (se exportan como máximo ${EXCEL_MAX_ROWS})`,
    )
    expect(sheet.data[2]?.[0]?.value).toBe('Filtros: ninguno')
  })

  it('pide todas las páginas con el mismo filtro', async () => {
    const load = vi.fn(async (page: number, limit: number) => ({
      items: Array.from({ length: page < 3 ? limit : 7 }, (_, index) => page * 1000 + index),
      total: limit * 2 + 7,
    }))
    const result = await fetchAllPages(load)
    expect(load.mock.calls.map(([page, limit]) => [page, limit])).toEqual([
      [1, 100],
      [2, 100],
      [3, 100],
    ])
    expect(result.items).toHaveLength(207)
    expect(result.total).toBe(207)
  })
})

describe('describeFilters', () => {
  it('describe los filtros cargados con los textos que ve el usuario', async () => {
    const { describeFilters } = await import('./excel')
    document.body.innerHTML = `
      <form id="filters">
        <div class="filter-field"><label for="f-search">Buscar</label><input id="f-search" value="Ana" /></div>
        <div class="filter-field"><label for="f-status">Estado</label>
          <select id="f-status"><option value="">Todos</option><option value="P" selected>Pendiente</option></select></div>
        <div class="filter-field"><label for="f-branch">Sucursal</label>
          <select id="f-branch"><option value="">Todas</option><option value="b1">San Miguel</option></select></div>
        <label class="field"><span>Desde *</span><input type="date" value="2026-10-01" /></label>
        <label class="field"><span>Mes</span><input type="month" value="2026-09" /></label>
        <label><input type="checkbox" checked /> Sólo recuperables</label>
        <button type="submit">Aplicar</button>
      </form>`
    expect(describeFilters(document.getElementById('filters'))).toEqual([
      'Buscar: Ana',
      'Estado: Pendiente',
      'Desde: 01/10/2026',
      'Mes: 09/2026',
      'Sólo recuperables',
    ])
  })
})
