import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import type { AuthUser } from '../auth/types'
import { AgreementModal } from './components'
import { commissionApiGateway } from './api'
import { CommissionPaymentsPage, PaidCommissionsPage } from './CommissionManagementPages'
import { SuggestedCommissionsPage } from './SuggestedCommissionsPage'
import { validateScalePolicy } from './format'
import type {
  CommissionDetail,
  CommissionGateway,
  CommissionScalePolicy,
  CommissionSettlement,
  CommissionSummary,
  MyCommissions,
  PaidCommission,
} from './types'

const scale = {
  id: 'scale-3',
  minUnits: 11,
  maxUnits: 15,
  fixedAmount: '45000.00',
  validFrom: '2026-08-01',
  validTo: null,
}

const summary: CommissionSummary = {
  id: 'suggestion-1',
  seller: { id: 'seller-1', name: 'Martín Suárez' },
  branch: { id: 'branch-1', name: 'San Miguel' },
  period: '2026-08',
  vehicleType: 'MOTO',
  configurationStatus: 'CONFIGURED',
  computableSales: 13,
  scale,
  suggestedAmount: '45000.00',
  status: 'AGREED',
  nextScale: {
    ...scale,
    id: 'scale-4',
    minUnits: 16,
    maxUnits: null,
    fixedAmount: '50000.00',
  },
  unitsToNextScale: 3,
  version: 4,
}

const settlement: CommissionSettlement = {
  ...summary,
  id: 'settlement-1',
  agreedAmount: '47000.00',
  meetingDate: '2026-08-28',
  notes: null,
}

const detail: CommissionDetail = {
  ...summary,
  operations: [{
    id: 'operation-1',
    date: '2026-08-20',
    customerName: 'Ana Cliente',
    vehicleLabel: 'Honda Wave 110',
    listPrice: '2500000.00',
    closingPrice: '2400000.00',
    difference: '-100000.00',
    belowList: true,
    computable: true,
    nonComputableReason: null,
    status: 'APROBADA',
  }],
  settlement,
}

const policy: CommissionScalePolicy = {
  id: 'policy-1',
  vehicleType: 'MOTO',
  currency: 'ARS',
  validFrom: '2026-08-01',
  validTo: null,
  status: 'ACTIVE',
  version: 1,
  tiers: [
    { ...scale, id: 'scale-1', minUnits: 1, maxUnits: 5, fixedAmount: '35000.00' },
    { ...scale, id: 'scale-2', minUnits: 6, maxUnits: 10, fixedAmount: '40000.00' },
    scale,
    { ...scale, id: 'scale-4', minUnits: 16, maxUnits: null, fixedAmount: '50000.00' },
  ],
}

const paid: PaidCommission = {
  ...settlement,
  status: 'PAID',
  paidAt: '2026-08-29',
  paidAmount: '47000.00',
  account: { id: 'account-1', code: 'CAJA-SM', name: 'Caja San Miguel' },
  reference: 'REC-11',
  scaleSnapshot: scale,
}

function gateway(overrides: Partial<CommissionGateway> = {}): CommissionGateway {
  const mine: MyCommissions = {
    progress: detail,
    paidHistory: { items: [paid], total: 1, page: 1, limit: 50 },
  }
  return {
    listOptions: vi.fn().mockResolvedValue({
      sellers: [summary.seller],
      branches: [summary.branch],
    }),
    listPaymentOptions: vi.fn().mockResolvedValue({
      accounts: [paid.account],
    }),
    listSuggestions: vi.fn().mockResolvedValue({ items: [summary], total: 1, page: 1, limit: 50 }),
    getSuggestion: vi.fn().mockResolvedValue(detail),
    registerAgreement: vi.fn().mockResolvedValue(settlement),
    listPayable: vi.fn().mockResolvedValue({ items: [settlement], total: 1, page: 1, limit: 50 }),
    pay: vi.fn().mockResolvedValue(paid),
    listPaid: vi.fn().mockResolvedValue({ items: [paid], total: 1, page: 1, limit: 50 }),
    listPolicies: vi.fn().mockResolvedValue({ items: [policy], total: 1, page: 1, limit: 100 }),
    savePolicy: vi.fn().mockResolvedValue(policy),
    getMine: vi.fn().mockResolvedValue(mine),
    ...overrides,
  }
}

