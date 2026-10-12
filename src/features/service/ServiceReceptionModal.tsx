import { LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { localIsoDate } from '../../shared/utils/date'
import { useAuth } from '../auth/AuthContext'
import {
  allowedBranchIds,
  branchScopeKey,
  defaultBranchId,
  filterAllowedBranches,
} from '../auth/branchScope'
import { listInventoryBranches } from '../finance/api'
import type { BranchOption } from '../finance/types'
import {
  createServiceOrder,
  listServiceTypes,
  lookupServiceVehicle,
  updateServiceOrder,
} from './api'
import { formatDay, formatKm, orderNumber, serviceErrorMessage } from './format'
import type { ReceptionInput, ServiceOrder, ServiceType, VehicleLookup } from './types'

const OTHER = 'OTRO'

type Draft = {
  branchId: string
  receptionDate: string
  clientId: string
  clientName: string
  clientPhone: string
  clientEmail: string
  clientDocument: string
  clientAddress: string
  clientLocality: string
  unitId: string
  plate: string
  chassis: string
  engine: string
  model: string
  year: string
  currentKm: string
  nextServiceKm: string
  serviceTypeId: string
  serviceTypeOther: string
  receptionNotes: string
}

function draftFrom(order: ServiceOrder | null): Draft {
  const otherName = order && !order.serviceType.id
    ? order.serviceType.name.replace(/^Otro:\s*/, '')
    : ''
  return {
    branchId: order?.branch.id ?? '',
    receptionDate: order?.receptionDate ?? localIsoDate(),
    clientId: order?.client.id ?? '',
    clientName: order?.client.name ?? '',
    clientPhone: order?.client.phone ?? '',
    clientEmail: order?.client.email ?? '',
    clientDocument: order?.client.document ?? '',
    clientAddress: order?.client.address ?? '',
    clientLocality: order?.client.locality ?? '',
    unitId: order?.vehicle.unitId ?? '',
    plate: order?.vehicle.plate ?? '',
    chassis: order?.vehicle.chassis ?? '',
    engine: order?.vehicle.engine ?? '',
    model: order?.vehicle.model ?? '',
    year: order?.vehicle.year ? String(order.vehicle.year) : '',
    currentKm: order ? String(order.currentKm) : '',
    nextServiceKm: order?.nextServiceKm ? String(order.nextServiceKm) : '',
    serviceTypeId: order ? (order.serviceType.id ?? OTHER) : '',
    serviceTypeOther: otherName,
    receptionNotes: order?.receptionNotes ?? '',
  }
}

/** El tipo que sigue al último service que se le hizo a la moto. */
function nextServiceType(types: ServiceType[], lastTypeId: string | null) {
  const index = types.findIndex((type) => type.id === lastTypeId)
  return index >= 0 ? types[index + 1]?.id : undefined
}

/**
 * Recepción de una moto para service: alta (sin `order`) o corrección de
 * los datos cargados (con `order`).
 */
export function ServiceReceptionModal({
  order = null,
  onClose,
  onSaved,
}: {
  order?: ServiceOrder | null
  onClose: () => void
  onSaved: (order: ServiceOrder) => void
}) {
  const { user } = useAuth()
  const scopeKey = branchScopeKey(user)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(order))
  const [types, setTypes] = useState<ServiceType[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [lookupText, setLookupText] = useState('')
  const [lookup, setLookup] = useState<VehicleLookup | null>(null)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialogFocus(onClose, busy)
  // Una vez que el mecánico la empezó, el tipo de service queda fijo.
  const typeLocked = order !== null && order.status !== 'RECIBIDA'
  const allowed = allowedBranchIds(scopeKey)
  const askBranch = allowed === null || allowed.length > 1

  useEffect(() => {
    const controller = new AbortController()
    listServiceTypes(controller.signal)
      .then(setTypes)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setError(serviceErrorMessage(loadError))
      })
    if (askBranch)
      listInventoryBranches(controller.signal)
        .then((items) => {
          const options = filterAllowedBranches(scopeKey, items)
          setBranches(options)
          setDraft((current) =>
            current.branchId
              ? current
              : { ...current, branchId: defaultBranchId(scopeKey, options, user?.branch?.id) },
          )
        })
        .catch(() => undefined)
    return () => controller.abort()
  }, [askBranch, scopeKey, user?.branch?.id])

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const search = async () => {
    const text = lookupText.trim()
    if (!text) return
    setLookupBusy(true)
    setError('')
    try {
      const found = await lookupServiceVehicle(text)
      setLookup(found)
      const unit = found.units[0]
      setDraft((current) => ({
        ...current,
        ...(unit
          ? {
              unitId: unit.unitId,
              plate: unit.plate ?? current.plate,
              chassis: unit.chassis ?? current.chassis,
              engine: unit.engine ?? current.engine,
              model: unit.model || current.model,
              year: unit.year ? String(unit.year) : current.year,
            }
          : { plate: current.plate || text.toUpperCase() }),
        ...(unit?.client
          ? {
              clientId: unit.client.id,
              clientName: unit.client.name ?? current.clientName,
              clientPhone: unit.client.phone ?? current.clientPhone,
              clientEmail: unit.client.email ?? current.clientEmail,
              clientDocument: unit.client.document ?? current.clientDocument,
              clientAddress: unit.client.address ?? current.clientAddress,
            }
          : {}),
        ...(!current.serviceTypeId && found.lastOrder
          ? { serviceTypeId: nextServiceType(types, found.lastOrder.serviceTypeId) ?? '' }
          : {}),
      }))
    } catch (lookupError) {
      setError(serviceErrorMessage(lookupError))
    } finally {
      setLookupBusy(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.clientName.trim()) {
      setError('Escribí el nombre y apellido del cliente.')
      return
    }
    if (!draft.plate.trim() && !draft.chassis.trim() && !draft.unitId) {
      setError('Cargá el dominio o el número de chasis de la moto.')
      return
    }
    if (draft.currentKm === '' || Number(draft.currentKm) < 0) {
      setError('Cargá los kilómetros actuales de la moto.')
      return
    }
    if (!draft.serviceTypeId || (draft.serviceTypeId === OTHER && !draft.serviceTypeOther.trim())) {
      setError('Elegí el tipo de service o escribí cuál es en "Otro".')
      return
    }
    if (askBranch && !draft.branchId) {
      setError('Elegí la sucursal donde queda la moto.')
      return
    }
    const input: ReceptionInput = {
      ...(askBranch && draft.branchId ? { branchId: draft.branchId } : {}),
      receptionDate: draft.receptionDate,
      ...(draft.clientId ? { clientId: draft.clientId } : {}),
      clientName: draft.clientName.trim(),
      clientPhone: draft.clientPhone.trim(),
      clientEmail: draft.clientEmail.trim(),
      clientDocument: draft.clientDocument.trim(),
      clientAddress: draft.clientAddress.trim(),
      clientLocality: draft.clientLocality.trim(),
      ...(draft.unitId ? { unitId: draft.unitId } : {}),
      plate: draft.plate.trim(),
      chassis: draft.chassis.trim(),
      engine: draft.engine.trim(),
      model: draft.model.trim(),
      ...(draft.year ? { year: Number(draft.year) } : {}),
      currentKm: Number(draft.currentKm),
      nextServiceKm: draft.nextServiceKm ? Number(draft.nextServiceKm) : null,
      ...(typeLocked
        ? {}
        : draft.serviceTypeId === OTHER
          ? { serviceTypeOther: draft.serviceTypeOther.trim() }
          : { serviceTypeId: draft.serviceTypeId }),
      receptionNotes: draft.receptionNotes.trim(),
    }
    setBusy(true)
    setError('')
    try {
      const saved = order
        ? await updateServiceOrder(order.id, { ...input, expectedVersion: order.version })
        : await createServiceOrder(input)
      onSaved(saved)
    } catch (saveError) {
      setError(serviceErrorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  const found = lookup?.units[0]
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="service-reception-title"
        aria-modal="true"
        className="client-modal service-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">SERVICE</p>
            <h2 id="service-reception-title">
              {order ? `Corregir la orden ${orderNumber(order.number)}` : 'Recibir moto para service'}
            </h2>
            <p>Los datos de la planilla: cliente, moto, kilómetros y qué service le toca.</p>
          </div>
          <button aria-label="Cerrar" className="icon-button" disabled={busy} onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}

        {!order && (
          <div className="service-lookup">
            <label className="field">
              <span>Buscar la moto por dominio o chasis</span>
              <input
                onChange={(event) => setLookupText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void search()
                  }
                }}
                placeholder="AB123CD"
                value={lookupText}
              />
            </label>
            <button
              className="button button--secondary"
              disabled={lookupBusy || !lookupText.trim()}
              onClick={() => void search()}
              type="button"
            >
              {lookupBusy ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}
              Buscar
            </button>
            {lookup && (
              <p className="service-lookup__result" role="status">
                {found
                  ? `La vendió Luma: ${found.model}${found.client?.name ? `, a ${found.client.name}` : ''}. Completamos sus datos.`
                  : 'No es una moto vendida por Luma: cargá los datos a mano.'}
                {lookup.lastOrder &&
                  ` Último service: ${lookup.lastOrder.serviceType} (orden ${orderNumber(lookup.lastOrder.number)}, ${formatDay(lookup.lastOrder.receptionDate)}, ${formatKm(lookup.lastOrder.currentKm)}).`}
              </p>
            )}
          </div>
        )}

        <form aria-label="Datos de la recepción" onSubmit={submit}>
          <fieldset className="service-fieldset">
            <legend>Datos del cliente</legend>
            <div className="client-form-grid">
              <label className="field field--wide">
                <span>Nombre y apellido *</span>
                <input maxLength={160} onChange={(event) => change('clientName', event.target.value)} value={draft.clientName} />
              </label>
              <label className="field">
                <span>Teléfono</span>
                <input inputMode="tel" maxLength={40} onChange={(event) => change('clientPhone', event.target.value)} value={draft.clientPhone} />
              </label>
              <label className="field">
                <span>Email</span>
                <input maxLength={160} onChange={(event) => change('clientEmail', event.target.value)} type="email" value={draft.clientEmail} />
              </label>
              <label className="field">
                <span>Dirección</span>
                <input maxLength={240} onChange={(event) => change('clientAddress', event.target.value)} value={draft.clientAddress} />
              </label>
              <label className="field">
                <span>Localidad</span>
                <input maxLength={120} onChange={(event) => change('clientLocality', event.target.value)} value={draft.clientLocality} />
              </label>
              <label className="field">
                <span>DNI</span>
                <input maxLength={20} onChange={(event) => change('clientDocument', event.target.value)} value={draft.clientDocument} />
              </label>
            </div>
          </fieldset>

          <fieldset className="service-fieldset">
            <legend>Datos de la moto</legend>
            <div className="client-form-grid">
              <label className="field">
                <span>Dominio</span>
                <input maxLength={20} onChange={(event) => change('plate', event.target.value.toUpperCase())} value={draft.plate} />
              </label>
              <label className="field">
                <span>Modelo</span>
                <input maxLength={120} onChange={(event) => change('model', event.target.value)} value={draft.model} />
              </label>
              <label className="field">
                <span>Año</span>
                <input max={2100} min={1950} onChange={(event) => change('year', event.target.value)} type="number" value={draft.year} />
              </label>
              <label className="field">
                <span>N.º de chasis</span>
                <input maxLength={40} onChange={(event) => change('chassis', event.target.value.toUpperCase())} value={draft.chassis} />
              </label>
              <label className="field">
                <span>N.º de motor</span>
                <input maxLength={40} onChange={(event) => change('engine', event.target.value.toUpperCase())} value={draft.engine} />
              </label>
              <label className="field">
                <span>Km actual *</span>
                <input min={0} onChange={(event) => change('currentKm', event.target.value)} type="number" value={draft.currentKm} />
              </label>
              <label className="field">
                <span>Km próximo service</span>
                <input min={0} onChange={(event) => change('nextServiceKm', event.target.value)} type="number" value={draft.nextServiceKm} />
              </label>
            </div>
          </fieldset>

          <fieldset className="service-fieldset">
            <legend>Service solicitado</legend>
            <div className="client-form-grid">
              <label className="field">
                <span>Tipo de service *</span>
                <select
                  disabled={typeLocked}
                  onChange={(event) => change('serviceTypeId', event.target.value)}
                  value={draft.serviceTypeId}
                >
                  <option value="">Elegí el tipo</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                  <option value={OTHER}>Otro</option>
                </select>
                {typeLocked && <small>El mecánico ya la empezó: el tipo no se cambia.</small>}
              </label>
              {draft.serviceTypeId === OTHER && (
                <label className="field">
                  <span>¿Cuál? *</span>
                  <input
                    disabled={typeLocked}
                    maxLength={70}
                    onChange={(event) => change('serviceTypeOther', event.target.value)}
                    value={draft.serviceTypeOther}
                  />
                </label>
              )}
              <label className="field">
                <span>Fecha de recepción</span>
                <input onChange={(event) => change('receptionDate', event.target.value)} type="date" value={draft.receptionDate} />
              </label>
              {askBranch && (
                <label className="field">
                  <span>Sucursal *</span>
                  <select onChange={(event) => change('branchId', event.target.value)} value={draft.branchId}>
                    <option value="">Elegí la sucursal</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field field--wide">
                <span>Observaciones de la recepción</span>
                <textarea
                  maxLength={2000}
                  onChange={(event) => change('receptionNotes', event.target.value)}
                  placeholder="Lo que cuenta el cliente: ruidos, fallas, pedidos."
                  rows={3}
                  value={draft.receptionNotes}
                />
              </label>
            </div>
          </fieldset>

          <div className="client-modal__actions">
            <button className="button button--secondary" disabled={busy} onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy && <LoaderCircle className="spin" size={17} />}
              {order ? 'Guardar cambios' : 'Recibir moto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
