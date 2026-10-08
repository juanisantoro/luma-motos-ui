import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApprovalsPage } from './ApprovalsPage'
import { AssignmentsPage } from './AssignmentsPage'
import { OperationsPage } from './OperationsPage'
import { OperationTrackingPanel } from './OperationTrackingPanel'
import { operationFixture } from './licensing.fixtures'
import { trackingRowFixture } from './tracking.fixtures'

// Exportación a Excel de las grillas de ventas: el botón pide TODAS las
// páginas con el mismo filtro que la grilla y arma el archivo con eso.

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  roleCode: 'ADMINISTRATIVA',
  listOperations: vi.fn(),
  listApprovals: vi.fn(),
  listTracking: vi.fn(),
  listRecipients: vi.fn(),
  listBranches: vi.fn(),
  download: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../shared/export/excel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/export/excel')>()),
  downloadExcel: mocks.download,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      globalAccess: true,
      organization: { id: 'org-1', name: 'Luma', code: 'LUMA_CENTRAL' },
      branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
      branchScope: { allBranches: true, branches: [] },
      role: { code: mocks.roleCode, permissions: mocks.permissions },
    },
  }),
}))

vi.mock('./api', () => ({
  listSalesOperations: mocks.listOperations,
  listSalesApprovals: mocks.listApprovals,
  approveSalesOperation: vi.fn(),
  rejectSalesOperation: vi.fn(),
  releaseSalesReservation: vi.fn(),
  updateSalesLicensing: vi.fn(),
  assignSalesUnit: vi.fn(),
  requestSalesSupply: vi.fn(),
  listAssignableUnits: vi.fn(),
  listSupplierSuggestions: vi.fn(),
}))

vi.mock('./tracking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tracking')>()),
  listOperationTracking: mocks.listTracking,
  listHandoverRecipients: mocks.listRecipients,
}))

vi.mock('../stock/api', () => ({
  listSalesBranches: mocks.listBranches,
  listUnitColors: vi.fn(() => Promise.resolve([])),
  stockApiGateway: { receiveSupply: vi.fn() },
}))
vi.mock('../finance/api', () => ({
  listAllSuppliers: vi.fn(() => Promise.resolve([])),
  listAllCashAccounts: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../../shared/alerts', () => ({
  alertSuccess: vi.fn(() => Promise.resolve()),
  alertError: vi.fn(() => Promise.resolve()),
}))

const TOTAL = 130

/** Responde como el servidor: 130 filas, de a `limit` por página. */
function paged<T>(build: (id: string) => T) {
  return (query: { page: number; limit: number }) => {
    const start = (query.page - 1) * query.limit
    const count = Math.max(0, Math.min(query.limit, TOTAL - start))
    return Promise.resolve({
      items: Array.from({ length: count }, (_, index) =>
        build(`row-${start + index}`),
      ),
      total: TOTAL,
      page: query.page,
      limit: query.limit,
    })
  }
}

type ExportOptions = {
  title: string
  filters: unknown[]
  rows: unknown[]
  total: number
  columns: Array<{ header: string; value: (row: unknown) => unknown }>
}

function exported() {
  const [options] = mocks.download.mock.calls[0] as unknown as [ExportOptions]
  return options
}

async function clickExport() {
  const button = await screen.findByRole('button', { name: 'Exportar a Excel' })
  await waitFor(() => expect(button).toBeEnabled())
  await userEvent.click(button)
  await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.roleCode = 'ADMINISTRATIVA'
  mocks.permissions = ['ventas.consultar', 'ingresos.consultar']
  mocks.listBranches.mockResolvedValue([
    { id: 'branch-1', code: 'SM', name: 'San Miguel', organizationId: 'org-1' },
    { id: 'branch-2', code: 'DV', name: 'Del Viso', organizationId: 'org-1' },
  ])
  mocks.listRecipients.mockResolvedValue([])
})

