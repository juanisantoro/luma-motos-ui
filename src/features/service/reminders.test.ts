import { describe, expect, it } from 'vitest'
import {
  dueLabel,
  reminderMessage,
  reminderWhatsappLink,
} from './reminders'
import { reminderFixture } from './reminders.fixtures'

describe('avisos de service', () => {
  it('arma el mensaje del 1º service con el nombre, la moto y la sucursal', () => {
    const message = reminderMessage(reminderFixture())
    expect(message).toContain('¡Hola Ana! Te escribimos de Luma Motos.')
    expect(message).toContain('tu Honda Wave 110 S (A123BCD) y le toca el 1º service')
    expect(message).toContain('garantía')
    expect(message).toContain('turno en San Miguel')
  })

  it('arma el mensaje del service anual', () => {
    const message = reminderMessage(
      reminderFixture({ stage: 'ANUAL', serviceName: '2º service', lastServiceDate: '2025-10-20' }),
    )
    expect(message).toContain('Se cumple un año del último service de tu Honda Wave 110 S (A123BCD)')
    expect(message).toContain('le toca el 2º service')
    expect(message).not.toContain('garantía')
  })

  it('abre WhatsApp Web con el número argentino y el mensaje', () => {
    const link = reminderWhatsappLink(reminderFixture())!
    expect(link.startsWith('https://web.whatsapp.com/send?phone=5491155550000&text=')).toBe(true)
    expect(link).not.toContain('+')
    expect(decodeURIComponent(link.split('text=')[1]!)).toBe(reminderMessage(reminderFixture()))
    expect(
      reminderWhatsappLink(reminderFixture({ client: { id: 'c', name: 'Ana', phone: '4555' } })),
    ).toBeNull()
  })

  it('dice cuándo le toca', () => {
    expect(dueLabel(0)).toBe('Hoy')
    expect(dueLabel(1)).toBe('Mañana')
    expect(dueLabel(5)).toBe('En 5 días')
    expect(dueLabel(-1)).toBe('Venció ayer')
    expect(dueLabel(-8)).toBe('Venció hace 8 días')
  })
})
