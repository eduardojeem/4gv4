import { describe, expect, it } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { hideUnavailableSections, isSectionAvailable, resolveSectionAvailability } from '@/lib/website/section-availability'

const available = (map: ReturnType<typeof resolveSectionAvailability>) =>
  Object.entries(map).filter(([, value]) => value.available).map(([key]) => key).sort()

describe('website sections by account modules', () => {
  it('gives a store with only a catalog its selling sections and no service ones', () => {
    const map = resolveSectionAvailability({ hasCatalog: true, hasServices: false, hasRepairs: false })
    expect(available(map)).toEqual(['announcement', 'brands', 'carousel', 'checkout', 'company', 'hero', 'offers', 'process', 'trust_bar'])
    expect(map.booking.requires).toContain('Servicios')
  })

  it('gives a barbershop without catalog bookings, services and gallery, but no cart', () => {
    const map = resolveSectionAvailability({ hasCatalog: false, hasServices: true, hasRepairs: false })
    expect(map.booking.available).toBe(true)
    expect(map.gallery.available).toBe(true)
    expect(map.services.available).toBe(true)
    expect(map.checkout.available).toBe(false)
    expect(map.brands.available).toBe(false)
    expect(map.offers.available).toBe(false)
  })

  it('lets a repair shop show services and work photos but not take bookings', () => {
    const map = resolveSectionAvailability({ hasCatalog: false, hasServices: false, hasRepairs: true })
    expect(map.services.available).toBe(true)
    expect(map.gallery.available).toBe(true)
    expect(map.booking.available).toBe(false)
  })

  it('treats the summary and unknown availability as always reachable', () => {
    expect(isSectionAvailable(undefined, 'booking')).toBe(true)
    const map = resolveSectionAvailability({ hasCatalog: false, hasServices: false, hasRepairs: false })
    expect(isSectionAvailable(map, 'overview')).toBe(true)
    expect(isSectionAvailable(map, 'booking')).toBe(false)
  })
})

describe('public settings follow the account modules', () => {
  const settings = () => {
    const base = getWebsiteSettingsDefaults()
    return {
      ...base,
      brands_section: { ...base.brands_section!, enabled: true },
      offers_section: { ...base.offers_section!, enabled: true },
      booking_section: { ...base.booking_section!, enabled: true },
      gallery_section: { ...base.gallery_section!, enabled: true },
      company_info: { ...base.company_info, servicesPageEnabled: true },
    }
  }

  it('turns off bookings, gallery and services left on after the module was removed', () => {
    const result = hideUnavailableSections(settings(), { hasCatalog: true, hasServices: false, hasRepairs: false })
    expect(result.booking_section?.enabled).toBe(false)
    expect(result.gallery_section?.enabled).toBe(false)
    expect(result.company_info.servicesPageEnabled).toBe(false)
    expect(result.offers_section?.enabled).toBe(true)
    expect(result.brands_section?.enabled).toBe(true)
  })

  it('turns off brands and offers for a business without a product catalog', () => {
    const result = hideUnavailableSections(settings(), { hasCatalog: false, hasServices: true, hasRepairs: false })
    expect(result.offers_section?.enabled).toBe(false)
    expect(result.brands_section?.enabled).toBe(false)
    expect(result.booking_section?.enabled).toBe(true)
  })

  it('does not change the original settings object', () => {
    const original = settings()
    hideUnavailableSections(original, { hasCatalog: false, hasServices: false, hasRepairs: false })
    expect(original.booking_section?.enabled).toBe(true)
  })
})
