// Prepara una foto elegida en el celular (galería o cámara) para subirla:
// - La encuadra en 4:3 (1600 x 1200, el formato de las tarjetas del
//   catálogo) sobre fondo blanco. Con `crop` (el encuadre que eligió el
//   usuario) toma esa parte de la foto; sin él, la foto entera y centrada.
// - La guarda en WebP, que pesa bastante menos que JPEG. Safari (iPhone) no
//   sabe generar WebP: ahí queda en JPEG.

const FRAME_WIDTH = 1600
const FRAME_HEIGHT = 1200
const QUALITY = 0.82

export class PhotoUnreadableError extends Error {}

/** Parte de la foto a usar, en píxeles de la foto (puede salirse de ella). */
export type PhotoCropArea = { x: number; y: number; width: number; height: number }

/** Lee el tamaño de la foto; falla si el navegador no puede mostrarla. */
export async function readPhotoSize(file: File) {
  try {
    const image = await decode(file)
    return { width: image.width, height: image.height }
  } catch {
    throw new PhotoUnreadableError()
  }
}

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Algunos navegadores no lo soportan para ciertos formatos: se prueba
      // con una imagen común.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

export async function preparePhoto(file: File, crop?: PhotoCropArea): Promise<File> {
  let image: CanvasImageSource & { width: number; height: number }
  try {
    image = await decode(file)
  } catch {
    throw new PhotoUnreadableError()
  }
  const canvas = document.createElement('canvas')
  canvas.width = FRAME_WIDTH
  canvas.height = FRAME_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new PhotoUnreadableError()
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT)
  context.imageSmoothingQuality = 'high'
  if (crop && crop.width > 0 && crop.height > 0) {
    // La parte elegida ocupa todo el cuadro; lo que cae fuera de la foto
    // queda blanco.
    const scale = FRAME_WIDTH / crop.width
    context.drawImage(
      image,
      Math.round(-crop.x * scale),
      Math.round(-crop.y * scale),
      Math.round(image.width * scale),
      Math.round(image.height * scale),
    )
  } else {
    // Entera en el cuadro, sin agrandar fotos chicas.
    const scale = Math.min(1, FRAME_WIDTH / image.width, FRAME_HEIGHT / image.height)
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    context.drawImage(
      image,
      Math.round((FRAME_WIDTH - width) / 2),
      Math.round((FRAME_HEIGHT - height) / 2),
      width,
      height,
    )
  }
  // Si el navegador no genera WebP devuelve otro formato (PNG): se usa JPEG.
  let blob = await toBlob(canvas, 'image/webp')
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg')
  if (!blob) throw new PhotoUnreadableError()
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const name = `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.${extension}`
  return new File([blob], name, { type: blob.type })
}
