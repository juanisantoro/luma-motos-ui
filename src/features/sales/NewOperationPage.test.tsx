import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { NewOperationPage } from './NewOperationPage'

const mocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
  listSalesSellers: vi.fn(),
  getSalesPricePolicy: vi.fn(),
  createSalesOperation: vi.fn(),
  useCreditCheck: vi.fn(),
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

vi.mock('../stock/api', () => ({
  stockApiGateway: {
    loadWorkspace: mocks.loadWorkspace,
  },
}))

vi.mock('../credit-checks', () => ({
  useCreditCheck: mocks.useCreditCheck,
  CreditAlert: ({
    state,
  }: {
    state: {
      status: string
      data?: { lastRejection?: { reason?: string | null } | null }
    }
  }) =>
    state.status === 'success' ? (
      <div role="alert">{state.data?.lastRejection?.reason}</div>
    ) : null,
}))

vi.mock('./api', () => ({
  listSalesSellers: mocks.listSalesSellers,
  getSalesPricePolicy: mocks.getSalesPricePolicy,
  createSalesOperation: mocks.createSalesOperation,
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
  mocks.useCreditCheck.mockReturnValue({
    state: { status: 'idle' },
    retry: vi.fn(),
    reset: vi.fn(),
  })
  mocks.loadWorkspace.mockResolvedValue(workspace)
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
})

describe('Nueva operación', () => {
  it('envía la operación física completa mediante el contrato unificado', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <NewOperationPage vehicleType="MOTO" />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Ingresar para verificar'), {
      target: { value: '12.345.678' },
    })
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), {
      target: { value: 'Ana Cliente' },
    })
    fireEvent.change(screen.getByLabelText('Teléfono *'), {
      target: { value: '11 5555-5555' },
    })
    await screen.findByText(
      'Elegí una unidad física o disponibilidad de proveedor',
    )
    fireEvent.change(
      screen.getByPlaceholderText('Tipo, marca, modelo, sucursal o chasis…'),
      {
      target: {
        value: 'Moto · Honda Wave 110 S · Nuevo · Centro · Chasis VIN-001',
      },
      },
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Guardar y enviar operación' }),
      ).toBeEnabled(),
    )
    await user.selectOptions(
      await screen.findByLabelText('Quién hizo la venta *'),
      'seller-1',
    )
    await user.selectOptions(
      screen.getByLabelText('Quién fue el contacto'),
      'seller-1',
    )
    await user.selectOptions(
      screen.getByLabelText('Plataforma de pago *'),
      'EFECTIVO_CREDITO',
    )
    fireEvent.change(screen.getByLabelText('Monto del crédito *'), {
      target: { value: '1000000' },
    })
    fireEvent.change(screen.getByLabelText('Respaldo / garante'), {
      target: { value: 'Garantía personal' },
    })
    fireEvent.change(await screen.findByLabelText('Precio de cierre *'), {
      target: { value: '4400000' },
    })

    expect(
      screen.getByText('Precio por debajo de lista'),
    ).toBeInTheDocument()
    const submitButton = screen.getByRole('button', {
      name: 'Guardar y enviar operación',
    })
    await user.click(submitButton)

    expect(mocks.createSalesOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        vehicleType: 'MOTO',
        client: {
          documentType: 'DNI',
          documentNumber: '12345678',
          fullName: 'Ana Cliente',
          phone: '11 5555-5555',
        },
        versionId: 'version-1',
        sellerId: 'seller-1',
        contactId: 'seller-1',
        unitId: 'unit-1',
        agreedPrice: 4_400_000,
        paymentPlatform: 'EFECTIVO_CREDITO',
        creditAmount: 1_000_000,
        guarantor: 'Garantía personal',
        deliveryStatus: 'NO_PROGRAMADA',
        papersDelivered: false,
        debt: 'NO',
        submit: true,
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Operación #105' }),
    ).toBeInTheDocument()
  })

  it('crea abastecimiento vinculado sin enviar el borrador a aprobación', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <NewOperationPage vehicleType="MOTO" />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText('Ingresar para verificar'), {
      target: { value: '12.345.678' },
    })
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), {
      target: { value: 'Ana Cliente' },
    })
    fireEvent.change(screen.getByLabelText('Teléfono *'), {
      target: { value: '11 5555-5555' },
    })
    await screen.findByText(
      'Elegí una unidad física o disponibilidad de proveedor',
    )
    fireEvent.change(
      screen.getByPlaceholderText('Tipo, marca, modelo, sucursal o chasis…'),
      {
      target: {
        value:
          'Moto · Honda Wave 110 S · Nuevo · Proveedor Proveedor Uno (2) · Chasis al recibir',
      },
      },
    )
    const submitButton = screen.getByRole('button', {
      name: 'Guardar y enviar operación',
    })
    await waitFor(() => expect(submitButton).toBeEnabled())
    await user.click(submitButton)

    expect(mocks.createSalesOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleType: 'MOTO',
        supplierAvailabilityId: 'availability-1',
        submit: true,
      }),
    )
    expect(
      await screen.findByText(/operación y su abastecimiento fueron creados/i),
    ).toBeInTheDocument()
  })

  it('crea el cliente dentro del flujo y guarda un borrador', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <NewOperationPage vehicleType="MOTO" />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('DNI / CI *'), {
      target: { value: '33.444.555' },
    })
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), {
      target: { value: 'Cliente Nuevo' },
    })
    fireEvent.change(screen.getByLabelText('Teléfono *'), {
      target: { value: '11 4444-5555' },
    })
    await screen.findByText(
      'Elegí una unidad física o disponibilidad de proveedor',
    )
    fireEvent.change(
      screen.getByLabelText('Buscar y seleccionar vehículo *'),
      {
        target: {
          value: 'Moto · Honda Wave 110 S · Nuevo · Centro · Chasis VIN-001',
        },
      },
    )
    const draftButton = screen.getByRole('button', {
      name: 'Guardar borrador',
    })
    await waitFor(() => expect(draftButton).toBeEnabled())
    await user.click(draftButton)

    expect(mocks.createSalesOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        client: {
          documentType: 'DNI',
          documentNumber: '33444555',
          fullName: 'Cliente Nuevo',
          phone: '11 4444-5555',
        },
        unitId: 'unit-1',
        paymentPlatform: 'EFECTIVO',
        submit: false,
      }),
    )
    expect(
      await screen.findByText(/guardadas como borrador/),
    ).toBeInTheDocument()
  })

  it('consulta el documento contra Clientes en rojo sin buscar clientes', async () => {
    mocks.useCreditCheck.mockReturnValue({
      state: {
        status: 'success',
        data: {
          blocksSale: false,
          lastRejection: { reason: 'Mora informada por la financiera' },
        },
      },
      retry: vi.fn(),
      reset: vi.fn(),
    })
    render(
      <MemoryRouter>
        <NewOperationPage vehicleType="MOTO" />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('DNI / CI *'), {
      target: { value: '28.456.789' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Mora informada por la financiera',
    )
    expect(mocks.useCreditCheck).toHaveBeenLastCalledWith(
      expect.objectContaining({
        documentType: 'DNI',
        documentNumber: '28.456.789',
      }),
    )
  })
})
