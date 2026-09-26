import { describe, expect, it } from 'vitest'

import { getCompanyMapsHref, isValidGoogleMapsUrl } from '@/lib/website/company-maps-url'

describe('company maps URL', () => {
  it.each([
    'https://www.google.com/maps/place/Encarnacion',
    'https://maps.google.com/maps?q=Encarnacion',
    'https://maps.app.goo.gl/abc123',
  ])('accepts supported Google Maps links: %s', (url) => {
    expect(isValidGoogleMapsUrl(url)).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    'http://www.google.com/maps/place/Encarnacion',
    'https://example.com/maps/place/Encarnacion',
    'not-a-url',
  ])('rejects unsafe or unrelated links: %s', (url) => {
    expect(isValidGoogleMapsUrl(url)).toBe(false)
  })

  it('prefers the exact configured link', () => {
    const mapsUrl = 'https://maps.app.goo.gl/abc123'

    expect(getCompanyMapsHref(mapsUrl, 'Encarnacion, Paraguay')).toBe(mapsUrl)
  })

  it('falls back to a Google Maps address search', () => {
    expect(getCompanyMapsHref('', 'Av. Japon 123, Encarnacion')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%20Japon%20123%2C%20Encarnacion'
    )
  })

  it('returns null when neither value is usable', () => {
    expect(getCompanyMapsHref('https://example.com', '  ')).toBeNull()
  })
})
