import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import {
  createSalesOperation,
  createLinkedSupplyRequest,
  getSalesPricePolicy,
  listSalesOperations,
  listSalesSellers,
  rejectSalesOperation,
  releaseSalesReservation,
} from './api'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('contrato API de operaciones', () => {
  it('envía filtros de historial y autenticación Bearer', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
    const fetchMock = vi.fn().mockResolvedValueOnce(
      json({ items: [], total: 0, page: 2, limit: 20 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await listSalesOperations({
      status: 'PENDIENTE_APROBACION',
      search: 'Ana',
      from: '2026-08-01',
      page: 2,
      limit: 20,
    })

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'http://localhost:3000/api/sales/operations?status=PENDIENTE_APROBACION&search=Ana&from=2026-08-01&page=2&limit=20',
    )
    expect(new Headers(request.headers).get('Authorization')).toBe(
      'Bearer sales-token',
    )
  })

  it('crea una operación sin enviar precios calculados por frontend', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 'operation-1' }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await createSalesOperation({
      branchId: 'branch-1',
      clientId: 'client-1',
      versionId: 'version-1',
      condition: 'NUEVO',
      agreedPrice: 4_500_000,
      unitId: 'unit-1',
      sellerId: 'seller-1',
    })

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(request.method).toBe('POST')
    expect(JSON.parse(String(request.body))).toEqual({
      branchId: 'branch-1',
      clientId: 'client-1',
      versionId: 'version-1',
      condition: 'NUEVO',
      agreedPrice: 4_500_000,
      unitId: 'unit-1',
      sellerId: 'seller-1',
    })
  })

  it('usa rowVersion al liberar una reserva y rechazar una aprobación', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'operation-1', rowVersion: 8 }))
      .mockResolvedValueOnce(json({ id: 'operation-1', rowVersion: 9 }))
    vi.stubGlobal('fetch', fetchMock)

    await releaseSalesReservation('operation-1', {
      expectedVersion: 7,
      reason: 'Cliente desistió',
    })
    await rejectSalesOperation('operation-1', {
      expectedVersion: 8,
      reason: 'Precio fuera de política',
    })

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:3000/api/sales/operations/operation-1/reservation/release',
      'http://localhost:3000/api/sales/operations/operation-1/reject',
    ])
    const firstRequest = fetchMock.mock.calls[0]?.[1] as RequestInit
    const secondRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(JSON.parse(String(firstRequest.body))).toEqual({
      expectedVersion: 7,
      reason: 'Cliente desistió',
    })
    expect(JSON.parse(String(secondRequest.body))).toEqual({
      expectedVersion: 8,
      reason: 'Precio fuera de política',
    })
  })

  it('consulta Mis operaciones, vendedores y política sin inferencias locales', async () => {
      sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ items: [], total: 0, page: 1, limit: 20 }))
        .mockResolvedValueOnce(json({ items: [], total: 0, page: 1, limit: 100 }))
        .mockResolvedValueOnce(
          json({
            id: 'policy-1',
            branchId: 'branch-1',
            versionId: 'version-1',
            listPrice: '5000000',
            minimumPrice: '4500000',
          }),
        )
      vi.stubGlobal('fetch', fetchMock)

      await listSalesOperations({ mine: true, page: 1, limit: 20 })
      await listSalesSellers({ branchId: 'branch-1', limit: 100 })
      await getSalesPricePolicy({
        branchId: 'branch-1',
        versionId: 'version-1',
        operationDate: '2026-08-29',
      })

      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        'http://localhost:3000/api/sales/operations?mine=true&page=1&limit=20',
        'http://localhost:3000/api/sales/operations/sellers?branchId=branch-1&limit=100',
        'http://localhost:3000/api/sales/operations/price-policy?branchId=branch-1&versionId=version-1&operationDate=2026-08-29',
      ])
    })

    it('vincula el abastecimiento proveedor a la operación borrador', async () => {
      sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
      const fetchMock = vi.fn().mockResolvedValueOnce(
        json({ id: 'supply-1', operationId: 'operation-1' }, 201),
      )
      vi.stubGlobal('fetch', fetchMock)

      await createLinkedSupplyRequest({
        supplierId: 'supplier-1',
        supplierAvailabilityId: 'availability-1',
        operationId: 'operation-1',
        versionId: 'version-1',
        condition: 'NUEVO',
        arrivalBranchId: 'branch-1',
      })

      const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('http://localhost:3000/api/supply-requests')
      expect(JSON.parse(String(request.body))).toEqual({
        supplierId: 'supplier-1',
        supplierAvailabilityId: 'availability-1',
        operationId: 'operation-1',
        versionId: 'version-1',
        condition: 'NUEVO',
        arrivalBranchId: 'branch-1',
      })
  })
})
