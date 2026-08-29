import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import type { AuthUser } from '../auth/types'

const authorizedUser: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@lumamotos.com.ar',
  name: 'Lucía Fernández',
  active: true,
  globalAccess: true,
  organization: {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'LUMA',
    name: 'Luma Motos',
    type: 'CASA_CENTRAL',
  },
  role: {
    id: 'role-admin',
    code: 'ADMINISTRADOR',
    name: 'Administrador',
    system: true,
    permissions: ['consultas_crediticias.consultar'],
  },
  branch: null,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('credit inquiries route', () => {
  it('expone ruta y menú sólo con el permiso real', async () => {
    window.history.replaceState({}, '', '/consultas-crediticias')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'credit-token')
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(authorizedUser))
      return Promise.resolve(
        jsonResponse({ items: [], total: 0, page: 1, limit: 100 }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Clientes en rojo' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Clientes en rojo/ }),
    ).toBeInTheDocument()
  })

  it('responde 403 y oculta el menú al navegar sin permiso', async () => {
    window.history.replaceState({}, '', '/consultas-crediticias')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'credit-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...authorizedUser,
          role: { ...authorizedUser.role, permissions: [] },
        }),
      ),
    )

    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: 'No tenés permiso para ingresar',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Clientes en rojo/ }),
    ).not.toBeInTheDocument()
  })
})
