import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../shared/api/client'
import type { AuthUser, LoginResponse } from '../features/auth/types'
import { App } from './App'

const baseUser: AuthUser = {
  id: 'd28f4be8-869f-474d-b7a2-2370c5175ab5',
  email: 'admin@lumamotos.com.ar',
  name: 'Lucía Fernández',
  active: true,
  globalAccess: true,
  organization: {
    id: '30a522d2-93bb-46f5-b291-84dd96962576',
    code: 'LUMA',
    name: 'Luma Motos',
    type: 'CASA_CENTRAL',
  },
  role: {
    code: 'ADMINISTRADOR',
    name: 'Administrador',
    permissions: [
      'clientes.consultar',
      'usuarios.consultar',
      'auditoria.consultar',
    ],
  },
  branch: null,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn()
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function loginResponse(user = baseUser): LoginResponse {
  return {
    accessToken: 'signed-access-token',
    tokenType: 'Bearer',
    idleTimeoutSeconds: 3600,
    user,
  }
}

afterEach(() => {
  window.history.replaceState({}, '', '/')
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1024,
  })
  vi.unstubAllGlobals()
})

describe('autenticación y autorización', () => {
  it('inicia sesión contra el contrato real y conserva el token en la pestaña', async () => {
    const fetchMock = mockFetch(jsonResponse(loginResponse()))
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Organización'), ' luma ')
    await user.type(
      screen.getByLabelText('Correo electrónico'),
      ' ADMIN@LUMAMOTOS.COM.AR ',
    )
    await user.type(screen.getByLabelText('Contraseña'), 'clave-segura')
    await user.click(
      screen.getByRole('button', { name: 'Ingresar al sistema' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Buen día, Lucía' }),
    ).toBeInTheDocument()
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBe('signed-access-token')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/api/auth/login')
    expect(JSON.parse(String(request.body))).toEqual({
      organizationCode: 'LUMA',
      email: 'admin@lumamotos.com.ar',
      password: 'clave-segura',
    })
  })

  it('muestra credenciales inválidas sin revelar la causa del 401', async () => {
    mockFetch(
      jsonResponse(
        {
          statusCode: 401,
          message: 'Invalid email or password',
          error: 'Unauthorized',
        },
        401,
      ),
    )
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Organización'), 'LUMA')
    await user.type(
      screen.getByLabelText('Correo electrónico'),
      'persona@lumamotos.com.ar',
    )
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta')
    await user.click(
      screen.getByRole('button', { name: 'Ingresar al sistema' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Los datos ingresados no son válidos.',
    )
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('muestra errores de red en el login', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Organización'), 'LUMA')
    await user.type(
      screen.getByLabelText('Correo electrónico'),
      'persona@lumamotos.com.ar',
    )
    await user.type(screen.getByLabelText('Contraseña'), 'clave-segura')
    await user.click(
      screen.getByRole('button', { name: 'Ingresar al sistema' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servidor.',
    )
  })

  it('restaura la sesión y arma la navegación con permisos del backend', async () => {
    const restrictedUser: AuthUser = {
      ...baseUser,
      role: {
        ...baseUser.role,
        permissions: ['usuarios.consultar'],
      },
    }
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'persisted-token')
    const fetchMock = mockFetch(jsonResponse(restrictedUser))

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Buen día, Lucía' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Usuarios/ })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Clientes/ }),
    ).not.toBeInTheDocument()

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(request.headers).get('Authorization')).toBe(
      'Bearer persisted-token',
    )
  })

  it('expone un 403 claro si se navega directo sin permiso', async () => {
    const restrictedUser: AuthUser = {
      ...baseUser,
      role: { ...baseUser.role, permissions: [] },
    }
    window.history.replaceState({}, '', '/clientes')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'persisted-token')
    mockFetch(jsonResponse(restrictedUser))

    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: 'No tenés permiso para ingresar',
      }),
    ).toBeInTheDocument()
  })

  it('descarta una sesión vencida durante la restauración', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'expired-token')
    mockFetch(
      jsonResponse(
        { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' },
        401,
      ),
    )

    render(<App />)

    expect(
      await screen.findByText('Tu sesión venció. Ingresá nuevamente.'),
    ).toBeInTheDocument()
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('borra el token local aunque el logout remoto falle', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'persisted-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(baseUser))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await user.click(
      await screen.findByRole('button', { name: 'Cerrar sesión' }),
    )

    expect(
      await screen.findByText(
        'La sesión se cerró en este dispositivo, pero no se pudo contactar al servidor.',
      ),
    ).toBeInTheDocument()
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })
})

describe('navegación responsive', () => {
  it('abre el drawer móvil y permite cerrarlo con Escape', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 393,
    })
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'mobile-token')
    mockFetch(jsonResponse(baseUser))
    const user = userEvent.setup()

    render(<App />)

    const menu = await screen.findByRole('button', { name: 'Abrir menú' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')

    await user.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    const closeButtons = screen.getAllByRole('button', { name: 'Cerrar menú' })
    expect(closeButtons).toHaveLength(2)
    expect(closeButtons[1]).toHaveFocus()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(menu).toHaveAttribute('aria-expanded', 'false'))
    expect(menu).toHaveFocus()
  })
})
