import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { LicensingModal } from './LicensingModal'
import { licensingFixture, operationFixture } from './licensing.fixtures'
import type { SalesOperation } from './types'

const mocks = vi.hoisted(() => ({
  updateLicensing: vi.fn(),
  collectLicensing: vi.fn(),
  registerPlate: vi.fn(),
  listCashAccounts: vi.fn(),
  listRecipients: vi.fn(),
}))

vi.mock('./api', () => ({
  updateSalesLicensing: mocks.updateLicensing,
  collectSalesLicensing: mocks.collectLicensing,
  registerSalesLicensePlate: mocks.registerPlate,
}))
vi.mock('../finance/api', () => ({
  listAllCashAccounts: mocks.listCashAccounts,
}))
vi.mock('./tracking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tracking')>()),
  listHandoverRecipients: mocks.listRecipients,
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
  onRegisterPayment?: (operation: SalesOperation) => void,
) {
  const onChanged = vi.fn()
  const onClose = vi.fn()
  render(
    <LicensingModal
      onChanged={onChanged}
      onClose={onClose}
      operation={operation}
      permissions={permissions}
      {...(onRegisterPayment ? { onRegisterPayment } : {})}
    />,
  )
  return { onChanged, onClose }
}

// Patente ya recibida (PAGA_CLIENTE, cobro pendiente).
function receivedOperation() {
  return operationFixture({
    licensing: licensingFixture({
      plateLoaded: true,
      plate: {
        status: 'RECIBIDA_COBRO_PENDIENTE',
        number: 'A123BCD',
        receivedAt: '2026-09-17',
      },
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listRecipients.mockResolvedValue([
    {
      id: 'admin-lucas',
      fullName: 'Lucas',
      isCurrentUser: false,
      pendingCount: 0,
      pendingAmount: '0.00',
    },
    {
      id: 'admin-juan',
      fullName: 'Juan',
      isCurrentUser: false,
      pendingCount: 0,
      pendingAmount: '0.00',
    },
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
    account('banco', 'BANCO', 'branch-1'),
    // Compartida: no se ofrece para cobrar.
    account('compartida', 'COMPARTIDA', null),
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
      within(dialog).getByText(
        'Patente en trámite, pasó la fecha estimada (estimada entre 11/09/2026 y 18/09/2026)',
      ),
    ).toBeInTheDocument()
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
    // Sólo cuentas de la sucursal de la operación y en su moneda; ni las
    // compartidas ni las históricas importadas.
    expect(
      within(accountSelect)
        .getAllByRole('option')
        .map((option) => option.getAttribute('value')),
    ).toEqual(['', 'banco', 'caja-centro'])
    expect(accountSelect).toHaveValue('banco')
    await user.selectOptions(accountSelect, 'caja-centro')
    expect(within(form).getByLabelText('Importe cobrado *')).toHaveValue(85000)
    // Efectivo: se rinde a un administrador.
    await within(form).findByRole('option', { name: 'Lucas' })
    await user.selectOptions(within(form).getByLabelText('Se rinde a *'), 'admin-lucas')
    await user.click(within(form).getByRole('button', { name: 'Registrar cobro' }))

    expect(mocks.collectLicensing).toHaveBeenCalledWith(
      'operation-1',
      expect.objectContaining({
        accountId: 'caja-centro',
        amount: '85000.00',
        paymentMethod: 'EFECTIVO',
        handoverToId: 'admin-lucas',
        idempotencyKey: expect.any(String) as string,
      }),
    )
    expect(onChanged).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('PAGA_CLIENTE: permite cobrar antes de que llegue la patente', () => {
    renderModal()
    expect(
      screen.getByRole('form', { name: 'Cargar patente' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('form', { name: 'Registrar cobro al cliente' }),
    ).toBeInTheDocument()
  })

  it('reusa la misma clave si el cobro se reintenta', async () => {
    const user = userEvent.setup()
    mocks.collectLicensing
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce(operationFixture())
    const user2 = user
    renderModal(receivedOperation())
    const form = screen.getByRole('form', { name: 'Registrar cobro al cliente' })
    await within(form).findByRole('option', { name: /CAJA-CENTRO/ })
    await within(form).findByRole('option', { name: 'Juan' })
    await user2.selectOptions(within(form).getByLabelText('Se rinde a *'), 'admin-juan')
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
    renderModal(receivedOperation(), ['ventas.patentamiento.gestionar'])
    expect(
      screen.queryByRole('form', { name: 'Registrar cobro al cliente' }),
    ).not.toBeInTheDocument()
    expect(mocks.listCashAccounts).not.toHaveBeenCalled()
  })

  it('carga la patente bonificada sólo con número y fecha', async () => {
    const user = userEvent.setup()
    mocks.registerPlate.mockResolvedValue(operationFixture())
    const { onChanged, onClose } = renderModal(
      operationFixture({
        licensing: licensingFixture({
          mode: 'BONIFICADA',
          amount: null,
          status: 'PAGO_PENDIENTE',
        }),
      }),
    )
    const form = screen.getByRole('form', { name: 'Cargar patente' })
    expect(
      within(form).queryByLabelText('Cuenta de caja *'),
    ).not.toBeInTheDocument()
    await user.type(within(form).getByLabelText('Número de patente *'), 'a123bcd')
    fireEvent.change(within(form).getByLabelText('Fecha de recepción *'), {
      target: { value: '2026-09-17' },
    })
    expect(mocks.listCashAccounts).not.toHaveBeenCalled()
    await user.click(within(form).getByRole('button', { name: 'Cargar patente' }))

    expect(mocks.registerPlate).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 4,
      licensePlate: 'A123BCD',
      receivedAt: '2026-09-17',
    })
    expect(onChanged).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('PAGA_CLIENTE: carga la patente y registra el cobro en el mismo paso', async () => {
    const user = userEvent.setup()
    mocks.registerPlate.mockResolvedValue(operationFixture())
    renderModal()
    const form = screen.getByRole('form', { name: 'Cargar patente' })
    await user.click(
      within(form).getByLabelText(
        'Registrar también el cobro de la patente al cliente',
      ),
    )
    // Con el cobro en la carga no se duplica el formulario de cobro suelto.
    expect(
      screen.queryByRole('form', { name: 'Registrar cobro al cliente' }),
    ).not.toBeInTheDocument()
    await within(form).findByRole('option', { name: /CAJA-CENTRO/ })
    await user.type(within(form).getByLabelText('Número de patente *'), 'A123BCD')
    await user.selectOptions(
      within(form).getByLabelText('Medio *'),
      'TRANSFERENCIA_BANCARIA',
    )
    expect(within(form).queryByLabelText('Se rinde a *')).not.toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Cargar patente' }))

    expect(mocks.registerPlate).toHaveBeenCalledWith(
      'operation-1',
      expect.objectContaining({
        licensePlate: 'A123BCD',
        collection: expect.objectContaining({
          accountId: 'banco',
          amount: '85000.00',
          paymentMethod: 'TRANSFERENCIA_BANCARIA',
        }) as unknown,
      }),
    )
    const [, payload] = mocks.registerPlate.mock.calls[0] as [
      string,
      { collection: object },
    ]
    expect(payload.collection).not.toHaveProperty('handoverToId')
  })

  it('PAGA_CLIENTE: puede cargar la patente y dejar el cobro pendiente', async () => {
    const user = userEvent.setup()
    mocks.registerPlate.mockResolvedValue(receivedOperation())
    renderModal()
    const form = screen.getByRole('form', { name: 'Cargar patente' })
    expect(within(form).getByText(/pago pendiente hasta/)).toBeInTheDocument()
    await user.type(within(form).getByLabelText('Número de patente *'), 'A123BCD')
    await user.click(within(form).getByRole('button', { name: 'Cargar patente' }))
    const payload = mocks.registerPlate.mock.calls[0]?.[1] as object
    expect(payload).not.toHaveProperty('collection')
  })

  it('pide a quién se rinde el efectivo antes de enviar', async () => {
    const user = userEvent.setup()
    renderModal()
    const form = screen.getByRole('form', { name: 'Cargar patente' })
    await user.click(
      within(form).getByLabelText(
        'Registrar también el cobro de la patente al cliente',
      ),
    )
    await within(form).findByRole('option', { name: /CAJA-CENTRO/ })
    await user.type(within(form).getByLabelText('Número de patente *'), 'A123BCD')
    fireEvent.submit(form)
    expect(
      await screen.findByText('Indicá a quién se rinde el efectivo.'),
    ).toBeInTheDocument()
    expect(mocks.registerPlate).not.toHaveBeenCalled()
  })

  it('valida el número de patente y traduce los errores de la API', async () => {
    const user = userEvent.setup()
    mocks.registerPlate.mockRejectedValue(
      new ApiError(409, 'conflict', {
        code: 'LICENSE_PLATE_IN_USE',
        details: { unitId: 'unit-9', vin: 'VIN-009' },
      }),
    )
    renderModal(
      operationFixture({
        licensing: licensingFixture({ mode: 'BONIFICADA', amount: null }),
      }),
    )
    const form = screen.getByRole('form', { name: 'Cargar patente' })
    await user.type(within(form).getByLabelText('Número de patente *'), 'AB1')
    await user.click(within(form).getByRole('button', { name: 'Cargar patente' }))
    expect(await screen.findByText(/entre 5 y 10 letras/)).toBeInTheDocument()
    expect(mocks.registerPlate).not.toHaveBeenCalled()

    await user.type(within(form).getByLabelText('Número de patente *'), '23CD')
    await user.click(within(form).getByRole('button', { name: 'Cargar patente' }))
    expect(
      await screen.findByText('Esa patente ya está cargada en otra unidad (VIN-009).'),
    ).toBeInTheDocument()
  })

  it('sin unidad asignada informa la situación y no permite cargar la patente', () => {
    renderModal(
      operationFixture({
        licensing: licensingFixture({ mode: 'BONIFICADA', amount: null }),
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
      allPermissions,
      vi.fn(),
    )
    expect(
      screen.getByText(/pendiente de ingreso del proveedor/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('form', { name: 'Cargar patente' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Registrar pago de patente' }),
    ).not.toBeInTheDocument()
  })

  it('abre el pago de patente en pagos de vehículo, sin formulario propio', async () => {
    const user = userEvent.setup()
    const onRegisterPayment = vi.fn()
    const operation = operationFixture({
      licensing: licensingFixture({ mode: 'BONIFICADA', amount: null }),
    })
    renderModal(operation, allPermissions, onRegisterPayment)
    expect(
      screen.queryByRole('form', { name: 'Registrar pago de patente' }),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Registrar pago de patente' }),
    )
    expect(onRegisterPayment).toHaveBeenCalledWith(operation)
  })

  it('no ofrece el pago de patente sin pagos_vehiculo.gestionar', () => {
    renderModal(
      operationFixture(),
      ['ventas.patentamiento.gestionar'],
      vi.fn(),
    )
    expect(
      screen.queryByRole('button', { name: 'Registrar pago de patente' }),
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
