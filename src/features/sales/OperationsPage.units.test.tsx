import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OperationsPage } from './OperationsPage'
import { operationFixture } from './licensing.fixtures'
import type { SalesFulfillment } from './types'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  roleCode: 'ADMINISTRATIVA',
  listOperations: vi.fn(),
  assignUnit: vi.fn(),
  requestSupply: vi.fn(),
  listAssignableUnits: vi.fn(),
  listSuggestions: vi.fn(),
  listSuppliers: vi.fn(),
  listColors: vi.fn(),
  receiveSupply: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      globalAccess: false,
      organization: { id: 'org-1', name: 'Luma', code: 'LUMA_CENTRAL' },
      branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
      role: { code: mocks.roleCode, permissions: mocks.permissions },
    },
  }),
}))

vi.mock('./api', () => ({
  listSalesOperations: mocks.listOperations,
  assignSalesUnit: mocks.assignUnit,
  requestSalesSupply: mocks.requestSupply,
  listAssignableUnits: mocks.listAssignableUnits,
  listSupplierSuggestions: mocks.listSuggestions,
  releaseSalesReservation: vi.fn(),
  updateSalesLicensing: vi.fn(),
}))

vi.mock('../finance/api', () => ({ listAllSuppliers: mocks.listSuppliers }))

vi.mock('../stock/api', () => ({
  listUnitColors: mocks.listColors,
  stockApiGateway: { receiveSupply: mocks.receiveSupply },
}))

vi.mock('../../shared/alerts', () => ({
  alertSuccess: vi.fn(() => Promise.resolve()),
  alertError: vi.fn(() => Promise.resolve()),
}))

function fulfillment(overrides: Partial<SalesFulfillment> = {}): SalesFulfillment {
  return {
    status: 'PENDIENTE_ASIGNACION',
    supplyRequestId: null,
    supplyStatus: null,
    supplier: null,
    requestedAt: null,
    orderedAt: null,
    dispatchedAt: null,
    receivedAt: null,
    ...overrides,
  }
}

const unassigned = operationFixture({
  id: 'op-pending',
  number: '201',
  status: 'APROBADA',
  requestedColor: 'Rojo',
  vehicle: { ...operationFixture().vehicle, unit: null, chassis: null },
  fulfillment: fulfillment(),
})
const secondUnassigned = operationFixture({
  id: 'op-pending-2',
  number: '202',
  status: 'PENDIENTE_APROBACION',
  requestedColor: null,
  vehicle: { ...operationFixture().vehicle, unit: null, chassis: null },
  fulfillment: fulfillment(),
})
const ordered = operationFixture({
  id: 'op-ordered',
  number: '203',
  vehicle: { ...operationFixture().vehicle, unit: null, chassis: null },
  fulfillment: fulfillment({
    status: 'PEDIDA',
    supplyRequestId: 'supply-203',
    supplyStatus: 'PEDIDO',
    supplier: { id: 'supplier-a', legalName: 'Motos Norte' },
    orderedAt: '2026-09-25T15:00:00.000Z',
  }),
})

// Atajo "A asignar" del menú: la grilla de operaciones con ?unidad=SIN_ASIGNAR.
function renderPage(
  entry = '/motos/operaciones?unidad=SIN_ASIGNAR',
  vehicleType: 'MOTO' | 'AUTO' = 'MOTO',
  mine = false,
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <OperationsPage mine={mine} vehicleType={vehicleType} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.roleCode = 'ADMINISTRATIVA'
  mocks.permissions = [
    'ventas.consultar',
    'ventas.asignar_unidad',
    'abastecimiento.gestionar',
    'abastecimiento.recibir',
    'inventario.gestionar',
  ]
  mocks.listOperations.mockResolvedValue({
    items: [unassigned, secondUnassigned, ordered],
    total: 3,
    page: 1,
    limit: 20,
  })
  mocks.listAssignableUnits.mockResolvedValue([
    {
      id: 'unit-azul',
      vin: '9C2JC4110AR000111',
      engineNumber: null,
      color: 'Azul',
      manufactureYear: 2026,
      branch: { id: 'branch-1', name: 'Centro' },
    },
    {
      id: 'unit-roja',
      vin: '9C2JC4110AR000222',
      engineNumber: 'JC41E-222',
      color: 'Rojo',
      manufactureYear: 2026,
      branch: { id: 'branch-1', name: 'Centro' },
    },
  ])
  mocks.listSuppliers.mockResolvedValue([
    { id: 'supplier-a', legalName: 'Motos Norte', active: true },
    { id: 'supplier-b', legalName: 'Distribuidora Sur', active: true },
    { id: 'supplier-x', legalName: 'Inactivo', active: false },
  ])
  mocks.listSuggestions.mockResolvedValue([
    {
      supplierId: 'supplier-b',
      supplierName: 'Distribuidora Sur',
      quantity: 3,
      expired: false,
    },
  ])
  mocks.listColors.mockResolvedValue([
    { id: 'rojo', name: 'Rojo' },
    { id: 'negro', name: 'Negro' },
  ])
  mocks.assignUnit.mockResolvedValue(unassigned)
  mocks.requestSupply.mockImplementation((_id: string, input: { supplierId: string }) =>
    Promise.resolve({
      ...unassigned,
      fulfillment: fulfillment({
        status: 'PEDIDA',
        supplier: {
          id: input.supplierId,
          legalName: input.supplierId === 'supplier-a' ? 'Motos Norte' : 'Distribuidora Sur',
        },
      }),
    }),
  )
  mocks.receiveSupply.mockResolvedValue(undefined)
})

