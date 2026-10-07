import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AdminDashboard, collectedPercent } from './AdminDashboard'
import type { AdminBranchSummary, AdminHome } from './types'

function branch(overrides: Partial<AdminBranchSummary> = {}): AdminBranchSummary {
  return {
    branchId: 'b1',
    branchName: 'San Miguel',
    monthlySales: {
      period: '2026-10',
      currentMonth: { units: 41, amount: 148_600_000 },
      previousMonth: { units: 36, amount: 120_000_000 },
    },
    collection: {
      agreedAmount: 148_600_000,
      collectedAmount: 121_300_000,
      pendingAmount: 27_300_000,
      pendingOperations: 9,
    },
    expensesThisMonth: { amount: 9_800_000, count: 31 },
    stockUnits: 58,
    creditPortfolio: { financedAmount: 36_400_000, overdueAmount: 2_100_000, overdueInstallments: 11 },
    pendingApprovals: 3,
    sellers: [{ sellerId: 's1', sellerName: 'Vendedor Uno', units: 12 }],
    topModels: [],
    ...overrides,
  }
}

function home(overrides: Partial<AdminHome> = {}): AdminHome {
  return {
    role: 'ADMINISTRADOR',
    greeting: { name: 'Juan Admin', organizationName: 'Luma', branchName: null, date: '2026-10-06' },
    monthlySales: {
      period: '2026-10',
      currentMonth: { units: 68, amount: 244_800_000 },
      previousMonth: { units: 66, amount: 230_000_000 },
    },
    newClientsThisWeek: 5,
    stockUnitsTotal: 92,
    creditPortfolio: null,
    pendingPurchases: null,
    salesByBranch: [],
    topModels: [],
    pendingTasks: {
      branches: [
        {
          branchId: 'b1',
          branchName: 'San Miguel',
          total: 6,
          tasks: [{ key: 'LICENSING_OVERDUE', count: 6, amount: null }],
        },
        {
          branchId: 'b2',
          branchName: 'Del Viso',
          total: 2,
          tasks: [{ key: 'LICENSING_OVERDUE', count: 2, amount: null }],
        },
      ],
    },
    branches: [
      branch(),
      branch({
        branchId: 'b2',
        branchName: 'Del Viso',
        sellers: [{ sellerId: 's2', sellerName: 'Vendedor Dos', units: 10 }],
      }),
    ],
    ...overrides,
  }
}

function renderHome(value: AdminHome) {
  return render(
    <MemoryRouter>
      <AdminDashboard home={value} />
    </MemoryRouter>,
  )
}

describe('Inicio del administrador por sucursal', () => {
  it('compara las sucursales en la vista consolidada', () => {
    renderHome(home())

    const tabs = screen.getByRole('navigation', { name: 'Sucursal' })
    expect(within(tabs).getByRole('button', { name: 'Todas las sucursales' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('VENTAS DEL MES · TODAS LAS SUCURSALES')).toBeInTheDocument()
    // Una tarjeta por sucursal, con su cobranza.
    expect(screen.getAllByRole('button', { name: 'Ver sucursal' })).toHaveLength(2)
    expect(screen.getAllByRole('img', { name: 'Cobrado 82% de lo vendido en el mes' })).toHaveLength(2)
    // Las tareas pendientes, en tarjetas con el reparto por sucursal.
    expect(screen.getByText('Tareas pendientes de administración')).toBeInTheDocument()
    expect(screen.getByText('8 pendientes')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Pendientes por sucursal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver Patentes vencidas sin cargar' })).toHaveAttribute(
      'href',
      '/motos/operaciones?patente=DEMORADAS',
    )
    expect(screen.getByText('Vendedores · Del Viso')).toBeInTheDocument()
    expect(screen.getByText('Vendedor Dos')).toBeInTheDocument()
  })

  it('muestra una sola sucursal al elegirla y vuelve a la consolidada', async () => {
    const user = userEvent.setup()
    renderHome(home())

    await user.click(screen.getByRole('button', { name: 'Del Viso' }))

    expect(screen.getByText('VENTAS DEL MES · DEL VISO')).toBeInTheDocument()
    expect(screen.queryByText('VENTAS DEL MES · TODAS LAS SUCURSALES')).not.toBeInTheDocument()
    expect(screen.getByText('Falta cobrar')).toBeInTheDocument()
    expect(screen.getByText('9 ventas con saldo')).toBeInTheDocument()
    expect(screen.getByText('Gastos del mes')).toBeInTheDocument()
    expect(screen.getByText('Esperan aprobación')).toBeInTheDocument()
    expect(screen.getByText('Vendedor Dos')).toBeInTheDocument()
    expect(screen.queryByText('Vendedor Uno')).not.toBeInTheDocument()
    // 148,6 de 244,8 millones.
    expect(screen.getByText('61%')).toBeInTheDocument()
    // Las tareas pendientes quedan sólo con la sucursal elegida.
    expect(screen.getByText('2 pendientes')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Pendientes por sucursal' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Todas las sucursales' }))
    expect(screen.getByText('VENTAS DEL MES · TODAS LAS SUCURSALES')).toBeInTheDocument()
  })

  it('abre la sucursal desde su tarjeta', async () => {
    const user = userEvent.setup()
    renderHome(home())

    await user.click(screen.getAllByRole('button', { name: 'Ver sucursal' })[0]!)

    expect(screen.getByText('VENTAS DEL MES · SAN MIGUEL')).toBeInTheDocument()
  })

  it('oculta lo que el rol no puede ver en una sucursal', async () => {
    const user = userEvent.setup()
    renderHome(
      home({
        branches: [
          branch({
            collection: null,
            expensesThisMonth: null,
            pendingApprovals: null,
            sellers: null,
          }),
        ],
      }),
    )

    await user.click(screen.getByRole('button', { name: 'San Miguel' }))

    expect(screen.queryByText('Falta cobrar')).not.toBeInTheDocument()
    expect(screen.queryByText('Gastos del mes')).not.toBeInTheDocument()
    expect(screen.queryByText('Vendedores')).not.toBeInTheDocument()
    expect(screen.getByText('Stock disponible')).toBeInTheDocument()
  })

  it('sigue mostrando la vista de antes si el backend no manda sucursales', () => {
    const { branches: _branches, ...withoutBranches } = home({
      salesByBranch: [{ branchId: 'b1', branchName: 'San Miguel', units: 41, amount: 148_600_000 }],
    })
    renderHome(withoutBranches)

    expect(screen.queryByRole('navigation', { name: 'Sucursal' })).not.toBeInTheDocument()
    expect(screen.getByText('Ventas por sucursal')).toBeInTheDocument()
  })

  it('calcula el porcentaje cobrado sin pasarse de 0 a 100', () => {
    const collection = { agreedAmount: 100, collectedAmount: 82, pendingAmount: 18, pendingOperations: 1 }
    expect(collectedPercent(collection)).toBe(82)
    expect(collectedPercent({ ...collection, agreedAmount: 0 })).toBe(0)
    expect(collectedPercent({ ...collection, collectedAmount: 130 })).toBe(100)
  })
})
