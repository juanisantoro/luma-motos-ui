import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invalidateWorkMonths } from '../../shared/work-months/workMonths'
import { argentinaToday, WorkMonthsPage, workMonthName } from './WorkMonthsPage'

vi.mock('../../shared/alerts', () => ({
  alertSuccess: vi.fn(() => Promise.resolve()),
  alertError: vi.fn(() => Promise.resolve()),
}))

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const months = {
  current: '2026-10',
  months: [
    { period: '2026-11', from: '2026-10-28', to: '2026-11-30', cutDate: null, cutMin: '2026-11-15', cutMax: '2026-12-14', current: false, locked: false },
    { period: '2026-10', from: '2026-09-28', to: '2026-10-27', cutDate: '2026-10-27', cutMin: '2026-10-15', cutMax: '2026-11-14', current: true, locked: false },
    { period: '2026-09', from: '2026-09-01', to: '2026-09-27', cutDate: '2026-09-27', cutMin: '2026-09-15', cutMax: '2026-10-14', current: false, locked: true },
  ],
}

function mockApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/work-months') && !init?.method) return jsonResponse(months)
    if (url.includes('/work-months/') && init?.method === 'PUT')
      return jsonResponse({ ...months.months[1], cutDate: '2026-10-25', to: '2026-10-25' })
    if (url.includes('/work-months/') && init?.method === 'DELETE') return jsonResponse(months.months[1])
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  invalidateWorkMonths()
  vi.unstubAllGlobals()
})

describe('Meses de trabajo', () => {
  it('lista los meses con sus fechas y marca el que tiene comisiones liquidadas', async () => {
    mockApi()
    render(<WorkMonthsPage />)

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(within(rows[2]!).getByText('Octubre de 2026')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('En curso')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('28/09/2026')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Fin de mes')).toBeInTheDocument()
    expect(within(rows[3]!).getByText('Con comisiones liquidadas')).toBeInTheDocument()
    expect(within(rows[3]!).getByRole('button', { name: 'Cambiar corte de Septiembre de 2026' })).toBeDisabled()
  })

  it('cambia el corte de un mes dentro de su rango', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<WorkMonthsPage />)

    await user.click(await screen.findByRole('button', { name: 'Cambiar corte de Octubre de 2026' }))
    const input = screen.getByLabelText('Corte de Octubre de 2026')
    expect(input).toHaveAttribute('min', '2026-10-15')
    expect(input).toHaveAttribute('max', '2026-11-14')
    await user.clear(input)
    await user.type(input, '2026-10-25')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
      expect(String(call?.[0])).toContain('/work-months/2026-10')
      expect(call?.[1]?.body).toBe(JSON.stringify({ cutDate: '2026-10-25' }))
    })
  })

  it('quita un corte', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<WorkMonthsPage />)

    await user.click(await screen.findByRole('button', { name: 'Quitar corte de Octubre de 2026' }))

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true),
    )
  })

  it('nombra los meses y calcula hoy en Argentina', () => {
    expect(workMonthName('2026-10')).toBe('Octubre de 2026')
    expect(argentinaToday(new Date('2026-10-28T02:30:00Z'))).toBe('2026-10-27')
  })
})
