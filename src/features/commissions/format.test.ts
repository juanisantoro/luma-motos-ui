import { describe, expect, it } from 'vitest'
import { commissionOperationStatus, nonComputableReasonText } from './format'

describe('textos de operaciones en comisiones', () => {
  it('muestra el estado de la venta con palabras, no con el código', () => {
    expect(commissionOperationStatus('PENDIENTE_APROBACION')).toBe('Pendiente')
    expect(commissionOperationStatus('APROBADA')).toBe('Aprobada')
    // Un estado desconocido se muestra tal cual, sin romper.
    expect(commissionOperationStatus('OTRO')).toBe('OTRO')
  })

  it('explica por qué una venta no computa según su estado', () => {
    expect(
      nonComputableReasonText('STATUS_NOT_ELIGIBLE', 'PENDIENTE_APROBACION'),
    ).toBe('Espera aprobación: cuenta cuando se apruebe.')
    expect(nonComputableReasonText('STATUS_NOT_ELIGIBLE', 'RECHAZADA')).toBe(
      'Fue rechazada.',
    )
    expect(nonComputableReasonText('STATUS_NOT_ELIGIBLE', 'OTRO')).toBe(
      'No cuenta por su estado.',
    )
    expect(nonComputableReasonText(null, 'APROBADA')).toBeNull()
    expect(nonComputableReasonText('Motivo libre', 'APROBADA')).toBe(
      'Motivo libre',
    )
  })
})
