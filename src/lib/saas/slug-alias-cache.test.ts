import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearSlugAliasCache,
  getCachedSlugAlias,
  setCachedSlugAlias,
  SLUG_ALIAS_MAX_ENTRIES,
  SLUG_ALIAS_TTL_MS,
} from './slug-alias-cache'

describe('cache de alias de slug', () => {
  beforeEach(() => clearSlugAliasCache())

  it('distingue "no consultado" de "no tiene alias"', () => {
    // undefined obliga a consultar; null evita la consulta. Si se confundieran,
    // el cache negativo no serviria y se seguiria yendo a la red siempre.
    expect(getCachedSlugAlias('tienda')).toBeUndefined()

    setCachedSlugAlias('tienda', null)
    expect(getCachedSlugAlias('tienda')).toBeNull()
  })

  it('devuelve el slug destino cuando hay alias', () => {
    setCachedSlugAlias('nombre-viejo', 'nombre-nuevo')
    expect(getCachedSlugAlias('nombre-viejo')).toBe('nombre-nuevo')
  })

  it('vuelve a consultar cuando venció el TTL', () => {
    const t0 = 1_000_000
    setCachedSlugAlias('tienda', null, t0)

    expect(getCachedSlugAlias('tienda', t0 + SLUG_ALIAS_TTL_MS - 1)).toBeNull()
    // Al vencer, un cambio real de slug se propaga.
    expect(getCachedSlugAlias('tienda', t0 + SLUG_ALIAS_TTL_MS)).toBeUndefined()
  })

  it('no crece sin límite si piden slugs inexistentes al azar', () => {
    for (let i = 0; i < SLUG_ALIAS_MAX_ENTRIES + 50; i++) {
      setCachedSlugAlias(`slug-${i}`, null)
    }

    // El mas viejo se desaloja; el ultimo sigue estando.
    expect(getCachedSlugAlias('slug-0')).toBeUndefined()
    expect(getCachedSlugAlias(`slug-${SLUG_ALIAS_MAX_ENTRIES + 49}`)).toBeNull()
  })

  it('desaloja antes la entrada sin uso que la usada recientemente', () => {
    setCachedSlugAlias('usada', 'destino')
    setCachedSlugAlias('sin-uso', 'otro-destino')

    // Se llena casi hasta el tope sin llegar a desalojar.
    for (let i = 0; i < SLUG_ALIAS_MAX_ENTRIES - 10; i++) {
      setCachedSlugAlias(`relleno-${i}`, null)
    }

    // Tocarla la manda al final de la cola de desalojo.
    expect(getCachedSlugAlias('usada')).toBe('destino')

    // Ahora si se pasa el tope: se desalojan las mas antiguas.
    for (let i = 0; i < 20; i++) {
      setCachedSlugAlias(`extra-${i}`, null)
    }

    // La tienda que se sigue visitando conserva su entrada; la que nadie visito
    // libera el lugar. Es justo lo que se quiere de un cache acotado.
    expect(getCachedSlugAlias('usada')).toBe('destino')
    expect(getCachedSlugAlias('sin-uso')).toBeUndefined()
  })
})
