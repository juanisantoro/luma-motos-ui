import { describe, expect, it } from 'vitest'
import { availableOperationActions } from './operationActions'

const activeReservation = {
  id: 'reservation-1',
  unitId: 'unit-1',
  supplierAvailabilityId: null,
  status: 'ACTIVO',
  quantity: 1,
  expiresAt: null,
  releasedAt: null,
  releaseReason: null,
} as const

const all = ['ventas.gestionar', 'ventas.cerrar', 'ventas.cancelar']

describe('availableOperationActions', () => {
  it('ofrece enviar y cancelar un borrador', () => {
    expect(
      availableOperationActions({ status: 'BORRADOR', reservation: null }, all),
    ).toEqual(['submit', 'cancel'])
  })

  it('no ofrece enviar sin ventas.gestionar', () => {
    expect(
      availableOperationActions({ status: 'BORRADOR', reservation: null }, []),
    ).toEqual([])
  })

  it('ofrece cerrar sólo una aprobada con reserva física activa y permiso', () => {
    expect(
      availableOperationActions(
        { status: 'APROBADA', reservation: activeReservation },
        all,
      ),
    ).toEqual(['close', 'cancel'])
    expect(
      availableOperationActions(
        {
          status: 'APROBADA',
          reservation: { ...activeReservation, unitId: null, supplierAvailabilityId: 'a-1' },
        },
        all,
      ),
    ).toEqual(['cancel'])
    expect(
      availableOperationActions(
        { status: 'APROBADA', reservation: activeReservation },
        ['ventas.gestionar'],
      ),
    ).toEqual([])
  })

  it('no ofrece acciones en estados terminales', () => {
    for (const status of ['CERRADA', 'CANCELADA'] as const) {
      expect(availableOperationActions({ status, reservation: null }, all)).toEqual([])
    }
  })

  it('no permite reenviar una pendiente ni una rechazada sin editar', () => {
    expect(
      availableOperationActions({ status: 'PENDIENTE_APROBACION', reservation: null }, all),
    ).toEqual(['cancel'])
    expect(
      availableOperationActions({ status: 'RECHAZADA', reservation: null }, all),
    ).toEqual(['cancel'])
  })
})
