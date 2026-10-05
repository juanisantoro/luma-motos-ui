import { Plus, RefreshCw, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../shared/api/client'
import { alertError, alertSuccess } from '../../shared/alerts'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { branchScopeKey, filterAllowedBranches } from '../auth/branchScope'
import {
  listHandoverRecipients,
  type HandoverRecipient,
} from '../sales/tracking'
import {
  createCashAccount,
  listAllCashAccounts,
  listInventoryBranches,
  updateCashAccount,
} from './api'
import { CashAccountModal } from './CashAccountModal'
import {
  cashAccountBranchId,
  cashAccountLabel,
  cashAccountTypeLabels,
  isImportedAccount,
} from './cashAccounts'
import { financialErrorMessage, formatMoney } from './format'
import type { BranchOption, CashAccount, CashAccountInput } from './types'

export function cashAccountErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const code = error.details?.code
    if (code === 'INVALID_PERSONNEL')
      return 'El responsable elegido no está activo.'
    if (code === 'CASH_ACCOUNT_CODE_TAKEN' || error.status === 409)
      return 'Ya existe una cuenta con ese nombre.'
    if (code === 'BRANCH_OUT_OF_SCOPE')
      return 'Esa sucursal está fuera de tu alcance. Las cuentas compartidas sólo las gestiona quien ve todas las sucursales.'
  }
  return financialErrorMessage(error)
}

