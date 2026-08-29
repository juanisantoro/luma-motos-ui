import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NetworkError } from '../../shared/api/client'
import { CreditInquiriesPage } from './CreditInquiriesPage'
import type {
  CreditHistoryResponse,
  CreditInquiry,
  RejectedInquiryListResponse,
} from './types'

const apiMocks = vi.hoisted(() => ({
  listRejectedInquiries: vi.fn(),
  listFinancialInstitutions: vi.fn(),
  listCreditBranches: vi.fn(),
  listCreditRegistrants: vi.fn(),
  getCreditHistory: vi.fn(),
  createCreditInquiry: vi.fn(),
}))

const authMock = vi.hoisted(() => ({
  permissions: [
    'consultas_crediticias.consultar',
    'consultas_crediticias.registrar',
  ],
}))

vi.mock('./api', () => apiMocks)
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      role: { permissions: authMock.permissions },
    },
  }),
}))

const inquiry: CreditInquiry = {
  id: '11111111-1111-4111-8111-111111111111',
  client: {
    id: '22222222-2222-4222-8222-222222222222',
    documentType: 'DNI',
    documentNumber: '28.456.789',
    fullName: 'Carlos Medina',
  },
  financialEntity: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Banco Columbia',
  },
  outcome: 'RECHAZADA',
  reason: 'Mora superior a 90 días',
  consultedAt: '2026-08-04T12:00:00.000Z',
  attemptCount: 2,
  branch: {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'SM',
    name: 'San Miguel',
  },
  registeredBy: {
    id: '55555555-5555-4555-8555-555555555555',
    fullName: 'Camila López',
  },
  operation: null,
  externalReference: null,
  createdAt: '2026-08-04T12:00:00.000Z',
}

function listResponse(items: CreditInquiry[]): RejectedInquiryListResponse {
  return { items, total: items.length, page: 1, limit: 20 }
}

const historyResponse: CreditHistoryResponse = {
  client: inquiry.client,
  items: [
    inquiry,
    {
      ...inquiry,
      id: '66666666-6666-4666-8666-666666666666',
      outcome: 'APROBADA',
      reason: null,
      consultedAt: '2026-07-12T12:00:00.000Z',
    },
  ],
  summary: {
    totalAttempts: 2,
    rejectedAttempts: 1,
    approvedAttempts: 1,
    pendingAttempts: 0,
    firstConsultedAt: '2026-07-12T12:00:00.000Z',
    lastConsultedAt: '2026-08-04T12:00:00.000Z',
  },
  total: 2,
  page: 1,
  limit: 50,
}

beforeEach(() => {
  authMock.permissions = [
    'consultas_crediticias.consultar',
    'consultas_crediticias.registrar',
  ]
  apiMocks.listRejectedInquiries.mockResolvedValue(listResponse([inquiry]))
  apiMocks.listFinancialInstitutions.mockResolvedValue({
    items: [
      {
        id: inquiry.financialEntity.id,
        name: inquiry.financialEntity.name,
        taxId: null,
        active: true,
        createdAt: '2026-08-01T12:00:00.000Z',
      },
    ],
    total: 1,
    page: 1,
    limit: 100,
  })
  apiMocks.listCreditBranches.mockResolvedValue({
    items: [inquiry.branch],
    total: 1,
    page: 1,
    limit: 100,
  })
  apiMocks.listCreditRegistrants.mockResolvedValue({
    items: [
      {
        ...inquiry.registeredBy,
        primaryBranch: inquiry.branch,
      },
    ],
    total: 1,
    page: 1,
    limit: 100,
  })
  apiMocks.getCreditHistory.mockResolvedValue(historyResponse)
  apiMocks.createCreditInquiry.mockResolvedValue({
    ...inquiry,
    idempotentReplay: false,
  })
})

afterEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1024,
  })
})

