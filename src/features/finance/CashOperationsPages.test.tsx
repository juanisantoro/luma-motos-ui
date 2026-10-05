import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CashTransfersPage,
  PartnerWithdrawalsPage,
} from './CashOperationsPages'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  accounts: vi.fn(),
  transfers: vi.fn(),
  createTransfer: vi.fn(),
  reverseTransfer: vi.fn(),
  withdrawals: vi.fn(),
  createWithdrawal: vi.fn(),
  reverseWithdrawal: vi.fn(),
  alertSuccess: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: { permissions: mocks.permissions } },
  }),
}))

vi.mock('./api', () => ({
  listAllCashAccounts: mocks.accounts,
  listCashTransfers: mocks.transfers,
  createCashTransfer: mocks.createTransfer,
  reverseCashTransfer: mocks.reverseTransfer,
  listPartnerWithdrawals: mocks.withdrawals,
  createPartnerWithdrawal: mocks.createWithdrawal,
  reversePartnerWithdrawal: mocks.reverseWithdrawal,
}))

vi.mock('../../shared/alerts', () => ({ alertSuccess: mocks.alertSuccess }))

function account(overrides: Record<string, unknown>) {
  return {
    id: 'lucas-sm',
    code: 'CAJA_LUCAS_SM',
    name: 'Caja Lucas SM',
    type: 'SOCIO',
    branchId: 'branch-1',
    branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
    responsiblePersonnelId: 'p-lucas',
    responsiblePersonnel: { id: 'p-lucas', fullName: 'Lucas Medina' },
    currency: 'ARS',
    active: true,
    balance: '900000',
    ...overrides,
  }
}

const accounts = [
  account({}),
  account({
    id: 'lucas-dv',
    code: 'CAJA_LUCAS_DV',
    name: 'Caja Lucas DV',
    branchId: 'branch-2',
    branch: { id: 'branch-2', code: 'DV', name: 'Del Viso' },
  }),
  account({
    id: 'lucas-usd',
    code: 'CAJA_LUCAS_USD',
    name: 'Caja Lucas dólares',
    currency: 'USD',
  }),
  account({
    id: 'banco',
    code: 'BANCO_SM',
    name: 'Banco San Miguel',
    type: 'BANCO',
    responsiblePersonnelId: null,
    responsiblePersonnel: null,
  }),
  account({
    id: 'hist',
    code: 'HIST-0123456789ABCDEF01234567',
    name: 'Cuenta historica importada: Lucas',
    imported: true,
  }),
]

const transfer = {
  id: 'transfer-1',
  amount: '250000',
  occurredAt: '2026-10-05T15:00:00.000Z',
  reference: 'Depósito de la semana',
  status: 'CONFIRMADA',
  sourceAccount: { id: 'lucas-sm', code: 'X', name: 'Caja Lucas SM', type: 'SOCIO' },
  destinationAccount: { id: 'banco', code: 'Y', name: 'Banco San Miguel', type: 'BANCO' },
  createdBy: { id: 'p-admin', fullName: 'Admin' },
  createdAt: '2026-10-05T15:00:00.000Z',
}

const withdrawal = {
  id: 'withdrawal-1',
  date: '2026-10-05',
  amount: '500000',
  currency: 'ARS',
  reason: 'Retiro de utilidades',
  status: 'REGISTRADO',
  account: { id: 'lucas-sm', name: 'Caja Lucas SM', type: 'SOCIO' },
  branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
  partner: { id: 'p-lucas', fullName: 'Lucas Medina' },
  registeredBy: { id: 'p-admin', fullName: 'Admin' },
  createdAt: '2026-10-05T15:00:00.000Z',
  reversal: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = ['caja.transferir', 'caja.reversar', 'caja.retiros.gestionar']
  mocks.accounts.mockResolvedValue(accounts)
  mocks.transfers.mockResolvedValue({ items: [transfer], total: 1, page: 1, limit: 50 })
  mocks.withdrawals.mockResolvedValue({
    items: [withdrawal],
    total: 1,
    page: 1,
    limit: 50,
    totals: [{ currency: 'ARS', amount: '500000' }],
  })
  mocks.createTransfer.mockResolvedValue(transfer)
  mocks.createWithdrawal.mockResolvedValue(withdrawal)
  mocks.reverseTransfer.mockResolvedValue({ ...transfer, status: 'REVERSADA' })
  mocks.reverseWithdrawal.mockResolvedValue({ ...withdrawal, status: 'ANULADO' })
})

// El modal enfoca su primer control al abrirse: se espera eso antes de
// escribir, para que el foco no se mueva a mitad de un `type`.
async function openedDialog() {
  const dialog = await screen.findByRole('dialog')
  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toHaveFocus(),
  )
  return dialog
}

function optionValues(select: HTMLElement) {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.getAttribute('value'))
}

