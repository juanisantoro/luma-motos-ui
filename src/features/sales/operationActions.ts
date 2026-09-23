import { hasPermission } from '../auth/PermissionRoute'
import type { SalesOperation } from './types'

export type OperationAction = 'submit' | 'close' | 'cancel'

type ActionableOperation = Pick<SalesOperation, 'status' | 'reservation'>

/**
 * Acciones que el backend acepta para una operación según su estado y los
 * permisos del usuario. Replica las precondiciones de SalesService
 * (submit sólo BORRADOR, close sólo APROBADA con reserva física activa,
 * cancel en cualquier estado no terminal) para no ofrecer botones que
 * siempre terminarían en 409. El backend sigue siendo la fuente de verdad.
 */
export function availableOperationActions(
  operation: ActionableOperation,
  permissions: readonly string[] | undefined,
): OperationAction[] {
  const actions: OperationAction[] = []
  if (
    operation.status === 'BORRADOR' &&
    hasPermission(permissions, 'ventas.gestionar')
  ) {
    actions.push('submit')
  }
  if (
    operation.status === 'APROBADA' &&
    operation.reservation?.status === 'ACTIVO' &&
    Boolean(operation.reservation.unitId) &&
    hasPermission(permissions, 'ventas.cerrar')
  ) {
    actions.push('close')
  }
  if (
    operation.status !== 'CANCELADA' &&
    operation.status !== 'CERRADA' &&
    hasPermission(permissions, 'ventas.cancelar')
  ) {
    actions.push('cancel')
  }
  return actions
}
