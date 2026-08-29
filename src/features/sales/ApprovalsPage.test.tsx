import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApprovalsPage } from './ApprovalsPage'
import type { SalesOperation } from './types'

const mocks = vi.hoisted(() => ({
  listSalesApprovals: vi.fn(),
  approveSalesOperation: vi.fn(),
  rejectSalesOperation: vi.fn(),
}))

vi.mock('./api', () => ({
  listSalesApprovals: mocks.listSalesApprovals,
  approveSalesOperation: mocks.approveSalesOperation,
  rejectSalesOperation: mocks.rejectSalesOperation,
}))

const operation = {
  id: 'operation-1',
  number: '105',
  operationDate: '2026-08-29',
  status: 'PENDIENTE_APROBACION',
  deliveryStatus: 'NO_PROGRAMADA',
  documentationStatus: 'PENDIENTE',
  papersDelivered: false,
  papersDeliveredAt: null,
  debt: 'NO',
  month: '2026-08',
  listPrice: '5000000',
  minimumPrice: '4500000',
  agreedPrice: '4400000',
  currency: 'ARS',
  paymentPlatform: 'EFECTIVO',
  creditAmount: null,
  guarantor: null,
  notes: null,
  rowVersion: 7,
  organizationId: 'org-1',
  createdAt: '2026-08-29T12:00:00.000Z',
  updatedAt: '2026-08-29T12:00:00.000Z',
  client: { id: 'client-1', fullName: 'Ana Cliente', active: true },
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
      supplier: { id: 'supplier-1', legalName: 'Proveedor Uno' },
    },
    chassis: 'VIN-001',
  },
  seller: { id: 'seller-1', fullName: 'Vendedor Uno' },
  contact: null,
  createdBy: { id: 'user-1', fullName: 'Usuario Uno' },
  supply: null,
  reservation: {
    id: 'reservation-1',
    unitId: 'unit-1',
    supplierAvailabilityId: null,
    status: 'ACTIVO',
    quantity: 1,
    expiresAt: null,
    releasedAt: null,
    releaseReason: null,
  },
  paymentComponents: [],
  tradeIns: [],
  obligations: [],
  approval: {
    id: 'approval-1',
    decision: 'PENDIENTE',
    requestedAt: '2026-08-29T12:00:00.000Z',
    decidedAt: null,
    reason: null,
    listPriceReference: '5000000',
    minimumPriceReference: '4500000',
    agreedPriceReference: '4400000',
  },
} satisfies SalesOperation

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listSalesApprovals.mockResolvedValue({
    items: [operation],
    total: 1,
    page: 1,
    limit: 100,
  })
  mocks.approveSalesOperation.mockResolvedValue({
    ...operation,
    status: 'APROBADA',
    rowVersion: 8,
  })
  mocks.rejectSalesOperation.mockResolvedValue({
    ...operation,
    status: 'RECHAZADA',
    rowVersion: 8,
  })
})

describe('Aprobaciones pendientes', () => {
  it('aprueba con rowVersion y vuelve a consultar la bandeja', async () => {
    const user = userEvent.setup()
    render(<ApprovalsPage vehicleType="MOTO" />)

    await user.click(await screen.findByRole('button', { name: 'Aprobar' }))

    expect(mocks.approveSalesOperation).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 7,
    })
    await waitFor(() =>
      expect(mocks.listSalesApprovals).toHaveBeenCalledTimes(2),
    )
  })

  it('exige motivo al rechazar y refresca tras confirmar', async () => {
    const user = userEvent.setup()
    render(<ApprovalsPage vehicleType="MOTO" />)

    await user.click(await screen.findByRole('button', { name: 'Rechazar' }))
    const confirm = screen.getByRole('button', {
      name: 'Confirmar rechazo',
    })
    expect(confirm).toBeDisabled()
    await user.type(
      screen.getByLabelText('Motivo del rechazo *'),
      'Precio fuera de política',
    )
    await user.click(confirm)

    expect(mocks.rejectSalesOperation).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 7,
      reason: 'Precio fuera de política',
    })
    await waitFor(() =>
      expect(mocks.listSalesApprovals).toHaveBeenCalledTimes(2),
    )
  })
})
