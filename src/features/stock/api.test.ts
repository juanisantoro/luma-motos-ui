import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import {
  listSalesBranches,
  listSalesCatalogModels,
  listSalesPhysicalUnits,
  listSalesSupplierAvailability,
  stockApiGateway,
} from './api'
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
  it('mapea la política efectiva de sucursal expuesta por catálogo', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
    const activePricePolicy = {
      id: 'policy-branch',
      branchId: branch.id,
      currency: 'ARS',
      listPrice: '2600000',
      minimumPrice: '2500000',
      validFrom: '2026-08-01T00:00:00.000Z',
      validUntil: null,
      scope: 'BRANCH',
      status: 'ACTIVE',
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(
      json(
        page([
          {
            ...version,
            hasActivePricePolicy: true,
            pricingStatus: 'ACTIVE',
            activePricePolicy,
          },
        ]),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await listSalesCatalogModels(
      'MOTO',
      undefined,
      branch.id,
    )

    expect(result[0]).toEqual(
      expect.objectContaining({
        pricingStatus: 'ACTIVE',
        pricePolicy: expect.objectContaining({
          id: 'policy-branch',
          branchId: branch.id,
          listPrice: 2_600_000,
          scope: 'BRANCH',
        }),
      }),
    )
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      `branchId=${encodeURIComponent(branch.id)}`,
    )
  })

  it('carga para ventas sólo sucursales, stock disponible y proveedores', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
    const fetchMock = vi
      .fn()
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
    vi.stubGlobal('fetch', fetchMock)

    const [branches, units, availability] = await Promise.all([
      listSalesBranches(),
      listSalesPhysicalUnits('MOTO'),
      listSalesSupplierAvailability('MOTO'),
    ])

    expect(branches).toEqual([branch])
    expect(units[0]).toEqual(expect.objectContaining({ vin: 'VIN-001' }))
    expect(availability[0]).toEqual(
      expect.objectContaining({ quantity: 3, vehicleType: 'MOTO' }),
    )
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:3000/api/inventory/branches',
      'http://localhost:3000/api/inventory/units?vehicleType=MOTO&inventoryStatus=EN_STOCK&page=1&limit=100',
      'http://localhost:3000/api/supplier-availability?vehicleType=MOTO&page=1&limit=100',
    ])
  })

  it('carga y normaliza catálogo, inventario, proveedores y abastecimiento', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(page([version])))
      .mockResolvedValueOnce(json(page([model])))
      .mockResolvedValueOnce(json(page([supplier])))
      .mockResolvedValueOnce(
        json(
          page([
            {
              id: 'policy-1',
              versionId: version.id,
              branchId: null,
              currency: 'ARS',
              listPrice: '1500000.00',
              minimumPrice: '1400000.00',
              validFrom: '2026-01-01T00:00:00.000Z',
              validUntil: null,
            },
          ]),
        ),
      )
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
      'http://localhost:3000/api/catalog/price-policies?vehicleType=MOTO&page=1&limit=100',
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
      .mockResolvedValueOnce(json(page([])))
      .mockResolvedValueOnce(
        json({
          id: 'policy-1',
          versionId: version.id,
          branchId: null,
          currency: 'ARS',
          listPrice: '1500000.00',
          minimumPrice: '1400000.00',
          validFrom: '2026-08-29T00:00:00.000Z',
          validUntil: null,
        }),
      )
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
        listPrice: 1500000,
        minimumPrice: 1400000,
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
      'http://localhost:3000/api/catalog/price-policies?vehicleType=MOTO&versionId=version-1&page=1&limit=100',
      'http://localhost:3000/api/catalog/price-policies',
      'http://localhost:3000/api/inventory/units',
    ])
    const versionRequest = fetchMock.mock.calls[5]?.[1] as RequestInit
    expect(JSON.parse(String(versionRequest.body))).toEqual({
      modelId: 'model-1',
      name: '110 S',
      scope: 'GLOBAL',
    })
    const priceRequest = fetchMock.mock.calls[7]?.[1] as RequestInit
    expect(JSON.parse(String(priceRequest.body))).toEqual(
      expect.objectContaining({
        versionId: 'version-1',
        currency: 'ARS',
        listPrice: 1500000,
        minimumPrice: 1400000,
      }),
    )
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
      receivedAt: '2026-08-29T12:00:00.000Z',
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
      receivedAt: '2026-08-29T12:00:00.000Z',
      idempotencyKey: 'receive-key-1',
    })
  })

  it('envía fecha informada al actualizar disponibilidad', async () => {
      sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
      const fetchMock = vi.fn().mockResolvedValueOnce(json({}))
      vi.stubGlobal('fetch', fetchMock)

      await stockApiGateway.upsertAvailability({
        vehicleType: 'MOTO',
        condition: 'NUEVO',
        catalogModelId: version.id,
        supplierId: supplier.id,
        quantity: 4,
        reportedAt: '2026-08-29',
        notes: 'Entrega en 72 horas',
      })

      const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(
        'http://localhost:3000/api/supplier-availability',
      )
      expect(JSON.parse(String(request.body))).toEqual({
        supplierId: supplier.id,
        versionId: version.id,
        condition: 'NUEVO',
        reportedQuantity: 4,
        reportedAt: '2026-08-29',
        notes: 'Entrega en 72 horas',
    })
  })
})
