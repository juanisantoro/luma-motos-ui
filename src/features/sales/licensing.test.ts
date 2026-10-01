import { describe, expect, it } from 'vitest'
import {
  addBusinessDays,
  canRegisterPlate,
  formatIsoDate,
  isValidPlate,
  licensingEstimate,
  licensingStatusClass,
  licensingWindowLabel,
  plateStatusClass,
  plateStatusLabel,
  plateStatusOf,
} from './licensing'
import { licensingFixture, operationFixture } from './licensing.fixtures'

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

  it('saltea los feriados nacionales que devuelve la API', () => {
    const holidays = new Set(['2026-10-12'])
    // Viernes 9/10 + 1 hábil = martes 13 (el lunes 12 es feriado).
    expect(addBusinessDays('2026-10-09', 1, holidays)).toBe('2026-10-13')
    expect(licensingEstimate('2026-10-05', holidays)).toEqual({
      from: '2026-10-20',
      to: '2026-10-27',
    })
    // Sin calendario cuenta de lunes a viernes.
    expect(licensingEstimate('2026-10-05')).toEqual({
      from: '2026-10-19',
      to: '2026-10-26',
    })
  })

  it('arma los estados de la patente', () => {
    const window = { estimatedFrom: '2026-09-11', estimatedTo: '2026-09-18' }
    expect(plateStatusLabel('EN_TRAMITE', window)).toBe(
      'Patente en trámite (estimada entre 11/09/2026 y 18/09/2026)',
    )
    expect(
      plateStatusLabel('EN_TRAMITE', { estimatedFrom: null, estimatedTo: null }),
    ).toBe('Patente en trámite')
    expect(plateStatusLabel('RECIBIDA_COBRO_PENDIENTE', window)).toBe(
      'Patente recibida, pago pendiente',
    )
    expect(plateStatusLabel('RECIBIDA_COBRADA', window)).toBe(
      'Patente recibida y paga',
    )
    expect(plateStatusClass('RECIBIDA_COBRADA')).toBe('status-badge--success')
    expect(plateStatusClass('EN_TRAMITE_VENCIDA')).toBe('status-badge--warning')
  })

  it('deduce el estado de patente de respuestas anteriores a la fase 5', () => {
    expect(plateStatusOf(licensingFixture())).toBe('EN_TRAMITE')
    expect(plateStatusOf(licensingFixture({ overdue: true }))).toBe(
      'EN_TRAMITE_VENCIDA',
    )
    expect(plateStatusOf(licensingFixture({ plateLoaded: true }))).toBe(
      'RECIBIDA',
    )
    expect(
      plateStatusOf(
        licensingFixture({
          plate: { status: 'RECIBIDA_COBRADA', number: 'A1', receivedAt: null },
        }),
      ),
    ).toBe('RECIBIDA_COBRADA')
  })

  it('sólo permite cargar la patente con unidad y modalidad definida', () => {
    expect(canRegisterPlate(operationFixture())).toBe(true)
    expect(canRegisterPlate(operationFixture({ status: 'BORRADOR' }))).toBe(false)
    expect(
      canRegisterPlate(
        operationFixture({ licensing: licensingFixture({ mode: null }) }),
      ),
    ).toBe(false)
    expect(
      canRegisterPlate(
        operationFixture({
          vehicle: { ...operationFixture().vehicle, unit: null },
        }),
      ),
    ).toBe(false)
    expect(isValidPlate('a123 bcd')).toBe(true)
    expect(isValidPlate('AB-1')).toBe(false)
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
