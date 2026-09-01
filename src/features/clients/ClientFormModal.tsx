import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { createClient, updateClient } from './api'
import { clientsErrorMessage } from './errors'
import { alertError, alertSuccess } from '../../shared/alerts'
import type {
  Client,
  CreateClientInput,
  DocumentType,
  UpdateClientInput,
} from './types'

const documentTypes: DocumentType[] = [
  'DNI',
  'CUIT',
  'CI',
  'PASAPORTE',
  'OTRO',
]

type ClientFormModalProps = {
  client: Client | null
  onClose: () => void
  onSaved: () => void
}

function optionalText(data: FormData, field: string) {
  const value = String(data.get(field) ?? '').trim()
  return value || undefined
}

export function ClientFormModal({
  client,
  onClose,
  onSaved,
}: ClientFormModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const submittingRef = useRef(false)
  const title = client ? 'Editar cliente' : 'Nuevo cliente'

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const dialog = dialogRef.current
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ) ?? [],
      )

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0]
      const last = elements.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.classList.add('drawer-active')
    document.addEventListener('keydown', handleKeyDown)
    requestAnimationFrame(() => focusable()[0]?.focus())
    return () => {
      document.body.classList.remove('drawer-active')
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const data = new FormData(event.currentTarget)
    const fullName = String(data.get('fullName') ?? '').trim()
    const documentType =
      optionalText(data, 'documentType') as DocumentType | undefined
    const documentNumber = optionalText(data, 'documentNumber')

    if (Boolean(documentType) !== Boolean(documentNumber)) {
      setError('El tipo y el número de documento deben completarse juntos.')
      return
    }

    const phone = optionalText(data, 'phone')
    const email = optionalText(data, 'email')
    const address = optionalText(data, 'address')
    const notes = optionalText(data, 'notes')

    submittingRef.current = true
    setSubmitting(true)
    try {
      if (client) {
        const input: UpdateClientInput = {
          fullName,
          documentType: documentType ?? null,
          documentNumber: documentNumber ?? null,
          phone: phone ?? null,
          email: email ?? null,
          address: address ?? null,
          notes: notes ?? null,
        }
        await updateClient(client.id, input)
      } else {
        const input: CreateClientInput = {
          fullName,
          ...(documentType ? { documentType } : {}),
          ...(documentNumber ? { documentNumber } : {}),
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          ...(address ? { address } : {}),
          ...(notes ? { notes } : {}),
        }
        await createClient(input)
      }
      onSaved()
      void alertSuccess(client ? 'El cliente se actualizó correctamente.' : 'El cliente se creó correctamente.')
    } catch (submitError) {
      const message = clientsErrorMessage(submitError)
      setError(message)
      void alertError(message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="client-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-modal-title"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">CLIENTES</p>
            <h2 id="client-modal-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar formulario"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <div className="client-form-grid">
            <label className="field field--wide">
              <span>Nombre completo *</span>
              <input
                name="fullName"
                defaultValue={client?.fullName}
                maxLength={180}
                required
              />
            </label>
            <label className="field">
              <span>Tipo de documento</span>
              <select
                name="documentType"
                defaultValue={client?.documentType ?? ''}
              >
                <option value="">Sin documento</option>
                {documentTypes.map((type) => (
                  <option value={type} key={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Número de documento</span>
              <input
                name="documentNumber"
                defaultValue={client?.documentNumber ?? ''}
                maxLength={30}
              />
            </label>
            <label className="field">
              <span>Teléfono</span>
              <input
                name="phone"
                type="tel"
                defaultValue={client?.phone ?? ''}
                maxLength={40}
              />
            </label>
            <label className="field">
              <span>Correo electrónico</span>
              <input
                name="email"
                type="email"
                defaultValue={client?.email ?? ''}
                maxLength={254}
              />
            </label>
            <label className="field field--wide">
              <span>Domicilio</span>
              <input
                name="address"
                defaultValue={client?.address ?? ''}
                maxLength={500}
              />
            </label>
            <label className="field field--wide">
              <span>Notas</span>
              <textarea
                name="notes"
                defaultValue={client?.notes ?? ''}
                maxLength={2000}
                rows={4}
              />
            </label>
          </div>
          <div className="client-modal__actions">
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
              {submitting && (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              )}
              {submitting ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