describe('Unidad de motos desde la grilla de operaciones', () => {
  it('sin el atajo lista todo y deja elegir el filtro de unidad', async () => {
    renderPage('/motos/operaciones')
    await screen.findByRole('table')
    expect(mocks.listOperations.mock.calls[0]?.[0]).not.toHaveProperty(
      'fulfillmentStatus',
    )
    expect(screen.getByLabelText('Situación de la unidad')).toHaveValue('TODAS')
  })

  it('no ofrece acciones de unidad en Mis operaciones', async () => {
    mocks.roleCode = 'VENDEDOR'
    renderPage('/motos/mis-operaciones', 'MOTO', true)
    await screen.findByRole('table')
    expect(
      screen.queryByLabelText('Situación de la unidad'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Asignar de stock/ }),
    ).not.toBeInTheDocument()
  })

  it('no cambia la grilla de autos', async () => {
    const autoModel = {
      ...operationFixture().vehicle.model,
      vehicleType: 'AUTO' as const,
    }
    mocks.listOperations.mockResolvedValue({
      items: [
        {
          ...unassigned,
          vehicle: { ...unassigned.vehicle, model: autoModel },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    renderPage('/autos/operaciones?unidad=SIN_ASIGNAR', 'AUTO')
    const table = await screen.findByRole('table')
    expect(mocks.listOperations.mock.calls[0]?.[0]).not.toHaveProperty(
      'fulfillmentStatus',
    )
    expect(
      screen.queryByLabelText('Situación de la unidad'),
    ).not.toBeInTheDocument()
    expect(
      within(table).getByRole('columnheader', { name: 'Abastecimiento' }),
    ).toBeInTheDocument()
    expect(
      within(table).queryByRole('button', { name: /Asignar de stock|Pedir a proveedor/ }),
    ).not.toBeInTheDocument()
  })

  it('lista operaciones sin unidad con su situación', async () => {
    renderPage()
    const table = await screen.findByRole('table')
    expect(mocks.listOperations).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleType: 'MOTO',
        fulfillmentStatus: 'SIN_ASIGNAR',
      }),
      expect.anything(),
    )
    const [, pendingRow, , orderedRow] = within(table).getAllByRole('row')
    expect(pendingRow).toHaveTextContent('Pendiente de asignar unidad')
    expect(orderedRow).toHaveTextContent('Pedida a Motos Norte (25/09/2026)')
    expect(
      within(pendingRow!).getByRole('button', { name: /Pedir a proveedor/ }),
    ).toBeInTheDocument()
    expect(
      within(orderedRow!).queryByRole('button', { name: /Asignar de stock/ }),
    ).not.toBeInTheDocument()
    expect(
      within(orderedRow!).getByRole('button', { name: /Registrar llegada/ }),
    ).toBeInTheDocument()
    // El color pedido está en el detalle desplegable de la fila.
    await userEvent.click(
      within(pendingRow!).getByRole('button', { name: /Ver detalle/ }),
    )
    expect(table).toHaveTextContent('Rojo')
  })

  it('filtra por situación', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')
    await user.selectOptions(
      screen.getByLabelText('Situación de la unidad'),
      'PENDIENTE_INGRESO',
    )
    await waitFor(() =>
      expect(mocks.listOperations).toHaveBeenLastCalledWith(
        expect.objectContaining({ fulfillmentStatus: 'PENDIENTE_INGRESO' }),
        expect.anything(),
      ),
    )
  })

  it('asigna una unidad del stock y carga el número de motor', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(
      await screen.findByRole('button', {
        name: 'Asignar de stock a la operación #201',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Operación #201' })
    const options = await within(dialog).findAllByRole('radio')
    // La del color deseado primero.
    expect(options[0]).toHaveAttribute('value', 'unit-roja')
    await user.click(options[1]!)
    expect(within(dialog).getByLabelText('Chasis (VIN) *')).toHaveValue(
      '9C2JC4110AR000111',
    )
    await user.type(within(dialog).getByLabelText(/Número de motor/), 'JC41E-111')
    await user.click(within(dialog).getByRole('button', { name: 'Asignar unidad' }))

    expect(mocks.listAssignableUnits).toHaveBeenCalledWith(
      unassigned,
      expect.anything(),
    )
    expect(mocks.assignUnit).toHaveBeenCalledWith('op-pending', {
      expectedVersion: 4,
      unitId: 'unit-azul',
      engineNumber: 'JC41E-111',
    })
    await waitFor(() => expect(mocks.listOperations).toHaveBeenCalledTimes(2))
  })

  it('no deja editar chasis ni motor sin inventario.gestionar', async () => {
    mocks.permissions = ['ventas.consultar', 'ventas.asignar_unidad']
    const user = userEvent.setup()
    renderPage()
    await user.click(
      await screen.findByRole('button', {
        name: 'Asignar de stock a la operación #201',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Operación #201' })
    await user.click((await within(dialog).findAllByRole('radio'))[0]!)
    expect(within(dialog).getByLabelText('Chasis (VIN) *')).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Asignar unidad' }))
    expect(mocks.assignUnit).toHaveBeenCalledWith('op-pending', {
      expectedVersion: 4,
      unitId: 'unit-roja',
    })
    expect(
      screen.queryByRole('button', { name: /Pedir a proveedor/ }),
    ).not.toBeInTheDocument()
  })

  it('pide la misma versión al proveedor A y al proveedor B', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Pedir a proveedor para la operación #201',
      }),
    )
    let dialog = screen.getByRole('dialog', { name: 'Operación #201' })
    const supplier = within(dialog).getByLabelText('Proveedor *')
    await within(supplier).findByRole('option', { name: 'Motos Norte' })
    expect(
      within(supplier).queryByRole('option', { name: 'Inactivo' }),
    ).not.toBeInTheDocument()
    await user.selectOptions(supplier, 'supplier-a')
    await user.type(within(dialog).getByLabelText('Costo estimado'), '1500000')
    await user.click(within(dialog).getByRole('button', { name: 'Realizar pedido' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(
      await screen.findByRole('button', {
        name: 'Pedir a proveedor para la operación #202',
      }),
    )
    dialog = screen.getByRole('dialog', { name: 'Operación #202' })
    // La disponibilidad informada es sólo una sugerencia.
    await user.click(
      await within(dialog).findByRole('button', { name: /Distribuidora Sur \(3\)/ }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Realizar pedido' }))

    expect(mocks.requestSupply).toHaveBeenNthCalledWith(1, 'op-pending', {
      expectedVersion: 4,
      supplierId: 'supplier-a',
      color: 'Rojo',
      estimatedCost: 1500000,
    })
    expect(mocks.requestSupply).toHaveBeenNthCalledWith(2, 'op-pending-2', {
      expectedVersion: 4,
      supplierId: 'supplier-b',
    })
  })

  it('registra la llegada con chasis y motor y la asigna a la operación', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(
      await screen.findByRole('button', {
        name: 'Registrar llegada de la operación #203',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Recibir abastecimiento' })
    expect(dialog).toHaveTextContent('Motos Norte · operación #203')
    await user.type(
      within(dialog).getByLabelText('VIN / chasis real *'),
      '9c2jc4110ar000333',
    )
    await user.type(within(dialog).getByLabelText('Número de motor *'), 'jc41e-333')
    await user.click(
      within(dialog).getByRole('button', { name: 'Recibir y crear unidad' }),
    )

    expect(mocks.receiveSupply).toHaveBeenCalledWith(
      'supply-203',
      expect.objectContaining({
        vin: '9C2JC4110AR000333',
        engineNumber: 'JC41E-333',
        branchId: 'branch-1',
      }),
    )
    await waitFor(() => expect(mocks.listOperations).toHaveBeenCalledTimes(2))
  })
})
