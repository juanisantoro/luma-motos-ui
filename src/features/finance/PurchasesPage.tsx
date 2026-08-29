import { FinancialModulePage } from './FinancialModulePage'
import type { FinancialVehicleType } from './types'

export function PurchasesPage({
  vehicleType,
}: {
  vehicleType: FinancialVehicleType
}) {
  return <FinancialModulePage kind="purchase" vehicleType={vehicleType} />
}
