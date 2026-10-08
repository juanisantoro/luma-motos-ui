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
  // Gastos de motos / autos: proveedor y unidad son opcionales.
  provider: CatalogOption | null
  amount: number
  currency: string
  vehicleType: VehiclePaymentVehicleType
  branch: CatalogOption
  // Caja (de un administrador) desde la que se paga; null en los cargados
  // antes de exigirla.
  account: PayerAccountRef | null
  unit: {
    id: string
    vin: string
    licensePlate: string | null
  } | null
  vehicle: {
    vehicleType: VehiclePaymentVehicleType
    brand: string
    model: string
    version: string
  } | null
  operation: {
    id: string
    number: string
    // Fase 5: boleto y situación de la patente de la operación.
    ticketNumber?: string | null
    licensing?: {
      mode: 'BONIFICADA' | 'PAGA_CLIENTE' | null
      estimatedFrom: string | null
      estimatedTo: string | null
      overdue: boolean
      plate: {
        status:
          | 'EN_TRAMITE'
          | 'EN_TRAMITE_VENCIDA'
          | 'RECIBIDA'
          | 'RECIBIDA_COBRO_PENDIENTE'
          | 'RECIBIDA_COBRADA'
          | 'NO_APLICA'
        number: string | null
        receivedAt: string | null
      }
    } | null
  } | null
  createdAt: string
  updatedAt: string
}

export type PayerAccountRef = {
  id: string
  name: string
  responsible: string | null
}

export type PayerAccount = PayerAccountRef & {
  currency: string
  branchId: string | null
  // Es del usuario: puede pagar (y devolver) desde ella.
  own: boolean
}

export type VehiclePaymentQuery = {
  page: number
  limit: number
  conceptId?: string
  providerId?: string
  accountId?: string
  status?: VehiclePaymentStatus
  month?: number
  year?: number
  search?: string
  organizationId?: string
}

export type CreateVehiclePaymentInput = {
  conceptId: string
  vehicleType: VehiclePaymentVehicleType
  accountId?: string
  unitId?: string
  branchId?: string
  operationId?: string
  providerId?: string
  amount: number
  paymentDate: string
  status?: VehiclePaymentStatus
  notes?: string
  organizationId?: string
}

export type UpdateVehiclePaymentInput = {
  conceptId?: string
  operationId?: string | null
  providerId?: string | null
  accountId?: string
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
