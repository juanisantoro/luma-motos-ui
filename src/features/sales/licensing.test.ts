import { describe, expect, it } from 'vitest'
import {
  addBusinessDays,
  formatIsoDate,
  licensingEstimate,
  licensingStatusClass,
  licensingWindowLabel,
} from './licensing'

describe('patentamiento', () => {
  it('suma días hábiles salteando fines de semana, igual que la API', () => {
    expect(addBusinessDays('2026-09-25', 1)).toBe('2026-09-28')
    expect(addBusinessDays('2026-09-26', 1)).toBe('2026-09-28')
    expect(licensingEstimate('2026-08-28')).toEqual({
      from: '2026-09-11',
      to: '2026-09-18',
    })
    expect(licensingEstimate('2026-09-07')).toEqual({
      from: '2026-09-21',
      to: '2026-09-28',
    })
  })

  it('no inventa fechas con una fecha inválida', () => {
    expect(licensingEstimate('')).toBeNull()
    expect(formatIsoDate(null)).toBe('—')
    expect(licensingWindowLabel(null, null)).toBe('Sin fecha estimada')
  })

  it('arma el texto de la ventana estimada', () => {
    expect(licensingWindowLabel('2026-09-11', '2026-09-18')).toBe(
      'Patente estimada entre 11/09/2026 y 18/09/2026',
    )
  })

  it('usa badge de éxito sólo cuando está cobrado o pagado', () => {
    expect(licensingStatusClass('COBRADO')).toBe('status-badge--success')
    expect(licensingStatusClass('PAGADO')).toBe('status-badge--success')
    expect(licensingStatusClass('PAGO_PENDIENTE')).toBe('status-badge--warning')
    expect(licensingStatusClass('SIN_DEFINIR')).toBe('')
  })
})
