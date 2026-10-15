import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogModelModal } from './CatalogModelModal'
import type { CatalogModel } from './types'

const model: CatalogModel = {
  id: 'v1',
  brandId: 'b1',
  modelId: 'm1',
  vehicleType: 'MOTO',
  brand: 'HERO',
  model: 'NEX 125',
  version: 'NEX 125',
  active: true,
  pricePolicy: null,
  photoUrl: null,
}

function renderModal(onUploadPhoto = vi.fn()) {
  const view = render(
    <CatalogModelModal
      canEditSharedCatalog
      canManageCost={false}
      error={null}
      model={model}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      onUploadPhoto={onUploadPhoto}
      submitting={false}
    />,
  )
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!
  return { input, onUploadPhoto }
}

describe('Foto del modelo', () => {
  it('deja elegir de la galería además de la cámara', () => {
    const { input } = renderModal()
    // Con `capture` el celular abre sólo la cámara.
    expect(input).not.toHaveAttribute('capture')
    expect(input).toHaveAttribute('accept', 'image/*')
  })

  it('avisa cuando no puede leer la foto', async () => {
    const { input, onUploadPhoto } = renderModal()
    const file = new File(['x'], 'foto.heic', { type: 'image/heic' })

    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change', { bubbles: true }))

    expect(
      await screen.findByText('No pudimos leer esa foto. Probá con otra o sacala con la cámara.'),
    ).toBeInTheDocument()
    expect(onUploadPhoto).not.toHaveBeenCalled()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })


  it('deja encuadrar la foto antes de subirla', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 3000, height: 4000 }))
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:foto'), revokeObjectURL: vi.fn() }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) =>
      callback(new Blob(['x'], { type: type ?? '' })),
    )
    const { input, onUploadPhoto } = renderModal()

    Object.defineProperty(input, 'files', { value: [new File(['x'], 'moto.jpg', { type: 'image/jpeg' })] })
    fireEvent.change(input)

    expect(await screen.findByRole('img', { name: 'Encuadre de la foto' })).toBeInTheDocument()
    // Mientras encuadra no se ve el formulario.
    expect(screen.queryByText('Guardar cambios')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta foto' }))

    await waitFor(() => expect(onUploadPhoto).toHaveBeenCalled())
    const photo = onUploadPhoto.mock.calls[0]![0] as File
    expect(photo.type).toBe('image/webp')
  })

  it('vuelve al formulario si cancela el encuadre', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 600 }))
    const { input, onUploadPhoto } = renderModal()

    Object.defineProperty(input, 'files', { value: [new File(['x'], 'moto.jpg', { type: 'image/jpeg' })] })
    fireEvent.change(input)
    await screen.findByRole('img', { name: 'Encuadre de la foto' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByText('Guardar cambios')).toBeInTheDocument()
    expect(onUploadPhoto).not.toHaveBeenCalled()
  })
})
