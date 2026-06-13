import { describe, expect, it } from 'vitest'
import { getTenantSlugFromPath, getTenantSlugFromPathname } from '@/lib/saas/tenant'

describe('public offers tenant routing', () => {
  it('resolves the organization slug from the dedicated offers route', () => {
    expect(getTenantSlugFromPath('/4g-celulares/ofertas')).toBe('4g-celulares')
    expect(getTenantSlugFromPathname('/4g-celulares/ofertas')).toBe('4g-celulares')
  })

  it('does not treat the global offers route as an organization slug', () => {
    expect(getTenantSlugFromPath('/ofertas')).toBeNull()
    expect(getTenantSlugFromPathname('/ofertas')).toBe('')
  })
})
