import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import { commissionApiGateway } from './api'

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('contrato HTTP de comisiones', () => {
  it('carga sucursales sin paginación y consulta vendedores por UUID real', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'token')
    const branch = {
      id: '84e778cc-7616-4792-b6db-d89f100bb6f1',
      name: 'San Miguel',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json([branch]))
      .mockResolvedValueOnce(
        json({
          items: [
            {
              id: '11b5de9b-9bc2-4777-bb78-9e4e9563dd20',
              employeeCode: 'V-1',
              fullName: 'Vendedora Uno',
            },
          ],
          total: 1,
          page: 1,
          limit: 100,
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await commissionApiGateway.listOptions()

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:3000/api/branches',
      'http://localhost:3000/api/sales/operations/sellers?branchId=84e778cc-7616-4792-b6db-d89f100bb6f1&page=1&limit=100',
    ])
  })

  it('omite placeholders e IDs inválidos en los filtros por defecto', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'token')
    const fetchMock = vi.fn().mockResolvedValue(
      json({ items: [], total: 0, page: 1, limit: 50 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await commissionApiGateway.listSuggestions({
      vehicleType: 'MOTO',
      period: '2026-08',
      branchId: 'Todas',
      sellerId: 'Todos',
      page: 1,
      limit: 50,
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://localhost:3000/api/commissions/suggestions?vehicleType=MOTO&period=2026-08&page=1&limit=50',
    )
  })

  it('envía branchId sólo cuando se selecciona un UUID real', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'token')
    const fetchMock = vi.fn().mockResolvedValue(
      json({ items: [], total: 0, page: 1, limit: 50 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const branchId = '84e778cc-7616-4792-b6db-d89f100bb6f1'

    await commissionApiGateway.listSuggestions({
      vehicleType: 'AUTO',
      period: '2026-08',
      branchId,
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      `branchId=${branchId}`,
    )
  })

  it('envía tipo obligatorio y nombres definitivos de filtros al sugerido', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'token')
    const fetchMock = vi.fn().mockResolvedValue(json({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
    }))
    vi.stubGlobal('fetch', fetchMock)

    await commissionApiGateway.listSuggestions({
      vehicleType: 'MOTO',
      period: '2026-08',
      minSales: 11,
      maxSales: 15,
      page: 1,
      limit: 50,
    })

    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('/api/commissions/suggestions?')
    expect(url).toContain('vehicleType=MOTO')
    expect(url).toContain('period=2026-08')
    expect(url).toContain('minComputableSales=11')
    expect(url).toContain('maxComputableSales=15')
    expect(url).not.toContain('minSales=')
  })

  it('usa PUT para acuerdo y conserva el control optimista', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'token')
    const fetchMock = vi.fn().mockResolvedValue(json({}))
    vi.stubGlobal('fetch', fetchMock)

    await commissionApiGateway.registerAgreement('suggestion-1', {
      agreedAmount: '48000.00',
      meetingDate: '2026-08-29',
      notes: 'Acuerdo presencial',
      expectedVersion: 4,
    })

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/api/commissions/suggestions/suggestion-1/agreement')
    expect(request.method).toBe('PUT')
    expect(JSON.parse(String(request.body))).toEqual({
      agreedAmount: '48000.00',
      meetingDate: '2026-08-29',
      notes: 'Acuerdo presencial',
      expectedVersion: 4,
    })
  })

  it('paga el total acordado sin aceptar un amount del frontend', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'token')
    const fetchMock = vi.fn().mockResolvedValue(json({}))
    vi.stubGlobal('fetch', fetchMock)

    await commissionApiGateway.pay('settlement-1', {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 4,
      accountId: 'account-1',
      paidAt: '2026-08-29',
      reference: 'REC-11',
    })

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/api/commissions/settlements/settlement-1/payments')
    expect(request.method).toBe('POST')
    const body = JSON.parse(String(request.body)) as Record<string, unknown>
    expect(body).not.toHaveProperty('amount')
    expect(body).toEqual({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 4,
      accountId: 'account-1',
      paidAt: '2026-08-29',
      reference: 'REC-11',
    })
  })

  it('consulta datos propios sin posibilidad de enviar sellerId', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'token')
    const fetchMock = vi.fn().mockResolvedValue(json({}))
    vi.stubGlobal('fetch', fetchMock)

    await commissionApiGateway.getMine('2026-08', 'AUTO')

    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('/api/commissions/me?period=2026-08&vehicleType=AUTO')
    expect(url).not.toContain('sellerId')
  })
})
