import type { ServiceReminder } from './reminders'

// Aviso de ejemplo para las pruebas.
export function reminderFixture(overrides: Partial<ServiceReminder> = {}): ServiceReminder {
  return {
    unitId: 'unit-1',
    stage: 'PRIMER_SERVICE',
    dueDate: '2026-10-16',
    daysToDue: 2,
    serviceName: '1º service',
    servicesDone: 0,
    lastServiceDate: null,
    deliveredAt: '2026-09-16',
    operation: { id: 'op-1', number: '1053' },
    branch: { id: 'branch-1', name: 'San Miguel' },
    client: { id: 'client-1', name: 'ANA PÉREZ', phone: '11 5555-0000' },
    vehicle: { brand: 'Honda', model: 'Wave', version: '110 S', vin: 'VIN-1', plate: 'A123BCD' },
    resolution: null,
    ...overrides,
  }
}
