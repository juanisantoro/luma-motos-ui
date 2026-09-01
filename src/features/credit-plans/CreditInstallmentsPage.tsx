import { ChevronLeft, ChevronRight, Filter, HandCoins, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { alertError, alertSuccess } from '../../shared/alerts'
import { StatePanel } from '../../shared/components/StatePanel'
import { ApiError } from '../../shared/api/client'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { listCreditInstallments, payCreditInstallment } from './api'
import {
  creditPlansErrorMessage,
  formatDate,
  formatMoney,
  installmentStatusLabels,
  installmentStatusTone,
} from './format'
import { PayCreditInstallmentModal } from './PayCreditInstallmentModal'
import type {
  CreditInstallment,
  CreditInstallmentQuery,
  CreditInstallmentStatus,
  PageResponse,
} from './types'

const PAGE_SIZE = 20

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return 'No tenés permiso para ver estas cuotas.'
  }
  return 'No pudimos cargar las cuotas. Intentá nuevamente.'
}

export function CreditInstallmentsPage() {
  const { user } = useAuth()
  const permissions = user?.role.permissions ?? []
  const canCollect = hasPermission(permissions, 'creditos.cobrar')

  const [query, setQuery] = useState<CreditInstallmentQuery>({ page: 1, limit: PAGE_SIZE })
  const [draft, setDraft] = useState<CreditInstallmentQuery>({ page: 1, limit: PAGE_SIZE })
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [result, setResult] = useState<PageResponse<CreditInstallment> | null>(null)
  const [loadError, setLoadError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [payingInstallment, setPayingInstallment] = useState<CreditInstallment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const changeDraft = <K extends keyof CreditInstallmentQuery>(
    key: K,
    next: CreditInstallmentQuery[K],
  ) => setDraft((current) => ({ ...current, [key]: next || undefined }))

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setForbidden(false)
    setLoadError('')
    listCreditInstallments(query, controller.signal)
      .then((response) => {
        setResult(response)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setForbidden(error instanceof ApiError && error.status === 403)
        setLoadError(errorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [query, refreshKey])

  const reload = () => {
    setRefreshKey((current) => current + 1)
  }

  const applyFilters = () => setQuery({ ...draft, page: 1, limit: PAGE_SIZE })
  const clearFilters = () => {
    const cleared = { page: 1, limit: PAGE_SIZE }
    setDraft(cleared)
    setQuery(cleared)
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1

  const submitPayment = async (input: { amount: number; paymentDate: string }) => {
    if (!payingInstallment) return
    setSubmitting(true)
    setPayError(null)
    try {
      await payCreditInstallment(payingInstallment.id, input)
      setPayingInstallment(null)
      reload()
      void alertSuccess(`Cobro registrado para la cuota #${payingInstallment.number}.`)
    } catch (error) {
      const message = creditPlansErrorMessage(error)
      setPayError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">CRÉDITOS PERSONALES</p>
          <h1>Cobranza de cuotas</h1>
          <p>Seguimiento de cuotas pendientes, vencidas y pagadas de créditos personales.</p>
        </div>
      </header>

      <details className="financial-filters" open>
        <summary>
          <Filter size={17} aria-hidden="true" />
          Filtros
        </summary>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            applyFilters()
          }}
        >
          <div className="filter-field">
            <label htmlFor="ci-search">Buscar</label>
            <input
              id="ci-search"
              onChange={(event) => changeDraft('search', event.target.value)}
              placeholder="Cliente u operación…"
              value={draft.search ?? ''}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="ci-status">Estado</label>
            <select
              id="ci-status"
              onChange={(event) =>
                changeDraft('status', event.target.value as CreditInstallmentStatus)
              }
              value={draft.status ?? ''}
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="VENCIDA">Vencida</option>
              <option value="PARCIAL">Pago parcial</option>
              <option value="PAGADA">Pagada</option>
            </select>
          </div>
          <div className="financial-filter-actions">
            <button className="button button--primary" type="submit">
              Aplicar
            </button>
            <button className="button button--secondary" onClick={clearFilters} type="button">
              Limpiar
            </button>
          </div>
        </form>
      </details>

      <section className="financial-panel" aria-label="Listado de cuotas">
        {status === 'loading' && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando cuotas…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            icon={RefreshCw}
            title={forbidden ? 'No tenés acceso a estos registros' : 'No pudimos cargar las cuotas'}
            description={loadError}
            tone="danger"
            action={
              !forbidden ? (
                <button className="button button--primary" onClick={() => reload()} type="button">
                  <RefreshCw size={17} />
                  Reintentar
                </button>
              ) : undefined
            }
          />
        )}
        {status === 'success' && result?.items.length === 0 && (
          <StatePanel
            icon={HandCoins}
            title="No hay resultados"
            description="No encontramos cuotas para los filtros seleccionados."
          />
        )}
        {status === 'success' && result && result.items.length > 0 && (
          <div className="financial-table-wrap">
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Vencimiento</th>
                  <th>Cliente</th>
                  <th>Operación</th>
                  <th>Cuota</th>
                  <th>Importe</th>
                  <th>Pagado</th>
                  <th>Estado</th>
                  {canCollect && <th />}
                </tr>
              </thead>
              <tbody>
                {result.items.map((installment) => (
                  <tr key={installment.id}>
                    <td>{formatDate(installment.dueDate)}</td>
                    <td>{installment.clientName}</td>
                    <td>#{installment.operationNumber}</td>
                    <td>#{installment.number}</td>
                    <td>{formatMoney(installment.amount)}</td>
                    <td>{formatMoney(installment.paidAmount)}</td>
                    <td>
                      <span className={`status-badge${installmentStatusTone(installment.status)}`}>
                        {installmentStatusLabels[installment.status]}
                      </span>
                    </td>
                    {canCollect && (
                      <td className="financial-actions">
                        {installment.status !== 'PAGADA' && (
                          <button
                            className="button button--secondary"
                            onClick={() => {
                              setPayError(null)
                              setPayingInstallment(installment)
                            }}
                            type="button"
                          >
                            Cobrar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {status === 'success' && result && result.total > 0 && (
          <footer className="pagination">
            <span>
              {result.total} {result.total === 1 ? 'cuota' : 'cuotas'}
            </span>
            <div>
              <button
                aria-label="Página anterior"
                className="icon-button"
                disabled={(query.page ?? 1) <= 1}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: Math.max(1, (current.page ?? 1) - 1),
                  }))
                }
                type="button"
              >
                <ChevronLeft size={19} />
              </button>
              <strong>
                Página {result.page} de {totalPages}
              </strong>
              <button
                aria-label="Página siguiente"
                className="icon-button"
                disabled={(query.page ?? 1) >= totalPages}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: Math.min(totalPages, (current.page ?? 1) + 1),
                  }))
                }
                type="button"
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </footer>
        )}
      </section>

      {payingInstallment && (
        <PayCreditInstallmentModal
          error={payError}
          installment={payingInstallment}
          onClose={() => setPayingInstallment(null)}
          onSubmit={(input) => void submitPayment(input)}
          submitting={submitting}
        />
      )}
    </>
  )
}
