import type { ApiError } from '../../shared/api/client'

// El servidor explica los rechazos en inglés (y a veces con un código). Acá
// se traducen para que el cartel diga, en castellano, qué dato falló.

const CODE_TEXT: Record<string, string> = {
  DELIVERY_DATE_REQUIRED: 'Falta el día de la entrega programada.',
  GUARANTOR_REQUIRED: 'Falta indicar si la venta tiene garante.',
  GUARANTOR_DATA_REQUIRED: 'Faltan el nombre, el apellido o el DNI del garante.',
  GUARANTOR_DOCUMENT_INVALID: 'El DNI del garante no es válido (de 6 a 11 números).',
  GUARANTOR_CLIENT_REQUIRED: 'Sin garante propio, el garante es el cliente: faltan sus datos.',
  LICENSING_AMOUNT_NOT_ALLOWED: 'El monto de patente sólo se carga cuando la paga el cliente.',
  LICENSING_MODE_REQUIRED: 'Falta definir si la patente se bonifica o la paga el cliente.',
  USED_MOTO_REQUIRES_STOCK_UNIT: 'Una moto usada se vende desde una unidad en stock.',
  DOUBLE_CREDIT_INSTITUTIONS_REQUIRED: 'Los dos créditos tienen que ser de financieras distintas.',
  CORRECTION_SECOND_CREDIT_REQUIRED: 'Falta el monto del segundo crédito.',
  CORRECTION_PLAN_MISMATCH: 'El precio, el crédito y la moto tomada no cierran con esa forma de pago.',
  CORRECTION_FINANCIAL_INSTITUTION_REQUIRED: 'Falta la financiera del crédito.',
  INVALID_OPERATION_SELLER: 'El vendedor elegido no es válido.',
  INVALID_OPERATION_CONTACT: 'El contacto elegido no es válido.',
  INVENTORY_UNIT_ALREADY_RESERVED: 'La unidad elegida ya está reservada para otra venta.',
  INVENTORY_UNIT_NOT_AVAILABLE: 'La unidad elegida ya no está disponible.',
  SUPPLIER_AVAILABILITY_ALREADY_RESERVED: 'La disponibilidad del proveedor ya fue tomada por otra venta.',
  INVALID_AMOUNT: 'El importe tiene que ser mayor a cero.',
  INVALID_LICENSE_PLATE: 'La patente tiene que tener entre 5 y 10 letras o números.',
  OPERATION_UNIT_REQUIRED: 'La operación todavía no tiene una unidad asignada.',
  OPERATION_CANCELLED: 'La operación está cancelada.',
}

const MESSAGE_TEXT: Record<string, string> = {
  'Payment platform is required': 'Falta la forma de pago.',
  'Credit amount must be positive for the selected payment platform':
    'Falta el monto del crédito para esa forma de pago.',
  'Credit amount cannot exceed the agreed price':
    'El crédito no puede ser mayor que el precio de cierre.',
  'Credit amount is not allowed for the selected payment platform':
    'Esa forma de pago no lleva crédito.',
  'Financial institution is required for financing components': 'Falta la financiera del crédito.',
  'Financial institution is invalid or inactive': 'La financiera elegida no está activa.',
  'Payment components do not match the selected payment platform':
    'Los importes no cierran con la forma de pago elegida.',
  'Financing components must equal the operation credit amount':
    'Los créditos no suman el monto financiado.',
  'Payment plan total must equal the agreed price':
    'Los importes del plan de pago no suman el precio de cierre.',
  'Trade-in vehicle is required for trade-in components': 'Falta la moto tomada en parte de pago.',
  'Branch is invalid or inactive': 'La sucursal elegida no está activa.',
  'Client is invalid': 'El cliente no es válido.',
  'Client document must contain letters or digits': 'El documento del cliente no es válido.',
  'Version is not available to the organization': 'El modelo elegido no está disponible.',
  'Exactly one of unitId or supplierAvailabilityId is required':
    'Elegí una unidad en stock o una disponibilidad de proveedor.',
  'unitId and supplierAvailabilityId cannot be combined':
    'Elegí una unidad en stock o una de proveedor, no las dos.',
  'Provider availability is invalid, expired, or unavailable':
    'La disponibilidad del proveedor venció o ya no está.',
  'Supplier is invalid or inactive': 'El proveedor no está activo.',
  'Inventory unit version and condition must match the operation':
    'La unidad no coincide con el modelo o la condición de la venta.',
  'Inventory unit must belong to the operation branch':
    'La unidad es de otra sucursal.',
  'New operations must start with delivery status NO_PROGRAMADA or PROGRAMADA':
    'Una venta nueva arranca con la entrega sin programar o programada.',
  'A referenced record is invalid': 'Uno de los datos elegidos ya no existe o no es válido.',
  'Invalid business date': 'La fecha no es válida.',
  'Operation cannot be edited in its current state':
    'La operación no se puede editar en su estado actual.',
  'Only draft operations can be submitted': 'Sólo se pueden enviar operaciones en borrador.',
}

// Nombres de los campos del formulario, para los rechazos de validación del
// servidor ("agreedPrice must be a number ...").
const FIELD_LABELS: Record<string, string> = {
  agreedPrice: 'Precio de cierre',
  creditAmount: 'Monto del crédito',
  secondCreditAmount: 'Monto del segundo crédito',
  financialInstitutionId: 'Financiera',
  paymentPlatform: 'Forma de pago',
  licensingMode: 'Patentamiento',
  licensingAmount: 'Monto de patente',
  ticketNumber: 'Número de boleto',
  notes: 'Observaciones',
  operationDate: 'Fecha de operación',
  deliveryScheduledDate: 'Día de entrega',
  sellerId: 'Quién hizo la venta',
  contactId: 'Quién fue el contacto',
  branchId: 'Sucursal',
  versionId: 'Modelo',
  color: 'Color',
  guarantorFirstName: 'Nombre del garante',
  guarantorLastName: 'Apellido del garante',
  guarantorDocument: 'DNI del garante',
  hasGuarantor: 'Tiene garante',
  'client.fullName': 'Nombre del cliente',
  'client.documentNumber': 'Documento del cliente',
  'client.phone': 'Teléfono del cliente',
}

function fieldLabel(path: string) {
  return FIELD_LABELS[path] ?? FIELD_LABELS[path.split('.').at(-1) ?? ''] ?? path
}

function translateOne(message: string) {
  const known = MESSAGE_TEXT[message]
  if (known) return known
  const unknownField = /^property (\S+) should not exist$/.exec(message)
  if (unknownField)
    return `El servidor no acepta el dato "${fieldLabel(unknownField[1]!)}".`
  const invalidField = /^(\S+) (must|should) /.exec(message)
  if (invalidField) return `"${fieldLabel(invalidField[1]!)}" tiene un valor no válido.`
  return null
}

/** Motivo del rechazo en castellano, o null si no se reconoce. */
export function apiErrorReason(error: ApiError): string | null {
  const code = error.details?.code
  if (code && CODE_TEXT[code]) return CODE_TEXT[code]
  const raw = error.details?.message
  const messages = Array.isArray(raw) ? raw : [raw ?? error.message]
  const translated = messages
    .filter((message): message is string => typeof message === 'string')
    .map(translateOne)
    .filter((text): text is string => text !== null)
  return translated.length ? [...new Set(translated)].join(' ') : null
}
