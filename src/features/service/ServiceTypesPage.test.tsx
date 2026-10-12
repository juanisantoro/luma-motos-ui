import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  listServiceTypes: vi.fn(),
  createServiceType: vi.fn(),
  updateServiceType: vi.fn(),
}))
vi.mock('./api', () => api)
vi.mock('../../shared/alerts', () => ({ alertSuccess: vi.fn(() => Promise.resolve()) }))

const { ServiceTypesPage } = await import('./ServiceTypesPage')

beforeEach(() => {
  vi.clearAllMocks()
  api.listServiceTypes.mockResolvedValue([
    { id: 't1', name: '1º service', order: 1, tasks: ['Cambio de aceite de motor', 'Revisión de bujía'], suggestedPrice: null, currency: 'ARS', active: true },
  ])
  api.updateServiceType.mockResolvedValue({})
})

describe('Tipos de service', () => {
  it('edita las tareas (una por renglón) y el precio sugerido', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ServiceTypesPage /></MemoryRouter>)

    const card = await screen.findByRole('region', { name: '1º service' })
    expect(within(card).getByText('Sin precio')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Editar' }))

    const dialog = screen.getByRole('dialog')
    const tasks = within(dialog).getByLabelText(/^Tareas/)
    await user.clear(tasks)
    await user.type(tasks, 'Cambio de aceite de motor{enter}{enter}  Ajuste de cadena  ')
    await user.type(within(dialog).getByLabelText(/^Precio sugerido/), '45000')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(api.updateServiceType).toHaveBeenCalledTimes(1))
    expect(api.updateServiceType).toHaveBeenCalledWith('t1', {
      name: '1º service',
      order: 1,
      tasks: ['Cambio de aceite de motor', 'Ajuste de cadena'],
      suggestedPrice: '45000.00',
      active: true,
    })
    // Recarga la lista después de guardar.
    await waitFor(() => expect(api.listServiceTypes).toHaveBeenCalledTimes(2))
  })

  it('un tipo nuevo arranca con las tareas de la planilla', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ServiceTypesPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: 'Nuevo tipo' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText(/^Tareas \* \(una por renglón · 15\)/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Orden en la lista/)).toHaveValue(2)
  })
})
