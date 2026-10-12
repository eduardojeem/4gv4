import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(path, 'utf8')

describe('marketplace discovery regression contracts', () => {
  it('synchronizes external search navigation before debouncing', () => {
    expect(source('src/components/public/ProductsClient.tsx')).toContain('setLastInitialQuery(initialQuery)')
    expect(source('src/components/public/ProductsClient.tsx')).toContain("if (key === 'categoria')")
  })
  it('keeps mobile search at 16px and clear action touch accessible', () => {
    const search = source('src/components/public/MarketplaceSearchBox.tsx')
    expect(search).toContain('text-base sm:text-sm')
    expect(search).toContain('h-11 w-11')
  })
  it('does not present unverified businesses as officially guaranteed', () => {
    const showcase = source('src/components/public/MarketplaceBusinessPromoShowcase.tsx')
    expect(showcase).not.toContain('Garantía oficial')
    expect(showcase).not.toContain('Tienda verificada')
  })
  it('contains the mobile modal grid intrinsic width', () => {
    expect(source('src/components/public/MarketplaceProductModal.tsx')).toContain('grid min-h-0 min-w-0 flex-1 overflow-x-hidden')
  })
  it('search exposes server pagination instead of truncating the catalog', () => {
    const page = source('src/app/marketplace/buscar/page.tsx')
    expect(page).toContain('marca, offset, orden: sort')
    expect(page).toContain('serverPaginated hideSearch')
    expect(page).not.toContain('const hiddenProducts')
  })
})
