import { describe, expect, it } from 'vitest'
import {
  accountForRecipient,
  cashAccountLabel,
  sortCashAccounts,
  usableCashAccounts,
} from './cashAccounts'
import { incomeCollectionLines } from './components/FinancialRecordList'
import type { CashAccount, Income } from './types'

function account(overrides: Partial<CashAccount>): CashAccount {
  return {
    id: 'account',
    code: 'CAJA',
    name: 'Caja',
    type: 'CAJA',
    branchId: null,
    responsiblePersonnelId: null,
    currency: 'ARS',
    active: true,
    balance: '0',
    ...overrides,
  }
}

const lucas = account({
  id: 'lucas',
  code: 'CAJA_LUCAS',
  name: 'Caja Lucas',
  type: 'SOCIO',
  responsiblePersonnelId: 'p-lucas',
  responsiblePersonnel: { id: 'p-lucas', fullName: 'Lucas' },
})
const bank = account({
  id: 'bank',
  code: 'BANCO_NICO',
  name: 'Banco Galicia',
  type: 'BANCO',
  responsiblePersonnelId: 'p-nico',
  responsiblePersonnel: { id: 'p-nico', fullName: 'Nicolás' },
})
const delViso = account({
  id: 'dv',
  code: 'CAJA_DV',
  name: 'Caja Del Viso',
  branchId: 'branch-dv',
})
const historic = account({
  id: 'hist',
  code: 'HIST-0123456789ABCDEF01234567',
  name: 'Cuenta historica importada: JUAN',
  imported: true,
  importedLabel: 'Juan',
})

describe('cuentas de caja', () => {
  it('muestra nombre, responsable y tipo, sin el código', () => {
    expect(cashAccountLabel(bank)).toBe(
      'Banco Galicia · Nicolás · Cuenta bancaria',
    )
    // No repite al responsable si ya está en el nombre.
    expect(cashAccountLabel(lucas)).toBe('Caja Lucas · Caja de socio')
  })

  it('muestra las importadas como "Histórica: Fulano"', () => {
    expect(cashAccountLabel(historic)).toBe('Histórica: Juan')
    // Respuestas viejas sin `imported`: se infiere del código HIST-.
    expect(
      cashAccountLabel({
        code: 'HIST-ABC',
        name: 'Cuenta historica importada: Lucas',
      }),
    ).toBe('Histórica: Lucas')
  })

  it('ordena las importadas al final', () => {
    expect(
      sortCashAccounts([historic, lucas, bank]).map((item) => item.id),
    ).toEqual(['bank', 'lucas', 'hist'])
  })

  it('ofrece las cuentas de la sucursal y las compartidas', () => {
    const ids = usableCashAccounts(
      [lucas, bank, delViso, account({ id: 'off', active: false })],
      { branchId: 'branch-sm', currency: 'ARS' },
    ).map((item) => item.id)
    expect(ids).toEqual(['bank', 'lucas'])
    // La API también puede traer sólo `branch` (sin `branchId`).
    const legacy = {
      ...delViso,
      branchId: undefined as unknown as null,
      branch: { id: 'branch-dv', code: 'DV', name: 'Del Viso' },
    }
    expect(
      usableCashAccounts([legacy], { branchId: 'branch-dv' }),
    ).toHaveLength(1)
    expect(
      usableCashAccounts([legacy], { branchId: 'branch-sm' }),
    ).toHaveLength(0)
  })

  it('propone la caja de quien recibe la rendición', () => {
    expect(accountForRecipient([bank, lucas, historic], 'p-lucas')?.id).toBe(
      'lucas',
    )
    expect(accountForRecipient([bank, lucas], 'p-otro')).toBeNull()
    // Quien sólo tiene cuenta bancaria no recibe propuesta para efectivo.
    expect(accountForRecipient([bank, lucas], 'p-nico')).toBeNull()
  })
})

describe('cobro de un ingreso en la lista', () => {
  const base = {
    account: { id: 'lucas', code: 'CAJA_LUCAS', name: 'Caja Lucas', type: 'SOCIO' },
    paymentMethod: 'EFECTIVO',
    collectedBy: { id: 'p-vend', fullName: 'Vendedor' },
  } as unknown as Income

  it('muestra cuenta, medio, quién cobró y a quién rinde', () => {
    expect(
      incomeCollectionLines({
        ...base,
        handover: {
          status: 'PENDIENTE_RENDICION',
          recipient: { id: 'p-lucas', fullName: 'Lucas' },
          confirmedAt: null,
          confirmedBy: null,
        },
      }),
    ).toEqual([
      'Caja Lucas · Caja de socio',
      'Efectivo · cobró Vendedor',
      'Pendiente de rendición: rinde a Lucas',
    ])
  })

  it('distingue lo ya rendido y los ingresos sin cobro', () => {
    expect(
      incomeCollectionLines({
        ...base,
        handover: {
          status: 'RENDIDO',
          recipient: { id: 'p-lucas', fullName: 'Lucas' },
          confirmedAt: '2026-10-02T12:00:00.000Z',
          confirmedBy: { id: 'p-lucas', fullName: 'Lucas' },
        },
      }).at(-1),
    ).toBe('Rendido a Lucas')
    expect(incomeCollectionLines({} as Income)).toEqual([
      'Sin cobro registrado',
    ])
  })
})
