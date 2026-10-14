import type { SalesPaymentComponentInput, SalesPaymentPlatform } from './types'

// Qué lleva cada forma de pago de la operación (igual que en el backend):
// cuántos créditos de financiera, si entrega una unidad en parte de pago y
// cómo se paga el resto (null: crédito y parte de pago completan el precio).

type PlatformRule = {
  label: string
  credit: 0 | 1 | 2
  tradeIn: boolean
  remainder: SalesPaymentComponentInput['type'] | null
}

export const PAYMENT_PLATFORM_RULES: Record<SalesPaymentPlatform, PlatformRule> = {
  EFECTIVO: { label: 'Efectivo', credit: 0, tradeIn: false, remainder: 'EFECTIVO' },
  TRANSFERENCIA: {
    label: 'Transferencia',
    credit: 0,
    tradeIn: false,
    remainder: 'TRANSFERENCIA_BANCARIA',
  },
  TARJETA: { label: 'Tarjeta de crédito', credit: 0, tradeIn: false, remainder: 'TARJETA' },
  CREDITO: { label: 'Crédito', credit: 1, tradeIn: false, remainder: null },
  CREDITO_CREDITO: { label: 'Crédito + crédito', credit: 2, tradeIn: false, remainder: null },
  EFECTIVO_CREDITO: {
    label: 'Efectivo + crédito',
    credit: 1,
    tradeIn: false,
    remainder: 'EFECTIVO',
  },
  TRANSFERENCIA_CREDITO: {
    label: 'Transferencia + crédito',
    credit: 1,
    tradeIn: false,
    remainder: 'TRANSFERENCIA_BANCARIA',
  },
  MOTO_EFECTIVO: { label: 'Moto + efectivo', credit: 0, tradeIn: true, remainder: 'EFECTIVO' },
  MOTO_CREDITO: { label: 'Moto + crédito', credit: 1, tradeIn: true, remainder: null },
  MOTO_EFECTIVO_CREDITO: {
    label: 'Moto + efectivo + crédito',
    credit: 1,
    tradeIn: true,
    remainder: 'EFECTIVO',
  },
}

/** Opciones del combo, en el orden en que se muestran. */
export const PAYMENT_PLATFORM_OPTIONS = (
  Object.keys(PAYMENT_PLATFORM_RULES) as SalesPaymentPlatform[]
).map((value) => ({ value, label: PAYMENT_PLATFORM_RULES[value].label }))

export const CREDIT_PAYMENT_PLATFORMS = PAYMENT_PLATFORM_OPTIONS.map(
  (option) => option.value,
).filter((platform) => PAYMENT_PLATFORM_RULES[platform].credit > 0)

export function platformHasCredit(platform: SalesPaymentPlatform | '' | null) {
  return Boolean(platform && PAYMENT_PLATFORM_RULES[platform].credit > 0)
}

export function platformHasTwoCredits(platform: SalesPaymentPlatform | '' | null) {
  return Boolean(platform && PAYMENT_PLATFORM_RULES[platform].credit === 2)
}

export function platformHasTradeIn(platform: SalesPaymentPlatform | '' | null) {
  return Boolean(platform && PAYMENT_PLATFORM_RULES[platform].tradeIn)
}

/** Cómo se paga el resto; null si crédito y parte de pago completan el precio. */
export function platformRemainder(platform: SalesPaymentPlatform) {
  return PAYMENT_PLATFORM_RULES[platform].remainder
}

export function paymentPlatformLabel(platform: SalesPaymentPlatform | null | undefined) {
  return platform ? PAYMENT_PLATFORM_RULES[platform].label : 'Sin definir'
}
