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
  brandId: 'brand-1',
  modelId: 'model-1',
  vehicleType: 'MOTO',
  brand: 'Honda',
  model: 'Wave',
  version: '110 S',
  active: true,
  pricePolicy: {
    id: 'price-1',
    versionId: 'version-1',
    branchId: null,
    currency: 'ARS',
    listPrice: 1500000,
    minimumPrice: 1400000,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: null,
  },
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
  status: 'EN_STOCK',
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
  operation: null,
  receivedUnit: null,
  receivedUnitId: null,
}
const data: StockWorkspaceData = {
  branches: [branch],
  suppliers: [supplier],
  models: [
    {
      id: 'model-1',
      vehicleType: 'MOTO',
      name: 'Wave',
      active: true,
      brand: { id: 'brand-1', name: 'Honda', active: true },
    },
  ],
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
  createSharedCatalog: false,
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
    onConfigurePrice: vi.fn().mockResolvedValue(undefined),
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
      screen.getByRole('button', { name: /Ingresar motos/ }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Ingresar motos al stock',
    })
    expect(
      within(dialog).getByText(/permiso adicional/),
    ).toBeInTheDocument()
    await user.selectOptions(
      within(dialog).getByLabelText('Marca y modelo'),
      model.id,
    )
    await user.type(
      within(dialog).getByLabelText('Chasis / VIN unidad 1'),
      'vin-nuevo-1',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Agregar unidad' }),
    )
    await user.type(
      within(dialog).getByLabelText('Chasis / VIN unidad 2'),
      'vin-nuevo-1',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Ingresar 2 unidades' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'un VIN o chasis diferente',
    )

    await user.clear(
      within(dialog).getByLabelText('Chasis / VIN unidad 2'),
    )
    await user.type(
      within(dialog).getByLabelText('Chasis / VIN unidad 2'),
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
      screen.getByRole('tab', { name: 'Abastecimientos' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Confirmar disponibilidad' }),
    )

    expect(handlers.onTransitionSupply).toHaveBeenCalledWith(
      supply.id,
      'CONFIRMADO',
    )
  })

  it('actualiza disponibilidad sin confundirla con stock físico', async () => {
    const user = userEvent.setup()
    const handlers = renderWorkspace()

    await user.click(
      screen.getByRole('tab', { name: 'Disponibilidad de proveedores' }),
    )
    expect(screen.getByText('Sin VIN · fuera del stock físico')).toBeInTheDocument()
    await user.click(
      screen.getAllByRole('button', { name: 'Actualizar cantidad' })[0]!,
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Actualizar disponibilidad',
    })
    const quantity = within(dialog).getByLabelText('Cantidad informada *')
    expect(quantity).toHaveAttribute('min', '0')
    await user.clear(quantity)
    await user.type(quantity, '0')
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Actualizar disponibilidad',
      }),
    )

    expect(handlers.onUpsertAvailability).toHaveBeenCalledWith({
      vehicleType: 'MOTO',
      condition: 'NUEVO',
      catalogModelId: model.id,
      supplierId: supplier.id,
      quantity: 0,
      reportedAt: '2026-08-29',
      notes: 'Entrega en 72 horas',
    })
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
          {
            ...supply,
            status: 'EN_TRANSITO',
            receivedUnit: null,
            receivedUnitId: null,
          },
          {
            ...supply,
            id: 'supply-received',
            status: 'RECIBIDO',
            receivedUnit: received,
            receivedUnitId: received.id,
          },
        ],
      },
    })

    await user.click(
      screen.getByRole('tab', { name: 'Abastecimientos' }),
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

  it('bloquea modelos sin precio y permite configurar una política real', async () => {
    const user = userEvent.setup()
    const withoutPrice = {
      ...model,
      id: 'version-without-price',
      model: 'Biz',
      pricePolicy: null,
    }
    const handlers = renderWorkspace({
      data: { ...data, catalog: [...data.catalog, withoutPrice] },
      capabilities: { ...capabilities, createCatalog: true },
    })

    await user.click(
      screen.getByRole('tab', { name: 'Catálogo de modelos' }),
    )
    expect(screen.getByText('Sin precio configurado')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Configurar precio' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Configurar precio' })
    await user.type(
      within(dialog).getByLabelText('Precio sugerido *'),
      '2500000',
    )
    await user.type(
      within(dialog).getByLabelText('Precio mínimo *'),
      '2300000',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar precio' }),
    )

    expect(handlers.onConfigurePrice).toHaveBeenCalledWith({
      versionId: withoutPrice.id,
      listPrice: 2500000,
      minimumPrice: 2300000,
    })
  })

  it('informa disponibilidad sin solicitar VIN y con proveedor real', async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(
      screen.getByRole('button', { name: /Motos de proveedor/ }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Informar motos de proveedor',
    })

    expect(within(dialog).queryByLabelText(/VIN|chasis/i)).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('option', { name: supplier.name }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByLabelText('Fecha de actualización'),
    ).toHaveAttribute('type', 'date')
  })

  it('oculta mutaciones cuando faltan permisos', () => {
    renderWorkspace({
      capabilities: {
        viewCatalog: false,
        viewAvailability: false,
        viewSupply: false,
        createUnits: false,
        createCatalog: false,
        createSharedCatalog: false,
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
