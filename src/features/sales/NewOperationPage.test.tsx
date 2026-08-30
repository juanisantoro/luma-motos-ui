import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ApiError, NetworkError } from '../../shared/api/client'
import { NewOperationPage } from './NewOperationPage'

const mocks = vi.hoisted(() => ({
  authRoleCode: 'VENDEDOR',
  authHasBranch: true,
  authGlobalAccess: false,
  authName: 'Vendedor Uno',
  authOrganizationId: 'org-1',
  listBranches: vi.fn(),
  listUnits: vi.fn(),
  listAvailability: vi.fn(),
  listSellers: vi.fn(),
  listContacts: vi.fn(),
  listFinancialInstitutions: vi.fn(),
  getPricePolicy: vi.fn(),
  createOperation: vi.fn(),
  createTradeIn: vi.fn(),
  replacePaymentPlan: vi.fn(),
  submitOperation: vi.fn(),
  useCreditCheck: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'vendedor@luma.test',
      name: mocks.authName,
      globalAccess: mocks.authGlobalAccess,
      organization: {
        id: mocks.authOrganizationId,
        name: 'Luma',
        code: 'LUMA_CENTRAL',
      },
      branch: mocks.authHasBranch
        ? { id: 'branch-1', code: 'CENTRO', name: 'Centro' }
        : null,
      role: {
        code: mocks.authRoleCode,
        permissions: [
          'ventas.gestionar',
          'inventario.consultar',
          'proveedores.consultar',
        ],
      },
    },
  }),
}))

vi.mock('../stock/api', () => ({
  listSalesBranches: mocks.listBranches,
  listSalesPhysicalUnits: mocks.listUnits,
  listSalesSupplierAvailability: mocks.listAvailability,
}))

vi.mock('../credit-checks', () => ({
  useCreditCheck: mocks.useCreditCheck,
  CreditAlert: ({
    state,
    onRetry,
  }: {
    state: {
      status: string
      data?: { lastRejection?: { reason?: string | null } | null }
      message?: string
    }
    onRetry: () => void
  }) => (
    <div>
      {state.status === 'success' && (
        <div role="alert">{state.data?.lastRejection?.reason}</div>
      )}
      {state.status === 'error' && (
        <div role="alert">
          {state.message}
          <button onClick={onRetry} type="button">Reintentar consulta</button>
        </div>
      )}
    </div>
  ),
}))

