import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'

export type BalanceCurrency = 'ARS' | 'USD'

export type BalanceSection =
  | 'INCOME'
  | 'COST_OF_SALES'
  | 'EXPENSE'
  | 'VEHICLE_EXPENSE'
  | 'COMMISSION'
  | 'PURCHASE'

export type BalanceEntry = {
  section: BalanceSection
  line: string
  // Sucursal, o 'GENERAL' si el registro no tiene.
  branch: string
  // Responsable de la caja; 'OTHER' caja sin responsable; 'NONE' sin caja.
  partner: string | null
  amount: number
  paid: boolean
}

export type BalanceData = {
  period: string
  from: string
  to: string
  current: boolean
  currency: BalanceCurrency
  branches: Array<{ key: string; name: string }>
  partners: Array<{ key: string; name: string }>
  entries: BalanceEntry[]
  sales: {
    units: number
    unitsWithoutCost: number
    pending: Array<{ branch: string; amount: number; operations: number }>
  }
}

export function getBalance(period: string, currency: BalanceCurrency, signal?: AbortSignal) {
  const query = new URLSearchParams({ period, currency })
  return apiRequest<BalanceData>(`/balance?${query.toString()}`, {
    token: sessionStorage.getItem(AUTH_TOKEN_KEY),
    ...(signal ? { signal } : {}),
  })
}
