import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { operationFixture } from '../sales/licensing.fixtures'
import { VehiclePaymentsPage } from './VehiclePaymentsPage'
import type { VehiclePayment } from './types'

// Fase 5: búsqueda por boleto, situación de la patente y apertura del
// formulario precargado desde la operación.

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  listPayments: vi.fn(),
  getOperation: vi.fn(),
  updatePayment: vi.fn(),
  listAccounts: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      globalAccess: false,
      organization: { id: 'org-1', name: 'Luma', code: 'LUMA_CENTRAL' },
      branch: null,
      role: { code: 'ADMINISTRATIVA', permissions: mocks.permissions },
    },
  }),
}))
vi.mock('./api', () => ({
  listVehiclePaymentConcepts: vi.fn(() => Promise.resolve([])),
  listVehiclePaymentProviders: vi.fn(() => Promise.resolve([])),
  listVehiclePaymentAccounts: mocks.listAccounts,
  listVehiclePayments: mocks.listPayments,
  updateVehiclePayment: mocks.updatePayment,
  createVehiclePayment: vi.fn(),
  createVehiclePaymentConcept: vi.fn(),
  createVehiclePaymentProvider: vi.fn(),
}))
vi.mock('../sales/api', () => ({
  getSalesOperation: mocks.getOperation,
  listSalesOperations: vi.fn(),
  updateSalesLicensing: vi.fn(),
  collectSalesLicensing: vi.fn(),
  registerSalesLicensePlate: vi.fn(),
}))
vi.mock('../finance/api', () => ({
  listAllSalesOperations: vi.fn(() => Promise.resolve([])),
  listAllCashAccounts: vi.fn(() => Promise.resolve([])),
  listInventoryBranches: vi.fn(() => Promise.resolve([])),
}))
const excel = vi.hoisted(() => ({ download: vi.fn(() => Promise.resolve()) }))
vi.mock('../../shared/export/excel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/export/excel')>()),
  downloadExcel: excel.download,
}))
vi.mock('../../shared/alerts', () => ({
  alertSuccess: vi.fn(() => Promise.resolve()),
  alertError: vi.fn(() => Promise.resolve()),
}))

function payment(overrides: Partial<VehiclePayment> = {}): VehiclePayment {
  return {
    id: 'payment-1',
    date: '2026-09-20',
    status: 'PAGADO',
    month: 9,
    year: 2026,
    notes: null,
    concept: { id: 'concept-patente', name: 'Patente' },
    provider: { id: 'provider-1', name: 'Gestora Carolina' },
    amount: 60000,
    currency: 'ARS',
    vehicleType: 'MOTO',
    branch: { id: 'branch-sm', name: 'San Miguel' },
    account: { id: 'account-juan', name: 'Caja Juan', responsible: 'Juan Capdevila' },
    unit: { id: 'unit-1', vin: 'VIN-001', licensePlate: null },
    vehicle: { vehicleType: 'MOTO', brand: 'Honda', model: 'Wave', version: '110 S' },
    operation: {
      id: 'operation-1',
      number: '105',
      ticketNumber: 'B-0001',
      licensing: {
        mode: 'PAGA_CLIENTE',
        estimatedFrom: '2026-09-11',
        estimatedTo: '2026-09-18',
        overdue: false,
        plate: {
          status: 'RECIBIDA_COBRO_PENDIENTE',
          number: 'A123BCD',
          receivedAt: '2026-09-17',
        },
      },
    },
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
    ...overrides,
  }
}

function renderPage(entry = '/motos/pagos-vehiculo') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <VehiclePaymentsPage vehicleType="MOTO" />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = [
    'pagos_vehiculo.consultar',
    'pagos_vehiculo.gestionar',
    'ventas.consultar',
    'ventas.patentamiento.gestionar',
  ]
  mocks.listPayments.mockResolvedValue({
    items: [payment()],
    total: 1,
    page: 1,
    limit: 20,
  })
  mocks.getOperation.mockResolvedValue(operationFixture())
  mocks.listAccounts.mockResolvedValue([
    { id: 'account-juan', name: 'Caja Juan', responsible: 'Juan Capdevila', currency: 'ARS', branchId: null, own: true },
    { id: 'account-lucas', name: 'Caja Lucas', responsible: 'Lucas', currency: 'ARS', branchId: null, own: false },
  ])
})

