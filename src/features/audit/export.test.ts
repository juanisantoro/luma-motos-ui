import { describe, expect, it } from 'vitest'
import type { ExcelColumn } from '../../shared/export/excel'
import {
  describeActivityFilters,
  describeMoneyFilters,
  eventColumns,
  movementColumns,
  summaryColumns,
} from './export'
import { cashMovement, handoverEvent } from './fixtures'

function rowOf<T>(columns: Array<ExcelColumn<T>>, row: T) {
  return Object.fromEntries(
    columns.map((column) => [column.header, column.value(row) ?? null]),
  )
}

describe('audit Excel export', () => {
  it('exports the event with its amount as a number and the date and time', () => {
    expect(rowOf(eventColumns, handoverEvent)).toMatchObject({
      'Fecha y hora': '2026-10-04T15:30:12.000Z',
      Usuario: 'Carla Caja',
      Correo: 'carla@luma.test',
      Rol: 'Administrativa',
      Sucursal: 'San Miguel',
      Módulo: 'Dinero y caja',
      Acción: 'Ingreso modificado',
      'Sobre qué': 'Ingreso: SEÑA',
      Importe: '150000.5',
      'N.º operación': '120',
      IP: '10.0.0.1',
    })
    expect(eventColumns.find((column) => column.header === 'Importe')?.type).toBe('money')
    expect(eventColumns[0]?.type).toBe('datetime')
  })

  it('exports money movements with entry and exit amounts as money', () => {
    const row = rowOf(movementColumns, cashMovement)
    expect(row).toMatchObject({
      Fecha: '2026-10-03',
      Cuenta: 'Caja Lucas',
      Moneda: 'ARS',
      Medio: 'Efectivo',
      Entrada: '150000.5',
      Salida: null,
      Registró: 'Vera Vendedora',
    })
    expect(
      rowOf(movementColumns, { ...cashMovement, amount: null }).Entrada,
    ).toBe('Reservado')
    expect(
      movementColumns
        .filter((column) => column.type === 'money')
        .map((column) => column.header),
    ).toEqual(['Entrada', 'Salida'])
  })

  it('exports the per-account summary with the net amount', () => {
    expect(
      rowOf(summaryColumns, {
        account: { id: 'a', name: 'Caja Lucas', type: 'SOCIO' },
        branch: null,
        currency: 'ARS',
        credit: '150000.5',
        debit: '30000',
        pendingHandover: '0',
      }),
    ).toEqual({
      Sucursal: 'Compartida',
      Caja: 'Caja Lucas',
      Moneda: 'ARS',
      Entradas: '150000.5',
      Salidas: '30000',
      Neto: '120000.50',
      'Pendiente de rendir': '0',
    })
  })

  it('describes the applied filters with their labels', () => {
    const filters = {
      categories: [{ code: 'DINERO' as const, label: 'Dinero y caja' }],
      actions: [],
      actors: [{ id: 'u', email: 'c@x', name: 'Carla', active: true }],
      accounts: [
        { id: 'acc', name: 'Caja Lucas', currency: 'ARS', branchId: 'b', active: true },
      ],
      branches: [{ id: 'b', code: 'SM', name: 'San Miguel' }],
    }
    expect(
      describeActivityFilters(
        { page: 1, limit: 50, from: '2026-10-01', category: 'DINERO', actorId: 'u' },
        filters,
      ).filter(Boolean),
    ).toEqual(['Desde: 01/10/2026', 'Módulo: Dinero y caja', 'Usuario: Carla'])
    expect(
      describeMoneyFilters(
        { page: 1, limit: 50, branchId: 'b', accountId: 'acc', direction: 'DEBITO', onlyReversals: true },
        filters,
      ).filter(Boolean),
    ).toEqual([
      'Sucursal: San Miguel',
      'Cuenta: Caja Lucas',
      'Sentido: Sólo salidas',
      'Sólo reversados y reversas',
    ])
  })
})
