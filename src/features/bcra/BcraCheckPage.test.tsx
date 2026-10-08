import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BcraCheckPage } from './BcraCheckPage'
import type { BcraSituacionResponse } from './types'

const apiMocks = vi.hoisted(() => ({ getBcraSituacion: vi.fn() }))
vi.mock('./api', () => apiMocks)

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { role: { permissions: ['creditos.bcra.detalle'] } } }),
}))

const excel = vi.hoisted(() => ({ download: vi.fn(() => Promise.resolve()) }))
vi.mock('../../shared/export/excel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/export/excel')>()),
  downloadExcel: excel.download,
}))

const response: BcraSituacionResponse = {
  resumen: {
    veredicto: 'AMARILLO',
    identificacion: '20380974410',
    denominacion: 'PEREZ ANA',
    periodoMasReciente: '202608',
    peorSituacionActual: 2,
    procesoJudActual: false,
    enRevisionActual: false,
    antecedenteSeveroReciente: false,
    montoIrregularActual: 0,
    montoTotalActual: 350000,
    porcentajeIrregular: 0,
    consultadoEn: '2026-10-08T13:00:00.000Z',
  },
  detalle: {
    periodos: [
      {
        periodo: '202608',
        entidades: [
          { entidad: 'BANCO UNO', situacion: 1, monto: 150, enRevision: false, procesoJud: false },
          { entidad: 'BANCO DOS', situacion: 2, monto: 200, enRevision: true, procesoJud: false },
        ],
      },
      {
        periodo: '202607',
        entidades: [
          { entidad: 'BANCO UNO', situacion: 1, monto: 140, enRevision: false, procesoJud: false },
        ],
      },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.getBcraSituacion.mockResolvedValue(response)
})

describe('BcraCheckPage', () => {
  it('exporta a Excel las deudas por entidad del CUIT consultado', async () => {
    const user = userEvent.setup()
    render(<BcraCheckPage />)

    const button = screen.getByRole('button', { name: 'Exportar a Excel' })
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText('CUIT / CUIL'), '20380974410')
    await user.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByText('Antecedentes a revisar')
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)

    await waitFor(() => expect(excel.download).toHaveBeenCalledTimes(1))
    const [options] = excel.download.mock.calls[0] as unknown as [
      {
        title: string
        filters: unknown[]
        rows: unknown[]
        columns: Array<{ header: string; value: (row: unknown) => unknown }>
      },
    ]
    expect(options.title).toBe('Consulta BCRA')
    expect(options.filters).toEqual(
      expect.arrayContaining(['CUIT: 20-38097441-0', 'Nombre: PEREZ ANA']),
    )
    expect(options.rows).toHaveLength(3)
    const values = Object.fromEntries(
      options.columns.map((column) => [column.header, column.value(options.rows[1])]),
    )
    expect(values).toEqual({
      Período: '08/2026',
      Entidad: 'BANCO DOS',
      Situación: 'Seguimiento especial / riesgo bajo',
      Monto: 200000,
      Revisión: true,
      'Proceso judicial': false,
    })
  })
})