describe('Transferencias entre cajas', () => {
  it('lista las transferencias con las dos cajas y su sucursal', async () => {
    render(<CashTransfersPage />)

    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]!
    expect(row).toHaveTextContent('Caja Lucas SM')
    expect(row).toHaveTextContent('Banco San Miguel')
    expect(row).toHaveTextContent('San Miguel')
    expect(row).toHaveTextContent(/250\.000,00/)
    expect(row).toHaveTextContent('Vigente')
  })

  it('sólo ofrece destinos de la misma moneda y nunca una histórica', async () => {
    const user = userEvent.setup()
    render(<CashTransfersPage />)
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nueva transferencia' }))
    const dialog = await openedDialog()
    await user.selectOptions(within(dialog).getByLabelText('Sale de *'), 'lucas-sm')
    expect(within(dialog).getByText(/Saldo actual/)).toHaveTextContent(/900\.000,00/)
    const destination = within(dialog).getByLabelText(/Entra a/)
    expect(optionValues(destination)).toEqual(['', 'lucas-dv', 'banco'])

    await user.selectOptions(destination, 'lucas-dv')
    await user.type(within(dialog).getByLabelText('Importe *'), '250000,50')
    await user.type(
      within(dialog).getByLabelText('Motivo o referencia'),
      'Pase a Del Viso',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar transferencia' }),
    )

    await waitFor(() => expect(mocks.createTransfer).toHaveBeenCalled())
    expect(mocks.createTransfer.mock.calls[0]![0]).toMatchObject({
      sourceAccountId: 'lucas-sm',
      destinationAccountId: 'lucas-dv',
      amount: '250000.50',
      reference: 'Pase a Del Viso',
    })
    await waitFor(() => expect(mocks.transfers).toHaveBeenCalledTimes(2))
  })

  it('anula una transferencia pidiendo el motivo', async () => {
    const user = userEvent.setup()
    render(<CashTransfersPage />)

    await user.click(
      await screen.findByRole('button', { name: /Anular transferencia de Caja Lucas SM/ }),
    )
    const dialog = await openedDialog()
    await user.type(within(dialog).getByLabelText('Motivo *'), 'Cargada dos veces')
    await user.click(within(dialog).getByRole('button', { name: 'Anular' }))

    await waitFor(() =>
      expect(mocks.reverseTransfer).toHaveBeenCalledWith(
        'transfer-1',
        expect.objectContaining({ reason: 'Cargada dos veces' }),
      ),
    )
  })

  it('sin permiso no ofrece crear ni anular', async () => {
    mocks.permissions = []
    render(<CashTransfersPage />)
    await screen.findByRole('table')

    expect(screen.queryByRole('button', { name: 'Nueva transferencia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Anular/ })).not.toBeInTheDocument()
  })
})

describe('Retiros de socios', () => {
  it('lista los retiros con socio, caja, sucursal y el total vigente', async () => {
    render(<PartnerWithdrawalsPage />)

    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]!
    expect(row).toHaveTextContent('Lucas Medina')
    expect(row).toHaveTextContent('Caja Lucas SM')
    expect(row).toHaveTextContent('San Miguel')
    expect(row).toHaveTextContent('Retiro de utilidades')
    const totals = screen.getByRole('region', { name: 'Total retirado' })
    expect(totals).toHaveTextContent('Total retirado (ARS)')
    expect(totals).toHaveTextContent(/500\.000,00/)
  })

  it('registra un retiro a nombre del responsable de la caja', async () => {
    const user = userEvent.setup()
    render(<PartnerWithdrawalsPage />)
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nuevo retiro' }))
    const dialog = await openedDialog()
    const select = within(dialog).getByLabelText('Caja de la que retira *')
    // Ni la cuenta sin responsable ni la histórica.
    expect(optionValues(select)).toEqual(['', 'lucas-sm', 'lucas-dv', 'lucas-usd'])
    await user.selectOptions(select, 'lucas-usd')
    expect(within(dialog).getByText(/Retira/)).toHaveTextContent('Lucas Medina')
    await user.type(within(dialog).getByLabelText('Importe (USD) *'), '1500')
    await user.type(within(dialog).getByLabelText('Motivo *'), 'Utilidades de octubre')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar retiro' }))

    await waitFor(() => expect(mocks.createWithdrawal).toHaveBeenCalled())
    expect(mocks.createWithdrawal.mock.calls[0]![0]).toMatchObject({
      accountId: 'lucas-usd',
      amount: '1500',
      reason: 'Utilidades de octubre',
    })
  })

  it('no manda un importe inválido', async () => {
    const user = userEvent.setup()
    render(<PartnerWithdrawalsPage />)
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nuevo retiro' }))
    const dialog = await openedDialog()
    await user.selectOptions(
      within(dialog).getByLabelText('Caja de la que retira *'),
      'lucas-sm',
    )
    await user.type(within(dialog).getByLabelText('Importe (ARS) *'), '0')
    await user.type(within(dialog).getByLabelText('Motivo *'), 'x')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar retiro' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'importe mayor a cero',
    )
    expect(mocks.createWithdrawal).not.toHaveBeenCalled()
  })

  it('anula un retiro pidiendo el motivo', async () => {
    const user = userEvent.setup()
    render(<PartnerWithdrawalsPage />)

    await user.click(
      await screen.findByRole('button', { name: /Anular retiro de Lucas Medina/ }),
    )
    const dialog = await openedDialog()
    await user.type(within(dialog).getByLabelText('Motivo *'), 'Error de carga')
    await user.click(within(dialog).getByRole('button', { name: 'Anular' }))

    await waitFor(() =>
      expect(mocks.reverseWithdrawal).toHaveBeenCalledWith(
        'withdrawal-1',
        expect.objectContaining({ reason: 'Error de carga' }),
      ),
    )
  })
})