// Gestión de cajas: a quién se le rinde el efectivo o se le deposita.
export function CashAccountsPage() {
  const { user } = useAuth()
  const permissions = user?.role.permissions ?? []
  const canManage = hasPermission(permissions, 'caja.cuentas.gestionar')
  const canShare =
    hasPermission(permissions, 'sucursales.todas') ||
    Boolean(user?.globalAccess)
  const scopeKey = branchScopeKey(user)

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [recipients, setRecipients] = useState<HandoverRecipient[]>([])
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState<CashAccount | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setLoadError('')
    Promise.all([
      listAllCashAccounts(controller.signal, true),
      listInventoryBranches(controller.signal),
      // Sin permiso para ver destinatarios la pantalla igual funciona.
      listHandoverRecipients(controller.signal).catch(() => []),
    ])
      .then(([accountItems, branchItems, recipientItems]) => {
        setAccounts(accountItems)
        setBranches(filterAllowedBranches(scopeKey, branchItems))
        setRecipients(recipientItems)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(cashAccountErrorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [refreshKey, scopeKey])

  const visible = useMemo(
    () =>
      showAll
        ? accounts
        : accounts.filter(
            (account) => account.active && !isImportedAccount(account),
          ),
    [accounts, showAll],
  )
  const hiddenCount = accounts.length - visible.length

  // Quien recibe rendiciones debería tener su propia caja.
  const recipientsWithoutAccount = useMemo(
    () =>
      recipients.filter(
        (recipient) =>
          !accounts.some(
            (account) =>
              account.active &&
              !isImportedAccount(account) &&
              (account.responsiblePersonnelId ??
                account.responsiblePersonnel?.id) === recipient.id,
          ),
      ),
    [accounts, recipients],
  )

  const reload = () => setRefreshKey((current) => current + 1)

  const open = (account: CashAccount | null) => {
    setEditing(account)
    setFormError(null)
    setShowModal(true)
  }

  const submit = async (input: CashAccountInput) => {
    setSubmitting(true)
    setFormError(null)
    try {
      if (editing) {
        await updateCashAccount(editing.id, input)
        void alertSuccess('La cuenta se actualizó correctamente.')
      } else {
        await createCashAccount(input)
        void alertSuccess('La cuenta se creó correctamente.')
      }
      setShowModal(false)
      reload()
    } catch (error) {
      const message = cashAccountErrorMessage(error)
      setFormError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (account: CashAccount) => {
    try {
      await updateCashAccount(account.id, { active: !account.active })
      void alertSuccess(
        account.active
          ? 'Cuenta desactivada. Ya no se ofrece al cobrar o pagar.'
          : 'Cuenta reactivada.',
      )
      reload()
    } catch (error) {
      void alertError(cashAccountErrorMessage(error))
    }
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">TESORERÍA</p>
          <h1>Cuentas de caja</h1>
          <p>
            A quién le entra la plata: la caja de cada socio, la de cada
            sucursal y las cuentas bancarias.
          </p>
        </div>
        {canManage && (
          <button
            className="button button--primary"
            onClick={() => open(null)}
            type="button"
          >
            <Plus size={18} />
            Nueva cuenta
          </button>
        )}
      </header>

      {status === 'success' && recipientsWithoutAccount.length > 0 && (
        <div className="form-alert" role="status">
          Todavía no tienen una cuenta propia:{' '}
          <strong>
            {recipientsWithoutAccount
              .map((recipient) => recipient.fullName)
              .join(', ')}
          </strong>
          . Creales una para poder indicar que la plata entró a su caja o a su
          banco.
        </div>
      )}

      <label className="operation-check" style={{ marginBottom: 12 }}>
        <input
          checked={showAll}
          onChange={(event) => setShowAll(event.target.checked)}
          type="checkbox"
        />
        <span>
          Mostrar también las inactivas y las históricas importadas
          {!showAll && hiddenCount > 0 ? ` (${hiddenCount})` : ''}
        </span>
      </label>

      <section className="financial-panel" aria-label="Listado de cuentas de caja">
        {status === 'loading' && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando cuentas…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            action={
              <button
                className="button button--primary"
                onClick={reload}
                type="button"
              >
                <RefreshCw size={17} />
                Reintentar
              </button>
            }
            description={loadError}
            icon={RefreshCw}
            title="No pudimos cargar las cuentas"
            tone="danger"
          />
        )}
        {status === 'success' && visible.length === 0 && (
          <StatePanel
            description="Creá una cuenta por socio, una por sucursal y las bancarias para poder indicar dónde entra cada cobro."
            icon={WalletCards}
            title="Todavía no hay cuentas de caja"
          />
        )}
        {status === 'success' && visible.length > 0 && (
          <div className="financial-table-wrap">
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th>Responsable</th>
                  <th>Sucursal</th>
                  <th>Moneda</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  {canManage && (
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((account) => {
                  const imported = isImportedAccount(account)
                  const branch =
                    account.branch?.name ??
                    branches.find(
                      (item) => item.id === cashAccountBranchId(account),
                    )?.name
                  return (
                    <tr key={account.id}>
                      <td>
                        <strong>
                          {imported ? cashAccountLabel(account) : account.name}
                        </strong>
                        {imported && <small>Importada del Excel</small>}
                      </td>
                      <td>{cashAccountTypeLabels[account.type]}</td>
                      <td>
                        {account.responsiblePersonnel?.fullName ??
                          'Sin responsable'}
                      </td>
                      <td>{branch ?? 'Compartida'}</td>
                      <td>{account.currency}</td>
                      <td>{formatMoney(account.balance, account.currency)}</td>
                      <td>
                        <span
                          className={`status-badge${account.active ? ' status-badge--success' : ''}`}
                        >
                          {account.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="financial-actions">
                          <button
                            aria-label={`Editar ${cashAccountLabel(account)}`}
                            className="button button--secondary button--compact"
                            onClick={() => open(account)}
                            type="button"
                          >
                            Editar
                          </button>
                          <button
                            aria-label={`${account.active ? 'Desactivar' : 'Reactivar'} ${cashAccountLabel(account)}`}
                            className="button button--secondary button--compact"
                            onClick={() => void toggleActive(account)}
                            type="button"
                          >
                            {account.active ? 'Desactivar' : 'Reactivar'}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <CashAccountModal
          account={editing}
          branches={branches}
          canShare={canShare}
          error={formError}
          onClose={() => setShowModal(false)}
          onSubmit={(input) => void submit(input)}
          responsibles={recipients}
          submitting={submitting}
        />
      )}
    </>
  )
}
