import { afterEach, describe, expect, it, vi } from 'vitest'
import { PhotoUnreadableError, preparePhoto } from './photo'

function mockCanvas(outputType: string) {
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn(), imageSmoothingQuality: '' }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback, type) {
    callback(new Blob(['x'], { type: type === 'image/webp' ? outputType : (type ?? '') }))
  })
  return context
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Encuadre de fotos del catálogo', () => {
  it('centra una foto vertical entera en un cuadro 4:3 blanco y la pasa a WebP', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 3000, height: 4000 }))
    const context = mockCanvas('image/webp')

    const photo = await preparePhoto(new File(['x'], 'moto.jpeg', { type: 'image/jpeg' }))

    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1600, 1200)
    // 3000x4000 entra en 1200 de alto: 900 de ancho, centrada.
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 350, 0, 900, 1200)
    expect(photo.type).toBe('image/webp')
    expect(photo.name).toBe('moto.webp')
  })

  it('no agranda fotos chicas', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 600 }))
    const context = mockCanvas('image/webp')

    await preparePhoto(new File(['x'], 'chica.png', { type: 'image/png' }))

    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 400, 300, 800, 600)
  })

  it('usa JPEG cuando el navegador no genera WebP (iPhone)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1600, height: 1200 }))
    mockCanvas('image/png')

    const photo = await preparePhoto(new File(['x'], 'IMG_1.HEIC', { type: 'image/heic' }))

    expect(photo.type).toBe('image/jpeg')
    expect(photo.name).toBe('IMG_1.jpg')
  })

  it('avisa si no puede leer la foto', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no')))
    await expect(
      preparePhoto(new File(['x'], 'rara.xyz', { type: 'image/x-raro' })),
    ).rejects.toBeInstanceOf(PhotoUnreadableError)
  })
})

describe('Encuadre elegido por el usuario', () => {
  it('usa la parte elegida para llenar el cuadro', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000 }))
    const context = mockCanvas('image/webp')

    await preparePhoto(new File(['x'], 'moto.jpg', { type: 'image/jpeg' }), {
      x: 1000,
      y: 750,
      width: 2000,
      height: 1500,
    })

    // 2000 px de la foto ocupan los 1600 del cuadro: escala 0,8.
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), -800, -600, 3200, 2400)
  })
})
