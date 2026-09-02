import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../shared/api/client'
import { App } from './App'

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

describe('rutas de autenticación', () => {
  it('expone primer acceso sin sesión e inicia el cambio de contraseña temporal', async () => {
    window.history.replaceState({}, '', '/primer-acceso')
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          statusCode: 403,
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Password change required',
          details: {
            organizationCode: 'LUMA',
            email: 'persona@lumamotos.com.ar',
            expiresAt: '2026-09-03T12:00:00.000Z',
          },
        },
        403,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Ingresá a tu cuenta' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/primer-acceso')

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'persona@lumamotos.com.ar' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'credencial-temporal' },
    })
    await user.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))

    expect(
      await screen.findByRole('heading', { name: 'Configurá tu contraseña' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/configurar-contrasena')
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('mantiene protegidas las rutas privadas para visitantes sin sesión', async () => {
    window.history.replaceState({}, '', '/clientes')

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })
})
