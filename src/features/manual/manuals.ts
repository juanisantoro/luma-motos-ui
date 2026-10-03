// Manuales de uso por perfil. Cada manual es un HTML autónomo que se carga
// recién cuando el usuario abre la pantalla (queda fuera del bundle inicial
// y sólo se sirve con sesión iniciada). La clave es el código del rol.
const manualLoaders: Record<string, () => Promise<string>> = {
  ADMINISTRADOR: () =>
    import('./content/administrador.html?raw').then((module) => module.default),
  GERENTE: () =>
    import('./content/gerente.html?raw').then((module) => module.default),
  ADMINISTRATIVA: () =>
    import('./content/administrativa.html?raw').then((module) => module.default),
  VENDEDOR: () =>
    import('./content/vendedor.html?raw').then((module) => module.default),
  CALLCENTER: () =>
    import('./content/callcenter.html?raw').then((module) => module.default),
}

const manualLabels: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  GERENTE: 'Gerente',
  ADMINISTRATIVA: 'Administrativa',
  VENDEDOR: 'Vendedor',
  CALLCENTER: 'Call Center',
}

// Perfiles que ven todo el sistema: además de su manual pueden leer los de
// todos los demás (mismo criterio que usa Lumi en la API).
const ALL_MANUALS_ROLES = new Set(['ADMINISTRADOR'])

export type ManualEntry = { code: string; label: string }

export function hasManual(roleCode: string | undefined) {
  return Boolean(roleCode && manualLoaders[roleCode])
}

/** Manuales que puede leer un perfil: el propio primero. */
export function manualsForRole(roleCode: string | undefined): ManualEntry[] {
  if (!roleCode || !manualLoaders[roleCode]) return []
  const codes = ALL_MANUALS_ROLES.has(roleCode)
    ? [roleCode, ...Object.keys(manualLoaders).filter((code) => code !== roleCode)]
    : [roleCode]
  return codes.map((code) => ({ code, label: manualLabels[code] ?? code }))
}

export function loadManual(roleCode: string) {
  const loader = manualLoaders[roleCode]
  return loader ? loader() : Promise.resolve(null)
}
