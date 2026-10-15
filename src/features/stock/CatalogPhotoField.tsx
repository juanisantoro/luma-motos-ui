import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ChangeEvent } from 'react'
import { PhotoCropper, type PhotoCrop } from '../../shared/components/PhotoCropper'
import { PhotoUnreadableError, preparePhoto, readPhotoSize } from '../../shared/utils/photo'

// Foto opcional al crear un modelo: se elige (galería o cámara), se encuadra
// y queda lista para subirse cuando se guarda el alta.

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const UNREADABLE_PHOTO = 'No pudimos leer esa foto. Probá con otra o sacala con la cámara.'

type Cropping = { file: File; url: string; width: number; height: number }

export function CatalogPhotoField({
  value,
  onChange,
  disabled = false,
}: {
  value: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}) {
  const [cropping, setCropping] = useState<Cropping | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!cropping) return
    return () => URL.revokeObjectURL(cropping.url)
  }, [cropping])

  useEffect(() => {
    if (!value) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const select = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    try {
      const size = await readPhotoSize(file)
      setCropping({ file, url: URL.createObjectURL(file), ...size })
    } catch {
      setError(UNREADABLE_PHOTO)
    }
  }

  const confirm = async (crop: PhotoCrop) => {
    if (!cropping) return
    try {
      const photo = await preparePhoto(cropping.file, crop)
      if (photo.size > MAX_PHOTO_BYTES) {
        setError('La foto no puede superar los 5 MB.')
        return
      }
      onChange(photo)
      setCropping(null)
    } catch (caught) {
      setCropping(null)
      setError(
        caught instanceof PhotoUnreadableError
          ? UNREADABLE_PHOTO
          : 'No pudimos preparar la foto. Intentá nuevamente.',
      )
    }
  }

  return (
    <div className="field field--wide catalog-photo-field">
      <span>Foto (opcional)</span>
      {cropping ? (
        <PhotoCropper
          disabled={disabled}
          imageHeight={cropping.height}
          imageWidth={cropping.width}
          onCancel={() => setCropping(null)}
          onConfirm={(crop) => void confirm(crop)}
          src={cropping.url}
        />
      ) : (
        <div className="catalog-photo-uploader">
          {preview ? (
            <img alt="Foto del modelo nuevo" src={preview} />
          ) : (
            <div className="catalog-photo-uploader__placeholder">
              <ImagePlus size={22} aria-hidden="true" />
              <span>Sin foto</span>
            </div>
          )}
          <label className="button button--secondary">
            {value ? 'Cambiar foto' : 'Agregar foto'}
            <input
              accept="image/*"
              disabled={disabled}
              hidden
              onChange={(event) => void select(event)}
              type="file"
            />
          </label>
          {value && (
            <button
              className="button button--secondary"
              disabled={disabled}
              onClick={() => onChange(null)}
              type="button"
            >
              <Trash2 size={15} aria-hidden="true" /> Quitar
            </button>
          )}
        </div>
      )}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  )
}
