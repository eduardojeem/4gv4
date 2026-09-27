import { describe, expect, it } from 'vitest'
import {
  brandSlug,
  findGlobalBrandByName,
  normalizeBrandName,
  resolveTenantBrandFields,
  searchGlobalBrands,
} from './global-catalog'

const catalogo = [
  { id: 'g-samsung', name: 'Samsung', slug: 'samsung', aliases: ['Samsung Electronics'], logo_url: 'https://cdn.plataforma/samsung.png' },
  { id: 'g-apple', name: 'Apple', slug: 'apple', aliases: [], logo_url: 'https://cdn.plataforma/apple.png' },
  { id: 'g-vieja', name: 'Marca vieja', slug: 'marca-vieja', aliases: [], logo_url: 'https://cdn.plataforma/vieja.png', is_active: false },
]

describe('catálogo global de marcas', () => {
  it('reconoce el mismo nombre escrito distinto', () => {
    expect(normalizeBrandName(' Sámsung ')).toBe('samsung')
    expect(brandSlug('Samsung Electronics')).toBe('samsung-electronics')
    expect(findGlobalBrandByName('samsung', catalogo)?.id).toBe('g-samsung')
    expect(findGlobalBrandByName('SAMSUNG ELECTRONICS', catalogo)?.id).toBe('g-samsung')
    expect(findGlobalBrandByName('samsung-electronics', catalogo)?.id).toBe('g-samsung')
  })

  it('no propone una marca dada de baja ni una que no está', () => {
    expect(findGlobalBrandByName('Marca vieja', catalogo)).toBeNull()
    expect(findGlobalBrandByName('Panadería del barrio', catalogo)).toBeNull()
    expect(findGlobalBrandByName('', catalogo)).toBeNull()
  })

  /** El problema de fondo: la imagen que cargaba una empresa representaba a la marca en todo el marketplace. */
  it('vinculada al catálogo, el nombre y el logo los pone la plataforma', () => {
    const fields = resolveTenantBrandFields(
      { name: 'samsun mal escrito', logo_url: 'https://cualquiera/imagen.jpg', global_brand_id: 'g-samsung' },
      catalogo[0],
    )
    expect(fields).toEqual({
      name: 'Samsung',
      logo_url: 'https://cdn.plataforma/samsung.png',
      global_brand_id: 'g-samsung',
    })
  })

  it('una marca propia se guarda sin logo, aunque manden uno', () => {
    expect(resolveTenantBrandFields({ name: '  Panadería del barrio ', logo_url: 'https://cualquiera/imagen.jpg' }, null)).toEqual({
      name: 'Panadería del barrio',
      logo_url: null,
      global_brand_id: null,
    })
  })

  it('busca por nombre y por alias, primero lo más parecido', () => {
    expect(searchGlobalBrands('sam', catalogo).map((b) => b.id)).toEqual(['g-samsung'])
    expect(searchGlobalBrands('electronics', catalogo).map((b) => b.id)).toEqual(['g-samsung'])
    expect(searchGlobalBrands('', catalogo).map((b) => b.id)).toEqual(['g-samsung', 'g-apple'])
    expect(searchGlobalBrands('nada', catalogo)).toEqual([])
  })
})
