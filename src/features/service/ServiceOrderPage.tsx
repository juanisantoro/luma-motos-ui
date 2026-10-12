import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  LoaderCircle,
  MessageCircle,
  MessageSquarePlus,
  PencilLine,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { alertSuccess } from '../../shared/alerts'
import { ApiError } from '../../shared/api/client'
import { ConfirmPreviewModal } from '../../shared/components/ConfirmPreviewModal'
import { StatePanel } from '../../shared/components/StatePanel'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { formatMoney } from '../finance/format'
import {
  cancelServiceOrder,
  finishServiceOrder,
  getServiceOrder,
  listServiceTypes,
  reopenServiceOrder,
  saveServiceWork,
} from './api'
import {
  conditionLabels,
  formatDateTime,
  formatDay,
  formatKm,
  orderNumber,
  serviceErrorMessage,
  statusLabels,
  statusTones,
} from './format'
import { ServiceDeliveryModal } from './ServiceDeliveryModal'
import { ServiceOrderPrint } from './ServiceOrderPrint'
import { ServiceReceptionModal } from './ServiceReceptionModal'
import type {
  ServiceOil,
  ServiceOrder,
  ServicePart,
  ServiceTask,
  ServiceType,
  WorkInput,
} from './types'
import { whatsappLink } from './whatsapp'

type WorkDraft = {
  tasks: ServiceTask[]
  oil: ServiceOil
  parts: Array<Omit<ServicePart, 'quantity'> & { quantity: string }>
  diagnosis: string
  nextServiceKm: string
}

function workDraft(order: ServiceOrder): WorkDraft {
  return {
    tasks: order.tasks.map((task) => ({ ...task })),
    oil: { ...order.oil },
    parts: order.parts.map((part) => ({ ...part, quantity: String(part.quantity) })),
    diagnosis: order.diagnosis ?? '',
    nextServiceKm: order.nextServiceKm ? String(order.nextServiceKm) : '',
  }
}

function workInput(order: ServiceOrder, draft: WorkDraft): WorkInput {
  return {
    expectedVersion: order.version,
    tasks: draft.tasks
      .filter((task) => task.description.trim())
      .map((task) => ({
        description: task.description.trim(),
        done: task.done,
        notes: task.notes?.trim() || null,
      })),
    oil: {
      type: draft.oil.type?.trim() || null,
      viscosity: draft.oil.viscosity?.trim() || null,
      liters: draft.oil.liters === null || Number.isNaN(draft.oil.liters) ? null : draft.oil.liters,
      filter: draft.oil.filter,
    },
    parts: draft.parts
      .filter((part) => part.description.trim())
      .map((part) => ({
        code: part.code?.trim() || null,
        description: part.description.trim(),
        quantity: Number(part.quantity) || 1,
        unitPrice: part.unitPrice ? Number(part.unitPrice).toFixed(2) : null,
      })),
    diagnosis: draft.diagnosis.trim() || null,
    nextServiceKm: draft.nextServiceKm ? Number(draft.nextServiceKm) : null,
  }
}

function YesNo({
  value,
  onChange,
  disabled,
  label,
}: {
  value: boolean | null
  onChange: (value: boolean | null) => void
  disabled: boolean
  label: string
}) {
  return (
    <div aria-label={label} className="service-yesno" role="group">
      <button
        aria-pressed={value === true}
        className={value === true ? 'service-yesno__yes' : ''}
        disabled={disabled}
        onClick={() => onChange(value === true ? null : true)}
        type="button"
      >
        Sí
      </button>
      <button
        aria-pressed={value === false}
        className={value === false ? 'service-yesno__no' : ''}
        disabled={disabled}
        onClick={() => onChange(value === false ? null : false)}
        type="button"
      >
        No
      </button>
    </div>
  )
}

