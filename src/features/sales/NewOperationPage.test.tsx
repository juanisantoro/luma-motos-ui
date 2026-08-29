import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { NewOperationPage } from './NewOperationPage'

const mocks = vi.hoisted(() => ({
  listClients: vi.fn(),
  loadWorkspace: vi.fn(),
  listSalesSellers: vi.fn(),
  getSalesPricePolicy: vi.fn(),
  createSalesOperation: vi.fn(),
  submitSalesOperation: vi.fn(),
  createLinkedSupplyRequest: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      globalAccess: false,
      organization: { id: 'org-1', name: 'Luma', code: 'LUMA_CENTRAL' },
      branch: { id: 'branch-1', code: 'CENTRO', name: 'Centro' },
      role: {
        permissions: [
          'ventas.gestionar',
          'catalogo.consultar',
          'proveedores.consultar',
          'abastecimiento.gestionar',
        ],
      },
    },
  }),
}))

vi.mock('../clients/api', () => ({
  listClients: mocks.listClients,
}))

vi.mock('../stock/api', () => ({
  stockApiGateway: {
    loadWorkspace: mocks.loadWorkspace,
  },
}))

vi.mock('./api', () => ({
  listSalesSellers: mocks.listSalesSellers,
  getSalesPricePolicy: mocks.getSalesPricePolicy,
  createSalesOperation: mocks.createSalesOperation,
  submitSalesOperation: mocks.submitSalesOperation,
  createLinkedSupplyRequest: mocks.createLinkedSupplyRequest,
}))

const catalogModel = {
  id: 'version-1',
  brandId: 'brand-1',
  modelId: 'model-1',
  vehicleType: 'MOTO',
  brand: 'Honda',
  model: 'Wave',
  version: '110 S',
  active: true,
} as const

const workspace = {
  branches: [{ id: 'branch-1', name: 'Centro' }],
  suppliers: [{ id: 'supplier-1', name: 'Proveedor Uno' }],
  models: [],
  catalog: [catalogModel],
  units: [
    {
      id: 'unit-1',
      vehicleType: 'MOTO',
      catalogModel,
      condition: 'NUEVO',
      vin: 'VIN-001',
      year: 2026,
      mileage: 0,
      licensePlate: null,
      acquisitionOrigin: 'PROVEEDOR',
      supplier: { id: 'supplier-1', name: 'Proveedor Uno' },
      status: 'EN_STOCK',
      branch: { id: 'branch-1', name: 'Centro' },
      receivedAt: '2026-08-29T12:00:00.000Z',
    },
  ],
  availability: [
    {
      id: 'availability-1',
      vehicleType: 'MOTO',
      catalogModel,
      condition: 'NUEVO',
      supplier: { id: 'supplier-1', name: 'Proveedor Uno' },
      quantity: 2,
      notes: null,
      updatedAt: '2026-08-29T12:00:00.000Z',
    },
  ],
  supplies: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.loadWorkspace.mockResolvedValue(workspace)
  mocks.listClients.mockResolvedValue({
    items: [
      {
        id: 'client-1',
        fullName: 'Ana Cliente',
        documentType: 'DNI',
        documentNumber: '12.345.678',
        email: 'ana@example.com',
        active: true,
      },
    ],
    total: 1,
    page: 1,
    limit: 12,
  })
  mocks.listSalesSellers.mockResolvedValue({
    items: [
      { id: 'seller-1', employeeCode: 'V001', fullName: 'Vendedor Uno' },
    ],
    total: 1,
    page: 1,
    limit: 100,
  })
  mocks.getSalesPricePolicy.mockResolvedValue({
    id: 'policy-1',
    versionId: 'version-1',
    branchId: 'branch-1',
    organizationId: 'org-1',
    currency: 'ARS',
    listPrice: '5000000',
    minimumPrice: '4500000',
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    scope: 'BRANCH',
  })
  mocks.createSalesOperation.mockResolvedValue({
    id: 'operation-1',
    number: '105',
    rowVersion: 2,
  })
  mocks.submitSalesOperation.mockResolvedValue({
    id: 'operation-1',
    number: '105',
    rowVersion: 3,
  })
  mocks.createLinkedSupplyRequest.mockResolvedValue({
    id: 'supply-1',
    operationId: 'operation-1',
  })
})

describe('Nueva operación', () => {
  it('reserva una unidad física y envía la operación con la versión devuelta', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <NewOperationPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: /Ana Cliente/ }))
    await user.selectOptions(
      screen.getByLabelText('Versión *'),
      'version-1',
    )
    await user.click(await screen.findByRole('button', { name: /VIN-001/ }))
    await user.selectOptions(
      await screen.findByLabelText('Vendedor'),
      'seller-1',
    )
    fireEvent.change(screen.getByLabelText('Precio acordado *'), {
      target: { value: '4400000' },
    })

    expect(
      screen.getByText('Precio por debajo del piso'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reservar y enviar' }))

    expect(mocks.createSalesOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        clientId: 'client-1',
        versionId: 'version-1',
        sellerId: 'seller-1',
        unitId: 'unit-1',
        agreedPrice: 4_400_000,
      }),
    )
    expect(mocks.submitSalesOperation).toHaveBeenCalledWith('operation-1', 2)
    expect(
      await screen.findByRole('heading', { name: 'Operación #105' }),
    ).toBeInTheDocument()
  })

  it('crea abastecimiento vinculado sin enviar el borrador a aprobación', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <NewOperationPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: /Ana Cliente/ }))
    await user.selectOptions(
      screen.getByLabelText('Versión *'),
      'version-1',
    )
    await user.click(screen.getByRole('button', { name: /Proveedor/ }))
    await user.click(
      await screen.findByRole('button', { name: /Proveedor Uno/ }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Crear operación y abastecimiento',
      }),
    )

    expect(mocks.createLinkedSupplyRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-1',
        supplierAvailabilityId: 'availability-1',
        supplierId: 'supplier-1',
      }),
    )
    expect(mocks.submitSalesOperation).not.toHaveBeenCalled()
    expect(
      await screen.findByText(/solicitud de abastecimiento fue creada/),
    ).toBeInTheDocument()
  })
})
