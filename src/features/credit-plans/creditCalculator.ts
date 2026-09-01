// Motor de cálculo de créditos personales, en TypeScript puro (sin llamada
// a red) para que la simulación sea instantánea en pantalla. Es un espejo
// exacto de src/credit-plans/credit-calculator.ts en el backend, que es
// el que persiste el cronograma real al confirmar un crédito — si tocás
// esta lógica, replicá el cambio ahí también.

export type CreditCalculationMethod = 'FRANCES' | 'INTERES_SIMPLE'

export interface CreditInstallmentPreview {
  /** 1-based. */
  number: number
  amount: number
}

export interface CreditSimulationResult {
  /** Cuota "estándar" (todas menos, eventualmente, la última). */
  installmentAmount: number
  totalInterest: number
  totalAmount: number
  installments: CreditInstallmentPreview[]
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function splitEvenly(totalAmount: number, count: number): number[] {
  const base = round2(totalAmount / count)
  const installments = new Array<number>(count).fill(base)
  const roundedTotal = round2(base * (count - 1))
  installments[count - 1] = round2(totalAmount - roundedTotal)
  return installments
}

function simulateFrench(
  financedAmount: number,
  installmentCount: number,
  interestRate: number,
): CreditSimulationResult {
  const i = interestRate / 100
  let rawInstallment: number
  if (i === 0) {
    rawInstallment = financedAmount / installmentCount
  } else {
    const factor = Math.pow(1 + i, installmentCount)
    rawInstallment = (financedAmount * (i * factor)) / (factor - 1)
  }
  const installmentAmount = round2(rawInstallment)
  const totalAmount = round2(installmentAmount * installmentCount)
  const amounts = splitEvenly(totalAmount, installmentCount)
  const totalInterest = round2(totalAmount - financedAmount)
  return {
    installmentAmount,
    totalInterest,
    totalAmount,
    installments: amounts.map((amount, index) => ({ number: index + 1, amount })),
  }
}

function simulateFlatRate(
  financedAmount: number,
  installmentCount: number,
  interestRate: number,
): CreditSimulationResult {
  const totalInterest = round2(financedAmount * (interestRate / 100))
  const totalAmount = round2(financedAmount + totalInterest)
  const amounts = splitEvenly(totalAmount, installmentCount)
  return {
    installmentAmount: amounts[0] ?? 0,
    totalInterest,
    totalAmount,
    installments: amounts.map((amount, index) => ({ number: index + 1, amount })),
  }
}

export function simulateCredit(
  financedAmount: number,
  installmentCount: number,
  interestRate: number,
  method: CreditCalculationMethod,
): CreditSimulationResult | null {
  if (!Number.isFinite(financedAmount) || financedAmount <= 0) return null
  if (!Number.isInteger(installmentCount) || installmentCount < 1) return null
  if (!Number.isFinite(interestRate) || interestRate < 0) return null
  return method === 'FRANCES'
    ? simulateFrench(financedAmount, installmentCount, interestRate)
    : simulateFlatRate(financedAmount, installmentCount, interestRate)
}

function addMonthsUtc(date: Date, months: number): Date {
  const day = date.getUTCDate()
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate()
  result.setUTCDate(Math.min(day, lastDayOfTargetMonth))
  return result
}

export interface CreditInstallmentSchedule extends CreditInstallmentPreview {
  dueDate: Date
}

export function buildInstallmentSchedule(
  simulation: CreditSimulationResult,
  firstDueDate: Date,
): CreditInstallmentSchedule[] {
  return simulation.installments.map((installment, index) => ({
    ...installment,
    dueDate: addMonthsUtc(firstDueDate, index),
  }))
}
