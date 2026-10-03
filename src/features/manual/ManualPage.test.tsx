import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ManualPage } from './ManualPage'

const mocks = vi.hoisted(() => ({
  role: { code: 'ADMINISTRATIVA', name: 'Administrativa' },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Lucía', role: { ...mocks.role, permissions: [] } },
  }),
}))

beforeEach(() => {
  mocks.role = { code: 'ADMINISTRATIVA', name: 'Administrativa' }
})

describe('Manual de uso por perfil', () => {
  it('muestra el manual del rol del usuario', async () => {
    render(<ManualPage />)

    const frame = await screen.findByTitle('Manual de uso · Administrativa')
    expect(frame.tagName).toBe('IFRAME')
    const html = frame.getAttribute('srcdoc') ?? ''
    expect(html).toContain('Manual de la Administrativa')
    // Documento autónomo y en tema claro, sin scripts.
    expect(html).toContain('data-theme="light"')
    expect(html).not.toContain('<script')
  })

  it('al vendedor le muestra sólo el manual del vendedor', async () => {
    mocks.role = { code: 'VENDEDOR', name: 'Vendedor' }
    render(<ManualPage />)

    const frame = await screen.findByTitle('Manual de uso · Vendedor')
    const html = frame.getAttribute('srcdoc') ?? ''
    expect(html).toContain('Manual del Vendedor')
    expect(html).not.toContain('Manual de la Administrativa')
  })

  it('al gerente y al call center les muestra su propio manual', async () => {
    mocks.role = { code: 'GERENTE', name: 'Gerente' }
    const { unmount } = render(<ManualPage />)

    const manager = await screen.findByTitle('Manual de uso · Gerente')
    const managerHtml = manager.getAttribute('srcdoc') ?? ''
    expect(managerHtml).toContain('Manual del Gerente')
    expect(managerHtml).toContain('Aprobaciones')
    expect(managerHtml).not.toContain('<script')
    unmount()

    mocks.role = { code: 'CALLCENTER', name: 'Call Center' }
    render(<ManualPage />)

    const callCenter = await screen.findByTitle('Manual de uso · Call Center')
    const callCenterHtml = callCenter.getAttribute('srcdoc') ?? ''
    expect(callCenterHtml).toContain('Manual de Call Center')
    expect(callCenterHtml).not.toContain('Manual del Vendedor')
  })

  it('al administrador le muestra su manual y los de todos los perfiles', async () => {
    mocks.role = { code: 'ADMINISTRADOR', name: 'Administrador' }
    const user = userEvent.setup()
    render(<ManualPage />)

    const own = await screen.findByTitle('Manual de uso · Administrador')
    expect(own.getAttribute('srcdoc')).toContain('Manual del Administrador')
    expect(
      screen.getAllByRole('tab').map((tab) => tab.textContent),
    ).toEqual(['Administrador', 'Gerente', 'Administrativa', 'Vendedor', 'Call Center'])
    expect(screen.getByRole('tab', { name: 'Administrador' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.click(screen.getByRole('tab', { name: 'Vendedor' }))
    const seller = await screen.findByTitle('Manual de uso · Vendedor')
    expect(seller.getAttribute('srcdoc')).toContain('Manual del Vendedor')
  })

  it('los demás perfiles no ven solapas de otros manuales', async () => {
    render(<ManualPage />)

    await screen.findByTitle('Manual de uso · Administrativa')
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('avisa cuando el perfil todavía no tiene manual', () => {
    mocks.role = { code: 'ROL_PROPIO', name: 'Encargado' }
    render(<ManualPage />)

    expect(
      screen.getByText('Todavía no hay un manual para tu perfil'),
    ).toBeInTheDocument()
    expect(screen.getByText(/perfil Encargado/)).toBeInTheDocument()
    expect(screen.queryByTitle(/Manual de uso/)).not.toBeInTheDocument()
  })
})
