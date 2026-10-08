import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PendingTasksPanel } from './PendingTasksPanel'
import type { PendingTasks } from './types'

const sanMiguel: PendingTasks['branches'][number] = {
  branchId: 'sm',
  branchName: 'San Miguel',
  total: 12,
  tasks: [
    { key: 'INSTALLMENTS_OVERDUE', count: 9, amount: 1250000 },
    { key: 'INCOMES_PENDING_COLLECTION', count: 3, amount: null },
    { key: 'VEHICLE_PAYMENTS_UNCONFIRMED', count: 0, amount: null },
  ],
}
const delViso: PendingTasks['branches'][number] = {
  branchId: 'dv',
  branchName: 'Del Viso',
  total: 4,
  tasks: [
    { key: 'INSTALLMENTS_OVERDUE', count: 1, amount: 40000 },
    { key: 'INCOMES_PENDING_COLLECTION', count: 0, amount: null },
    { key: 'VEHICLE_PAYMENTS_UNCONFIRMED', count: 3, amount: null },
  ],
}

function show(tasks: PendingTasks | null, mode: 'own' | 'team') {
  return render(
    <MemoryRouter>
      <PendingTasksPanel tasks={tasks} mode={mode} />
    </MemoryRouter>,
  )
}

describe('Tareas pendientes del inicio', () => {
  it('le muestra a la administrativa sus tareas con acceso a cada pantalla', () => {
    show({ branches: [sanMiguel] }, 'own')

    expect(screen.getByText('Tus tareas pendientes')).toBeInTheDocument()
    expect(screen.getByText('San Miguel')).toBeInTheDocument()
    expect(screen.getByText('12 pendientes')).toBeInTheDocument()
    const items = within(
      screen.getByRole('list', { name: 'Tus tareas pendientes' }),
    ).getAllByRole('listitem')
    // Lo que está en cero no es tarea: no se lista.
    expect(items).toHaveLength(2)
    expect(within(items[0]!).getByText('Cuotas vencidas sin cobrar')).toBeInTheDocument()
    expect(within(items[0]!).getByText('9')).toBeInTheDocument()
    expect(within(items[0]!).getByRole('link', { name: 'Resolver' })).toHaveAttribute(
      'href',
      '/creditos/cobranza',
    )
    expect(within(items[1]!).getByRole('link', { name: 'Resolver' })).toHaveAttribute(
      'href',
      '/motos/ingresos',
    )
  })

  it('avisa cuando la administrativa está al día', () => {
    show(
      {
        branches: [
          {
            ...sanMiguel,
            total: 0,
            tasks: sanMiguel.tasks.map((task) => ({ ...task, count: 0 })),
          },
        ],
      },
      'own',
    )

    expect(screen.getByText('Al día')).toBeInTheDocument()
    expect(screen.getByText('No tenés tareas pendientes. Estás al día.')).toBeInTheDocument()
  })

  it('le muestra al administrador una tarjeta por tarea con el reparto por sucursal', () => {
    show({ branches: [delViso, sanMiguel] }, 'team')

    expect(screen.getByText('16 pendientes')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Pendientes por sucursal' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['4 Del Viso', '12 San Miguel'])
    const tiles = within(
      screen.getByRole('list', { name: 'Tareas pendientes de administración' }),
    ).getAllByRole('listitem')
    expect(tiles).toHaveLength(3)
    const overdue = within(tiles[0]!)
    expect(overdue.getByText('Cuotas vencidas sin cobrar')).toBeInTheDocument()
    expect(overdue.getByText('10')).toBeInTheDocument()
    expect(overdue.getByText(/1\.290\.000/)).toBeInTheDocument()
    expect(overdue.getAllByRole('definition').map((item) => item.textContent)).toEqual(['1', '9'])
    // Sin `links` las tarjetas no llevan a ninguna pantalla.
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('agrega el acceso a cada pantalla cuando se piden los enlaces', () => {
    render(
      <MemoryRouter>
        <PendingTasksPanel tasks={{ branches: [delViso, sanMiguel] }} mode="team" links />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Ver Cuotas vencidas sin cobrar' })).toHaveAttribute(
      'href',
      '/creditos/cobranza',
    )
  })

  it('no reparte por sucursal cuando hay una sola y lista aparte lo que está al día', () => {
    show({ branches: [sanMiguel] }, 'team')

    expect(screen.queryByRole('list', { name: 'Pendientes por sucursal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('definition')).not.toBeInTheDocument()
    expect(screen.getByText('Al día: Gastos de motos y autos sin pagar')).toBeInTheDocument()
  })

  it('avisa cuando ninguna sucursal tiene pendientes', () => {
    show(
      {
        branches: [
          { ...sanMiguel, total: 0, tasks: sanMiguel.tasks.map((task) => ({ ...task, count: 0 })) },
        ],
      },
      'team',
    )

    expect(
      screen.getByText('No hay tareas pendientes. La administración está al día.'),
    ).toBeInTheDocument()
  })

  it('no muestra nada sin permisos sobre esas tareas', () => {
    const { container } = show(null, 'team')
    expect(container).toBeEmptyDOMElement()
  })
})
