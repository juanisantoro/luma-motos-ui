import { CalendarRange, RefreshCw, Scissors } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApiError, NetworkError } from '../../shared/api/client'
import { alertError, alertSuccess } from '../../shared/alerts'
import { StatePanel } from '../../shared/components/StatePanel'
import {
  formatDay,
  listWorkMonths,
  removeWorkMonthCut,
  setWorkMonthCut,
  type WorkMonth,
  type WorkMonths,
} from '../../shared/work-months/workMonths'

const monthFormatter = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function workMonthName(period: string) {
  const [year, month] = period.split('-').map(Number)
  const label = monthFormatter.format(new Date(Date.UTC(year!, month! - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Hoy en Argentina, "AAAA-MM-DD". */
export function argentinaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message
  return 'No pudimos guardar el corte. Intentá nuevamente.'
}

function dayCount(from: string, to: string) {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Math.round(ms / 86_400_000) + 1
}

export function WorkMonthsPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [data, setData] = useState<WorkMonths | null>(null)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    listWorkMonths(controller.signal)
      .then((result) => {
        setData(result)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(errorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [refreshKey])

  const reload = () => setRefreshKey((value) => value + 1)
  const today = argentinaToday()
  const current = data?.months.find((month) => month.current) ?? null
  const canCloseToday =
    current !== null && !current.locked && today >= current.cutMin && today <= current.cutMax

  const startEditing = (month: WorkMonth) => {
    setEditing(month.period)
    setDraft(month.cutDate ?? month.to)
  }

  const save = async (period: string, cutDate: string, message: string) => {
    setSaving(true)
    try {
      await setWorkMonthCut(period, cutDate)
      setEditing(null)
      void alertSuccess(message)
      reload()
    } catch (error) {
      void alertError(errorMessage(error), 'No se pudo guardar el corte')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (month: WorkMonth) => {
    setSaving(true)
    try {
      await removeWorkMonthCut(month.period)
      setEditing(null)
      void alertSuccess(`${workMonthName(month.period)} vuelve a terminar el último día del mes.`)
      reload()
    } catch (error) {
      void alertError(errorMessage(error), 'No se pudo quitar el corte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">CONFIGURACIÓN</p>
          <h1>Meses de trabajo</h1>
          <p>
            Cuándo termina cada mes. El inicio, las comisiones y el filtro por mes de Ingresos,
            Gastos, Compras y Ventas usan estas fechas. Un mes sin corte termina el último día del
            almanaque.
          </p>
        </div>
        {current && (
          <div className="page-heading__actions">
            <button
              className="button button--primary"
              disabled={!canCloseToday || saving}
              onClick={() =>
                void save(
                  current.period,
                  today,
                  `${workMonthName(current.period)} terminó hoy. Desde mañana corre el mes siguiente.`,
                )
              }
              title={
                canCloseToday
                  ? undefined
                  : `El corte de ${workMonthName(current.period)} tiene que caer entre el ${formatDay(current.cutMin)} y el ${formatDay(current.cutMax)}.`
              }
              type="button"
            >
              <Scissors size={18} />
              Cerrar {workMonthName(current.period).split(' ')[0]} hoy
            </button>
          </div>
        )}
      </header>

      <p className="financial-summary-note">
        El corte de un mes tiene que caer entre el 15 de ese mes y el 14 del siguiente. El mes
        siguiente arranca solo, el día después del corte. Un corte no se puede mover si ya hay
        comisiones liquidadas de ese mes o del siguiente.
      </p>

      <section aria-label="Meses de trabajo" className="financial-panel">
        {status === 'loading' && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando meses…</span>
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
            icon={CalendarRange}
            title="No pudimos cargar los meses"
            tone="danger"
          />
        )}
        {status === 'success' && data && (
          <div className="financial-table-wrap">
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th>Días</th>
                  <th>Corte</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((month) => {
                  const name = workMonthName(month.period)
                  const isEditing = editing === month.period
                  return (
                    <tr key={month.period}>
                      <td>
                        <strong>{name}</strong>
                        {month.current && (
                          <span className="status-badge status-badge--success work-month-badge">En curso</span>
                        )}
                      </td>
                      <td>{formatDay(month.from, true)}</td>
                      <td>{formatDay(month.to, true)}</td>
                      <td>{dayCount(month.from, month.to)}</td>
                      <td>
                        {isEditing ? (
                          <input
                            aria-label={`Corte de ${name}`}
                            className="work-month-input"
                            max={month.cutMax}
                            min={month.cutMin}
                            onChange={(event) => setDraft(event.target.value)}
                            type="date"
                            value={draft}
                          />
                        ) : month.cutDate ? (
                          <>
                            <strong>{formatDay(month.cutDate, true)}</strong>
                            <small>Definido</small>
                          </>
                        ) : (
                          <small>Fin de mes</small>
                        )}
                        {month.locked && <small>Con comisiones liquidadas</small>}
                      </td>
                      <td className="financial-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="button button--primary button--compact"
                              disabled={saving || !draft || draft < month.cutMin || draft > month.cutMax}
                              onClick={() =>
                                void save(month.period, draft, `${name} termina el ${formatDay(draft, true)}.`)
                              }
                              type="button"
                            >
                              Guardar
                            </button>
                            <button
                              className="button button--secondary button--compact"
                              disabled={saving}
                              onClick={() => setEditing(null)}
                              type="button"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              aria-label={`${month.cutDate ? 'Cambiar' : 'Definir'} corte de ${name}`}
                              className="button button--secondary button--compact"
                              disabled={saving || month.locked}
                              onClick={() => startEditing(month)}
                              title={month.locked ? 'Ya hay comisiones liquidadas de este mes o del siguiente.' : undefined}
                              type="button"
                            >
                              {month.cutDate ? 'Cambiar' : 'Definir corte'}
                            </button>
                            {month.cutDate && (
                              <button
                                aria-label={`Quitar corte de ${name}`}
                                className="button button--secondary button--compact"
                                disabled={saving || month.locked}
                                onClick={() => void remove(month)}
                                type="button"
                              >
                                Quitar
                              </button>
                            )}
                          </>
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
    </>
  )
}