vi.mock('./api', () => ({
  listSalesSellers: mocks.listSellers,
  listSalesContacts: mocks.listContacts,
  listSalesFinancialInstitutions: mocks.listFinancialInstitutions,
  getSalesPricePolicy: mocks.getPricePolicy,
  createSalesOperation: mocks.createOperation,
  createSalesTradeIn: mocks.createTradeIn,
  replaceSalesPaymentPlan: mocks.replacePaymentPlan,
  submitSalesOperation: mocks.submitOperation,
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

const autoCatalogModel = {
  ...catalogModel,
  id: 'version-auto-1',
  vehicleType: 'AUTO',
  brand: 'Fiat',
  model: 'Cronos',
  version: 'Drive',
} as const

const unit = {
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
} as const

const availability = {
  id: 'availability-1',
  vehicleType: 'MOTO',
  catalogModel,
  condition: 'NUEVO',
  supplier: { id: 'supplier-1', name: 'Proveedor Uno' },
  quantity: 2,
  notes: null,
  updatedAt: '2026-08-29T12:00:00.000Z',
} as const

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'operation-1',
    number: '105',
    rowVersion: 1,
    tradeIns: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authRoleCode = 'VENDEDOR'
  mocks.authHasBranch = true
  mocks.authGlobalAccess = false
  mocks.authName = 'Vendedor Uno'
  mocks.authOrganizationId = 'org-1'
  mocks.useCreditCheck.mockReturnValue({
    state: { status: 'idle' },
    retry: vi.fn(),
    reset: vi.fn(),
  })
  mocks.listBranches.mockResolvedValue([{ id: 'branch-1', name: 'Centro' }])
  mocks.listUnits.mockResolvedValue([unit])
  mocks.listAvailability.mockResolvedValue([availability])
  mocks.listSellers.mockResolvedValue({
    items: [
      {
        id: 'seller-1',
        employeeCode: 'V001',
        fullName: 'Vendedor Uno',
        isCurrentUser: true,
      },
      {
        id: 'seller-2',
        employeeCode: 'V002',
        fullName: 'Vendedora Dos',
      },
    ],
    total: 2,
    page: 1,
    limit: 100,
  })
  mocks.listContacts.mockResolvedValue({
    items: [
      {
        id: 'contact-1',
        employeeCode: 'C001',
        fullName: 'Contacto Uno',
      },
      {
        id: 'contact-2',
        employeeCode: 'C002',
        fullName: 'Contacto Dos',
      },
    ],
    total: 2,
    page: 1,
    limit: 100,
  })
  mocks.listFinancialInstitutions.mockResolvedValue({
    items: [
      { id: 'bank-1', name: 'Banco Uno', taxId: null, active: true },
    ],
    total: 1,
    page: 1,
    limit: 100,
  })
  mocks.getPricePolicy.mockResolvedValue({
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
  mocks.createOperation.mockResolvedValue(operation())
  mocks.createTradeIn.mockResolvedValue(
    operation({
      rowVersion: 2,
      tradeIns: [
        {
          id: 'trade-1',
          description: 'Honda usada',
          appraisedAmount: '1000000',
          acceptedAmount: '1000000',
          status: 'PENDIENTE',
        },
      ],
    }),
  )
  mocks.replacePaymentPlan.mockResolvedValue(operation({ rowVersion: 3 }))
  mocks.submitOperation.mockResolvedValue(
    operation({ rowVersion: 4, status: 'PENDIENTE_APROBACION' }),
  )
})

function renderPage(vehicleType: 'MOTO' | 'AUTO' = 'MOTO') {
  return render(
    <MemoryRouter>
      <NewOperationPage vehicleType={vehicleType} />
    </MemoryRouter>,
  )
}

async function completeBaseData() {
  const user = userEvent.setup()
  fireEvent.change(screen.getByLabelText('DNI / CI *'), {
    target: { value: '12.345.678' },
  })
  fireEvent.change(screen.getByLabelText('Nombre y apellido *'), {
    target: { value: 'Ana Cliente' },
  })
  fireEvent.change(screen.getByLabelText('Teléfono *'), {
    target: { value: '11 5555-5555' },
  })
  fireEvent.change(screen.getByLabelText('Buscar vehículo *'), {
    target: { value: 'VIN-001' },
  })
  const option = await screen.findByRole('option', { name: /VIN-001/ })
  await user.click(option)
  await waitFor(() =>
    expect(screen.getByText(/5\.000\.000/)).toBeInTheDocument(),
  )
  return user
}

describe('Nueva operación productiva', () => {
  it('muestra vendedores y contactos reales con el usuario actual seleccionado', async () => {
    renderPage()

    const seller = await screen.findByLabelText('Quién hizo la venta *')
    const contact = screen.getByLabelText('Quién fue el contacto')
    expect(seller).toHaveValue('seller-1')
    expect(seller).toBeDisabled()
    expect(within(seller).getAllByRole('option')).toHaveLength(3)
    expect(
      within(contact).getByRole('option', { name: 'Contacto Dos' }),
    ).toBeInTheDocument()
  })

  it('permite elegir vendedor a los roles administrativos autorizados', async () => {
    mocks.authRoleCode = 'ADMINISTRATIVA'
    const user = userEvent.setup()
    renderPage()

    const seller = await screen.findByLabelText('Quién hizo la venta *')
    expect(seller).toBeEnabled()
    await user.selectOptions(seller, 'seller-2')
    expect(seller).toHaveValue('seller-2')
  })

  it('carga personas de toda la organización para un administrador sin sucursal', async () => {
    mocks.authRoleCode = 'ADMINISTRADOR'
    mocks.authHasBranch = false
    mocks.authGlobalAccess = true
    mocks.authName = 'Juan Ignacio Santoro'
    const view = renderPage()

    const seller = await screen.findByLabelText('Quién hizo la venta *')
    expect(seller).toBeEnabled()
    await waitFor(() =>
      expect(mocks.listSellers).toHaveBeenCalledWith(
        {
          page: 1,
          limit: 100,
          organizationId: 'org-1',
        },
        expect.any(AbortSignal),
      ),
    )
    // Even for an admin/administrative role, the seller field now defaults
    // to whoever is logged in (identified by isCurrentUser) instead of
    // blank - that blank default was exactly what let operations get
    // silently saved under the wrong seller.
    expect(await screen.findByLabelText('Quién hizo la venta *')).toHaveValue(
      'seller-1',
    )
    expect(within(seller).getAllByRole('option')).toHaveLength(3)
    expect(
      within(screen.getByLabelText('Quién fue el contacto')).getAllByRole(
        'option',
      ),
    ).toHaveLength(3)

    mocks.authOrganizationId = 'org-2'
    mocks.listSellers.mockResolvedValueOnce({
      items: [
        {
          id: 'seller-org-2',
          employeeCode: 'V200',
          fullName: 'Vendedor Organización Dos',
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
    })
    mocks.listContacts.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    })
    view.rerender(
      <MemoryRouter>
        <NewOperationPage vehicleType="MOTO" />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(mocks.listSellers).toHaveBeenLastCalledWith(
        {
          page: 1,
          limit: 100,
          organizationId: 'org-2',
        },
        expect.any(AbortSignal),
      ),
    )
    expect(
      within(screen.getByLabelText('Quién hizo la venta *')).queryByRole(
        'option',
        { name: 'Vendedor Uno · usuario actual' },
      ),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Quién hizo la venta *')).getByRole(
        'option',
        { name: 'Vendedor Organización Dos' },
      ),
    ).toBeInTheDocument()
  })

  it('envía persona embebida, plan y operación física sin seleccionar cliente', async () => {
    renderPage()
    const user = await completeBaseData()
    await user.selectOptions(
      screen.getByLabelText('Quién fue el contacto'),
      'contact-2',
    )
    await user.selectOptions(
      screen.getByLabelText('Plataforma de pago *'),
      'EFECTIVO_CREDITO',
    )
    fireEvent.change(screen.getByLabelText('Monto del crédito *'), {
      target: { value: '1000000' },
    })
    await user.selectOptions(screen.getByLabelText('Financiera *'), 'bank-1')
    fireEvent.change(screen.getByLabelText('Respaldo / garante'), {
      target: { value: 'Garantía personal' },
    })
    const closingPrice = screen.getByLabelText('Precio de cierre *')
    fireEvent.change(closingPrice, { target: { value: '4400000' } })
    await user.click(
      screen.getByRole('button', { name: 'Guardar y enviar operación' }),
    )

    expect(mocks.createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleType: 'MOTO',
        branchId: 'branch-1',
        client: {
          documentType: 'DNI',
          documentNumber: '12345678',
          fullName: 'Ana Cliente',
          phone: '11 5555-5555',
        },
        versionId: 'version-1',
        sellerId: 'seller-1',
        contactId: 'contact-2',
        unitId: 'unit-1',
        agreedPrice: 4_400_000,
        paymentPlatform: 'EFECTIVO_CREDITO',
        creditAmount: 1_000_000,
        submit: false,
      }),
    )
    expect(mocks.replacePaymentPlan).toHaveBeenCalledWith(
      'operation-1',
      {
        expectedVersion: 1,
        components: [
          {
            type: 'FINANCIACION',
            amount: 1_000_000,
            financialInstitutionId: 'bank-1',
          },
          { type: 'EFECTIVO', amount: 3_400_000 },
        ],
      },
    )
    expect(mocks.submitOperation).toHaveBeenCalledWith('operation-1', 3)
    expect(
      await screen.findByRole('heading', { name: 'Operación #105' }),
    ).toBeInTheDocument()
  })

  it('guarda un documento nuevo como borrador y delega al backend crear el cliente', async () => {
    renderPage()
    const user = await completeBaseData()
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(mocks.createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        client: expect.objectContaining({ documentNumber: '12345678' }),
        submit: false,
      }),
    )
    expect(mocks.replacePaymentPlan).toHaveBeenCalled()
    expect(mocks.submitOperation).not.toHaveBeenCalled()
    expect(
      await screen.findByText(/condiciones comerciales quedaron guardados como borrador/i),
    ).toBeInTheDocument()
  })

  it('registra disponibilidad de proveedor y parte de pago con disclosure progresivo', async () => {
    renderPage()
    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('DNI / CI *'), {
      target: { value: '33444555' },
    })

    fireEvent.change(screen.getByLabelText('Nombre y apellido *'), {
      target: { value: 'Cliente Existente' },
    })
    fireEvent.change(screen.getByLabelText('Teléfono *'), {
      target: { value: '1144445555' },
    })
    fireEvent.change(screen.getByLabelText('Buscar vehículo *'), {
      target: { value: 'Proveedor Uno' },
    })
    await user.click(
      await screen.findByRole('option', {
        name: /Stock de Proveedor Uno \(2\) · Chasis al recibir/,
      }),
    )
    await waitFor(() => expect(screen.getByText(/5\.000\.000/)).toBeInTheDocument())
    expect(screen.queryByLabelText('Unidad recibida como parte de pago *')).not.toBeInTheDocument()
    await user.selectOptions(
      screen.getByLabelText('Plataforma de pago *'),
      'MOTO_EFECTIVO',
    )
    fireEvent.change(
      screen.getByLabelText('Unidad recibida como parte de pago *'),
      { target: { value: 'Honda usada 2022' } },
    )
    fireEvent.change(screen.getByLabelText('Valor aceptado *'), {
      target: { value: '1000000' },
    })
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(mocks.createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierAvailabilityId: 'availability-1',
        client: expect.objectContaining({ fullName: 'Cliente Existente' }),
      }),
    )
    expect(mocks.createTradeIn).toHaveBeenCalledWith(
      'operation-1',
      expect.objectContaining({
        expectedVersion: 1,
        description: 'Honda usada 2022',
        acceptedAmount: 1_000_000,
      }),
    )
    expect(mocks.replacePaymentPlan).toHaveBeenCalledWith(
      'operation-1',
      expect.objectContaining({
        expectedVersion: 2,
        components: [
          {
            type: 'TOMA_PARTE_PAGO',
            amount: 1_000_000,
            tradeInVehicleId: 'trade-1',
          },
          { type: 'EFECTIVO', amount: 4_000_000 },
        ],
      }),
    )
  })

  it('no ofrece pedidos sintéticos cuando no hay disponibilidad informada', async () => {
    mocks.listAvailability.mockResolvedValue([])
    mocks.listUnits.mockResolvedValue([])
    renderPage()
    fireEvent.change(screen.getByLabelText('Buscar vehículo *'), {
      target: { value: 'Wave 110' },
    })
    expect(
      await screen.findByText('No hay coincidencias'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pedir a proveedor' }),
    ).not.toBeInTheDocument()
  })

  it('invalida sólo la unidad perdida ante una reserva concurrente 409', async () => {
    mocks.createOperation.mockRejectedValueOnce(
      new ApiError(409, 'already reserved', {
        code: 'INVENTORY_UNIT_ALREADY_RESERVED',
      }),
    )
    renderPage()
    const user = await completeBaseData()
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Esta unidad acaba de ser reservada por otra operación',
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre y apellido *')).toHaveValue(
      'Ana Cliente',
    )
    await user.click(
      screen.getByRole('button', { name: 'Elegir otra unidad' }),
    )
    await waitFor(() => expect(mocks.listUnits).toHaveBeenCalledTimes(2))
  })

  it('consulta Clientes en rojo sin convertirlo en selector de clientes', () => {
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
    renderPage()

    fireEvent.change(screen.getByLabelText('DNI / CI *'), {
      target: { value: '28.456.789' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Mora informada por la financiera',
    )
    expect(screen.queryByText(/seleccionar cliente existente/i)).not.toBeInTheDocument()
  })

  it('mantiene AUTO separado en carga, resultados y política', async () => {
    mocks.listUnits.mockResolvedValue([
      {
        ...unit,
        id: 'auto-unit',
        vehicleType: 'AUTO',
        catalogModel: autoCatalogModel,
        vin: 'AUTO-VIN-1',
      },
    ])
    mocks.listAvailability.mockResolvedValue([])
    mocks.getPricePolicy.mockResolvedValue({
      id: 'auto-policy',
      versionId: 'version-auto-1',
      branchId: 'branch-1',
      organizationId: 'org-1',
      currency: 'ARS',
      listPrice: '20000000',
      minimumPrice: '19000000',
      validFrom: '2026-01-01',
      validUntil: null,
      scope: 'BRANCH',
    })
    renderPage('AUTO')
    const user = userEvent.setup()

    expect(await screen.findByText('Nueva operación de auto')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar vehículo *'), {
      target: { value: 'AUTO-VIN-1' },
    })
    await user.click(await screen.findByRole('option', { name: /AUTO-VIN-1/ }))
    expect(mocks.listUnits).toHaveBeenCalledWith(
      'AUTO',
      undefined,
      'AUTO-VIN-1',
      expect.any(AbortSignal),
    )
    expect(mocks.getPricePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleType: 'AUTO',
        versionId: 'version-auto-1',
      }),
      expect.any(AbortSignal),
    )
    expect(screen.queryByText('Honda Wave 110 S')).not.toBeInTheDocument()
  })

  it('expone causa y reintenta stock sin ocultar el resto del formulario', async () => {
    mocks.listUnits
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce([unit])
    renderPage()
    const user = userEvent.setup()
    fireEvent.change(screen.getByLabelText('Buscar vehículo *'), {
      target: { value: 'VIN-001' },
    })

    const alert = await screen.findByRole('alert', {
      name: '',
    }).catch(() => screen.getByText(/No se pudo cargar toda la disponibilidad/).closest('[role="alert"]'))
    expect(alert).toHaveTextContent('Stock físico')
    expect(alert).toHaveTextContent('backend no respondió')
    expect(screen.getByLabelText('DNI / CI *')).toBeInTheDocument()
    await user.click(within(alert as HTMLElement).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('option', { name: /VIN-001/ })).toBeInTheDocument()
    expect(mocks.listUnits).toHaveBeenCalledTimes(2)
  })

  it('preserva la operación creada cuando falla un dato relacionado', async () => {
    mocks.replacePaymentPlan.mockRejectedValueOnce(new NetworkError())
    renderPage()
    const user = await completeBaseData()
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    expect(
      await screen.findByRole('heading', { name: 'Operación #105' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/La operación quedó guardada como borrador/)).toHaveTextContent(
      'seguimiento sin duplicarla',
    )
    expect(
      screen.queryByRole('button', { name: 'Guardar borrador' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cargar otra' }),
    ).not.toBeInTheDocument()
  })
})
