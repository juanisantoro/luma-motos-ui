import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AdministrativeDashboard } from './AdministrativeDashboard'
import type { AdministrativeHome } from './types'

function home(overrides: Partial<AdministrativeHome> = {}): AdministrativeHome {
  return {
    role: 'ADMINISTRATIVA',
    greeting: {
      name: 'Ana Administrativa',
      organizationName: 'Luma',
      branchName: 'San Miguel',
      date: '2026-09-30',
    },
    dueTodayAlert: null,
    dueThisWeek: null,
    unconfirmedVehiclePayments: null,
    payableExpensesThisWeek: null,
    collectionsToday: null,
    recentInquiries: null,
    managementAlerts: null,
    licensingAlerts: null,
    topModels: null,
    ...overrides,
  }
}

describe('Inicio de la administrativa (fase 5)', () => {
  it('muestra los contadores de patentes con acceso a la grilla filtrada', () => {
    render(
      <MemoryRouter>
        <AdministrativeDashboard
          home={home({ licensingAlerts: { overdue: 3, receivedPendingCollection: 1 } })}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Patentes vencidas sin cargar')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(
      screen.getByText('Patentes recibidas con pago pendiente'),
    ).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: 'Ver operaciones' })
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/motos/operaciones?patente=DEMORADAS',
      '/motos/operaciones?patente=COBRO_PENDIENTE',
    ])
  })

  it('no muestra comisiones ni los contadores sin permiso', () => {
    render(
      <MemoryRouter>
        <AdministrativeDashboard home={home()} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/Patentes vencidas/)).not.toBeInTheDocument()
    expect(screen.queryByText(/[Cc]omisiones/)).not.toBeInTheDocument()
  })
})
