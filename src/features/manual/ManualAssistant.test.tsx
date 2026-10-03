import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { ManualAssistant } from './ManualAssistant'

const mocks = vi.hoisted(() => ({
  askAssistant: vi.fn(),
  role: { code: 'ADMINISTRATIVA', name: 'Administrativa' },
}))

vi.mock('./api', () => ({ askAssistant: mocks.askAssistant }))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Lucía Pérez',
      role: { ...mocks.role, permissions: [] },
    },
  }),
}))

beforeEach(() => {
  mocks.askAssistant.mockReset()
  mocks.role = { code: 'ADMINISTRATIVA', name: 'Administrativa' }
})

async function openLumi() {
  const user = userEvent.setup()
  render(<ManualAssistant />)
  await user.click(
    screen.getByRole('button', { name: 'Abrir Lumi, asistente virtual' }),
  )
  return user
}

describe('Lumi, asistente virtual', () => {
  it('arranca cerrado y al abrir saluda por el nombre', async () => {
    render(<ManualAssistant />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'Abrir Lumi, asistente virtual' }),
    )

    expect(
      screen.getByRole('dialog', { name: 'Lumi, asistente virtual' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Hola Lucía, soy Lumi\./)).toBeInTheDocument()
    expect(screen.getByLabelText('Tu pregunta para Lumi')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('pregunta y muestra la respuesta, mandando la conversación previa', async () => {
    mocks.askAssistant
      .mockResolvedValueOnce({ answer: 'Andá a Ventas → Operaciones.', covered: true })
      .mockResolvedValueOnce({ answer: 'Tocá Gestionar.', covered: true })
    const user = await openLumi()

    const input = screen.getByLabelText('Tu pregunta para Lumi')
    const send = screen.getByRole('button', { name: 'Enviar pregunta' })
    expect(send).toBeDisabled()

    await user.type(input, '¿Dónde cargo la patente?')
    await user.click(send)

    expect(await screen.findByText('Andá a Ventas → Operaciones.')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(mocks.askAssistant).toHaveBeenLastCalledWith('¿Dónde cargo la patente?', [])

    await user.type(input, '¿Y después?')
    await user.click(send)

    expect(await screen.findByText('Tocá Gestionar.')).toBeInTheDocument()
    expect(mocks.askAssistant).toHaveBeenLastCalledWith('¿Y después?', [
      { role: 'user', content: '¿Dónde cargo la patente?' },
      { role: 'assistant', content: 'Andá a Ventas → Operaciones.' },
    ])
  })

  it('las sugerencias preguntan con un toque y después se ocultan', async () => {
    mocks.askAssistant.mockResolvedValueOnce({ answer: 'En Gastos generales.', covered: true })
    const user = await openLumi()

    await user.click(screen.getByRole('button', { name: '¿Cómo cargo un gasto?' }))

    expect(await screen.findByText('En Gastos generales.')).toBeInTheDocument()
    expect(mocks.askAssistant).toHaveBeenCalledWith('¿Cómo cargo un gasto?', [])
    expect(
      screen.queryByRole('button', { name: '¿Cómo cargo un gasto?' }),
    ).not.toBeInTheDocument()
  })

  it('si falla, avisa y deja la pregunta para reintentar', async () => {
    mocks.askAssistant.mockRejectedValueOnce(
      new ApiError(503, 'not configured', { code: 'ASSISTANT_NOT_CONFIGURED' }),
    )
    const user = await openLumi()

    const input = screen.getByLabelText('Tu pregunta para Lumi')
    await user.type(input, '¿Cómo cargo un gasto nuevo?')
    await user.click(screen.getByRole('button', { name: 'Enviar pregunta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lumi todavía no está habilitado',
    )
    expect(input).toHaveValue('¿Cómo cargo un gasto nuevo?')
  })

  it('el administrador lo tiene aunque no tenga manual propio', () => {
    mocks.role = { code: 'ADMINISTRADOR', name: 'Administrador' }
    render(<ManualAssistant />)

    expect(
      screen.getByRole('button', { name: 'Abrir Lumi, asistente virtual' }),
    ).toBeInTheDocument()
  })

  it('no aparece para un perfil sin manual', () => {
    mocks.role = { code: 'GERENTE', name: 'Gerente' }
    const { container } = render(<ManualAssistant />)

    expect(container).toBeEmptyDOMElement()
  })
})
