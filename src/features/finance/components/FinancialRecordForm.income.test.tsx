import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinancialRecordForm } from './FinancialRecordForm'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  create: vi.fn(),
  settle: vi.fn(),
  listAccounts: vi.fn(),
  listRecipients: vi.fn(),
  listTracking: vi.fn(),
  collectComponent: vi.fn(),
  alertSuccess: vi.fn(),
  alertError: vi.fn(),
}))

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Lucía',
      email: 'lucia@luma.test',
      globalAccess: false,
      organization: { id: 'org-1', name: 'Luma', code: 'LUMA_CENTRAL' },
      branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
      branchScope: {
        allBranches: false,
        branches: [{ id: 'branch-1', code: 'SM', name: 'San Miguel' }],
      },
      role: { code: 'ADMINISTRATIVA', permissions: mocks.permissions },
    },
  }),
}))

vi.mock('../api', () => ({
  addSettlement: mocks.settle,
  createFinancialRecord: mocks.create,
  listAllCashAccounts: mocks.listAccounts,
  listAllCatalogVersions: vi.fn().mockResolvedValue([]),
  listAllInventoryUnits: vi.fn().mockResolvedValue([]),
  listAllSuppliers: vi.fn().mockResolvedValue([]),
  listIncomeTypes: vi
    .fn()
    .mockResolvedValue([
      { id: 'type-1', name: 'Seña' },
      { id: 'type-2', name: 'Cobro de operación' },
      { id: 'type-3', name: 'Cuota crédito' },
    ]),
  listInventoryBranches: vi.fn().mockResolvedValue([
    { id: 'branch-1', code: 'SM', name: 'San Miguel', organizationId: 'org-1' },
  ]),
  listInventoryUnits: vi.fn().mockResolvedValue({ items: [] }),
  listSalesOperations: vi.fn().mockResolvedValue({ items: [] }),
}))

vi.mock('../../sales/tracking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../sales/tracking')>()),
  listHandoverRecipients: mocks.listRecipients,
  listOperationTracking: mocks.listTracking,
  collectPaymentComponent: mocks.collectComponent,
}))

vi.mock('../../../shared/alerts', () => ({
  alertSuccess: mocks.alertSuccess,
  alertError: mocks.alertError,
}))

const accounts = [
  {
    id: 'account-lucas',
    code: 'CAJA_LUCAS',
    name: 'Caja Lucas',
    type: 'SOCIO',
    branchId: null,
    responsiblePersonnelId: 'p-lucas',
    responsiblePersonnel: { id: 'p-lucas', fullName: 'Lucas' },
    currency: 'ARS',
    active: true,
    balance: '0',
  },
  {
    id: 'account-bank',
    code: 'BANCO_NICO',
    name: 'Banco Galicia',
    type: 'BANCO',
    branchId: null,
    responsiblePersonnelId: 'p-nico',
    responsiblePersonnel: { id: 'p-nico', fullName: 'Nicolás' },
    currency: 'ARS',
    active: true,
    balance: '0',
  },
  {
    id: 'account-dv',
    code: 'CAJA_DV',
    name: 'Caja Del Viso',
    type: 'CAJA',
    branchId: 'branch-2',
    responsiblePersonnelId: null,
    currency: 'ARS',
    active: true,
    balance: '0',
  },
]

function component(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comp-cash',
    type: 'EFECTIVO',
    expectedAmount: '2500000.00',
    collectedAmount: '500000.00',
    collectableAmount: '2000000.00',
    balanceAmount: '2000000.00',
    paymentStatus: 'PARCIAL',
    financialInstitution: null,
    ownCredit: false,
    financingPayment: null,
    collectible: true,
    ...overrides,
  }
}

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'op-1',
    number: '1053',
    ticketNumber: 'SM-0421',
    status: 'APROBADA',
    client: { id: 'c-1', fullName: 'Pérez, Ana' },
    branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
    vehicle: { versionName: 'Honda Wave 110', condition: 'NUEVO', chassis: null },
    currency: 'ARS',
    agreedPrice: '2500000.00',
    collectedAmount: '500000.00',
    balanceAmount: '2000000.00',
    ownCredit: null,
    paymentComponents: [component()],
    incomes: [],
    ...overrides,
  }
}

async function pickOperation(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() =>
    expect(screen.getByLabelText('Tipo *')).not.toBeDisabled(),
  )
  await user.selectOptions(
    screen.getByLabelText('Tipo *'),
    'Cobro de operación',
  )
  await user.type(screen.getByLabelText('Operación que se paga *'), 'SM-0421')
  await user.click(await screen.findByRole('option', { name: /1053/ }))
}

