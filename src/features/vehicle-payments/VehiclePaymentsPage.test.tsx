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
  listVehiclePayments: mocks.listPayments,
  updateVehiclePayment: vi.fn(),
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
      await screen.findByRole('dialog', { name: 'Nuevo pago de moto' }),
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

  it('sin permiso de patentamiento no ofrece la carga de patente', async () => {
    mocks.permissions = ['pagos_vehiculo.consultar', 'pagos_vehiculo.gestionar']
    renderPage()
    await screen.findByRole('table')
    expect(
      screen.queryByRole('button', { name: 'Patente de la operación #105' }),
    ).not.toBeInTheDocument()
  })
})
