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
}))

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
    { id: 'account-1', name: 'Caja Lucas', currency: 'ARS', active: true },
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

    const table = await screen.findByRole('table')
    const row = within(table).getAllByRole('row')[1]!
    expect(within(row).getByText('04/10/2026 12:30:12')).toBeInTheDocument()
    expect(within(row).getByText('Caja Lucas')).toBeInTheDocument()
    expect(within(row).getByText('Vera Vendedora')).toBeInTheDocument()
    expect(within(row).getByText('Vigente')).toBeInTheDocument()
    expect(
      within(row).getByText('Rendido a Lucas. Confirmó Lucas el 04/10/2026 15:00:00'),
    ).toBeInTheDocument()
    const totals = screen.getByRole('region', { name: 'Totales del filtro' })
    expect(within(totals).getByText('Entradas vigentes (ARS)')).toBeInTheDocument()
    expect(within(totals).getByText('Salidas vigentes (USD)')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Sólo reversados y reversas'))
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(mocks.movements.mock.calls.at(-1)![0]).toMatchObject({
        onlyReversals: true,
        page: 1,
      }),
    )
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
