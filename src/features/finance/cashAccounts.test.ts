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

  it('ofrece sólo cuentas activas y reconoce la sucursal aunque venga en `branch`', () => {
    const ids = usableCashAccounts(
      [lucas, bank, delViso, account({ id: 'off', active: false })],
      // Las dos primeras son compartidas: van con un registro "General".
      { branchId: null, currency: 'ARS' },
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

  it('sólo ofrece cuentas de la moneda del registro y aclara las que no son pesos', () => {
    const lucasUsd = account({
      ...lucas,
      id: 'lucas-usd',
      code: 'CAJA_LUCAS_USD',
      name: 'Caja Lucas dólares',
      currency: 'USD',
    })
    const all = [lucas, bank, lucasUsd]
    expect(
      usableCashAccounts(all, { currency: 'USD' }).map((item) => item.id),
    ).toEqual(['lucas-usd'])
    expect(
      usableCashAccounts(all, { currency: 'ARS' }).map((item) => item.id),
    ).not.toContain('lucas-usd')
    expect(cashAccountLabel(lucasUsd)).toBe(
      'Caja Lucas dólares · Caja de socio · USD',
    )
    // El efectivo en dólares va a la caja en dólares de quien lo recibe.
    expect(
      accountForRecipient(usableCashAccounts(all, { currency: 'USD' }), 'p-lucas')
        ?.id,
    ).toBe('lucas-usd')
  })

  it('no ofrece las históricas importadas para cobrar o pagar', () => {
    const historic = account({
      id: 'hist',
      code: 'HIST-0123456789ABCDEF01234567',
      name: 'Cuenta historica importada: Juan Pablo Capdevilla',
      imported: true,
    })
    expect(
      usableCashAccounts([lucas, historic], {}).map((item) => item.id),
    ).toEqual(['lucas'])
    // Tampoco si una respuesta vieja no trae `imported`: alcanza el código.
    expect(
      usableCashAccounts([{ ...historic, imported: undefined } as never], {}),
    ).toEqual([])
  })

  it('ofrece sólo las cajas de la sucursal del registro, o las compartidas si es general', () => {
    const sanMiguel = account({ id: 'sm', code: 'SM', branchId: 'branch-1' })
    const delViso = account({ id: 'dv', code: 'DV', branchId: 'branch-2' })
    const shared = account({ id: 'shared', code: 'COMP', branchId: null })
    const all = [sanMiguel, delViso, shared]
    const ids = (branchId?: string | null) =>
      usableCashAccounts(all, branchId === undefined ? {} : { branchId })
        .map((item) => item.id)
        .sort()
    expect(ids('branch-1')).toEqual(['sm'])
    // Registro "General" (sin sucursal): sólo las compartidas.
    expect(ids(null)).toEqual(['shared'])
    // Sin indicar sucursal no se filtra.
    expect(ids()).toEqual(['dv', 'shared', 'sm'])
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
      'Falta que Lucas confirme que recibió el efectivo',
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
    ).toBe('Lucas confirmó que recibió el efectivo')
    expect(incomeCollectionLines({} as Income)).toEqual([
      'Sin cobro registrado',
    ])
  })
})
