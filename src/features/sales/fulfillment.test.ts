import { describe, expect, it } from 'vitest'
import { fulfillmentLabel, supplyFulfillmentLabel } from './fulfillment'
import type { SalesFulfillment } from './types'

const base: SalesFulfillment = {
  status: 'PENDIENTE_ASIGNACION',
  supplyRequestId: null,
  supplyStatus: null,
  supplier: null,
  requestedAt: null,
  orderedAt: null,
  dispatchedAt: null,
  receivedAt: null,
}

describe('situación de la unidad', () => {
  it('usa los textos acordados para la grilla', () => {
    expect(fulfillmentLabel(base)).toBe('Pendiente de asignar unidad')
    expect(
      fulfillmentLabel({
        ...base,
        status: 'PEDIDA',
        supplier: { id: 's', legalName: 'Motos Norte' },
        // 01:00 UTC del 26 es el 25 en Argentina.
        orderedAt: '2026-09-26T01:00:00.000Z',
      }),
    ).toBe('Pedida a Motos Norte (25/09/2026)')
    expect(
      fulfillmentLabel({
        ...base,
        status: 'PENDIENTE_INGRESO',
        supplier: { id: 's', legalName: 'Motos Norte' },
      }),
    ).toBe('Pendiente de ingreso de Motos Norte')
    expect(fulfillmentLabel({ ...base, status: 'ASIGNADA' })).toBe(
      'Recibida / asignada',
    )
  })

  it('usa los mismos textos desde stock', () => {
    const supply = {
      supplier: { name: 'Distribuidora Sur' },
      requestedAt: '2026-09-20T15:00:00.000Z',
    }
    expect(supplyFulfillmentLabel({ ...supply, status: 'PEDIDO' })).toBe(
      'Pedida a Distribuidora Sur (20/09/2026)',
    )
    expect(supplyFulfillmentLabel({ ...supply, status: 'EN_TRANSITO' })).toBe(
      'Pendiente de ingreso de Distribuidora Sur',
    )
    expect(supplyFulfillmentLabel({ ...supply, status: 'ASIGNADO' })).toBe(
      'Recibida / asignada',
    )
  })
})
