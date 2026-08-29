import type {
  CreateUnitsInput,
  ReceiveSupplyInput,
  StockCapabilities,
  StockWorkspaceData,
  SupplyStatus,
  UpsertAvailabilityInput,
  VehicleKind,
} from './types'

export type StockGateway = {
  loadWorkspace: (
    vehicleType: VehicleKind,
    capabilities: StockCapabilities,
    organizationId: string | undefined,
    signal?: AbortSignal,
  ) => Promise<StockWorkspaceData>
  createUnits: (
    input: CreateUnitsInput,
    organizationId?: string,
  ) => Promise<void>
  upsertAvailability: (input: UpsertAvailabilityInput) => Promise<void>
  transitionSupply: (
    supplyId: string,
    status: SupplyStatus,
  ) => Promise<void>
  receiveSupply: (
    supplyId: string,
    input: ReceiveSupplyInput,
  ) => Promise<void>
}
