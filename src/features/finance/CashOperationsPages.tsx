import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  RefreshCw,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { alertSuccess } from '../../shared/alerts'
import { ApiError } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { localIsoDate } from '../../shared/utils/date'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import {
  createCashTransfer,
  createPartnerWithdrawal,
  listAllCashAccounts,
  listCashTransfers,
  listPartnerWithdrawals,
  reverseCashTransfer,
  reversePartnerWithdrawal,
} from './api'
import {
  cashAccountBranchId,
  cashAccountLabel,
  isImportedAccount,
} from './cashAccounts'
import {
  financialErrorMessage,
  formatDate,
  formatMoney,
  newIdempotencyKey,
} from './format'
import type {
  CashAccount,
  CashOperationQuery,
  CashTransfer,
  PageResponse,
  PartnerWithdrawal,
  PartnerWithdrawalPage,
} from './types'

const PAGE_SIZE = 50

type Status = 'loading' | 'success' | 'error'

function decimal(value: string) {
  return value.trim().replace(',', '.')
}

function validAmount(value: string) {
  return /^(0|[1-9]\d{0,15})(\.\d{1,2})?$/.test(value) && Number(value) > 0
}

/** Cuenta con su sucursal al lado, para no confundir cajas de dos locales. */
function accountOption(account: CashAccount) {
  return `${cashAccountLabel(account)} — ${account.branch?.name ?? 'Compartida'}`
}

/** Cuentas con su saldo; se recargan después de cada movimiento. */
function useAccounts() {
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    listAllCashAccounts(controller.signal)
      .then(setAccounts)
      .catch(() => undefined)
    return () => controller.abort()
  }, [refreshKey])
  return [accounts, () => setRefreshKey((value) => value + 1)] as const
}

/** Carga paginada con filtros: lo común a las dos pantallas. */
function usePagedList<T, P extends PageResponse<T>>(
  load: (query: CashOperationQuery, signal: AbortSignal) => Promise<P>,
) {
  const [query, setQuery] = useState<CashOperationQuery>({
    page: 1,
    limit: PAGE_SIZE,
  })
  const [status, setStatus] = useState<Status>('loading')
  const [result, setResult] = useState<P | null>(null)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    load(query, controller.signal)
      .then((page) => {
        setResult(page)
        setStatus('success')
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(financialErrorMessage(cause))
        setStatus('error')
      })
    return () => controller.abort()
    // `load` es una función estable del módulo de API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, refreshKey])

  return {
    query,
    setQuery,
    status,
    result,
    error,
    reload: () => setRefreshKey((value) => value + 1),
  }
}

function Filters({
  accounts,
  query,
  onApply,
}: {
  accounts: CashAccount[]
  query: CashOperationQuery
  onApply: (query: CashOperationQuery) => void
}) {
  const [draft, setDraft] = useState(query)
  return (
    <section className="financial-filters audit-filters">
      <form
        aria-label="Filtros"
        onSubmit={(event) => {
          event.preventDefault()
          onApply({ ...draft, page: 1 })
        }}
      >
        <label className="filter-field">
          Desde
          <input
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            type="date"
            value={draft.from ?? ''}
          />
        </label>
        <label className="filter-field">
          Hasta
          <input
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            type="date"
            value={draft.to ?? ''}
          />
        </label>
        <label className="filter-field">
          Cuenta
          <select
            onChange={(event) =>
              setDraft({ ...draft, accountId: event.target.value })
            }
            value={draft.accountId ?? ''}
          >
            <option value="">Todas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountOption(account)}
              </option>
            ))}
          </select>
        </label>
        <div className="financial-filter-actions">
          <button
            className="button button--secondary"
            onClick={() => {
              const cleared = { page: 1, limit: PAGE_SIZE }
              setDraft(cleared)
              onApply(cleared)
            }}
            type="button"
          >
            Limpiar
          </button>
          <button className="button button--primary" type="submit">
            Buscar
          </button>
        </div>
      </form>
    </section>
  )
}

