import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceOrder } from './types'

const api = vi.hoisted(() => ({
  getServiceOrder: vi.fn(),
  listServiceTypes: vi.fn(),
  saveServiceWork: vi.fn(),
  finishServiceOrder: vi.fn(),
  reopenServiceOrder: vi.fn(),
  cancelServiceOrder: vi.fn(),
  deliverServiceOrder: vi.fn(),
  createServiceOrder: vi.fn(),
  updateServiceOrder: vi.fn(),
  lookupServiceVehicle: vi.fn(),
}))
const auth = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('./api', () => api)
vi.mock('../../shared/alerts', () => ({
  alertSuccess: vi.fn(() => Promise.resolve()),
  alertError: vi.fn(() => Promise.resolve()),
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      globalAccess: false,
      role: { code: 'X', permissions: auth.permissions },
      branch: { id: 'sm', code: 'SM', name: 'San Miguel' },
      branchScope: { allBranches: false, branches: [{ id: 'sm', code: 'SM', name: 'San Miguel' }] },
    },
  }),
}))
vi.mock('../finance/api', () => ({
  listAllCashAccounts: () =>
    Promise.resolve([
      {
        id: 'caja-juan',
        code: 'SOCIO-JUAN-SM',
        name: 'Caja Juan Capdevila SM',
        type: 'SOCIO',
        branchId: 'sm',
        responsiblePersonnelId: 'p-juan',
        currency: 'ARS',
        active: true,
        balance: '0',
      },
    ]),
  listInventoryBranches: () => Promise.resolve([]),
}))
vi.mock('../sales/tracking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sales/tracking')>()),
  listHandoverRecipients: () =>
    Promise.resolve([{ id: 'p-juan', fullName: 'Juan Capdevila', isCurrentUser: false, pendingCount: 0, pendingAmount: '0' }]),
}))

const { ServiceOrderPage } = await import('./ServiceOrderPage')

function order(overrides: Partial<ServiceOrder> = {}): ServiceOrder {
  return {
    id: 'order-1',
    number: 8,
    status: 'RECIBIDA',
    version: 2,
    branch: { id: 'sm', code: 'SM', name: 'San Miguel' },
    receptionDate: '2026-10-12',
    client: { id: null, name: 'Marta Gómez', phone: '11 5555-0000', email: null, document: null, address: null, locality: null },
    vehicle: { unitId: null, plate: 'A123BCD', chassis: null, engine: null, model: 'Gilera Smash 110', year: null },
    currentKm: 4100,
    nextServiceKm: null,
    serviceType: { id: 'type-2', name: '2º service' },
    receptionNotes: 'Hace ruido la cadena',
    tasks: [
      { description: 'Cambio de aceite de motor', done: null, notes: null },
      { description: 'Revisión de bujía', done: null, notes: null },
    ],
    oil: { type: null, viscosity: null, liters: null, filter: null },
    parts: [],
    diagnosis: null,
    signedBy: null,
    signedAt: null,
    delivery: null,
    cancellation: null,
    receivedBy: { id: 'p-rosa', fullName: 'Rosa Vargas' },
    createdAt: '2026-10-12T15:00:00.000Z',
    updatedAt: '2026-10-12T15:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/service/order-1']}>
      <Routes>
        <Route path="/service/:id" element={<ServiceOrderPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listServiceTypes.mockResolvedValue([
    { id: 'type-2', name: '2º service', order: 2, tasks: [], suggestedPrice: '45000', currency: 'ARS', active: true },
  ])
})

