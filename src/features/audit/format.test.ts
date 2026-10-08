import { describe, expect, it } from 'vitest'
import { formatMoney } from '../finance/format'
import { cashMovement } from './fixtures'
import {
  argentinaDay,
  auditChanges,
  dayEnd,
  dayStart,
  formatAccountingDate,
  formatDateTime,
  handoverLabel,
} from './format'

describe('audit format', () => {
  it('shows date and time of Argentina with seconds', () => {
    expect(formatDateTime('2026-10-04T15:30:12.000Z')).toBe(
      '04/10/2026 12:30:12',
    )
    // 01:10 UTC todavía es el día anterior en Argentina.
    expect(formatDateTime('2026-10-05T01:10:05.000Z')).toBe(
      '04/10/2026 22:10:05',
    )
    expect(formatDateTime(null)).toBe('—')
  })

  it('turns a day into the Argentine day range', () => {
    expect(dayStart('2026-10-04')).toBe('2026-10-04T00:00:00.000-03:00')
    expect(dayEnd('2026-10-04')).toBe('2026-10-04T23:59:59.999-03:00')
    expect(new Date(dayEnd('2026-10-04')).toISOString()).toBe(
      '2026-10-05T02:59:59.999Z',
    )
  })

  it('computes the Argentine day even when UTC already changed', () => {
    const now = new Date('2026-10-05T01:10:00.000Z')
    expect(argentinaDay(0, now)).toBe('2026-10-04')
    expect(argentinaDay(-6, now)).toBe('2026-09-28')
  })

  it('compares before and after field by field', () => {
    expect(
      auditChanges(
        { amount: '120000', handoverTo: 'Lucas', paymentMethod: 'EFECTIVO' },
        { amount: '150000.5', handoverTo: 'Lucas', paymentMethod: null },
      ),
    ).toEqual([
      {
        key: 'amount',
        label: 'Importe',
        before: formatMoney('120000'),
        after: formatMoney('150000.5'),
        changed: true,
      },
      {
        key: 'handoverTo',
        label: 'Rinde a',
        before: 'Lucas',
        after: 'Lucas',
        changed: false,
      },
      {
        key: 'paymentMethod',
        label: 'Medio de pago',
        before: 'Efectivo',
        after: '—',
        changed: true,
      },
    ])
  })

  it('lists what was stored when there is a single snapshot', () => {
    expect(auditChanges(null, { active: false })).toEqual([
      { key: 'active', label: 'Activo', before: '—', after: 'No', changed: false },
    ])
    expect(auditChanges(null, null)).toEqual([])
  })

  it('describes who received and who confirmed the cash', () => {
    expect(handoverLabel(cashMovement)).toBe(
      'Rendido a Lucas. Confirmó Lucas el 04/10/2026 15:00:00',
    )
    expect(
      handoverLabel({
        ...cashMovement,
        handover: {
          to: { id: 'p-2', fullName: 'Lucas' },
          status: 'PENDIENTE_RENDICION',
          confirmedAt: null,
          confirmedBy: null,
        },
      }),
    ).toBe('Pendiente de rendir a Lucas')
    expect(handoverLabel({ ...cashMovement, handover: null })).toBeNull()
  })

  it('shows the accounting day stored as a date or as an instant', () => {
    expect(formatAccountingDate('2026-10-04T00:00:00.000Z')).toBe('04/10/2026')
    // Reversa hecha el 03/10 a las 22:00 de Argentina.
    expect(formatAccountingDate('2026-10-04T01:00:00.000Z')).toBe('03/10/2026')
  })

  it('tolerates a stored value that is not an object', () => {
    expect(auditChanges(null, 'texto')).toEqual([
      { key: 'value', label: 'Valor', before: '—', after: 'texto', changed: false },
    ])
  })
})
