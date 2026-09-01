import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CreditDocumentType } from '../credit-checks'
import { createCreditInquiry } from './api'
import { creditInquiryErrorMessage } from './errors'
import { alertError, alertSuccess } from '../../shared/alerts'
import type {
  BranchReference,
  FinancialInstitution,
  RegistrantReference,
} from './types'

type CreditInquiryModalProps = {
  financialInstitutions: FinancialInstitution[]
  branches: BranchReference[]
  registrants: RegistrantReference[]
  onClose: () => void
  onSaved: (replayed: boolean) => void
}

function formText(data: FormData, field: string) {
  return String(data.get(field) ?? '').trim()
}

function creditDocumentType(value: string): CreditDocumentType | null {
  switch (value) {
    case 'DNI':
    case 'CUIT':
    case 'CI':
    case 'PASAPORTE':
    case 'OTRO':
      return value
    default:
      return null
  }
}

function today() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.valueOf() - offset * 60_000).toISOString().slice(0, 10)
}

export function CreditInquiryModal({
  financialInstitutions,
  branches,
  registrants,
  onClose,
  onSaved,
}: CreditInquiryModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedRegistrant, setSelectedRegistrant] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const submittingRef = useRef(false)
  const idempotencyKeyRef = useRef(`credit-inquiry:${crypto.randomUUID()}`)

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
    setError('')
    const data = new FormData(event.currentTarget)
    const documentType = creditDocumentType(formText(data, 'documentType'))
    const documentNumber = formText(data, 'documentNumber')
    const fullName = formText(data, 'fullName')
    const financialEntityId = formText(data, 'financialEntityId')
    const reason = formText(data, 'reason')
    const consultedAt = formText(data, 'consultedAt')
    const registeredById = formText(data, 'registeredById')
    const branchId =
      registrants.find((registrant) => registrant.id === registeredById)
        ?.primaryBranch?.id ?? ''

    if (!documentType) {
      setError('Seleccioná un tipo de documento válido.')
      return
    }
    if (!/^(?=.*[A-Za-z0-9])[A-Za-z0-9 .-]{5,30}$/.test(documentNumber)) {
      setError(
        'El documento debe tener entre 5 y 30 caracteres, usando letras, números, espacios, puntos o guiones.',
      )
      return
    }
    if (!fullName || !financialEntityId || !reason || !consultedAt || !registeredById) {
      setError('Completá todos los campos obligatorios antes de continuar.')
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      const created = await createCreditInquiry(
        {
          documentType,
          documentNumber,
          fullName,
          financialEntityId,
          outcome: 'RECHAZADA',
          reason,
          consultedAt,
          registeredById,
          ...(branchId ? { branchId } : {}),
        },
        idempotencyKeyRef.current,
      )
      onSaved(created.idempotentReplay)
      void alertSuccess('La consulta se registró correctamente.')
    } catch (submitError) {
      const message = creditInquiryErrorMessage(submitError)
      setError(message)
      void alertError(message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const selectedBranch = registrants.find(
    (registrant) => registrant.id === selectedRegistrant,
  )?.primaryBranch

  return (
    <div className="credit-inquiries-modal-backdrop" role="presentation">
      <div
        className="credit-inquiries-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-inquiry-modal-title"
        aria-describedby="credit-inquiry-modal-description"
      >
        <header className="credit-inquiries-modal__header">
          <div>
            <p className="eyebrow">CONSULTAS CREDITICIAS</p>
            <h2 id="credit-inquiry-modal-title">Registrar rechazo</h2>
            <p id="credit-inquiry-modal-description">
              El antecedente se mostrará al consultar el documento en una nueva operación.
            </p>
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
        </header>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <div className="credit-inquiries-form-grid">
            <label className="field">
              <span>Tipo de documento *</span>
              <select name="documentType" defaultValue="DNI" required>
                <option value="DNI">DNI</option>
                <option value="CUIT">CUIT</option>
                <option value="CI">CI</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="OTRO">Otro</option>
              </select>
            </label>
            <label className="field">
              <span>Documento *</span>
              <input
                name="documentNumber"
                autoComplete="off"
                maxLength={30}
                required
              />
            </label>
            <label className="field credit-inquiries-field--wide">
              <span>Nombre y apellido *</span>
              <input name="fullName" maxLength={180} required />
            </label>
            <label className="field">
              <span>Financiera *</span>
              <select name="financialEntityId" defaultValue="" required>
                <option value="" disabled>
                  Seleccionar
                </option>
                {financialInstitutions.map((institution) => (
                  <option value={institution.id} key={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Fecha del rechazo *</span>
              <input
                name="consultedAt"
                type="date"
                defaultValue={today()}
                max={today()}
                required
              />
            </label>
            <label className="field credit-inquiries-field--wide">
              <span>Vendedor que lo registró *</span>
              <select
                name="registeredById"
                value={selectedRegistrant}
                onChange={(event) => setSelectedRegistrant(event.target.value)}
                required
              >
                <option value="" disabled>
                  Seleccionar
                </option>
                {registrants.map((registrant) => (
                  <option value={registrant.id} key={registrant.id}>
                    {registrant.fullName}
                  </option>
                ))}
              </select>
              {selectedBranch && (
                <small>
                  Sucursal asociada: {selectedBranch.name}
                </small>
              )}
            </label>
            <label className="field credit-inquiries-field--wide">
              <span>Motivo informado *</span>
              <textarea name="reason" maxLength={2000} rows={4} required />
            </label>
          </div>
          {branches.length === 0 && (
            <p className="credit-inquiries-form-note">
              El backend asignará la sucursal habilitada del vendedor.
            </p>
          )}
          <footer className="credit-inquiries-modal__actions">
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
              {submitting ? 'Registrando…' : 'Registrar rechazo'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