describe('Orden de service', () => {
  it('el mecánico no puede firmar hasta marcar todas las tareas', async () => {
    auth.permissions = ['service.consultar', 'service.trabajar']
    api.getServiceOrder.mockResolvedValue(order())
    api.finishServiceOrder.mockResolvedValue(
      order({ status: 'TERMINADA', signedBy: { id: 'p-mec', fullName: 'Pedro Mecánico' }, signedAt: '2026-10-12T17:00:00.000Z' }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: 'Tareas / mantenimiento' })
    expect(screen.queryByRole('button', { name: 'Cobrar y entregar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Corregir recepción' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Terminar y firmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Marcá Sí o No en todas las tareas antes de firmar (faltan 2).')
    expect(api.finishServiceOrder).not.toHaveBeenCalled()

    await user.click(within(screen.getByRole('group', { name: 'Realizado: Cambio de aceite de motor' })).getByRole('button', { name: 'Sí' }))
    await user.click(within(screen.getByRole('group', { name: 'Realizado: Revisión de bujía' })).getByRole('button', { name: 'No' }))
    await user.type(screen.getByLabelText('Observación: Revisión de bujía'), 'En buen estado')
    await user.type(screen.getByLabelText('Viscosidad'), '10W40')
    await user.click(screen.getByRole('button', { name: 'Terminar y firmar' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Firmar$/ }))

    await waitFor(() => expect(api.finishServiceOrder).toHaveBeenCalledTimes(1))
    expect(api.finishServiceOrder).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        expectedVersion: 2,
        tasks: [
          { description: 'Cambio de aceite de motor', done: true, notes: null },
          { description: 'Revisión de bujía', done: false, notes: 'En buen estado' },
        ],
        oil: { type: null, viscosity: '10W40', liters: null, filter: null },
      }),
    )
    expect(await screen.findByText('Pedro Mecánico')).toBeInTheDocument()
    // Firmada, el mecánico ya no puede tocarla.
    expect(screen.queryByRole('button', { name: 'Terminar y firmar' })).not.toBeInTheDocument()
  })

  it('el mecánico marca las que faltan en Sí de una vez y abre la nota con el globito', async () => {
    auth.permissions = ['service.consultar', 'service.trabajar']
    api.getServiceOrder.mockResolvedValue(order())
    api.saveServiceWork.mockResolvedValue(order({ status: 'EN_TALLER', version: 3 }))
    const user = userEvent.setup()
    renderPage()

    // Los datos del cliente quedan plegados; la moto y los km se ven arriba.
    expect(await screen.findByText(/A123BCD · Gilera Smash 110 · 4\.100 km/)).toBeInTheDocument()
    expect(screen.getByText('Datos del cliente y de la moto')).toBeInTheDocument()
    expect(screen.getByText('Faltan marcar 2')).toBeInTheDocument()
    // Sin marcar, la observación no ocupa lugar hasta pedirla.
    expect(screen.queryByLabelText('Observación: Cambio de aceite de motor')).not.toBeInTheDocument()

    await user.click(within(screen.getByRole('group', { name: 'Realizado: Revisión de bujía' })).getByRole('button', { name: 'No' }))
    await user.click(screen.getByRole('button', { name: 'Marcar las que faltan en Sí' }))
    expect(screen.queryByRole('button', { name: 'Marcar las que faltan en Sí' })).not.toBeInTheDocument()
    expect(screen.getByText('Todas las tareas marcadas')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Agregar observación: Cambio de aceite de motor' }))
    await user.type(screen.getByLabelText('Observación: Cambio de aceite de motor'), 'Motul')
    await user.click(screen.getByRole('button', { name: 'Guardar avance' }))

    await waitFor(() => expect(api.saveServiceWork).toHaveBeenCalledTimes(1))
    expect(api.saveServiceWork.mock.calls[0]?.[1]).toMatchObject({
      tasks: [
        { description: 'Cambio de aceite de motor', done: true, notes: 'Motul' },
        { description: 'Revisión de bujía', done: false, notes: null },
      ],
    })
  })

  it('la administrativa avisa por WhatsApp y entrega sin cobro una garantía', async () => {
    auth.permissions = ['service.consultar', 'service.gestionar', 'service.cobrar']
    const finished = order({
      status: 'TERMINADA',
      version: 4,
      tasks: [{ description: 'Cambio de aceite de motor', done: true, notes: null }],
      signedBy: { id: 'p-mec', fullName: 'Pedro Mecánico' },
      signedAt: '2026-10-12T17:00:00.000Z',
    })
    api.getServiceOrder.mockResolvedValue(finished)
    api.deliverServiceOrder.mockResolvedValue(
      order({ ...finished, status: 'ENTREGADA', delivery: { at: '2026-10-12T18:00:00.000Z', by: null, vehicleCondition: 'OPTIMO', notes: null, amount: '0.00', incomeId: null } }),
    )
    const user = userEvent.setup()
    renderPage()

    const whatsapp = await screen.findByRole('link', { name: 'Avisar por WhatsApp' })
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5491155550000\?text=/)
    // No puede editar el trabajo del mecánico.
    expect(within(screen.getByRole('group', { name: 'Realizado: Cambio de aceite de motor' })).getByRole('button', { name: 'Sí' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Cobrar y entregar' }))
    const dialog = screen.getByRole('dialog')
    // Propone el precio del tipo de service.
    expect(within(dialog).getByLabelText(/^Importe a cobrar/)).toHaveValue(45000)
    await user.clear(within(dialog).getByLabelText(/^Importe a cobrar/))
    await user.type(within(dialog).getByLabelText(/^Importe a cobrar/), '0')
    expect(within(dialog).queryByLabelText('Caja *')).not.toBeInTheDocument()
    await user.click(within(dialog).getByLabelText('Óptimo'))
    await user.click(within(dialog).getByRole('button', { name: 'Entregar sin cobro' }))

    await waitFor(() => expect(api.deliverServiceOrder).toHaveBeenCalledTimes(1))
    const [, input] = api.deliverServiceOrder.mock.calls[0] as [string, Record<string, unknown>]
    expect(input).toMatchObject({ expectedVersion: 4, amount: '0.00', vehicleCondition: 'OPTIMO' })
    expect(input).not.toHaveProperty('accountId')
    expect(await screen.findByRole('heading', { name: 'Entrega del vehículo' })).toBeInTheDocument()
  })

  it('cobra en efectivo con la caja de la sucursal y a quién se rinde', async () => {
    auth.permissions = ['service.consultar', 'service.cobrar']
    const finished = order({
      status: 'TERMINADA',
      version: 4,
      signedBy: { id: 'p-mec', fullName: 'Pedro Mecánico' },
      signedAt: '2026-10-12T17:00:00.000Z',
    })
    api.getServiceOrder.mockResolvedValue(finished)
    api.deliverServiceOrder.mockResolvedValue({ ...finished, status: 'ENTREGADA' })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Cobrar y entregar' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByLabelText('Caja *')).toHaveValue('caja-juan'))
    await waitFor(() => expect(within(dialog).getByLabelText('Se rinde a *')).toHaveValue('p-juan'))
    await user.click(within(dialog).getByRole('button', { name: 'Cobrar y entregar' }))

    await waitFor(() => expect(api.deliverServiceOrder).toHaveBeenCalledTimes(1))
    expect(api.deliverServiceOrder.mock.calls[0]?.[1]).toMatchObject({
      amount: '45000.00',
      accountId: 'caja-juan',
      paymentMethod: 'EFECTIVO',
      handoverToId: 'p-juan',
      vehicleCondition: 'BUENO',
    })
  })
})
