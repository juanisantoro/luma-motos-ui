import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OperationsPage } from './OperationsPage'
import { OperationTrackingPanel } from './OperationTrackingPanel'
import {
  componentFixture,
  trackingIncomeFixture,
  trackingRowFixture,
} from './tracking.fixtures'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  branchScope: { allBranches: true, branches: [] } as {
    allBranches: boolean
    branches: Array<{ id: string; code: string; name: string }>
  },
  listTracking: vi.fn(),
  listRecipients: vi.fn(),
  confirm: vi.fn(),
  collect: vi.fn(),
  markFinancing: vi.fn(),
  revertFinancing: vi.fn(),
  listOperations: vi.fn(),
  listBranches: vi.fn(),
  listAccounts: vi.fn(),
  alertSuccess: vi.fn(() => Promise.resolve()),
  alertError: vi.fn(() => Promise.resolve()),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      globalAccess: false,
      organization: { id: 'org-1', name: 'Luma', code: 'LUMA_CENTRAL' },
      branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
      branchScope: mocks.branchScope,
      role: { code: 'ADMINISTRADOR', permissions: mocks.permissions },
    },
  }),
}))

vi.mock('./tracking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tracking')>()),
  listOperationTracking: mocks.listTracking,
  listHandoverRecipients: mocks.listRecipients,
  confirmCashHandover: mocks.confirm,
  collectPaymentComponent: mocks.collect,
  markFinancingPayment: mocks.markFinancing,
  revertFinancingPayment: mocks.revertFinancing,
}))

vi.mock('./api', () => ({
  listSalesOperations: mocks.listOperations,
  releaseSalesReservation: vi.fn(),
}))

vi.mock('../stock/api', () => ({ listSalesBranches: mocks.listBranches }))
vi.mock('../finance/api', () => ({ listAllCashAccounts: mocks.listAccounts }))

vi.mock('../../shared/alerts', () => ({
  alertSuccess: mocks.alertSuccess,
  alertError: mocks.alertError,
}))

const branches = [
  { id: 'branch-1', code: 'SM', name: 'San Miguel', organizationId: 'org-1' },
  { id: 'branch-2', code: 'DV', name: 'Del Viso', organizationId: 'org-1' },
]

function renderPanel() {
  return render(
    <MemoryRouter>
      <OperationTrackingPanel vehicleType="MOTO" />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = [
    'ventas.consultar',
    'ingresos.consultar',
    'ingresos.cobrar',
    'caja.recibir_rendicion',
  ]
  mocks.branchScope = { allBranches: true, branches: [] }
  mocks.listTracking.mockResolvedValue({
    items: [trackingRowFixture()],
    total: 1,
    page: 1,
    limit: 20,
  })
  mocks.listRecipients.mockResolvedValue([
    {
      id: 'recipient-1',
      fullName: 'Lucas',
      isCurrentUser: true,
      pendingCount: 1,
      pendingAmount: '500000',
    },
    {
      id: 'recipient-2',
      fullName: 'Nicolás',
      isCurrentUser: false,
      pendingCount: 0,
      pendingAmount: '0',
    },
  ])
  mocks.listBranches.mockResolvedValue(branches)
  mocks.listAccounts.mockResolvedValue([
    {
      id: 'account-1',
      code: 'CAJA',
      name: 'Caja SM',
      active: true,
      currency: 'ARS',
      branchId: 'branch-1',
    },
  ])
  mocks.confirm.mockResolvedValue({})
  mocks.collect.mockResolvedValue({})
  mocks.markFinancing.mockResolvedValue({})
  mocks.revertFinancing.mockResolvedValue({})
  mocks.listOperations.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  })
})

