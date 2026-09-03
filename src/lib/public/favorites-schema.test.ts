import { describe, expect, it } from 'vitest'
import { favoriteSchema, mergeFavorites } from './favorites-schema'
const favorite = { productId: '00000000-0000-4000-8000-000000000001', slug: 'tienda', name: 'Remera', store: 'Tienda' }
describe('favoritos públicos', () => {
  it('combina sin duplicar ni mezclar tiendas', () => {
    expect(mergeFavorites([favorite], [favorite])).toHaveLength(1)
    expect(mergeFavorites([favorite], [{ ...favorite, slug: 'otra' }])).toHaveLength(2)
  })
  it('rechaza rutas inseguras y elimina metadatos internos', () => {
    expect(favoriteSchema.safeParse({ ...favorite, slug: '../admin' }).success).toBe(false)
    expect(favoriteSchema.parse({ ...favorite, purchase_price: 500 })).not.toHaveProperty('purchase_price')
  })
})
