import { FinancialModulePage } from './FinancialModulePage'
import type { FinancialVehicleType } from './types'

export function IncomesPage({
  vehicleType,
}: {
  vehicleType: FinancialVehicleType
}) {
  return <FinancialModulePage kind="income" vehicleType={vehicleType} />
}