describe('Seguimiento de operaciones', () => {
  it('muestra acordado, cobrado, saldo, efectivo sin rendir, unidad y patente', async () => {
    renderPanel()
    const table = await screen.findByRole('table')
    const row = within(table).getAllByRole('row')[1]!

    expect(within(row).getByText('#1048')).toBeInTheDocument()
    expect(within(row).getByText('B-0042')).toBeInTheDocument()
    expect(within(row).getByText('Ana Pérez')).toBeInTheDocument()
    expect(within(row).getByText('Vendedor Uno')).toBeInTheDocument()
    expect(within(row).getByText(/2\.500\.000/)).toBeInTheDocument()
    expect(within(row).getByText(/2\.000\.000/)).toBeInTheDocument()
    expect(within(row).getByText(/Pedida a Proveedor A/)).toBeInTheDocument()
    expect(within(row).getByText('Cobro pendiente')).toBeInTheDocument()
    expect(
      screen.getByText(/1 rendición de efectivo por confirmar/),
    ).toBeInTheDocument()
  })

  it('expande los ingresos y deja confirmar sólo al destinatario', async () => {
    const user = userEvent.setup()
    mocks.listTracking.mockResolvedValue({
      items: [
        trackingRowFixture({
          incomes: [
            trackingIncomeFixture(),
            trackingIncomeFixture({
              id: 'income-2',
              handover: {
                status: 'PENDIENTE_RENDICION',
                recipient: { id: 'recipient-2', fullName: 'Nicolás' },
                confirmedAt: null,
                confirmedBy: null,
              },
            }),
          ],
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    renderPanel()

    await user.click(
      await screen.findByRole('button', {
        name: 'Ver ingresos de la operación #1048',
      }),
    )
    const incomes = screen.getByRole('table', {
      name: 'Ingresos de la operación #1048',
    })
    expect(within(incomes).getAllByText('Pendiente de rendición')).toHaveLength(
      2,
    )
    const confirmButtons = within(incomes).getAllByRole('button', {
      name: /Confirmar recepción/,
    })
    expect(confirmButtons).toHaveLength(1)

    await user.click(confirmButtons[0]!)
    await waitFor(() =>
      expect(mocks.confirm).toHaveBeenCalledWith('income-1', 3),
    )
    expect(mocks.alertSuccess).toHaveBeenCalled()
  })

  it('no ofrece confirmar sin caja.recibir_rendicion', async () => {
    const user = userEvent.setup()
    mocks.permissions = ['ventas.consultar', 'ingresos.consultar']
    renderPanel()

    await user.click(
      await screen.findByRole('button', {
        name: 'Ver ingresos de la operación #1048',
      }),
    )
    expect(
      screen.queryByRole('button', { name: /Confirmar recepción/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cobrar/ })).not.toBeInTheDocument()
  })

  it('envía los filtros de saldo, efectivo sin rendir, sucursal y fechas', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('table')

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sucursal' }),
      'branch-2',
    )
    await user.click(screen.getByRole('checkbox', { name: 'Con saldo' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'Con efectivo sin rendir' }),
    )
    await user.type(screen.getByLabelText('Desde'), '2026-09-01')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() =>
      expect(mocks.listTracking).toHaveBeenLastCalledWith(
        {
          vehicleType: 'MOTO',
          page: 1,
          limit: 20,
          branchId: 'branch-2',
          from: '2026-09-01',
          withBalance: true,
          withPendingCash: true,
        },
        expect.any(AbortSignal),
      ),
    )
  })

  it('fija la sucursal cuando el usuario tiene una sola (fase 1)', async () => {
    mocks.branchScope = {
      allBranches: false,
      branches: [{ id: 'branch-1', code: 'SM', name: 'San Miguel' }],
    }
    renderPanel()

    const select = await screen.findByRole('combobox', { name: 'Sucursal' })
    await waitFor(() => expect(select).toBeDisabled())
    expect(select).toHaveValue('branch-1')
    await waitFor(() =>
      expect(mocks.listTracking).toHaveBeenLastCalledWith(
        expect.objectContaining({ branchId: 'branch-1' }),
        expect.any(AbortSignal),
      ),
    )
  })

  it('cobra un componente en efectivo exigiendo a quién se rinde', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: /Cobrar/ }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(
        within(dialog).getByRole('combobox', { name: /Cuenta de caja/ }),
      ).toHaveValue('account-1'),
    )
    // Sólo el componente en efectivo tiene saldo: se precarga su saldo.
    expect(
      within(dialog).getByRole('combobox', { name: /Componente del plan/ }),
    ).toHaveValue('component-cash')
    expect(within(dialog).getByLabelText(/Importe cobrado/)).toHaveValue(1000000)

    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar cobro' }),
    )
    expect(mocks.collect).not.toHaveBeenCalled()

    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: /Se rinde a/ }),
      'recipient-2',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar cobro' }),
    )

    await waitFor(() =>
      expect(mocks.collect).toHaveBeenCalledWith(
        'operation-1',
        'component-cash',
        expect.objectContaining({
          accountId: 'account-1',
          amount: '1000000.00',
          paymentMethod: 'EFECTIVO',
          handoverToId: 'recipient-2',
          reference: 'B-0042',
        }),
      ),
    )
  })
})

