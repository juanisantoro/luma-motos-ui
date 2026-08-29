import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../shared/api/client'
import type { AuthUser, LoginResponse } from '../features/auth/types'
import type { Client, ClientListResponse } from '../features/clients/types'
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
    id: 'role-admin',
    code: 'ADMINISTRADOR',
    name: 'Administrador',
    system: true,
    permissions: [
      'clientes.consultar',
      'clientes.gestionar',
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

const client: Client = {
  id: 'e5ba3e66-d128-4238-b588-8daa74c30283',
  documentType: 'DNI',
  documentNumber: '12.345.678',
  fullName: 'Ana Cliente',
  phone: '11 5555-0000',
  email: 'ana@example.com',
  address: 'Av. Principal 123',
  notes: null,
  active: true,
  createdAt: '2026-08-20T12:00:00.000Z',
  updatedAt: '2026-08-28T15:30:00.000Z',
  organization: baseUser.organization,
}

function clientsResponse(items: Client[]): ClientListResponse {
  return { items, total: items.length, page: 1, limit: 20 }
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
  it('obliga a cambiar la contraseña temporal antes de entrar al layout', async () => {
    const fetchMock = mockFetch(
      jsonResponse(
        {
          statusCode: 403,
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Password change required',
          details: {
            organizationCode: 'LUMA',
            email: 'admin@lumamotos.com.ar',
            expiresAt: '2026-08-30T12:00:00.000Z',
          },
        },
        403,
      ),
      jsonResponse(undefined, 204),
      jsonResponse(loginResponse()),
    )
    const user = userEvent.setup()
    render(<App />)
    fireEvent.change(screen.getByLabelText('Organización'), {
      target: { value: 'LUMA' },
    })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'admin@lumamotos.com.ar' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'Temporal#2026' },
    })
    await user.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))

    expect(
      await screen.findByRole('heading', { name: 'Configurá tu contraseña' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /Buen día/ }),
    ).not.toBeInTheDocument()
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'NuevaClave#2026' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), {
      target: { value: 'NuevaClave#2026' },
    })
    await user.click(screen.getByRole('button', { name: 'Configurar contraseña' }))
    expect(
      await screen.findByText(
        'Contraseña configurada. Ya podés ingresar con tu nueva contraseña.',
      ),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Organización'), {
      target: { value: 'LUMA' },
    })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'admin@lumamotos.com.ar' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'NuevaClave#2026' },
    })
    await user.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
    expect(
      await screen.findByRole('heading', { name: 'Buen día, Lucía' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('informa la expiración temporal sin filtrar datos sensibles', async () => {
    mockFetch(
      jsonResponse(
        {
          statusCode: 403,
          code: 'TEMPORARY_PASSWORD_EXPIRED',
          message: 'Temporary password expired for internal user 13',
        },
        403,
      ),
    )
    const user = userEvent.setup()
    render(<App />)
    fireEvent.change(screen.getByLabelText('Organización'), {
      target: { value: 'LUMA' },
    })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'admin@lumamotos.com.ar' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'Temporal#2026' },
    })
    await user.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña temporal venció',
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('internal user 13')
  })

  it('inicia sesión contra el contrato real y conserva el token en la pestaña', async () => {
    const fetchMock = mockFetch(jsonResponse(loginResponse()))
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Organización'), ' luma_central ')
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
      organizationCode: 'LUMA_CENTRAL',
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

  it('lleva a roles desde el menú cuando sólo tiene permisos de roles', async () => {
    const rolesUser: AuthUser = {
      ...baseUser,
      role: {
        ...baseUser.role,
        permissions: ['roles.consultar'],
      },
    }
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'roles-token')
    mockFetch(jsonResponse(rolesUser))
    render(<App />)

    expect(
      await screen.findByRole('link', { name: /Usuarios y permisos/ }),
    ).toHaveAttribute('href', '/usuarios/roles')
  })

  it('expulsa una sesión revocada antes de permitir más navegación', async () => {
    const usersUser: AuthUser = {
      ...baseUser,
      role: {
        ...baseUser.role,
        permissions: ['usuarios.consultar'],
      },
    }
    window.history.replaceState({}, '', '/usuarios')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'revoked-token')
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse(usersUser))
      if (url.includes('/roles')) {
        return Promise.resolve(
          jsonResponse({ items: [], total: 0, page: 1, limit: 100 }),
        )
      }
      if (url.includes('/branches')) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(
        jsonResponse(
          { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'revoked' },
          401,
        ),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(
      await screen.findByText('Tu sesión venció. Ingresá nuevamente.'),
    ).toBeInTheDocument()
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
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

  it('bloquea la creación de usuarios sin usuarios.gestionar', async () => {
    const readOnlyUser: AuthUser = {
      ...baseUser,
      role: {
        ...baseUser.role,
        permissions: ['usuarios.consultar'],
      },
    }
    window.history.replaceState({}, '', '/usuarios/nuevo')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'read-only-token')
    mockFetch(jsonResponse(readOnlyUser))
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

describe('navegación de stock', () => {
  it('expone rutas separadas para motos y autos sólo con permiso real', async () => {
    const stockUser: AuthUser = {
      ...baseUser,
      role: {
        ...baseUser.role,
        permissions: ['inventario.consultar', 'catalogo.consultar'],
      },
    }
    const emptyPage = { items: [], total: 0, page: 1, limit: 100 }
    window.history.replaceState({}, '', '/stock/motos')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
    const fetchMock = mockFetch(
      jsonResponse(stockUser),
      jsonResponse(emptyPage),
      jsonResponse(emptyPage),
      jsonResponse([]),
      jsonResponse(emptyPage),
    )

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Stock de motos' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Stock de motos/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Stock de autos/ }),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.slice(1).map(([url]) => String(url)),
    ).toEqual([
      'http://localhost:3000/api/catalog/versions?vehicleType=MOTO&organizationId=30a522d2-93bb-46f5-b291-84dd96962576&active=true&page=1&limit=100',
      'http://localhost:3000/api/catalog/models?vehicleType=MOTO&organizationId=30a522d2-93bb-46f5-b291-84dd96962576&active=true&page=1&limit=100',
      'http://localhost:3000/api/inventory/branches?organizationId=30a522d2-93bb-46f5-b291-84dd96962576',
      'http://localhost:3000/api/inventory/units?vehicleType=MOTO&organizationId=30a522d2-93bb-46f5-b291-84dd96962576&page=1&limit=100',
    ])
  })

  describe('navegación de ventas', () => {
    it('consulta Mis operaciones con mine=true y oculta acciones sin permisos', async () => {
      const salesUser: AuthUser = {
        ...baseUser,
        role: {
          ...baseUser.role,
          permissions: ['ventas.consultar'],
        },
      }
      window.history.replaceState({}, '', '/mis-operaciones')
      sessionStorage.setItem(AUTH_TOKEN_KEY, 'sales-token')
      const fetchMock = mockFetch(
        jsonResponse(salesUser),
        jsonResponse({ items: [], total: 0, page: 1, limit: 20 }),
      )

      render(<App />)

      expect(
        await screen.findByRole('heading', { name: 'Mis operaciones' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /Nueva operación/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /Aprobaciones/ }),
      ).not.toBeInTheDocument()
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain('mine=true')
    })
  })

  it('bloquea la ruta directa de stock sin inventario.consultar', async () => {
    const restrictedUser: AuthUser = {
      ...baseUser,
      role: { ...baseUser.role, permissions: [] },
    }
    window.history.replaceState({}, '', '/stock/autos')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'stock-token')
    mockFetch(jsonResponse(restrictedUser))

    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: 'No tenés permiso para ingresar',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Stock de autos/ }),
    ).not.toBeInTheDocument()
  })
})

