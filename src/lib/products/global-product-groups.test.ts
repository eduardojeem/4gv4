import { describe, expect, it } from 'vitest'
import { groupGlobalProducts } from './global-product-groups'

const categories = [
  { id: 'acc', name: 'Accesorios', parent_id: null },
  { id: 'car', name: 'Cargadores', parent_id: 'acc' },
  { id: 'aud', name: 'Audio y Video', parent_id: null },
]
const brands = [{ id: 'amp', name: 'AmpSentrix' }, { id: 'jbl', name: 'JBL' }]

const product = (id: string, name: string, extra: Partial<{ global_brand_id: string | null; global_category_id: string | null; brand_name: string | null }> = {}) => ({
  id, name, global_brand_id: null, global_category_id: null, brand_name: null, ...extra,
})

const products = [
  product('1', 'Cargador 20W', { global_brand_id: 'amp', global_category_id: 'car' }),
  product('2', 'Parlante Go 3', { global_brand_id: 'jbl', global_category_id: 'aud' }),
  product('3', 'Cable micro USB', { global_brand_id: 'amp' }),
  product('4', 'Funda genérica', { brand_name: 'Genérico' }),
]

describe('agrupar el catálogo global de productos', () => {
  it('por categoría: lo sin clasificar primero, después en orden de árbol con su madre', () => {
    const groups = groupGlobalProducts(products, 'category', categories, brands)
    expect(groups.map((group) => group.label)).toEqual(['Sin categoría', 'Cargadores', 'Audio y Video'])
    expect(groups[0]).toMatchObject({ pending: true })
    expect(groups[0].items.map((item) => item.id)).toEqual(['3', '4'])
    expect(groups[1].parentLabel).toBe('Accesorios')
  })

  it('por marca: las que no están en el catálogo de marcas cuentan como pendientes', () => {
    const groups = groupGlobalProducts(products, 'brand', categories, brands)
    expect(groups.map((group) => group.label)).toEqual(['Genérico (fuera del catálogo de marcas)', 'AmpSentrix', 'JBL'])
    expect(groups[0].pending).toBe(true)
    expect(groups[1].items.map((item) => item.name)).toEqual(['Cable micro USB', 'Cargador 20W'])
  })

  it('en lista, todo junto y por nombre', () => {
    const [group] = groupGlobalProducts(products, 'list', categories, brands)
    expect(group.items.map((item) => item.id)).toEqual(['3', '1', '4', '2'])
  })
})
