import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/client'
import { addSettlement, listAllCashAccounts } from '../api'
import type { CashAccount, Expense, FinancialRecord } from '../types'
import { SettlementModal } from './SettlementModal'

vi.mock('../api', () => ({
  addSettlement: vi.fn(),
  listAllCashAccounts: vi.fn(),
}))

const branch = { id: 'branch-dv', code: 'DV', name: 'Del Viso' }

function cashAccount(id: string, name: string): CashAccount {
  return {
    id,
    code: id.toUpperCase(),
    name,
    type: 'SOCIO',
    branchId: branch.id,
    responsiblePersonnelId: null,
    currency: 'ARS',
    active: true,
    balance: '0.00',
  }
}

const accounts = [
  cashAccount('caja-juan', 'Caja Juan'),
  cashAccount('caja-lucas', 'Caja Lucas'),
]

const expense: Expense = {
  id: 'expense-1',
  expenseDate: '2026-10-10',
  month: 10,
  year: 2026,
  category: 'COMISIONES',
  reference: '',
  description: 'Comisión gerente Del Viso',
  totalAmount: '300000.00',
  paidAmount: '0.00',
  balanceAmount: '300000.00',
  currency: 'ARS',
  paymentStatus: 'PENDIENTE',
  recoverable: false,
  recovered: false,
  recoveredAmount: '0.00',
  recoverableBalance: '0.00',
  organizationId: 'org-1',
  branchId: branch.id,
  branch,
  createdBy: { id: 'user-1', fullName: 'Juan' },
  paidBy: '',
  paymentRegisteredBy: null,
  account: null,
  notes: null,
  createdAt: '2026-10-10T12:00:00.000Z',
  updatedAt: '2026-10-10T12:00:00.000Z',
}

function renderModal(record: FinancialRecord = expense) {
  const onSaved = vi.fn()
  const onClose = vi.fn()
  vi.mocked(listAllCashAccounts).mockResolvedValue(accounts)
  render(
    <SettlementModal
      kind="expense"
      record={record}
      recovery={false}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )
  return { onSaved, onClose, dialog: screen.getByRole('dialog') }
}

afterEach(() => vi.clearAllMocks())

describe('SettlementModal: pago de gasto en varias cajas', () => {
  it('muestra el saldo y propone pagarlo completo desde una caja', async () => {
    const { dialog } = renderModal()
    expect(within(dialog).getByText('Saldo pendiente')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByLabelText('Cuenta *')).not.toBeDisabled())
    expect(within(dialog).getByLabelText('Importe *')).toHaveValue(300000)
    expect(within(dialog).getByText(/El gasto queda pagado completo/)).toBeInTheDocument()
  })

  it('registra un movimiento por cada caja con su importe', async () => {
    const user = userEvent.setup()
    vi.mocked(addSettlement).mockResolvedValue(expense)
    const { dialog, onSaved } = renderModal()
    await waitFor(() => expect(within(dialog).getByLabelText('Cuenta *')).not.toBeDisabled())

    await user.selectOptions(within(dialog).getByLabelText('Cuenta *'), 'caja-juan')
    await user.clear(within(dialog).getByLabelText('Importe *'))
    await user.type(within(dialog).getByLabelText('Importe *'), '200000')
    await user.click(within(dialog).getByRole('button', { name: /Sumar otra caja/ }))

    // La segunda fila propone lo que falta y no ofrece la caja ya elegida.
    expect(within(dialog).getByLabelText('Importe 2 *')).toHaveValue(100000)
    const second = within(dialog).getByLabelText('Cuenta 2 *')
    expect(within(second).queryByRole('option', { name: /Caja Juan/ })).toBeNull()
    await user.selectOptions(second, 'caja-lucas')

    await user.click(within(dialog).getByRole('button', { name: 'Registrar 2 pagos' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(addSettlement).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(addSettlement).mock.calls
    expect(calls[0]?.[2]).toMatchObject({ accountId: 'caja-juan', amount: '200000.00' })
    expect(calls[1]?.[2]).toMatchObject({ accountId: 'caja-lucas', amount: '100000.00' })
    expect(calls[0]?.[2].idempotencyKey).not.toBe(calls[1]?.[2].idempotencyKey)
  })

  it('no deja registrar más que el saldo pendiente', async () => {
    const user = userEvent.setup()
    const { dialog } = renderModal()
    await waitFor(() => expect(within(dialog).getByLabelText('Cuenta *')).not.toBeDisabled())
    await user.clear(within(dialog).getByLabelText('Importe *'))
    await user.type(within(dialog).getByLabelText('Importe *'), '350000')
    expect(within(dialog).getByText(/Supera el saldo/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Registrar pago' })).toBeDisabled()
  })

  it('si falla la segunda caja conserva la primera y reintenta sólo la que falta', async () => {
    const user = userEvent.setup()
    vi.mocked(addSettlement)
      .mockResolvedValueOnce(expense)
      .mockRejectedValueOnce(new ApiError(409, 'Conflict', { message: 'Payment exceeds expense balance' }))
      .mockResolvedValueOnce(expense)
    const { dialog, onSaved } = renderModal()
    await waitFor(() => expect(within(dialog).getByLabelText('Cuenta *')).not.toBeDisabled())
    await user.selectOptions(within(dialog).getByLabelText('Cuenta *'), 'caja-juan')
    await user.clear(within(dialog).getByLabelText('Importe *'))
    await user.type(within(dialog).getByLabelText('Importe *'), '200000')
    await user.click(within(dialog).getByRole('button', { name: /Sumar otra caja/ }))
    await user.selectOptions(within(dialog).getByLabelText('Cuenta 2 *'), 'caja-lucas')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar 2 pagos' }))

    // SweetAlert deja el resto de la página con aria-hidden: se busca por texto.
    await waitFor(() => expect(within(dialog).getByText(/Se registraron 1 de 2 pagos/)).toBeInTheDocument())
    expect(within(dialog).getByText('Registrado')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Registrar pago', hidden: true }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const calls = vi.mocked(addSettlement).mock.calls
    expect(calls).toHaveLength(3)
    // El reintento usa la misma clave: si el servidor ya lo había guardado, no se duplica.
    expect(calls[2]?.[2].idempotencyKey).toBe(calls[1]?.[2].idempotencyKey)
    expect(calls[2]?.[2]).toMatchObject({ accountId: 'caja-lucas' })
  })
})