describe('gestión de clientes', () => {
  it('carga el listado real en tabla y respeta el permiso de gestión', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366,
    })
    window.history.replaceState({}, '', '/clientes')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'clients-token')
    const fetchMock = mockFetch(
      jsonResponse(baseUser),
      jsonResponse(clientsResponse([client])),
    )

    render(<App />)

    expect(await screen.findByText('Ana Cliente')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Nuevo cliente' }),
    ).toBeInTheDocument()
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://localhost:3000/api/clients?page=1&limit=20',
    )
  })

  it('presenta clientes como tarjetas en 393 px', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 393,
    })
    window.history.replaceState({}, '', '/clientes')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'clients-token')
    mockFetch(jsonResponse(baseUser), jsonResponse(clientsResponse([client])))

    render(<App />)

    expect(await screen.findByRole('article')).toHaveTextContent('Ana Cliente')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('expone estados vacío y error sin fallos silenciosos', async () => {
    window.history.replaceState({}, '', '/clientes')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'clients-token')
    mockFetch(jsonResponse(baseUser), jsonResponse(clientsResponse([])))

    const firstRender = render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'Todavía no hay clientes' }),
    ).toBeInTheDocument()
    firstRender.unmount()
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'clients-token')

    const failedFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(baseUser))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', failedFetch)
    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar los clientes',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/No pudimos conectar/)).toBeInTheDocument()
  })

  it('crea un cliente con el DTO definitivo y vuelve a cargar el listado', async () => {
    window.history.replaceState({}, '', '/clientes')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'clients-token')
    const fetchMock = mockFetch(
      jsonResponse(baseUser),
      jsonResponse(clientsResponse([])),
      jsonResponse(client, 201),
      jsonResponse(clientsResponse([client])),
    )
    const user = userEvent.setup()

    render(<App />)
    await screen.findByRole('heading', { name: 'Todavía no hay clientes' })
    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    await user.type(screen.getByLabelText('Nombre completo *'), 'Ana Cliente')
    await user.selectOptions(screen.getByLabelText('Tipo de documento'), 'DNI')
    await user.type(
      screen.getByLabelText('Número de documento'),
      '12.345.678',
    )
    await user.type(
      screen.getByLabelText('Correo electrónico'),
      'ana@example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    expect(await screen.findByText('Ana Cliente')).toBeInTheDocument()
    const [url, request] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/api/clients')
    expect(request.method).toBe('POST')
    expect(JSON.parse(String(request.body))).toEqual({
      fullName: 'Ana Cliente',
      documentType: 'DNI',
      documentNumber: '12.345.678',
      email: 'ana@example.com',
    })
  })

  it('activa y desactiva mediante el endpoint de estado', async () => {
    const inactiveClient = { ...client, active: false }
    window.history.replaceState({}, '', '/clientes')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'clients-token')
    const fetchMock = mockFetch(
      jsonResponse(baseUser),
      jsonResponse(clientsResponse([client])),
      jsonResponse(inactiveClient),
      jsonResponse(clientsResponse([inactiveClient])),
    )
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await user.click(
      await screen.findByRole('button', { name: 'Desactivar a Ana Cliente' }),
    )

    expect(
      await screen.findByRole('button', { name: 'Activar a Ana Cliente' }),
    ).toBeInTheDocument()
    const [url, request] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(url).toBe(
      `http://localhost:3000/api/clients/${client.id}/status`,
    )
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(String(request.body))).toEqual({ active: false })
  })

  it('oculta todas las mutaciones sin clientes.gestionar', async () => {
    const readOnlyUser: AuthUser = {
      ...baseUser,
      role: {
        ...baseUser.role,
        permissions: ['clientes.consultar'],
      },
    }
    window.history.replaceState({}, '', '/clientes')
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'clients-token')
    mockFetch(
      jsonResponse(readOnlyUser),
      jsonResponse(clientsResponse([client])),
    )

    render(<App />)
    await screen.findByText('Ana Cliente')

    expect(
      screen.queryByRole('button', { name: 'Nuevo cliente' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar a Ana Cliente' }),
    ).not.toBeInTheDocument()
  })
})
