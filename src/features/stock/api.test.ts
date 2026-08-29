import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import { stockApiGateway } from './api'
import type {
  CreateUnitsInput,
  StockCapabilities,
} from './types'

const capabilities: StockCapabilities = {
  viewCatalog: true,
  viewAvailability: true,
  viewSupply: true,
  createUnits: true,
  createCatalog: true,
  createSharedCatalog: false,
  manageAvailability: true,
  manageSupply: true,
  receiveSupply: true,
}
const brand = { id: 'brand-1', name: 'Honda', active: true }
const model = {
  id: 'model-1',
  vehicleType: 'MOTO',
  name: 'Wave',
  active: true,
  brand,
}
const version = {
  id: 'version-1',
  name: '110 S',
  active: true,
  model,
}
const branch = { id: 'branch-1', name: 'San Miguel' }
const supplier = { id: 'supplier-1', legalName: 'Proveedor Norte' }
const unit = {
  id: 'unit-1',
  vehicleType: 'MOTO',
  condition: 'NUEVO',
  vin: 'VIN-001',
  manufactureYear: 2026,
  mileageKm: 0,
  licensePlate: null,
  acquisitionOrigin: 'PROVEEDOR',
  inventoryStatus: 'EN_STOCK',
  receivedAt: '2026-08-29T12:00:00.000Z',
  version,
  branch,
  supplier,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function page(items: unknown[]) {
  return { items, total: items.length, page: 1, limit: 100 }
}

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('contrato API de stock', () => {
  it('carga y normaliza catálogo, inventario, proveedores y abastecimiento', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(page([version])))
      .mockResolvedValueOnce(json(page([model])))
      .mockResolvedValueOnce(json(page([supplier])))
      .mockResolvedValueOnce(json([branch]))
      .mockResolvedValueOnce(json(page([unit])))
      .mockResolvedValueOnce(
        json(
          page([
            {
              id: 'availability-1',
              condition: 'NUEVO',
              reportedQuantity: 3,
              notes: null,
              reportedAt: '2026-08-29T12:00:00.000Z',
              version,
              supplier,
            },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        json(
          page([
            {
              id: 'supply-1',
              condition: 'NUEVO',
              status: 'EN_TRANSITO',
              requestedAt: '2026-08-29T12:00:00.000Z',
              version,
              supplier,
              branch,
              receivedUnitId: null,
            },
          ]),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await stockApiGateway.loadWorkspace(
      'MOTO',
      capabilities,
      undefined,
    )

    expect(result.units[0]).toEqual(
      expect.objectContaining({
        vin: 'VIN-001',
        status: 'EN_STOCK',
        branch,
      }),
    )
    expect(result.availability[0]?.quantity).toBe(3)
    expect(result.supplies[0]).toEqual(
      expect.objectContaining({
        status: 'EN_TRANSITO',
        destinationBranch: branch,
      }),
    )
    expect(result.branches).toEqual([branch])
    expect(
      fetchMock.mock.calls.map(([url]) => String(url)),
    ).toEqual([
      'http://localhost:3000/api/catalog/versions?vehicleType=MOTO&active=true&page=1&limit=100',
      'http://localhost:3000/api/catalog/models?vehicleType=MOTO&active=true&page=1&limit=100',
      'http://localhost:3000/api/suppliers?active=true&page=1&limit=100',
      'http://localhost:3000/api/inventory/branches',
      'http://localhost:3000/api/inventory/units?vehicleType=MOTO&page=1&limit=100',
      'http://localhost:3000/api/supplier-availability?vehicleType=MOTO&page=1&limit=100',
      'http://localhost:3000/api/supply-requests?vehicleType=MOTO&page=1&limit=100',
    ])
  })

  it('usa el alta bulk atómica y el DTO de inventario', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ items: [unit, unit], count: 2 }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const input: CreateUnitsInput = {
      vehicleType: 'MOTO',
      condition: 'NUEVO',
      catalogModelId: version.id,
      units: [
        {
          vin: 'VIN-001',
          branchId: branch.id,
          year: 2026,
          mileage: 0,
          receivedAt: '2026-08-29',
          acquisitionOrigin: 'PROVEEDOR',
          supplierId: supplier.id,
        },
        {
          vin: 'VIN-002',
          branchId: branch.id,
          year: 2026,
          mileage: 0,
          receivedAt: '2026-08-29',
          acquisitionOrigin: 'OTRO',
        },
      ],
    }

    await stockApiGateway.createUnits(input)

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/api/inventory/units/bulk')
    expect(request.method).toBe('POST')
    expect(JSON.parse(String(request.body))).toEqual({
      units: [{
        versionId: 'version-1',
        vin: 'VIN-001',
        condition: 'NUEVO',
        manufactureYear: 2026,
        mileageKm: 0,
        branchId: 'branch-1',
        supplierId: 'supplier-1',
        acquisitionOrigin: 'PROVEEDOR',
        receivedAt: '2026-08-29',
      }, {
        versionId: 'version-1',
        vin: 'VIN-002',
        condition: 'NUEVO',
        manufactureYear: 2026,
        mileageKm: 0,
        branchId: 'branch-1',
        acquisitionOrigin: 'OTRO',
        receivedAt: '2026-08-29',
      }],
    })
  })

  it('crea marca, modelo y versión sólo por el flujo de catálogo', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(page([])))
      .mockResolvedValueOnce(json(brand, 201))
      .mockResolvedValueOnce(json(page([])))
      .mockResolvedValueOnce(json(model, 201))
      .mockResolvedValueOnce(json(page([])))
      .mockResolvedValueOnce(json(version, 201))
      .mockResolvedValueOnce(json(unit, 201))
    vi.stubGlobal('fetch', fetchMock)

    await stockApiGateway.createUnits({
      vehicleType: 'MOTO',
      condition: 'NUEVO',
      catalogModel: {
        brandName: 'Honda',
        modelName: 'Wave',
        versionName: '110 S',
        scope: 'GLOBAL',
      },
      units: [
        {
          vin: 'VIN-001',
          branchId: branch.id,
          year: 2026,
          mileage: 0,
          receivedAt: '2026-08-29',
          acquisitionOrigin: 'OTRO',
        },
      ],
    })

    expect(
      fetchMock.mock.calls.map(([url]) => String(url)),
    ).toEqual([
      'http://localhost:3000/api/catalog/brands?search=Honda&active=true&page=1&limit=100',
      'http://localhost:3000/api/catalog/brands',
      'http://localhost:3000/api/catalog/models?vehicleType=MOTO&brandId=brand-1&search=Wave&active=true&page=1&limit=100',
      'http://localhost:3000/api/catalog/models',
      'http://localhost:3000/api/catalog/versions?vehicleType=MOTO&modelId=model-1&search=110+S&active=true&scope=GLOBAL&page=1&limit=100',
      'http://localhost:3000/api/catalog/versions',
      'http://localhost:3000/api/inventory/units',
    ])
    const versionRequest = fetchMock.mock.calls[5]?.[1] as RequestInit
    expect(JSON.parse(String(versionRequest.body))).toEqual({
      modelId: 'model-1',
      name: '110 S',
      scope: 'GLOBAL',
    })
  })

  it('envía transición y recepción idempotente con los DTOs acordados', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({}))
    vi.stubGlobal('fetch', fetchMock)

    await stockApiGateway.transitionSupply('supply-1', 'PEDIDO')
    await stockApiGateway.receiveSupply('supply-1', {
      vin: 'VIN-RECIBIDO',
      branchId: branch.id,
      year: 2026,
      mileage: 0,
      idempotencyKey: 'receive-key-1',
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3000/api/supply-requests/supply-1/transitions',
    )
    const transitionRequest = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(transitionRequest.body))).toEqual({
      toStatus: 'PEDIDO',
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://localhost:3000/api/supply-requests/supply-1/receive',
    )
    const receiveRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(JSON.parse(String(receiveRequest.body))).toEqual({
      vin: 'VIN-RECIBIDO',
      branchId: 'branch-1',
      manufactureYear: 2026,
      mileageKm: 0,
      idempotencyKey: 'receive-key-1',
    })
  })
})
