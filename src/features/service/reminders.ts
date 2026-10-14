import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import { whatsappNumber } from './whatsapp'

// Avisos de service: a quién contactar esta semana por el 1º service (30 días
// después de la entrega) o el anual (un año después del último service).

export type ReminderStage = 'PRIMER_SERVICE' | 'ANUAL'
export type ReminderChannel = 'WHATSAPP' | 'TELEFONO' | 'OTRO'

export type ServiceReminder = {
  unitId: string
  stage: ReminderStage
  dueDate: string
  daysToDue: number
  serviceName: string
  servicesDone: number
  lastServiceDate: string | null
  deliveredAt: string
  operation: { id: string; number: string }
  branch: { id: string; name: string }
  client: { id: string; name: string; phone: string | null }
  vehicle: {
    brand: string
    model: string
    version: string | null
    vin: string
    plate: string | null
  }
  resolution: {
    status: 'CONTACTADO' | 'DESCARTADO'
    channel: ReminderChannel | null
    note: string | null
    at: string
    by: string | null
  } | null
}

function options(signal?: AbortSignal) {
  return { token: sessionStorage.getItem(AUTH_TOKEN_KEY), ...(signal ? { signal } : {}) }
}

export function listServiceReminders(
  status: 'PENDING' | 'RESOLVED',
  branchId: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ status })
  if (branchId) query.set('branchId', branchId)
  return apiRequest<{ today: string; items: ServiceReminder[] }>(
    `/service-reminders?${query.toString()}`,
    options(signal),
  )
}

type ReminderKey = Pick<ServiceReminder, 'unitId' | 'stage' | 'dueDate'>

export function resolveServiceReminder(
  reminder: ReminderKey,
  status: 'CONTACTADO' | 'DESCARTADO',
  channel?: ReminderChannel,
  note?: string,
) {
  return apiRequest<{ id: string; status: string }>('/service-reminders', {
    ...options(),
    method: 'POST',
    body: {
      unitId: reminder.unitId,
      stage: reminder.stage,
      dueDate: reminder.dueDate,
      status,
      ...(channel ? { channel } : {}),
      ...(note?.trim() ? { note: note.trim() } : {}),
    },
  })
}

export function reopenServiceReminder(reminder: ReminderKey) {
  const query = new URLSearchParams({
    unitId: reminder.unitId,
    stage: reminder.stage,
    dueDate: reminder.dueDate,
  })
  return apiRequest<{ reopened: boolean }>(`/service-reminders?${query.toString()}`, {
    ...options(),
    method: 'DELETE',
  })
}

export function reminderVehicle(reminder: Pick<ServiceReminder, 'vehicle'>) {
  const { brand, model, version, plate } = reminder.vehicle
  return [brand, model, version, plate ? `(${plate})` : null].filter(Boolean).join(' ')
}

function firstName(name: string) {
  const word = name.trim().split(/\s+/)[0] ?? name
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/** Mensaje para el cliente, listo para mandar por WhatsApp. */
export function reminderMessage(reminder: ServiceReminder) {
  const name = firstName(reminder.client.name)
  const moto = reminderVehicle(reminder)
  if (reminder.stage === 'PRIMER_SERVICE')
    return [
      `¡Hola ${name}! Te escribimos de Luma Motos.`,
      `Ya se cumple el primer mes desde que te llevaste tu ${moto} y le toca el ${reminder.serviceName}.`,
      'Es el más importante: revisamos cómo terminó el rodaje, cambiamos el aceite y ajustamos lo necesario para que siga andando como nueva y mantenga la garantía.',
      `¿Querés que te reservemos un turno en ${reminder.branch.name}? Respondé este mensaje y lo coordinamos. ¡Gracias!`,
    ].join(' ')
  return [
    `¡Hola ${name}! Te escribimos de Luma Motos.`,
    `Se cumple un año del último service de tu ${moto} y le toca el ${reminder.serviceName}.`,
    'Hacerlo a tiempo la mantiene segura y en buen estado.',
    `¿Querés que te reservemos un turno en ${reminder.branch.name}? Respondé este mensaje y lo coordinamos. ¡Gracias!`,
  ].join(' ')
}

/**
 * Link de WhatsApp Web (usa la sesión ya abierta en el navegador) con el
 * chat del cliente y el mensaje escrito. No se envía solo: se revisa y se
 * manda desde WhatsApp. `null` si el teléfono no parece un celular.
 */
export function reminderWhatsappLink(reminder: ServiceReminder): string | null {
  const number = whatsappNumber(reminder.client.phone)
  if (!number) return null
  // encodeURIComponent: los espacios van como %20 (con "+" WhatsApp los
  // muestra tal cual).
  return `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(reminderMessage(reminder))}`
}

/** "Hoy", "en 3 días", "vencido hace 2 días". */
export function dueLabel(daysToDue: number) {
  if (daysToDue === 0) return 'Hoy'
  if (daysToDue === 1) return 'Mañana'
  if (daysToDue > 1) return `En ${daysToDue} días`
  if (daysToDue === -1) return 'Venció ayer'
  return `Venció hace ${-daysToDue} días`
}
