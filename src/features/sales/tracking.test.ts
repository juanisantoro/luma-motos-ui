import { describe, expect, it } from 'vitest'
import { trackingQuery } from './OperationTrackingPanel'
import {
  canConfirmHandover,
  collectibleComponents,
  defaultPaymentMethod,
  trackingSearch,
  type OperationTrackingRow,
  type TrackingIncome,
} from './tracking'
import { trackingRowFixture, trackingIncomeFixture } from './tracking.fixtures'

describe('seguimiento de operaciones - reglas', () => {
  it('no filtra por saldo ni efectivo cuando las casillas están destildadas', () => {
    const query = trackingQuery(
      {
        branchId: '',
        status: '',
        search: '  B-0042 ',
        from: '2026-09-01',
        to: '',
        withBalance: false,
        withPendingCash: true,
        withFinancingPending: true,
      },
      'MOTO',
      2,
    )

    expect(query).toEqual({
      vehicleType: 'MOTO',
      page: 2,
      limit: 20,
      search: 'B-0042',
      from: '2026-09-01',
      withPendingCash: true,
      withFinancingPending: true,
    })
    expect(trackingSearch(query)).toBe(
      'vehicleType=MOTO&page=2&limit=20&search=B-0042&from=2026-09-01&withPendingCash=true&withFinancingPending=true',
    )
  })

  it('sólo el destinatario confirma efectivo cobrado y pendiente', () => {
    const pending: TrackingIncome = trackingIncomeFixture()

    expect(canConfirmHandover(pending, 'recipient-1')).toBe(true)
    expect(canConfirmHandover(pending, 'seller-1')).toBe(false)
    expect(canConfirmHandover(pending, null)).toBe(false)
    expect(
      canConfirmHandover({ ...pending, collectedAmount: '0' }, 'recipient-1'),
    ).toBe(false)
    expect(
      canConfirmHandover(
        {
          ...pending,
          handover: { ...pending.handover!, status: 'RENDIDO' },
        },
        'recipient-1',
      ),
    ).toBe(false)
  })

  it('ofrece cobrar sólo componentes cobrables con saldo', () => {
    const row: OperationTrackingRow = trackingRowFixture()

    expect(collectibleComponents(row).map((item) => item.id)).toEqual([
      'component-cash',
    ])
    expect(defaultPaymentMethod('FINANCIACION')).toBe('DESEMBOLSO_FINANCIERA')
    expect(defaultPaymentMethod('TOMA_PARTE_PAGO')).toBeNull()
  })
})
