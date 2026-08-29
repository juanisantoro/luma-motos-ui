import { Banknote, History } from 'lucide-react'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import {
  formatDate,
  formatMoney,
  statusLabel,
  statusTone,
} from '../format'
import type {
  Expense,
  FinancialKind,
  FinancialRecord,
  Income,
  SupplierPurchase,
} from '../types'

type FinancialRecordListProps = {
  kind: FinancialKind
  records: FinancialRecord[]
  canSettle: boolean
  canRecover: boolean
  canViewCosts: boolean
  onSettle: (record: FinancialRecord, recovery?: boolean) => void
  onDetails: (record: FinancialRecord) => void
}

function recordDate(kind: FinancialKind, record: FinancialRecord) {
  if (kind === 'purchase') return (record as SupplierPurchase).purchaseDate
  if (kind === 'income') return (record as Income).incomeDate
  return (record as Expense).expenseDate
}

function recordTitle(kind: FinancialKind, record: FinancialRecord) {
  if (kind === 'purchase') {
    const purchase = record as SupplierPurchase
    return purchase.supplier.legalName
  }
  if (kind === 'income') return (record as Income).description
  return (record as Expense).description
}

function recordMeta(kind: FinancialKind, record: FinancialRecord) {
  if (kind === 'purchase') {
    const purchase = record as SupplierPurchase
    const vehicle = purchase.vehicle.unit?.vin
      ?? purchase.vehicle.version?.name
      ?? purchase.vehicle.version?.model.name
    return [vehicle, purchase.documentNumber].filter(Boolean).join(' · ') || 'Sin referencia'
  }
  const item = record as Income | Expense
  return [item.reference, item.vehicle?.unit?.vin].filter(Boolean).join(' · ') || 'Sin referencia'
}

function recordAmount(
  kind: FinancialKind,
  record: FinancialRecord,
  canViewCosts: boolean,
) {
  if (kind === 'purchase') {
    const purchase = record as SupplierPurchase
    return canViewCosts && purchase.totalAmount !== undefined
      ? formatMoney(purchase.totalAmount, purchase.currency)
      : null
  }

  return formatMoney((record as Income | Expense).totalAmount, record.currency)
}

function settlementMeta(kind: FinancialKind, record: FinancialRecord) {
  if (kind === 'income') {
    const income = record as Income
    return [income.account?.name, income.collector?.fullName]
      .filter(Boolean)
      .join(' · ') || 'Sin movimientos'
  }
  if (kind === 'expense') {
    const expense = record as Expense
    return [expense.account?.name, expense.paidBy?.fullName]
      .filter(Boolean)
      .join(' · ') || 'Sin movimientos'
  }
  return ''
}

function RecordActions({
  kind,
  record,
  canSettle,
  canRecover,
  onSettle,
  onDetails,
}: Omit<FinancialRecordListProps, 'records' | 'canViewCosts'> & {
  record: FinancialRecord
}) {
  const expense = kind === 'expense' ? (record as Expense) : null
  return (
    <div className="financial-actions">
      {canSettle && record.paymentStatus !== 'PAGADO' && (
        <button
          className="button button--secondary button--compact"
          type="button"
          onClick={() => onSettle(record)}
        >
          <Banknote size={16} />
          {kind === 'income' ? 'Cobrar' : 'Pagar'}
        </button>
      )}
      {expense?.recoverable && !expense.recovered && canRecover && (
        <button
          className="button button--secondary button--compact"
          type="button"
          onClick={() => onSettle(record, true)}
        >
          <Banknote size={16} />
          Recuperar
        </button>
      )}
      <button
        className="icon-button table-action"
        aria-label={`Ver movimientos de ${recordTitle(kind, record)}`}
        title="Ver movimientos"
        type="button"
        onClick={() => onDetails(record)}
      >
        <History size={18} />
      </button>
    </div>
  )
}

export function FinancialRecordList(props: FinancialRecordListProps) {
  const {
    kind,
    records,
    canViewCosts,
  } = props
  const isCardLayout = useMediaQuery('(max-width: 768px)')

  if (isCardLayout) {
    return (
      <div className="financial-card-list">
        {records.map((record) => (
          <article className="financial-card" key={record.id}>
            <header>
              <div>
                <strong>{recordTitle(kind, record)}</strong>
                <span>{recordMeta(kind, record)}</span>
              </div>
              <span className={`status-badge${statusTone(record.paymentStatus)}`}>
                {statusLabel(record.paymentStatus)}
              </span>
            </header>
            <dl>
              <div><dt>Fecha</dt><dd>{formatDate(recordDate(kind, record))}</dd></div>
              <div><dt>Sucursal</dt><dd>{record.branch?.name ?? 'General'}</dd></div>
              {recordAmount(kind, record, canViewCosts) && (
                <div>
                  <dt>Total</dt>
                  <dd>{recordAmount(kind, record, canViewCosts)}</dd>
                </div>
              )}
              {kind !== 'purchase' && (
                <div>
                  <dt>Cuenta / responsable</dt>
                  <dd>{settlementMeta(kind, record)}</dd>
                </div>
              )}
              {kind === 'expense' && (
                <div>
                  <dt>Recuperación</dt>
                  <dd>{(record as Expense).recoverable ? ((record as Expense).recovered ? 'Recuperada' : 'Pendiente') : 'No recuperable'}</dd>
                </div>
              )}
            </dl>
            <RecordActions {...props} record={record} />
          </article>
        ))}
      </div>
    )
  }

  return (
    <div className="financial-table-wrap">
      <table className="financial-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>{kind === 'purchase' ? 'Proveedor' : kind === 'expense' ? 'Categoría / detalle' : 'Tipo / descripción'}</th>
            <th>Referencia / unidad</th>
            <th>Sucursal</th>
            {kind !== 'purchase' || canViewCosts ? <th>Total</th> : null}
            {kind !== 'purchase' && <th>Cuenta / responsable</th>}
            <th>Estado</th>
            {kind === 'expense' && <th>Recuperable</th>}
            <th><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{formatDate(recordDate(kind, record))}</td>
              <td>
                <strong>{recordTitle(kind, record)}</strong>
                {kind !== 'purchase' && (
                  <small>{kind === 'income' ? (record as Income).type : (record as Expense).category}</small>
                )}
              </td>
              <td>{recordMeta(kind, record)}</td>
              <td>{record.branch?.name ?? 'General'}</td>
              {kind !== 'purchase' || canViewCosts ? (
                <td>{recordAmount(kind, record, canViewCosts)}</td>
              ) : null}
              {kind !== 'purchase' && <td>{settlementMeta(kind, record)}</td>}
              <td>
                <span className={`status-badge${statusTone(record.paymentStatus)}`}>
                  {statusLabel(record.paymentStatus)}
                </span>
              </td>
              {kind === 'expense' && (
                <td>{(record as Expense).recoverable ? ((record as Expense).recovered ? 'Recuperada' : 'Pendiente') : 'No'}</td>
              )}
              <td><RecordActions {...props} record={record} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
