import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isPublicRepairSessionAuthorized,
  type PublicSessionPayload,
} from '@/lib/public-session'
import { parsePublicProductsQuery } from '@/lib/public/products-query'
import { normalizeDefaultPublicOrgSlug } from '@/lib/saas/tenant'

const workspace = process.cwd()
const productsRoute = readFileSync(
  resolve(workspace, 'src/app/api/public/products/route.ts'),
  'utf8'
)
const customerRegisterPage = readFileSync(
  resolve(workspace, 'src/app/cliente/registro/page.tsx'),
  'utf8'
)
const publicLayout = readFileSync(
  resolve(workspace, 'src/app/(public)/layout.tsx'),
  'utf8'
)
const publicHeader = readFileSync(
  resolve(workspace, 'src/components/public/PublicHeader.tsx'),
  'utf8'
)
const categoryShowcase = readFileSync(
  resolve(workspace, 'src/components/public/inicio/CategoryShowcase.tsx'),
  'utf8'
)
const heroSection = readFileSync(
  resolve(workspace, 'src/components/public/inicio/HeroSection.tsx'),
  'utf8'
)
const featuredProducts = readFileSync(
  resolve(workspace, 'src/components/public/inicio/FeaturedProducts.tsx'),
  'utf8'
)
const organizationReviews = readFileSync(
  resolve(workspace, 'src/components/public/inicio/OrganizationReviews.tsx'),
  'utf8'
)
const servicesPage = readFileSync(
  resolve(workspace, 'src/app/(public)/servicios/ServicesPageClient.tsx'),
  'utf8'
)

describe('public storefront hardening', () => {
  const repairSession: PublicSessionPayload = {
    repairId: '11111111-1111-4111-8111-111111111111',
    ticketNumber: 'REP-000123',
    organizationId: '22222222-2222-4222-8222-222222222222',
    contact: '0981000000',
  }

  it('binds a public repair session to the exact repair and organization', () => {
    expect(isPublicRepairSessionAuthorized(repairSession, {
      repairId: repairSession.repairId,
      ticketNumber: repairSession.ticketNumber,
      organizationId: repairSession.organizationId,
    })).toBe(true)

    expect(isPublicRepairSessionAuthorized(repairSession, {
      repairId: '33333333-3333-4333-8333-333333333333',
      ticketNumber: repairSession.ticketNumber,
      organizationId: repairSession.organizationId,
    })).toBe(false)

    expect(isPublicRepairSessionAuthorized(repairSession, {
      repairId: repairSession.repairId,
      ticketNumber: repairSession.ticketNumber,
      organizationId: '44444444-4444-4444-8444-444444444444',
    })).toBe(false)
  })

  it('normalizes public product query pagination and prices', () => {
    expect(parsePublicProductsQuery(new URLSearchParams('page=-5&per_page=abc&min_price=abc&max_price=-1')))
      .toEqual(expect.objectContaining({
        page: 1,
        perPage: 20,
        minPrice: 0,
        maxPrice: 999999,
      }))

    expect(parsePublicProductsQuery(new URLSearchParams('page=3&per_page=500')))
      .toEqual(expect.objectContaining({ page: 3, perPage: 50 }))
  })

  it('only accepts a tenant slug as the legacy public organization target', () => {
    expect(normalizeDefaultPublicOrgSlug('4g-celulares')).toBe('4g-celulares')
    expect(normalizeDefaultPublicOrgSlug('www.servix360.org')).toBeNull()
    expect(normalizeDefaultPublicOrgSlug('')).toBeNull()
  })

  it('exposes the real available stock to the cart', () => {
    expect(productsRoute).toContain('stock_quantity: Number(p.stock_quantity ?? 0)')
    expect(productsRoute).not.toContain('(p.stock_quantity as number) > 0 ? 1 : 0')
  })

  it('uses the marketplace as the customer registration fallback', () => {
    expect(customerRegisterPage).toContain(
      "sanitizeRedirectPath(searchParams.get('redirect'), '/marketplace')"
    )
  })

  it('keeps one main landmark and hides the closed mobile menu from assistive technology', () => {
    expect(publicLayout).not.toContain('<main id="main-content"')
    expect(publicHeader).toContain('inert={!mobileMenuOpen}')
    expect(publicHeader).toContain('aria-hidden={!mobileMenuOpen}')
  })

  it('keeps the category skeleton stable through the first client render', () => {
    expect(categoryShowcase).toContain('if (!mounted || isLoading)')
  })

  it('keeps home product cards readable on narrow screens', () => {
    expect(featuredProducts).toContain('grid grid-cols-1 gap-4 sm:grid-cols-2')
    expect(featuredProducts).not.toContain('grid grid-cols-2 gap-4')
  })

  it('keeps the secondary hero panel out of the mobile first viewport', () => {
    expect(heroSection).toContain('hidden lg:flex')
    expect(heroSection).toContain('py-10 text-white sm:py-14 lg:py-16')
  })

  it('keeps cached reviews stable during hydration', () => {
    expect(organizationReviews).toContain('const mounted = useSyncExternalStore(')
    expect(organizationReviews).toContain('const hydratedData = mounted ? data : undefined')
  })

  it('prefixes internal service links with the active tenant', () => {
    expect(servicesPage).toContain('prefixPublicTenantPath(tenantPrefix, rawCtaHref)')
  })
})
