import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invalidateWorkMonths } from '../../shared/work-months/workMonths'
import { sampleBalance } from './balance.fixture'
import { BalancePage, formatBalanceMoney } from './BalancePage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const months = {
  current: '2026-10',
  months: [
    { period: '2026-10', from: '2026-09-28', to: '2026-10-27', cutDate: '2026-10-27', cutMin: '2026-10-15', cutMax: '2026-11-14', current: true, locked: false },
    { period: '2026-09', from: '2026-09-01', to: '2026-09-27', cutDate: '2026-09-27', cutMin: '2026-09-15', cutMax: '2026-10-14', current: false, locked: false },
  ],
}

function mockApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/work-months')) return jsonResponse(months)
    if (url.includes('/balance?')) {
      const query = new URL(url, 'http://x').searchParams
      return jsonResponse({
        ...sampleBalance,
        period: query.get('period'),
        currency: query.get('currency'),
      })
    }
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const money = (value: number) => formatBalanceMoney(value, 'ARS')

afterEach(() => {
  invalidateWorkMonths()
  vi.unstubAllGlobals()
})

describe('Balance del mes', () => {
  it('muestra el resultado del corte en curso por sucursal', async () => {
    const fetchMock = mockApi()
    render(<BalancePage />)

    const table = await screen.findByRole('table', { name: 'Balance por sucursal' })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/balance?period=2026-10&currency=ARS'))).toBe(true)
    const result = within(table).getByRole('row', { name: /Resultado del mes/ })
    expect(within(result).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      money(940000),
      money(-1410000),
      money(-145000),
      money(-615000),
    ])
    expect(screen.getByText(/1 unidad vendida en este corte no tiene costo cargado|Una unidad vendida/)).toBeInTheDocument()
    expect(screen.getByText(/Corte del 27\/10/)).toBeInTheDocument()
  })

  it('cambia a la vista por socio y a otro corte', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi()
    render(<BalancePage />)
    await screen.findByRole('table', { name: 'Balance por sucursal' })

    await user.click(screen.getByRole('button', { name: 'Socio' }))
    const table = screen.getByRole('table', { name: 'Balance por socio' })
    expect(within(table).getByRole('columnheader', { name: 'Juan Capdevila' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Motos y autos comprados' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Corte'), '2026-09')
    await screen.findByRole('table', { name: 'Balance por socio' })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('period=2026-09'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Dólares' }))
    await screen.findByRole('table', { name: 'Balance por socio' })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('currency=USD'))).toBe(true)
  })

  it('deja afuera las unidades y filtra por sucursal', async () => {
    const user = userEvent.setup()
    mockApi()
    render(<BalancePage />)
    await screen.findByRole('table', { name: 'Balance por sucursal' })

    await user.click(screen.getByRole('button', { name: 'Dejar afuera' }))
    await user.selectOptions(screen.getByLabelText('Sucursal'), 'sm')
    const table = screen.getByRole('table', { name: 'Balance por sucursal' })
    const result = within(table).getByRole('row', { name: /Ingresos menos egresos/ })
    expect(within(result).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([money(590000), money(590000)])
    expect(within(table).queryByRole('row', { name: /costaron/ })).not.toBeInTheDocument()
  })

  it('avisa si no pudo cargar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/work-months')
          ? jsonResponse(months)
          : jsonResponse({ message: 'Forbidden resource' }, 403),
      ),
    )
    render(<BalancePage />)
    expect(await screen.findByText('No pudimos cargar el balance')).toBeInTheDocument()
  })
})
