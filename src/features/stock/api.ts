import {
  apiUpload,
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
  CatalogPricePolicy,
  ConfigurePriceInput,
  CreateUnitsInput,
  PhysicalUnit,
  ReceiveSupplyInput,
  StockCapabilities,
  SupplierAvailability,
  SupplierOption,
  SupplyOrder,
  SupplyStatus,
  UpdateCatalogModelInput,
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
  scope?: 'GLOBAL' | 'RESTRINGIDO'
  model: EmbeddedModelDto
  photoUrl?: string | null
  // Absent from the payload entirely for an actor without
  // catalogo.costos.consultar - the backend omits the key, it does not
  // send null.
  costPrice?: string | null
}

type VersionDto = VersionSummaryDto & {
  active: boolean
  hasActivePricePolicy?: boolean
  pricingStatus?: 'ACTIVE' | 'MISSING'
  activePricePolicy?: (Omit<PricePolicyDto, 'versionId'> & {
    scope: 'BRANCH' | 'ORGANIZATION'
    status: 'ACTIVE'
  }) | null
}

type PricePolicyDto = {
  id: string
  versionId: string
  branchId: string | null
  currency: string
  listPrice: string
  minimumPrice: string
  validFrom: string
  validUntil: string | null
  scope?: 'BRANCH' | 'ORGANIZATION'
  status?: 'ACTIVE' | 'INACTIVE'
  active?: boolean
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
  // The API never sends vehicleType at this level - it only lives nested
  // under version.model.vehicleType. Do not add it back here without also
  // updating the backend response; physicalUnit() below derives it from
  // the nested version instead.
  condition: VehicleCondition
  vin: string
  manufactureYear: number | null
  mileageKm: number | null
  licensePlate: string | null
  color: string | null
  acabado: string | null
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
  color: string | null
  requestedAt: string
  version: VersionSummaryDto
  supplier: SupplierDto
  branch: BranchDto
  operationId?: string | null
  operation?: {
    id: string
    operationNumber?: string | null
    status?: string | null
    client?: {
      fullName?: string | null
      documentNumber?: string | null
    } | null
  } | null
  receivedUnit?: {
    id: string
    vin: string
    branchId: string | null
  } | null
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
  selectedPricePolicy: CatalogPricePolicy | null = null,
  pricePolicies: CatalogPricePolicy[] = selectedPricePolicy
    ? [selectedPricePolicy]
    : [],
): CatalogModel {
  const versionDto = dto as VersionDto
  const activePolicy =
    versionDto.activePricePolicy
      ? pricePolicy({ ...versionDto.activePricePolicy, versionId: dto.id })
      : selectedPricePolicy
  return {
    id: dto.id,
    brandId: dto.model.brand.id,
    modelId: dto.model.id,
    vehicleType: dto.model.vehicleType,
    brand: dto.model.brand.name,
    model: dto.model.name,
    version: dto.name,
    active,
    ...(dto.scope ? { scope: dto.scope } : {}),
    ...(versionDto.pricingStatus
      ? { pricingStatus: versionDto.pricingStatus }
      : {}),
    pricePolicy: activePolicy,
    pricePolicies:
      activePolicy && pricePolicies.length === 0 ? [activePolicy] : pricePolicies,
    photoUrl: dto.photoUrl ?? null,
    ...(versionDto.costPrice !== undefined && versionDto.costPrice !== null
      ? { costPrice: Number(versionDto.costPrice) }
      : {}),
  }
}

