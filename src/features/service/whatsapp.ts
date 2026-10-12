import { orderNumber } from './format'
import type { ServiceOrder } from './types'

/**
 * Número de un celular argentino en el formato de WhatsApp (549 + área +
 * número, sin 0 ni 15). Acepta cómo se suele anotar: "11 5555-0000",
 * "011 15 5555 0000", "+54 9 11 5555 0000". `null` si no parece un celular.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  let digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('54')) digits = digits.slice(2)
  if (digits.startsWith('9')) digits = digits.slice(1)
  if (digits.startsWith('0')) digits = digits.slice(1)
  // "15" después del código de área (2 a 4 dígitos): se quita.
  const local = /^(\d{2,4})15(\d{6,8})$/.exec(digits)
  if (local && local[1]!.length + local[2]!.length === 10) digits = local[1]! + local[2]!
  // Sin código de área, un "15" adelante es un celular de Buenos Aires.
  if (digits.length === 10 && digits.startsWith('15')) digits = `11${digits.slice(2)}`
  if (digits.length === 8) digits = `11${digits}`
  return digits.length === 10 ? `549${digits}` : null
}

export function readyMessage(order: ServiceOrder) {
  const name = order.client.name.split(' ')[0] ?? order.client.name
  const vehicle = [order.vehicle.model, order.vehicle.plate].filter(Boolean).join(' ')
  return [
    `Hola ${name}, te escribimos de Luma Motos.`,
    `Tu moto${vehicle ? ` ${vehicle}` : ''} ya tiene el ${order.serviceType.name.replace(/^Otro:\s*/, 'service: ')} terminado y está lista para retirar en ${order.branch.name}.`,
    `Orden de service N.º ${orderNumber(order.number)}.`,
  ].join(' ')
}

/** Link que abre el chat con el cliente y el mensaje armado (no se envía solo). */
export function whatsappLink(order: ServiceOrder): string | null {
  const number = whatsappNumber(order.client.phone)
  return number
    ? `https://wa.me/${number}?text=${encodeURIComponent(readyMessage(order))}`
    : null
}