function ListPanel({
  label,
  status,
  error,
  empty,
  emptyTitle,
  emptyDescription,
  onRetry,
  total,
  page,
  limit,
  onPage,
  children,
}: {
  label: string
  status: Status
  error: string
  empty: boolean
  emptyTitle: string
  emptyDescription: string
  onRetry: () => void
  total: number
  page: number
  limit: number
  onPage: (page: number) => void
  children: ReactNode
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  return (
    <section aria-label={label} className="financial-panel">
      {status === 'loading' && (
        <div className="financial-loading">
          <div className="loading-mark" />
          <span>Cargando…</span>
        </div>
      )}
      {status === 'error' && (
        <StatePanel
          action={
            <button
              className="button button--primary"
              onClick={onRetry}
              type="button"
            >
              <RefreshCw size={17} />
              Reintentar
            </button>
          }
          description={error}
          icon={RefreshCw}
          title="No pudimos cargar los datos"
          tone="danger"
        />
      )}
      {status === 'success' && empty && (
        <StatePanel
          description={emptyDescription}
          icon={ArrowLeftRight}
          title={emptyTitle}
        />
      )}
      {status === 'success' && !empty && (
        <>
          {children}
          <footer className="pagination">
            <span>
              {total} {total === 1 ? 'registro' : 'registros'}
            </span>
            <div>
              <button
                aria-label="Página anterior"
                className="icon-button"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
                type="button"
              >
                <ChevronLeft size={19} />
              </button>
              <strong>
                Página {page} de {pages}
              </strong>
              <button
                aria-label="Página siguiente"
                className="icon-button"
                disabled={page >= pages}
                onClick={() => onPage(page + 1)}
                type="button"
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  )
}

function Modal({
  eyebrow,
  title,
  error,
  submitting,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  eyebrow: string
  title: string
  error: string
  submitting: boolean
  submitLabel: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
}) {
  const dialogRef = useDialogFocus(onClose, submitting)
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="cash-operation-title"
        aria-modal="true"
        className="settlement-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="cash-operation-title">{title}</h2>
          </div>
          <button
            aria-label="Cerrar"
            className="icon-button"
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
        <form onSubmit={onSubmit}>
          {children}
          <footer className="financial-modal__actions">
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
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Guardando…' : submitLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

/** Pide el motivo antes de anular: queda escrito en la auditoría. */
function ReverseModal({
  title,
  description,
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  return (
    <Modal
      error={error}
      eyebrow="ANULAR"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        if (!reason.trim()) {
          setError('Escribí el motivo.')
          return
        }
        setSubmitting(true)
        setError('')
        onConfirm(reason.trim())
          .catch((cause: unknown) => setError(financialErrorMessage(cause)))
          .finally(() => setSubmitting(false))
      }}
      submitLabel="Anular"
      submitting={submitting}
      title={title}
    >
      <p className="audit-note">{description}</p>
      <label className="field">
        <span>Motivo *</span>
        <textarea
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          required
          rows={3}
          value={reason}
        />
      </label>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Transferencias entre cajas
// ---------------------------------------------------------------------------

function TransferModal({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: CashAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  const usable = accounts.filter((account) => account.active)
  const [sourceId, setSourceId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(localIsoDate())
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const source = usable.find((account) => account.id === sourceId)
  // Destino: otra cuenta, de la misma moneda, y nunca una histórica.
  const destinations = usable.filter(
    (account) =>
      account.id !== sourceId &&
      !isImportedAccount(account) &&
      (!source || account.currency === source.currency),
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = decimal(amount)
    if (!validAmount(value)) {
      setError('Ingresá un importe mayor a cero, con hasta dos decimales.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createCashTransfer({
        idempotencyKey,
        sourceAccountId: sourceId,
        destinationAccountId: destinationId,
        amount: value,
        ...(date === localIsoDate()
          ? {}
          : { occurredAt: `${date}T12:00:00.000-03:00` }),
        ...(notes.trim() ? { reference: notes.trim().slice(0, 160) } : {}),
      })
      void alertSuccess('La transferencia se registró correctamente.')
      onSaved()
    } catch (cause) {
      // El servidor rechazó la carga: el próximo intento, ya corregido, es
      // otro pedido. Si no hubo respuesta se conserva la clave para no
      // duplicar.
      if (cause instanceof ApiError) setIdempotencyKey(newIdempotencyKey())
      setError(financialErrorMessage(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      error={error}
      eyebrow="TESORERÍA"
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      submitLabel="Registrar transferencia"
      submitting={submitting}
      title="Nueva transferencia entre cajas"
    >
      <label className="field">
        <span>Sale de *</span>
        <select
          onChange={(event) => {
            setSourceId(event.target.value)
            setDestinationId('')
          }}
          required
          value={sourceId}
        >
          <option value="">Seleccionar cuenta de origen</option>
          {usable.map((account) => (
            <option key={account.id} value={account.id}>
              {accountOption(account)}
            </option>
          ))}
        </select>
        {source && (
          <small>
            Saldo actual: {formatMoney(source.balance, source.currency)}
          </small>
        )}
      </label>
      <label className="field">
        <span>Entra a *</span>
        <select
          disabled={!sourceId}
          onChange={(event) => setDestinationId(event.target.value)}
          required
          value={destinationId}
        >
          <option value="">Seleccionar cuenta de destino</option>
          {destinations.map((account) => (
            <option key={account.id} value={account.id}>
              {accountOption(account)}
            </option>
          ))}
        </select>
        <small>Sólo cuentas de la misma moneda que la de origen.</small>
      </label>
      <label className="field">
        <span>Importe *</span>
        <input
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          required
          value={amount}
        />
      </label>
      <label className="field">
        <span>Fecha *</span>
        <input
          max={localIsoDate()}
          onChange={(event) => setDate(event.target.value)}
          required
          type="date"
          value={date}
        />
      </label>
      <label className="field">
        <span>Motivo o referencia</span>
        <input
          maxLength={160}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ej.: depósito del efectivo de la semana"
          value={notes}
        />
      </label>
    </Modal>
  )
}

export function CashTransfersPage() {
  const { user } = useAuth()
  const permissions = user?.role.permissions ?? []
  const canCreate = hasPermission(permissions, 'caja.transferir')
  const canReverse = hasPermission(permissions, 'caja.reversar')
  const [accounts, reloadAccounts] = useAccounts()
  const list = usePagedList<CashTransfer, PageResponse<CashTransfer>>(
    listCashTransfers,
  )
  const [showForm, setShowForm] = useState(false)
  const [reversing, setReversing] = useState<CashTransfer | null>(null)
  const [reverseKey, setReverseKey] = useState(newIdempotencyKey)
  const branchOf = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId)
    if (!account) return ''
    return (
      account.branch?.name ??
      (cashAccountBranchId(account) === null ? 'Compartida' : '')
    )
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">TESORERÍA</p>
          <h1>Transferencias entre cajas</h1>
          <p>
            Pasar plata de una caja a otra de la misma moneda: de efectivo a
            banco, o de una sucursal a la otra. No es un cobro ni un gasto.
          </p>
        </div>
        {canCreate && (
          <button
            className="button button--primary"
            onClick={() => setShowForm(true)}
            type="button"
          >
            <Plus size={18} />
            Nueva transferencia
          </button>
        )}
      </header>

      <Filters
        accounts={accounts}
        onApply={list.setQuery}
        query={list.query}
      />

      <ListPanel
        empty={list.result?.items.length === 0}
        emptyDescription="Cuando pases plata de una caja a otra va a aparecer acá."
        emptyTitle="No hay transferencias para esos filtros"
        error={list.error}
        label="Listado de transferencias"
        limit={list.result?.limit ?? PAGE_SIZE}
        onPage={(page) => list.setQuery({ ...list.query, page })}
        onRetry={list.reload}
        page={list.result?.page ?? 1}
        status={list.status}
        total={list.result?.total ?? 0}
      >
        <div className="financial-table-wrap">
          <table className="financial-table audit-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Sale de</th>
                <th>Entra a</th>
                <th className="audit-table__money">Importe</th>
                <th>Referencia</th>
                <th>Registró</th>
                <th>Estado</th>
                {canReverse && <th aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {list.result?.items.map((transfer) => {
                const currency = accounts.find(
                  (account) => account.id === transfer.sourceAccount.id,
                )?.currency
                return (
                  <tr key={transfer.id}>
                    <td>
                      <strong>{formatDate(transfer.occurredAt)}</strong>
                    </td>
                    <td>
                      {transfer.sourceAccount.name}
                      <small>{branchOf(transfer.sourceAccount.id)}</small>
                    </td>
                    <td>
                      {transfer.destinationAccount.name}
                      <small>{branchOf(transfer.destinationAccount.id)}</small>
                    </td>
                    <td className="audit-table__money">
                      <strong>{formatMoney(transfer.amount, currency)}</strong>
                    </td>
                    <td>{transfer.reference ?? '—'}</td>
                    <td>{transfer.createdBy.fullName}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          transfer.status === 'CONFIRMADA'
                            ? 'status-badge--success'
                            : 'status-badge--warning'
                        }`}
                      >
                        {transfer.status === 'CONFIRMADA'
                          ? 'Vigente'
                          : transfer.status === 'REVERSADA'
                            ? 'Anulada'
                            : 'Pendiente'}
                      </span>
                    </td>
                    {canReverse && (
                      <td className="financial-actions">
                        {transfer.status === 'CONFIRMADA' && (
                          <button
                            aria-label={`Anular transferencia de ${transfer.sourceAccount.name} a ${transfer.destinationAccount.name}`}
                            className="button button--secondary button--compact"
                            onClick={() => {
                              setReverseKey(newIdempotencyKey())
                              setReversing(transfer)
                            }}
                            type="button"
                          >
                            <Undo2 size={15} />
                            Anular
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ListPanel>

      {showForm && (
        <TransferModal
          accounts={accounts}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            list.reload()
            reloadAccounts()
          }}
        />
      )}
      {reversing && (
        <ReverseModal
          description={`Se devuelve ${formatMoney(reversing.amount, accounts.find((account) => account.id === reversing.sourceAccount.id)?.currency)} de ${reversing.destinationAccount.name} a ${reversing.sourceAccount.name}. La transferencia no se borra: queda anulada.`}
          onClose={() => setReversing(null)}
          onConfirm={async (reason) => {
            await reverseCashTransfer(reversing.id, {
              idempotencyKey: reverseKey,
              reason,
            })
            setReversing(null)
            void alertSuccess('La transferencia quedó anulada.')
            list.reload()
            reloadAccounts()
          }}
          title="Anular transferencia"
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Retiros de socios
// ---------------------------------------------------------------------------

function WithdrawalModal({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: CashAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  // El retiro queda a nombre del responsable de la caja.
  const usable = accounts.filter(
    (account) =>
      account.active &&
      !isImportedAccount(account) &&
      Boolean(
        account.responsiblePersonnelId ?? account.responsiblePersonnel?.id,
      ),
  )
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(localIsoDate())
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const account = usable.find((item) => item.id === accountId)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = decimal(amount)
    if (!validAmount(value)) {
      setError('Ingresá un importe mayor a cero, con hasta dos decimales.')
      return
    }
    if (!reason.trim()) {
      setError('Escribí el motivo del retiro.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createPartnerWithdrawal({
        idempotencyKey,
        accountId,
        amount: value,
        date,
        reason: reason.trim(),
      })
      void alertSuccess('El retiro se registró correctamente.')
      onSaved()
    } catch (cause) {
      // El servidor rechazó la carga: el próximo intento, ya corregido, es
      // otro pedido. Si no hubo respuesta se conserva la clave para no
      // duplicar.
      if (cause instanceof ApiError) setIdempotencyKey(newIdempotencyKey())
      setError(financialErrorMessage(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      error={error}
      eyebrow="TESORERÍA"
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      submitLabel="Registrar retiro"
      submitting={submitting}
      title="Nuevo retiro de socio"
    >
      <label className="field">
        <span>Caja de la que retira *</span>
        <select
          onChange={(event) => setAccountId(event.target.value)}
          required
          value={accountId}
        >
          <option value="">Seleccionar caja</option>
          {usable.map((item) => (
            <option key={item.id} value={item.id}>
              {accountOption(item)}
            </option>
          ))}
        </select>
        {account && (
          <small>
            Retira{' '}
            <strong>{account.responsiblePersonnel?.fullName ?? 'el socio'}</strong>
            . Saldo actual: {formatMoney(account.balance, account.currency)}
          </small>
        )}
        {usable.length === 0 && (
          <small>
            No hay cajas con responsable. Asignale un responsable a la caja en
            Cuentas de caja.
          </small>
        )}
      </label>
      <label className="field">
        <span>Importe{account ? ` (${account.currency})` : ''} *</span>
        <input
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          required
          value={amount}
        />
      </label>
      <label className="field">
        <span>Fecha *</span>
        <input
          max={localIsoDate()}
          onChange={(event) => setDate(event.target.value)}
          required
          type="date"
          value={date}
        />
      </label>
      <label className="field">
        <span>Motivo *</span>
        <textarea
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ej.: retiro de utilidades de octubre"
          required
          rows={3}
          value={reason}
        />
      </label>
    </Modal>
  )
}

export function PartnerWithdrawalsPage() {
  const [accounts, reloadAccounts] = useAccounts()
  const list = usePagedList<PartnerWithdrawal, PartnerWithdrawalPage>(
    listPartnerWithdrawals,
  )
  const [showForm, setShowForm] = useState(false)
  const [reversing, setReversing] = useState<PartnerWithdrawal | null>(null)
  const [reverseKey, setReverseKey] = useState(newIdempotencyKey)

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">TESORERÍA</p>
          <h1>Retiros de socios</h1>
          <p>
            Plata que un socio saca de su caja. Baja el saldo de la caja pero
            no cuenta como gasto del mes.
          </p>
        </div>
        <button
          className="button button--primary"
          onClick={() => setShowForm(true)}
          type="button"
        >
          <Plus size={18} />
          Nuevo retiro
        </button>
      </header>

      <Filters
        accounts={accounts}
        onApply={list.setQuery}
        query={list.query}
      />

      {list.status === 'success' && list.result && (
        <section aria-label="Total retirado" className="financial-summary">
          <article>
            <small>Retiros</small>
            <strong>{list.result.total}</strong>
          </article>
          {list.result.totals.map((total) => (
            <article key={total.currency}>
              <small>Total retirado ({total.currency})</small>
              <strong>{formatMoney(total.amount, total.currency)}</strong>
            </article>
          ))}
        </section>
      )}

      <ListPanel
        empty={list.result?.items.length === 0}
        emptyDescription="Cuando un socio retire plata de su caja va a aparecer acá."
        emptyTitle="No hay retiros para esos filtros"
        error={list.error}
        label="Listado de retiros"
        limit={list.result?.limit ?? PAGE_SIZE}
        onPage={(page) => list.setQuery({ ...list.query, page })}
        onRetry={list.reload}
        page={list.result?.page ?? 1}
        status={list.status}
        total={list.result?.total ?? 0}
      >
        <div className="financial-table-wrap">
          <table className="financial-table audit-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Socio</th>
                <th>Caja</th>
                <th className="audit-table__money">Importe</th>
                <th>Motivo</th>
                <th>Registró</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {list.result?.items.map((withdrawal) => (
                <tr key={withdrawal.id}>
                  <td>
                    <strong>{formatDate(withdrawal.date)}</strong>
                  </td>
                  <td>{withdrawal.partner?.fullName ?? '—'}</td>
                  <td>
                    {withdrawal.account.name}
                    <small>{withdrawal.branch?.name ?? 'Compartida'}</small>
                  </td>
                  <td className="audit-table__money audit-table__money--out">
                    {formatMoney(withdrawal.amount, withdrawal.currency)}
                  </td>
                  <td>{withdrawal.reason}</td>
                  <td>{withdrawal.registeredBy?.fullName ?? '—'}</td>
                  <td>
                    {withdrawal.status === 'REGISTRADO' ? (
                      <span className="status-badge status-badge--success">
                        Vigente
                      </span>
                    ) : (
                      <>
                        <span className="status-badge status-badge--warning">
                          Anulado
                        </span>
                        <small>
                          {withdrawal.reversal?.by?.fullName ?? '—'}:{' '}
                          {withdrawal.reversal?.reason}
                        </small>
                      </>
                    )}
                  </td>
                  <td className="financial-actions">
                    {withdrawal.status === 'REGISTRADO' && (
                      <button
                        aria-label={`Anular retiro de ${withdrawal.partner?.fullName ?? 'socio'} del ${formatDate(withdrawal.date)}`}
                        className="button button--secondary button--compact"
                        onClick={() => {
                          setReverseKey(newIdempotencyKey())
                          setReversing(withdrawal)
                        }}
                        type="button"
                      >
                        <Undo2 size={15} />
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPanel>

      {showForm && (
        <WithdrawalModal
          accounts={accounts}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            list.reload()
            reloadAccounts()
          }}
        />
      )}
      {reversing && (
        <ReverseModal
          description={`Vuelven ${formatMoney(reversing.amount, reversing.currency)} a ${reversing.account.name}. El retiro no se borra: queda anulado.`}
          onClose={() => setReversing(null)}
          onConfirm={async (reason) => {
            await reversePartnerWithdrawal(reversing.id, {
              idempotencyKey: reverseKey,
              reason,
            })
            setReversing(null)
            void alertSuccess('El retiro quedó anulado.')
            list.reload()
            reloadAccounts()
          }}
          title="Anular retiro"
        />
      )}
    </>
  )
}
