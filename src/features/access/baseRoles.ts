import type { BaseRoleCode } from './types'

// Roles del sistema que puede tomar como base un rol propio ("Funciona como").
export const BASE_ROLE_OPTIONS: Array<{ value: BaseRoleCode; label: string }> = [
  { value: 'VENDEDOR', label: 'Vendedor' },
  { value: 'CALLCENTER', label: 'Call center' },
  { value: 'ADMINISTRATIVA', label: 'Administrativa' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'MECANICO', label: 'Mecánico' },
]

export function baseRoleLabel(code: BaseRoleCode | null | undefined) {
  return BASE_ROLE_OPTIONS.find((option) => option.value === code)?.label ?? null
}
