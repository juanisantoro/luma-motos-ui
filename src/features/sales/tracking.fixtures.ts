import type {
  OperationTrackingRow,
  TrackingIncome,
  TrackingPaymentComponent,
} from './tracking'

export function trackingIncomeFixture(
  overrides: Partial<TrackingIncome> = {},
): TrackingIncome {
  return {
    id: 'income-1',
    incomeDate: '2026-09-20T00:00:00.000Z',
    type: 'Cobro de operación',
    isLicensing: false,
    isOwnCreditInstallment: false,
    paymentComponentId: 'component-cash',
    paymentMethod: 'EFECTIVO',
    totalAmount: '500000',
    collectedAmount: '500000',
    paymentStatus: 'PAGADO',
    reference: 'B-0042',
    account: { id: 'account-1', code: 'CAJA', name: 'Caja SM', type: 'CAJA' },
    collectedBy: { id: 'seller-1', fullName: 'Vendedor Uno' },
    handover: {
      status: 'PENDIENTE_RENDICION',
      recipient: { id: 'recipient-1', fullName: 'Lucas' },
      confirmedAt: null,
      confirmedBy: null,
    },
    rowVersion: 3,
    ...overrides,
  }
}

export function componentFixture(
  overrides: Partial<TrackingPaymentComponent> = {},
): TrackingPaymentComponent {
  return {
    id: 'component-cash',
    type: 'EFECTIVO',
    expectedAmount: '1500000',
    collectedAmount: '500000',
    collectableAmount: '1000000',
    balanceAmount: '1000000',
    paymentStatus: 'PAGO_PARCIAL',
    financialInstitution: null,
    ownCredit: false,
    financingPayment: null,
    collectible: true,
    ...overrides,
  }
}

export function trackingRowFixture(
  overrides: Partial<OperationTrackingRow> = {},
): OperationTrackingRow {
  return {
    id: 'operation-1',
    number: '1048',
    ticketNumber: 'B-0042',
    operationDate: '2026-09-15T00:00:00.000Z',
    status: 'APROBADA',
    rowVersion: 4,
    organizationId: 'org-1',
    client: {
      id: 'client-1',
      fullName: 'Ana Pérez',
      documentType: 'DNI',
      documentNumber: '12345678',
    },
    seller: { id: 'seller-1', fullName: 'Vendedor Uno' },
    branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
    vehicle: { versionName: 'Wave 110 S', condition: 'NUEVO', chassis: null },
    currency: 'ARS',
    agreedPrice: '2500000',
    collectedAmount: '500000',
    balanceAmount: '2000000',
    pendingHandoverAmount: '500000',
    pendingHandoverCount: 1,
    waivedAmount: '0',
    ownCredit: null,
    fulfillment: {
      status: 'PEDIDA',
      supplyRequestId: 'supply-1',
      supplyStatus: 'PEDIDO',
      supplier: { id: 'supplier-1', legalName: 'Proveedor A' },
      requestedAt: null,
      orderedAt: null,
      dispatchedAt: null,
      receivedAt: null,
    },
    licensing: {
      mode: 'PAGA_CLIENTE',
      amount: '85000',
      status: 'COBRO_PENDIENTE',
      estimatedFrom: null,
      estimatedTo: null,
      plateLoaded: false,
      overdue: false,
      collection: { status: 'SIN_REGISTRAR', amount: '0', incomeIds: [] },
      payment: { status: 'SIN_REGISTRAR', amount: '0', paymentIds: [] },
    },
    paymentComponents: [
      componentFixture(),
      componentFixture({
        id: 'component-credit',
        type: 'FINANCIACION',
        expectedAmount: '1000000',
        collectedAmount: '1000000',
        collectableAmount: '0',
        balanceAmount: '0',
        paymentStatus: 'PAGADO',
        financialInstitution: { id: 'fin-1', legalName: 'Credicuotas' },
      }),
      componentFixture({
        id: 'component-trade-in',
        type: 'TOMA_PARTE_PAGO',
        expectedAmount: '0',
        collectedAmount: '0',
        collectableAmount: '0',
        balanceAmount: '0',
        paymentStatus: 'PENDIENTE',
        collectible: false,
      }),
    ],
    incomes: [trackingIncomeFixture()],
    ...overrides,
  }
}
