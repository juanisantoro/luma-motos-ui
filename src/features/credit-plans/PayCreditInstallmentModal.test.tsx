import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PayCreditInstallmentModal } from './PayCreditInstallmentModal'
import type { CreditInstallment } from './types'

const mocks = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listRecipients: vi.fn(),
}))

vi.mock('../finance/api', () => ({ listAllCashAccounts: mocks.listAccounts }))
vi.mock('../sales/tracking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sales/tracking')>()),
  listHandoverRecipients: mocks.listRecipients,
}))

const installment: CreditInstallment = {
  id: 'installment-1',
  operationCreditId: 'credit-1',
  operationId: 'operation-1',
  operationNumber: '1048',
  clientName: 'Ana Pérez',
  number: 4,
  amount: 60000,
  dueDate: '2026-10-10',
  status: 'PENDIENTE',
  paidAmount: 0,
  paidAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listAccounts.mockResolvedValue([
    { id: 'account-1', code: 'CAJA', name: 'Caja SM', active: true, currency: 'ARS', branchId: null },
  ])
  mocks.listRecipients.mockResolvedValue([
    { id: 'recipient-1', fullName: 'Lucas', isCurrentUser: false, pendingCount: 0, pendingAmount: '0' },
    { id: 'recipient-2', fullName: 'Nicolás', isCurrentUser: false, pendingCount: 0, pendingAmount: '0' },
  ])
})

describe('Cobro de cuota con ingreso a caja', () => {
  it('en efectivo exige a quién se rinde y manda cuenta, medio e idempotencia', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <PayCreditInstallmentModal
        error={null}
        installment={installment}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        submitting={false}
      />,
    )
    await waitFor(() =>
      expect(screen.getByLabelText(/Cuenta de caja/)).toHaveValue('account-1'),
    )

    await user.click(screen.getByRole('button', { name: 'Registrar cobro' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('se rinde')

    await user.selectOptions(screen.getByLabelText(/Se rinde a/), 'recipient-2')
    await user.click(screen.getByRole('button', { name: 'Registrar cobro' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 60000,
        accountId: 'account-1',
        paymentMethod: 'EFECTIVO',
        handoverToId: 'recipient-2',
        idempotencyKey: expect.any(String) as string,
      }),
    )
  })

  it('por transferencia no pide destinatario', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <PayCreditInstallmentModal
        error={null}
        installment={installment}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        submitting={false}
      />,
    )
    await waitFor(() =>
      expect(screen.getByLabelText(/Cuenta de caja/)).toHaveValue('account-1'),
    )
    await user.selectOptions(screen.getByLabelText(/Medio/), 'TRANSFERENCIA_BANCARIA')
    expect(screen.queryByLabelText(/Se rinde a/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar cobro' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({ handoverToId: expect.anything() as unknown }),
    )
  })
})
