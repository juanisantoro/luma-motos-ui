import {
  AUTH_TOKEN_KEY,
  apiRequest,
} from '../../shared/api/client'
import type { StockGateway } from './gateway'
import type {
  AcquisitionOrigin,
  BranchOption,
  CatalogBrand,
  CatalogModel,
  CatalogVehicleModel,
  CreateUnitsInput,
  PhysicalUnit,
  ReceiveSupplyInput,
  StockCapabilities,
  SupplierAvailability,
  SupplierOption,
  SupplyOrder,
  SupplyStatus,
  UnitStatus,
  UpsertAvailabilityInput,
  VehicleCondition,
  VehicleKind,
} from './types'

type Page<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

type BrandDto = {
  id: string
  name: string
  active: boolean
}

type ModelDto = {
  id: string
  vehicleType: VehicleKind
  name: string
  active: boolean
  brand: BrandDto
}

type VersionDto = {
  id: string
  name: string
  active: boolean
  model: ModelDto
}

type BranchDto = {
  id: string
  name: string
}

type SupplierDto = {
  id: string
  name: string
}

type UnitDto = {
  id: string
  vehicleType: VehicleKind
  condition: VehicleCondition
  vin: string
  manufactureYear: number | null
  mileageKm: number | null
  licensePlate: string | null
  acquisitionOrigin: AcquisitionOrigin
  inventoryStatus: string
  receivedAt: string
  version: VersionDto
  branch: BranchDto
  supplier: SupplierDto | null
}

type AvailabilityDto = {
  id: string
  condition: VehicleCondition
  reportedQuantity: number
  notes: string | null
  reportedAt: string
  version: VersionDto
  supplier: SupplierDto
}

type SupplyRequestDto = {
  id: string
  condition: VehicleCondition
  status: SupplyStatus
  createdAt: string
  version: VersionDto
  supplier: SupplierDto
  arrivalBranch: BranchDto
  receivedUnit: UnitDto | null
}

type ReceiveResponseDto = {
  supplyRequest: SupplyRequestDto
  unit: UnitDto
  replayed: boolean
}

function token() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

function listPath(
  path: `/${string}`,
  query: Record<string, string | boolean | undefined>,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value))
  })
  return `${path}?${search.toString()}` as `/${string}`
}

function request<T>(
  path: `/${string}`,
  options: Parameters<typeof apiRequest<T>>[1] = {},
) {
  return apiRequest<T>(path, { ...options, token: token() })
}

async function requestAll<T>(
  path: `/${string}`,
  query: Record<string, string | boolean | undefined>,
  signal?: AbortSignal,
) {
  const items: T[] = []
  let page = 1
  let total = 0
  do {
    const response = await request<Page<T>>(
      listPath(path, {
        ...query,
        page: String(page),
        limit: '100',
      }),
      signal ? { signal } : {},
    )
    items.push(...response.items)
    total = response.total
    if (response.items.length === 0) break
    page += 1
  } while (items.length < total)
  return items
}

function brand(dto: BrandDto): CatalogBrand {
  return { id: dto.id, name: dto.name, active: dto.active }
}

function vehicleModel(dto: ModelDto): CatalogVehicleModel {
  return {
    id: dto.id,
    vehicleType: dto.vehicleType,
    name: dto.name,
    active: dto.active,
    brand: brand(dto.brand),
  }
}

function catalogVersion(dto: VersionDto): CatalogModel {
  return {
    id: dto.id,
    brandId: dto.model.brand.id,
    modelId: dto.model.id,
    vehicleType: dto.model.vehicleType,
    brand: dto.model.brand.name,
    model: dto.model.name,
    version: dto.name,
    active: dto.active && dto.model.active && dto.model.brand.active,
  }
}

function branch(dto: BranchDto): BranchOption {
  return { id: dto.id, name: dto.name }
}

function supplier(dto: SupplierDto): SupplierOption {
  return { id: dto.id, name: dto.name }
}

function unitStatus(status: string): UnitStatus {
  const statuses: Record<string, UnitStatus> = {
    DISPONIBLE: 'AVAILABLE',
    EN_STOCK: 'AVAILABLE',
    RESERVADA: 'RESERVED',
    RESERVADO: 'RESERVED',
    VENDIDA: 'SOLD',
    VENDIDO: 'SOLD',
    PARTE_PAGO: 'TRADE_IN',
    TOMA_PARTE_PAGO: 'TRADE_IN',
  }
  const mapped = statuses[status]
  if (!mapped) throw new Error(`Estado de inventario no soportado: ${status}`)
  return mapped
}

function physicalUnit(dto: UnitDto): PhysicalUnit {
  return {
    id: dto.id,
    vehicleType: dto.vehicleType,
    catalogModel: catalogVersion(dto.version),
    condition: dto.condition,
    vin: dto.vin,
    year: dto.manufactureYear ?? new Date(dto.receivedAt).getFullYear(),
    mileage: dto.mileageKm ?? 0,
    licensePlate: dto.licensePlate,
    acquisitionOrigin: dto.acquisitionOrigin,
    supplier: dto.supplier ? supplier(dto.supplier) : null,
    status: unitStatus(dto.inventoryStatus),
    branch: branch(dto.branch),
    receivedAt: dto.receivedAt,
  }
}

function availability(dto: AvailabilityDto): SupplierAvailability {
  const version = catalogVersion(dto.version)
  return {
    id: dto.id,
    vehicleType: version.vehicleType,
    catalogModel: version,
    condition: dto.condition,
    supplier: supplier(dto.supplier),
    quantity: dto.reportedQuantity,
    notes: dto.notes,
    updatedAt: dto.reportedAt,
  }
}

