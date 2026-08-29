import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import { ApiError, AUTH_TOKEN_KEY } from '../../shared/api/client'
import type { AuthUser } from '../auth/types'
import { financialErrorMessage } from './format'
import type {
  Expense,
  FinancialMovement,
  Income,
  SupplierPurchase,
} from './types'

const organization = {
  id: 'org-1',
  code: 'LUMA',
  name: 'Luma Motos',
  type: 'CASA_CENTRAL' as const,
}

const branch = { id: 'branch-1', code: 'SM', name: 'San Miguel' }

function authUser(permissions: string[]): AuthUser {
  return {
    id: 'user-1',
    email: 'admin@luma.test',
    name: 'Lucía Fernández',
    active: true,
    globalAccess: true,
    organization,
    role: {
      id: 'role-1',
      code: 'ADMINISTRATIVA',
      name: 'Administrativa',
      system: false,
      permissions,
    },
    branch,
  }
}

const account = {
  id: 'account-1',
  code: 'CAJA-SM',
  name: 'Caja San Miguel',
  type: 'CAJA' as const,
  branchId: branch.id,
  responsiblePersonnelId: null,
  currency: 'ARS',
  active: true,
  balance: '10000.00',
}

const purchase: SupplierPurchase = {
  id: 'purchase-1',
  purchaseDate: '2026-08-18',
  documentNumber: 'FC-A-123',
  currency: 'ARS',
  paymentStatus: 'PENDIENTE',
  organizationId: organization.id,
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
  supplierId: 'supplier-1',
  unitId: 'unit-1',
  versionId: null,
  supplier: { id: 'supplier-1', legalName: 'Honda Norte SA' },
  branchId: branch.id,
  branch,
  vehicle: {
    unit: { id: 'unit-1', vin: '8CHW1109821', licensePlate: null },
    version: null,
  },
  notes: null,
}

const income: Income = {
  id: 'income-1',
  incomeDate: '2026-08-20',
  type: 'VENTA_VEHICULO',
  reference: 'TT-541',
  description: 'Honda Wave 110 S',
  totalAmount: '2250000.00',
  paidAmount: '500000.00',
  balanceAmount: '1750000.00',
  currency: 'ARS',
  paymentStatus: 'PARCIAL',
  organizationId: organization.id,
  branchId: branch.id,
  branch,
  unitId: 'unit-1',
  operationId: null,
  vehicle: { unit: { id: 'unit-1', vin: '8CHW1109821', licensePlate: null } },
  operation: null,
  collector: null,
  account: null,
  notes: null,
  createdAt: '2026-08-20T12:00:00.000Z',
  updatedAt: '2026-08-20T12:00:00.000Z',
}

const expense: Expense = {
  id: 'expense-1',
  expenseDate: '2026-08-19',
  month: 8,
  year: 2026,
  category: 'FLETE',
  reference: 'TT-539',
  description: 'Traslado San Miguel',
  totalAmount: '85000.00',
  paidAmount: '0.00',
  balanceAmount: '85000.00',
  currency: 'ARS',
  paymentStatus: 'PENDIENTE',
  recoverable: true,
  recovered: false,
  recoveredAmount: '0.00',
  recoverableBalance: '85000.00',
  organizationId: organization.id,
  branchId: branch.id,
  branch,
  createdBy: { id: 'user-1', fullName: 'Lucía Fernández' },
  paidBy: 'Lucía Fernández',
  paymentRegisteredBy: null,
  account: null,
  notes: null,
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
}

const supplierResponse = {
  items: [{ id: 'supplier-1', legalName: 'Honda Norte SA', active: true }],
  total: 1,
  page: 1,
  limit: 100,
}

const versionResponse = {
  items: [{
    id: 'version-1',
    name: 'Wave 110 S',
    active: true,
    model: {
      id: 'model-1',
      name: 'Wave',
      vehicleType: 'MOTO',
      brand: { id: 'brand-1', name: 'Honda' },
    },
  }],
  total: 1,
  page: 1,
  limit: 100,
}

