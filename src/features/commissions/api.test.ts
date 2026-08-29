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