function renderRoute(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

afterEach(() => {
  window.history.replaceState({}, '', '/')
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('comisiones productivas', () => {
  it('muestra la comisión fija total de la escala y nunca la multiplica por ventas', async () => {
    renderRoute(<SuggestedCommissionsPage vehicleType="MOTO" gateway={gateway()} />)
    expect(await screen.findAllByText('$ 45.000')).not.toHaveLength(0)
    expect(screen.getAllByText('13')).not.toHaveLength(0)
    expect(screen.queryByText('$ 585.000')).not.toBeInTheDocument()
    expect(screen.getByText(/monto fijo total/i)).toBeInTheDocument()
  })

  it('mantiene AUTO separado y muestra política ausente sin inventar importes', async () => {
    const api = gateway({
      listSuggestions: vi.fn().mockResolvedValue({
        items: [{ ...summary, id: 'auto-1', vehicleType: 'AUTO', configurationStatus: 'NOT_CONFIGURED', scale: null, nextScale: null, suggestedAmount: null }],
        total: 1,
        page: 1,
        limit: 50,
      }),
      listPolicies: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 }),
    })
    renderRoute(<SuggestedCommissionsPage vehicleType="AUTO" gateway={api} />)
    expect(await screen.findByText('Escalas no configuradas')).toBeInTheDocument()
    expect(api.listSuggestions).toHaveBeenCalledWith(expect.objectContaining({ vehicleType: 'AUTO' }), expect.any(AbortSignal))
    expect(screen.queryByText('$ 45.000')).not.toBeInTheDocument()
  })

  it('valida límites contiguos, sin solapamientos y con último tramo abierto', () => {
    expect(validateScalePolicy({
      vehicleType: 'MOTO',
      currency: 'ARS',
      validFrom: '2026-08-01',
      status: 'ACTIVE',
      tiers: policy.tiers.map(({ minUnits, maxUnits, fixedAmount }) => ({ minUnits, maxUnits, fixedAmount })),
    })).toEqual([])
    expect(validateScalePolicy({
      vehicleType: 'AUTO',
      currency: 'ARS',
      validFrom: '2026-08-01',
      status: 'ACTIVE',
      tiers: [
        { minUnits: 2, maxUnits: 7, fixedAmount: '1.00' },
        { minUnits: 7, maxUnits: 9, fixedAmount: '2.00' },
      ],
    })).toEqual(expect.arrayContaining([
      'La escala debe comenzar en 1.',
      expect.stringContaining('hueco o solapamiento'),
      'El último tramo debe quedar abierto.',
    ]))
  })

  it('registra el acuerdo con monto libre y versión esperada', async () => {
    const api = gateway()
    const user = userEvent.setup()
    renderRoute(<AgreementModal detail={detail} gateway={api} onClose={vi.fn()} onSaved={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    const amount = within(dialog).getByLabelText('Importe acordado *')
    await user.clear(amount)
    await user.type(amount, '48000')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar acuerdo' }))
    expect(api.registerAgreement).toHaveBeenCalledWith('suggestion-1', expect.objectContaining({
      agreedAmount: '48000.00',
      expectedVersion: 4,
    }))
  })

  it('confirma pago completo, no ofrece importe y evita el doble envío', async () => {
    let resolvePayment!: (value: PaidCommission) => void
    const pay = vi.fn().mockImplementation(() => new Promise<PaidCommission>((resolve) => { resolvePayment = resolve }))
    const api = gateway({ pay })
    const user = userEvent.setup()
    renderRoute(<CommissionPaymentsPage vehicleType="MOTO" gateway={api} />)
    const payButtons = await screen.findAllByRole('button', { name: /Hacer efectivo/ })
    await user.click(payButtons[0]!)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByLabelText(/Importe/)).not.toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText('Cuenta / caja *'), 'account-1')
    await user.type(within(dialog).getByLabelText('Referencia *'), 'REC-11')
    await user.click(within(dialog).getByRole('checkbox'))
    const submit = within(dialog).getByRole('button', { name: 'Confirmar pago completo' })
    await user.dblClick(submit)
    expect(pay).toHaveBeenCalledTimes(1)
    expect(pay).toHaveBeenCalledWith('settlement-1', expect.objectContaining({
      expectedVersion: 4,
      accountId: 'account-1',
      idempotencyKey: expect.any(String),
    }))
    resolvePayment(paid)
  })

  it('envía filtros de histórico sin mezclar el tipo', async () => {
    const api = gateway()
    const user = userEvent.setup()
    renderRoute(<PaidCommissionsPage vehicleType="AUTO" gateway={api} />)
    expect(await screen.findAllByText('Martín Suárez')).not.toHaveLength(0)
    await user.type(screen.getByLabelText('Año'), '2026')
    await user.selectOptions(screen.getByLabelText('Mes'), '8')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(api.listPaid).toHaveBeenLastCalledWith(
      expect.objectContaining({ vehicleType: 'AUTO', year: 2026, month: 8 }),
      expect.any(AbortSignal),
    ))
  })
})

