import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { licensingFixture, operationFixture } from '../sales/licensing.fixtures'
import { VehiclePaymentForm } from './VehiclePaymentForm'

// Fase 5: búsqueda por boleto y formulario precargado desde la operación.

const mocks = vi.hoisted(() => ({
  listConcepts: vi.fn(),
  listProviders: vi.fn(),
  createPayment: vi.fn(),
  listOperations: vi.fn(),
  getOperation: vi.fn(),
  listAllOperations: vi.fn(),
  listUnits: vi.fn(),
}))

vi.mock('./api', () => ({
  listVehiclePaymentConcepts: mocks.listConcepts,
  listVehiclePaymentProviders: mocks.listProviders,
  createVehiclePayment: mocks.createPayment,
  createVehiclePaymentConcept: vi.fn(),
  createVehiclePaymentProvider: vi.fn(),
}))
vi.mock('../sales/api', () => ({
  listSalesOperations: mocks.listOperations,
  getSalesOperation: mocks.getOperation,
}))
vi.mock('../finance/api', () => ({
  listAllSalesOperations: mocks.listAllOperations,
}))
vi.mock('../stock/api', () => ({
  listAllPhysicalUnits: mocks.listUnits,
}))
vi.mock('../../shared/alerts', () => ({
  alertSuccess: vi.fn(() => Promise.resolve()),
  alertError: vi.fn(() => Promise.resolve()),
}))

async function selectWithOption(name: string) {
  await screen.findByRole('option', { name })
  const select = screen
    .getAllByRole('combobox')
    .find((element) => within(element).queryByRole('option', { name }))
  if (!select) throw new Error(`No select with option ${name}`)
  return select
}

function renderForm(initialOperationId?: string) {
  const onSaved = vi.fn()
  render(
    <VehiclePaymentForm
      vehicleType="MOTO"
      {...(initialOperationId ? { initialOperationId } : {})}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  )
  return { onSaved }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listConcepts.mockResolvedValue([
    { id: 'concept-seguro', name: 'Seguro' },
    { id: 'concept-patente', name: 'Patente' },
  ])
  mocks.listProviders.mockResolvedValue([
    { id: 'provider-1', name: 'Gestora Carolina' },
  ])
  mocks.createPayment.mockResolvedValue({ id: 'payment-1' })
  mocks.listAllOperations.mockResolvedValue([])
  mocks.listUnits.mockResolvedValue([])
})

describe('Pago de vehículo por boleto', () => {
  it('busca por boleto y precarga operación y unidad', async () => {
    const user = userEvent.setup()
    mocks.listOperations.mockResolvedValue({
      items: [
        operationFixture({ id: 'operation-2', number: '99', ticketNumber: null }),
        operationFixture(),
      ],
      total: 2,
      page: 1,
      limit: 10,
    })
    const { onSaved } = renderForm()
    await user.type(screen.getByLabelText('Buscar por boleto'), 'B-0001')

    const results = await screen.findByRole('listbox', {
      name: 'Operaciones encontradas',
    })
    expect(mocks.listOperations).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleType: 'MOTO', search: 'B-0001' }),
      expect.anything(),
    )
    // Primero las que coinciden por boleto.
    const options = within(results).getAllByRole('option')
    expect(options[0]).toHaveTextContent('Boleto B-0001 · #105')
    await user.click(options[0]!)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Operación #105 · Ana Cliente',
    )
    expect(
      screen.getByPlaceholderText('Buscá por chasis, patente, marca, modelo o versión'),
    ).toHaveValue('VIN-001 · Honda Wave 110 S')
    expect(screen.getByDisplayValue('#105 · Ana Cliente')).toBeInTheDocument()

    await user.selectOptions(await selectWithOption('Patente'), 'concept-patente')
    await user.selectOptions(await selectWithOption('Gestora Carolina'), 'provider-1')
    await user.type(screen.getByLabelText('Importe *'), '60000')
    await user.click(screen.getByRole('button', { name: 'Guardar pago' }))

    expect(mocks.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        conceptId: 'concept-patente',
        unitId: 'unit-1',
        operationId: 'operation-1',
        providerId: 'provider-1',
        amount: 60000,
      }),
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('avisa si la operación del boleto todavía no tiene unidad', async () => {
    const user = userEvent.setup()
    mocks.listOperations.mockResolvedValue({
      items: [
        operationFixture({
          vehicle: { ...operationFixture().vehicle, unit: null },
          fulfillment: {
            status: 'PENDIENTE_INGRESO',
            supplyRequestId: 'supply-1',
            supplyStatus: 'EN_TRANSITO',
            supplier: null,
            requestedAt: null,
            orderedAt: null,
            dispatchedAt: null,
            receivedAt: null,
          },
        }),
      ],
      total: 1,
      page: 1,
      limit: 10,
    })
    renderForm()
    await user.type(screen.getByLabelText('Buscar por boleto'), 'B-0001')
    const option = await screen.findByRole('option', { name: /Boleto B-0001/ })
    expect(option).toHaveTextContent('Pendiente de ingreso del proveedor')
    await user.click(option)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pendiente de ingreso del proveedor: todavía no tiene unidad',
    )
    expect(screen.getByRole('button', { name: 'Guardar pago' })).toBeDisabled()
  })

  it('desde la operación abre precargado con concepto Patente', async () => {
    mocks.getOperation.mockResolvedValue(
      operationFixture({
        licensing: licensingFixture({ mode: 'BONIFICADA', amount: null }),
      }),
    )
    renderForm('operation-1')
    expect(mocks.getOperation).toHaveBeenCalledWith(
      'operation-1',
      expect.anything(),
    )
    expect(
      await screen.findByDisplayValue('#105 · Ana Cliente'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar por boleto')).toHaveValue(
      'Boleto B-0001',
    )
    await waitFor(() =>
      expect(screen.getByDisplayValue('Patente')).toBeInTheDocument(),
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Patente en trámite (estimada entre 11/09/2026 y 18/09/2026)',
    )
  })
})
