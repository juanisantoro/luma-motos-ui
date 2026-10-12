import { describe, expect, it } from 'vitest'
import { ALL_BRANCHES, branchView, partnerView } from './balance'
import { juan, sampleBalance, sm } from './balance.fixture'

const row = (rows: ReturnType<typeof branchView>['table']['rows'], label: string) =>
  rows.find((item) => item.label === label)

describe('branchView', () => {
  it('suma por sucursal y resta lo que costaron las unidades vendidas', () => {
    const view = branchView(sampleBalance, ALL_BRANCHES, 'cogs')

    expect(view.table.columns.map((column) => column.label)).toEqual([
      'Del Viso',
      'San Miguel',
      'Generales',
      'Total',
    ])
    expect(row(view.table.rows, 'Total ingresos')?.values).toEqual([2700000, 1000000, 0, 3700000])
    expect(row(view.table.rows, 'Lo que costaron las motos y autos vendidos')?.values).toEqual([
      -1700000, -2000000, 0, -3700000,
    ])
    expect(row(view.table.rows, 'Total egresos')?.values).toEqual([-60000, -410000, -145000, -615000])
    expect(row(view.table.rows, 'Resultado del mes')?.values).toEqual([940000, -1410000, -145000, -615000])
    expect(view.income).toBe(3700000)
    expect(view.result).toBe(-615000)
    expect(view.purchases).toBe(900000)
    expect(view.unpaidExpenses).toBe(90000)
    expect(view.pendingSales).toEqual({ amount: 3500000, operations: 2 })
    // Las compras no restan: son stock.
    expect(view.table.rows.some((item) => item.label === 'Compras a proveedores')).toBe(false)
  })

  it('deja afuera las unidades y filtra una sucursal', () => {
    const view = branchView(sampleBalance, sm, 'none')

    expect(view.table.columns.map((column) => column.label)).toEqual(['San Miguel', 'Total'])
    expect(view.table.rows.some((item) => item.label === 'Costo de lo vendido')).toBe(false)
    expect(row(view.table.rows, 'Ingresos menos egresos')?.values).toEqual([590000, 590000])
    expect(view.pendingSales).toEqual({ amount: 2000000, operations: 1 })
    // Sin gastos de motos en Del Viso: el grupo vacío no aparece.
    expect(row(view.table.rows, 'Gastos de motos y autos')).toBeDefined()
    expect(row(view.table.rows, 'Patente')).toBeUndefined()
  })
})

describe('partnerView', () => {
  it('reparte lo cobrado y pagado por caja, sin el costo de lo vendido', () => {
    const view = partnerView(sampleBalance, ALL_BRANCHES)

    expect(view.table.columns.map((column) => column.label)).toEqual(['Juan Capdevila', 'Sin caja', 'Total'])
    expect(view.partners).toEqual([
      { key: juan, name: 'Juan Capdevila', collected: 3500000, paid: 480000, net: 3020000 },
      { key: 'NONE', name: 'Sin caja', collected: 200000, paid: 135000, net: 65000 },
    ])
    expect(row(view.table.rows, 'Gastos generales')?.values).toEqual([-340000, -60000, -400000])
    expect(row(view.table.rows, 'Neto después de compras')?.values).toEqual([2520000, -335000, 2185000])
    expect(view.table.rows.some((item) => item.label.includes('costaron'))).toBe(false)
  })
})
