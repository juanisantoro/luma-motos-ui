import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditPage } from './AuditPage'
import { cashMovement, handoverEvent, operationTrace } from './fixtures'

const mocks = vi.hoisted(() => ({
  filters: vi.fn(),
  events: vi.fn(),
  movements: vi.fn(),
  trace: vi.fn(),
  alertError: vi.fn(),
  download: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../shared/export/excel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/export/excel')>()),
  downloadExcel: mocks.download,
}))

type ExportCall = {
  title: string
  fileName: string
  filters: unknown[]
  rows: Array<{ id?: string }>
  total?: number
  columns: Array<{ header: string; type?: string }>
}

function exported(index = 0) {
  return (mocks.download.mock.calls[index] as unknown as [ExportCall])[0]
}

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  getAuditFilters: mocks.filters,
  listAuditEvents: mocks.events,
  listMoneyMovements: mocks.movements,
  getOperationTrace: mocks.trace,
}))

vi.mock('../../shared/alerts', () => ({ alertError: mocks.alertError }))

const filters = {
  categories: [
    { code: 'VENTAS', label: 'Ventas' },
    { code: 'DINERO', label: 'Dinero y caja' },
  ],
  actions: [
    { code: 'INCOME_UPDATED', label: 'Ingreso modificado', category: 'DINERO' },
    { code: 'SALES_OPERATION_APPROVED', label: 'Venta aprobada', category: 'VENTAS' },
  ],
  actors: [
    { id: 'user-2', email: 'carla@luma.test', name: 'Carla Caja', active: true },
  ],
  accounts: [
    {
      id: 'account-1',
      name: 'Caja Lucas',
      currency: 'ARS',
      branchId: 'branch-1',
      active: true,
    },
    {
      id: 'account-2',
      name: 'Caja Lucas Del Viso',
      currency: 'ARS',
      branchId: 'branch-2',
      active: true,
    },
  ],
  branches: [
    { id: 'branch-1', code: 'SM', name: 'San Miguel' },
    { id: 'branch-2', code: 'DV', name: 'Del Viso' },
  ],
}

