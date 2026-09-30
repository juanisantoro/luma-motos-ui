import { ApiError, AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import type {
  SalesFulfillment,
  SalesLicensing,
  SalesOperationStatus,
} from './types'
import type { VehicleKind } from '../stock/types'

// Fase 4: grilla de seguimiento de operaciones, cobro de componentes del plan
// de pago y rendición de efectivo. La API vive aparte de ./api para que los
// mocks existentes de ese módulo no tengan que conocer estas funciones.

export type PaymentMethod =
  | 'EFECTIVO'
  | 'TRANSFERENCIA_BANCARIA'
  | 'TARJETA'
  | 'DESEMBOLSO_FINANCIERA'
  | 'PAGARE'
  | 'OTRO'

export type HandoverStatus = 'PENDIENTE_RENDICION' | 'RENDIDO'

export type PaymentComponentType =
  | 'EFECTIVO'
  | 'TRANSFERENCIA_BANCARIA'
  | 'TARJETA'
  | 'FINANCIACION'
  | 'TOMA_PARTE_PAGO'
  | 'OTRO'

type PersonRef = { id: string; fullName: string }

export type IncomeHandover = {
  status: HandoverStatus
  recipient: PersonRef | null
  confirmedAt: string | null
  confirmedBy: PersonRef | null
}

export type TrackingIncome = {
  id: string
  incomeDate: string
  type: string
  isLicensing: boolean
  isOwnCreditInstallment: boolean
  paymentComponentId: string | null
  paymentMethod: PaymentMethod | null
  totalAmount: string
  collectedAmount: string
  paymentStatus: 'PENDIENTE' | 'PARCIAL' | 'PAGADO'
  reference: string | null
  account: { id: string; code: string; name: string; type: string } | null
  collectedBy: PersonRef | null
  handover: IncomeHandover | null
  rowVersion: number
}

export type FinancingPayment = {
  informedAt: string
  informedBy: PersonRef | null
  notes: string | null
}

export type TrackingPaymentComponent = {
  id: string
  type: PaymentComponentType
  expectedAmount: string
  collectedAmount: string
  /** Cash that can still be collected from the component. */
  collectableAmount: string
  /** What the operation balance still expects from it. */
  balanceAmount: string
  paymentStatus: string
  financialInstitution: { id: string; legalName: string } | null
  ownCredit: boolean
  financingPayment: FinancingPayment | null
  collectible: boolean
}

export type OwnCreditSummary = {
  status: string
  financedAmount: string
  totalAmount: string
  collectedAmount: string
  paidInstallments: number
  installments: number
  nextDueDate: string | null
}

export type OperationTrackingRow = {
  id: string
  number: string
  ticketNumber: string | null
  operationDate: string
  status: SalesOperationStatus
  rowVersion: number
  organizationId: string
  client: {
    id: string
    fullName: string
    documentType: string | null
    documentNumber: string | null
  }
  seller: PersonRef | null
  branch: { id: string; code: string; name: string }
  vehicle: { versionName: string; condition: string; chassis: string | null }
  currency: string
  agreedPrice: string
  collectedAmount: string
  balanceAmount: string
  pendingHandoverAmount: string
  pendingHandoverCount: number
  waivedAmount: string
  ownCredit: OwnCreditSummary | null
  fulfillment: SalesFulfillment
  licensing: SalesLicensing
  paymentComponents: TrackingPaymentComponent[]
  incomes: TrackingIncome[]
}

export type OperationTrackingPage = {
  items: OperationTrackingRow[]
  total: number
  page: number
  limit: number
}

export type OperationTrackingQuery = {
  vehicleType: VehicleKind
  page: number
  limit: number
  branchId?: string
  status?: SalesOperationStatus
  search?: string
  from?: string
  to?: string
  withBalance?: boolean
  withPendingCash?: boolean
  withFinancingPending?: boolean
}

export type HandoverRecipient = {
  id: string
  fullName: string
  isCurrentUser: boolean
  pendingCount: number
  pendingAmount: string
}

export type CollectPaymentComponentInput = {
  idempotencyKey: string
  accountId: string
  amount: string
  collectionDate?: string
  paymentMethod?: PaymentMethod
  handoverToId?: string
  reference?: string
  notes?: string
}

function request<T>(
  path: `/${string}`,
  options: Parameters<typeof apiRequest<T>>[1] = {},
) {
  return apiRequest<T>(path, {
    ...options,
    token: sessionStorage.getItem(AUTH_TOKEN_KEY),
  })
}

export function trackingSearch(query: OperationTrackingQuery) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return search.toString()
}

export function listOperationTracking(
  query: OperationTrackingQuery,
  signal?: AbortSignal,
) {
  return request<OperationTrackingPage>(
    `/sales/operations/tracking?${trackingSearch(query)}`,
    signal ? { signal } : {},
  )
}

