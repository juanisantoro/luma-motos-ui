import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CashAccountsPage } from './CashAccountsPage'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  listAccounts: vi.fn(),
  listBranches: vi.fn(),
  listRecipients: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  alertSuccess: vi.fn(),
  alertError: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      globalAccess: false,
      organization: { id: 'org-1', name: 'Luma', code: 'LUMA_CENTRAL' },
      branch: null,
      branchScope: { allBranches: true, branches: [] },
      role: { code: 'ADMINISTRADOR', permissions: mocks.permissions },
    },
  }),
}))

vi.mock('./api', () => ({
  listAllCashAccounts: mocks.listAccounts,
  listInventoryBranches: mocks.listBranches,
  createCashAccount: mocks.create,
  updateCashAccount: mocks.update,
}))

vi.mock('../sales/tracking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sales/tracking')>()),
  listHandoverRecipients: mocks.listRecipients,
}))

vi.mock('../../shared/alerts', () => ({
  alertSuccess: mocks.alertSuccess,
  alertError: mocks.alertError,
}))

const lucasAccount = {
  id: 'account-lucas',
  code: 'CAJA_LUCAS',
  name: 'Caja Lucas',
  type: 'SOCIO',
  branchId: null,
  branch: null,
  responsiblePersonnelId: 'p-lucas',
  responsiblePersonnel: { id: 'p-lucas', fullName: 'Lucas' },
  currency: 'ARS',
  active: true,
  balance: '150000',
  imported: false,
  importedLabel: null,
}

const historicAccount = {
  id: 'account-hist',
  code: 'HIST-0123456789ABCDEF01234567',
  name: 'Cuenta historica importada: NICO',
  type: 'CAJA',
  branchId: 'branch-1',
  branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
  responsiblePersonnelId: null,
  responsiblePersonnel: null,
  currency: 'ARS',
  active: true,
  balance: '0',
  imported: true,
  importedLabel: 'Nico',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = [
    'caja.consultar',
    'caja.cuentas.gestionar',
    'sucursales.todas',
  ]
  mocks.listAccounts.mockResolvedValue([lucasAccount, historicAccount])
  mocks.listBranches.mockResolvedValue([
    { id: 'branch-1', code: 'SM', name: 'San Miguel', organizationId: 'org-1' },
    { id: 'branch-2', code: 'DV', name: 'Del Viso', organizationId: 'org-1' },
  ])
  mocks.listRecipients.mockResolvedValue([
    { id: 'p-lucas', fullName: 'Lucas', isCurrentUser: true, pendingCount: 0, pendingAmount: '0' },
    { id: 'p-nico', fullName: 'Nicolás', isCurrentUser: false, pendingCount: 0, pendingAmount: '0' },
  ])
  mocks.create.mockResolvedValue({})
  mocks.update.mockResolvedValue({})
})

describe('Cuentas de caja', () => {
  it('lista las cuentas propias y oculta las históricas hasta pedirlas', async () => {
    const user = userEvent.setup()
    render(<CashAccountsPage />)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Caja Lucas')).toBeInTheDocument()
    expect(within(table).getByText('Compartida')).toBeInTheDocument()
    expect(within(table).queryByText('Histórica: Nico')).not.toBeInTheDocument()
    // Pide las inactivas: la pantalla administra todas.
    expect(mocks.listAccounts).toHaveBeenCalledWith(expect.anything(), true)

    await user.click(screen.getByRole('checkbox'))
    expect(await screen.findByText('Histórica: Nico')).toBeInTheDocument()
    expect(screen.queryByText(/HIST-/)).not.toBeInTheDocument()
  })

  it('avisa qué destinatarios de rendición no tienen cuenta', async () => {
    render(<CashAccountsPage />)
    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent('Nicolás')
    expect(notice).not.toHaveTextContent('Lucas')
  })

  it('crea una cuenta bancaria con responsable y sin sucursal', async () => {
    const user = userEvent.setup()
    render(<CashAccountsPage />)
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nueva cuenta' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Nombre/), 'Banco Nicolás')
    await user.selectOptions(within(dialog).getByLabelText(/Tipo/), 'BANCO')
    await user.selectOptions(
      within(dialog).getByLabelText(/Responsable/),
      'p-nico',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar cuenta' }),
    )

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        name: 'Banco Nicolás',
        type: 'BANCO',
        branchId: null,
        responsiblePersonnelId: 'p-nico',
        active: true,
      }),
    )
    expect(mocks.alertSuccess).toHaveBeenCalled()
  })

  it('edita y desactiva una cuenta', async () => {
    const user = userEvent.setup()
    render(<CashAccountsPage />)
    await screen.findByRole('table')

    await user.click(
      screen.getByRole('button', { name: /^Editar Caja Lucas/ }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/Responsable/)).toHaveValue('p-lucas')
    await user.selectOptions(within(dialog).getByLabelText(/Sucursal/), 'branch-2')
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar cuenta' }),
    )
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        'account-lucas',
        expect.objectContaining({ branchId: 'branch-2', type: 'SOCIO' }),
      ),
    )

    await user.click(
      await screen.findByRole('button', { name: /^Desactivar Caja Lucas/ }),
    )
    await waitFor(() =>
      expect(mocks.update).toHaveBeenLastCalledWith('account-lucas', {
        active: false,
      }),
    )
  })

  it('sin caja.cuentas.gestionar sólo consulta', async () => {
    // caja.gestionar (gerente) ya no alcanza para administrar cuentas.
    mocks.permissions = ['caja.consultar', 'caja.gestionar']
    render(<CashAccountsPage />)
    await screen.findByRole('table')
    expect(
      screen.queryByRole('button', { name: 'Nueva cuenta' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Editar/ }),
    ).not.toBeInTheDocument()
  })
})
