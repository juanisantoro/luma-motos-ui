export type DocumentType = 'DNI' | 'CUIT' | 'CI' | 'PASAPORTE' | 'OTRO'

export type ClientOrganization = {
  id: string
  code: string
  name: string
  type: 'CASA_CENTRAL' | 'FRANQUICIA'
}

export type Client = {
  id: string
  documentType: DocumentType | null
  documentNumber: string | null
  fullName: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  organization: ClientOrganization
}

export type ClientListResponse = {
  items: Client[]
  total: number
  page: number
  limit: number
}

export type ClientListQuery = {
  page?: number
  limit?: number
  search?: string
  active?: boolean
  organizationId?: string
}

export type CreateClientInput = {
  fullName: string
  documentType?: DocumentType
  documentNumber?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  organizationId?: string
}

export type UpdateClientInput = {
  fullName?: string
  documentType?: DocumentType | null
  documentNumber?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}
