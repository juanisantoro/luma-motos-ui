import { formatMoney } from '../finance/format'
import {
  formatDateTime,
  formatDay,
  handoverLabel,
  movementTypeLabels,
  paymentMethodLabels,
  sourceKindLabels,
} from './format'
import type { MoneyMovement } from './types'

function amount(movement: MoneyMovement, direction: MoneyMovement['direction']) {
  if (movement.direction !== direction) return ''
  return movement.amount === null
    ? 'Reservado'
    : formatMoney(movement.amount, movement.account.currency)
}

// Movimientos de dinero: se usa en la pantalla y en el historial de una venta.
export function MoneyTable({
  movements,
  onOpenOperation,
}: {
  movements: MoneyMovement[]
  onOpenOperation?: (operationId: string) => void
}) {
  return (
    <div className="financial-table-wrap">
      <table className="financial-table audit-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cuenta</th>
            <th>Concepto</th>
            <th className="audit-table__money">Entrada</th>
            <th className="audit-table__money">Salida</th>
            <th>Registró</th>
            <th>Rendición del efectivo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => {
            const handover = handoverLabel(movement)
            return (
              <tr key={movement.id}>
                <td>
                  {/* La misma fecha que muestran Ingresos y Egresos: la que
                      cargó el usuario. Por ella se filtra y se ordena; la de
                      carga queda como dato de control. */}
                  <strong>{formatDay(movement.date)}</strong>
                  <small>Cargado el {formatDateTime(movement.createdAt)}</small>
                </td>
                <td>
                  {movement.account.name}
                  {movement.account.currency !== 'ARS'
                    ? ` (${movement.account.currency})`
                    : ''}
                  <small>{movement.branch?.name ?? 'Compartida'}</small>
                </td>
                <td>
                  <strong>
                    {sourceKindLabels[movement.source.kind] ?? 'Otro'}
                    {' · '}
                    {movementTypeLabels[movement.type]}
                  </strong>
                  <small>{movement.source.title}</small>
                  {movement.operation && (
                    <small>
                      {onOpenOperation ? (
                        <button
                          className="audit-link"
                          onClick={() =>
                            onOpenOperation(movement.operation!.id)
                          }
                          type="button"
                        >
                          Venta N.º {movement.operation.number}
                        </button>
                      ) : (
                        `Venta N.º ${movement.operation.number}`
                      )}
                      {' · '}
                      {movement.operation.client}
                    </small>
                  )}
                  {!movement.operation && movement.client && (
                    <small>{movement.client}</small>
                  )}
                  {movement.paymentMethod && (
                    <small>
                      {paymentMethodLabels[movement.paymentMethod] ??
                        movement.paymentMethod}
                    </small>
                  )}
                  {(movement.reference || movement.notes) && (
                    <small>
                      {[movement.reference, movement.notes]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  )}
                </td>
                <td className="audit-table__money audit-table__money--in">
                  {amount(movement, 'CREDITO')}
                </td>
                <td className="audit-table__money audit-table__money--out">
                  {amount(movement, 'DEBITO')}
                </td>
                <td>{movement.registeredBy?.fullName ?? '—'}</td>
                <td>{handover ?? '—'}</td>
                <td>
                  {movement.reversal ? (
                    <>
                      <span className="status-badge status-badge--warning">
                        Reversado
                      </span>
                      <small>
                        {movement.reversal.by?.fullName ?? '—'} el{' '}
                        {formatDateTime(movement.reversal.at)}
                      </small>
                      {movement.reversal.notes && (
                        <small>{movement.reversal.notes}</small>
                      )}
                    </>
                  ) : movement.reversalOfId ? (
                    <span className="status-badge status-badge--warning">
                      Es una reversa
                    </span>
                  ) : (
                    <span className="status-badge status-badge--success">
                      Vigente
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
