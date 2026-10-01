// Versión de catálogo para mostrar. Los modelos cargados sin versión usan la
// versión marcador "SIN ESPECIFICAR" (o una versión con el mismo nombre que
// el modelo): no aportan nada en pantalla, así que se ocultan.
const PLACEHOLDER_VERSION = 'sin especificar'

function normalized(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-AR')
}

export function displayVersion(
  version: string | null | undefined,
  model?: string | null,
): string | null {
  const value = version?.trim()
  if (!value) return null
  const key = normalized(value)
  if (key === PLACEHOLDER_VERSION) return null
  if (model && key === normalized(model)) return null
  return value
}