describe('Financieras y crédito propio en el seguimiento', () => {
  const pendingFinancing = componentFixture({
    id: 'component-fin',
    type: 'FINANCIACION',
    expectedAmount: '1000000',
    collectedAmount: '0',
    collectableAmount: '1000000',
    balanceAmount: '1000000',
    paymentStatus: 'PENDIENTE',
    financialInstitution: { id: 'fin-1', legalName: 'Credicuotas' },
  })

  async function openDetail() {
    const user = userEvent.setup()
    renderPanel()
    await user.click(
      await screen.findByRole('button', {
        name: 'Ver ingresos de la operación #1048',
      }),
    )
    return {
      user,
      plan: screen.getByRole('table', {
        name: 'Plan de pago de la operación #1048',
      }),
    }
  }

  it('marca que la financiera pagó, sin monto, con observación', async () => {
    mocks.listTracking.mockResolvedValue({
      items: [trackingRowFixture({ paymentComponents: [pendingFinancing] })],
      total: 1,
      page: 1,
      limit: 20,
    })
    const { user, plan } = await openDetail()

    expect(within(plan).getByText('Financiación · Credicuotas')).toBeInTheDocument()
    expect(within(plan).getByText('Financiera pendiente')).toBeInTheDocument()
    await user.click(
      within(plan).getByRole('button', { name: 'Financiera pagó' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByLabelText(/Importe/)).not.toBeInTheDocument()
    await user.type(
      within(dialog).getByLabelText('Observación'),
      'Liquidación 12',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Confirmar que pagó' }),
    )

    await waitFor(() =>
      expect(mocks.markFinancing).toHaveBeenCalledWith(
        'operation-1',
        'component-fin',
        'Liquidación 12',
      ),
    )
  })

  it('muestra el neto y exige motivo para deshacer', async () => {
    mocks.listTracking.mockResolvedValue({
      items: [
        trackingRowFixture({
          paymentComponents: [
            {
              ...pendingFinancing,
              collectedAmount: '920000',
              collectableAmount: '80000',
              balanceAmount: '0',
              paymentStatus: 'PAGADO',
              financingPayment: {
                informedAt: '2026-09-25T15:00:00.000Z',
                informedBy: { id: 'recipient-1', fullName: 'Lucas' },
                notes: null,
              },
            },
          ],
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    const { user, plan } = await openDetail()

    expect(within(plan).getByText('Financiera pagó')).toBeInTheDocument()
    expect(within(plan).getByText(/Neto de/)).toBeInTheDocument()
    await user.click(within(plan).getByRole('button', { name: 'Deshacer' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Deshacer' }))
    expect(mocks.revertFinancing).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('por qué')

    await user.type(within(dialog).getByLabelText(/Motivo/), 'Error')
    await user.click(within(dialog).getByRole('button', { name: 'Deshacer' }))
    await waitFor(() =>
      expect(mocks.revertFinancing).toHaveBeenCalledWith(
        'operation-1',
        'component-fin',
        'Error',
      ),
    )
  })

  it('muestra el crédito propio aparte y sin botón de financiera', async () => {
    mocks.listTracking.mockResolvedValue({
      items: [
        trackingRowFixture({
          ownCredit: {
            status: 'ACTIVO',
            financedAmount: '600000',
            totalAmount: '720000',
            collectedAmount: '240000',
            paidInstallments: 4,
            installments: 12,
            nextDueDate: '2026-10-10T00:00:00.000Z',
          },
          paymentComponents: [
            {
              ...pendingFinancing,
              ownCredit: true,
              collectible: false,
              balanceAmount: '0',
              financialInstitution: {
                id: 'own',
                legalName: 'Crédito personal',
              },
            },
          ],
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    const { plan } = await openDetail()

    const table = screen.getAllByRole('table')[0]!
    expect(within(table).getByText('4 de 12 cuotas')).toBeInTheDocument()
    expect(within(plan).getByText('Crédito propio')).toBeInTheDocument()
    expect(
      within(plan).queryByRole('button', { name: 'Financiera pagó' }),
    ).not.toBeInTheDocument()
  })

  it('filtra por financiera pendiente de pago', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('checkbox', { name: 'Financiera pendiente de pago' }),
    )
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(mocks.listTracking).toHaveBeenLastCalledWith(
        expect.objectContaining({ withFinancingPending: true }),
        expect.any(AbortSignal),
      ),
    )
  })
})

describe('Solapa de seguimiento en Operaciones', () => {
  it('aparece con ingresos.consultar y abre el seguimiento', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OperationsPage vehicleType="MOTO" />
      </MemoryRouter>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Seguimiento de cobros' }),
    )

    expect(
      await screen.findByRole('region', { name: 'Seguimiento de operaciones' }),
    ).toBeInTheDocument()
    expect(mocks.listTracking).toHaveBeenCalled()
  })

  it('no aparece sin ingresos.consultar', async () => {
    mocks.permissions = ['ventas.consultar']
    render(
      <MemoryRouter>
        <OperationsPage vehicleType="MOTO" />
      </MemoryRouter>,
    )

    await waitFor(() => expect(mocks.listOperations).toHaveBeenCalled())
    expect(
      screen.queryByRole('button', { name: 'Seguimiento de cobros' }),
    ).not.toBeInTheDocument()
  })
})
