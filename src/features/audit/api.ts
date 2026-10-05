import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import { dayEnd, dayStart } from './format'
import type {
  AuditEvent,
  AuditFilters,
  AuditLogQuery,
  AuditPage,
  MoneyPage,
  MoneyQuery,
  OperationTrace,
} from './types'

function token() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

function request<T>(path: string, signal?: AbortSignal) {
  return apiRequest<T>(path as `/${string}`, {
    token: token(),
    ...(signal ? { signal } : {}),
  })
}

function queryString(values: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== '') search.set(key, String(value))
  return search.size ? `?${search.toString()}` : ''
}

function operationNumber(value: string | undefined) {
  // Hasta 15 dígitos: entra en un entero seguro y en el bigint de la base.
  const number = Number((value?.replace(/\D/g, '') ?? '').slice(0, 15))
  return number > 0 ? number : undefined
}

export function getAuditFilters(signal?: AbortSignal) {
  return request<AuditFilters>('/audit-logs/filters', signal)
}

export function listAuditEvents(query: AuditLogQuery, signal?: AbortSignal) {
  return request<AuditPage<AuditEvent>>(
    `/audit-logs${queryString({
      page: query.page,
      limit: query.limit,
      from: query.from ? dayStart(query.from) : undefined,
      to: query.to ? dayEnd(query.to) : undefined,
      category: query.category,
      action: query.action,
      actorId: query.actorId,
      operationNumber: operationNumber(query.operationNumber),
    })}`,
    signal,
  )
}

export function listMoneyMovements(query: MoneyQuery, signal?: AbortSignal) {
  return request<MoneyPage>(
    `/audit-logs/money-movements${queryString({
      page: query.page,
      limit: query.limit,
      from: query.from ? dayStart(query.from) : undefined,
      to: query.to ? dayEnd(query.to) : undefined,
      accountId: query.accountId,
      branchId: query.branchId,
      direction: query.direction,
      actorId: query.actorId,
      operationNumber: operationNumber(query.operationNumber),
      search: query.search?.trim(),
      onlyReversals: query.onlyReversals ? 'true' : undefined,
    })}`,
    signal,
  )
}

export function getOperationTrace(operationId: string, signal?: AbortSignal) {
  return request<OperationTrace>(
    `/audit-logs/operations/${operationId}`,
    signal,
  )
}

const EXPORT_PAGE = 100
export const EXPORT_MAX_ROWS = 5000

/** Trae todas las páginas del filtro (hasta `EXPORT_MAX_ROWS`) para exportar. */
export async function fetchAllPages<T>(
  load: (page: number, limit: number) => Promise<AuditPage<T>>,
) {
  const items: T[] = []
  let total = 0
  for (let page = 1; items.length < EXPORT_MAX_ROWS; page += 1) {
    const result = await load(page, EXPORT_PAGE)
    total = result.total
    items.push(...result.items)
    if (result.items.length < EXPORT_PAGE || items.length >= total) break
  }
  return { items: items.slice(0, EXPORT_MAX_ROWS), total }
}
