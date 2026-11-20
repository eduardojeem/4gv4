import { describe, expect, it } from 'vitest'

import { matchNearbyLocation } from '../../mobile/src/lib/nearby-location-model'
import { publicLocation } from '@/lib/public/marketplace-location'

const asuncion = publicLocation('PY', 'Asunción')!
const facets = {
  countries: [
    { code: 'PY', label: 'Paraguay', count: 12 },
    { code: 'AR', label: 'Argentina', count: 1 },
  ],
  allCities: [
    { key: asuncion.key, label: asuncion.city, count: 8, countryCode: 'PY' },
  ],
}

describe('tiendas cerca mío', () => {
  it('con tiendas en tu ciudad filtra por esa ciudad', () => {
    expect(matchNearbyLocation({ isoCountryCode: 'py', city: 'Asuncion' }, facets)).toEqual({
      kind: 'city',
      selection: { country: 'PY', city: asuncion.key },
      label: asuncion.city,
    })
  })

  it('si la ciudad no viene, prueba con el distrito o la región', () => {
    const match = matchNearbyLocation({ isoCountryCode: 'PY', city: null, district: 'Asunción' }, facets)
    expect(match.kind).toBe('city')
  })

  it('sin tiendas en tu ciudad, muestra las de tu país', () => {
    expect(matchNearbyLocation({ isoCountryCode: 'PY', city: 'Pilar' }, facets)).toEqual({
      kind: 'country',
      selection: { country: 'PY', city: 'all' },
      label: 'Paraguay',
      city: 'Pilar',
    })
  })

  it('sin tiendas en tu país no cambia el filtro', () => {
    expect(matchNearbyLocation({ isoCountryCode: 'CL', city: 'Santiago' }, facets)).toEqual({ kind: 'none', city: 'Santiago' })
  })

  it('sin datos de ubicación no cambia nada', () => {
    expect(matchNearbyLocation(null, facets)).toEqual({ kind: 'none', city: null })
    expect(matchNearbyLocation({ isoCountryCode: 'PY', city: 'Asunción' }, null).kind).toBe('none')
  })
})
