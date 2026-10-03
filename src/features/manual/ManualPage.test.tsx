import { render, screen } from '@testing-library/react'
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

  it('avisa cuando el perfil todavía no tiene manual', () => {
    mocks.role = { code: 'GERENTE', name: 'Gerente' }
    render(<ManualPage />)

    expect(
      screen.getByText('Todavía no hay un manual para tu perfil'),
    ).toBeInTheDocument()
    expect(screen.getByText(/perfil Gerente/)).toBeInTheDocument()
    expect(screen.queryByTitle(/Manual de uso/)).not.toBeInTheDocument()
  })
})
