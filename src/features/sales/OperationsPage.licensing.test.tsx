import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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

function renderPage(mine = false) {
  return render(
    <MemoryRouter>
      <OperationsPage mine={mine} vehicleType="MOTO" />
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
    const [, overdueRow, undefinedRow] = within(table).getAllByRole('row')
    expect(overdueRow).toHaveClass('sales-row--licensing-overdue')
    expect(within(overdueRow!).getByText('Paga el cliente')).toBeInTheDocument()
    expect(within(overdueRow!).getByText('Boleto B-0001')).toBeInTheDocument()
    expect(
      within(overdueRow!).getByText('Pasó la fecha estimada sin patente'),
    ).toBeInTheDocument()
    expect(undefinedRow).not.toHaveClass('sales-row--licensing-overdue')
    expect(within(undefinedRow!).getAllByText('Sin definir')).toHaveLength(2)
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
