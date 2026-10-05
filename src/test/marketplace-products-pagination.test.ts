import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve(process.cwd(), 'src/app/marketplace/productos/page.tsx'), 'utf8')
const CLIENT = readFileSync(resolve(process.cwd(), 'src/components/public/ProductsClient.tsx'), 'utf8')

describe('/marketplace/productos usa un catalogo paginado de verdad', () => {
  it('calcula el offset y pide solo el rango de la pagina actual', () => {
    expect(PAGE).toContain('const offset = (requestedPage - 1) * pageSize')
    expect(PAGE).toContain('getMarketplaceProductsPage(pageSize, { q, categoria, subcategoria, marca, offset, orden: sort })')
    expect(PAGE).toContain('totalProducts={productPage.total}')
    expect(PAGE).toContain('serverPaginated')
  })

  it('conserva pagina, cantidad y orden en la URL', () => {
    expect(CLIENT).toContain("params.set('pagina', String(p))")
    expect(CLIENT).toContain("params.set('porPagina', String(size))")
    expect(CLIENT).toContain("updateUrlParam('orden'")
  })

  it('lleva el buscador y la grilla antes que promociones repetidas', () => {
    expect(PAGE).not.toContain('MarketplaceProductCarousel')
    expect(PAGE).not.toContain('Productos destacados')
    expect(PAGE).not.toContain('Ofertas del marketplace')
  })
})
