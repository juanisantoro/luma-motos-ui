export type VehicleKind = 'MOTO' | 'AUTO'
export type VehicleCondition = 'NUEVO' | 'USADO'

export type AcquisitionOrigin =
  | 'PROVEEDOR'
  | 'TOMA_PARTE_PAGO'
  | 'OTRO'

export type UnitStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'SOLD'
  | 'TRADE_IN'

export type SupplyStatus =
  | 'PENDIENTE_APROBACION'
  | 'PENDIENTE_CONFIRMACION'
  | 'CONFIRMADO'
  | 'PEDIDO'
  | 'EN_TRANSITO'
  | 'RECIBIDA'
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
  destinationBranch: BranchOption | null
  requestedAt: string | null
  receivedUnit: PhysicalUnit | null
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
}

export type UnitDraft = {
  vin: string
  branchId: string
  year: number
  mileage: number
  licensePlate?: string
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
  catalogModelId: string
  supplierId: string
  quantity: number
  notes?: string
}

export type ReceiveSupplyInput = {
  vin: string
  branchId: string
  year: number
  mileage: number
  licensePlate?: string
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
}
