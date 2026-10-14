import { BellRing, Check, MessageCircle, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApiError } from '../../shared/api/client'
import { alertError, alertSuccess } from '../../shared/alerts'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import {
  allowedBranchIds,
  branchScopeKey,
  filterAllowedBranches,
} from '../auth/branchScope'
import { listInventoryBranches } from '../finance/api'
import type { BranchOption } from '../finance/types'
import { formatDateTime, formatDay } from './format'
import {
  dueLabel,
  listServiceReminders,
  reminderVehicle,
  reminderWhatsappLink,
  reopenServiceReminder,
  resolveServiceReminder,
  type ReminderChannel,
  type ServiceReminder,
} from './reminders'
import { HomeFilterNotice, useHomeFilters } from '../../shared/homeFilters'

const TABS = [
  { id: 'PENDING', label: 'Para contactar' },
  { id: 'RESOLVED', label: 'Contactados y descartados' },
] as const

type TabId = (typeof TABS)[number]['id']

const CHANNEL_LABELS: Record<ReminderChannel, string> = {
  WHATSAPP: 'por WhatsApp',
  TELEFONO: 'por teléfono',
  OTRO: '',
}

function errorText(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message
  return 'No pudimos guardar el aviso. Intentá nuevamente.'
}

const reminderKey = (reminder: ServiceReminder) =>
  `${reminder.unitId}|${reminder.stage}|${reminder.dueDate}`

/**
 * Avisos de service: los clientes a los que les toca el service esta semana
 * (o se les pasó hace poco). El botón de WhatsApp abre el chat del cliente
 * con el mensaje escrito y deja el aviso como contactado.
 */
