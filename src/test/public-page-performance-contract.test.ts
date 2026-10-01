import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('public page performance contracts', () => {
  it('shares one cached public plan catalog across the SaaS pages', () => {
    const catalog = read('src/lib/saas/public-plans.ts')
    const landing = read('src/app/saas/page.tsx')
    const plans = read('src/app/saas/planes/page.tsx')

    expect(catalog).toContain("import { unstable_cache } from 'next/cache'")
    expect(catalog).toContain('PUBLIC_PLANS_REVALIDATE_SECONDS = 300')
    expect(catalog).toContain("tags: ['subscription-plans:public']")
    expect(landing).toContain('getPublicSubscriptionPlans()')
    expect(plans).toContain('getPublicSubscriptionPlans()')
    expect(landing).not.toContain("from('subscription_plans')")
    expect(plans).not.toContain("from('subscription_plans')")
    expect(landing).not.toContain('createClient()')
    expect(plans).not.toContain('createClient()')
  })

  it('keeps the complete catalog reachable while bounding Marketplace home payloads', () => {
    const marketplace = read('src/app/marketplace/page.tsx')

    expect(marketplace).toContain('MARKETPLACE_HOME_PRODUCT_LIMIT = 24')
    expect(marketplace).toContain('MARKETPLACE_HOME_OFFER_LIMIT = 48')
    expect(marketplace).toContain('getMarketplaceProductsPage(MARKETPLACE_HOME_PRODUCT_LIMIT)')
    expect(marketplace).toContain('getMarketplaceOffers(MARKETPLACE_HOME_OFFER_LIMIT)')
    expect(marketplace).toContain('href="/marketplace/productos"')
  })

  it('reports measured and Cloudflare-excluded pages without hiding the configured total', () => {
    const checks = read('src/lib/health/checks/web.ts')

    expect(checks).toContain('${measured.length}/${pages.length} páginas medidas')
    expect(checks).toContain('${challenged.length} excluida(s) por desafío de Cloudflare')
    expect(checks).toContain('measuredPages: measured.length')
    expect(checks).toContain('excludedByCloudflare: challenged.length')
  })
})
