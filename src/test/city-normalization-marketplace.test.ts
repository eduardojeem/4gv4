import { describe, expect, it } from 'vitest'
import { cityForSaving, KNOWN_CITY_NAMES, knownParaguayCity } from '@/lib/public/city-normalizer'
import { locationFacets, publicLocation } from '@/lib/public/marketplace-location'

describe('ciudades del marketplace', () => {
  it('una ciudad conocida sin país confirmado cuenta como Paraguay', () => {
    expect(publicLocation(null, 'encarnacion')).toEqual({ key: 'PY:encarnacion', city: 'Encarnación', countryCode: 'PY' })
    expect(publicLocation('PY', 'Encarnación')?.key).toBe('PY:encarnacion')
  })

  it('«encarnacion» y «Encarnación» salen como una sola ciudad en el filtro', () => {
    const stores = [
      { id: 'a', countryCode: null, locations: [publicLocation(null, 'encarnacion')!] },
      { id: 'b', countryCode: 'PY', locations: [publicLocation('PY', 'Encarnación')!] },
      { id: 'c', countryCode: null, locations: [publicLocation(null, 'ENCARNACION, Paraguay')!] },
    ]
    const { cities } = locationFacets(stores)
    expect(cities).toEqual([{ key: 'PY:encarnacion', label: 'Encarnación', countryCode: 'PY', count: 3 }])
  })

  it('una ciudad desconocida sin país se muestra con mayúscula inicial', () => {
    expect(publicLocation(null, 'villa del rosario')).toMatchObject({ countryCode: null, city: 'Villa del Rosario' })
  })

  it('un país confirmado distinto de Paraguay se respeta', () => {
    expect(publicLocation('AR', 'Posadas')).toMatchObject({ countryCode: 'AR', city: 'Posadas' })
  })

  it('al guardar corrige las ciudades conocidas y deja las demás como se escribieron', () => {
    expect(cityForSaving('  encarnacion ')).toBe('Encarnación')
    expect(cityForSaving('cde')).toBe('Ciudad del Este')
    expect(cityForSaving('Villa  del Rosario')).toBe('Villa del Rosario')
    expect(cityForSaving('')).toBe('')
    expect(knownParaguayCity('Posadas')).toBeNull()
  })

  it('las sugerencias no repiten ciudades', () => {
    expect(KNOWN_CITY_NAMES).toContain('Encarnación')
    expect(new Set(KNOWN_CITY_NAMES).size).toBe(KNOWN_CITY_NAMES.length)
  })
})
