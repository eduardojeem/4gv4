import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isServiceLikeProduct } from '@/lib/products/is-service-like'
import { DEFAULT_POS_SHELF, emptyShelfMessage, isPosService, posCatalogQuery, sameShelf } from '../../mobile/src/lib/pos-catalog'

/**
 * El catálogo del POS móvil: abre en productos, tiene un estante de servicios
 * y reconoce un servicio igual que el servidor.
 */
describe('catálogo del POS móvil', () => {
  it('abre mostrando productos, sin servicios', () => {
    expect(DEFAULT_POS_SHELF).toBe('products')
    const params = posCatalogQuery(DEFAULT_POS_SHELF, '')
    expect(params.get('catalog_kind')).toBe('part')
    expect(params.get('sort')).toBe('stock')
  })

  it('el estante de servicios pide solo servicios, por nombre', () => {
    const params = posCatalogQuery('services', '')
    expect(params.get('catalog_kind')).toBe('service')
    expect(params.get('sort')).toBe('name')
  })

  it('una categoría muestra todo lo de esa categoría', () => {
    const params = posCatalogQuery({ categoryId: 'cat-1' }, '')
    expect(params.get('category_id')).toBe('cat-1')
    expect(params.get('catalog_kind')).toBeNull()
  })

  it('al buscar se busca en todo el catálogo, sin recortar por estante', () => {
    for (const shelf of ['services', { categoryId: 'cat-1' }] as const) {
      const params = posCatalogQuery(shelf, '  funda ')
      expect(params.get('query')).toBe('funda')
      expect(params.get('catalog_kind')).toBeNull()
      expect(params.get('category_id')).toBeNull()
    }
  })

  it('compara estantes de categoría por su id', () => {
    expect(sameShelf({ categoryId: 'a' }, { categoryId: 'a' })).toBe(true)
    expect(sameShelf({ categoryId: 'a' }, 'products')).toBe(false)
    expect(sameShelf('services', 'services')).toBe(true)
  })

  it('reconoce un servicio igual que el servidor', () => {
    const cases = [
      { sku: 'P-1', unit_measure: 'unidad', category: { name: 'Fundas' } },
      { sku: 'P-2', unit_measure: 'servicio', category: null },
      { sku: 'SRV-10', unit_measure: 'unidad', category: null },
      { sku: 'serv_cambio', unit_measure: null, category: null },
      { sku: 'X-3', unit_measure: 'unidad', category: { name: 'Servicios técnicos' } },
      { sku: 'X-4', unit_measure: 'unidad', category: { name: 'Mano de obra' } },
      { sku: 'SERIE-5', unit_measure: 'unidad', category: { name: 'Repuestos' } },
    ]
    for (const product of cases) {
      expect(isPosService(product)).toBe(isServiceLikeProduct(product))
    }
  })

  it('el mensaje de vacío explica dónde cargar servicios', () => {
    expect(emptyShelfMessage('services', '')).toMatch(/Servicio/)
    expect(emptyShelfMessage('products', ' x ')).toBe('Nada coincide con «x».')
  })

  it('la pantalla del POS usa el catálogo nuevo y la misma regla de servicio', () => {
    const screen = readFileSync(join(__dirname, '../../mobile/src/app/panel/pos/index.tsx'), 'utf8')
    expect(screen).toMatch(/useState<PosShelf>\(DEFAULT_POS_SHELF\)/)
    expect(screen).toMatch(/label="Servicios"/)
    expect(screen).not.toMatch(/\bisService\(/)
  })
})