function pricePolicy(dto: PricePolicyDto): CatalogPricePolicy {
  return {
    id: dto.id,
    versionId: dto.versionId,
    branchId: dto.branchId,
    currency: dto.currency,
    listPrice: Number(dto.listPrice),
    minimumPrice: Number(dto.minimumPrice),
    validFrom: dto.validFrom,
    validUntil: dto.validUntil,
    ...(dto.scope ? { scope: dto.scope } : {}),
    ...(dto.status ? { status: dto.status } : {}),
    ...(dto.active !== undefined ? { active: dto.active } : {}),
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
    // The unit payload has no top-level vehicleType (see UnitDto above) -
    // it comes from the version's model instead.
    vehicleType: dto.version.model.vehicleType,
    catalogModel: catalogVersion(dto.version),
    condition: dto.condition,
    vin: dto.vin,
    year: dto.manufactureYear ?? new Date(dto.receivedAt).getFullYear(),
    mileage: dto.mileageKm ?? 0,
    licensePlate: dto.licensePlate,
    color: dto.color,
    acabado: dto.acabado,
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

export function listSalesBranches(
  organizationId?: string,
  signal?: AbortSignal,
) {
  return request<BranchDto[]>(
    listPath('/inventory/branches', { organizationId }),
    signal ? { signal } : {},
  ).then((items) => uniqueById(items.map(branch)))
}

type UnitColorDto = {
  id: string
  name: string
}

export function listUnitColors(signal?: AbortSignal) {
  return request<UnitColorDto[]>(
    '/inventory/colors',
    signal ? { signal } : {},
  )
}

export function listSalesPhysicalUnits(
  vehicleType: VehicleKind,
  organizationId?: string,
  search?: string,
  signal?: AbortSignal,
) {
  return requestAll<UnitDto>(
    '/inventory/units',
    {
      vehicleType,
      inventoryStatus: 'EN_STOCK',
      organizationId,
      search,
    },
    signal,
  ).then((items) => items.map(physicalUnit))
}

export function listAllPhysicalUnits(
  vehicleType: VehicleKind,
  organizationId?: string,
  search?: string,
  signal?: AbortSignal,
) {
  // Unlike listSalesPhysicalUnits, this is not restricted to EN_STOCK - it's
  // used to find a unit regardless of status (e.g. already sold/delivered),
  // for flows like vehicle-payments where the VIN being tracked is often a
  // unit that has already left the lot.
  return requestAll<UnitDto>(
    '/inventory/units',
    { vehicleType, organizationId, search },
    signal,
  ).then((items) => items.map(physicalUnit))
}

export function listSalesSupplierAvailability(
  vehicleType: VehicleKind,
  organizationId?: string,
  search?: string,
  signal?: AbortSignal,
) {
  return requestAll<AvailabilityDto>(
    '/supplier-availability',
    { vehicleType, organizationId, search },
    signal,
  ).then((items) => items.map(availability))
}

export function listSalesCatalogModels(
  vehicleType: VehicleKind,
  organizationId?: string,
  branchId?: string,
  signal?: AbortSignal,
) {
  return requestAll<VersionDto>(
    '/catalog/versions',
    { vehicleType, active: true, organizationId, branchId },
    signal,
  ).then((items) => items.map((item) => catalogVersion(item)))
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
    color: dto.color,
    destinationBranch: branch(dto.branch),
    requestedAt: dto.requestedAt,
    operation:
      dto.operation || dto.operationId
        ? {
            id: dto.operation?.id ?? dto.operationId ?? '',
            number: dto.operation?.operationNumber ?? null,
            status: dto.operation?.status ?? null,
            clientName: dto.operation?.client?.fullName ?? null,
            clientDocument: dto.operation?.client?.documentNumber ?? null,
          }
        : null,
    // The supply-requests endpoint embeds only a partial projection of
    // the received unit (id/vin/branchId) - not the full UnitDto shape
    // (no version/branch/supplier/etc). Mapping it through physicalUnit()
    // used to throw a TypeError (undefined.model) whenever a supply
    // request already had a received unit, which surfaced as the
    // generic "Ocurrio un error inesperado" stock error screen.
    receivedUnit: dto.receivedUnit
      ? { id: dto.receivedUnit.id, vin: dto.receivedUnit.vin }
      : null,
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
    color: item.color,
    acabado: item.acabado,
    branchId: item.branchId,
    supplierId: item.supplierId,
    acquisitionOrigin: item.acquisitionOrigin,
    receivedAt: item.receivedAt,
    organizationId,
  }))
}

