import type { SalesLicensing, SalesOperation } from './types'

export function licensingFixture(
  overrides: Partial<SalesLicensing> = {},
): SalesLicensing {
  return {
    mode: 'PAGA_CLIENTE',
    amount: '85000',
    status: 'COBRO_PENDIENTE',
    estimatedFrom: '2026-09-11',
    estimatedTo: '2026-09-18',
    plateLoaded: false,
    overdue: false,
    collection: { status: 'SIN_REGISTRAR', amount: '0.00', incomeIds: [] },
    payment: { status: 'SIN_REGISTRAR', amount: '0.00', paymentIds: [] },
    ...overrides,
  }
}

export function operationFixture(
  overrides: Partial<SalesOperation> = {},
): SalesOperation {
  return {
    id: 'operation-1',
    number: '105',
    operationDate: '2026-08-28T00:00:00.000Z',
    status: 'APROBADA',
    deliveryStatus: 'NO_PROGRAMADA',
    documentationStatus: 'NO_INICIADA',
    papersDelivered: false,
    papersDeliveredAt: null,
    debt: 'NO',
    month: '2026-08',
    listPrice: '5000000',
    minimumPrice: '4500000',
    agreedPrice: '5000000',
    currency: 'ARS',
    paymentPlatform: 'EFECTIVO',
    creditAmount: null,
    guarantor: null,
    ticketNumber: 'B-0001',
    includesHelmet: true,
    licensing: licensingFixture(),
    notes: null,
    rowVersion: 4,
    organizationId: 'org-1',
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-08-28T10:00:00.000Z',
    client: {
      id: 'client-1',
      fullName: 'Ana Cliente',
      active: true,
      documentType: 'DNI',
      documentNumber: '12345678',
    },
    branch: { id: 'branch-1', code: 'CENTRO', name: 'Centro' },
    vehicle: {
      versionId: 'version-1',
      versionName: '110 S',
      condition: 'NUEVO',
      model: {
        id: 'model-1',
        name: 'Wave',
        vehicleType: 'MOTO',
        brand: { id: 'brand-1', name: 'Honda' },
      },
      unit: {
        id: 'unit-1',
        vin: 'VIN-001',
        licensePlate: null,
        inventoryStatus: 'RESERVADO',
        acquisitionOrigin: 'PROVEEDOR',
        supplier: null,
      },
      chassis: 'VIN-001',
    },
    seller: { id: 'seller-1', fullName: 'Vendedor Uno' },
    contact: null,
    createdBy: null,
    supply: null,
    reservation: null,
    paymentComponents: [],
    tradeIns: [],
    obligations: [],
    approval: null,
    ...overrides,
  }
}
