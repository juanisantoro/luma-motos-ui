import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_KEY } from '../../shared/api/client'
import { accessApiGateway } from './api'

function json(body: unknown, status = 200) {
  return new Response(status === 204 ? undefined : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('contrato API de usuarios y roles', () => {
  it('crea usuarios sin contraseña y conserva la confirmación de entrega', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'token')
    const response = {
      user: { id: 'user-1' },
      delivery: {
        status: 'DELIVERED',
        expiresAt: '2026-08-30T12:00:00.000Z',
      },
    }
    const fetchMock = vi.fn().mockResolvedValue(json(response, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await accessApiGateway.createUser({
      fullName: 'Ana Gómez',
      email: 'ana@luma.test',
      organizationId: 'org-1',
      branchId: 'branch-1',
      roleCode: 'VENDEDOR',
    })

    expect(result.delivery.status).toBe('DELIVERED')
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/api/users')
    expect(JSON.parse(String(request.body))).toEqual({
      fullName: 'Ana Gómez',
      email: 'ana@luma.test',
      organizationId: 'org-1',
      branchId: 'branch-1',
      roleCode: 'VENDEDOR',
    })
    expect(String(request.body)).not.toContain('password')
  })

  it('serializa filtros, asignación, reenvío y control de versión', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ items: [], total: 0, page: 1, limit: 20 }))
      .mockResolvedValueOnce(json({ user: {}, revokedSessions: 2 }))
      .mockResolvedValueOnce(json({ user: {}, delivery: { status: 'DELIVERED' } }))
      .mockResolvedValueOnce(json({ id: 'role-1', version: 4 }))
    vi.stubGlobal('fetch', fetchMock)

    await accessApiGateway.listUsers({
      page: 2,
      limit: 20,
      search: 'ana',
      branchId: 'branch-1',
      roleCode: 'VENDEDOR',
      active: false,
      invitationStatus: 'FAILED',
    })
    await accessApiGateway.updateUserAccess('user-1', {
      roleCode: 'ADMINISTRADOR',
      globalAccess: true,
      branchId: null,
    })
    await accessApiGateway.resendUserInvitation('user-1')
    await accessApiGateway.updateRole('role-1', {
      name: 'Supervisión',
      description: 'Control comercial',
      permissionCodes: ['usuarios.consultar'],
      version: 3,
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'invitationStatus=FAILED',
    )
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://localhost:3000/api/users/user-1/access',
    )
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'http://localhost:3000/api/users/user-1/invitation/resend',
    )
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({
      name: 'Supervisión',
      description: 'Control comercial',
      permissionCodes: ['usuarios.consultar'],
      version: 3,
    })
  })
})
