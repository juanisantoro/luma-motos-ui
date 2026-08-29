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

export type SalesPaymentPlatform =
  | 'EFECTIVO'
  | 'CREDITO'
  | 'EFECTIVO_CREDITO'
  | 'MOTO_EFECTIVO'
  | 'MOTO_CREDITO'
  | 'MOTO_EFECTIVO_CREDITO'

export type SalesDeliveryStatus =
  | 'NO_PROGRAMADA'
  | 'PROGRAMADA'
  | 'LISTA'
  | 'ENTREGADO'
  | 'CANCELADA'

export type SalesDebt =
  | 'NO'
  | 'RESERVA'
  | 'CUOTA_INICIAL'
  | 'PAPELES'
  | 'ACCESORIOS'
  | 'OTRO'

export type SalesOperation = {
  id: string
  number: string
  operationDate: string
  status: SalesOperationStatus
  deliveryStatus: SalesDeliveryStatus
  documentationStatus: string
  papersDelivered: boolean
  papersDeliveredAt: string | null
  debt: SalesDebt
  month: string
  listPrice: string | null
  minimumPrice: string | null
  agreedPrice: string
  currency: string
  paymentPlatform: SalesPaymentPlatform | null
  creditAmount: string | null
  guarantor: string | null
  notes: string | null
  rowVersion: number
  organizationId: string
  createdAt: string
  updatedAt: string
  client: {
    id: string
    fullName: string
    active: boolean
    documentType?: string | null
    documentNumber?: string | null
    phone?: string | null
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
      acquisitionOrigin: string
      supplier: { id: string; legalName: string } | null
    } | null
    chassis: string | null
  }
  seller: {
    id: string
    fullName: string
  } | null
  contact: {
    id: string
    fullName: string
  } | null
  createdBy: {
    id: string
    fullName: string
  } | null
  supply: {
    id: string
    status: string
    supplier: { id: string; legalName: string }
    destinationBranch: { id: string; code: string; name: string }
    supplierReference: string | null
    notes: string | null
  } | null
  reservation: {
    id: string
    unitId: string | null
    supplierAvailabilityId: string | null
    status: SalesReservationStatus
    quantity: number
    expiresAt: string | null
    releasedAt: string | null
    releaseReason: string | null
  } | null
  paymentComponents: Array<{
    id: string
    type: string
    expectedAmount: string
    dueDate: string | null
    financialInstitutionId: string | null
    creditInquiryId: string | null
    tradeInVehicleId: string | null
    paymentStatus: string
    notes: string | null
  }>
  tradeIns: Array<{
    id: string
    description: string
    appraisedAmount: string
    acceptedAmount: string | null
    status: string
  }>
  obligations: Array<{
    id: string
    type: string
    status: string
    amount: string | null
    dueDate: string | null
    fulfilledAt: string | null
    notes: string | null
  }>
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
  vehicleType: VehicleKind
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

type CreateSalesOperationBase = {
  vehicleType: VehicleKind
  branchId: string
  versionId: string
  condition: VehicleCondition
  agreedPrice: number
  unitId?: string
  supplierAvailabilityId?: string
  sellerId?: string
  contactId?: string
  paymentPlatform: SalesPaymentPlatform
  creditAmount?: number
  guarantor?: string
  operationDate?: string
  reservationExpiresAt?: string
  deliveryStatus?: SalesDeliveryStatus
  papersDelivered?: boolean
  debt?: SalesDebt
  submit?: boolean
  notes?: string
  organizationId?: string
}

export type CreateSalesOperationInput = CreateSalesOperationBase &
  (
    | {
        clientId: string
        client?: never
      }
    | {
        clientId?: never
        client: {
          documentType: 'DNI' | 'CI'
          documentNumber: string
          fullName: string
          phone?: string
        }
      }
  )

export type UpdateSalesOperationInput = {
  expectedVersion: number
  branchId?: string
  clientId?: string
  sellerId?: string
  contactId?: string | null
  agreedPrice?: number
  paymentPlatform?: SalesPaymentPlatform
  creditAmount?: number | null
  guarantor?: string | null
  operationDate?: string
  deliveryStatus?: SalesDeliveryStatus
  papersDelivered?: boolean
  debt?: SalesDebt
  notes?: string | null
}