describe('Exportar a Excel en ventas', () => {
  it('Operaciones: exporta todas las páginas con el filtro aplicado', async () => {
    mocks.listOperations.mockImplementation(
      paged((id) => operationFixture({ id, number: id })),
    )
    render(
      <MemoryRouter initialEntries={['/motos/operaciones?patente=DEMORADAS']}>
        <OperationsPage vehicleType="MOTO" />
      </MemoryRouter>,
    )

    await clickExport()

    const exportCalls = mocks.listOperations.mock.calls.filter(
      ([query]) => (query as { limit: number }).limit === 100,
    )
    expect(exportCalls).toHaveLength(2)
    expect(exportCalls[0]![0]).toMatchObject({
      vehicleType: 'MOTO',
      licensingOverdue: true,
      page: 1,
    })
    const options = exported()
    expect(options.title).toBe('Operaciones de motos')
    expect(options.rows).toHaveLength(TOTAL)
    expect(options.total).toBe(TOTAL)
    expect(options.filters).toContain('Patentamiento: Patente demorada')
    const headers = options.columns.map((column) => column.header)
    for (const header of [
      'Operación',
      'Boleto',
      'Fecha',
      'Estado',
      'Cliente',
      'Documento',
      'Vehículo',
      'VIN',
      'Sucursal',
      'Vendedor',
      'Precio acordado',
      'Patentamiento',
      'Estado patentamiento',
    ]) {
      expect(headers).toContain(header)
    }
    const status = options.columns.find((column) => column.header === 'Estado')!
    expect(status.value(options.rows[0])).toBe('Aprobada')
  })

  it('Mis operaciones: exporta con mine=true y sin columnas de patentamiento', async () => {
    mocks.roleCode = 'VENDEDOR'
    mocks.listOperations.mockImplementation(
      paged((id) => operationFixture({ id, number: id })),
    )
    render(
      <MemoryRouter initialEntries={['/autos/mis-operaciones']}>
        <OperationsPage mine vehicleType="AUTO" />
      </MemoryRouter>,
    )

    await clickExport()

    const options = exported()
    expect(options.title).toBe('Mis operaciones de autos')
    expect(options.rows).toHaveLength(TOTAL)
    expect(mocks.listOperations).toHaveBeenLastCalledWith(
      expect.objectContaining({ mine: true, vehicleType: 'AUTO', page: 2, limit: 100 }),
    )
    expect(options.columns.map((column) => column.header)).not.toContain(
      'Patentamiento',
    )
  })

  it('Aprobaciones: exporta todas las pendientes', async () => {
    mocks.listApprovals.mockImplementation(
      paged((id) =>
        operationFixture({
          id,
          number: id,
          status: 'PENDIENTE_APROBACION',
          listPrice: '5000000',
          agreedPrice: '4400000',
        }),
      ),
    )
    render(<ApprovalsPage vehicleType="MOTO" />)

    await clickExport()

    const options = exported()
    expect(options.title).toBe('Aprobaciones de motos')
    expect(options.rows).toHaveLength(TOTAL)
    const difference = options.columns.find(
      (column) => column.header === 'Diferencia',
    )!
    expect(difference.value(options.rows[0])).toBe(600000)
  })

  it('Operaciones a asignar: exporta todas las páginas del filtro', async () => {
    mocks.permissions = ['ventas.consultar', 'ventas.asignar_unidad']
    mocks.listOperations.mockImplementation(
      paged((id) =>
        operationFixture({
          id,
          number: id,
          vehicle: { ...operationFixture().vehicle, unit: null, chassis: null },
        }),
      ),
    )
    render(
      <MemoryRouter>
        <AssignmentsPage vehicleType="MOTO" />
      </MemoryRouter>,
    )

    await clickExport()

    expect(mocks.listOperations).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fulfillmentStatus: 'SIN_ASIGNAR',
        page: 2,
        limit: 100,
      }),
    )
    const options = exported()
    expect(options.title).toBe('Operaciones a asignar · motos')
    expect(options.rows).toHaveLength(TOTAL)
    expect(options.filters).toContain('Situación de la unidad: Todas sin unidad')
  })

  it('Seguimiento de cobros: exporta todas las páginas con los filtros aplicados', async () => {
    mocks.listTracking.mockImplementation(
      paged((id) => trackingRowFixture({ id, number: id })),
    )
    render(
      <MemoryRouter>
        <OperationTrackingPanel vehicleType="MOTO" />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByLabelText('Con saldo'))
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    await clickExport()

    expect(mocks.listTracking).toHaveBeenLastCalledWith(
      expect.objectContaining({
        vehicleType: 'MOTO',
        withBalance: true,
        page: 2,
        limit: 100,
      }),
    )
    const options = exported()
    expect(options.title).toBe('Seguimiento de cobros de motos')
    expect(options.rows).toHaveLength(TOTAL)
    expect(options.filters).toContain('Con saldo')
    const headers = options.columns.map((column) => column.header)
    expect(headers).toEqual(
      expect.arrayContaining(['Acordado', 'Cobrado', 'Saldo', 'Patentamiento']),
    )
  })
})
