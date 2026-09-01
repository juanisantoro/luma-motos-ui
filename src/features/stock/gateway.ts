import type {
  ConfigurePriceInput,
  CreateUnitsInput,
  ReceiveSupplyInput,
  StockCapabilities,
  StockWorkspaceData,
  SupplyStatus,
  UpdateCatalogModelInput,
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
  upsertAvailability: (
    input: UpsertAvailabilityInput,
    organizationId?: string,
  ) => Promise<void>
  configurePrice: (
    input: ConfigurePriceInput,
    organizationId?: string,
  ) => Promise<void>
  updateCatalogModel: (input: UpdateCatalogModelInput) => Promise<void>
  uploadCatalogVersionPhoto: (
    versionId: string,
    file: File,
  ) => Promise<void>
  updateUnitColor: (
    unitId: string,
    input: { color: string | null; acabado: string | null },
  ) => Promise<void>
  transitionSupply: (
    supplyId: string,
    status: SupplyStatus,
  ) => Promise<void>
  receiveSupply: (
    supplyId: string,
    input: ReceiveSupplyInput,
  ) => Promise<void>
}
