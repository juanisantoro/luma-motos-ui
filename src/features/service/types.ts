export type ServiceOrderStatus =
  | 'RECIBIDA'
  | 'EN_TALLER'
  | 'TERMINADA'
  | 'ENTREGADA'
  | 'CANCELADA'

export type VehicleCondition = 'OPTIMO' | 'BUENO' | 'REGULAR'

export type ServiceTask = {
  description: string
  // Sí / No; null mientras el mecánico no la revisó.
  done: boolean | null
  notes: string | null
}

export type ServiceOil = {
  type: string | null
  viscosity: string | null
  liters: number | null
  filter: boolean | null
}

export type ServicePart = {
  code: string | null
  description: string
  quantity: number
  unitPrice: string | null
}

export type PersonRef = { id: string; fullName: string }

export type ServiceOrder = {
  id: string
  number: number
  status: ServiceOrderStatus
  version: number
  branch: { id: string; code: string; name: string }
  receptionDate: string
  client: {
    id: string | null
    name: string
    phone: string | null
    email: string | null
    document: string | null
    address: string | null
    locality: string | null
  }
  vehicle: {
    unitId: string | null
    plate: string | null
    chassis: string | null
    engine: string | null
    model: string | null
    year: number | null
  }
  currentKm: number
  nextServiceKm: number | null
  serviceType: { id: string | null; name: string }
  receptionNotes: string | null
  tasks: ServiceTask[]
  oil: ServiceOil
  parts: ServicePart[]
  diagnosis: string | null
  signedBy: PersonRef | null
  signedAt: string | null
  delivery: {
    at: string
    by: PersonRef | null
    vehicleCondition: VehicleCondition | null
    notes: string | null
    // Sólo para quien recibe o cobra: el mecánico no ve el importe.
    amount?: string | null
    incomeId?: string | null
  } | null
  cancellation: { at: string; reason: string } | null
  receivedBy: PersonRef | null
  createdAt: string
  updatedAt: string
}

export type ServiceType = {
  id: string
  name: string
  order: number
  tasks: string[]
  suggestedPrice: string | null
  currency: string
  active: boolean
}

export type ServiceOrderQuery = {
  page?: number
  limit?: number
  status?: string
  branchId?: string
  search?: string
}

export type PageResponse<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export type ReceptionInput = {
  branchId?: string
  receptionDate?: string
  clientId?: string
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  clientDocument?: string
  clientAddress?: string
  clientLocality?: string
  unitId?: string
  plate?: string
  chassis?: string
  engine?: string
  model?: string
  year?: number
  currentKm?: number
  nextServiceKm?: number | null
  serviceTypeId?: string
  serviceTypeOther?: string
  receptionNotes?: string
}

export type WorkInput = {
  expectedVersion: number
  tasks: ServiceTask[]
  oil: ServiceOil
  parts: ServicePart[]
  diagnosis: string | null
  nextServiceKm: number | null
}

export type DeliverInput = {
  expectedVersion: number
  idempotencyKey: string
  amount: string
  accountId?: string
  paymentMethod?: string
  handoverToId?: string
  deliveryDate?: string
  vehicleCondition: VehicleCondition
  notes?: string
  reference?: string
}

export type VehicleLookup = {
  units: Array<{
    unitId: string
    plate: string | null
    chassis: string | null
    engine: string | null
    year: number | null
    model: string
    client: {
      id: string
      name: string | null
      phone: string | null
      email: string | null
      document: string | null
      address: string | null
    } | null
  }>
  lastOrder: {
    id: string
    number: number
    receptionDate: string
    serviceType: string
    serviceTypeId: string | null
    currentKm: number
    nextServiceKm: number | null
    status: ServiceOrderStatus
  } | null
}
