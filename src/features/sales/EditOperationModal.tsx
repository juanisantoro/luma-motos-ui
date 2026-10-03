import { LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../shared/api/client'
import { alertSuccess } from '../../shared/alerts'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { listClients } from '../clients/api'
import type { Client } from '../clients/types'
import {
  correctSalesOperation,
  listSalesContacts,
  listSalesFinancialInstitutions,
  listSalesSellers,
} from './api'
import { salesErrorMessage } from './errors'
import { operationStatusLabels } from './presentation'
import type {
  CorrectSalesOperationInput,
  SalesDebt,
  SalesDeliveryStatus,
  SalesFinancialInstitution,
  SalesOperation,
  SalesPaymentPlatform,
  SalesSeller,
} from './types'

// Corrección de una venta ya cargada desde la grilla (operaciones migradas):
// edita los datos de la venta en cualquier estado, sin cambiar el estado.
// Sólo manda los campos que cambiaron.

const PLATFORMS: Array<{ value: SalesPaymentPlatform; label: string }> = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'EFECTIVO_CREDITO', label: 'Efectivo + crédito' },
  { value: 'MOTO_EFECTIVO', label: 'Moto + efectivo' },
  { value: 'MOTO_CREDITO', label: 'Moto + crédito' },
  { value: 'MOTO_EFECTIVO_CREDITO', label: 'Moto + efectivo + crédito' },
]
const CREDIT_PLATFORMS: SalesPaymentPlatform[] = [
  'CREDITO',
  'EFECTIVO_CREDITO',
  'MOTO_CREDITO',
  'MOTO_EFECTIVO_CREDITO',
]
const DEBTS: Array<{ value: SalesDebt; label: string }> = [
  { value: 'NO', label: 'No' },
  { value: 'RESERVA', label: 'Reserva' },
  { value: 'CUOTA_INICIAL', label: 'Cuota inicial' },
  { value: 'PAPELES', label: 'Papeles' },
  { value: 'ACCESORIOS', label: 'Accesorios' },
  { value: 'OTRO', label: 'Otro' },
]
const DELIVERY: Array<{ value: SalesDeliveryStatus; label: string }> = [
  { value: 'NO_PROGRAMADA', label: 'No programada' },
  { value: 'PROGRAMADA', label: 'Programada' },
  { value: 'LISTA', label: 'Lista para entregar' },
  { value: 'ENTREGADO', label: 'Entregada' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

const CORRECTION_ERRORS: Record<string, string> = {
  CORRECTION_TRADE_IN_REQUIRED:
    'Esa forma de pago incluye una moto en parte de pago y la venta no tiene ninguna cargada. Elegí una forma de pago sin moto.',
  CORRECTION_TRADE_IN_PRESENT:
    'La venta tiene una moto tomada en parte de pago: elegí una forma de pago que la incluya.',
  CORRECTION_PLAN_MISMATCH:
    'El precio, el crédito y la moto tomada no cierran con esa forma de pago. Revisá los importes.',
  CORRECTION_FINANCIAL_INSTITUTION_REQUIRED:
    'Elegí la financiera del crédito.',
  CORRECTION_OWN_CREDIT_ACTIVE:
    'La venta tiene un crédito propio con cuotas generadas: el crédito no se puede corregir desde acá. El resto de los datos sí.',
}

function correctionErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const code = error.details?.code
    if (code && CORRECTION_ERRORS[code]) return CORRECTION_ERRORS[code]
    if (error.status === 400 && error.message) {
      if (error.message.includes('Credit amount'))
        return 'El monto del crédito no es válido para esa forma de pago: tiene que ser mayor a cero y no superar el precio.'
      if (error.message.includes('Financial institution'))
        return 'La financiera elegida no está activa.'
    }
    if (error.status === 409)
      return 'Otra persona modificó esta venta. Cerrá, actualizá la lista y volvé a intentar.'
  }
  return salesErrorMessage(error)
}