describe('AuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.filters.mockResolvedValue(filters)
    mocks.events.mockResolvedValue({
      items: [handoverEvent],
      total: 1,
      page: 1,
      limit: 50,
    })
    mocks.movements.mockResolvedValue({
      items: [cashMovement],
      total: 1,
      page: 1,
      limit: 50,
      totals: [
        { currency: 'ARS', credit: '150000.5', debit: '0' },
        { currency: 'USD', credit: '800', debit: '50' },
      ],
      summary: [
        {
          account: { id: 'account-1', name: 'Caja Lucas', type: 'SOCIO' },
          branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
          currency: 'ARS',
          credit: '150000.5',
          debit: '30000',
          pendingHandover: '20000',
        },
      ],
    })
    mocks.trace.mockResolvedValue(operationTrace)
  })

  it('lists the activity with date and time, who did it and on what', async () => {
    render(<AuditPage />)

    const table = await screen.findByRole('table')
    const row = within(table).getAllByRole('row')[1]!
    expect(within(row).getByText('04/10/2026 12:30:12')).toBeInTheDocument()
    expect(within(row).getByText('Carla Caja')).toBeInTheDocument()
    expect(within(row).getByText('Administrativa · San Miguel')).toBeInTheDocument()
    expect(within(row).getByText('Ingreso modificado')).toBeInTheDocument()
    expect(within(row).getByText('Ingreso: SEÑA')).toBeInTheDocument()
    expect(within(row).getByText('Venta N.º 120')).toBeInTheDocument()
    expect(mocks.events.mock.calls[0]![0]).toMatchObject({ page: 1, limit: 50 })
  })

  it('applies the filters on search', async () => {
    const user = userEvent.setup()
    render(<AuditPage />)
    await screen.findByRole('table')

    await user.selectOptions(await screen.findByLabelText('Módulo'), 'DINERO')
    const actions = screen.getByLabelText('Acción')
    expect(within(actions).queryByText('Venta aprobada')).not.toBeInTheDocument()
    await user.selectOptions(actions, 'INCOME_UPDATED')
    await user.selectOptions(screen.getByLabelText('Usuario'), 'user-2')
    await user.type(screen.getByLabelText('N.º de operación'), '120')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() =>
      expect(mocks.events.mock.calls.at(-1)![0]).toMatchObject({
        page: 1,
        category: 'DINERO',
        action: 'INCOME_UPDATED',
        actorId: 'user-2',
        operationNumber: '120',
      }),
    )
  })

  it('shows before and after in the event detail', async () => {
    const user = userEvent.setup()
    render(<AuditPage />)

    await user.click(
      await screen.findByRole('button', { name: /Ver detalle de Ingreso modificado/ }),
    )

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('10.0.0.1')).toBeInTheDocument()
    const amountRow = within(dialog).getByText('Importe', { selector: 'td' })
      .parentElement!
    expect(amountRow).toHaveTextContent(/120\.000,00/)
    expect(amountRow).toHaveTextContent(/150\.000,50/)
    expect(amountRow).toHaveClass('audit-diff__changed')
  })

  it('opens the history of a sale with who requested and who approved', async () => {
    const user = userEvent.setup()
    render(<AuditPage />)

    await user.click(
      await screen.findByRole('button', { name: 'Ver historial de la venta 120' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('heading', {
        name: 'Venta N.º 120 · Juan Pérez',
      }),
    ).toBeInTheDocument()
    expect(mocks.trace).toHaveBeenCalledWith('operation-1', expect.anything())
    expect(
      within(dialog).getByText(/Vera Vendedora el 01\/10\/2026 11:05:00/),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/Gerardo Gerente el 01\/10\/2026 13:20:00/),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/Importe: .*120\.000,00 → .*150\.000,50/),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Rendido a Lucas. Confirmó Lucas el 04/10/2026 15:00:00',
      ),
    ).toBeInTheDocument()
  })

  it('lists money movements with totals, who registered and the handover', async () => {
    const user = userEvent.setup()
    render(<AuditPage />)

    await user.click(screen.getByRole('tab', { name: 'Movimientos de dinero' }))

    const table = within(
      await screen.findByRole('region', { name: 'Movimientos de dinero' }),
    ).getByRole('table')
    const row = within(table).getAllByRole('row')[1]!
    expect(within(row).getByText('03/10/2026')).toBeInTheDocument()
    expect(
      within(row).getByText('Cargado el 04/10/2026 12:30:12'),
    ).toBeInTheDocument()
    expect(within(row).getByText('Caja Lucas')).toBeInTheDocument()
    expect(within(row).getByText('Vera Vendedora')).toBeInTheDocument()
    expect(within(row).getByText('Vigente')).toBeInTheDocument()
    expect(
      within(row).getByText('Rendido a Lucas. Confirmó Lucas el 04/10/2026 15:00:00'),
    ).toBeInTheDocument()
    const totals = screen.getByRole('region', { name: 'Totales del filtro' })
    expect(within(totals).getByText('Entradas vigentes (ARS)')).toBeInTheDocument()
    expect(within(totals).getByText('Salidas vigentes (USD)')).toBeInTheDocument()

    // Resumen para el cierre: una fila por caja con su sucursal y el neto.
    const summary = screen.getByRole('region', { name: 'Resumen por caja' })
    const summaryRow = within(summary).getAllByRole('row')[1]!
    expect(summaryRow).toHaveTextContent('San Miguel')
    expect(summaryRow).toHaveTextContent('Caja Lucas')
    expect(summaryRow).toHaveTextContent(/120\.000,50/)
    expect(summaryRow).toHaveTextContent(/20\.000,00/)

    // Al elegir sucursal, la lista de cuentas se acota a esa sucursal.
    await user.selectOptions(screen.getByLabelText('Sucursal'), 'branch-2')
    expect(
      within(screen.getByLabelText('Cuenta'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Todas', 'Caja Lucas Del Viso'])
    expect(screen.getByLabelText('Cuenta')).toHaveTextContent('Caja Lucas Del Viso')

    await user.click(screen.getByLabelText('Sólo reversados y reversas'))
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(mocks.movements.mock.calls.at(-1)![0]).toMatchObject({
        onlyReversals: true,
        branchId: 'branch-2',
        page: 1,
      }),
    )
  })

  it('exporta a Excel toda la actividad del filtro, pidiendo todas las páginas', async () => {
    const user = userEvent.setup()
    render(<AuditPage />)
    await screen.findByRole('table')

    await user.selectOptions(await screen.findByLabelText('Módulo'), 'DINERO')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(mocks.events.mock.calls.at(-1)![0]).toMatchObject({ category: 'DINERO' }),
    )
    await screen.findByRole('table')

    const second = { ...handoverEvent, id: 'event-2' }
    mocks.events.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve({
        items: page === 1 ? Array.from({ length: 100 }, () => handoverEvent) : [second],
        total: 101,
        page,
        limit: 100,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Exportar a Excel' }))

    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1))
    const pages = mocks.events.mock.calls.slice(-2).map(([query]) => query)
    expect(pages).toEqual([
      expect.objectContaining({ page: 1, limit: 100, category: 'DINERO' }),
      expect.objectContaining({ page: 2, limit: 100, category: 'DINERO' }),
    ])
    const options = exported()
    expect(options.title).toBe('Auditoría · Actividad')
    expect(options.rows).toHaveLength(101)
    expect(options.rows.at(-1)).toBe(second)
    expect(options.total).toBe(101)
    expect(options.filters).toContain('Módulo: Dinero y caja')
    expect(options.columns.map((column) => column.header)).toEqual([
      'Fecha y hora',
      'Usuario',
      'Correo',
      'Rol',
      'Sucursal',
      'Módulo',
      'Acción',
      'Sobre qué',
      'Detalle',
      'Importe',
      'N.º operación',
      'IP',
    ])
  })

  it('exporta a Excel los movimientos de dinero y el resumen por caja', async () => {
    const user = userEvent.setup()
    render(<AuditPage />)
    await user.click(screen.getByRole('tab', { name: 'Movimientos de dinero' }))
    await screen.findByRole('region', { name: 'Movimientos de dinero' })

    const first = await (mocks.movements.mock.results[0]!.value as Promise<{
      summary: unknown[]
    }>)
    mocks.movements.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve({
        ...first,
        items: page === 1 ? Array.from({ length: 100 }, () => cashMovement) : [cashMovement],
        total: 101,
        page,
        limit: 100,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Exportar a Excel' }))
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1))
    expect(mocks.movements.mock.calls.slice(-2).map(([query]) => query.page)).toEqual([1, 2])
    expect(exported().title).toBe('Auditoría · Movimientos de dinero')
    expect(exported().rows).toHaveLength(101)
    expect(
      exported()
        .columns.filter((column) => column.type === 'money')
        .map((column) => column.header),
    ).toEqual(['Entrada', 'Salida'])

    await user.click(screen.getByRole('button', { name: 'Exportar resumen' }))
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(2))
    expect(exported(1).title).toBe('Auditoría · Resumen por caja')
    expect(exported(1).rows).toEqual(first.summary)
    expect(exported(1).columns.map((column) => column.header)).toEqual([
      'Sucursal',
      'Caja',
      'Moneda',
      'Entradas',
      'Salidas',
      'Neto',
      'Pendiente de rendir',
    ])
  })

  it('exporta a Excel el dinero de una venta desde su historial', async () => {
    const user = userEvent.setup()
    render(<AuditPage />)
    await user.click(
      await screen.findByRole('button', { name: 'Ver historial de la venta 120' }),
    )
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('heading', { name: 'Venta N.º 120 · Juan Pérez' })

    await user.click(
      within(dialog).getByRole('button', { name: 'Exportar dinero a Excel' }),
    )
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1))
    expect(exported().title).toBe('Dinero de la venta N.º 120')
    expect(exported().rows).toEqual(operationTrace.movements)
  })

  it('disables the export when there is nothing to export', async () => {
    mocks.events.mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 })
    render(<AuditPage />)
    await screen.findByText('No hay registros para esos filtros')
    expect(screen.getByRole('button', { name: 'Exportar a Excel' })).toBeDisabled()
  })

  it('offers a retry when the audit cannot be loaded', async () => {
    mocks.events.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(<AuditPage />)

    expect(
      await screen.findByText('No pudimos cargar la auditoría'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})
