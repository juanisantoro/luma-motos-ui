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

  it('discrimina las tareas por sucursal para el administrador', () => {
    show({ branches: [delViso, sanMiguel] }, 'team')

    expect(screen.getByText('16 pendientes')).toBeInTheDocument()
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Tarea', 'Del Viso', 'San Miguel', 'Total'])
    const overdue = screen.getByRole('row', { name: /Cuotas vencidas sin cobrar/ })
    expect(within(overdue).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      expect.stringMatching(/^1\$/),
      expect.stringMatching(/^9\$/),
      '10',
    ])
    const totals = screen.getByRole('row', { name: /Total de pendientes/ })
    expect(within(totals).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '4',
      '12',
      '16',
    ])
  })

  it('no agrega la columna Total cuando el gerente tiene una sola sucursal', () => {
    show({ branches: [sanMiguel] }, 'team')

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Tarea', 'San Miguel'])
  })

  it('no muestra nada sin permisos sobre esas tareas', () => {
    const { container } = show(null, 'team')
    expect(container).toBeEmptyDOMElement()
  })
})