const unitResponse = {
  items: [{
    id: 'unit-1',
    vin: '8CHW1109821',
    licensePlate: null,
    version: versionResponse.items[0],
    branch,
  }],
  total: 1,
  page: 1,
  limit: 100,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFinanceApi(
  user: AuthUser,
  records: { purchases?: SupplierPurchase[]; incomes?: Income[]; expenses?: Expense[] },
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) return jsonResponse(user)
    if (url.includes('/inventory/branches')) {
      return jsonResponse([{ ...branch, organizationId: organization.id }])
    }
    if (url.includes('/suppliers?')) return jsonResponse(supplierResponse)
    if (url.includes('/catalog/versions?')) return jsonResponse(versionResponse)
    if (url.includes('/inventory/units?')) return jsonResponse(unitResponse)
    if (url.includes('/cash/accounts')) {
      return jsonResponse({ items: [account], total: 1, page: 1, limit: 100 })
    }
    if (url.includes('/supplier-purchases') && init?.method !== 'POST') {
      const items = records.purchases ?? []
      return jsonResponse({ items, total: items.length, page: 1, limit: 20 })
    }
    if (url.includes('/incomes') && init?.method !== 'POST') {
      const items = records.incomes ?? []
      return jsonResponse({ items, total: items.length, page: 1, limit: 20 })
    }
    if (url.includes('/expenses') && init?.method !== 'POST') {
      const items = records.expenses ?? []
      return jsonResponse({ items, total: items.length, page: 1, limit: 20 })
    }
    return jsonResponse({}, 201)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function openRoute(path: string) {
  window.history.replaceState({}, '', path)
  sessionStorage.setItem(AUTH_TOKEN_KEY, 'finance-token')
}

afterEach(() => {
  window.history.replaceState({}, '', '/')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  vi.unstubAllGlobals()
})

describe('administración financiera', () => {
  it('explica cuándo un ingreso legado requiere conciliación', () => {
    expect(
      financialErrorMessage(
        new ApiError(
          409,
          'Conflict',
          {
            code: 'INCOME_REQUIRES_RECONCILIATION',
            message: 'Income cannot receive collections',
          },
        ),
      ),
    ).toBe('Este ingreso requiere conciliación antes de registrar un cobro.')
  })

  it('oculta costos y alta de compras sin el permiso sensible, también en 393 px', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
    openRoute('/compras')
    mockFinanceApi(
      authUser(['compras.consultar', 'compras.gestionar', 'compras.pagar']),
      { purchases: [purchase] },
    )

    render(<App />)

    const supplierLabels = await screen.findAllByText('Honda Norte SA')
    const card = supplierLabels.find((element) => element.tagName === 'STRONG')?.closest('article')
    expect(card).not.toBeNull()
    expect(card).toHaveTextContent('Honda Norte SA')
    expect(card).not.toHaveTextContent('Total')
    expect(screen.getByText('Los costos de compra no están disponibles para tu perfil.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo compra' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('envía filtros de mes, proveedor y estado con el query común', async () => {
    openRoute('/compras')
    const fetchMock = mockFinanceApi(
      authUser(['compras.consultar', 'compras.costos.consultar']),
      { purchases: [] },
    )
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'No hay resultados' })
    await user.selectOptions(screen.getByLabelText('Proveedor'), 'supplier-1')
    await user.selectOptions(screen.getByLabelText('Estado'), 'PENDIENTE')
    fireEvent.change(screen.getByLabelText('Mes y año'), {
      target: { value: '2026-08' },
    })
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]) => String(url))
      expect(urls.some((url) =>
        url.includes('/supplier-purchases?page=1&limit=20')
        && url.includes('supplierId=supplier-1')
        && url.includes('status=PENDIENTE')
        && url.includes('from=2026-08-01')
        && url.includes('to=2026-08-31'),
      )).toBe(true)
    })
  })

  it('crea una compra con Decimal string y selección de referencias reales', async () => {
    openRoute('/compras')
    const fetchMock = mockFinanceApi(
      authUser([
        'compras.consultar',
        'compras.gestionar',
        'compras.costos.consultar',
      ]),
      { purchases: [] },
    )
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'No hay resultados' })
    await user.click(screen.getByRole('button', { name: 'Nuevo compra' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByLabelText('Proveedor *')).not.toBeDisabled())
    await user.selectOptions(within(dialog).getByLabelText('Sucursal *'), branch.id)
    await user.selectOptions(within(dialog).getByLabelText('Proveedor *'), 'supplier-1')
    await user.selectOptions(within(dialog).getByLabelText('Unidad / VIN'), 'unit-1')
    await user.type(within(dialog).getByLabelText('Documento'), 'FC-A-123')
    await user.type(within(dialog).getByLabelText('Importe base *'), '2450000.5')
    await user.type(within(dialog).getByLabelText('Costos adicionales'), '10000')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar compra' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url, init]) =>
        String(url).endsWith('/supplier-purchases') && init?.method === 'POST',
      )
      expect(call).toBeDefined()
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        branchId: branch.id,
        purchaseDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        supplierId: 'supplier-1',
        unitId: 'unit-1',
        documentNumber: 'FC-A-123',
        baseAmount: '2450000.50',
        additionalCosts: '10000.00',
        currency: 'ARS',
      })
    })
  })

  it('mantiene gastos generales sin Unidad/VIN ni consultas de inventario', async () => {
    openRoute('/gastos')
    const fetchMock = mockFinanceApi(
      authUser(['gastos.consultar', 'gastos.gestionar']),
      { expenses: [] },
    )
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'No hay resultados' })
    await user.click(screen.getByRole('button', { name: 'Nuevo gasto' }))
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByLabelText('Fecha *')).toBeInTheDocument()
    expect(
      within(dialog).getByLabelText('Motivo / categoría *'),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('TT / referencia *')).toBeInTheDocument()
    expect(
      within(dialog).getByLabelText('Detalle / descripción *'),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Importe *')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Pagado por *')).toHaveValue(
      'Lucía Fernández',
    )
    expect(within(dialog).getByLabelText('Estado del gasto')).toHaveTextContent(
      'Pendiente',
    )
    expect(within(dialog).getByLabelText('Recuperada')).toHaveTextContent('No')
    expect(within(dialog).getByText('Mes')).toBeInTheDocument()
    expect(within(dialog).getByText('Año')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Observaciones')).toBeInTheDocument()
    expect(
      within(dialog).queryByLabelText('Unidad / VIN'),
    ).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Operación')).not.toBeInTheDocument()

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => url.includes('/inventory/units'))).toBe(false)
    expect(urls.some((url) => url.includes('/sales/operations'))).toBe(false)

    fireEvent.change(within(dialog).getByLabelText('Motivo / categoría *'), {
      target: { value: 'Gestoría' },
    })
    fireEvent.change(within(dialog).getByLabelText('TT / referencia *'), {
      target: { value: 'TT-700' },
    })
    fireEvent.change(within(dialog).getByLabelText('Detalle / descripción *'), {
      target: { value: 'Informe de dominio' },
    })
    fireEvent.change(within(dialog).getByLabelText('Importe *'), {
      target: { value: '25000' },
    })
    await user.selectOptions(within(dialog).getByLabelText('Recuperada'), 'true')
    await user.click(
      within(dialog).getByRole('button', { name: 'Guardar gasto' }),
    )

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith('/expenses') && init?.method === 'POST',
      )
      expect(call).toBeDefined()
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        expenseDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        category: 'Gestoría',
        reference: 'TT-700',
        description: 'Informe de dominio',
        totalAmount: '25000.00',
        paidBy: 'Lucía Fernández',
        status: 'PENDIENTE',
        recovered: true,
        month: expect.any(Number),
        year: expect.any(Number),
        recoverable: true,
      })
    })
  })

  it('replica las columnas aprobadas de gastos sin reinterpretar recuperada', async () => {
    openRoute('/gastos')
    mockFinanceApi(authUser(['gastos.consultar']), { expenses: [expense] })

    render(<App />)

    const headers = await screen.findAllByRole('columnheader')
    expect(headers.map((header) => header.textContent)).toEqual([
      'Fecha',
      'Motivo',
      'TT',
      'Detalle',
      'Importe',
      'Pagado por',
      'Estado',
      'Recuperada',
      'Mes / año',
      'Acciones',
    ])
    expect(screen.getByRole('cell', { name: 'Lucía Fernández' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'No' })).toBeInTheDocument()
    expect(screen.queryByText('No recuperable')).not.toBeInTheDocument()
  })

  it('registra cobros parciales con cuenta e idempotencyKey', async () => {
    openRoute('/ingresos')
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' })
    const fetchMock = mockFinanceApi(
      authUser(['ingresos.consultar', 'ingresos.cobrar']),
      { incomes: [income] },
    )
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Cobrar' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByLabelText('Cuenta *')).not.toBeDisabled())
    await user.selectOptions(within(dialog).getByLabelText('Cuenta *'), account.id)
    await user.type(within(dialog).getByLabelText('Importe *'), '250000')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar cobro' }))

    const call = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith('/incomes/income-1/collections') && init?.method === 'POST',
    )
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      accountId: account.id,
      amount: '250000.00',
    })
  })

  it('exige confirmación con motivo antes de reversar un movimiento', async () => {
    openRoute('/gastos')
    vi.stubGlobal('crypto', { randomUUID: () => '22222222-2222-4222-8222-222222222222' })
    const movement: FinancialMovement = {
      id: 'movement-1',
      account,
      type: 'EGRESO',
      direction: 'DEBITO',
      amount: '85000.00',
      occurredAt: '2026-08-19T15:00:00.000Z',
      reference: 'TT-539',
      notes: null,
      registeredBy: { id: 'user-1', fullName: 'Lucía Fernández' },
      reversed: false,
      reversalOfId: null,
      createdAt: '2026-08-19T15:00:00.000Z',
    }
    let reversed = false
    const fetchMock = mockFinanceApi(
      authUser(['gastos.consultar', 'caja.reversar']),
      { expenses: [expense] },
    )
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) {
        return jsonResponse(authUser(['gastos.consultar', 'caja.reversar']))
      }
      if (url.includes('/inventory/branches')) {
        return jsonResponse([{ ...branch, organizationId: organization.id }])
      }
      if (url.includes('/cash/accounts')) {
        return jsonResponse({ items: [account], total: 1, page: 1, limit: 100 })
      }
      if (url.endsWith('/expenses/expense-1/movements/movement-1/reverse')) {
        reversed = true
        return jsonResponse({ ...expense, movements: [{ ...movement, reversed: true }] }, 201)
      }
      if (url.endsWith('/expenses/expense-1')) {
        return jsonResponse({ ...expense, movements: [{ ...movement, reversed }] })
      }
      if (url.includes('/expenses')) {
        return jsonResponse({ items: [expense], total: 1, page: 1, limit: 20 })
      }
      return jsonResponse({}, init?.method === 'POST' ? 201 : 200)
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /Ver movimientos de/ }))
    await user.click(await screen.findByRole('button', { name: 'Reversar' }))
    expect(screen.getByRole('button', { name: 'Confirmar reversa' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Motivo *'), 'Movimiento duplicado')
    await user.click(screen.getByRole('button', { name: 'Confirmar reversa' }))

    await waitFor(() => expect(screen.getByText('Reversado')).toBeInTheDocument())
    const call = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/expenses/expense-1/movements/movement-1/reverse'),
    )
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
      reason: 'Movimiento duplicado',
    })
  })

  it('muestra un estado 403 explícito sin presentar datos', async () => {
    openRoute('/ingresos')
    const user = authUser(['ingresos.consultar'])
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) return jsonResponse(user)
      if (url.includes('/inventory/branches')) return jsonResponse([])
      if (url.includes('/cash/accounts')) {
        return jsonResponse({ items: [], total: 0, page: 1, limit: 100 })
      }
      if (url.includes('/incomes')) {
        return jsonResponse({ statusCode: 403, message: 'Forbidden', error: 'Forbidden' }, 403)
      }
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'No tenés acceso a estos registros' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
