import { describe, expect, it } from 'vitest'
import { buildCategoryShowcase, rubroForCategory } from '@/lib/public/category-showcase'

describe('rubros de la vidriera de categorías', () => {
  it('reconoce las categorías que crearon las tiendas, con o sin tildes y con errores comunes', () => {
    expect(rubroForCategory('Electrónica')).toBe('electronica')
    expect(rubroForCategory('Electronica')).toBe('electronica')
    expect(rubroForCategory('Pantallas LCD/OLED')).toBe('electronica')
    expect(rubroForCategory('Cctv-alarma')).toBe('electronica')
    expect(rubroForCategory('Cosina')).toBe('electrodomesticos')
    expect(rubroForCategory('Utensilio')).toBe('electrodomesticos')
    expect(rubroForCategory('Tintas y toner')).toBe('computacion')
    expect(rubroForCategory('Red e internet')).toBe('computacion')
    expect(rubroForCategory('Accesorios de belleza')).toBe('belleza')
    expect(rubroForCategory('Accesorios de Celular')).toBe('electronica')
    expect(rubroForCategory('Audio y Video')).toBe('audio')
    expect(rubroForCategory('Limpieza del Hogar')).toBe('muebles')
    expect(rubroForCategory('Remeras Básicas')).toBe('moda')
    expect(rubroForCategory('Accesorios')).toBeNull()
  })

  it('cuenta productos por rubro, junta las categorías y elige miniaturas destacadas con foto', () => {
    const product = (id: string, category: [string, string], extra: { image?: string | null; featured?: boolean } = {}) => ({
      id, name: 'Producto ' + id, organization_slug: 'tienda', category: { id: category[0], name: category[1] }, image: 'img-' + id, ...extra,
    })
    const stats = buildCategoryShowcase([
      product('1', ['a', 'Electrónica']),
      product('2', ['b', 'Electronica'], { featured: true }),
      product('3', ['c', 'Celulares'], { image: null }),
      product('4', ['a', 'Electrónica']),
      product('5', ['d', 'Reloj']),
      product('6', ['e', 'Sin rubro conocido']),
    ])
    expect(stats.electronica).toEqual({
      count: 4,
      categoryIds: ['a', 'b', 'c'],
      products: [
        { id: '2', name: 'Producto 2', image: 'img-2', href: '/tienda/productos/2' },
        { id: '1', name: 'Producto 1', image: 'img-1', href: '/tienda/productos/1' },
        { id: '4', name: 'Producto 4', image: 'img-4', href: '/tienda/productos/4' },
      ],
    })
    // Con menos de 3 productos el rubro no sale.
    expect(stats.moda).toBeUndefined()
  })
})
