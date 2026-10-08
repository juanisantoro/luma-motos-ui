import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogBrowserPage } from './CatalogBrowserPage'
import type { CatalogModel, PhysicalUnit } from '../stock/types'

const mocks = vi.hoisted(() => ({
  models: vi.fn(),
  units: vi.fn(),
  availability: vi.fn(),
  branches: vi.fn(),
}))

const excel = vi.hoisted(() => ({ download: vi.fn(() => Promise.resolve()) }))
vi.mock('../../shared/export/excel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/export/excel')>()),
  downloadExcel: excel.download,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', globalAccess: false, organization: { id: 'org-1' } },
  }),
}))

vi.mock('../stock/api', () => ({
  listSalesCatalogModels: mocks.models,
  listSalesPhysicalUnits: mocks.units,
  listSalesSupplierAvailability: mocks.availability,
  listSalesBranches: mocks.branches,
}))

const policy = {
  id: 'price-1',
  versionId: 'version-1',
  branchId: null,
  currency: 'ARS',
  listPrice: 1500000,
  minimumPrice: 1400000,
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: null,
}

const honda: CatalogModel = {
  id: 'version-1',
  brandId: 'brand-1',
  modelId: 'model-1',
  vehicleType: 'MOTO',
  brand: 'Honda',
  model: 'Wave',
  version: '110 S',
  active: true,
  photoUrl: null,
  pricePolicy: policy,
}

const yamaha: CatalogModel = {
  ...honda,
  id: 'version-2',
  brand: 'Yamaha',
  model: 'FZ',
  version: null,
  pricePolicy: null,
}

const unit: PhysicalUnit = {
  id: 'unit-1',
  vehicleType: 'MOTO',
  catalogModel: honda,
  condition: 'NUEVO',
  vin: 'VIN-1',
  year: 2026,
  mileage: 0,
  licensePlate: null,
  color: null,
  acabado: null,
  acquisitionOrigin: 'PROVEEDOR',
  supplier: { id: 'supplier-1', name: 'Proveedor Norte' },
  status: 'EN_STOCK',
  branch: { id: 'branch-1', name: 'San Miguel' },
  receivedAt: '2026-08-29T12:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.models.mockResolvedValue([honda, yamaha])
  mocks.units.mockResolvedValue([unit])
  mocks.availability.mockResolvedValue([])
  mocks.branches.mockResolvedValue([])
})

describe('Catálogo', () => {
  it('exporta a Excel los modelos que deja la búsqueda, con el precio como número', async () => {
    const user = userEvent.setup()
    render(<CatalogBrowserPage vehicleType="MOTO" />)
    await screen.findByRole('heading', { name: 'Catálogo de motos' })

    await user.type(screen.getByPlaceholderText('Buscar por marca, modelo o versión'), 'honda')
    await user.click(screen.getByRole('button', { name: 'Exportar a Excel' }))

    await waitFor(() => expect(excel.download).toHaveBeenCalledTimes(1))
    const [options] = excel.download.mock.calls[0] as unknown as [
      {
        title: string
        filters: unknown[]
        rows: Array<{ model: CatalogModel }>
        columns: Array<{ header: string; value: (row: never) => unknown }>
      },
    ]
    expect(options.title).toBe('Catálogo de motos')
    expect(options.filters).toContain('Búsqueda: honda')
    expect(options.rows.map((row) => row.model.id)).toEqual(['version-1'])
    const row = options.rows[0] as never
    const value = (header: string) =>
      options.columns.find((column) => column.header === header)!.value(row)
    expect(value('Marca')).toBe('Honda')
    expect(value('Versión')).toBe('110 S')
    expect(value('Precio')).toBe(1500000)
    expect(value('Moneda')).toBe('ARS')
    expect(value('En stock')).toBe(1)
    expect(value('Stock por sucursal')).toBe('San Miguel: 1')
    expect(value('Proveedor')).toBe('Proveedor Norte')
  })
})