describe('permisos y vista propia', () => {
  const seller: AuthUser = {
    id: 'seller-user',
    email: 'seller@luma.test',
    name: 'Martín Suárez',
    active: true,
    globalAccess: false,
    organization: { id: 'org-1', code: 'LUMA', name: 'Luma Motos', type: 'CASA_CENTRAL' },
    role: {
      id: 'seller-role',
      code: 'VENDEDOR',
      name: 'Vendedor',
      system: true,
      permissions: ['comisiones.propias'],
    },
    branch: { id: 'branch-1', code: 'SM', name: 'San Miguel' },
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }

  it('oculta gestión al vendedor y /me nunca envía sellerId', async () => {
    window.history.replaceState({}, '', '/mis-comisiones')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'seller-token')
    const mine = { progress: detail, paidHistory: { items: [], total: 0, page: 1, limit: 50 } }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) return json(seller)
      if (url.includes('/commissions/me')) return json(mine)
      return json({}, 404)
    })

    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Mis comisiones' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Sugerido de comisiones/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Pagar comisiones/ })).not.toBeInTheDocument()
    const mineUrls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/commissions/me'))
    expect(mineUrls).toHaveLength(2)
    expect(mineUrls.every((url) => !url.includes('sellerId') && url.includes('vehicleType='))).toBe(true)
  })

  it('bloquea por ruta directa una pantalla administrativa', async () => {
    window.history.replaceState({}, '', '/comisiones/pagar/motos')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'seller-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(seller)))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'No tenés permiso para ingresar' })).toBeInTheDocument()
  })
})

describe('integración HTTP del sugerido', () => {
  it('carga por defecto todas las sucursales sin serializar el placeholder', async () => {
    const branch = {
      id: '84e778cc-7616-4792-b6db-d89f100bb6f1',
      name: 'San Miguel',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/branches')) {
        return new Response(JSON.stringify([branch]), { status: 200 })
      }
      if (url.includes('/sales/operations/sellers?')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, limit: 100 }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({ items: [], total: 0, page: 1, limit: 50 }),
        { status: 200 },
      )
    })
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'admin-token')
    vi.stubGlobal('fetch', fetchMock)

    renderRoute(
      <SuggestedCommissionsPage
        vehicleType="MOTO"
        gateway={commissionApiGateway}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'Sugerido de comisiones' }),
    ).toBeInTheDocument()
    const suggestionUrl = fetchMock.mock.calls
      .map(([url]) => String(url))
      .find((url) => url.includes('/commissions/suggestions?'))
    expect(suggestionUrl).not.toContain('branchId')
    expect(suggestionUrl).not.toContain('Todas')
  })
})