export function ServiceRemindersPage() {
  const { user } = useAuth()
  const scopeKey = branchScopeKey(user)
  // Desde una tarjeta del inicio: la sucursal elegida.
  const home = useHomeFilters([])
  const [tab, setTab] = useState<TabId>('PENDING')
  const [branchId, setBranchId] = useState(home.branchId ?? '')
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [items, setItems] = useState<ServiceReminder[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const allowed = allowedBranchIds(scopeKey)
    if (allowed && allowed.length < 2) return
    const controller = new AbortController()
    listInventoryBranches(controller.signal)
      .then((rows) => setBranches(filterAllowedBranches(scopeKey, rows)))
      .catch(() => undefined)
    return () => controller.abort()
  }, [scopeKey])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    listServiceReminders(tab, branchId, controller.signal)
      .then((result) => {
        setItems(result.items)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(
          error instanceof ApiError && error.status === 403
            ? 'No tenés permiso para ver los avisos de service.'
            : 'No pudimos cargar los avisos. Intentá nuevamente.',
        )
        setStatus('error')
      })
    return () => controller.abort()
  }, [tab, branchId, refreshKey])

  const reload = () => setRefreshKey((value) => value + 1)

  const resolve = async (
    reminder: ServiceReminder,
    resolution: 'CONTACTADO' | 'DESCARTADO',
    channel?: ReminderChannel,
  ) => {
    setBusy(reminderKey(reminder))
    try {
      await resolveServiceReminder(reminder, resolution, channel)
      // Sale de la lista sin esperar la recarga.
      setItems((current) => current.filter((item) => reminderKey(item) !== reminderKey(reminder)))
      if (resolution === 'DESCARTADO')
        void alertSuccess(`El aviso de ${reminder.client.name} se descartó.`)
    } catch (error) {
      void alertError(errorText(error), 'No se pudo guardar el aviso')
    } finally {
      setBusy(null)
    }
  }

  const openWhatsapp = (reminder: ServiceReminder, link: string) => {
    // Se abre en el mismo clic (si no, el navegador bloquea la ventana) y
    // después se marca como contactado.
    // Siempre en una pestaña nueva: reusar una pestaña con WhatsApp Web
    // abierto la dejaba en la pantalla principal, sin el chat.
    window.open(link, '_blank', 'noopener')
    void resolve(reminder, 'CONTACTADO', 'WHATSAPP')
  }

  const reopen = async (reminder: ServiceReminder) => {
    setBusy(reminderKey(reminder))
    try {
      await reopenServiceReminder(reminder)
      setItems((current) => current.filter((item) => reminderKey(item) !== reminderKey(reminder)))
    } catch (error) {
      void alertError(errorText(error), 'No se pudo reabrir el aviso')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">TALLER</p>
          <h1>Avisos de service</h1>
          <p>
            Clientes a los que les toca el service en los próximos 7 días (o se les pasó en
            el último mes): el 1º, a los 30 días de entregada la moto, y después uno por año
            desde el último service.
          </p>
        </div>
      </header>

      <HomeFilterNotice
        origin={home.origin}
        onClear={() => {
          home.clear()
          setBranchId('')
        }}
      />

      <div className="service-tabs" role="tablist" aria-label="Avisos">
        {TABS.map((item) => (
          <button
            aria-selected={tab === item.id}
            className={`service-tab${tab === item.id ? ' service-tab--active' : ''}`}
            key={item.id}
            onClick={() => setTab(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
        {branches.length > 1 && (
          <label className="filter-field reminders-branch">
            <span>Sucursal</span>
            <select onChange={(event) => setBranchId(event.target.value)} value={branchId}>
              <option value="">Todas</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section className="financial-panel" aria-label="Avisos de service">
        {status === 'loading' && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando avisos…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            action={
              <button className="button button--primary" onClick={reload} type="button">
                <RefreshCw size={17} />
                Reintentar
              </button>
            }
            description={loadError}
            icon={BellRing}
            title="No pudimos cargar los avisos"
            tone="danger"
          />
        )}
        {status === 'success' && items.length === 0 && (
          <p className="financial-empty-note">
            {tab === 'PENDING'
              ? 'No hay clientes para contactar esta semana.'
              : 'Todavía no hay avisos resueltos de esta semana.'}
          </p>
        )}
        {status === 'success' && items.length > 0 && (
          <div className="financial-table-wrap">
            <table className="financial-table reminders-table">
              <thead>
                <tr>
                  <th>Le toca</th>
                  <th>Service</th>
                  <th>Cliente</th>
                  <th>Moto</th>
                  <th>Venta</th>
                  <th>{tab === 'PENDING' ? 'Contactar' : 'Resuelto'}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((reminder) => {
                  const link = reminderWhatsappLink(reminder)
                  const key = reminderKey(reminder)
                  return (
                    <tr key={key}>
                      <td>
                        <strong>{formatDay(reminder.dueDate)}</strong>
                        <small className={reminder.daysToDue < 0 ? 'reminders-overdue' : undefined}>
                          {dueLabel(reminder.daysToDue)}
                        </small>
                      </td>
                      <td>
                        <strong>{reminder.serviceName}</strong>
                        <small>
                          {reminder.lastServiceDate
                            ? `Último: ${formatDay(reminder.lastServiceDate)}`
                            : 'Primer service'}
                        </small>
                      </td>
                      <td>
                        <strong>{reminder.client.name}</strong>
                        <small>{reminder.client.phone ?? 'Sin teléfono'}</small>
                      </td>
                      <td>
                        <strong>{reminderVehicle(reminder)}</strong>
                        <small>{reminder.vehicle.vin}</small>
                      </td>
                      <td>
                        <strong>#{reminder.operation.number}</strong>
                        <small>
                          Entregada el {formatDay(reminder.deliveredAt)} · {reminder.branch.name}
                        </small>
                      </td>
                      <td>
                        {tab === 'PENDING' ? (
                          <div className="reminders-actions">
                            {link ? (
                              <button
                                aria-label={`Escribir por WhatsApp a ${reminder.client.name}`}
                                className="button button--primary button--compact reminders-whatsapp"
                                disabled={busy === key}
                                onClick={() => openWhatsapp(reminder, link)}
                                type="button"
                              >
                                <MessageCircle size={15} />
                                WhatsApp
                              </button>
                            ) : (
                              <small>El teléfono no parece un celular.</small>
                            )}
                            <button
                              className="button button--secondary button--compact"
                              disabled={busy === key}
                              onClick={() => void resolve(reminder, 'CONTACTADO', 'TELEFONO')}
                              title="Lo llamaste o le escribiste por otro medio"
                              type="button"
                            >
                              <Check size={15} />
                              Ya lo contacté
                            </button>
                            <button
                              aria-label={`Descartar el aviso de ${reminder.client.name}`}
                              className="button button--secondary button--compact"
                              disabled={busy === key}
                              onClick={() => void resolve(reminder, 'DESCARTADO')}
                              title="No corresponde avisarle (vendió la moto, ya lo hizo en otro lado…)"
                              type="button"
                            >
                              <X size={15} />
                              Descartar
                            </button>
                          </div>
                        ) : (
                          <div className="reminders-actions">
                            <span>
                              <strong>
                                {reminder.resolution?.status === 'DESCARTADO'
                                  ? 'Descartado'
                                  : `Contactado ${CHANNEL_LABELS[reminder.resolution?.channel ?? 'OTRO']}`}
                              </strong>
                              <small>
                                {formatDateTime(reminder.resolution?.at)}
                                {reminder.resolution?.by ? ` · ${reminder.resolution.by}` : ''}
                              </small>
                            </span>
                            <button
                              className="button button--secondary button--compact"
                              disabled={busy === key}
                              onClick={() => void reopen(reminder)}
                              type="button"
                            >
                              <RotateCcw size={15} />
                              Volver a pendiente
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {tab === 'PENDING' && (
        <p className="financial-summary-note">
          WhatsApp abre el chat del cliente con el mensaje escrito: revisalo y mandalo desde ahí. El
          aviso queda como contactado. Una moto que ya está en el taller no aparece.
        </p>
      )}
    </>
  )
}
