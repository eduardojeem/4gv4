import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('contratos de accesibilidad pública', () => {
  it('quita del foco las pistas duplicadas de los carruseles', () => {
    expect(source('src/components/public/MarketplaceOrgMarquee.tsx')).toContain('aria-hidden="true" inert')
    expect(source('src/components/public/MarketplaceOrgProductGrid.tsx')).toContain('aria-hidden="true" inert')
  })

  it('da nombre accesible al buscador reutilizado en escritorio y móvil', () => {
    expect(source('src/components/public/MarketplaceSearchBox.tsx')).toContain('aria-label="Buscar en el marketplace"')
  })

  it('usa variantes con contraste AA en los textos señalados por axe', () => {
    expect(source('src/components/public/saas-public-nav.tsx')).toContain('bg-emerald-700 hover:bg-emerald-600')
    expect(source('src/components/public/marketplace-public-nav.tsx')).toContain("bg-primary/10 text-foreground")
    expect(source('src/components/public/MarketplaceOffersSection.tsx')).toContain("bg-black/25 text-white")
    expect(source('src/components/public/MarketplaceBrandsSection.tsx')).not.toContain('text-muted-foreground/80')
    expect(source('src/components/public/MarketplaceProductCarousel.tsx')).toContain('text-[#075E54]')
    expect(source('src/components/public/MarketplaceOrgProductGrid.tsx')).toContain('text-[#075E54]')
    expect(source('src/components/public/MarketplaceBusinessPromoShowcase.tsx')).toContain('bg-emerald-700 hover:bg-emerald-800')
    expect(source('src/components/public/MarketplaceBusinessPromoShowcase.tsx')).toContain('text-emerald-800')
  })
})
