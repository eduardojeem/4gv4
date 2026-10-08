import { describe, expect, it } from 'vitest'
import { pageDirectory } from '@/lib/public/business-directory'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

const store = (i: number, extra: Partial<MarketplaceOrganization> = {}) => ({
  id: `org-${i}`, name: `Tienda ${String(i).padStart(2, '0')}`, slug: `tienda-${i}`, plan: 'PRO', logo_url: null,
  rubro: i % 2 ? 'tecnologia' : 'comercio', city: i % 3 ? 'Asunción' : 'ENCARNACION', products_count: i,
  featured_products: [{ id: 'p' }], created_at: null, ...extra,
}) as unknown as MarketplaceOrganization

const stores = Array.from({ length: 20 }, (_, i) => store(i + 1))

describe('directorio de negocios por páginas', () => {
  it('devuelve una página de 9, ordenada por productos publicados', () => {
    const page = pageDirectory(stores, { page: 1 })
    expect(page.items).toHaveLength(9)
    expect(page.items[0].products_count).toBe(20)
    expect(page.total).toBe(20)
    expect(page.pageCount).toBe(3)
  })

  it('la última página trae lo que queda', () => {
    const page = pageDirectory(stores, { page: 3 })
    expect(page.items).toHaveLength(2)
    expect(page.items.map((item) => item.products_count)).toEqual([2, 1])
  })

  it('no manda los productos destacados al navegador', () => {
    const page = pageDirectory(stores, { page: 1 })
    expect('featured_products' in page.items[0]).toBe(false)
  })

  it('una página fuera de rango devuelve la última, y una inválida la primera', () => {
    expect(pageDirectory(stores, { page: 99 }).page).toBe(3)
    expect(pageDirectory(stores, { page: -4 }).page).toBe(1)
    expect(pageDirectory(stores, { page: Number.NaN }).page).toBe(1)
  })

  it('filtra por rubro y busca, y pagina lo filtrado', () => {
    const tecnologia = pageDirectory(stores, { rubro: 'tecnologia' })
    expect(tecnologia.total).toBe(10)
    expect(tecnologia.items.every((item) => item.rubro === 'tecnologia')).toBe(true)
    expect(pageDirectory(stores, { q: 'tienda 07' }).items.map((item) => item.id)).toEqual(['org-7'])
    expect(pageDirectory(stores, { q: 'comercio general' }).total).toBe(10)
  })

  it('las cifras son de todas las tiendas, no de la página ni del filtro', () => {
    const page = pageDirectory(stores, { page: 2, rubro: 'tecnologia' })
    expect(page.summary.stores).toBe(20)
    expect(page.summary.products).toBe(210)
    // «ENCARNACION» y «Asunción»: dos ciudades.
    expect(page.summary.cities).toBe(2)
    expect(page.summary.rubros).toEqual([['comercio', 10], ['tecnologia', 10]])
  })

  it('sin tiendas no rompe', () => {
    const page = pageDirectory([], { page: 1 })
    expect(page).toMatchObject({ items: [], total: 0, page: 1, pageCount: 1 })
  })
})
