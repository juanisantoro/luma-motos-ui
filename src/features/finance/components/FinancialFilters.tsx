import { Filter, Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import {
  listAllCashAccounts,
  listAllSuppliers,
  listInventoryBranches,
} from '../api'
import { financialErrorMessage } from '../format'
import type {
  BranchOption,
  CashAccount,
  FinancialKind,
  FinancialListQuery,
  FinancialStatus,
  SupplierOption,
} from '../types'

type FinancialFiltersProps = {
  kind: FinancialKind
  value: FinancialListQuery
  onApply: (query: FinancialListQuery) => void
}

function monthBounds(month: string) {
  if (!month) return {}
  const [yearValue = 0, monthValue = 0] = month.split('-').map(Number)
  const lastDay = new Date(yearValue, monthValue, 0).getDate()
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function FinancialFilters({
  kind,
  value,
  onApply,
}: FinancialFiltersProps) {
  const [draft, setDraft] = useState(value)
  const [month, setMonth] = useState('')
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [optionsError, setOptionsError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const requests: Promise<void>[] = [
      listInventoryBranches(controller.signal).then(setBranches),
    ]
    if (kind === 'purchase') {
      requests.push(
        listAllSuppliers(controller.signal).then(setSuppliers),
      )
    } else {
      requests.push(
        listAllCashAccounts(controller.signal).then(setAccounts),
      )
    }
    void Promise.all(requests).catch((error: unknown) => {
      if (!controller.signal.aborted) setOptionsError(financialErrorMessage(error))
    })
    return () => controller.abort()
  }, [kind])

  const change = <K extends keyof FinancialListQuery>(
    key: K,
    next: FinancialListQuery[K],
  ) => setDraft((current) => ({ ...current, [key]: next || undefined }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onApply({ ...draft, ...monthBounds(month), page: 1 })
  }

  const clear = () => {
    setDraft({})
    setMonth('')
    onApply({ page: 1 })
  }

  return (
    <details className="financial-filters" open>
      <summary>
        <Filter size={17} aria-hidden="true" />
        Filtros
      </summary>
      <form onSubmit={submit}>
        {optionsError && (
          <div className="form-alert form-alert--error financial-filter-error" role="alert">
            {optionsError}
          </div>
        )}
        <label className="search-field financial-filter--search">
          <span className="sr-only">Buscar</span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por referencia, descripción o VIN"
            value={draft.search ?? ''}
            onChange={(event) => change('search', event.target.value)}
          />
        </label>
        <label className="filter-field">
          <span>Mes y año</span>
          <input
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value)
              setDraft((current) => {
                const next = { ...current }
                delete next.from
                delete next.to
                return next
              })
            }}
          />
        </label>
        <label className="filter-field">
          <span>Desde</span>
          <input
            type="date"
            value={draft.from ?? ''}
            onChange={(event) => {
              setMonth('')
              change('from', event.target.value)
            }}
          />
        </label>
        <label className="filter-field">
          <span>Hasta</span>
          <input
            type="date"
            value={draft.to ?? ''}
            onChange={(event) => {
              setMonth('')
              change('to', event.target.value)
            }}
          />
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select
            value={draft.status ?? ''}
            onChange={(event) =>
              change(
                'status',
                event.target.value as FinancialStatus | undefined,
              )
            }
          >
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PARCIAL">Parcial</option>
            <option value="PAGADO">Pagado</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Sucursal</span>
          <select
            value={draft.branchId ?? ''}
            onChange={(event) => change('branchId', event.target.value)}
          >
            <option value="">Todas</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>
            ))}
          </select>
        </label>
        {kind !== 'purchase' && (
          <label className="filter-field">
            <span>Cuenta</span>
            <select
              value={draft.accountId ?? ''}
              onChange={(event) => change('accountId', event.target.value)}
            >
              <option value="">Todas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
              ))}
            </select>
          </label>
        )}
        {kind === 'purchase' && (
          <label className="filter-field">
            <span>Proveedor</span>
            <select
              value={draft.supplierId ?? ''}
              onChange={(event) => change('supplierId', event.target.value)}
            >
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.legalName}</option>
              ))}
            </select>
          </label>
        )}
        {kind === 'income' && (
          <label className="filter-field">
            <span>Tipo</span>
            <input
              value={draft.type ?? ''}
              onChange={(event) => change('type', event.target.value)}
              placeholder="Tipo de ingreso"
            />
          </label>
        )}
        {kind === 'expense' && (
          <label className="filter-field">
            <span>Categoría</span>
            <input
              value={draft.category ?? ''}
              onChange={(event) => change('category', event.target.value)}
              placeholder="Categoría"
            />
          </label>
        )}
        <div className="financial-filter-actions">
          <button className="button button--secondary" type="button" onClick={clear}>
            Limpiar
          </button>
          <button className="button button--primary" type="submit">
            Aplicar filtros
          </button>
        </div>
      </form>
    </details>
  )
}
