import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientsPage } from './ClientsPage'
import type { Client } from './types'

const apiMocks = vi.hoisted(() => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  updateClientStatus: vi.fn(),
}))
vi.mock('./api', () => apiMocks)

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { role: { permissions: ['clientes.gestionar'] } } }),
}))

const excel = vi.hoisted(() => ({ download: vi.fn(() => Promise.resolve()) }))
vi.mock('../../shared/export/excel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/export/excel')>()),
  downloadExcel: excel.download,
}))

const client: Client = {
  id: 'client',
  fullName: 'Ana Cliente',
  documentType: 'DNI',
  documentNumber: '30111222',
  phone: '1155554444',
  email: 'ana@example.com',
  address: null,
  notes: null,
  active: false,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  organization: { id: 'org-1', code: 'LUMA', name: 'Luma', type: 'CASA_CENTRAL' },
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.listClients.mockImplementation(
    ({ page = 1, limit = 20 }: { page?: number; limit?: number }) =>
      Promise.resolve({
        items: Array.from({ length: page === 1 ? limit : 12 }, (_, index) => ({
          ...client,
          id: `client-${page}-${index}`,
        })),
        total: limit + 12,
        page,
        limit,
      }),
  )
})

describe('ClientsPage', () => {
  it('exporta a Excel todos los clientes de la búsqueda aplicada', async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await screen.findAllByText('Ana Cliente')

    await user.type(screen.getByPlaceholderText('Buscar por nombre, documento o email'), 'Ana')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'inactive')
    await waitFor(() =>
      expect(apiMocks.listClients).toHaveBeenLastCalledWith(
        { page: 1, limit: 20, search: 'Ana', active: false },
        expect.any(AbortSignal),
      ),
    )

    const button = screen.getByRole('button', { name: 'Exportar a Excel' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)

    await waitFor(() => expect(excel.download).toHaveBeenCalledTimes(1))
    expect(apiMocks.listClients).toHaveBeenCalledWith({
      page: 2,
      limit: 100,
      search: 'Ana',
      active: false,
    })
    const [options] = excel.download.mock.calls[0] as unknown as [
      { title: string; filters: unknown[]; rows: unknown[]; total: number; columns: Array<{ header: string }> },
    ]
    expect(options.title).toBe('Clientes')
    expect(options.rows).toHaveLength(112)
    expect(options.total).toBe(112)
    expect(options.filters).toEqual(['Buscar: Ana', 'Estado: Inactivos'])
    expect(options.columns.map((column) => column.header)).toEqual([
      'Cliente',
      'Tipo de documento',
      'Documento',
      'Email',
      'Teléfono',
      'Organización',
      'Estado',
      'Actualizado',
    ])
  })
})
