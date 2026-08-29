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

type EmbeddedModelDto = {
  id: string
  vehicleType: VehicleKind
  name: string
  brand: {
    id: string
    name: string
  }
}

type VersionSummaryDto = {
  id: string
  name: string
  model: EmbeddedModelDto
}

type VersionDto = VersionSummaryDto & {
  active: boolean
}

type BranchDto = {
  id: string
  name: string
}

type SupplierDto = {
  id: string
  legalName: string
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
  inventoryStatus: UnitStatus
  receivedAt: string
  version: VersionSummaryDto
  branch: BranchDto
  supplier: SupplierDto | null
}

type AvailabilityDto = {
  id: string
  condition: VehicleCondition
  reportedQuantity: number
  notes: string | null
  reportedAt: string
  version: VersionSummaryDto
  supplier: SupplierDto
}

type SupplyRequestDto = {
  id: string
  condition: VehicleCondition
  status: SupplyStatus
  requestedAt: string
  version: VersionSummaryDto
  supplier: SupplierDto
  branch: BranchDto
  receivedUnitId: string | null
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
  return (search.size ? `${path}?${search.toString()}` : path) as `/${string}`
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
  let total: number | null = null
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
    total ??= response.total
    if (response.items.length === 0) break
    page += 1
  } while (total !== null && items.length < total)
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

function catalogVersion(
  dto: VersionSummaryDto,
  active = true,
): CatalogModel {
  return {
    id: dto.id,
    brandId: dto.model.brand.id,
    modelId: dto.model.id,
    vehicleType: dto.model.vehicleType,
    brand: dto.model.brand.name,
    model: dto.model.name,
    version: dto.name,
    active,
  }
}

function branch(dto: BranchDto): BranchOption {
  return { id: dto.id, name: dto.name }
}

function supplier(dto: SupplierDto): SupplierOption {
  return { id: dto.id, name: dto.legalName }
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
    status: dto.inventoryStatus,
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
    destinationBranch: branch(dto.branch),
    requestedAt: dto.requestedAt,
    receivedUnit: null,
    receivedUnitId: dto.receivedUnitId,
  }
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function unitInput(
  versionId: string,
  input: CreateUnitsInput,
  organizationId?: string,
) {
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
    organizationId,
  }))
}

async function createVersion(
  input: CreateUnitsInput,
  organizationId?: string,
) {
  const draft = input.catalogModel
  if (!draft) {
    if (!input.catalogModelId) throw new Error('Falta la versión del catálogo.')
    return input.catalogModelId
  }

  let modelId = draft.modelId
  if (!modelId) {
    const brandName = draft.brandName
    const modelName = draft.modelName
    if (!brandName || !modelName) {
      throw new Error('Faltan la marca o el modelo.')
    }
    const existingBrands = await requestAll<BrandDto>('/catalog/brands', {
      search: brandName,
      active: true,
    })
    const matchingBrand = existingBrands.find(
      (item) =>
        item.name.localeCompare(brandName, 'es', {
          sensitivity: 'base',
        }) === 0,
    )
    const selectedBrand =
      matchingBrand ??
      (await request<BrandDto>('/catalog/brands', {
        method: 'POST',
        body: { name: brandName },
      }))

    const existingModels = await requestAll<ModelDto>('/catalog/models', {
      vehicleType: input.vehicleType,
      brandId: selectedBrand.id,
      search: modelName,
      active: true,
    })
    const matchingModel = existingModels.find(
      (item) =>
        item.name.localeCompare(modelName, 'es', {
          sensitivity: 'base',
        }) === 0,
    )
    const selectedModel =
      matchingModel ??
      (await request<ModelDto>('/catalog/models', {
        method: 'POST',
        body: {
          brandId: selectedBrand.id,
          vehicleType: input.vehicleType,
          name: modelName,
        },
      }))
    modelId = selectedModel.id
  }

  const existingVersions = await requestAll<VersionDto>(
    '/catalog/versions',
    {
      vehicleType: input.vehicleType,
      modelId,
      search: draft.versionName,
      active: true,
      scope: draft.scope,
      organizationId,
    },
  )
  const matchingVersion = existingVersions.find(
    (item) =>
      item.name.localeCompare(draft.versionName, 'es', {
        sensitivity: 'base',
      }) === 0,
  )
  if (matchingVersion) return matchingVersion.id

  const version = await request<VersionDto>('/catalog/versions', {
    method: 'POST',
    body: {
      modelId,
      name: draft.versionName,
      scope: draft.scope,
      ...(draft.scope === 'RESTRINGIDO' && organizationId
        ? { organizationId }
        : {}),
    },
  })
  return version.id
}

async function loadWorkspace(
  vehicleType: VehicleKind,
  capabilities: StockCapabilities,
  organizationId: string | undefined,
  signal?: AbortSignal,
) {
  const baseQuery = { vehicleType, organizationId }
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
    capabilities.manageAvailability
      ? requestAll<SupplierDto>(
          '/suppliers',
          { active: true, organizationId },
          signal,
        )
      : Promise.resolve([])
  const branchesPromise = request<BranchDto[]>(
    listPath('/inventory/branches', { organizationId }),
    signal ? { signal } : {},
  )

  const [unitDtos, versionDtos, modelDtos, supplierDtos, branchDtos, availabilityDtos, supplyDtos] =
    await Promise.all([
      requestAll<UnitDto>('/inventory/units', baseQuery, signal),
      versionsPromise,
      modelsPromise,
      suppliersPromise,
      branchesPromise,
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
  const branches = uniqueById(branchDtos.map(branch))

  return {
    branches,
    suppliers: supplierDtos.map(supplier),
    models: modelDtos.map(vehicleModel),
    catalog: versionDtos.map((item) => catalogVersion(item, item.active)),
    units,
    availability: availabilityDtos.map(availability),
    supplies,
  }
}

export const stockApiGateway: StockGateway = {
  loadWorkspace,
  async createUnits(input, organizationId) {
    const versionId = await createVersion(input, organizationId)
    const units = unitInput(versionId, input, organizationId)
    if (units.length === 1) {
      await request<UnitDto>('/inventory/units', {
        method: 'POST',
        body: units[0],
      })
      return
    }
    await request<{ items: UnitDto[]; count: number }>('/inventory/units/bulk', {
      method: 'POST',
      body: { units },
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
          branchId: input.branchId,
          manufactureYear: input.year,
          mileageKm: input.mileage,
          licensePlate: input.licensePlate,
          idempotencyKey: input.idempotencyKey,
        },
      },
    )
  },
}
