// Manuales de uso por perfil. Cada manual es un HTML autónomo que se carga
// recién cuando el usuario abre la pantalla (queda fuera del bundle inicial
// y sólo se sirve con sesión iniciada). La clave es el código del rol.
const manualLoaders: Record<string, () => Promise<string>> = {
  ADMINISTRATIVA: () =>
    import('./content/administrativa.html?raw').then((module) => module.default),
  VENDEDOR: () =>
    import('./content/vendedor.html?raw').then((module) => module.default),
}

export function hasManual(roleCode: string | undefined) {
  return Boolean(roleCode && manualLoaders[roleCode])
}

export function loadManual(roleCode: string) {
  const loader = manualLoaders[roleCode]
  return loader ? loader() : Promise.resolve(null)
}
