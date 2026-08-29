import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { RoleFormPage } from './RoleFormPage'
import { RoleDetailPage } from './RoleDetailPage'
import { RolesPage } from './RolesPage'
import { UserFormPage } from './UserFormPage'
import { UsersPage } from './UsersPage'
import { accessErrorMessage } from './errors'
import type {
  AccessGateway,
  ManagedRole,
  ManagedUser,
  PermissionGroup,
} from './types'

const authMock = vi.hoisted(() => ({
  permissions: [
    'usuarios.consultar',
    'usuarios.gestionar',
    'roles.consultar',
    'roles.gestionar',
  ],
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      organization: { id: 'org-1', code: 'LUMA', name: 'Luma Motos' },
      role: { permissions: authMock.permissions },
    },
  }),
}))

const permissions: PermissionGroup[] = [
  {
    module: 'usuarios',
    label: 'Usuarios',
    permissions: [
      { code: 'usuarios.consultar', description: 'Consultar usuarios' },
      { code: 'usuarios.gestionar', description: 'Gestionar usuarios' },
    ],
  },
  {
    module: 'roles',
    label: 'Roles',
    permissions: [
      { code: 'roles.consultar', description: 'Consultar roles' },
      { code: 'roles.gestionar', description: 'Gestionar roles' },
    ],
  },
]

const role: ManagedRole = {
  id: 'role-1',
  code: 'VENDEDOR',
  name: 'Vendedor',
  description: 'Ventas',
  permissions: [
    {
      code: 'usuarios.consultar',
      module: 'usuarios',
      description: 'Consultar usuarios',
    },
  ],
  userCount: 1,
  active: true,
  system: false,
  version: 2,
  organization: {
    id: 'org-1',
    code: 'LUMA',
    name: 'Luma Motos',
    type: 'CASA_CENTRAL',
  },
  actions: { canEdit: true, canChangeStatus: true, canClone: true },
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
}

const managedUser: ManagedUser = {
  id: 'user-1',
  email: 'ana@luma.test',
  active: true,
  globalAccess: false,
  passwordChangeRequired: true,
  temporaryPasswordExpiresAt: '2026-08-21T10:00:00.000Z',
  organization: {
    id: 'org-1',
    code: 'LUMA',
    name: 'Luma Motos',
    type: 'CASA_CENTRAL',
    active: true,
  },
  branch: {
    id: 'branch-1',
    code: 'SM',
    name: 'San Miguel',
    organizationId: 'org-1',
  },
  role: {
    id: role.id,
    code: role.code,
    name: role.name,
    system: false,
    active: true,
    version: 2,
    permissions: ['usuarios.consultar'],
  },
  personnel: {
    id: 'person-1',
    employeeCode: 'E-1',
    fullName: 'Ana Gómez',
    phone: '1155550000',
    canSignIn: true,
    status: 'ACTIVO',
  },
  invitation: {
    status: 'DELIVERED',
    sentAt: '2026-08-20T10:00:00.000Z',
    lastAttemptAt: '2026-08-20T10:00:00.000Z',
    expiresAt: '2026-08-21T10:00:00.000Z',
    acceptedAt: null,
  },
  lastLoginAt: null,
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
}

function gateway(): AccessGateway {
  return {
    listUsers: vi.fn().mockResolvedValue({
      items: [managedUser],
      total: 1,
      page: 1,
      limit: 20,
    }),
    getUser: vi.fn().mockResolvedValue(managedUser),
    createUser: vi.fn().mockResolvedValue({
      user: managedUser,
      delivery: {
        status: 'DELIVERED',
        expiresAt: '2026-08-21T10:00:00.000Z',
      },
    }),
    updateUserAccess: vi.fn().mockResolvedValue({
      user: { ...managedUser, globalAccess: true },
      revokedSessions: 2,
    }),
    updateUserStatus: vi.fn().mockResolvedValue({
      user: { ...managedUser, active: false },
      revokedSessions: 1,
    }),
    resendUserInvitation: vi.fn().mockResolvedValue({
      user: managedUser,
      delivery: {
        status: 'DELIVERED',
        expiresAt: '2026-08-21T10:00:00.000Z',
      },
    }),
    listRoles: vi.fn().mockResolvedValue({
      items: [role],
      total: 1,
      page: 1,
      limit: 100,
    }),
    getRole: vi.fn().mockResolvedValue(role),
    createRole: vi.fn().mockResolvedValue(role),
    updateRole: vi.fn().mockResolvedValue({ role, revokedSessions: 0 }),
    updateRoleStatus: vi.fn().mockResolvedValue({ ...role, active: false }),
    cloneRole: vi.fn().mockResolvedValue({ ...role, id: 'role-2', name: 'Copia' }),
    listPermissions: vi.fn().mockResolvedValue(permissions),
    listBranches: vi
      .fn()
      .mockResolvedValue([
        {
          id: 'branch-1',
          code: 'SM',
          name: 'San Miguel',
          organizationId: 'org-1',
        },
      ]),
  }
}

