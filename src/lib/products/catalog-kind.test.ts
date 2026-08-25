import { describe, expect, it } from 'vitest'
import { filterProductsByCatalogKind } from './catalog-kind'

describe('filterProductsByCatalogKind', () => {
  const products = [
    { id: 'part-1', name: 'Módulo A05', unit_measure: 'unidad', category: { name: 'Repuestos' } },
    { id: 'service-1', name: 'Mantenimiento premium', unit_measure: 'unidad', category: { name: 'Servicios' } },
    { id: 'service-2', name: 'Cambio de batería', unit_measure: 'unidad', category: { name: 'General' } },
  ]

  it('filters services before endpoint pagination using the canonical classifier', () => {
    expect(filterProductsByCatalogKind(products, 'service').map((product) => product.id)).toEqual(['service-1', 'service-2'])
    expect(filterProductsByCatalogKind(products, 'part').map((product) => product.id)).toEqual(['part-1'])
  })

  it('does not alter the catalog without a supported kind', () => {
    expect(filterProductsByCatalogKind(products, null)).toEqual(products)
  })
})
