export type VehiclePaymentStatus = 'PENDIENTE' | 'PAGADO'
export type VehiclePaymentVehicleType = 'MOTO' | 'AUTO'

export type CatalogOption = {
  id: string
  name: string
}

export type VehiclePayment = {
  id: string
  date: string
  status: VehiclePaymentStatus
  month: number
  year: number
  notes: string | null
  concept: CatalogOption
  provider: CatalogOption
  amount: number
  unit: {
    id: string
    vin: string
    licensePlate: string | null
  }
  vehicle: {
    vehicleType: VehiclePaymentVehicleType
    brand: string
    model: string
    version: string
  }
  operation: { id: string; number: string } | null
  createdAt: string
  updatedAt: string
}

export type VehiclePaymentQuery = {
  page: number
  limit: number
  conceptId?: string
  providerId?: string
  status?: VehiclePaymentStatus
  month?: number
  year?: number
  search?: string
  organizationId?: string
}

export type CreateVehiclePaymentInput = {
  conceptId: string
  unitId: string
  operationId?: string
  providerId: string
  amount: number
  paymentDate: string
  status?: VehiclePaymentStatus
  notes?: string
  organizationId?: string
}

export type UpdateVehiclePaymentInput = {
  conceptId?: string
  operationId?: string | null
  providerId?: string
  amount?: number
  paymentDate?: string
  status?: VehiclePaymentStatus
  notes?: string | null
}

export type PageResponse<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}
