import { useState } from 'react'
import { alertError, alertSuccess } from '../../shared/alerts'
import { ReceiveSupplyModal } from '../stock/ReceiveSupplyModal'
import { stockApiGateway } from '../stock/api'
import { stockErrorMessage } from '../stock/errors'
import type { ReceiveSupplyInput } from '../stock/types'
import { hasPermission } from '../auth/PermissionRoute'
import { AssignUnitModal } from './AssignUnitModal'
import { operationFulfillment } from './fulfillment'
import { SupplyOrderModal } from './SupplyOrderModal'
import type { SalesOperation } from './types'

// Acciones de la administrativa sobre la unidad de una operación de moto
// (fase 3), disponibles desde la grilla de operaciones.
export type UnitAction = 'assign' | 'order' | 'receive'

export type ActiveUnitAction = {
  action: UnitAction
  operation: SalesOperation
}

export function unitActionPermissions(permissions: readonly string[] | undefined) {
  const canAssign = hasPermission(permissions, 'ventas.asignar_unidad')
  return {
    canAssign,
    canOrder: canAssign && hasPermission(permissions, 'abastecimiento.gestionar'),
    canReceive: hasPermission(permissions, 'abastecimiento.recibir'),
    canEditUnit: hasPermission(permissions, 'inventario.gestionar'),
  }
}

// Sólo motos, sin unidad y en estados donde el backend acepta la acción.
// Autos no cambian: siguen con su circuito de disponibilidad de proveedor.
export function availableUnitActions(
  operation: SalesOperation,
  permissions: ReturnType<typeof unitActionPermissions>,
): UnitAction[] {
  if (operation.vehicle.model.vehicleType !== 'MOTO') return []
  if (operation.vehicle.unit) return []
  if (
    operation.status !== 'PENDIENTE_APROBACION' &&
    operation.status !== 'APROBADA'
  ) {
    return []
  }
  const { status } = operationFulfillment(operation)
  const actions: UnitAction[] = []
  if (
    permissions.canAssign &&
    (status === 'PENDIENTE_ASIGNACION' || status === 'RECIBIDA')
  ) {
    actions.push('assign')
  }
  if (permissions.canOrder && status === 'PENDIENTE_ASIGNACION') {
    actions.push('order')
  }
  if (
    permissions.canReceive &&
    (status === 'PEDIDA' || status === 'PENDIENTE_INGRESO')
  ) {
    actions.push('receive')
  }
  return actions
}

export function UnitFulfillmentDialogs({
  active,
  canEditUnit,
  onClose,
  onDone,
}: {
  active: ActiveUnitAction | null
  canEditUnit: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [receiving, setReceiving] = useState(false)
  const [receiveError, setReceiveError] = useState<string | null>(null)

  if (!active) return null

  const close = () => {
    setReceiveError(null)
    onClose()
  }
  const done = (message: string) => {
    setReceiveError(null)
    onDone()
    void alertSuccess(message)
  }

  const { operation } = active
  const fulfillment = operationFulfillment(operation)

  const receive = async (input: ReceiveSupplyInput) => {
    if (!fulfillment.supplyRequestId) return
    setReceiving(true)
    setReceiveError(null)
    try {
      await stockApiGateway.receiveSupply(fulfillment.supplyRequestId, input)
      done('La unidad se recibió y quedó asignada a la operación.')
    } catch (receiveFailure) {
      const message = stockErrorMessage(receiveFailure)
      setReceiveError(message)
      void alertError(message)
    } finally {
      setReceiving(false)
    }
  }

  if (active.action === 'assign') {
    return (
      <AssignUnitModal
        canEditUnit={canEditUnit}
        onAssigned={() =>
          done('La unidad quedó reservada y asignada a la operación.')
        }
        onClose={close}
        operation={operation}
      />
    )
  }
  if (active.action === 'order') {
    return (
      <SupplyOrderModal
        onClose={close}
        onOrdered={(updated) =>
          done(
            `Pedido realizado a ${updated.fulfillment?.supplier?.legalName ?? 'proveedor'}.`,
          )
        }
        operation={operation}
      />
    )
  }
  if (!fulfillment.supplyRequestId) return null
  return (
    <ReceiveSupplyModal
      branches={[{ id: operation.branch.id, name: operation.branch.name }]}
      error={receiveError}
      onClose={close}
      onSubmit={(input) => void receive(input)}
      submitting={receiving}
      supply={{
        id: fulfillment.supplyRequestId,
        vehicleType: operation.vehicle.model.vehicleType,
        condition: operation.vehicle.condition,
        color: operation.requestedColor ?? null,
        destinationBranch: {
          id: operation.branch.id,
          name: operation.branch.name,
        },
        catalogModel: {
          brand: operation.vehicle.model.brand.name,
          model: [operation.vehicle.model.name, operation.vehicle.versionName]
            .filter(Boolean)
            .join(' '),
        },
        supplier: {
          name: fulfillment.supplier?.legalName ?? 'Proveedor',
        },
        operationNumber: operation.number,
      }}
    />
  )
}
