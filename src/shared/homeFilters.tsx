import { Filter, X } from 'lucide-react'
import { useInRouterContext, useSearchParams } from 'react-router-dom'

// Filtros que llegan desde una tarjeta del inicio ("Ver"). La pantalla de
// destino los aplica al abrir y muestra de dónde vino, para que el usuario
// sepa qué está mirando y pueda quitarlos.
//
// Parámetros comunes:
// - origen: texto de la tarjeta (p. ej. "Gastos pendientes de pago · San Miguel").
// - sucursal: id de la sucursal (la del tab abierto, o la única del usuario).
// Cada pantalla define además los suyos (estado, pendientes, etc.).

export const HOME_ORIGIN_PARAM = 'origen'
export const HOME_BRANCH_PARAM = 'sucursal'

export function homeLink(
  path: string,
  params: Record<string, string | undefined>,
) {
  const [base, existing] = path.split('?')
  const search = new URLSearchParams(existing)
  for (const [key, value] of Object.entries(params))
    if (value) search.set(key, value)
  const text = search.toString()
  return text ? `${base}?${text}` : (base ?? path)
}

// Lee los filtros del inicio y permite quitarlos de la URL. Fuera de un
// router (algunos tests montan la pantalla sola) no hay filtros.
export function useHomeFilters(names: string[]) {
  const inRouter = useInRouterContext()
  // El contexto del router no cambia durante la vida del componente.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [searchParams, setSearchParams] = inRouter ? useSearchParams() : [null, null]
  const origin = searchParams?.get(HOME_ORIGIN_PARAM) ?? null
  const values: Record<string, string | undefined> = {}
  for (const name of [HOME_BRANCH_PARAM, ...names])
    values[name] = searchParams?.get(name) ?? undefined
  const clear = () =>
    setSearchParams?.(
      (current) => {
        const next = new URLSearchParams(current)
        for (const name of [HOME_ORIGIN_PARAM, HOME_BRANCH_PARAM, ...names])
          next.delete(name)
        return next
      },
      { replace: true },
    )
  return {
    origin,
    branchId: values[HOME_BRANCH_PARAM],
    values,
    clear,
  }
}

export function HomeFilterNotice({
  origin,
  onClear,
}: {
  origin: string | null
  onClear: () => void
}) {
  if (!origin) return null
  return (
    <div className="home-filter-notice" role="status">
      <Filter size={15} aria-hidden="true" />
      <span>
        Viniste desde el inicio: <strong>{origin}</strong>
      </span>
      <button className="home-filter-notice__clear" onClick={onClear} type="button">
        <X size={14} aria-hidden="true" /> Quitar filtro
      </button>
    </div>
  )
}