function supplyRequest(dto: SupplyRequestDto): SupplyOrder {
  const version = catalogVersion(dto.version)
  return {
    id: dto.id,
    vehicleType: version.vehicleType,
    catalogModel: version,
    condition: dto.condition,
    supplier: supplier(dto.supplier),
    quantity: 1,
    status: dto.status,
    destinationBranch: branch(dto.arrivalBranch),
    requestedAt: dto.createdAt,
    receivedUnit: dto.receivedUnit ? physicalUnit(dto.receivedUnit) : null,
  }
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function unitInput(versionId: string, input: CreateUnitsInput) {
  return input.units.map((item) => ({
    versionId,
    vin: item.vin,
    condition: input.condition,
    licensePlate: item.licensePlate,
    manufactureYear: item.year,
    mileageKm: item.mileage,
    branchId: item.branchId,
    supplierId: item.supplierId,
    acquisitionOrigin: item.acquisitionOrigin,
    receivedAt: item.receivedAt,
  }))
}

async function createVersion(input: CreateUnitsInput) {
  const draft = input.catalogModel
  if (!draft) {
    if (!input.catalogModelId) throw new Error('Falta la versión del catálogo.')
    return input.catalogModelId
  }

  let modelId = draft.modelId
  if (!modelId) {
    if (!draft.brandName || !draft.modelName) {
      throw new Error('Faltan la marca o el modelo.')
    }
    const createdBrand = await request<BrandDto>('/catalog/brands', {
      method: 'POST',
      body: { name: draft.brandName },
    })
    const createdModel = await request<ModelDto>('/catalog/models', {
      method: 'POST',
      body: {
        brandId: createdBrand.id,
        vehicleType: input.vehicleType,
        name: draft.modelName,
      },
    })
    modelId = createdModel.id
  }

  const version = await request<VersionDto>('/catalog/versions', {
    method: 'POST',
    body: {
      modelId,
      name: draft.versionName,
      scope: draft.scope,
    },
  })
  return version.id
}

async function loadWorkspace(
  vehicleType: VehicleKind,
  capabilities: StockCapabilities,
  currentBranch: BranchOption | null,
  signal?: AbortSignal,
) {
  const baseQuery = { vehicleType }
  const versionsPromise =
    capabilities.viewCatalog || capabilities.createUnits
      ? requestAll<VersionDto>(
          '/catalog/versions',
          { ...baseQuery, active: true },
          signal,
        )
      : Promise.resolve([])
  const modelsPromise =
    capabilities.createCatalog || capabilities.viewCatalog
      ? requestAll<ModelDto>(
          '/catalog/models',
          { ...baseQuery, active: true },
          signal,
        )
      : Promise.resolve([])
  const suppliersPromise =
    capabilities.viewAvailability ||
    capabilities.manageAvailability ||
    capabilities.createUnits
      ? requestAll<SupplierDto>('/suppliers', { active: true }, signal)
      : Promise.resolve([])

  const [unitDtos, versionDtos, modelDtos, supplierDtos, availabilityDtos, supplyDtos] =
    await Promise.all([
      requestAll<UnitDto>('/inventory/units', baseQuery, signal),
      versionsPromise,
      modelsPromise,
      suppliersPromise,
      capabilities.viewAvailability
        ? requestAll<AvailabilityDto>(
            '/supplier-availability',
            baseQuery,
            signal,
          )
        : Promise.resolve([]),
      capabilities.viewSupply
        ? requestAll<SupplyRequestDto>(
            '/supply-requests',
            baseQuery,
            signal,
          )
        : Promise.resolve([]),
    ])

  const units = unitDtos.map(physicalUnit)
  const supplies = supplyDtos.map(supplyRequest)
  const branches = uniqueById([
    ...(currentBranch ? [currentBranch] : []),
    ...units.map((item) => item.branch),
    ...supplies
      .map((item) => item.destinationBranch)
  ])

  return {
    branches,
    suppliers: supplierDtos.map(supplier),
    models: modelDtos.map(vehicleModel),
    catalog: versionDtos.map(catalogVersion),
    units,
    availability: availabilityDtos.map(availability),
    supplies,
  }
}

export const stockApiGateway: StockGateway = {
  loadWorkspace,
  async createUnits(input) {
    const versionId = await createVersion(input)
    const units = unitInput(versionId, input)
    if (units.length === 1) {
      await request<UnitDto>('/inventory/units', {
        method: 'POST',
        body: units[0],
      })
      return
    }
    await request<UnitDto[]>('/inventory/units/bulk', {
      method: 'POST',
      body: units,
    })
  },
  async upsertAvailability(input: UpsertAvailabilityInput) {
    await request<AvailabilityDto>('/supplier-availability', {
      method: 'PUT',
      body: {
        supplierId: input.supplierId,
        versionId: input.catalogModelId,
        condition: input.condition,
        reportedQuantity: input.quantity,
        notes: input.notes,
      },
    })
  },
  async transitionSupply(supplyId, status) {
    await request<SupplyRequestDto>(
      `/supply-requests/${supplyId}/transitions`,
      { method: 'POST', body: { toStatus: status } },
    )
  },
  async receiveSupply(supplyId, input: ReceiveSupplyInput) {
    await request<ReceiveResponseDto>(
      `/supply-requests/${supplyId}/receive`,
      {
        method: 'POST',
        body: {
          vin: input.vin,
          manufactureYear: input.year,
          mileageKm: input.mileage,
          licensePlate: input.licensePlate,
          idempotencyKey: input.idempotencyKey,
        },
      },
    )
  },
}