export function collectPaymentComponent(
  operationId: string,
  componentId: string,
  input: CollectPaymentComponentInput,
) {
  return request<unknown>(
    `/sales/operations/${operationId}/payment-components/${componentId}/collections`,
    { method: 'POST', body: input },
  )
}

export function markFinancingPayment(
  operationId: string,
  componentId: string,
  notes?: string,
) {
  return request<unknown>(
    `/sales/operations/${operationId}/payment-components/${componentId}/financing-payment`,
    { method: 'POST', body: notes ? { notes } : {} },
  )
}

export function revertFinancingPayment(
  operationId: string,
  componentId: string,
  reason: string,
) {
  return request<unknown>(
    `/sales/operations/${operationId}/payment-components/${componentId}/financing-payment/revert`,
    { method: 'POST', body: { reason } },
  )
}

export function listHandoverRecipients(signal?: AbortSignal) {
  return request<HandoverRecipient[]>(
    '/incomes/cash-handover/recipients',
    signal ? { signal } : {},
  )
}

export function confirmCashHandover(incomeId: string, expectedVersion: number) {
  return request<unknown>(`/incomes/${incomeId}/cash-handover/confirm`, {
    method: 'POST',
    body: { expectedVersion },
  })
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA_BANCARIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  DESEMBOLSO_FINANCIERA: 'Desembolso financiera',
  PAGARE: 'Pagaré',
  OTRO: 'Otro',
}

export const componentTypeLabels: Record<PaymentComponentType, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA_BANCARIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  FINANCIACION: 'Financiación',
  TOMA_PARTE_PAGO: 'Toma en parte de pago',
  OTRO: 'Otro',
}

// Mismo mapeo que el backend (src/incomes/cash-handover.ts).
export function defaultPaymentMethod(
  type: PaymentComponentType,
): PaymentMethod | null {
  switch (type) {
    case 'EFECTIVO':
      return 'EFECTIVO'
    case 'TRANSFERENCIA_BANCARIA':
      return 'TRANSFERENCIA_BANCARIA'
    case 'TARJETA':
      return 'TARJETA'
    case 'FINANCIACION':
      return 'DESEMBOLSO_FINANCIERA'
    case 'OTRO':
      return 'OTRO'
    default:
      return null
  }
}

export const handoverStatusLabels: Record<HandoverStatus, string> = {
  PENDIENTE_RENDICION: 'Pendiente de rendición',
  RENDIDO: 'Rendido',
}

export function handoverStatusClass(status: HandoverStatus) {
  return status === 'RENDIDO' ? 'status-badge--success' : 'status-badge--warning'
}

/** Only the recipient confirms, and only cash that was actually collected. */
export function canConfirmHandover(
  income: TrackingIncome,
  currentPersonnelId: string | null,
) {
  return (
    income.handover?.status === 'PENDIENTE_RENDICION' &&
    currentPersonnelId !== null &&
    income.handover.recipient?.id === currentPersonnelId &&
    Number(income.collectedAmount) > 0
  )
}

/** Components that can still receive money from the grid. */
export function collectibleComponents(row: OperationTrackingRow) {
  return row.paymentComponents.filter(
    (component) =>
      component.collectible && Number(component.collectableAmount) > 0,
  )
}

/** External financing: the financiera deposits and is marked as paid. */
export function isExternalFinancing(component: TrackingPaymentComponent) {
  return (
    component.type === 'FINANCIACION' &&
    !component.ownCredit &&
    component.paymentStatus !== 'CANCELADA'
  )
}

export function componentLabel(component: TrackingPaymentComponent) {
  if (component.ownCredit) return 'Crédito propio'
  if (component.type === 'FINANCIACION' && component.financialInstitution)
    return `Financiación · ${component.financialInstitution.legalName}`
  return componentTypeLabels[component.type]
}

/**
 * Domain errors shared by every cash collection (components, installments):
 * returns null when the error is not one of them.
 */
export function cashCollectionErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  switch (error.details?.code) {
    case 'HANDOVER_RECIPIENT_REQUIRED':
      return 'Indicá a quién se rinde el efectivo.'
    case 'INVALID_HANDOVER_RECIPIENT':
      return 'La persona elegida no puede recibir rendiciones de efectivo.'
    case 'HANDOVER_ONLY_FOR_CASH':
      return 'Sólo el efectivo se rinde. Quitá el destinatario o elegí efectivo.'
    case 'CURRENCY_MISMATCH':
      return 'La cuenta elegida tiene otra moneda que la operación.'
    case 'IDEMPOTENCY_CONFLICT':
      return 'Ese cobro ya se envió con otros datos. Cerrá y volvé a abrir el cobro.'
    case 'OWN_CREDIT_COLLECTED_BY_INSTALLMENTS':
      return 'El crédito propio se cobra desde la cobranza de cuotas.'
    case 'FINANCING_ALREADY_MARKED':
      return 'La financiera ya figura como pagada.'
    case 'FINANCING_NOT_MARKED':
      return 'La financiera no figuraba como pagada.'
    default:
      return null
  }
}