async function createVersion(
  input: Pick<CreateUnitsInput, 'vehicleType' | 'catalogModelId' | 'catalogModel'>,
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

async function configurePrice(
  input: ConfigurePriceInput,
  organizationId?: string,
) {
  if (input.minimumPrice > input.listPrice) {
    throw new Error('El precio mínimo no puede superar el precio sugerido.')
  }
  await request<PricePolicyDto>('/catalog/price-policies', {
    method: 'POST',
    body: {
      versionId: input.versionId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      currency: input.currency,
      listPrice: input.listPrice,
      minimumPrice: input.minimumPrice,
      validFrom: `${input.validFrom}T00:00:00.000Z`,
      ...(input.validUntil
        ? { validUntil: `${input.validUntil}T23:59:59.999Z` }
        : {}),
      organizationId,
    },
  })
}

async function ensureDraftPrice(
  versionId: string,
  draft: CreateUnitsInput['catalogModel'],
  vehicleType: VehicleKind,
  organizationId?: string,
) {
  if (!draft) return
  const policies = await requestAll<PricePolicyDto>('/catalog/price-policies', {
    vehicleType,
    versionId,
    organizationId,
  })
  if (policies.length > 0) return
  await configurePrice(
    {
      versionId,
      currency: 'ARS',
      listPrice: draft.listPrice,
      minimumPrice: draft.minimumPrice,
      validFrom: new Date().toISOString().slice(0, 10),
    },
    organizationId,
  )
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
  const policiesPromise = capabilities.viewCatalog
    ? requestAll<PricePolicyDto>(
        '/catalog/price-policies',
        baseQuery,
        signal,
      )
    : Promise.resolve([])
  const branchesPromise = request<BranchDto[]>(
    listPath('/inventory/branches', { organizationId }),
    signal ? { signal } : {},
  )

  const [unitDtos, versionDtos, modelDtos, supplierDtos, policyDtos, branchDtos, availabilityDtos, supplyDtos] =
    await Promise.all([
      requestAll<UnitDto>('/inventory/units', baseQuery, signal),
      versionsPromise,
      modelsPromise,
      suppliersPromise,
      policiesPromise,
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
  const policiesByVersion = new Map<string, CatalogPricePolicy[]>()
  policyDtos.map(pricePolicy).forEach((policy) => {
    const policies = policiesByVersion.get(policy.versionId) ?? []
    policies.push(policy)
    policiesByVersion.set(policy.versionId, policies)
  })

  return {
    branches,
    suppliers: supplierDtos.map(supplier),
    models: modelDtos.map(vehicleModel),
    catalog: versionDtos.map((item) => {
      const policies = policiesByVersion.get(item.id) ?? []
      const organizationPolicy =
        policies
          .filter((policy) => !policy.branchId)
          .sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0] ??
        null
      return catalogVersion(item, item.active, organizationPolicy, policies)
    }),
    units,
    availability: availabilityDtos.map(availability),
    supplies,
  }
}

export const stockApiGateway: StockGateway = {
  loadWorkspace,
  async createUnits(input, organizationId) {
    const versionId = await createVersion(input, organizationId)
    await ensureDraftPrice(
      versionId,
      input.catalogModel,
      input.vehicleType,
      organizationId,
    )
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
  async upsertAvailability(input: UpsertAvailabilityInput, organizationId) {
    const versionId = await createVersion(input, organizationId)
    await ensureDraftPrice(
      versionId,
      input.catalogModel,
      input.vehicleType,
      organizationId,
    )
    await request<AvailabilityDto>('/supplier-availability', {
      method: 'PUT',
      body: {
        supplierId: input.supplierId,
        versionId,
        condition: input.condition,
        reportedQuantity: input.quantity,
        reportedAt: input.reportedAt,
        notes: input.notes,
      },
    })
  },
  configurePrice,
  async updateCatalogModel(input: UpdateCatalogModelInput) {
    if (input.brandName) {
      await request<BrandDto>(`/catalog/brands/${input.brandId}`, {
        method: 'PATCH',
        body: { name: input.brandName },
      })
    }
    if (input.modelName) {
      await request<ModelDto>(`/catalog/models/${input.modelId}`, {
        method: 'PATCH',
        body: { name: input.modelName },
      })
    }
    await request<VersionDto>(`/catalog/versions/${input.versionId}`, {
      method: 'PATCH',
      body: {
        name: input.versionName,
        active: input.active,
        ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
      },
    })
  },
  async uploadCatalogVersionPhoto(versionId, file) {
    await apiUpload<VersionDto>(
      `/catalog/versions/${versionId}/photo`,
      file,
      'photo',
      { token: token() },
    )
  },
  async updateUnitColor(unitId, input) {
    await request<UnitDto>(`/inventory/units/${unitId}`, {
      method: 'PATCH',
      body: { color: input.color, acabado: input.acabado },
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
          receivedAt: input.receivedAt,
          licensePlate: input.licensePlate,
          color: input.color,
          idempotencyKey: input.idempotencyKey,
        },
      },
    )
  },
}
