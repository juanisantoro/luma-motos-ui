import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ClientList } from './ClientList'
import type { Client } from './types'

function client(overrides: Partial<Client>): Client {
  return {
    id: 'client-1',
    fullName: 'Ana Cliente',
    documentType: 'DNI',
    documentNumber: '30111222',
    phone: null,
    email: null,
    address: null,
    notes: null,
    active: true,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    organization: { id: 'org-1', name: 'Luma', code: 'LUMA' },
    ...overrides,
  } as Client
}

describe('acciones de la lista de clientes', () => {
  it('no ofrece desactivar a un cliente activo', () => {
    render(
      <ClientList
        busyClientId={null}
        canManage
        clients={[client({})]}
        onEdit={vi.fn()}
        onToggleStatus={vi.fn()}
      />,
    )

    expect(
      screen.getAllByRole('button', { name: 'Editar a Ana Cliente' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole('button', { name: /Desactivar/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Activar/ }),
    ).not.toBeInTheDocument()
  })

  it('permite reactivar a un cliente que quedó inactivo', () => {
    render(
      <ClientList
        busyClientId={null}
        canManage
        clients={[client({ active: false })]}
        onEdit={vi.fn()}
        onToggleStatus={vi.fn()}
      />,
    )

    expect(
      screen.getAllByRole('button', { name: 'Activar a Ana Cliente' }).length,
    ).toBeGreaterThan(0)
  })
})
