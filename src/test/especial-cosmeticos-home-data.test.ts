import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  categoryCards,
  cityFromAddress,
  firstProductImage,
  offerCards,
} from '@/components/public/especial-cosmeticos/cosmetics-home-data'
import type { PublicProduct } from '@/types/public'

const product = (overrides: Partial<PublicProduct>): PublicProduct => ({
  id: 'p', name: 'Producto', sku: 'SKU', description: null, brand: null,
  sale_price: 100000, wholesale_price: null, stock_quantity: 5, in_stock: true,
  is_active: true, featured: false, image: null, images: null, unit_measure: 'unidad', barcode: null,
  ...overrides,
})

describe('inicio Especial Cosméticos: datos reales', () => {
  it('saca la ciudad de la dirección del comercio', () => {
    expect(cityFromAddress('Lomas Valentinas c/ Mcal. Estigarribia, Encarnación')).toBe('Encarnación')
    expect(cityFromAddress('Av. España 123, Asunción, Paraguay')).toBe('Asunción')
    expect(cityFromAddress('Sin coma')).toBe('')
    expect(cityFromAddress('')).toBe('')
  })

  it('las ofertas son productos con precio de oferta menor al normal, con su descuento real', () => {
    const offers = offerCards([
      product({ id: 'a', name: 'Sérum', sale_price: 200000, offer_price: 150000, has_offer: true, promotion_name: 'Black Friday' }),
      product({ id: 'b', name: 'Crema', sale_price: 100000, offer_price: 90000, has_offer: true }),
      product({ id: 'c', name: 'Sin oferta', sale_price: 100000, offer_price: null }),
      product({ id: 'd', name: 'Oferta mayor al precio', sale_price: 100000, offer_price: 120000, has_offer: true }),
      product({ id: 'e', name: 'Precio oculto', sale_price: 100000, offer_price: 50000, has_offer: true, hide_price: true }),
    ])
    expect(offers.map((o) => o.id)).toEqual(['a', 'b'])
    expect(offers[0]).toMatchObject({ discountPercent: 25, savings: 50000, salePrice: 150000, tag: 'Black Friday' })
    expect(offers[1].discountPercent).toBe(10)
    expect(offerCards([])).toEqual([])
    expect(offerCards(undefined)).toEqual([])
  })

  it('las categorías enlazan por id, con la cantidad real y las más grandes primero', () => {
    const cards = categoryCards([
      { id: 'c1', name: 'Bálsamos', productCount: 1 },
      { id: 'c2', name: 'Sérums', productCount: 4 },
      { id: 'c3', name: 'Vacía', productCount: 0 },
      { id: 'c4', name: 'Sin dato' },
    ], '/paravos')
    expect(cards).toEqual([
      { id: 'c2', name: 'Sérums', count: 4, href: '/paravos/productos?categoria=c2' },
      { id: 'c1', name: 'Bálsamos', count: 1, href: '/paravos/productos?categoria=c1' },
    ])
  })

  it('las fotos salen de los productos de la tienda', () => {
    const list = [product({ id: '1', image: 'a.webp' }), product({ id: '2', images: ['b.webp'] })]
    expect(firstProductImage(list)).toBe('a.webp')
    expect(firstProductImage(list, 1)).toBe('b.webp')
    expect(firstProductImage(list, 5)).toBe('a.webp')
    expect(firstProductImage([])).toBeNull()
  })
})

describe('la plantilla no inventa datos', () => {
  const dir = 'src/components/public/especial-cosmeticos'
  const read = (file: string) => readFileSync(resolve(process.cwd(), dir, file), 'utf8')
  const home = read('EspecialCosmeticosHome.tsx')
  const header = read('EspecialCosmeticosHeader.tsx')
  const footer = read('EspecialCosmeticosFooter.tsx')

  it('pide los productos con la URL de la API, no con el slug', () => {
    expect(home).toContain('newestProductsKey(slug)')
    expect(home).not.toContain('fetchPublicProducts(company.slug)')
  })

  it('sin catálogo, combos, cifras, cupones ni sellos de ejemplo', () => {
    for (const fake of ['FALLBACK_COSMETICS_PRODUCTS', 'COSMETICS_DEALS', 'Glowora', 'GLOW20', '10.000+', '4.9', '100% Vegano', 'Cruelty Free', '14 días', 'Asunción']) {
      expect(home, fake).not.toContain(fake)
    }
  })

  it('el encabezado y el pie no usan datos de otra tienda', () => {
    for (const source of [header, footer]) {
      expect(source).not.toContain("'+595 981 111 111'")
      expect(source).not.toContain('paravos-logo.webp')
      expect(source).not.toContain("'Glowora'")
      expect(source).not.toMatch(/Asunción'/)
    }
    expect(header).not.toMatch(/>\s*-25%/)
    expect(header).not.toContain('100% Vegano')
    expect(footer).not.toContain("'08:30 a 19:30 hs'")
  })

  it('un solo botón de WhatsApp (el del diseño general)', () => {
    expect(home).not.toContain('<FloatingWhatsAppButton')
  })
})
