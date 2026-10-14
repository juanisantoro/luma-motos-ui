import { describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { salesErrorMessage } from './errors'

const generic = 'La operación no es válida en su estado actual o contiene datos incorrectos.'

describe('Mensajes de error de ventas', () => {
  it('traduce el motivo que da el servidor', () => {
    expect(
      salesErrorMessage(
        new ApiError(400, 'Credit amount cannot exceed the agreed price', {
          message: 'Credit amount cannot exceed the agreed price',
        }),
      ),
    ).toBe(`${generic} Motivo: El crédito no puede ser mayor que el precio de cierre.`)
  })

  it('traduce por código', () => {
    expect(
      salesErrorMessage(
        new ApiError(400, 'x', { code: 'GUARANTOR_DOCUMENT_INVALID', message: 'x' }),
      ),
    ).toBe(`${generic} Motivo: El DNI del garante no es válido (de 6 a 11 números).`)
  })

  it('nombra el campo en las validaciones del servidor', () => {
    expect(
      salesErrorMessage(
        new ApiError(400, 'x', {
          message: ['licensingAmount must not be less than 0.01', 'property foo should not exist'],
        }),
      ),
    ).toBe(
      `${generic} Motivo: "Monto de patente" tiene un valor no válido. El servidor no acepta el dato "foo".`,
    )
  })

  it('muestra el código cuando no sabe traducirlo', () => {
    expect(
      salesErrorMessage(new ApiError(400, 'Something new', { code: 'NEW_CODE', message: 'Something new' })),
    ).toBe(`${generic} Motivo: Código: NEW_CODE.`)
  })

  it('no muestra el error en inglés de un 500', () => {
    expect(salesErrorMessage(new ApiError(500, 'Internal server error'))).toMatch(
      /^Ocurrió un error en el servidor/,
    )
  })
})
