import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const marketplaceSource = readFileSync(
  resolve(workspace, 'src/lib/public/marketplace.ts'),
  'utf8'
)
const marketplaceHome = readFileSync(
  resolve(workspace, 'src/app/marketplace/page.tsx'),
  'utf8'
)
const brandingSource = readFileSync(
  resolve(workspace, 'src/lib/platform/branding.ts'),
  'utf8'
)

describe('Marketplace production cache', () => {
  it('shares public catalog reads between requests with freshness based on volatility', () => {
    expect(marketplaceSource).toContain("import { unstable_cache } from 'next/cache'")
    expect(marketplaceSource).toContain('MARKETPLACE_CATALOG_REVALIDATE_SECONDS = 30')
    expect(marketplaceSource).toContain('MARKETPLACE_DIRECTORY_REVALIDATE_SECONDS = 300')
    expect(marketplaceSource).toContain("tags: ['marketplace:products']")
    expect(marketplaceSource).toContain("tags: ['marketplace:offers']")
    expect(marketplaceSource).toContain("tags: ['marketplace:organizations']")
    expect(marketplaceSource).toContain("tags: ['marketplace:brands']")
    expect(marketplaceSource).toContain("tags: ['marketplace:categories']")
    expect(marketplaceSource).toContain('hasMarketplaceProductFilters(options)')
    expect(marketplaceSource).toContain('options?.q')
  })

  it('does not force the Marketplace home to render dynamically on every visit', () => {
    expect(marketplaceHome).not.toContain("export const dynamic = 'force-dynamic'")
    expect(marketplaceHome).toContain('export const revalidate = 30')
  })

  it('does not query platform branding repeatedly across layout and metadata', () => {
    expect(brandingSource).toContain("import { unstable_cache } from 'next/cache'")
    expect(brandingSource).toContain("tags: ['platform:branding']")
    expect(brandingSource).toContain('revalidate: 300')
  })
})
