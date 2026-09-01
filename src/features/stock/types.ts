export type VehicleKind = 'MOTO' | 'AUTO'
export type VehicleCondition = 'NUEVO' | 'USADO'

export type AcquisitionOrigin =
  | 'PROVEEDOR'
  | 'TOMA_PARTE_PAGO'
  | 'OTRO'

export type UnitStatus =
  | 'EN_STOCK'
  | 'RESERVADO'
  | 'EN_TRASLADO'
  | 'EN_ACONDICIONAMIENTO'
  | 'VENDIDO'
  | 'ENTREGADO'
  | 'BLOQUEADO'
  | 'DADO_DE_BAJA'

export type SupplyStatus =
  | 'PENDIENTE_APROBACION'
  | 'PENDIENTE_CONFIRMACION'
  | 'CONFIRMADO'
  | 'PEDIDO'
  | 'EN_TRANSITO'
  | 'RECIBIDO'
  | 'ASIGNADO'
  | 'CANCELADA'

export type BranchOption = {
  id: string
  name: string
}

export type SupplierOption = {
  id: string
  name: string
}

export type CatalogBrand = {
  id: string
  name: string
  active: boolean
}

export type CatalogVehicleModel = {
  id: string
  vehicleType: VehicleKind
  name: string
  active: boolean
  brand: CatalogBrand
}

export type CatalogModel = {
  id: string
  brandId: string
  modelId: string
  vehicleType: VehicleKind
  brand: string
  model: string
  version: string | null
  active: boolean
  scope?: 'GLOBAL' | 'RESTRINGIDO'
  pricingStatus?: 'ACTIVE' | 'MISSING'
  pricePolicy: CatalogPricePolicy | null
  pricePolicies?: CatalogPricePolicy[]
  photoUrl: string | null
  // Absent (not just undefined) unless the logged-in user has
  // catalogo.costos.consultar - the backend omits the key entirely from
  // the JSON payload for anyone without it.
  costPrice?: number
}

export type CatalogPricePolicy = {
  id: string
  versionId: string
  branchId: string | null
  currency: string
  listPrice: number
  minimumPrice: number
  validFrom: string
  validUntil: string | null
  scope?: 'BRANCH' | 'ORGANIZATION'
  status?: 'ACTIVE' | 'INACTIVE'
  active?: boolean
}

export type PhysicalUnit = {
  id: string
  vehicleType: VehicleKind
  catalogModel: CatalogModel
  condition: VehicleCondition
  vin: string
  year: number
  mileage: number
  licensePlate: string | null
  color: string | null
  acabado: string | null
  acquisitionOrigin: AcquisitionOrigin
  supplier: SupplierOption | null
  status: UnitStatus
  branch: BranchOption
  receivedAt: string
}

export type SupplierAvailability = {
  id: string
  vehicleType: VehicleKind
  catalogModel: CatalogModel
  condition: VehicleCondition
  supplier: SupplierOption
  quantity: number
  notes: string | null
  updatedAt: string
}

export type SupplyOrder = {
  id: string
  vehicleType: VehicleKind
  catalogModel: CatalogModel
  condition: VehicleCondition
  supplier: SupplierOption
  quantity: number
  status: SupplyStatus
  color: string | null
  destinationBranch: BranchOption
  requestedAt: string | null
  operation: {
    id: string
    number: string | null
    status: string | null
    clientName: string | null
    clientDocument: string | null
  } | null
  // Only id/vin are populated by the API's supply-requests projection -
  // it is not a full PhysicalUnit (no version/branch/supplier/etc).
  receivedUnit: { id: string; vin: string } | null
  receivedUnitId: string | null
}

export type StockWorkspaceData = {
  branches: BranchOption[]
  suppliers: SupplierOption[]
  models: CatalogVehicleModel[]
  catalog: CatalogModel[]
  units: PhysicalUnit[]
  availability: SupplierAvailability[]
  supplies: SupplyOrder[]
}

export type CatalogModelDraft = {
  brandName?: string
  modelId?: string
  modelName?: string
  versionName: string
  scope: 'GLOBAL' | 'RESTRINGIDO'
  listPrice: number
  minimumPrice: number
}

export type UnitDraft = {
  vin: string
  branchId: string
  year: number
  mileage: number
  licensePlate?: string
  color?: string
  acabado?: string
  receivedAt: string
  acquisitionOrigin: AcquisitionOrigin
  supplierId?: string
}

export type CreateUnitsInput = {
  vehicleType: VehicleKind
  condition: VehicleCondition
  catalogModelId?: string
  catalogModel?: CatalogModelDraft
  units: UnitDraft[]
}

export type UpsertAvailabilityInput = {
  vehicleType: VehicleKind
  condition: VehicleCondition
  catalogModelId?: string
  catalogModel?: CatalogModelDraft
  supplierId: string
  quantity: number
  reportedAt: string
  notes?: string
}

export type ConfigurePriceInput = {
  versionId: string
  branchId?: string
  currency: string
  listPrice: number
  minimumPrice: number
  validFrom: string
  validUntil?: string
}

export type UpdateCatalogModelInput = {
  versionId: string
  modelId: string
  brandId: string
  brandName?: string
  modelName?: string
  versionName: string
  active: boolean
  // Only sent when the logged-in user has catalogo.costos.gestionar.
  costPrice?: number
}

export type ReceiveSupplyInput = {
  vin: string
  branchId: string
  year: number
  mileage: number
  licensePlate?: string
  color?: string
  receivedAt: string
  idempotencyKey: string
}

export type StockCapabilities = {
  viewCatalog: boolean
  viewAvailability: boolean
  viewSupply: boolean
  createUnits: boolean
  createCatalog: boolean
  createSharedCatalog: boolean
  manageAvailability: boolean
  manageSupply: boolean
  receiveSupply: boolean
  // Optional: catalogo.costos.consultar / catalogo.costos.gestionar are new
  // permissions most roles don't hold. Kept optional (default falsy) so
  // existing fixtures/tests that build a StockCapabilities literal without
  // them keep compiling.
  viewCosts?: boolean
  manageCosts?: boolean
}
