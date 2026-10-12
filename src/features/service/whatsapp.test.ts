import { describe, expect, it } from 'vitest'
import type { ServiceOrder } from './types'
import { readyMessage, whatsappLink, whatsappNumber } from './whatsapp'

describe('WhatsApp del cliente', () => {
  it.each([
    ['11 5555-0000', '5491155550000'],
    ['011 15 5555-0000', '5491155550000'],
    ['15 5555-0000', '5491155550000'],
    ['+54 9 11 5555 0000', '5491155550000'],
    ['0351 15 412-3456', '5493514123456'],
    ['3514123456', '5493514123456'],
  ])('arma el número de %s', (phone, expected) => {
    expect(whatsappNumber(phone)).toBe(expected)
  })

  it.each([[null], [''], ['1234'], ['abc']])('descarta lo que no es un celular (%s)', (phone) => {
    expect(whatsappNumber(phone)).toBeNull()
  })

  it('arma el aviso de moto lista con el chat del cliente', () => {
    const order = {
      number: 8,
      client: { name: 'Marta Gómez', phone: '11 5555-0000' },
      vehicle: { model: 'Gilera Smash 110', plate: 'A123BCD' },
      serviceType: { id: 't', name: '2º service' },
      branch: { id: 'b', code: 'SM', name: 'San Miguel' },
    } as unknown as ServiceOrder
    expect(readyMessage(order)).toBe(
      'Hola Marta, te escribimos de Luma Motos. Tu moto Gilera Smash 110 A123BCD ya tiene el 2º service terminado y está lista para retirar en San Miguel. Orden de service N.º 000008.',
    )
    expect(whatsappLink(order)).toMatch(/^https:\/\/wa\.me\/5491155550000\?text=Hola%20Marta/)
  })
})