function renderRoute(
  path: string,
  element: React.ReactNode,
  routePattern = path,
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePattern} element={element} />
        <Route path="/usuarios/roles/:id" element={<p>Rol guardado</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  authMock.permissions = [
    'usuarios.consultar',
    'usuarios.gestionar',
    'roles.consultar',
    'roles.gestionar',
  ]
})

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1024,
  })
})

describe('gestión de usuarios', () => {
  it('crea sin campo de contraseña y confirma el email', async () => {
    const api = gateway()
    const user = userEvent.setup()
    renderRoute('/usuarios/nuevo', <UserFormPage gateway={api} />)

    expect(
      await screen.findByText('Se enviará una contraseña temporal por email'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Nombre *'), 'Ana')
    await user.type(screen.getByLabelText('Apellido *'), 'Gómez')
    await user.type(screen.getByLabelText('Correo electrónico *'), 'ANA@LUMA.TEST')
    await user.selectOptions(screen.getByLabelText('Rol *'), 'VENDEDOR')
    await user.selectOptions(screen.getByLabelText('Sucursal'), 'branch-1')
    await user.click(screen.getByRole('button', { name: 'Crear y enviar invitación' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Usuario creado e invitación enviada',
      }),
    ).toBeInTheDocument()
    expect(api.createUser).toHaveBeenCalledWith({
      fullName: 'Ana Gómez',
      email: 'ana@luma.test',
      organizationId: 'org-1',
      branchId: 'branch-1',
      roleCode: 'VENDEDOR',
    })
  })

  it('muestra el error real de entrega sin revelar secretos', async () => {
    const api = gateway()
    vi.mocked(api.createUser).mockRejectedValue(
      new ApiError(502, 'mail failed', {
        code: 'INVITATION_DELIVERY_FAILED',
      }),
    )
    const user = userEvent.setup()
    renderRoute('/usuarios/nuevo', <UserFormPage gateway={api} />)
    await screen.findByText('Se enviará una contraseña temporal por email')
    await user.type(screen.getByLabelText('Nombre *'), 'Ana')
    await user.type(screen.getByLabelText('Apellido *'), 'Gómez')
    await user.type(screen.getByLabelText('Correo electrónico *'), 'ana@luma.test')
    await user.selectOptions(screen.getByLabelText('Rol *'), 'VENDEDOR')
    await user.click(screen.getByRole('button', { name: 'Crear y enviar invitación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'no se pudo entregar la invitación',
    )
    expect(screen.queryByText(/mail failed/i)).not.toBeInTheDocument()
  })

  it('envía filtros, reenvía invitaciones y refleja sesiones revocadas', async () => {
    const api = gateway()
    const user = userEvent.setup()
    const listRender = renderRoute('/usuarios', <UsersPage gateway={api} />)
    await screen.findByText('Ana Gómez')
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'false')
    await waitFor(() =>
      expect(api.listUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: false }),
        expect.any(AbortSignal),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Reenviar invitación a Ana Gómez' }))
    await user.click(screen.getByRole('button', { name: 'Reenviar invitación' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'se envió nuevamente',
    )

    listRender.unmount()
    renderRoute(
      '/usuarios/user-1/editar',
      <UserFormPage gateway={api} />,
      '/usuarios/:id/editar',
    )
    await screen.findByText('ana@luma.test')
    await user.click(
      screen.getByRole('checkbox', {
        name: /Acceso a toda la organización/,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Guardar acceso' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se cerraron 2 sesiones activas',
    )
  })

  it('presenta tarjetas de usuarios en 393 px', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 393,
    })
    const api = gateway()
    renderRoute('/usuarios', <UsersPage gateway={api} />)

    expect(await screen.findByRole('article')).toHaveTextContent('Ana Gómez')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('reasigna el rol y presenta la protección del último administrador', async () => {
    const api = gateway()
    const administrator = {
      ...role,
      id: 'role-admin',
      code: 'ADMINISTRADOR',
      name: 'Administrador',
    }
    vi.mocked(api.listRoles).mockResolvedValue({
      items: [role, administrator],
      total: 2,
      page: 1,
      limit: 100,
    })
    const user = userEvent.setup()
    renderRoute(
      '/usuarios/user-1/editar',
      <UserFormPage gateway={api} />,
      '/usuarios/:id/editar',
    )
    await screen.findByText('ana@luma.test')
    await user.selectOptions(screen.getByLabelText('Rol *'), 'ADMINISTRADOR')
    await user.click(screen.getByRole('button', { name: 'Guardar acceso' }))

    expect(api.updateUserAccess).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ roleCode: 'ADMINISTRADOR' }),
    )
    expect(
      accessErrorMessage(
        new ApiError(409, 'last admin internal detail', {
          code: 'LAST_ACTIVE_ADMIN',
        }),
      ),
    ).toBe(
      'La acción dejaría a la organización sin un administrador activo.',
    )
  })
})

describe('gestión de roles', () => {
  it('no consulta usuarios asignados sin usuarios.consultar', async () => {
    authMock.permissions = ['roles.consultar']
    const api = gateway()
    renderRoute(
      '/usuarios/roles/role-1',
      <RoleDetailPage gateway={api} />,
      '/usuarios/roles/:id',
    )

    expect(
      await screen.findByRole('heading', { name: 'Vendedor' }),
    ).toBeInTheDocument()
    expect(api.listUsers).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: 'Usuarios asignados' }),
    ).not.toBeInTheDocument()
  })

  it('crea un rol sólo con permisos del catálogo', async () => {
    const api = gateway()
    const user = userEvent.setup()
    renderRoute(
      '/usuarios/roles/nuevo',
      <RoleFormPage gateway={api} />,
      '/usuarios/roles/nuevo',
    )
    await screen.findByRole('heading', { name: 'Permisos' })
    await user.type(screen.getByLabelText('Nombre *'), 'Supervisor')
    await user.type(screen.getByLabelText('Descripción *'), 'Supervisión comercial')
    await user.click(screen.getByLabelText(/usuarios.gestionar/))
    await user.click(screen.getByRole('button', { name: 'Guardar rol' }))

    expect(api.createRole).toHaveBeenCalledWith({
      name: 'Supervisor',
      description: 'Supervisión comercial',
      permissionCodes: ['usuarios.gestionar'],
    })
  })

  it('presenta permiso inválido y protege el estado de roles base', async () => {
    const api = gateway()
    vi.mocked(api.createRole).mockRejectedValue(
      new ApiError(400, 'invalid', { code: 'INVALID_PERMISSION_CODES' }),
    )
    const user = userEvent.setup()
    const formRender = renderRoute(
      '/usuarios/roles/nuevo',
      <RoleFormPage gateway={api} />,
      '/usuarios/roles/nuevo',
    )
    await screen.findByRole('heading', { name: 'Permisos' })
    await user.type(screen.getByLabelText('Nombre *'), 'Supervisor')
    await user.type(screen.getByLabelText('Descripción *'), 'Supervisión')
    await user.click(screen.getByRole('button', { name: 'Guardar rol' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'permisos que ya no existen',
    )

    formRender.unmount()
    const systemApi = gateway()
    vi.mocked(systemApi.listRoles).mockResolvedValue({
      items: [
        {
          ...role,
          system: true,
          name: 'Administrador',
          actions: {
            canEdit: true,
            canChangeStatus: false,
            canClone: true,
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    renderRoute('/usuarios/roles', <RolesPage gateway={systemApi} />)
    await screen.findByText('Administrador')
    expect(
      screen.queryByRole('button', { name: 'Desactivar rol Administrador' }),
    ).not.toBeInTheDocument()
  })
})
