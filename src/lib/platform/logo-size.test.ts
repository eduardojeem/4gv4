import { describe, expect, it } from 'vitest'

import { normalizePlatformBranding } from './branding'
import {
  clampLogoHeightPx,
  LOGO_HEIGHT_PRESETS,
  MAX_LOGO_HEIGHT_PX,
  MIN_LOGO_HEIGHT_PX,
  resolveLogoSize,
} from './logo-size'

describe('resolveLogoSize', () => {
  it('usa el preset cuando no hay tamaño personalizado', () => {
    const size = resolveLogoSize({ logoHeight: 'lg', logoHeightPx: 0 })

    expect(size.className).toContain(LOGO_HEIGHT_PRESETS.lg.className)
    // Sin estilo inline: el preset ya viene resuelto en clases de Tailwind.
    expect(size.style).toBeUndefined()
  })

  it('cae en el preset estándar si el valor guardado es desconocido', () => {
    const size = resolveLogoSize({ logoHeight: undefined, logoHeightPx: 0 })

    expect(size.className).toContain(LOGO_HEIGHT_PRESETS.md.className)
  })

  it('el tamaño personalizado gana sobre el preset', () => {
    const size = resolveLogoSize({ logoHeight: 'sm', logoHeightPx: 53 })

    // Va por style y no por clase: `h-[53px]` armado en runtime no existiria en
    // el CSS compilado, asi que el logo quedaria sin alto.
    expect(size.style?.height).toBe('53px')
    expect(size.className).not.toContain('h-8')
  })

  it('acota un tamaño fuera de rango en vez de romper la barra', () => {
    expect(resolveLogoSize({ logoHeight: 'md', logoHeightPx: 5000 }).style?.height)
      .toBe(`${MAX_LOGO_HEIGHT_PX}px`)
    expect(clampLogoHeightPx(1)).toBe(MIN_LOGO_HEIGHT_PX)
  })
})

describe('normalizePlatformBranding — logoHeightPx', () => {
  it('trata 0, vacio y basura como "sin tamaño personalizado"', () => {
    for (const value of [0, -10, 'abc', null, undefined]) {
      expect(normalizePlatformBranding({ logoHeightPx: value }).logoHeightPx).toBe(0)
    }
  })

  it('acota un valor manipulado desde el cliente', () => {
    expect(normalizePlatformBranding({ logoHeightPx: 9999 }).logoHeightPx).toBe(MAX_LOGO_HEIGHT_PX)
    expect(normalizePlatformBranding({ logoHeightPx: 2 }).logoHeightPx).toBe(MIN_LOGO_HEIGHT_PX)
  })

  it('conserva un valor valido', () => {
    expect(normalizePlatformBranding({ logoHeightPx: 40 }).logoHeightPx).toBe(40)
  })
})