describe('Pagos de vehículo (fase 5)', () => {
  it('muestra boleto y situación de la patente, y busca por boleto', async () => {
    const user = userEvent.setup()
    renderPage()
    const table = await screen.findByRole('table')
    const row = within(table).getAllByRole('row')[1]!
    expect(within(row).getByText('Boleto B-0001')).toBeInTheDocument()
    expect(
      within(row).getByText('Patente recibida, pago pendiente'),
    ).toBeInTheDocument()

    const search = screen.getByPlaceholderText(/boleto/)
    await user.type(search, 'B-0001')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(mocks.listPayments).toHaveBeenLastCalledWith(
      'MOTO',
      expect.objectContaining({ search: 'B-0001', page: 1 }),
      expect.anything(),
    )
  })

  it('con ?operacion= abre el formulario precargado', async () => {
    renderPage('/motos/pagos-vehiculo?operacion=operation-1')
    expect(
      await screen.findByRole('dialog', { name: 'Nuevo gasto de motos' }),
    ).toBeInTheDocument()
    expect(mocks.getOperation).toHaveBeenCalledWith(
      'operation-1',
      expect.anything(),
    )
  })

  it('abre la carga de patente de la operación desde la fila', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', { name: 'Patente de la operación #105' }),
    )
    expect(
      await screen.findByRole('dialog', { name: 'Operación #105 · boleto B-0001' }),
    ).toBeInTheDocument()
    // Ya estamos en pagos de vehículo: no ofrece ir a registrar el pago.
    expect(
      screen.queryByRole('button', { name: 'Registrar pago de patente' }),
    ).not.toBeInTheDocument()
  })

  it('muestra la caja que pagó y los gastos generales sin unidad ni proveedor', async () => {
    mocks.listPayments.mockResolvedValue({
      items: [
        payment(),
        payment({
          id: 'payment-2',
          concept: { id: 'concept-lavado', name: 'Lavado' },
          notes: 'Lavado de motos del salón',
          provider: null,
          unit: null,
          vehicle: null,
          operation: null,
        }),
      ],
      total: 2,
      page: 1,
      limit: 20,
    })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Gastos de motos' })).toBeInTheDocument()
    const rows = within(await screen.findByRole('table')).getAllByRole('row')
    expect(within(rows[1]!).getByText('Caja Juan')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Juan Capdevila')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('General · San Miguel')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('Lavado de motos del salón')).toBeInTheDocument()
  })

  it('no deja cambiar el estado de un gasto pagado desde la caja de otro', async () => {
    mocks.listPayments.mockResolvedValue({
      items: [
        payment({ account: { id: 'account-lucas', name: 'Caja Lucas', responsible: 'Lucas' } }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    renderPage()
    await screen.findByRole('table')
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Marcar pendiente' })).toBeDisabled(),
    )
    expect(screen.getByRole('button', { name: 'Marcar pendiente' })).toHaveAttribute(
      'title',
      'Se paga desde Caja Lucas: sólo Lucas puede cambiarlo',
    )
  })

  it('sin cajas propias marca pagado sin preguntar la caja', async () => {
    const user = userEvent.setup()
    mocks.updatePayment.mockResolvedValue(payment())
    mocks.listAccounts.mockResolvedValue([])
    mocks.listPayments.mockResolvedValue({
      items: [payment({ status: 'PENDIENTE', account: null })],
      total: 1,
      page: 1,
      limit: 20,
    })
    renderPage()
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Marcar pagado' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.updatePayment).toHaveBeenCalledWith('payment-1', { status: 'PAGADO' })
  })

  it('pide la caja para marcar pagado un gasto cargado sin caja', async () => {
    const user = userEvent.setup()
    mocks.updatePayment.mockResolvedValue(payment())
    mocks.listPayments.mockResolvedValue({
      items: [payment({ status: 'PENDIENTE', account: null })],
      total: 1,
      page: 1,
      limit: 20,
    })
    renderPage()
    await screen.findByRole('table')
    expect(screen.getByText('Sin caja')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Marcar pagado' }))

    const dialog = await screen.findByRole('dialog', { name: '¿Desde qué caja se pagó?' })
    expect(mocks.updatePayment).not.toHaveBeenCalled()
    expect(within(dialog).queryByRole('option', { name: /Caja Lucas/ })).not.toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText('Caja'), 'account-juan')
    await user.click(within(dialog).getByRole('button', { name: 'Marcar pagado' }))
    expect(mocks.updatePayment).toHaveBeenCalledWith('payment-1', {
      status: 'PAGADO',
      accountId: 'account-juan',
    })
  })

  it('exporta a Excel todas las páginas del filtro aplicado', async () => {
    const user = userEvent.setup()
    mocks.listPayments.mockImplementation(
      (_type: string, query: { page: number; limit: number }) =>
        Promise.resolve({
          items: Array.from({ length: query.limit === 100 && query.page === 2 ? 20 : query.limit === 100 ? 100 : 1 }, (_, index) =>
            payment({ id: `payment-${query.page}-${index}` }),
          ),
          total: 120,
          page: query.page,
          limit: query.limit,
        }),
    )
    renderPage()
    await screen.findByRole('table')
    await user.selectOptions(screen.getByLabelText('Estado'), 'PAGADO')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await user.click(screen.getByRole('button', { name: 'Exportar a Excel' }))

    await vi.waitFor(() => expect(excel.download).toHaveBeenCalledTimes(1))
    const exportCalls = mocks.listPayments.mock.calls.filter(([, query]) => query.limit === 100)
    expect(exportCalls.map(([, query]) => [query.page, query.status])).toEqual([
      [1, 'PAGADO'],
      [2, 'PAGADO'],
    ])
    const [options] = excel.download.mock.calls[0] as unknown as [
      { title: string; rows: unknown[]; filters: unknown[]; columns: Array<{ header: string }> },
    ]
    expect(options.title).toBe('Gastos de motos')
    expect(options.rows).toHaveLength(120)
    expect(options.filters).toContain('Estado: Pagado')
    expect(options.columns.map((column) => column.header)).toEqual(
      expect.arrayContaining(['Caja', 'Pagado por', 'Importe', 'Moneda']),
    )
  })

  it('sin permiso de patentamiento no ofrece la carga de patente', async () => {
    mocks.permissions = ['pagos_vehiculo.consultar', 'pagos_vehiculo.gestionar']
    renderPage()
    await screen.findByRole('table')
    expect(
      screen.queryByRole('button', { name: 'Patente de la operación #105' }),
    ).not.toBeInTheDocument()
  })
})
