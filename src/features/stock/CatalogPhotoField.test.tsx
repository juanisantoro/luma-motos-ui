import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogPhotoField } from './CatalogPhotoField'

function Harness({ onChange }: { onChange: (file: File | null) => void }) {
  const [value, setValue] = useState<File | null>(null)
  return (
    <CatalogPhotoField
      onChange={(file) => {
        setValue(file)
        onChange(file)
      }}
      value={value}
    />
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Foto al crear un modelo', () => {
  it('es opcional y se encuadra antes de quedar elegida', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 3000, height: 4000 }))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:foto')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) =>
      callback(new Blob(['x'], { type: type ?? '' })),
    )
    const onChange = vi.fn()
    const { container } = render(<Harness onChange={onChange} />)

    expect(screen.getByText('Foto (opcional)')).toBeInTheDocument()
    expect(screen.getByText('Sin foto')).toBeInTheDocument()

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'moto.jpg', { type: 'image/jpeg' })],
    })
    fireEvent.change(input)
    fireEvent.click(await screen.findByRole('button', { name: 'Usar esta foto' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(File)))
    expect(await screen.findByAltText('Foto del modelo nuevo')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByText('Sin foto')).toBeInTheDocument()
  })
})
