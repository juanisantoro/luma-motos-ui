import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { ServiceOrder } from '../service/types'
import { MechanicDashboard } from './MechanicDashboard'
import type { MechanicHome } from './types'

const greeting = { name: 'Pedro Mecánico', organizationName: 'Luma', branchName: 'San Miguel', date: '2026-10-12' }

function order(overrides: Partial<ServiceOrder>): ServiceOrder {
  return {
    id: 'order-1',
    number: 12,
    status: 'RECIBIDA',
    version: 0,
    branch: { id: 'sm', code: 'SM', name: 'San Miguel' },
    receptionDate: '2026-10-12',
    client: { id: null, name: 'Marta', phone: null, email: null, document: null, address: null, locality: null },
    vehicle: { unitId: null, plate: 'AB123CD', chassis: null, engine: null, model: 'Gilera Smash', year: null },
    currentKm: 4100,
    nextServiceKm: null,
    serviceType: { id: 't', name: '2º service' },
    receptionNotes: 'Ruido en la cadena',
    tasks: [],
    oil: { type: null, viscosity: null, liters: null, filter: null },
    parts: [],
    diagnosis: null,
    signedBy: null,
    signedAt: null,
    delivery: null,
    cancellation: null,
    receivedBy: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function show(workshop: MechanicHome['workshop']) {
  render(
    <MemoryRouter>
      <MechanicDashboard home={{ role: 'MECANICO', greeting, workshop }} />
    </MemoryRouter>,
  )
}

describe('Inicio del mecánico', () => {
  it('muestra cuántas motos esperan y la lista para hacer', () => {
    show({
      waiting: 1,
      inProgress: 1,
      finishedToday: 2,
      orders: [order({ id: 'a', number: 11, status: 'EN_TALLER' }), order({ id: 'b', number: 12 })],
    })

    expect(screen.getByText('Motos esperando service').closest('article')).toHaveTextContent('1')
    expect(screen.getByText('Terminadas hoy').closest('article')).toHaveTextContent('2')
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]!).getByRole('link', { name: 'Seguir' })).toHaveAttribute('href', '/service/a')
    expect(within(rows[1]!).getByRole('link', { name: 'Empezar' })).toHaveAttribute('href', '/service/b')
    expect(within(rows[1]!).getByText('Ruido en la cadena')).toBeInTheDocument()
  })

  it('avisa cuando no hay motos para hacer', () => {
    show({ waiting: 0, inProgress: 0, finishedToday: 0, orders: [] })
    expect(screen.getByText(/No hay motos esperando service/)).toBeInTheDocument()
  })
})
