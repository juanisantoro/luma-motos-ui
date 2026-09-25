import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { LicensingModal } from './LicensingModal'
import { licensingFixture, operationFixture } from './licensing.fixtures'

const mocks = vi.hoisted(() => ({
  updateLicensing: vi.fn(),
  createFinancialRecord: vi.fn(),
  createVehiclePayment: vi.fn(),
  listConcepts: vi.fn(),
  listProviders: vi.fn(),
}))

vi.mock('./api', () => ({ updateSalesLicensing: mocks.updateLicensing }))
vi.mock('../finance/api', () => ({
  createFinancialRecord: mocks.createFinancialRecord,
}))
vi.mock('../vehicle-payments/api', () => ({
  createVehiclePayment: mocks.createVehiclePayment,
  listVehiclePaymentConcepts: mocks.listConcepts,
  listVehiclePaymentProviders: mocks.listProviders,
}))
vi.mock('../../shared/alerts', () => ({
  alertSuccess: vi.fn(() => Promise.resolve()),
  alertError: vi.fn(() => Promise.resolve()),
}))

const allPermissions = [
  'ventas.patentamiento.gestionar',
  'ingresos.gestionar',
  'pagos_vehiculo.gestionar',
]

function renderModal(
  operation = operationFixture(),
  permissions: string[] = allPermissions,
) {
  const onChanged = vi.fn()
  const onClose = vi.fn()
  render(
    <LicensingModal
      onChanged={onChanged}
      onClose={onClose}
      operation={operation}
      permissions={permissions}
    />,
  )
  return { onChanged, onClose }
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
})

describe('Gestión de patentamiento', () => {
  it('muestra estado, ventana estimada y demora', () => {
    renderModal(
      operationFixture({ licensing: licensingFixture({ overdue: true }) }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Operación #105 · boleto B-0001',
    })
    expect(within(dialog).getByText('Cobro pendiente')).toBeInTheDocument()
    expect(
      within(dialog).getByText(/Patente estimada entre 11\/09\/2026 y 18\/09\/2026/),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/pasó la fecha estimada/)).toBeInTheDocument()
  })

  it('cambia modalidad e importe con expectedVersion', async () => {
    const user = userEvent.setup()
    mocks.updateLicensing.mockResolvedValue(
      operationFixture({
        rowVersion: 5,
        licensing: licensingFixture({
          mode: 'BONIFICADA',
          amount: null,
          status: 'PAGO_PENDIENTE',
        }),
      }),
    )
    const { onChanged } = renderModal()
    await user.selectOptions(screen.getByLabelText('Patentamiento *'), 'BONIFICADA')
    expect(screen.queryByLabelText('Importe de patente')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar modalidad' }))

    expect(mocks.updateLicensing).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 4,
      mode: 'BONIFICADA',
    })
    expect(onChanged).toHaveBeenCalled()
    expect(await screen.findByText('Pago pendiente')).toBeInTheDocument()
  })

  it('explica el bloqueo cuando ya hay un cobro al cliente', async () => {
    const user = userEvent.setup()
    mocks.updateLicensing.mockRejectedValue(
      new ApiError(409, 'conflict', {
        code: 'LICENSING_COLLECTION_REGISTERED',
      }),
    )
    renderModal()
    await user.selectOptions(screen.getByLabelText('Patentamiento *'), 'BONIFICADA')
    await user.click(screen.getByRole('button', { name: 'Guardar modalidad' }))
    expect(
      await screen.findByText(/Ya hay un cobro de patente registrado/),
    ).toBeInTheDocument()
  })

  it('registra el cobro al cliente como ingreso de tipo Patente vinculado a la operación', async () => {
    const user = userEvent.setup()
    mocks.createFinancialRecord.mockResolvedValue({ id: 'income-1' })
    const { onChanged, onClose } = renderModal()
    const form = screen.getByRole('form', { name: 'Registrar cobro al cliente' })
    expect(within(form).getByLabelText('Importe cobrado *')).toHaveValue(85000)
    await user.click(within(form).getByRole('button', { name: 'Registrar cobro' }))

    expect(mocks.createFinancialRecord).toHaveBeenCalledWith(
      'income',
      expect.objectContaining({
        branchId: 'branch-1',
        type: 'Patente',
        operationId: 'operation-1',
        unitId: 'unit-1',
        reference: 'B-0001',
        totalAmount: '85000.00',
      }),
    )
    expect(screen.queryByRole('form', { name: 'Registrar pago de patente' })).not.toBeInTheDocument()
    expect(onChanged).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('registra el pago de una patente bonificada con el concepto Patente', async () => {
    const user = userEvent.setup()
    mocks.createVehiclePayment.mockResolvedValue({ id: 'payment-1' })
    renderModal(
      operationFixture({
        licensing: licensingFixture({
          mode: 'BONIFICADA',
          amount: null,
          status: 'PAGO_PENDIENTE',
        }),
      }),
    )
    const form = await screen.findByRole('form', {
      name: 'Registrar pago de patente',
    })
    await within(form).findByRole('option', { name: 'Gestora Carolina' })
    await user.type(within(form).getByLabelText('Importe *'), '60000')
    await user.click(within(form).getByRole('button', { name: 'Registrar pago' }))

    expect(mocks.createVehiclePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        conceptId: 'concept-patente',
        unitId: 'unit-1',
        operationId: 'operation-1',
        providerId: 'provider-1',
        amount: 60000,
        status: 'PAGADO',
      }),
    )
    expect(
      screen.queryByRole('form', { name: 'Registrar cobro al cliente' }),
    ).not.toBeInTheDocument()
  })

  it('no permite registrar el pago si la operación no tiene unidad', async () => {
    renderModal(
      operationFixture({
        licensing: licensingFixture({ mode: 'BONIFICADA', amount: null }),
        vehicle: { ...operationFixture().vehicle, unit: null },
      }),
    )
    expect(
      await screen.findByText(/todavía no tiene una unidad asignada/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Registrar pago' }),
    ).not.toBeInTheDocument()
  })

  it('oculta acciones sin permisos', () => {
    renderModal(operationFixture(), [])
    expect(
      screen.queryByRole('button', { name: 'Guardar modalidad' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('form', { name: 'Registrar cobro al cliente' }),
    ).not.toBeInTheDocument()
  })
})
