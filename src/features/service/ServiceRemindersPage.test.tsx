import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiceRemindersPage } from './ServiceRemindersPage'
import { reminderFixture } from './reminders.fixtures'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      role: { permissions: ['service.consultar'] },
      branchScope: { allBranches: false, branches: [{ id: 'branch-1', name: 'San Miguel' }] },
      branch: { id: 'branch-1', name: 'San Miguel' },
    },
  }),
}))
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

const pending = reminderFixture()
const noPhone = reminderFixture({
  unitId: 'unit-2',
  client: { id: 'client-2', name: 'Juan Gómez', phone: null },
  dueDate: '2026-10-04',
  daysToDue: -10,
})
const resolved = reminderFixture({
  unitId: 'unit-3',
  resolution: {
    status: 'CONTACTADO',
    channel: 'WHATSAPP',
    note: null,
    at: '2026-10-14T15:00:00.000Z',
    by: 'Rosa',
  },
})

function mockApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/service-reminders') && !init?.method)
      return jsonResponse({
        today: '2026-10-14',
        items: url.includes('status=RESOLVED') ? [resolved] : [pending, noPhone],
      })
    if (url.includes('/service-reminders')) return jsonResponse({ id: 'aviso-1', status: 'CONTACTADO', reopened: true })
    return jsonResponse([], 200)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

let openSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  openSpy = vi.fn()
  vi.stubGlobal('open', openSpy)
})
afterEach(() => vi.unstubAllGlobals())

describe('Avisos de service', () => {
  it('lista a quién contactar y abre el chat de WhatsApp con el mensaje', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi()
    vi.stubGlobal('open', openSpy)
    render(<ServiceRemindersPage />)

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('16/10/2026')
    expect(rows[1]).toHaveTextContent('En 2 días')
    expect(rows[1]).toHaveTextContent('1º service')
    expect(rows[1]).toHaveTextContent('ANA PÉREZ')
    expect(rows[1]).toHaveTextContent('11 5555-0000')
    expect(rows[1]).toHaveTextContent('Honda Wave 110 S (A123BCD)')
    expect(rows[2]).toHaveTextContent('Venció hace 10 días')
    expect(rows[2]).toHaveTextContent('El teléfono no parece un celular.')

    await user.click(screen.getByRole('button', { name: 'Escribir por WhatsApp a ANA PÉREZ' }))

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/5491155550000?text='),
      '_blank',
      'noopener',
    )
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      unitId: 'unit-1',
      stage: 'PRIMER_SERVICE',
      dueDate: '2026-10-16',
      status: 'CONTACTADO',
      channel: 'WHATSAPP',
    })
    expect(await screen.findAllByRole('row')).toHaveLength(2)
  })

  it('descarta un aviso y muestra los resueltos para volverlos a pendiente', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi()
    render(<ServiceRemindersPage />)
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Descartar el aviso de Juan Gómez' }))
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ unitId: 'unit-2', status: 'DESCARTADO' })

    await user.click(screen.getByRole('tab', { name: 'Contactados y descartados' }))
    expect(await screen.findByText('Contactado por WhatsApp')).toBeInTheDocument()
    expect(screen.getByText(/Rosa/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a pendiente' }))
    const remove = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')
    expect(String(remove?.[0])).toContain('unitId=unit-3&stage=PRIMER_SERVICE&dueDate=2026-10-16')
  })
})
