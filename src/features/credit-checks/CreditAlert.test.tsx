import { render, screen, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import { CreditAlert } from './CreditAlert'
import { useCreditCheck } from './useCreditCheck'
import type { CreditCheckResponse } from './types'

const flaggedResponse: CreditCheckResponse = {
  found: true,
  clientId: 'client-1',
  isFlagged: true,
  blocksSale: false,
  lastRejection: {
    inquiryId: 'inquiry-1',
    financialEntity: { id: 'finance-1', name: 'Banco del Sol' },
    rejectedAt: '2026-08-12T12:00:00.000Z',
    reason: 'Scoring insuficiente',
  },
  summary: {
    totalAttempts: 2,
    rejectedAttempts: 1,
    approvedAttempts: 1,
    pendingAttempts: 0,
    firstConsultedAt: '2026-07-01T12:00:00.000Z',
    lastConsultedAt: '2026-08-12T12:00:00.000Z',
  },
  checkedAt: '2026-08-29T12:00:00.000Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CreditAlert', () => {
  it('muestra financiera, fecha, motivo y aclara que no bloquea', () => {
    render(<CreditAlert state={{ status: 'success', data: flaggedResponse }} />)

    const alert = screen.getByRole('alert', {
      name: 'Alerta de antecedente crediticio',
    })
    expect(alert).toHaveTextContent('Banco del Sol')
    expect(alert).toHaveTextContent('12/08/2026')
    expect(alert).toHaveTextContent('Scoring insuficiente')
    expect(alert).toHaveTextContent('no bloquea la operación por sí sola')
  })

  it('permite reintentar un error sin mostrar datos del documento', async () => {
    const retry = vi.fn()
    const user = userEvent.setup()
    render(
      <CreditAlert
        state={{ status: 'error', message: 'No se pudo consultar.' }}
        onRetry={retry}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert')).not.toHaveTextContent(/\d{5,}/)
  })
})

describe('useCreditCheck', () => {
  it('consulta el endpoint tipado al ingresar un documento válido', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'credit-token')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(flaggedResponse))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      useCreditCheck({
        documentType: 'DNI',
        documentNumber: '28.456.789',
        debounceMs: 0,
      }),
    )

    await waitFor(() => expect(result.current.state.status).toBe('success'))
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'http://localhost:3000/api/credit-inquiries/verify?documentType=DNI&documentNumber=28.456.789',
    )
    expect(new Headers(request.headers).get('Authorization')).toBe(
      'Bearer credit-token',
    )
  })

  it('expone not-found y traduce errores API sin filtrar PII', async () => {
    const notFound: CreditCheckResponse = {
      ...flaggedResponse,
      found: false,
      clientId: null,
      isFlagged: false,
      lastRejection: null,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(notFound))
      .mockResolvedValueOnce(
        jsonResponse({ message: 'raw backend details' }, 403),
      )
    vi.stubGlobal('fetch', fetchMock)

    const first = renderHook(() =>
      useCreditCheck({
        documentType: 'DNI',
        documentNumber: '12345678',
        debounceMs: 0,
      }),
    )
    await waitFor(() => expect(first.result.current.state.status).toBe('not-found'))
    first.unmount()

    const second = renderHook(() =>
      useCreditCheck({
        documentType: 'DNI',
        documentNumber: '87654321',
        debounceMs: 0,
      }),
    )
    await waitFor(() => expect(second.result.current.state.status).toBe('error'))
    expect(second.result.current.state).toEqual({
      status: 'error',
      message: 'No tenés permiso para consultar antecedentes crediticios.',
    })
  })
})
