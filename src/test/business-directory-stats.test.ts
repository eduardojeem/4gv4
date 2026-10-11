import { describe, expect, it } from 'vitest'
import { DIRECTORY_STAT_MINIMUMS, showcaseLogos, visibleDirectoryStats } from '@/lib/public/business-directory'

/**
 * /saas/negocios busca que un comercio se sume: «10 negocios» y «2 ciudades»
 * restaban. Cada cifra aparece sola cuando llega a su mínimo.
 */
describe('las cifras de /saas/negocios', () => {
  it('con números chicos no muestra ninguna (hoy: 10 negocios, 2 ciudades, 386 productos)', () => {
    expect(visibleDirectoryStats({ stores: 10, cities: 2, products: 386 })).toEqual([])
  })

  it('cada una aparece al llegar a su mínimo, sin esperar a las demás', () => {
    const stats = visibleDirectoryStats({ stores: 12, cities: 3, products: DIRECTORY_STAT_MINIMUMS.products })
    expect(stats).toEqual([{ key: 'products', value: 1000, label: 'productos publicados' }])
  })

  it('con todas por encima del mínimo se muestran las tres, en orden', () => {
    expect(visibleDirectoryStats({ stores: 30, cities: 5, products: 2500 }).map((stat) => stat.key)).toEqual(['stores', 'cities', 'products'])
  })

  it('mientras tanto la portada usa hasta seis logos reales', () => {
    const tienda = (id: string, logo: string | null) => ({ id, name: id, slug: id, logo_url: logo }) as never
    const logos = showcaseLogos([tienda('a', 'a.png'), tienda('b', null), tienda('c', 'c.png'), tienda('d', 'd.png'), tienda('e', 'e.png'), tienda('f', 'f.png'), tienda('g', 'g.png'), tienda('h', 'h.png')])
    expect(logos.map((store: { id: string }) => store.id)).toEqual(['a', 'c', 'd', 'e', 'f', 'g'])
  })
})

describe('las cifras del marketplace', () => {
  const leer = (ruta: string) => require('node:fs').readFileSync(require('node:path').resolve(process.cwd(), ruta), 'utf8') as string

  it('la portada usa el mismo criterio y cuenta todas las tiendas, no las 24 que trae', () => {
    const portada = leer('src/app/marketplace/page.tsx')
    expect(portada).toContain('getMarketplaceOrganizations(BUSINESS_DIRECTORY_MAX_STORES)')
    expect(portada).toContain('visibleDirectoryStats({ stores: storeCount, cities: 0, products: totalProducts })')
    expect(portada).toContain("{shownStats.has('stores') && (")
  })

  it('el directorio nombra la cantidad recién cuando suma', () => {
    const directorio = leer('src/app/marketplace/empresas/page.tsx')
    expect(directorio).toContain('organizations.length >= DIRECTORY_STAT_MINIMUMS.stores')
    expect(directorio).toContain("'Tiendas verificadas con catálogo público'")
  })
})
