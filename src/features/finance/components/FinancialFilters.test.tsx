import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BranchOption, CashAccount, FinancialListQuery } from '../types'
import { FinancialFilters } from './FinancialFilters'

const SM = { id: 'sm', code: 'SM', name: 'San Miguel', organizationId: 'org' }
const DV = { id: 'dv', code: 'DV', name: 'Del Viso', organizationId: 'org' }
const lucas = { id: 'p-lucas', fullName: 'Lucas Medina' }
const juan = { id: 'p-juan', fullName: 'Juan Capdevila' }

function account(overrides: Partial<CashAccount>): CashAccount {
  return {
    id: 'a',
    code: 'A',
    name: 'A',
    type: 'SOCIO',
    branchId: null,
    responsiblePersonnelId: null,
    currency: 'ARS',
    active: true,
    balance: '0',
    ...overrides,
  }
}

// Las cuentas reales de la pantalla del reclamo, reducidas.
const accounts: CashAccount[] = [
  account({ id: 'lucas-sm', name: 'Caja Lucas Medina SM', branchId: SM.id, responsiblePersonnelId: lucas.id, responsiblePersonnel: lucas }),
  account({ id: 'lucas-dv', name: 'Caja Lucas Delviso', branchId: DV.id, responsiblePersonnelId: lucas.id, responsiblePersonnel: lucas }),
  account({ id: 'lucas-usd', name: 'Caja Lucas Dolares DV', branchId: DV.id, currency: 'USD', responsiblePersonnelId: lucas.id, responsiblePersonnel: lucas }),
  account({ id: 'juan-sm', name: 'Caja Juan Capdevila SM', branchId: SM.id, responsiblePersonnelId: juan.id, responsiblePersonnel: juan }),
  // Históricas: una con responsable cargado y otra sólo con el nombre.
  account({ id: 'hist-lucas-medina', code: 'HIST-1', name: 'Cuenta historica importada: Lucas Medina', imported: true, importedLabel: 'Lucas Medina', responsiblePersonnelId: lucas.id, responsiblePersonnel: lucas }),
  account({ id: 'hist-lucas', code: 'HIST-2', name: 'Cuenta historica importada: LUCAS', imported: true, importedLabel: 'LUCAS' }),
  account({ id: 'hist-juan', code: 'HIST-3', name: 'Cuenta historica importada: Juan Pablo Capdevilla', imported: true, importedLabel: 'Juan Pablo Capdevilla' }),
]

vi.mock('../api', () => ({
  listInventoryBranches: () => Promise.resolve([SM, DV] satisfies BranchOption[]),
  listAllCashAccounts: () => Promise.resolve(accounts),
  listAllSuppliers: () => Promise.resolve([]),
}))

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { globalAccess: true, branchScope: { allBranches: true, branches: [] } },
  }),
}))

function optionTexts(select: HTMLElement) {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent)
}

describe('Filtros de ingresos', () => {
  let applied: FinancialListQuery[]
  beforeEach(() => {
    applied = []
  })

  async function renderFilters() {
    const user = userEvent.setup()
    render(<FinancialFilters kind="income" value={{}} onApply={(query) => applied.push(query)} />)
    await waitFor(() =>
      expect(within(screen.getByLabelText('Socio')).getAllByRole('option')).toHaveLength(3),
    )
    return user
  }

  it('con un socio, ofrece sólo sus cuentas y busca en todas ellas, históricas incluidas', async () => {
    const user = await renderFilters()

    await user.selectOptions(screen.getByLabelText('Socio'), lucas.id)
    expect(optionTexts(screen.getByLabelText('Cuenta'))).toEqual([
      'Todas las de Lucas Medina',
      'Caja Lucas Delviso · Lucas Medina · Caja de socio',
      'Caja Lucas Dolares DV · Lucas Medina · Caja de socio · USD',
      'Caja Lucas Medina SM · Caja de socio',
      'Histórica: LUCAS',
      'Histórica: Lucas Medina',
    ])

    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(applied.at(-1)?.accountIds?.split(',').sort()).toEqual(
      ['hist-lucas', 'hist-lucas-medina', 'lucas-dv', 'lucas-sm', 'lucas-usd'],
    )
    expect(applied.at(-1)?.accountId).toBeUndefined()
  })

  it('con una sucursal, deja sólo las cuentas de esa sucursal y las históricas', async () => {
    const user = await renderFilters()

    await user.selectOptions(screen.getByLabelText('Sucursal'), SM.id)
    await user.selectOptions(screen.getByLabelText('Socio'), lucas.id)
    expect(optionTexts(screen.getByLabelText('Cuenta'))).toEqual([
      'Todas las de Lucas Medina',
      'Caja Lucas Medina SM · Caja de socio',
      'Histórica: LUCAS',
      'Histórica: Lucas Medina',
    ])

    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(applied.at(-1)).toMatchObject({ branchId: SM.id })
    expect(applied.at(-1)?.accountIds?.split(',').sort()).toEqual(
      ['hist-lucas', 'hist-lucas-medina', 'lucas-sm'],
    )
  })

  it('una cuenta puntual manda sobre el socio y se descarta si deja de corresponder', async () => {
    const user = await renderFilters()

    await user.selectOptions(screen.getByLabelText('Cuenta'), 'lucas-dv')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(applied.at(-1)).toMatchObject({ accountId: 'lucas-dv' })
    expect(applied.at(-1)?.accountIds).toBeUndefined()

    // Del Viso deja de ofrecerse con San Miguel: no se filtra por ella.
    await user.selectOptions(screen.getByLabelText('Sucursal'), SM.id)
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(applied.at(-1)?.accountId).toBeUndefined()
  })

  it('filtra por medio de pago', async () => {
    const user = await renderFilters()

    await user.selectOptions(screen.getByLabelText('Medio de pago'), 'EFECTIVO')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(applied.at(-1)).toMatchObject({ paymentMethod: 'EFECTIVO' })
  })
})
