import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StockWorkspace } from './StockWorkspace'
import type {
  CatalogModel,
  PhysicalUnit,
  StockCapabilities,
  StockWorkspaceData,
  SupplyOrder,
} from './types'

const branch = { id: 'branch-1', name: 'San Miguel' }
const supplier = { id: 'supplier-1', name: 'Proveedor Norte' }
const model: CatalogModel = {
  id: 'version-1',
  vehicleType: 'MOTO',
  brand: 'Honda',
  model: 'Wave',
  version: '110 S',
  active: true,
}
const unit: PhysicalUnit = {
  id: 'unit-1',
  vehicleType: 'MOTO',
  catalogModel: model,
  condition: 'NUEVO',
  vin: 'VIN-HONDA-001',
  year: 2026,
  mileage: 0,
  licensePlate: null,
  acquisitionOrigin: 'PROVEEDOR',
  supplier,
  status: 'AVAILABLE',
  branch,
  receivedAt: '2026-08-29T12:00:00.000Z',
}
const supply: SupplyOrder = {
  id: 'supply-1',
  vehicleType: 'MOTO',
  catalogModel: model,
  condition: 'NUEVO',
  supplier,
  quantity: 1,
  status: 'PENDIENTE_CONFIRMACION',
  destinationBranch: branch,
  requestedAt: '2026-08-29T12:00:00.000Z',
  receivedUnit: null,
}
const data: StockWorkspaceData = {
  branches: [branch],
  suppliers: [supplier],
  catalog: [
    model,
    {
      ...model,
      id: 'version-2',
      brand: 'Yamaha',
      model: 'FZ',
      version: null,
    },
  ],
  units: [unit],
  availability: [
    {
      id: 'availability-1',
      vehicleType: 'MOTO',
      catalogModel: model,
      condition: 'NUEVO',
      supplier,
      quantity: 4,
      notes: 'Entrega en 72 horas',
      updatedAt: '2026-08-29T12:00:00.000Z',
    },
  ],
  supplies: [supply],
}
const capabilities: StockCapabilities = {
  viewCatalog: true,
  viewAvailability: true,
  viewSupply: true,
  createUnits: true,
  createCatalog: false,
  manageAvailability: true,
  manageSupply: true,
  receiveSupply: true,
}

function renderWorkspace(overrides?: {
  data?: StockWorkspaceData
  capabilities?: StockCapabilities
}) {
  const handlers = {
    onCreateUnits: vi.fn().mockResolvedValue(undefined),
    onUpsertAvailability: vi.fn().mockResolvedValue(undefined),
    onTransitionSupply: vi.fn().mockResolvedValue(undefined),
    onReceiveSupply: vi.fn().mockResolvedValue(undefined),
  }
  render(
    <StockWorkspace
      capabilities={overrides?.capabilities ?? capabilities}
      data={overrides?.data ?? data}
      vehicleType="MOTO"
      {...handlers}
    />,
  )
  return handlers
}

describe('workspace de stock', () => {
  it('filtra unidades físicas por marca o modelo', async () => {
    const user = userEvent.setup()
    renderWorkspace()

    expect(screen.getAllByText(/Honda Wave/).length).toBeGreaterThan(0)
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar por marca o modelo' }),
      'Yamaha',
    )

    expect(screen.queryByText('VIN-HONDA-001')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'No hay unidades físicas' }),
    ).toBeInTheDocument()
  })

  it('valida VIN únicos y permite alta física múltiple', async () => {
    const user = userEvent.setup()
    const handlers = renderWorkspace()

    await user.click(
      screen.getByRole('button', { name: 'Ingresar motos' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Ingresar motos',
    })
    expect(
      within(dialog).getByText(/permiso adicional/),
    ).toBeInTheDocument()
    await user.selectOptions(
      within(dialog).getByLabelText('Marca, modelo y versión'),
      model.id,
    )
    await user.type(
      within(dialog).getByLabelText('VIN / chasis unidad 1'),
      'vin-nuevo-1',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Agregar unidad' }),
    )
    await user.type(
      within(dialog).getByLabelText('VIN / chasis unidad 2'),
      'vin-nuevo-1',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Ingresar 2 unidades' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'un VIN o chasis diferente',
    )

    await user.clear(
      within(dialog).getByLabelText('VIN / chasis unidad 2'),
    )
    await user.type(
      within(dialog).getByLabelText('VIN / chasis unidad 2'),
      'vin-nuevo-2',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Ingresar 2 unidades' }),
    )

    expect(handlers.onCreateUnits).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleType: 'MOTO',
        condition: 'NUEVO',
        catalogModelId: model.id,
        units: [
          expect.objectContaining({ vin: 'VIN-NUEVO-1' }),
          expect.objectContaining({ vin: 'VIN-NUEVO-2' }),
        ],
      }),
    )
  })

  it('ejecuta la transición disponible del abastecimiento', async () => {
    const user = userEvent.setup()
    const handlers = renderWorkspace()

    await user.click(
      screen.getByRole('tab', { name: 'Abastecimiento' }),
    )
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(handlers.onTransitionSupply).toHaveBeenCalledWith(
      supply.id,
      'CONFIRMADO',
    )
  })

  it('recibe en sucursal y expone la unidad creada', async () => {
    const user = userEvent.setup()
    const received = {
      ...unit,
      id: 'unit-received',
      vin: 'VIN-RECIBIDO-1',
    }
    const handlers = renderWorkspace({
      data: {
        ...data,
        supplies: [
          { ...supply, status: 'EN_TRANSITO', receivedUnit: null },
          {
            ...supply,
            id: 'supply-received',
            status: 'RECIBIDA',
            receivedUnit: received,
          },
        ],
      },
    })

    await user.click(
      screen.getByRole('tab', { name: 'Abastecimiento' }),
    )
    expect(screen.getByText(/Unidad creada:/)).toHaveTextContent(
      'VIN-RECIBIDO-1',
    )
    await user.click(screen.getByRole('button', { name: 'Recibir' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Recibir abastecimiento',
    })
    await user.type(within(dialog).getByLabelText('VIN / chasis real *'), 'vin-arribo-2')
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Recibir y crear unidad',
      }),
    )

    expect(handlers.onReceiveSupply).toHaveBeenCalledWith(
      supply.id,
      expect.objectContaining({
        vin: 'VIN-ARRIBO-2',
        branchId: branch.id,
      }),
    )
  })

  it('oculta mutaciones cuando faltan permisos', () => {
    renderWorkspace({
      capabilities: {
        viewCatalog: false,
        viewAvailability: false,
        viewSupply: false,
        createUnits: false,
        createCatalog: false,
        manageAvailability: false,
        manageSupply: false,
        receiveSupply: false,
      },
    })

    expect(
      screen.queryByRole('button', { name: 'Ingresar motos' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Informar proveedor' }),
    ).not.toBeInTheDocument()
  })
})
