import type { ReactNode } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { useDialogFocus } from '../hooks/useDialogFocus'

export type ConfirmPreviewRow = {
  label: string
  value: ReactNode
  // Resalta la fila (por ejemplo, un precio debajo de lista).
  emphasis?: boolean
}

export type ConfirmPreviewSection = {
  title: string
  rows: ConfirmPreviewRow[]
}

type ConfirmPreviewModalProps = {
  title: string
  description?: string
  eyebrow?: string
  sections: ConfirmPreviewSection[]
  confirmLabel?: string
  backLabel?: string
  busy?: boolean
  onConfirm: () => void
  onBack: () => void
}

function isEmpty(value: ReactNode) {
  return value === null || value === undefined || value === ''
}

// Paso de confirmación genérico: muestra lo que se va a persistir y recién
// "Confirmar" ejecuta la acción. "Volver" (o Escape) cierra sin tocar el
// formulario de origen, que sigue montado con sus datos. No conoce ninguna
// entidad: cada pantalla arma sus secciones.
export function ConfirmPreviewModal({
  title,
  description,
  eyebrow = 'REVISIÓN',
  sections,
  confirmLabel = 'Confirmar',
  backLabel = 'Volver',
  busy = false,
  onConfirm,
  onBack,
}: ConfirmPreviewModalProps) {
  const dialogRef = useDialogFocus(onBack, busy)
  const visibleSections = sections.filter((section) => section.rows.length > 0)

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-describedby={description ? 'confirm-preview-description' : undefined}
        aria-labelledby="confirm-preview-title"
        aria-modal="true"
        className="client-modal confirm-preview-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="confirm-preview-title">{title}</h2>
          </div>
          <button
            aria-label="Cerrar sin confirmar"
            className="icon-button"
            disabled={busy}
            onClick={onBack}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        {description && (
          <p className="modal-description" id="confirm-preview-description">
            {description}
          </p>
        )}
        <div className="confirm-preview__body">
          {visibleSections.map((section) => (
            <section
              aria-label={section.title}
              className="confirm-preview__section"
              key={section.title}
            >
              <h3>{section.title}</h3>
              <dl>
                {section.rows.map((row) => (
                  <div
                    className={
                      row.emphasis
                        ? 'confirm-preview__row confirm-preview__row--emphasis'
                        : 'confirm-preview__row'
                    }
                    key={row.label}
                  >
                    <dt>{row.label}</dt>
                    <dd>{isEmpty(row.value) ? '—' : row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="client-modal__actions">
          <button
            className="button button--secondary"
            disabled={busy}
            onClick={onBack}
            type="button"
          >
            {backLabel}
          </button>
          <button
            className="button button--primary"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy && <LoaderCircle className="spin" size={17} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
