import { ArrowLeft, LoaderCircle, Pencil, Plus, RefreshCw, Settings2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { alertSuccess } from '../../shared/alerts'
import { StatePanel } from '../../shared/components/StatePanel'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { formatMoney } from '../finance/format'
import { createServiceType, listServiceTypes, updateServiceType } from './api'
import { serviceErrorMessage } from './format'
import type { ServiceType } from './types'

// Las 15 tareas de la planilla en papel: el punto de partida de un tipo nuevo.
const PAPER_TASKS = [
  'Cambio de aceite de motor',
  'Cambio de filtro de aceite',
  'Revisión y ajuste de cadena / transmisión',
  'Revisión de frenos (delantero y trasero)',
  'Revisión de presión y estado de neumáticos',
  'Revisión de luces e iluminación',
  'Revisión de batería y sistema de carga',
  'Revisión de bujía',
  'Limpieza de filtro de aire',
  'Revisión de suspensión delantera',
  'Revisión de suspensión trasera',
  'Revisión de cables y comandos',
  'Ajuste de tornillería general',
  'Diagnóstico electrónico',
  'Prueba de funcionamiento',
]

function TypeModal({
  type,
  nextOrder,
  onClose,
  onSaved,
}: {
  type: ServiceType | null
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(type?.name ?? '')
  const [order, setOrder] = useState(String(type?.order ?? nextOrder))
  const [price, setPrice] = useState(type?.suggestedPrice ? String(Number(type.suggestedPrice)) : '')
  const [active, setActive] = useState(type?.active ?? true)
  const [tasks, setTasks] = useState((type?.tasks ?? PAPER_TASKS).join('\n'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useDialogFocus(onClose, busy)
  const taskList = tasks
    .split('\n')
    .map((task) => task.trim())
    .filter(Boolean)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Escribí el nombre del tipo de service.')
      return
    }
    if (taskList.length === 0) {
      setError('Cargá al menos una tarea, una por renglón.')
      return
    }
    if (taskList.some((task) => task.length > 160)) {
      setError('Cada tarea puede tener hasta 160 caracteres.')
      return
    }
    if (price !== '' && !(Number(price) >= 0)) {
      setError('El precio tiene que ser un número.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const input = {
        name: name.trim(),
        order: Number(order) || 0,
        tasks: taskList,
        suggestedPrice: price === '' ? null : Number(price).toFixed(2),
        active,
      }
      if (type) await updateServiceType(type.id, input)
      else await createServiceType(input)
      void alertSuccess(type ? 'Tipo de service actualizado.' : 'Tipo de service creado.')
      onSaved()
    } catch (failure) {
      setError(serviceErrorMessage(failure))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-labelledby="service-type-title" aria-modal="true" className="client-modal" ref={dialogRef} role="dialog">
        <div className="client-modal__header">
          <div>
            <p className="eyebrow">TIPOS DE SERVICE</p>
            <h2 id="service-type-title">{type ? `Editar ${type.name}` : 'Nuevo tipo de service'}</h2>
            <p>Las tareas son el checklist que le aparece al mecánico. Cambiarlas no toca las motos que ya se recibieron.</p>
          </div>
          <button aria-label="Cerrar" className="icon-button" disabled={busy} onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="client-form-grid">
            <label className="field">
              <span>Nombre *</span>
              <input maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="1º service" value={name} />
            </label>
            <label className="field">
              <span>Orden en la lista</span>
              <input max={999} min={0} onChange={(event) => setOrder(event.target.value)} type="number" value={order} />
              <small>Define cuál se propone después de cuál (1º, 2º, 3º…).</small>
            </label>
            <label className="field">
              <span>Precio sugerido</span>
              <input min={0} onChange={(event) => setPrice(event.target.value)} placeholder="Sin precio" step="0.01" type="number" value={price} />
              <small>Se propone al cobrar; se puede cambiar en cada entrega.</small>
            </label>
            <label className="field service-type-active">
              <input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" />
              <span>Activo (se puede elegir al recibir una moto)</span>
            </label>
            <label className="field field--wide">
              <span>Tareas * (una por renglón · {taskList.length})</span>
              <textarea onChange={(event) => setTasks(event.target.value)} rows={12} value={tasks} />
            </label>
          </div>
          <div className="client-modal__actions">
            <button className="button button--secondary" disabled={busy} onClick={onClose} type="button">Cancelar</button>
            <button className="button button--primary" disabled={busy} type="submit">
              {busy && <LoaderCircle className="spin" size={17} />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ServiceTypesPage() {
  const [types, setTypes] = useState<ServiceType[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editing, setEditing] = useState<ServiceType | 'new' | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    listServiceTypes(controller.signal, true)
      .then((items) => {
        setTypes(items)
        setStatus('success')
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(serviceErrorMessage(failure))
        setStatus('error')
      })
    return () => controller.abort()
  }, [refreshKey])

  const nextOrder = types.reduce((max, type) => Math.max(max, type.order), 0) + 1

  return (
    <>
      <Link className="service-back" to="/service">
        <ArrowLeft size={16} />
        Service
      </Link>
      <header className="page-heading">
        <div>
          <p className="eyebrow">TALLER</p>
          <h1>Tipos de service</h1>
          <p>Qué tareas lleva cada service y cuánto se cobra. El precio se propone al entregar la moto.</p>
        </div>
        <div className="page-heading__actions">
          <button className="button button--primary" onClick={() => setEditing('new')} type="button">
            <Plus size={18} />
            Nuevo tipo
          </button>
        </div>
      </header>

      {status === 'loading' && (
        <div className="financial-loading">
          <div className="loading-mark" />
          <span>Cargando tipos…</span>
        </div>
      )}
      {status === 'error' && (
        <StatePanel
          icon={RefreshCw}
          title="No pudimos cargar los tipos de service"
          description={loadError}
          tone="danger"
          action={
            <button className="button button--primary" onClick={() => setRefreshKey((key) => key + 1)} type="button">
              <RefreshCw size={17} />
              Reintentar
            </button>
          }
        />
      )}
      {status === 'success' && types.length === 0 && (
        <StatePanel icon={Settings2} title="No hay tipos de service" description="Creá el primero con Nuevo tipo." />
      )}
      {status === 'success' && types.length > 0 && (
        <div className="service-cards">
          {types.map((type) => (
            <section aria-label={type.name} className="service-card" key={type.id}>
              <div className="service-card__header">
                <h2>{type.name}</h2>
                <span className={`status-badge ${type.active ? 'status-badge--success' : ''}`}>
                  {type.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <dl>
                <div><dt>Precio</dt><dd>{type.suggestedPrice ? formatMoney(type.suggestedPrice, 'ARS') : 'Sin precio'}</dd></div>
                <div><dt>Tareas</dt><dd>{type.tasks.length}</dd></div>
              </dl>
              <ol className="service-type-tasks">
                {type.tasks.map((task) => <li key={task}>{task}</li>)}
              </ol>
              <button className="button button--secondary" onClick={() => setEditing(type)} type="button">
                <Pencil size={16} />
                Editar
              </button>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <TypeModal
          nextOrder={nextOrder}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setRefreshKey((key) => key + 1)
          }}
          type={editing === 'new' ? null : editing}
        />
      )}
    </>
  )
}
