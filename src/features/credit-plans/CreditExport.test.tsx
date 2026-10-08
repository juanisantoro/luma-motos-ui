import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreditInstallmentsPage } from './CreditInstallmentsPage'
import { CreditPlansPage } from './CreditPlansPage'
import type { CreditInstallment, CreditPlan } from './types'

const apiMocks = vi.hoisted(() => ({
  listCreditPlans: vi.fn(),
  listCreditInstallments: vi.fn(),
  createCreditPlan: vi.fn(),
  updateCreditPlan: vi.fn(),
  payCreditInstallment: vi.fn(),
}))
vi.mock('./api', () => apiMocks)

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { role: { permissions: ['creditos.gestionar', 'creditos.cobrar'] } },
  }),
}))

const excel = vi.hoisted(() => ({ download: vi.fn(() => Promise.resolve()) }))
vi.mock('../../shared/export/excel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/export/excel')>()),
  downloadExcel: excel.download,
}))

const plan: CreditPlan = {
  id: 'plan-1',
  name: '12 cuotas',
  calculationMethod: 'FRANCES',
  installmentCount: 12,
  interestRate: 5,
  minimumAmount: 100000,
  maximumAmount: null,
  active: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const installment: CreditInstallment = {
  id: 'installment-1',
  operationCreditId: 'credit-1',
  operationId: 'operation-1',
  operationNumber: '1048',
  clientName: 'Ana Pérez',
  number: 4,
  amount: 60000,
  dueDate: '2026-10-10',
  status: 'PARCIAL',
  paidAmount: 25000.5,
  paidAt: '2026-10-05',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

// Dos páginas: la primera llena y la segunda con el resto.
function pages<T extends { id: string }>(row: T, rest: number) {
  return ({ page, limit }: { page: number; limit: number }) =>
    Promise.resolve({
      items: Array.from({ length: page === 1 ? limit : rest }, (_, index) => ({
        ...row,
        id: `${row.id}-${page}-${index}`,
      })),
      total: limit + rest,
      page,
      limit,
    })
}

type ExportOptions = {
  title: string
  filters: unknown[]
  rows: unknown[]
  total: number
  columns: Array<{ header: string; value: (row: unknown) => unknown }>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Exportar a Excel en créditos', () => {
  it('planes de crédito: exporta todas las páginas con el filtro de activos', async () => {
    apiMocks.listCreditPlans.mockImplementation(pages(plan, 3))
    const user = userEvent.setup()
    render(<CreditPlansPage />)

    const button = await screen.findByRole('button', { name: 'Exportar a Excel' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)

    await waitFor(() => expect(excel.download).toHaveBeenCalledTimes(1))
    expect(apiMocks.listCreditPlans).toHaveBeenCalledWith({ page: 2, limit: 100, active: true })
    const [options] = excel.download.mock.calls[0] as unknown as [ExportOptions]
    expect(options.title).toBe('Planes de crédito')
    expect(options.rows).toHaveLength(103)
    expect(options.total).toBe(103)
    expect(options.filters).toEqual(['Estado: Activos'])
    expect(options.columns.map((column) => column.header)).toEqual([
      'Nombre',
      'Método',
      'Cuotas',
      'Tasa (%)',
      'Tipo de tasa',
      'Monto mínimo',
      'Monto máximo',
      'Estado',
    ])
  })

  it('cobranza de cuotas: exporta todas las páginas del filtro aplicado', async () => {
    apiMocks.listCreditInstallments.mockImplementation(pages(installment, 7))
    const user = userEvent.setup()
    render(<CreditInstallmentsPage />)
    await screen.findAllByText('Ana Pérez')

    await user.selectOptions(screen.getByLabelText('Estado'), 'PARCIAL')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() =>
      expect(apiMocks.listCreditInstallments).toHaveBeenLastCalledWith(
        { page: 1, limit: 20, status: 'PARCIAL' },
        expect.any(AbortSignal),
      ),
    )

    const button = screen.getByRole('button', { name: 'Exportar a Excel' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)

    await waitFor(() => expect(excel.download).toHaveBeenCalledTimes(1))
    expect(apiMocks.listCreditInstallments).toHaveBeenCalledWith({
      page: 2,
      limit: 100,
      status: 'PARCIAL',
    })
    const [options] = excel.download.mock.calls[0] as unknown as [ExportOptions]
    expect(options.title).toBe('Cobranza de cuotas')
    expect(options.rows).toHaveLength(107)
    expect(options.filters).toContain('Estado: Pago parcial')
    const values = Object.fromEntries(
      options.columns.map((column) => [column.header, column.value(options.rows[0])]),
    )
    expect(values).toMatchObject({
      Cliente: 'Ana Pérez',
      Operación: '#1048',
      Cuota: 4,
      Importe: 60000,
      Pagado: 25000.5,
      Saldo: 34999.5,
      Estado: 'Pago parcial',
      Vencimiento: '2026-10-10',
    })
  })
})