describe('CreditInquiriesPage', () => {
  it('abre directamente el listado desktop y aplica todos los filtros', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    })
    const user = userEvent.setup()
    render(<CreditInquiriesPage />)

    expect(await screen.findByText('Carlos Medina')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Mora superior a 90 días')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Documento o nombre'), 'Carlos')
    await user.selectOptions(
      screen.getByLabelText('Financiera'),
      inquiry.financialEntity.id,
    )
    await user.type(screen.getByLabelText('Desde'), '2026-08-01')
    await user.type(screen.getByLabelText('Hasta'), '2026-08-31')
    await user.selectOptions(screen.getByLabelText('Sucursal'), inquiry.branch.id)
    await user.selectOptions(
      screen.getByLabelText('Vendedor'),
      inquiry.registeredBy.id,
    )
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() =>
      expect(apiMocks.listRejectedInquiries).toHaveBeenLastCalledWith(
        {
          page: 1,
          limit: 20,
          search: 'Carlos',
          financialEntityId: inquiry.financialEntity.id,
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          branchId: inquiry.branch.id,
          registeredById: inquiry.registeredBy.id,
        },
        expect.any(AbortSignal),
      ),
    )
  })

  it.each([393, 768])(
    'presenta cards y filtros colapsados en %i px',
    async (width) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: width,
    })
    render(<CreditInquiriesPage />)

    expect(await screen.findByRole('article')).toHaveTextContent('Carlos Medina')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('Filtros').closest('details')).not.toHaveAttribute(
      'open',
    )
    },
  )

  it('mantiene la tabla prioritaria en 1920 px', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1920,
    })
    render(<CreditInquiriesPage />)

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Mora superior a 90 días')).toBeInTheDocument()
  })

  it('carga y muestra el historial completo de intentos', async () => {
    const user = userEvent.setup()
    render(<CreditInquiriesPage />)

    await user.click(
      await screen.findByRole('button', {
        name: 'Ver historial de Carlos Medina',
      }),
    )

    expect(await screen.findByText('2 intentos registrados')).toBeInTheDocument()
    expect(screen.getByText('Aprobada')).toBeInTheDocument()
    expect(apiMocks.getCreditHistory).toHaveBeenCalledWith(
      inquiry.client.id,
      1,
      50,
      expect.any(AbortSignal),
    )
  })

  it('pagina el consolidado desde los controles accesibles', async () => {
    apiMocks.listRejectedInquiries.mockResolvedValue({
      items: [inquiry],
      total: 45,
      page: 1,
      limit: 20,
    })
    const user = userEvent.setup()
    render(<CreditInquiriesPage />)

    await user.click(
      await screen.findByRole('button', { name: 'Página siguiente' }),
    )

    await waitFor(() =>
      expect(apiMocks.listRejectedInquiries).toHaveBeenLastCalledWith(
        { page: 2, limit: 20 },
        expect.any(AbortSignal),
      ),
    )
  })

  it('atrapa el foco y devuelve el foco al cerrar el modal con Escape', async () => {
    const user = userEvent.setup()
    render(<CreditInquiriesPage />)
    const openButton = await screen.findByRole('button', {
      name: 'Registrar rechazo',
    })
    await user.click(openButton)

    const closeButton = screen.getByRole('button', {
      name: 'Cerrar formulario',
    })
    await waitFor(() => expect(closeButton).toHaveFocus())
    await user.tab({ shift: true })
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Registrar rechazo',
      }),
    ).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(openButton).toHaveFocus()
  })

  it('valida el modal y registra con una clave idempotente estable', async () => {
    const user = userEvent.setup()
    render(<CreditInquiriesPage />)
    const openButton = await screen.findByRole('button', {
      name: 'Registrar rechazo',
    })
    await user.click(openButton)

    const dialog = screen.getByRole('dialog', { name: 'Registrar rechazo' })
    expect(dialog).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cerrar formulario' })).toHaveFocus(),
    )

    await user.type(screen.getByLabelText('Documento *'), '12')
    await user.type(screen.getByLabelText('Nombre y apellido *'), 'Ana Pérez')
    await user.selectOptions(
      screen.getByLabelText('Financiera *'),
      inquiry.financialEntity.id,
    )
    await user.selectOptions(
      screen.getByLabelText('Vendedor que lo registró *'),
      inquiry.registeredBy.id,
    )
    await user.type(screen.getByLabelText('Motivo informado *'), 'Scoring bajo')
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar rechazo' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El documento debe tener entre 5 y 30 caracteres',
    )
    expect(apiMocks.createCreditInquiry).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Documento *'))
    await user.type(screen.getByLabelText('Documento *'), '12345678')
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar rechazo' }),
    )

    await waitFor(() => expect(apiMocks.createCreditInquiry).toHaveBeenCalledOnce())
    const input = apiMocks.createCreditInquiry.mock.calls[0]?.[0]
    const idempotencyKey = apiMocks.createCreditInquiry.mock.calls[0]?.[1]
    expect(input).toMatchObject({
      documentType: 'DNI',
      documentNumber: '12345678',
      fullName: 'Ana Pérez',
      financialEntityId: inquiry.financialEntity.id,
      outcome: 'RECHAZADA',
      reason: 'Scoring bajo',
      registeredById: inquiry.registeredBy.id,
      branchId: inquiry.branch.id,
    })
    expect(idempotencyKey).toMatch(/^credit-inquiry:[0-9a-f-]{36}$/)
    expect(
      await screen.findByText('Rechazo registrado correctamente.'),
    ).toBeInTheDocument()
  })

  it('mantiene abierto el modal y muestra un error de mutación', async () => {
    apiMocks.createCreditInquiry.mockRejectedValue(
      new ApiError(409, 'Idempotency conflict'),
    )
    const user = userEvent.setup()
    render(<CreditInquiriesPage />)
    await user.click(
      await screen.findByRole('button', { name: 'Registrar rechazo' }),
    )
    const dialog = screen.getByRole('dialog')

    await user.type(screen.getByLabelText('Documento *'), '12345678')
    await user.type(screen.getByLabelText('Nombre y apellido *'), 'Ana Pérez')
    await user.selectOptions(
      screen.getByLabelText('Financiera *'),
      inquiry.financialEntity.id,
    )
    await user.selectOptions(
      screen.getByLabelText('Vendedor que lo registró *'),
      inquiry.registeredBy.id,
    )
    await user.type(screen.getByLabelText('Motivo informado *'), 'Scoring bajo')
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar rechazo' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'conflicto con un registro existente',
    )
    expect(dialog).toBeInTheDocument()
  })

  it('oculta el alta sin permiso y expone vacío, error y 403', async () => {
    authMock.permissions = ['consultas_crediticias.consultar']
    apiMocks.listRejectedInquiries.mockResolvedValueOnce(listResponse([]))
    const first = render(<CreditInquiriesPage />)

    expect(
      await screen.findByRole('heading', { name: 'No hay rechazos registrados' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Registrar rechazo' }),
    ).not.toBeInTheDocument()
    first.unmount()

    apiMocks.listRejectedInquiries.mockRejectedValueOnce(new NetworkError())
    const second = render(<CreditInquiriesPage />)
    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar las consultas',
      }),
    ).toBeInTheDocument()
    second.unmount()

    apiMocks.listRejectedInquiries.mockRejectedValueOnce(
      new ApiError(403, 'Forbidden'),
    )
    render(<CreditInquiriesPage />)
    expect(
      await screen.findByRole('heading', { name: 'Acceso restringido' }),
    ).toBeInTheDocument()
  })
})
