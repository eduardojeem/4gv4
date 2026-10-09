import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('marketplace categories build boundary', () => {
  it('renders live catalog data at request time instead of requiring an admin key during build', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/marketplace/categorias/page.tsx'), 'utf8')
    expect(page).toContain("export const dynamic = 'force-dynamic'")
    expect(page).not.toMatch(/export const revalidate\s*=\s*600/)
    expect(page).toContain('getMarketplaceCategories()')
    expect(page).toContain('getMarketplaceBrands(48)')
  })
})
