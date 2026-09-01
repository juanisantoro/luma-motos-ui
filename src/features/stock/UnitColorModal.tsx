import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { listUnitColors } from './api'
import { UNIT_FINISHES } from './colors'
import type { PhysicalUnit } from './types'

type UnitColorModalProps = {
  unit: PhysicalUnit
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: { color: string | null; acabado: string | null }) => void
}

export function UnitColorModal({
  unit,
  submitting,
  error,
  onClose,
  onSubmit,
}: UnitColorModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [color, setColor] = useState(unit.color ?? '')
  const [acabado, setAcabado] = useState(unit.acabado ?? '')
  const [colorOptions, setColorOptions] = useState<
    { id: string; name: string }[]
  >([])
  const [colorsLoading, setColorsLoading] = useState(true)
  const [colorsError, setColorsError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setColorsLoading(true)
    setColorsError(false)
    listUnitColors(controller.signal)
      .then((options) => {
        if (controller.signal.aborted) return
        setColorOptions(options)
        setColorsLoading(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setColorsError(true)
        setColorsLoading(false)
      })
    return () => controller.abort()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit({ color: color || null, acabado: acabado || null })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="unit-color-modal-title"
        aria-modal="true"
        className="stock-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">STOCK FÍSICO</p>
            <h2 id="unit-color-modal-title">Color y acabado de la unidad</h2>
            <p>{unit.vin}</p>
          </div>
          <button
            aria-label="Cerrar edición de color"
            className="icon-button"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}
        {colorsError && (
          <div className="form-alert form-alert--error" role="alert">
            No pudimos cargar la lista de colores. Probá cerrar y volver a
            abrir este diálogo.
          </div>
        )}

        <form onSubmit={submit}>
          <div className="stock-form-grid">
            <label className="field">
              <span>Color</span>
              <select
                autoFocus
                disabled={colorsLoading}
                onChange={(event) => setColor(event.target.value)}
                value={color}
              >
                <option value="">
                  {colorsLoading ? 'Cargando…' : 'Sin especificar'}
                </option>
                {colorOptions.map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Acabado</span>
              <select
                onChange={(event) => setAcabado(event.target.value)}
                value={acabado}
              >
                <option value="">Sin especificar</option>
                {UNIT_FINISHES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <footer className="stock-modal__actions">
            <button
              className="button button--secondary"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={submitting}
              type="submit"
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Guardando…' : 'Guardar color y acabado'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
