import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import { createCreditInquiry, listRejectedInquiries } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('credit inquiries API', () => {
  it('serializa filtros y envía idempotency key en el alta', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'credit-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [], total: 0, page: 2, limit: 20 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'inquiry-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await listRejectedInquiries({
      page: 2,
      limit: 20,
      search: 'Ana',
      financialEntityId: 'finance-1',
      branchId: 'branch-1',
    })
    await createCreditInquiry(
      {
        documentType: 'DNI',
        documentNumber: '12345678',
        fullName: 'Ana Pérez',
        financialEntityId: 'finance-1',
        outcome: 'RECHAZADA',
        reason: 'Scoring bajo',
        consultedAt: '2026-08-20',
        registeredById: 'seller-1',
      },
      'credit-inquiry:12345678',
    )

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3000/api/credit-inquiries/rejected?page=2&limit=20&search=Ana&financialEntityId=finance-1&branchId=branch-1',
    )
    const [, request] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(request.method).toBe('POST')
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe(
      'credit-inquiry:12345678',
    )
    expect(new Headers(request.headers).get('Authorization')).toBe(
      'Bearer credit-token',
    )
  })
})
