import { describe, expect, it } from 'vitest'
import { getTenantSlugFromPath, getTenantSlugFromPathname, isTenantPublicSection } from '@/lib/saas/tenant'
describe('barber reservations tenant', () => {
 it('keeps the store context on the dedicated reservations page', () => {
  expect(getTenantSlugFromPath('/juanbarber/reservas')).toBe('juanbarber')
  expect(getTenantSlugFromPathname('/juanbarber/reservas')).toBe('juanbarber')
  expect(isTenantPublicSection('reservas')).toBe(true)
 })
})
