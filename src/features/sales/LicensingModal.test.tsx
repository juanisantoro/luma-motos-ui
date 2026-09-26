import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { LicensingModal } from './LicensingModal'
import { licensingFixture, operationFixture } from './licensing.fixtures'

const mocks = vi.hoisted(() => ({
  updateLicensing: vi.fn(),
  collectLicensing: vi.fn(),
  listCashAccounts: vi.fn(),
  createVehiclePayment: vi.fn(),
  listConcepts: vi.fn(),
  listProviders: vi.fn(),
}))

vi.mock('./api', () => ({
  updateSalesLicensing: mocks.updateLicensing,
  collectSalesLicensing: mocks.collectLicensing,
}))
vi.mock('../finance/api', () => ({
  listAllCashAccounts: mocks.listCashAccounts,
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
  'ingresos.cobrar',
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
  const account = (
    id: string,
    code: string,
    branchId: string | null,
    currency = 'ARS',
  ) => ({
    id,
    code,
    name: `Cuenta ${code}`,
    type: 'CAJA',
    branchId,
    responsiblePersonnelId: null,
    currency,
    active: true,
    balance: '0.00',
  })
  mocks.listCashAccounts.mockResolvedValue([
    account('hist', 'HIST-001', 'branch-1'),
    account('other-branch', 'CAJA-DV', 'branch-2'),
    account('usd', 'CAJA-USD', 'branch-1', 'USD'),
    account('caja-centro', 'CAJA-CENTRO', 'branch-1'),
    account('banco', 'BANCO', null),
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

  it('registra el cobro de patente y lo acredita en caja en un paso', async () => {
    const user = userEvent.setup()
    mocks.collectLicensing.mockResolvedValue(
      operationFixture({
        licensing: licensingFixture({ status: 'COBRADO' }),
      }),
    )
    const { onChanged, onClose } = renderModal()
    const form = screen.getByRole('form', { name: 'Registrar cobro al cliente' })
    const accountSelect = within(form).getByLabelText('Cuenta de caja *')
    await within(form).findByRole('option', { name: /CAJA-CENTRO/ })
    // Sólo cuentas de la sucursal (o sin sucursal) y en la moneda de la
    // operación; las históricas al final.
    expect(
      within(accountSelect)
        .getAllByRole('option')
        .map((option) => option.getAttribute('value')),
    ).toEqual(['', 'banco', 'caja-centro', 'hist'])
    expect(accountSelect).toHaveValue('banco')
    await user.selectOptions(accountSelect, 'caja-centro')
    expect(within(form).getByLabelText('Importe cobrado *')).toHaveValue(85000)
    await user.click(within(form).getByRole('button', { name: 'Registrar cobro' }))

    expect(mocks.collectLicensing).toHaveBeenCalledWith(
      'operation-1',
      expect.objectContaining({
        accountId: 'caja-centro',
        amount: '85000.00',
        idempotencyKey: expect.any(String) as string,
      }),
    )
    expect(
      screen.queryByRole('form', { name: 'Registrar pago de patente' }),
    ).not.toBeInTheDocument()
    expect(onChanged).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('reusa la misma clave si el cobro se reintenta', async () => {
    const user = userEvent.setup()
    mocks.collectLicensing
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce(operationFixture())
    renderModal()
    const form = screen.getByRole('form', { name: 'Registrar cobro al cliente' })
    await within(form).findByRole('option', { name: /CAJA-CENTRO/ })
    const submit = within(form).getByRole('button', { name: 'Registrar cobro' })
    await user.click(submit)
    await user.click(submit)
    const keys = mocks.collectLicensing.mock.calls.map(
      (call) => (call[1] as { idempotencyKey: string }).idempotencyKey,
    )
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
  })

  it('no ofrece el cobro sin el permiso de cobrar ingresos', () => {
    renderModal(operationFixture(), ['ventas.patentamiento.gestionar'])
    expect(
      screen.queryByRole('form', { name: 'Registrar cobro al cliente' }),
    ).not.toBeInTheDocument()
    expect(mocks.listCashAccounts).not.toHaveBeenCalled()
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
