import { ShieldCheck } from 'lucide-react'
import type { SalesGuarantor, SalesPaymentPlatform } from './types'

// Garante del crédito. Cuando alguna parte se paga con crédito, se indica si
// tiene un garante propio (nombre, apellido y DNI obligatorios). Si no lo
// tiene, el garante es el mismo cliente y sus datos se completan solos.

export const GUARANTOR_CREDIT_PLATFORMS: SalesPaymentPlatform[] = [
  'CREDITO',
  'EFECTIVO_CREDITO',
  'MOTO_CREDITO',
  'MOTO_EFECTIVO_CREDITO',
]

export function platformHasCredit(platform: SalesPaymentPlatform | '' | null) {
  return Boolean(platform && GUARANTOR_CREDIT_PLATFORMS.includes(platform))
}

export type GuarantorState = {
  hasGuarantor: boolean
  firstName: string
  lastName: string
  documentNumber: string
}

export type GuarantorErrors = Partial<
  Record<'guarantorFirstName' | 'guarantorLastName' | 'guarantorDocument', string>
>

export function emptyGuarantor(): GuarantorState {
  return { hasGuarantor: false, firstName: '', lastName: '', documentNumber: '' }
}

// Estado inicial al editar: el garante propio que tenía la venta.
export function guarantorStateFrom(
  guarantor: SalesGuarantor | null | undefined,
): GuarantorState {
  if (!guarantor?.hasGuarantor) return emptyGuarantor()
  return {
    hasGuarantor: true,
    firstName: guarantor.firstName ?? '',
    lastName: guarantor.lastName ?? '',
    documentNumber: guarantor.documentNumber ?? '',
  }
}

export function normalizeGuarantorDocument(value: string) {
  return value.replace(/\D/g, '')
}

export function validateGuarantor(state: GuarantorState): GuarantorErrors {
  if (!state.hasGuarantor) return {}
  const errors: GuarantorErrors = {}
  if (!state.firstName.trim())
    errors.guarantorFirstName = 'Ingresá el nombre del garante.'
  if (!state.lastName.trim())
    errors.guarantorLastName = 'Ingresá el apellido del garante.'
  const document = normalizeGuarantorDocument(state.documentNumber)
  if (!document) errors.guarantorDocument = 'Ingresá el DNI del garante.'
  else if (document.length < 6 || document.length > 11)
    errors.guarantorDocument = 'El DNI del garante no es válido.'
  return errors
}

// Campos para la API. Sin garante propio sólo va el check: el backend copia
// los datos del cliente.
export function guarantorPayload(state: GuarantorState) {
  if (!state.hasGuarantor) return { hasGuarantor: false as const }
  return {
    hasGuarantor: true as const,
    guarantorFirstName: state.firstName.trim(),
    guarantorLastName: state.lastName.trim(),
    guarantorDocument: normalizeGuarantorDocument(state.documentNumber),
  }
}

// Texto para previsualizaciones y detalle.
export function guarantorLabel(
  state: GuarantorState,
  client: { name: string; documentNumber: string },
) {
  if (!state.hasGuarantor)
    return `El mismo cliente${client.name ? ` · ${client.name}` : ''}${client.documentNumber ? ` · DNI ${client.documentNumber}` : ''}`
  return `${state.lastName.trim()}, ${state.firstName.trim()} · DNI ${normalizeGuarantorDocument(state.documentNumber)}`
}

export function guarantorSummary(
  guarantor: SalesGuarantor | null | undefined,
): string | null {
  if (!guarantor) return null
  if (guarantor.sameAsClient)
    return `El mismo cliente${guarantor.documentNumber ? ` · DNI ${guarantor.documentNumber}` : ''}`
  return `${guarantor.fullName}${guarantor.documentNumber ? ` · DNI ${guarantor.documentNumber}` : ''}`
}

type GuarantorFieldsProps = {
  value: GuarantorState
  onChange: (value: GuarantorState) => void
  // Datos del cliente de la operación, para mostrar el autocompletado.
  client: { name: string; documentNumber: string }
  errors?: GuarantorErrors
  onClearError?: (field: keyof GuarantorErrors) => void
  disabled?: boolean
  className?: string
}

function GuarantorFieldError({ message }: { message: string | undefined }) {
  return message ? <small className="field-error">{message}</small> : null
}

export function GuarantorFields({
  value,
  onChange,
  client,
  errors = {},
  onClearError,
  disabled = false,
  className = '',
}: GuarantorFieldsProps) {
  const update = (changes: Partial<GuarantorState>) =>
    onChange({ ...value, ...changes })
  const own = value.hasGuarantor
  return (
    <fieldset className={`guarantor-fields ${className}`.trim()} disabled={disabled}>
      <legend>Garante del crédito</legend>
      <label className="operation-check">
        <input
          checked={own}
          onChange={(event) => update({ hasGuarantor: event.target.checked })}
          type="checkbox"
        />
        <ShieldCheck size={17} aria-hidden="true" />
        <span>Tiene garante</span>
      </label>
      {own ? (
        <div className="guarantor-fields__grid">
          <label className="field">
            <span>Nombre del garante *</span>
            <input
              aria-invalid={Boolean(errors.guarantorFirstName)}
              data-field="guarantorFirstName"
              maxLength={120}
              onChange={(event) => {
                update({ firstName: event.target.value })
                onClearError?.('guarantorFirstName')
              }}
              value={value.firstName}
            />
            <GuarantorFieldError message={errors.guarantorFirstName} />
          </label>
          <label className="field">
            <span>Apellido del garante *</span>
            <input
              aria-invalid={Boolean(errors.guarantorLastName)}
              data-field="guarantorLastName"
              maxLength={120}
              onChange={(event) => {
                update({ lastName: event.target.value })
                onClearError?.('guarantorLastName')
              }}
              value={value.lastName}
            />
            <GuarantorFieldError message={errors.guarantorLastName} />
          </label>
          <label className="field">
            <span>DNI del garante *</span>
            <input
              aria-invalid={Boolean(errors.guarantorDocument)}
              data-field="guarantorDocument"
              inputMode="numeric"
              maxLength={15}
              onChange={(event) => {
                update({ documentNumber: event.target.value })
                onClearError?.('guarantorDocument')
              }}
              value={value.documentNumber}
            />
            <GuarantorFieldError message={errors.guarantorDocument} />
          </label>
        </div>
      ) : (
        <div className="guarantor-fields__grid guarantor-fields__grid--client">
          <label className="field">
            <span>Garante (el mismo cliente)</span>
            <input readOnly value={client.name || 'Completá los datos del cliente'} />
          </label>
          <label className="field">
            <span>DNI del garante</span>
            <input readOnly value={client.documentNumber} />
          </label>
          <small className="guarantor-fields__hint">
            Sin garante propio, el garante es el cliente de la operación.
          </small>
        </div>
      )}
    </fieldset>
  )
}