/** Motivo para reabrir o cancelar una orden. */
function ReasonModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialogFocus(onClose, busy)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reason.trim()) {
      setError('Escribí el motivo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onConfirm(reason.trim())
    } catch (failure) {
      setError(serviceErrorMessage(failure))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-labelledby="service-reason-title" aria-modal="true" className="client-modal" ref={dialogRef} role="dialog">
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">SERVICE</p>
            <h2 id="service-reason-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button aria-label="Cerrar" className="icon-button" disabled={busy} onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label className="field">
            <span>Motivo *</span>
            <textarea maxLength={500} onChange={(event) => setReason(event.target.value)} rows={3} value={reason} />
          </label>
          <div className="client-modal__actions">
            <button className="button button--secondary" disabled={busy} onClick={onClose} type="button">Volver</button>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy && <LoaderCircle className="spin" size={17} />}
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ServiceOrderPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const permissions = user?.role.permissions
  const canManage = hasPermission(permissions, 'service.gestionar')
  const canWork = hasPermission(permissions, 'service.trabajar')
  const canCollect = hasPermission(permissions, 'service.cobrar')
  // Vista del taller: quien trabaja la moto y no la administra (el mecánico).
  const workshopView = canWork && !canManage
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [types, setTypes] = useState<ServiceType[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [draft, setDraft] = useState<WorkDraft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'save' | 'finish' | null>(null)
  const [workError, setWorkError] = useState('')
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [modal, setModal] = useState<'edit' | 'deliver' | 'reopen' | 'cancel' | null>(null)
  // Tareas en las que el mecánico abrió la observación a mano.
  const [notesOpen, setNotesOpen] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getServiceOrder(id, controller.signal)
      .then((loaded) => {
        setOrder(loaded)
        setDraft(workDraft(loaded))
        setDirty(false)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(
          error instanceof ApiError && error.status === 404
            ? 'La orden no existe o es de otra sucursal.'
            : serviceErrorMessage(error),
        )
        setStatus('error')
      })
    listServiceTypes(controller.signal).then(setTypes).catch(() => undefined)
    return () => controller.abort()
  }, [id, refreshKey])

  // Avisar antes de salir con cambios del taller sin guardar.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (status === 'loading' && !order) {
    return (
      <div className="financial-loading">
        <div className="loading-mark" />
        <span>Cargando la orden…</span>
      </div>
    )
  }
  if (status === 'error' || !order || !draft) {
    return (
      <StatePanel
        icon={RefreshCw}
        title="No pudimos abrir la orden"
        description={loadError}
        tone="danger"
        action={
          <div className="page-heading__actions">
            <Link className="button button--secondary" to="/service">
              Volver a Service
            </Link>
            <button className="button button--primary" onClick={() => setRefreshKey((key) => key + 1)} type="button">
              <RefreshCw size={17} />
              Reintentar
            </button>
          </div>
        }
      />
    )
  }

  const open = order.status === 'RECIBIDA' || order.status === 'EN_TALLER'
  const editable = canWork && open
  const pendingTasks = draft.tasks.filter((task) => task.description.trim() && task.done === null).length
  const whatsapp = order.status === 'TERMINADA' ? whatsappLink(order) : null
  const suggestedPrice = types.find((type) => type.id === order.serviceType.id)?.suggestedPrice ?? null
  const draftPartsTotal = draft.parts.reduce(
    (sum, part) => sum + (part.unitPrice ? Number(part.unitPrice) * (Number(part.quantity) || 0) : 0),
    0,
  )

  const replace = (next: ServiceOrder) => {
    setOrder(next)
    setDraft(workDraft(next))
    setDirty(false)
    setNotesOpen(new Set())
  }

  const edit = (update: (current: WorkDraft) => WorkDraft) => {
    setDraft((current) => (current ? update(current) : current))
    setDirty(true)
    setWorkError('')
  }

  const setTask = (index: number, patch: Partial<ServiceTask>) =>
    edit((current) => ({
      ...current,
      tasks: current.tasks.map((task, position) => (position === index ? { ...task, ...patch } : task)),
    }))

  const setPart = (index: number, patch: Partial<WorkDraft['parts'][number]>) =>
    edit((current) => ({
      ...current,
      parts: current.parts.map((part, position) => (position === index ? { ...part, ...patch } : part)),
    }))

  const save = async (sign: boolean) => {
    setBusy(sign ? 'finish' : 'save')
    setWorkError('')
    try {
      const input = workInput(order, draft)
      const saved = sign ? await finishServiceOrder(order.id, input) : await saveServiceWork(order.id, input)
      replace(saved)
      setConfirmFinish(false)
      void alertSuccess(
        sign
          ? 'Service terminado y firmado. La administración ya lo ve para entregar.'
          : 'Avance guardado.',
      )
    } catch (failure) {
      setWorkError(serviceErrorMessage(failure))
      setConfirmFinish(false)
    } finally {
      setBusy(null)
    }
  }

  const markPendingYes = () =>
    edit((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.description.trim() && task.done === null ? { ...task, done: true } : task)),
    }))

  const totalTasks = draft.tasks.filter((task) => task.description.trim()).length
  const doneTasks = totalTasks - pendingTasks
  const vehicleSummary = [
    order.vehicle.plate ?? order.vehicle.chassis,
    [order.vehicle.model, order.vehicle.year].filter(Boolean).join(' '),
    formatKm(order.currentKm),
  ]
    .filter(Boolean)
    .join(' · ')

  const clientCard = (
    <section className="service-card" aria-label="Datos del cliente">
      <h2>Cliente</h2>
      <dl>
        <div><dt>Nombre</dt><dd>{order.client.name}</dd></div>
        <div><dt>Teléfono</dt><dd>{order.client.phone ?? '—'}</dd></div>
        <div><dt>Email</dt><dd>{order.client.email ?? '—'}</dd></div>
        <div><dt>DNI</dt><dd>{order.client.document ?? '—'}</dd></div>
        <div><dt>Dirección</dt><dd>{[order.client.address, order.client.locality].filter(Boolean).join(', ') || '—'}</dd></div>
      </dl>
    </section>
  )
  const vehicleCard = (
    <section className="service-card" aria-label="Datos de la moto">
      <h2>Moto</h2>
      <dl>
        <div><dt>Dominio</dt><dd>{order.vehicle.plate ?? '—'}</dd></div>
        <div><dt>Modelo</dt><dd>{[order.vehicle.model, order.vehicle.year].filter(Boolean).join(' · ') || '—'}</dd></div>
        <div><dt>Chasis</dt><dd>{order.vehicle.chassis ?? '—'}</dd></div>
        <div><dt>Motor</dt><dd>{order.vehicle.engine ?? '—'}</dd></div>
        <div><dt>Km actual</dt><dd><strong>{formatKm(order.currentKm)}</strong></dd></div>
      </dl>
    </section>
  )

  return (
    <>
      <div className={`service-page${editable ? ' service-page--work' : ''}`}>
        <Link className="service-back" to="/service">
          <ArrowLeft size={16} />
          Service
        </Link>
        <header className="page-heading">
          <div>
            <p className="eyebrow">ORDEN DE TRABAJO · {order.branch.name.toUpperCase()}</p>
            <h1>
              Orden {orderNumber(order.number)}{' '}
              <span className={`status-badge ${statusTones[order.status]}`}>{statusLabels[order.status]}</span>
            </h1>
            {workshopView ? (
              <p className="service-heading-vehicle">
                <strong>{order.serviceType.name}</strong> · {vehicleSummary}
              </p>
            ) : (
              <p>
                {order.serviceType.name} · recibida el {formatDay(order.receptionDate)}
                {order.receivedBy ? ` por ${order.receivedBy.fullName}` : ''}
              </p>
            )}
          </div>
          <div className="page-heading__actions">
            {(!editable || canManage) && (
              <button className="button button--secondary" onClick={() => window.print()} type="button">
                <Printer size={17} />
                Imprimir
              </button>
            )}
            {canManage && whatsapp && (
              <a className="button button--secondary" href={whatsapp} rel="noreferrer" target="_blank">
                <MessageCircle size={17} />
                Avisar por WhatsApp
              </a>
            )}
            {canManage && open && (
              <button className="button button--secondary" onClick={() => setModal('edit')} type="button">
                <PencilLine size={17} />
                Corregir recepción
              </button>
            )}
            {canManage && order.status === 'TERMINADA' && (
              <button className="button button--secondary" onClick={() => setModal('reopen')} type="button">
                <RotateCcw size={17} />
                Reabrir
              </button>
            )}
            {canManage && order.status !== 'ENTREGADA' && order.status !== 'CANCELADA' && (
              <button className="button button--secondary" onClick={() => setModal('cancel')} type="button">
                <Ban size={17} />
                Cancelar
              </button>
            )}
            {canCollect && order.status === 'TERMINADA' && (
              <button className="button button--primary" onClick={() => setModal('deliver')} type="button">
                <Truck size={17} />
                Cobrar y entregar
              </button>
            )}
          </div>
        </header>

        {canManage && order.status === 'TERMINADA' && !whatsapp && (
          <p className="form-alert" role="note">
            {order.client.phone
              ? `El teléfono "${order.client.phone}" no parece un celular: avisale al cliente por otro medio o corregí la recepción.`
              : 'La orden no tiene teléfono del cliente: para avisarle por WhatsApp, cargalo en Corregir recepción.'}
          </p>
        )}

        {order.receptionNotes && (
          <section className="service-card service-card--note" aria-label="Observaciones de la recepción">
            <h2>Lo que pidió el cliente</h2>
            <p>{order.receptionNotes}</p>
          </section>
        )}

        {workshopView ? (
          // El mecánico casi nunca necesita los datos del cliente: quedan plegados.
          <details className="service-more">
            <summary>Datos del cliente y de la moto</summary>
            <div className="service-cards">
              {clientCard}
              {vehicleCard}
            </div>
          </details>
        ) : (
          <div className="service-cards">
            {clientCard}
            {vehicleCard}
          </div>
        )}

        <section className="service-card" aria-label="Tareas">
          <div className="service-card__header">
            <h2>Tareas / mantenimiento</h2>
            {editable && pendingTasks > 0 && (
              <button className="button button--secondary service-all-yes" onClick={markPendingYes} type="button">
                <CheckCheck size={16} />
                Marcar las que faltan en Sí
              </button>
            )}
          </div>
          {editable && totalTasks > 0 && (
            <div className="service-progress">
              <div
                aria-label="Tareas marcadas"
                aria-valuemax={totalTasks}
                aria-valuemin={0}
                aria-valuenow={doneTasks}
                className="service-progress__bar"
                role="progressbar"
              >
                <span style={{ width: `${(doneTasks / totalTasks) * 100}%` }} />
              </div>
              <span>
                {pendingTasks ? `${doneTasks} de ${totalTasks} marcadas` : 'Todas marcadas'}
              </span>
            </div>
          )}
          <ol className="service-tasks">
            {draft.tasks.map((task, index) => {
              const name = task.description || `tarea ${index + 1}`
              // La observación se ve si ya tiene texto, si se marcó "No" o si la pidió.
              const showNotes = !!task.notes || task.done === false || notesOpen.has(index)
              return (
                <li className={`service-task${task.done === null ? '' : ' service-task--marked'}`} key={index}>
                  <span className="service-task__number">{index + 1}</span>
                  {editable && !order.tasks[index] ? (
                    <input
                      aria-label={`Tarea ${index + 1}`}
                      className="service-task__description"
                      maxLength={160}
                      onChange={(event) => setTask(index, { description: event.target.value })}
                      placeholder="Qué se le hizo"
                      value={task.description}
                    />
                  ) : (
                    <span className="service-task__description">{task.description}</span>
                  )}
                  <div className="service-task__controls">
                    <YesNo
                      disabled={!editable}
                      label={`Realizado: ${name}`}
                      onChange={(done) => setTask(index, { done })}
                      value={task.done}
                    />
                    {editable && !showNotes && (
                      <button
                        aria-label={`Agregar observación: ${name}`}
                        className="icon-button service-task__note-toggle"
                        onClick={() => setNotesOpen((current) => new Set(current).add(index))}
                        title="Agregar observación"
                        type="button"
                      >
                        <MessageSquarePlus size={18} />
                      </button>
                    )}
                    {/* Mantiene el Sí/No alineado con el resto cuando la nota ya está abierta. */}
                    {editable && showNotes && <span aria-hidden="true" className="service-task__note-spacer" />}
                  </div>
                  {editable && showNotes && (
                    <input
                      aria-label={`Observación: ${name}`}
                      autoFocus={notesOpen.has(index) && !task.notes}
                      className="service-task__notes"
                      maxLength={500}
                      onChange={(event) => setTask(index, { notes: event.target.value })}
                      placeholder={task.done === false ? '¿Por qué no se hizo? (opcional)' : 'Observación'}
                      value={task.notes ?? ''}
                    />
                  )}
                  {!editable && task.notes && <span className="service-task__notes">{task.notes}</span>}
                </li>
              )
            })}
          </ol>
          {editable && (
            <button
              className="button button--secondary"
              onClick={() =>
                edit((current) => ({
                  ...current,
                  tasks: [...current.tasks, { description: '', done: null, notes: null }],
                }))
              }
              type="button"
            >
              <Plus size={16} />
              Agregar tarea
            </button>
          )}
        </section>

        <section className="service-card" aria-label="Cambio de aceite y próximo service">
          <h2>Aceite y próximo service</h2>
          <div className="service-oil">
            <label className="field">
              <span>Tipo de aceite</span>
              <input disabled={!editable} maxLength={80} onChange={(event) => edit((current) => ({ ...current, oil: { ...current.oil, type: event.target.value } }))} placeholder="Motul 5100" value={draft.oil.type ?? ''} />
            </label>
            <label className="field">
              <span>Viscosidad</span>
              <input disabled={!editable} maxLength={40} onChange={(event) => edit((current) => ({ ...current, oil: { ...current.oil, viscosity: event.target.value } }))} placeholder="10W40" value={draft.oil.viscosity ?? ''} />
            </label>
            <label className="field">
              <span>Cantidad (litros)</span>
              <input
                disabled={!editable}
                inputMode="decimal"
                max={100}
                min={0}
                onChange={(event) =>
                  edit((current) => ({
                    ...current,
                    oil: { ...current.oil, liters: event.target.value === '' ? null : Number(event.target.value) },
                  }))
                }
                step="0.1"
                type="number"
                value={draft.oil.liters ?? ''}
              />
            </label>
            <div className="field">
              <span>Filtro de aceite</span>
              <YesNo
                disabled={!editable}
                label="Filtro de aceite"
                onChange={(filter) => edit((current) => ({ ...current, oil: { ...current.oil, filter } }))}
                value={draft.oil.filter}
              />
            </div>
            <label className="field">
              <span>Km próximo service</span>
              <input
                disabled={!editable}
                inputMode="numeric"
                min={0}
                onChange={(event) => edit((current) => ({ ...current, nextServiceKm: event.target.value }))}
                type="number"
                value={draft.nextServiceKm}
              />
            </label>
          </div>
          {order.signedBy && (
            <p className="service-signature">
              <Check size={16} /> Firmado por <strong>{order.signedBy.fullName}</strong> el {formatDateTime(order.signedAt)}
            </p>
          )}
        </section>

        <section className="service-card" aria-label="Repuestos y materiales">
          <div className="service-card__header">
            <h2>Repuestos / materiales utilizados</h2>
            {draftPartsTotal > 0 && <strong>Total: {formatMoney(draftPartsTotal.toFixed(2), 'ARS')}</strong>}
          </div>
          {draft.parts.length === 0 && !editable && <p className="service-empty">No se cargaron repuestos.</p>}
          {draft.parts.length > 0 && editable && (
            <ul className="service-part-rows">
              {draft.parts.map((part, index) => (
                <li className="service-part-row" key={index}>
                  <label className="field service-part-row__description">
                    <span>Repuesto</span>
                    <input aria-label={`Descripción del repuesto ${index + 1}`} maxLength={200} onChange={(event) => setPart(index, { description: event.target.value })} placeholder="Filtro de aceite" value={part.description} />
                  </label>
                  <label className="field">
                    <span>Código</span>
                    <input aria-label={`Código del repuesto ${index + 1}`} maxLength={60} onChange={(event) => setPart(index, { code: event.target.value })} value={part.code ?? ''} />
                  </label>
                  <label className="field">
                    <span>Cant.</span>
                    <input aria-label={`Cantidad del repuesto ${index + 1}`} inputMode="decimal" min={0.01} onChange={(event) => setPart(index, { quantity: event.target.value })} step="0.01" type="number" value={part.quantity} />
                  </label>
                  <label className="field">
                    <span>Precio unit.</span>
                    <input aria-label={`Precio del repuesto ${index + 1}`} inputMode="decimal" min={0} onChange={(event) => setPart(index, { unitPrice: event.target.value || null })} step="0.01" type="number" value={part.unitPrice ?? ''} />
                  </label>
                  <button
                    aria-label={`Quitar el repuesto ${index + 1}`}
                    className="icon-button service-part-row__remove"
                    onClick={() => edit((current) => ({ ...current, parts: current.parts.filter((_, position) => position !== index) }))}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {draft.parts.length > 0 && !editable && (
            <div className="financial-table-wrap">
              <table className="financial-table service-parts">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Cant.</th>
                    <th>Precio unit.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.parts.map((part, index) => (
                    <tr key={index}>
                      <td>{part.code || '—'}</td>
                      <td>{part.description}</td>
                      <td>{part.quantity}</td>
                      <td>{part.unitPrice ? formatMoney(part.unitPrice, 'ARS') : '—'}</td>
                      <td>{part.unitPrice ? formatMoney((Number(part.unitPrice) * (Number(part.quantity) || 0)).toFixed(2), 'ARS') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editable && (
            <button
              className="button button--secondary"
              onClick={() =>
                edit((current) => ({
                  ...current,
                  parts: [...current.parts, { code: '', description: '', quantity: '1', unitPrice: null }],
                }))
              }
              type="button"
            >
              <Plus size={16} />
              Agregar repuesto
            </button>
          )}
        </section>

        <section className="service-card" aria-label="Observaciones y diagnóstico">
          <h2>Observaciones / diagnóstico</h2>
          {editable ? (
            <textarea
              aria-label="Diagnóstico"
              maxLength={4000}
              onChange={(event) => edit((current) => ({ ...current, diagnosis: event.target.value }))}
              placeholder="Lo que encontraste y lo que hiciste."
              rows={3}
              value={draft.diagnosis}
            />
          ) : (
            <p>{order.diagnosis ?? '—'}</p>
          )}
        </section>

        {order.delivery && (
          <section className="service-card" aria-label="Entrega">
            <h2>Entrega del vehículo</h2>
            <dl>
              <div><dt>Entregada</dt><dd>{formatDateTime(order.delivery.at)}{order.delivery.by ? ` por ${order.delivery.by.fullName}` : ''}</dd></div>
              <div><dt>Estado</dt><dd>{order.delivery.vehicleCondition ? conditionLabels[order.delivery.vehicleCondition] : '—'}</dd></div>
              {order.delivery.amount !== undefined && (
                <div><dt>Cobrado</dt><dd>{Number(order.delivery.amount) > 0 ? formatMoney(order.delivery.amount ?? '0', 'ARS') : 'Sin cobro'}</dd></div>
              )}
              {order.delivery.notes && <div><dt>Observaciones</dt><dd>{order.delivery.notes}</dd></div>}
            </dl>
          </section>
        )}

        {order.cancellation && (
          <section className="service-card service-card--note" aria-label="Cancelación">
            <h2>Cancelada</h2>
            <p>{formatDateTime(order.cancellation.at)}: {order.cancellation.reason}</p>
          </section>
        )}

        {editable && (
          <div className="service-actions">
            {workError && <div className="form-alert form-alert--error" role="alert">{workError}</div>}
            <span className="service-actions__progress">
              {pendingTasks ? `Faltan marcar ${pendingTasks}` : 'Todas las tareas marcadas'}
              {dirty && <small>Sin guardar</small>}
            </span>
            <button className="button button--secondary" disabled={busy !== null} onClick={() => void save(false)} type="button">
              {busy === 'save' ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
              Guardar avance
            </button>
            <button
              className="button button--primary"
              disabled={busy !== null}
              onClick={() => {
                if (pendingTasks) {
                  setWorkError(`Marcá Sí o No en todas las tareas antes de firmar (faltan ${pendingTasks}).`)
                  return
                }
                setConfirmFinish(true)
              }}
              type="button"
            >
              <Check size={17} />
              Terminar y firmar
            </button>
          </div>
        )}
      </div>

      <ServiceOrderPrint order={order} />

      {confirmFinish && (
        <ConfirmPreviewModal
          busy={busy === 'finish'}
          confirmLabel="Firmar"
          description="Al firmar, la orden pasa a la administración para cobrarla y entregarla. Ya no la vas a poder modificar."
          eyebrow="SERVICE"
          onBack={() => setConfirmFinish(false)}
          onConfirm={() => void save(true)}
          sections={[
            {
              title: 'Trabajo',
              rows: [
                { label: 'Tareas hechas', value: `${draft.tasks.filter((task) => task.done === true).length} de ${draft.tasks.filter((task) => task.description.trim()).length}` },
                { label: 'Aceite', value: [draft.oil.type, draft.oil.viscosity].filter(Boolean).join(' ') || 'Sin cambio' },
                { label: 'Repuestos', value: draft.parts.filter((part) => part.description.trim()).length || 'Ninguno' },
                { label: 'Km próximo service', value: draft.nextServiceKm ? formatKm(Number(draft.nextServiceKm)) : '—' },
              ],
            },
          ]}
          title={`Firmar la orden ${orderNumber(order.number)}`}
        />
      )}
      {modal === 'edit' && (
        <ServiceReceptionModal
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            replace(saved)
            setModal(null)
            void alertSuccess('Recepción corregida.')
          }}
          order={order}
        />
      )}
      {modal === 'deliver' && (
        <ServiceDeliveryModal
          onClose={() => setModal(null)}
          onDelivered={(delivered) => {
            replace(delivered)
            setModal(null)
          }}
          order={order}
          suggestedPrice={suggestedPrice}
        />
      )}
      {modal === 'reopen' && (
        <ReasonModal
          confirmLabel="Reabrir"
          description="Vuelve al taller y se borra la firma: el mecánico la corrige y la vuelve a firmar."
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            replace(await reopenServiceOrder(order.id, order.version, reason))
            setModal(null)
          }}
          title={`Reabrir la orden ${orderNumber(order.number)}`}
        />
      )}
      {modal === 'cancel' && (
        <ReasonModal
          confirmLabel="Cancelar la orden"
          description="La orden queda cancelada y ya no se trabaja ni se cobra."
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            replace(await cancelServiceOrder(order.id, order.version, reason))
            setModal(null)
          }}
          title={`Cancelar la orden ${orderNumber(order.number)}`}
        />
      )}
    </>
  )
}

