import { describe, expect, it } from 'vitest'
import { displayVersion } from './vehicleVersion'

describe('displayVersion', () => {
  it('oculta la versión marcador y la que repite el modelo', () => {
    expect(displayVersion('SIN ESPECIFICAR', 'WAVE 110 S')).toBeNull()
    expect(displayVersion(' sin  especificar ')).toBeNull()
    expect(displayVersion('Wave 110 S', 'WAVE 110 S')).toBeNull()
    expect(displayVersion('', 'Wave')).toBeNull()
    expect(displayVersion(null)).toBeNull()
  })

  it('muestra una versión real', () => {
    expect(displayVersion('110 S', 'Wave')).toBe('110 S')
    expect(displayVersion(' ABS ')).toBe('ABS')
  })
})
