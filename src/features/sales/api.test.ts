import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import {
  createSalesTradeIn,
  createSalesOperation,
  getSalesPricePolicy,
  listSalesFinancialInstitutions,
  listSalesApprovals,
  listSalesContacts,
  listSalesOperations,
  listSalesSellers,
  rejectSalesOperation,
  replaceSalesPaymentPlan,
  releaseSalesReservation,
  submitSalesOperation,
} from './api'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(
  /\/+$/,
  '',
)

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
      vehicleType: 'MOTO',
      status: 'PENDIENTE_APROBACION',
      search: 'Ana',
      from: '2026-08-01',
      page: 2,
      limit: 20,
    })

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      `${API_URL}/sales/operations?vehicleType=MOTO&status=PENDIENTE_APROBACION&search=Ana&from=2026-08-01&page=2&limit=20`,
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
      vehicleType: 'MOTO',
      branchId: 'branch-1',
      clientId: 'client-1',
      versionId: 'version-1',
      condition: 'NUEVO',
      agreedPrice: 4_500_000,
      paymentPlatform: 'EFECTIVO',
      unitId: 'unit-1',
      sellerId: 'seller-1',
      deliveryStatus: 'NO_PROGRAMADA',
      papersDelivered: false,
      debt: 'NO',
      submit: true,
    })

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(request.method).toBe('POST')
    expect(JSON.parse(String(request.body))).toEqual({
      vehicleType: 'MOTO',
      branchId: 'branch-1',
      clientId: 'client-1',
      versionId: 'version-1',
      condition: 'NUEVO',
      agreedPrice: 4_500_000,
      paymentPlatform: 'EFECTIVO',
      unitId: 'unit-1',
      sellerId: 'seller-1',
      deliveryStatus: 'NO_PROGRAMADA',
      papersDelivered: false,
      debt: 'NO',
      submit: true,
    })
  })

  it('persiste toma, plan de pago y envío con rowVersion', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'operation-1', rowVersion: 2 }, 201))
      .mockResolvedValueOnce(json({ id: 'operation-1', rowVersion: 3 }))
      .mockResolvedValueOnce(json({ id: 'operation-1', rowVersion: 4 }))
      .mockResolvedValueOnce(json({ items: [], total: 0, page: 1, limit: 100 }))
    vi.stubGlobal('fetch', fetchMock)

    await createSalesTradeIn('operation-1', {
      expectedVersion: 1,
      description: 'Honda usada',
      appraisedAmount: 1_000_000,
      acceptedAmount: 900_000,
    })
    await replaceSalesPaymentPlan('operation-1', {
      expectedVersion: 2,
      components: [
        {
          type: 'FINANCIACION',
          amount: 2_000_000,
          financialInstitutionId: 'bank-1',
        },
      ],
    })
    await submitSalesOperation('operation-1', 3)
    await listSalesFinancialInstitutions()

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `${API_URL}/sales/operations/operation-1/trade-ins`,
      `${API_URL}/sales/operations/operation-1/payment-plan`,
      `${API_URL}/sales/operations/operation-1/submit`,
      `${API_URL}/financial-institutions?active=true&page=1&limit=100`,
    ])
    const paymentRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(JSON.parse(String(paymentRequest.body))).toEqual({
      expectedVersion: 2,
      components: [
        {
          type: 'FINANCIACION',
          amount: 2_000_000,
          financialInstitutionId: 'bank-1',
        },
      ],
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
      `${API_URL}/sales/operations/operation-1/reservation/release`,
      `${API_URL}/sales/operations/operation-1/reject`,
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

      await listSalesOperations({
        vehicleType: 'MOTO',
        mine: true,
        page: 1,
        limit: 20,
      })
      await listSalesSellers({ branchId: 'branch-1', limit: 100 })
      await listSalesContacts({ branchId: 'branch-1', limit: 100 })
      await getSalesPricePolicy({
        branchId: 'branch-1',
        versionId: 'version-1',
        vehicleType: 'MOTO',
        operationDate: '2026-08-29',
      })

      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        `${API_URL}/sales/operations?vehicleType=MOTO&mine=true&page=1&limit=20`,
        `${API_URL}/sales/operations/sellers?branchId=branch-1&limit=100`,
        `${API_URL}/sales/operations/contacts?branchId=branch-1&limit=100`,
        `${API_URL}/sales/operations/price-policy?branchId=branch-1&versionId=version-1&vehicleType=MOTO&operationDate=2026-08-29`,
      ])
    })

    it('usa la bandeja dedicada de aprobaciones con tipo obligatorio', async () => {
      sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
      const fetchMock = vi.fn().mockResolvedValueOnce(
        json({ items: [], total: 0, page: 1, limit: 100 }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await listSalesApprovals({
        vehicleType: 'AUTO',
        page: 1,
        limit: 100,
      })

      expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
        `${API_URL}/sales/operations/approvals?vehicleType=AUTO&page=1&limit=100`,
      )
    })

    it('carga todas las páginas de vendedores cuando superan el límite', async () => {
      sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
      const firstItems = Array.from({ length: 100 }, (_, index) => ({
        id: `seller-${index + 1}`,
        employeeCode: `V${index + 1}`,
        fullName: `Vendedor ${index + 1}`,
      }))
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          json({ items: firstItems, total: 101, page: 1, limit: 100 }),
        )
        .mockResolvedValueOnce(
          json({
            items: [
              {
                id: 'seller-101',
                employeeCode: 'V101',
                fullName: 'Vendedor actual',
                isCurrentUser: true,
              },
            ],
            total: 101,
            page: 2,
            limit: 100,
          }),
        )
      vi.stubGlobal('fetch', fetchMock)

      const result = await listSalesSellers({
        branchId: 'branch-1',
        limit: 100,
      })

      expect(result.items).toHaveLength(101)
      expect(result.items.at(-1)?.isCurrentUser).toBe(true)
      expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
        `${API_URL}/sales/operations/sellers?branchId=branch-1&limit=100&page=2`,
      )
    })

    it('consulta vendedores organizacionales sin inferir una sucursal', async () => {
      sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
      const fetchMock = vi.fn().mockResolvedValueOnce(
        json({ items: [], total: 0, page: 1, limit: 100 }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await listSalesSellers({
        organizationId: 'org-1',
        page: 1,
        limit: 100,
      })

      expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
        `${API_URL}/sales/operations/sellers?organizationId=org-1&page=1&limit=100`,
      )
    })

})
