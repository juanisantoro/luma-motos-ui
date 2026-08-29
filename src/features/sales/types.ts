import type {
  VehicleCondition,
  VehicleKind,
} from '../stock/types'

export type SalesOperationStatus =
  | 'BORRADOR'
  | 'PENDIENTE_APROBACION'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'CANCELADA'
  | 'CERRADA'

export type SalesReservationStatus =
  | 'ACTIVO'
  | 'LIBERADA'
  | 'VENCIDA'
  | 'CONSUMIDA'

export type SalesApprovalDecision =
  | 'PENDIENTE'
  | 'APROBADA'
  | 'RECHAZADA'

export type SalesOperation = {
  id: string
  number: string
  operationDate: string
  status: SalesOperationStatus
  deliveryStatus: string
  documentationStatus: string
  listPrice: string | null
  minimumPrice: string | null
  agreedPrice: string
  currency: string
  notes: string | null
  rowVersion: number
  organizationId: string
  createdAt: string
  updatedAt: string
  client: {
    id: string
    fullName: string
    active: boolean
  }
  branch: {
    id: string
    code: string
    name: string
  }
  vehicle: {
    versionId: string
    versionName: string | null
    condition: VehicleCondition
    model: {
      id: string
      name: string
      vehicleType: VehicleKind
      brand: {
        id: string
        name: string
      }
    }
    unit: {
      id: string
      vin: string
      licensePlate: string | null
      inventoryStatus: string
    } | null
  }
  seller: {
    id: string
    fullName: string
  } | null
  reservation: {
    id: string
    unitId: string
    status: SalesReservationStatus
    quantity: number
    expiresAt: string | null
    releasedAt: string | null
    releaseReason: string | null
  } | null
  approval: {
    id: string
    decision: SalesApprovalDecision
    requestedAt: string
    decidedAt: string | null
    reason: string | null
    listPriceReference: string
    minimumPriceReference: string
    agreedPriceReference: string
  } | null
}

export type SalesOperationPage = {
  items: SalesOperation[]
  total: number
  page: number
  limit: number
}

export type SalesOperationQuery = {
  status?: SalesOperationStatus
  branchId?: string
  clientId?: string
  sellerId?: string
  mine?: boolean
  versionId?: string
  search?: string
  from?: string
  to?: string
  organizationId?: string
  page?: number
  limit?: number
}

export type SalesSeller = {
  id: string
  employeeCode: string
  fullName: string
}

export type SalesSellerPage = {
  items: SalesSeller[]
  total: number
  page: number
  limit: number
}

export type SalesPricePolicy = {
  id: string
  versionId: string
  branchId: string | null
  organizationId: string
  currency: string
  listPrice: string
  minimumPrice: string
  validFrom: string
  validUntil: string | null
  scope: 'BRANCH' | 'ORGANIZATION'
}

export type CreateSupplyRequestInput = {
  supplierId: string
  supplierAvailabilityId?: string
  operationId: string
  versionId: string
  condition: VehicleCondition
  arrivalBranchId: string
  notes?: string
  organizationId?: string
}

export type LinkedSupplyRequest = {
  id: string
  operationId: string | null
  supplierAvailabilityId: string | null
  status: string
}

export type CreateSalesOperationInput = {
  branchId: string
  clientId: string
  versionId: string
  condition: VehicleCondition
  agreedPrice: number
  unitId?: string
  sellerId?: string
  operationDate?: string
  reservationExpiresAt?: string
  notes?: string
  organizationId?: string
}

export type UpdateSalesOperationInput = {
  expectedVersion: number
  branchId?: string
  clientId?: string
  sellerId?: string
  agreedPrice?: number
  notes?: string | null
}
