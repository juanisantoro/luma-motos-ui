import { describe, expect, it } from 'vitest'
import { formatDay, workMonthBounds, workMonthRangeLabel, type WorkMonths } from './workMonths'

const months: WorkMonths = {
  current: '2026-10',
  months: [
    {
      period: '2026-10',
      from: '2026-09-28',
      to: '2026-10-27',
      cutDate: '2026-10-27',
      cutMin: '2026-10-15',
      cutMax: '2026-11-14',
      current: true,
      locked: false,
    },
  ],
}

describe('meses de trabajo', () => {
  it('usa las fechas del mes de trabajo cuando las conoce', () => {
    expect(workMonthBounds(months, '2026-10')).toEqual({ from: '2026-09-28', to: '2026-10-27' })
    expect(workMonthRangeLabel(months, '2026-10')).toBe('del 28/09 al 27/10')
  })

  it('usa el mes de almanaque si no conoce el mes', () => {
    expect(workMonthBounds(months, '2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(workMonthBounds(null, '2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(workMonthBounds(months, '')).toEqual({})
  })

  it('formatea días', () => {
    expect(formatDay('2026-09-28')).toBe('28/09')
    expect(formatDay('2026-09-28', true)).toBe('28/09/2026')
  })
})
