import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OperationsPage } from './OperationsPage'
import { licensingFixture, operationFixture } from './licensing.fixtures'

const mocks = vi.hoisted(() => ({
  roleCode: 'ADMINISTRATIVA',
  permissions: [] as string[],
  listOperations: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      globalAccess: false,
      organization: { id: 'org-1', name: 'Luma', code: 'LUMA_CENTRAL' },
      branch: null,
      role: { code: mocks.roleCode, permissions: mocks.permissions },
    },
  }),
}))

vi.mock('./api', () => ({
  listSalesOperations: mocks.listOperations,
  releaseSalesReservation: vi.fn(),
  updateSalesLicensing: vi.fn(),
}))

vi.mock('../../shared/alerts', () => ({
  alertSuccess: vi.fn(() => Promise.resolve()),
  alertError: vi.fn(() => Promise.resolve()),
}))

function PaymentsProbe() {
  const location = useLocation()
  return <p>Pagos de vehículo {location.search}</p>
}

function renderPage(mine = false, initialEntry = '/motos/operaciones') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/motos/operaciones"
          element={<OperationsPage mine={mine} vehicleType="MOTO" />}
        />
        <Route path="/motos/pagos-vehiculo" element={<PaymentsProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.roleCode = 'ADMINISTRATIVA'
  mocks.permissions = [
    'ventas.consultar',
    'ventas.patentamiento.gestionar',
    'ingresos.gestionar',
  ]
  mocks.listOperations.mockResolvedValue({
    items: [
      operationFixture({
        licensing: licensingFixture({ overdue: true }),
      }),
      operationFixture({
        id: 'operation-2',
        number: '106',
        ticketNumber: null,
        licensing: licensingFixture({
          mode: null,
          amount: null,
          status: 'SIN_DEFINIR',
          estimatedFrom: null,
          estimatedTo: null,
        }),
      }),
    ],
    total: 2,
    page: 1,
    limit: 20,
  })
})

describe('Patentamiento en la grilla administrativa', () => {
  it('muestra la columna, resalta demoradas y el número de boleto', async () => {
    renderPage()
    const table = await screen.findByRole('table')
    expect(
      within(table).getByRole('columnheader', { name: 'Patentamiento' }),
    ).toBeInTheDocument()
    // El detalle de cada venta está en el acordeón: se despliegan todas.
    await userEvent.click(
      within(table).getByRole('button', { name: 'Desplegar todas' }),
    )
    const [, overdueRow, overdueDetail, undefinedRow, undefinedDetail] =
      within(table).getAllByRole('row')
    expect(overdueRow).toHaveClass('sales-row--licensing-overdue')
    expect(within(overdueDetail!).getByText('Paga el cliente')).toBeInTheDocument()
    expect(within(overdueDetail!).getByText('Boleto B-0001')).toBeInTheDocument()
    expect(
      within(overdueDetail!).getByText(
        'Patente en trámite, pasó la fecha estimada (estimada entre 11/09/2026 y 18/09/2026)',
      ),
    ).toBeInTheDocument()
    expect(undefinedRow).not.toHaveClass('sales-row--licensing-overdue')
    expect(within(undefinedDetail!).getAllByText('Sin definir')).toHaveLength(2)
  })

  it('filtra por modalidad y por patentes demoradas', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')
    await user.selectOptions(
      screen.getByLabelText('Patentamiento'),
      'PAGA_CLIENTE',
    )
    await waitFor(() =>
      expect(mocks.listOperations).toHaveBeenLastCalledWith(
        expect.objectContaining({ licensingMode: 'PAGA_CLIENTE', page: 1 }),
        expect.anything(),
      ),
    )
    await user.selectOptions(screen.getByLabelText('Patentamiento'), 'DEMORADAS')
    await waitFor(() =>
      expect(mocks.listOperations).toHaveBeenLastCalledWith(
        expect.objectContaining({ licensingOverdue: true }),
        expect.anything(),
      ),
    )
    const lastQuery = mocks.listOperations.mock.lastCall?.[0] as Record<
      string,
      unknown
    >
    expect(lastQuery).not.toHaveProperty('licensingMode')
  })

  it('fase 5: filtra patentes recibidas con el cobro pendiente', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')
    await user.selectOptions(
      screen.getByLabelText('Patentamiento'),
      'COBRO_PENDIENTE',
    )
    await waitFor(() =>
      expect(mocks.listOperations).toHaveBeenLastCalledWith(
        expect.objectContaining({ licensingCollectionPending: true, page: 1 }),
        expect.anything(),
      ),
    )
  })

  it('fase 5: abre filtrada desde el inicio con ?patente=', async () => {
    renderPage(false, '/motos/operaciones?patente=DEMORADAS')
    await screen.findByRole('table')
    expect(mocks.listOperations.mock.calls[0]?.[0]).toMatchObject({
      licensingOverdue: true,
    })
    expect(screen.getByLabelText('Patentamiento')).toHaveValue('DEMORADAS')
  })

  it('fase 5: muestra la patente recibida y su pago pendiente', async () => {
    mocks.listOperations.mockResolvedValue({
      items: [
        operationFixture({
          licensing: licensingFixture({
            plateLoaded: true,
            plate: {
              status: 'RECIBIDA_COBRO_PENDIENTE',
              number: 'A123BCD',
              receivedAt: '2026-09-17',
            },
          }),
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    renderPage()
    expect(
      await screen.findByText('Patente recibida, pago pendiente · A123BCD'),
    ).toBeInTheDocument()
  })

  it('fase 5: "Pago de patente" abre pagos de vehículo con la operación', async () => {
    const user = userEvent.setup()
    mocks.permissions = [...mocks.permissions, 'pagos_vehiculo.gestionar']
    renderPage()
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Registrar pago de patente de la operación #105',
      }),
    )
    expect(
      screen.getByText('Pagos de vehículo ?operacion=operation-1'),
    ).toBeInTheDocument()
  })

  it('fase 5: sin pagos_vehiculo.gestionar no ofrece el pago de patente', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(
      screen.queryByRole('button', {
        name: 'Registrar pago de patente de la operación #105',
      }),
    ).not.toBeInTheDocument()
  })

  it('abre la gestión de patentamiento desde la fila', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Gestionar patentamiento de la operación #105',
      }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Operación #105 · boleto B-0001' }),
    ).toBeInTheDocument()
  })

  it('no muestra patentamiento en Mis operaciones del vendedor', async () => {
    mocks.roleCode = 'VENDEDOR'
    mocks.permissions = ['ventas.consultar', 'ventas.gestionar']
    renderPage(true)
    await screen.findByRole('table')
    expect(
      screen.queryByRole('columnheader', { name: 'Patentamiento' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Patentamiento')).not.toBeInTheDocument()
    expect(mocks.listOperations.mock.calls[0]?.[0]).not.toHaveProperty(
      'licensingMode',
    )
  })
})
