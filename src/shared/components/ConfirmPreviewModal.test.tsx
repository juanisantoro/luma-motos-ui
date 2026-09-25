import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmPreviewModal } from './ConfirmPreviewModal'

const sections = [
  {
    title: 'Cliente',
    rows: [
      { label: 'Nombre', value: 'Ana Cliente' },
      { label: 'Teléfono', value: '' },
    ],
  },
  {
    title: 'Precio',
    rows: [{ label: 'Precio acordado', value: '$ 100', emphasis: true }],
  },
  { title: 'Vacía', rows: [] },
]

function renderModal(overrides: Partial<Parameters<typeof ConfirmPreviewModal>[0]> = {}) {
  const onConfirm = vi.fn()
  const onBack = vi.fn()
  render(
    <ConfirmPreviewModal
      onBack={onBack}
      onConfirm={onConfirm}
      sections={sections}
      title="Confirmá el alta"
      {...overrides}
    />,
  )
  return { onConfirm, onBack }
}

describe('ConfirmPreviewModal', () => {
  it('muestra secciones y filas sin conocer la entidad', () => {
    renderModal({ description: 'Revisá antes de guardar.' })
    const dialog = screen.getByRole('dialog', { name: 'Confirmá el alta' })
    expect(dialog).toHaveAccessibleDescription('Revisá antes de guardar.')
    const client = within(dialog).getByRole('region', { name: 'Cliente' })
    expect(within(client).getByText('Ana Cliente')).toBeInTheDocument()
    // Valores vacíos se muestran como guion, no como celda en blanco.
    expect(within(client).getByText('—')).toBeInTheDocument()
    expect(
      within(dialog).getByText('$ 100').closest('.confirm-preview__row'),
    ).toHaveClass('confirm-preview__row--emphasis')
    expect(
      within(dialog).queryByRole('region', { name: 'Vacía' }),
    ).not.toBeInTheDocument()
  })

  it('confirma o vuelve con los callbacks recibidos', async () => {
    const user = userEvent.setup()
    const { onConfirm, onBack } = renderModal({
      confirmLabel: 'Guardar',
      backLabel: 'Seguir editando',
    })
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('vuelve con Escape', async () => {
    const user = userEvent.setup()
    const { onBack } = renderModal()
    await user.keyboard('{Escape}')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('deshabilita botones y Escape con busy', async () => {
    const user = userEvent.setup()
    const { onBack } = renderModal({ busy: true })
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onBack).not.toHaveBeenCalled()
  })
})