function renderForm() {
  const onSaved = vi.fn()
  render(
    <FinancialRecordForm
      defaultBranchId="branch-1"
      kind="income"
      onClose={vi.fn()}
      onSaved={onSaved}
      vehicleType="MOTO"
    />,
  )
  return onSaved
}

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() =>
    expect(screen.getByLabelText('Tipo *')).not.toBeDisabled(),
  )
  await user.selectOptions(screen.getByLabelText('Tipo *'), 'Seña')
  await user.type(screen.getByLabelText('Descripción *'), 'Seña moto')
  await user.type(screen.getByLabelText('Importe total *'), '150000')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = [
    'ingresos.consultar',
    'ingresos.gestionar',
    'ingresos.cobrar',
    'ventas.consultar',
    'caja.consultar',
  ]
  mocks.listAccounts.mockResolvedValue(accounts)
  mocks.listRecipients.mockResolvedValue([
    { id: 'p-lucas', fullName: 'Lucas', isCurrentUser: false, pendingCount: 0, pendingAmount: '0' },
    { id: 'p-nico', fullName: 'Nicolás', isCurrentUser: false, pendingCount: 0, pendingAmount: '0' },
  ])
  mocks.create.mockResolvedValue({ id: 'income-1' })
  mocks.settle.mockResolvedValue({})
  mocks.listTracking.mockResolvedValue({
    items: [operation()],
    total: 1,
    page: 1,
    limit: 8,
  })
  mocks.collectComponent.mockResolvedValue({})
})

