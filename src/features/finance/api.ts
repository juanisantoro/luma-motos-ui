import { AUTH_TOKEN_KEY, apiRequest } from '../../shared/api/client'
import { sortCashAccounts } from './cashAccounts'
import type {
  CashAccount,
  CashAccountInput,
  CashAccountListQuery,
  CashOperationQuery,
  CashTransfer,
  CashTransferInput,
  PartnerWithdrawal,
  PartnerWithdrawalInput,
  PartnerWithdrawalPage,
  Expense,
  FinancialCreateInput,
  FinancialKind,
  FinancialListQuery,
  FinancialVehicleType,
  FinancialRecord,
  Income,
  PageResponse,
  ReverseInput,
  SettlementInput,
  BranchOption,
  IncomeTypeOption,
  SupplierOption,
  SupplierPurchase,
  UnitOption,
  VersionOption,
  SalesOperationOption,
} from './types'

const paths: Record<FinancialKind, `/${string}`> = {
  purchase: '/supplier-purchases',
  income: '/incomes',
  expense: '/expenses',
} as const

function authToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

function addQueryValue(
  search: URLSearchParams,
  key: string,
  value: string | number | boolean | undefined,
) {
  if (value !== undefined && value !== '') search.set(key, String(value))
}

export function listFinancialRecords<K extends FinancialKind>(
  kind: K,
  query: FinancialListQuery,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => addQueryValue(search, key, value))
  const suffix = search.size ? `?${search.toString()}` : ''
  const path = `${paths[kind]}${suffix}` as `/${string}`
  return apiRequest<PageResponse<RecordFor<K>>>(path, {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function getFinancialRecord<K extends FinancialKind>(
  kind: K,
  id: string,
) {
  return apiRequest<RecordFor<K>>(`${paths[kind]}/${id}` as `/${string}`, {
    token: authToken(),
  })
}

export function createFinancialRecord<K extends FinancialKind>(
  kind: K,
  input: FinancialCreateInput,
) {
  return apiRequest<RecordFor<K>>(paths[kind], {
    method: 'POST',
    token: authToken(),
    body: input,
  })
}

export function addSettlement(
  kind: FinancialKind,
  id: string,
  input: SettlementInput,
  recovery = false,
) {
  const action =
    kind === 'income'
      ? 'collections'
      : kind === 'expense' && recovery
        ? 'recoveries'
        : 'payments'
  return apiRequest<FinancialRecord>(`${paths[kind]}/${id}/${action}`, {
    method: 'POST',
    token: authToken(),
    body: input,
  })
}

export function reverseMovement(
  kind: FinancialKind,
  recordId: string,
  movementId: string,
  input: ReverseInput,
) {
  return apiRequest<FinancialRecord>(
    `${paths[kind]}/${recordId}/movements/${movementId}/reverse`,
    {
      method: 'POST',
      token: authToken(),
      body: input,
    },
  )
}

export function listCashAccounts(
  query: CashAccountListQuery = {},
  signal?: AbortSignal,
) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => addQueryValue(search, key, value))
  const suffix = search.size ? `?${search.toString()}` : ''
  return apiRequest<PageResponse<CashAccount>>(`/cash/accounts${suffix}`, {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function createCashAccount(input: CashAccountInput) {
  return apiRequest<CashAccount>('/cash/accounts', {
    method: 'POST',
    token: authToken(),
    body: Object.fromEntries(
      Object.entries(input).filter(([, value]) => value != null),
    ),
  })
}

export function updateCashAccount(id: string, input: Partial<CashAccountInput>) {
  return apiRequest<CashAccount>(`/cash/accounts/${id}`, {
    method: 'PATCH',
    token: authToken(),
    body: input,
  })
}

export function listSuppliers(signal?: AbortSignal) {
  return apiRequest<PageResponse<SupplierOption>>(
    '/suppliers?active=true&page=1&limit=100',
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

async function collectAllPages<T>(
  first: PageResponse<T>,
  loadPage: (page: number) => Promise<PageResponse<T>>,
) {
  const pages = Math.ceil(first.total / first.limit)
  if (pages <= 1) return first.items
  const remaining = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) => loadPage(index + 2)),
  )
  return [first, ...remaining].flatMap((response) => response.items)
}

export async function listAllCashAccounts(
  signal?: AbortSignal,
  includeInactive = false,
) {
  const filter = includeInactive ? {} : { active: true }
  const first = await listCashAccounts({ ...filter, page: 1, limit: 100 }, signal)
  const items = await collectAllPages(first, (page) =>
    listCashAccounts({ ...filter, page, limit: 100 }, signal),
  )
  return sortCashAccounts(items)
}

export async function listAllSuppliers(signal?: AbortSignal) {
  const first = await listSuppliers(signal)
  return collectAllPages(first, (page) =>
    apiRequest<PageResponse<SupplierOption>>(
      `/suppliers?active=true&page=${page}&limit=100`,
      {
        token: authToken(),
        ...(signal ? { signal } : {}),
      },
    ),
  )
}

export function listInventoryBranches(signal?: AbortSignal) {
  return apiRequest<BranchOption[]>('/inventory/branches', {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function listIncomeTypes(signal?: AbortSignal) {
  return apiRequest<IncomeTypeOption[]>('/incomes/types', {
    token: authToken(),
    ...(signal ? { signal } : {}),
  })
}

export function listCatalogVersions(
  vehicleType?: FinancialVehicleType,
  signal?: AbortSignal,
) {
  const typeQuery = vehicleType ? `&vehicleType=${vehicleType}` : ''
  return apiRequest<PageResponse<VersionOption>>(
    `/catalog/versions?page=1&limit=100&active=true${typeQuery}`,
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

export async function listAllCatalogVersions(
  vehicleType?: FinancialVehicleType,
  signal?: AbortSignal,
) {
  const typeQuery = vehicleType ? `&vehicleType=${vehicleType}` : ''
  const first = await listCatalogVersions(vehicleType, signal)
  return collectAllPages(first, (page) =>
    apiRequest<PageResponse<VersionOption>>(
      `/catalog/versions?page=${page}&limit=100&active=true${typeQuery}`,
      {
        token: authToken(),
        ...(signal ? { signal } : {}),
      },
    ),
  )
}

export function listInventoryUnits(
  vehicleType?: FinancialVehicleType,
  signal?: AbortSignal,
  search?: string,
) {
  const typeQuery = vehicleType ? `&vehicleType=${vehicleType}` : ''
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : ''
  return apiRequest<PageResponse<UnitOption>>(
    `/inventory/units?page=1&limit=100${typeQuery}${searchQuery}`,
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

export async function listAllInventoryUnits(
  vehicleType?: FinancialVehicleType,
  signal?: AbortSignal,
  search?: string,
) {
  const typeQuery = vehicleType ? `&vehicleType=${vehicleType}` : ''
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : ''
  const first = await listInventoryUnits(vehicleType, signal, search)
  return collectAllPages(first, (page) =>
    apiRequest<PageResponse<UnitOption>>(
      `/inventory/units?page=${page}&limit=100${typeQuery}${searchQuery}`,
      {
        token: authToken(),
        ...(signal ? { signal } : {}),
      },
    ),
  )
}

export function listSalesOperations(
  vehicleType?: FinancialVehicleType,
  signal?: AbortSignal,
  search?: string,
) {
  const typeQuery = vehicleType ? `&vehicleType=${vehicleType}` : ''
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : ''
  return apiRequest<PageResponse<SalesOperationOption>>(
    `/sales/operations?page=1&limit=100${typeQuery}${searchQuery}`,
    {
      token: authToken(),
      ...(signal ? { signal } : {}),
    },
  )
}

export async function listAllSalesOperations(
  vehicleType?: FinancialVehicleType,
  signal?: AbortSignal,
  search?: string,
) {
  const typeQuery = vehicleType ? `&vehicleType=${vehicleType}` : ''
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : ''
  const first = await listSalesOperations(vehicleType, signal, search)
  return collectAllPages(first, (page) =>
    apiRequest<PageResponse<SalesOperationOption>>(
      `/sales/operations?page=${page}&limit=100${typeQuery}${searchQuery}`,
      {
        token: authToken(),
        ...(signal ? { signal } : {}),
      },
    ),
  )
}

type RecordFor<K extends FinancialKind> = K extends 'purchase'
  ? SupplierPurchase
  : K extends 'income'
    ? Income
    : Expense

function queryPath(base: string, query: object) {
  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) =>
    addQueryValue(search, key, value as string | number | undefined),
  )
  return `${base}${search.size ? `?${search.toString()}` : ''}` as `/${string}`
}

export function listCashTransfers(
  query: CashOperationQuery,
  signal?: AbortSignal,
) {
  // La API de transferencias no filtra por sucursal: sólo por cuenta y fecha.
  const { branchId: _branchId, from, to, ...rest } = query
  return apiRequest<PageResponse<CashTransfer>>(
    queryPath('/cash/transfers', {
      ...rest,
      ...(from ? { from: `${from}T00:00:00.000-03:00` } : {}),
      ...(to ? { to: `${to}T23:59:59.999-03:00` } : {}),
    }),
    { token: authToken(), ...(signal ? { signal } : {}) },
  )
}

export function createCashTransfer(input: CashTransferInput) {
  return apiRequest<CashTransfer>('/cash/transfers', {
    method: 'POST',
    token: authToken(),
    body: input,
  })
}

export function reverseCashTransfer(id: string, input: ReverseInput) {
  return apiRequest<CashTransfer>(`/cash/transfers/${id}/reverse`, {
    method: 'POST',
    token: authToken(),
    body: input,
  })
}

export function listPartnerWithdrawals(
  query: CashOperationQuery,
  signal?: AbortSignal,
) {
  return apiRequest<PartnerWithdrawalPage>(
    queryPath('/cash/withdrawals', query),
    { token: authToken(), ...(signal ? { signal } : {}) },
  )
}

export function createPartnerWithdrawal(input: PartnerWithdrawalInput) {
  return apiRequest<PartnerWithdrawal>('/cash/withdrawals', {
    method: 'POST',
    token: authToken(),
    body: input,
  })
}

export function reversePartnerWithdrawal(id: string, input: ReverseInput) {
  return apiRequest<PartnerWithdrawal>(`/cash/withdrawals/${id}/reverse`, {
    method: 'POST',
    token: authToken(),
    body: input,
  })
}