function currentFinancialInstitutionId(operation: SalesOperation) {
  return (
    operation.paymentComponents.find(
      (component) =>
        component.type === 'FINANCIACION' &&
        component.paymentStatus !== 'CANCELADA',
    )?.financialInstitutionId ?? ''
  )
}

export function EditOperationModal({
  operation,
  onClose,
  onSaved,
}: {
  operation: SalesOperation
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialogFocus(onClose, saving)

  const [sellers, setSellers] = useState<SalesSeller[]>([])
  const [contacts, setContacts] = useState<SalesSeller[]>([])
  const [institutions, setInstitutions] = useState<SalesFinancialInstitution[]>([])
  const [lookupError, setLookupError] = useState('')

  const [operationDate, setOperationDate] = useState(
    operation.operationDate.slice(0, 10),
  )
  const [client, setClient] = useState<{ id: string; fullName: string }>({
    id: operation.client.id,
    fullName: operation.client.fullName,
  })
  const [clientSearch, setClientSearch] = useState('')
  const [clientOptions, setClientOptions] = useState<Client[] | null>(null)
  const [clientSearching, setClientSearching] = useState(false)
  const [sellerId, setSellerId] = useState(operation.seller?.id ?? '')
  const [contactId, setContactId] = useState(operation.contact?.id ?? '')
  const [agreedPrice, setAgreedPrice] = useState(operation.agreedPrice)
  const [platform, setPlatform] = useState<SalesPaymentPlatform | ''>(
    operation.paymentPlatform ?? '',
  )
  const [creditAmount, setCreditAmount] = useState(operation.creditAmount ?? '')
  const initialInstitutionId = currentFinancialInstitutionId(operation)
  const [institutionId, setInstitutionId] = useState(initialInstitutionId)
  const [guarantor, setGuarantor] = useState(operation.guarantor ?? '')
  const [ticketNumber, setTicketNumber] = useState(operation.ticketNumber ?? '')
  const [debt, setDebt] = useState<SalesDebt>(operation.debt)
  const [deliveryStatus, setDeliveryStatus] = useState<SalesDeliveryStatus>(
    operation.deliveryStatus,
  )
  const [papersDelivered, setPapersDelivered] = useState(
    operation.papersDelivered,
  )
  const [includesHelmet, setIncludesHelmet] = useState(operation.includesHelmet)
  const [notes, setNotes] = useState(operation.notes ?? '')
  const withCredit = platform !== '' && CREDIT_PLATFORMS.includes(platform)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.allSettled([
      listSalesSellers({ organizationId: operation.organizationId }, controller.signal),
      listSalesContacts({ organizationId: operation.organizationId }, controller.signal),
      listSalesFinancialInstitutions(controller.signal),
    ]).then(([sellerResult, contactResult, institutionResult]) => {
      if (controller.signal.aborted) return
      if (sellerResult.status === 'fulfilled') setSellers(sellerResult.value.items)
      if (contactResult.status === 'fulfilled') setContacts(contactResult.value.items)
      if (institutionResult.status === 'fulfilled')
        setInstitutions(institutionResult.value.items)
      if (
        sellerResult.status === 'rejected' ||
        contactResult.status === 'rejected' ||
        institutionResult.status === 'rejected'
      )
        setLookupError(
          'No pudimos cargar alguna de las listas (vendedores, contactos o financieras). Podés editar el resto.',
        )
    })
    return () => controller.abort()
  }, [operation.organizationId])

  // The current seller/contact may be outside the lists the user can pick
  // from (another branch, inactive): keep them selectable as they are.
  const sellerOptions =
    operation.seller && !sellers.some((item) => item.id === operation.seller?.id)
      ? [{ id: operation.seller.id, fullName: operation.seller.fullName }, ...sellers]
      : sellers
  const contactOptions =
    operation.contact &&
    !contacts.some((item) => item.id === operation.contact?.id)
      ? [{ id: operation.contact.id, fullName: operation.contact.fullName }, ...contacts]
      : contacts

  async function searchClients() {
    const term = clientSearch.trim()
    if (term.length < 3) return
    setClientSearching(true)
    try {
      const result = await listClients({ search: term, page: 1, limit: 8 })
      setClientOptions(result.items)
    } catch {
      setClientOptions([])
    } finally {
      setClientSearching(false)
    }
  }

  function changes(): Omit<CorrectSalesOperationInput, 'expectedVersion'> {
    const input: Omit<CorrectSalesOperationInput, 'expectedVersion'> = {}
    if (operationDate !== operation.operationDate.slice(0, 10))
      input.operationDate = operationDate
    if (client.id !== operation.client.id) input.clientId = client.id
    if (sellerId && sellerId !== (operation.seller?.id ?? ''))
      input.sellerId = sellerId
    if (contactId !== (operation.contact?.id ?? ''))
      input.contactId = contactId || null
    if (Number(agreedPrice) !== Number(operation.agreedPrice))
      input.agreedPrice = Number(agreedPrice)
    if (platform && platform !== operation.paymentPlatform)
      input.paymentPlatform = platform
    if (withCredit) {
      if (Number(creditAmount) !== Number(operation.creditAmount ?? 0))
        input.creditAmount = Number(creditAmount)
      if (institutionId && institutionId !== initialInstitutionId)
        input.financialInstitutionId = institutionId
    }
    if (guarantor.trim() !== (operation.guarantor ?? ''))
      input.guarantor = guarantor.trim() || null
    if (ticketNumber.trim() !== (operation.ticketNumber ?? ''))
      input.ticketNumber = ticketNumber.trim() || null
    if (debt !== operation.debt) input.debt = debt
    if (deliveryStatus !== operation.deliveryStatus)
      input.deliveryStatus = deliveryStatus
    if (papersDelivered !== operation.papersDelivered)
      input.papersDelivered = papersDelivered
    if (includesHelmet !== operation.includesHelmet)
      input.includesHelmet = includesHelmet
    if (notes.trim() !== (operation.notes ?? ''))
      input.notes = notes.trim() || null
    return input
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = changes()
    if (Object.keys(input).length === 0) {
      setError('No cambiaste ningún dato.')
      return
    }
    if (!(Number(agreedPrice) > 0)) {
      setError('El precio tiene que ser mayor a cero.')
      return
    }
    if (withCredit && !(Number(creditAmount) > 0)) {
      setError('Ingresá el monto del crédito.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await correctSalesOperation(operation.id, {
        expectedVersion: operation.rowVersion,
        ...input,
      })
      onSaved()
      void alertSuccess(`La operación #${operation.number} se actualizó.`)
    } catch (saveError) {
      setError(correctionErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="edit-operation-title"
        aria-modal="true"
        className="client-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">EDITAR VENTA</p>
            <h2 id="edit-operation-title">
              Operación #{operation.number} ·{' '}
              {operationStatusLabels[operation.status]}
            </h2>
          </div>
          <button
            aria-label="Cerrar edición"
            className="icon-button"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <p className="modal-description">
          El estado de la venta no cambia y no vuelve a pedir aprobación. La
          moto y la patente se gestionan desde sus columnas. Si cambiás el
          precio o la forma de pago, el plan de pago se reacomoda y los cobros
          ya cargados quedan en la venta.
        </p>
        {lookupError && <p className="field-hint">{lookupError}</p>}

        <form aria-label="Editar venta" onSubmit={(event) => void submit(event)}>
          <div className="client-form-grid">
            <label className="field">
              <span>Fecha de operación *</span>
              <input
                onChange={(event) => setOperationDate(event.target.value)}
                required
                type="date"
                value={operationDate}
              />
            </label>
            <label className="field">
              <span>Número de boleto</span>
              <input
                maxLength={40}
                onChange={(event) => setTicketNumber(event.target.value)}
                value={ticketNumber}
              />
            </label>

            <div className="field field--wide">
              <span id="edit-operation-client">Cliente *</span>
              <p className="field-hint" style={{ margin: 0 }}>
                Actual: <strong>{client.fullName}</strong>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  aria-labelledby="edit-operation-client"
                  onChange={(event) => setClientSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void searchClients()
                    }
                  }}
                  placeholder="Para cambiarlo, buscá por nombre o documento"
                  value={clientSearch}
                />
                <button
                  className="button button--secondary"
                  disabled={clientSearching || clientSearch.trim().length < 3}
                  onClick={() => void searchClients()}
                  type="button"
                >
                  <Search size={16} />
                  Buscar
                </button>
              </div>
              {clientOptions && clientOptions.length === 0 && (
                <small>No encontramos clientes con ese dato.</small>
              )}
              {clientOptions && clientOptions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {clientOptions.map((option) => (
                    <button
                      className="button button--secondary button--compact"
                      key={option.id}
                      onClick={() => {
                        setClient({ id: option.id, fullName: option.fullName })
                        setClientOptions(null)
                        setClientSearch('')
                      }}
                      type="button"
                    >
                      {option.fullName}
                      {option.documentNumber ? ` · ${option.documentNumber}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="field">
              <span>Vendedor *</span>
              <select
                onChange={(event) => setSellerId(event.target.value)}
                value={sellerId}
              >
                {!sellerId && <option value="">Sin asignar</option>}
                {sellerOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Contacto</span>
              <select
                onChange={(event) => setContactId(event.target.value)}
                value={contactId}
              >
                <option value="">Sin contacto asignado</option>
                {contactOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Precio de cierre *</span>
              <input
                min="0.01"
                onChange={(event) => setAgreedPrice(event.target.value)}
                required
                step="0.01"
                type="number"
                value={agreedPrice}
              />
            </label>
            <label className="field">
              <span>Forma de pago</span>
              <select
                onChange={(event) =>
                  setPlatform(event.target.value as SalesPaymentPlatform | '')
                }
                value={platform}
              >
                {!platform && <option value="">Sin definir</option>}
                {PLATFORMS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {withCredit && (
              <>
                <label className="field">
                  <span>Monto del crédito *</span>
                  <input
                    min="0.01"
                    onChange={(event) => setCreditAmount(event.target.value)}
                    step="0.01"
                    type="number"
                    value={creditAmount}
                  />
                </label>
                <label className="field">
                  <span>Financiera *</span>
                  <select
                    onChange={(event) => setInstitutionId(event.target.value)}
                    value={institutionId}
                  >
                    <option value="">Elegí una financiera</option>
                    {institutions.map((institution) => (
                      <option key={institution.id} value={institution.id}>
                        {institution.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field field--wide">
                  <span>Respaldo / garante</span>
                  <input
                    maxLength={500}
                    onChange={(event) => setGuarantor(event.target.value)}
                    value={guarantor}
                  />
                </label>
              </>
            )}

            <label className="field">
              <span>Debe</span>
              <select
                onChange={(event) => setDebt(event.target.value as SalesDebt)}
                value={debt}
              >
                {DEBTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Entrega</span>
              <select
                onChange={(event) =>
                  setDeliveryStatus(event.target.value as SalesDeliveryStatus)
                }
                value={deliveryStatus}
              >
                {DELIVERY.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="operation-check">
              <input
                checked={papersDelivered}
                onChange={(event) => setPapersDelivered(event.target.checked)}
                type="checkbox"
              />
              <span>Papeles entregados</span>
            </label>
            <label className="operation-check">
              <input
                checked={includesHelmet}
                onChange={(event) => setIncludesHelmet(event.target.checked)}
                type="checkbox"
              />
              <span>Casco de regalo</span>
            </label>
            <label className="field field--wide">
              <span>Observaciones</span>
              <textarea
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                value={notes}
              />
            </label>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="client-modal__actions">
            <button
              className="button button--secondary"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={saving}
              type="submit"
            >
              {saving && <LoaderCircle className="spin" size={17} />}
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