describe('Alta de ingreso con medio, cobrador y rendición', () => {
  it('en efectivo exige a quién se rinde y cobra en la caja de esa persona', async () => {
    const user = userEvent.setup()
    const onSaved = renderForm()
    await fillBasics(user)

    expect(screen.getByLabelText('Medio *')).toHaveValue('EFECTIVO')
    // Quién cobró no se elige: es quien carga el ingreso.
    expect(screen.getByLabelText('Quién cobró')).toHaveTextContent('Lucía')
    expect(screen.getByLabelText('Quién cobró').tagName).toBe('OUTPUT')
    // La caja tampoco se elige: es la de quien recibe la rendición.
    const cashBox = screen.getByLabelText('Caja donde entra')
    expect(cashBox.tagName).toBe('OUTPUT')
    expect(cashBox).toHaveTextContent('Elegí a quién se rinde')

    await user.selectOptions(screen.getByLabelText(/Se rinde a/), 'p-lucas')
    expect(cashBox).toHaveTextContent('Caja Lucas · Caja de socio')

    await user.click(screen.getByRole('button', { name: 'Guardar ingreso' }))

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'income',
        expect.objectContaining({
          branchId: 'branch-1',
          totalAmount: '150000.00',
          paymentMethod: 'EFECTIVO',
          handoverToId: 'p-lucas',
        }),
      ),
    )
    expect(mocks.create.mock.calls[0]?.[1]).not.toHaveProperty('collectedById')
    await waitFor(() =>
      expect(mocks.settle).toHaveBeenCalledWith(
        'income',
        'income-1',
        expect.objectContaining({
          accountId: 'account-lucas',
          amount: '150000.00',
          idempotencyKey: expect.any(String) as string,
        }),
      ),
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('por transferencia no pide rendición y entra a la cuenta bancaria elegida', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillBasics(user)

    await user.selectOptions(
      screen.getByLabelText('Medio *'),
      'TRANSFERENCIA_BANCARIA',
    )
    expect(screen.queryByLabelText(/Se rinde a/)).not.toBeInTheDocument()
    // Sólo las cuentas de la sucursal y las compartidas, con nombre legible.
    const accountSelect = screen.getByLabelText('Cuenta donde entró *')
    expect(accountSelect).not.toHaveTextContent('Caja Del Viso')
    expect(accountSelect).toHaveTextContent(
      'Banco Galicia · Nicolás · Cuenta bancaria',
    )
    await user.selectOptions(accountSelect, 'account-bank')
    await user.click(screen.getByRole('button', { name: 'Guardar ingreso' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalled())
    const input = mocks.create.mock.calls[0]?.[1] as Record<string, unknown>
    expect(input.paymentMethod).toBe('TRANSFERENCIA_BANCARIA')
    expect(input).not.toHaveProperty('handoverToId')
    await waitFor(() =>
      expect(mocks.settle).toHaveBeenCalledWith(
        'income',
        'income-1',
        expect.objectContaining({ accountId: 'account-bank' }),
      ),
    )
  })

  it('como "Pendiente de cobro" guarda el ingreso y no toca caja', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillBasics(user)

    await user.selectOptions(screen.getByLabelText(/Se rinde a/), 'p-nico')
    await user.selectOptions(
      screen.getByLabelText('Estado del cobro *'),
      'PENDIENTE',
    )
    expect(screen.queryByLabelText('Caja donde entra')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar ingreso' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalled())
    expect(mocks.settle).not.toHaveBeenCalled()
  })

  it('si quien recibe no tiene caja no guarda y explica qué hacer', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillBasics(user)

    // Nicolás sólo tiene cuenta bancaria: no hay caja para su efectivo.
    await user.selectOptions(screen.getByLabelText(/Se rinde a/), 'p-nico')
    expect(screen.getByLabelText('Caja donde entra')).toHaveTextContent(
      'Nicolás todavía no tiene una caja',
    )
    await user.click(screen.getByRole('button', { name: 'Guardar ingreso' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cuentas de caja',
    )
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('si el cobro falla avisa que el ingreso quedó pendiente', async () => {
    const user = userEvent.setup()
    mocks.settle.mockRejectedValue(new Error('boom'))
    const onSaved = renderForm()
    await fillBasics(user)

    await user.selectOptions(screen.getByLabelText(/Se rinde a/), 'p-lucas')
    await user.click(screen.getByRole('button', { name: 'Guardar ingreso' }))

    await waitFor(() => expect(mocks.alertError).toHaveBeenCalled())
    expect(mocks.alertError.mock.calls[0]?.[0]).toContain(
      'se guardó como pendiente',
    )
    expect(onSaved).toHaveBeenCalled()
  })
})

describe('Pago de la moto (venta) desde Ingresos', () => {
  it('ofrece el pago de la venta y oculta la cuota de crédito', async () => {
    renderForm()
    const type = screen.getByLabelText('Tipo *')
    await waitFor(() => expect(type).not.toBeDisabled())
    expect(type).toHaveTextContent('Pago de la moto (venta)')
    expect(type).not.toHaveTextContent('Cobro de operación')
    expect(type).not.toHaveTextContent('Cuota crédito')
  })

  it('sin permiso de cobro no ofrece el pago de la venta', async () => {
    mocks.permissions = ['ingresos.consultar', 'ingresos.gestionar']
    renderForm()
    const type = screen.getByLabelText('Tipo *')
    await waitFor(() => expect(type).not.toBeDisabled())
    expect(type).toHaveTextContent('Seña')
    expect(type).not.toHaveTextContent('Pago de la moto')
  })

  it('agranda el formulario, propone el saldo y cobra contra la operación', async () => {
    const user = userEvent.setup()
    const onSaved = renderForm()
    await pickOperation(user)

    expect(mocks.listTracking).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleType: 'MOTO', search: 'SM-0421' }),
      expect.anything(),
    )
    // Los campos del ingreso libre no aplican.
    expect(screen.queryByLabelText('Descripción *')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Importe total *')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Estado del cobro *')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Moneda *')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Qué se está cobrando/)).not.toBeInTheDocument()
    // El medio viene con lo pactado en el plan.
    expect(screen.queryByLabelText('Medio *')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Medio con el que pagó/)).toHaveValue('EFECTIVO')
    expect(screen.getByLabelText('Resumen de la operación')).toHaveTextContent(
      'Se cobra: lo pactado en efectivo · faltan',
    )

    expect(screen.getByLabelText('Resumen de la operación')).toHaveTextContent(
      'Pérez, Ana · boleto SM-0421 · Honda Wave 110',
    )
    expect(screen.getByLabelText('Sucursal')).toHaveTextContent('SM · San Miguel')
    expect(screen.getByLabelText(/Importe a cobrar/)).toHaveValue(2000000)
    expect(screen.getByLabelText('TT / referencia')).toHaveValue('SM-0421')

    await user.selectOptions(screen.getByLabelText(/Se rinde a/), 'p-lucas')
    expect(screen.getByLabelText('Caja donde entra')).toHaveTextContent(
      'Caja Lucas',
    )
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    await waitFor(() =>
      expect(mocks.collectComponent).toHaveBeenCalledWith(
        'op-1',
        'comp-cash',
        expect.objectContaining({
          accountId: 'account-lucas',
          amount: '2000000.00',
          paymentMethod: 'EFECTIVO',
          handoverToId: 'p-lucas',
          reference: 'SM-0421',
          idempotencyKey: expect.any(String) as string,
        }),
      ),
    )
    // No se crea un ingreso suelto: lo genera el cobro de la operación.
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.settle).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })

  it('permite un pago parcial y rechaza más que el saldo', async () => {
    const user = userEvent.setup()
    renderForm()
    await pickOperation(user)
    await user.selectOptions(screen.getByLabelText(/Se rinde a/), 'p-lucas')
    const amount = screen.getByLabelText(/Importe a cobrar/)

    await user.clear(amount)
    await user.type(amount, '2500000')
    fireEvent.submit(amount.closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'supera el saldo',
    )
    expect(mocks.collectComponent).not.toHaveBeenCalled()

    await user.clear(amount)
    await user.type(amount, '800000')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() =>
      expect(mocks.collectComponent).toHaveBeenCalledWith(
        'op-1',
        'comp-cash',
        expect.objectContaining({ amount: '800000.00' }),
      ),
    )
  })

  it('con varias partes deja elegir cuál y ajusta medio e importe', async () => {
    const user = userEvent.setup()
    mocks.listTracking.mockResolvedValue({
      items: [
        operation({
          paymentComponents: [
            component(),
            component({
              id: 'comp-transfer',
              type: 'TRANSFERENCIA_BANCARIA',
              collectableAmount: '300000.00',
            }),
            // El crédito propio no se cobra desde acá.
            component({ id: 'comp-credit', ownCredit: true, collectible: false }),
          ],
        }),
      ],
      total: 1,
      page: 1,
      limit: 8,
    })
    renderForm()
    await pickOperation(user)

    const part = screen.getByLabelText(/Qué se está cobrando del plan/)
    expect(part).not.toHaveTextContent('Crédito propio')
    expect(part).toHaveTextContent('Lo pactado en efectivo: faltan')
    expect(part).toHaveTextContent('Lo pactado por transferencia: faltan')
    await user.selectOptions(part, 'comp-transfer')
    expect(screen.getByLabelText(/Medio con el que pagó/)).toHaveValue(
      'TRANSFERENCIA_BANCARIA',
    )
    expect(screen.getByLabelText(/Importe a cobrar/)).toHaveValue(300000)
    expect(screen.queryByLabelText(/Se rinde a/)).not.toBeInTheDocument()
    await user.selectOptions(
      screen.getByLabelText('Cuenta donde entró *'),
      'account-bank',
    )
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    await waitFor(() =>
      expect(mocks.collectComponent).toHaveBeenCalledWith(
        'op-1',
        'comp-transfer',
        expect.objectContaining({
          accountId: 'account-bank',
          amount: '300000.00',
          paymentMethod: 'TRANSFERENCIA_BANCARIA',
        }),
      ),
    )
    expect(mocks.collectComponent.mock.calls[0]?.[2]).not.toHaveProperty(
      'handoverToId',
    )
  })

  it('si pagó de otra forma a la pactada registra el medio real', async () => {
    const user = userEvent.setup()
    renderForm()
    await pickOperation(user)

    // Estaba pactado en efectivo y transfirió: no hay rendición, va a cuenta.
    await user.selectOptions(
      screen.getByLabelText(/Medio con el que pagó/),
      'TRANSFERENCIA_BANCARIA',
    )
    expect(screen.queryByLabelText(/Se rinde a/)).not.toBeInTheDocument()
    await user.selectOptions(
      screen.getByLabelText('Cuenta donde entró *'),
      'account-bank',
    )
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    await waitFor(() =>
      expect(mocks.collectComponent).toHaveBeenCalledWith(
        'op-1',
        'comp-cash',
        expect.objectContaining({
          accountId: 'account-bank',
          amount: '2000000.00',
          paymentMethod: 'TRANSFERENCIA_BANCARIA',
        }),
      ),
    )
    expect(mocks.collectComponent.mock.calls[0]?.[2]).not.toHaveProperty(
      'handoverToId',
    )
  })

  it('bloquea una operación saldada o cancelada', async () => {
    const user = userEvent.setup()
    mocks.listTracking.mockResolvedValue({
      items: [
        operation({
          balanceAmount: '0.00',
          paymentComponents: [component({ collectableAmount: '0.00' })],
        }),
      ],
      total: 1,
      page: 1,
      limit: 8,
    })
    renderForm()
    await pickOperation(user)

    expect(
      screen.getByText(/no tiene saldo pendiente de cobro/),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/Importe a cobrar/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()
  })
})
