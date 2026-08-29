import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkError } from '../../shared/api/client'
import { StockPage } from './StockPage'
import type { StockGateway } from './gateway'
import type { StockWorkspaceData } from './types'

const permissions = [
  'inventario.consultar',
  'inventario.gestionar',
  'catalogo.consultar',
]

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      globalAccess: false,
      role: { permissions },
    },
  }),
}))

const emptyData: StockWorkspaceData = {
  branches: [],
  suppliers: [],
  models: [],
  catalog: [],
  units: [],
  availability: [],
  supplies: [],
}

function gateway(
  loadWorkspace: StockGateway['loadWorkspace'],
): StockGateway {
  return {
    loadWorkspace,
    createUnits: vi.fn().mockResolvedValue(undefined),
    upsertAvailability: vi.fn().mockResolvedValue(undefined),
    transitionSupply: vi.fn().mockResolvedValue(undefined),
    receiveSupply: vi.fn().mockResolvedValue(undefined),
  }
}

beforeEach(() => {
  permissions.splice(
    0,
    permissions.length,
    'inventario.consultar',
    'inventario.gestionar',
    'catalogo.consultar',
  )
})

describe('contenedor de stock', () => {
  it('expone loading, carga datos y arma capacidades desde permisos', async () => {
    const loadWorkspace = vi.fn().mockResolvedValue(emptyData)
    render(
      <StockPage
        gateway={gateway(loadWorkspace)}
        vehicleType="MOTO"
      />,
    )

    expect(
      screen.getByText('Cargando stock y abastecimientos…'),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Stock de motos' }),
    ).toBeInTheDocument()
    expect(loadWorkspace).toHaveBeenCalledWith(
      'MOTO',
      expect.objectContaining({
        viewCatalog: true,
        viewAvailability: false,
        createUnits: true,
        manageSupply: false,
      }),
      undefined,
      expect.any(AbortSignal),
    )
  })

  it('muestra un error de red recuperable', async () => {
    render(
      <StockPage
        gateway={gateway(
          vi.fn().mockRejectedValue(new NetworkError()),
        )}
        vehicleType="AUTO"
      />,
    )

    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar el stock',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Revisá tu conexión/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument()
  })

  it('oculta vistas y acciones que no están autorizadas', async () => {
    permissions.splice(0, permissions.length, 'inventario.consultar')
    render(
      <StockPage
        gateway={gateway(vi.fn().mockResolvedValue(emptyData))}
        vehicleType="MOTO"
      />,
    )

    await screen.findByRole('heading', { name: 'Stock de motos' })
    expect(
      screen.queryByRole('tab', { name: 'Catálogo' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Proveedores' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Abastecimiento' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ingresar motos' }),
    ).not.toBeInTheDocument()
  })
})
