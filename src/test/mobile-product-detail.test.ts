import { describe, expect, it } from 'vitest'

import { rewriteLocalStorageUrl, rewriteLocalStorageUrls } from '../../mobile/src/lib/dev-storage-urls'
import { availabilityLabel, toProductDetail, whatsappProductLine } from '../../mobile/src/lib/product-detail-model'

/**
 * La ficha del producto en el marketplace de la app: fotos que se ven desde el
 * celular en desarrollo y el detalle completo (galería, opciones, stock).
 */
const APP_SUPABASE = 'http://192.168.0.3:55321'
const OLD = 'http://192.168.0.5:55321/storage/v1/object/public/dev-product-images/p1.jpg'

describe('fotos de Supabase local en el celular', () => {
  it('pasa la IP vieja a la que usa la app', () => {
    expect(rewriteLocalStorageUrl(OLD, APP_SUPABASE)).toBe('http://192.168.0.3:55321/storage/v1/object/public/dev-product-images/p1.jpg')
    expect(rewriteLocalStorageUrl('http://127.0.0.1:55321/storage/v1/object/public/a.png', APP_SUPABASE)).toBe(`${APP_SUPABASE}/storage/v1/object/public/a.png`)
  })

  it('no toca direcciones públicas ni lo que no es de Storage', () => {
    expect(rewriteLocalStorageUrl('https://cdn.ejemplo.com/storage/v1/object/public/a.png', APP_SUPABASE)).toBe('https://cdn.ejemplo.com/storage/v1/object/public/a.png')
    expect(rewriteLocalStorageUrl('http://8.8.8.8/storage/v1/object/public/a.png', APP_SUPABASE)).toBe('http://8.8.8.8/storage/v1/object/public/a.png')
    expect(rewriteLocalStorageUrl('http://192.168.0.5:3000/api/x', APP_SUPABASE)).toBe('http://192.168.0.5:3000/api/x')
  })

  it('con un Supabase real como destino no cambia nada', () => {
    const body = { image: OLD }
    expect(rewriteLocalStorageUrls(body, 'https://abc.supabase.co')).toBe(body)
  })

  it('recorre toda la respuesta', () => {
    const fixed = rewriteLocalStorageUrls({ data: [{ image: OLD, images: [OLD], name: 'Remera', price: 10 }] }, APP_SUPABASE)
    expect(fixed.data[0].image).toMatch(/^http:\/\/192\.168\.0\.3:55321\//)
    expect(fixed.data[0].images[0]).toMatch(/^http:\/\/192\.168\.0\.3:55321\//)
    expect(fixed.data[0]).toMatchObject({ name: 'Remera', price: 10 })
  })
})

const raw = {
  description: ' Algodón peinado ', image_url: null, image: 'p/1.jpg', images: ['p/1.jpg', 'p/2.jpg', ''],
  stock_quantity: 3, in_stock: true, unit_measure: 'unidad', hide_price: false,
  sale_price: 120000, has_offer: true, offer_price: 100000, promotion_name: 'Semana textil',
  variants: [
    { id: 'v1', variant_name: 'Talle M', sale_price: 125000, stock_quantity: 2, is_active: true },
    { id: 'v2', variant_name: 'Talle L', sale_price: 125000, stock_quantity: 0, is_active: true },
    { id: 'v3', variant_name: 'Viejo', sale_price: 1, stock_quantity: 9, is_active: false },
  ],
}
const toUrl = (value: string) => `https://img/${value}`

describe('detalle del producto', () => {
  it('junta las fotos sin repetir y arma las opciones activas', () => {
    const detail = toProductDetail(raw, toUrl)!
    expect(detail.images).toEqual(['https://img/p/1.jpg', 'https://img/p/2.jpg'])
    expect(detail.description).toBe('Algodón peinado')
    expect(detail.offerPrice).toBe(100000)
    expect(detail.promotionName).toBe('Semana textil')
    expect(detail.variants.map((v) => [v.name, v.inStock])).toEqual([['Talle M', true], ['Talle L', false]])
  })

  it('con el precio oculto no queda ningún importe', () => {
    const detail = toProductDetail({ ...raw, hide_price: true }, toUrl)!
    expect(detail).toMatchObject({ hidePrice: true, price: null, offerPrice: null, promotionName: null })
    expect(detail.variants.every((v) => v.price === null)).toBe(true)
  })

  it('una oferta que no rebaja no se muestra', () => {
    expect(toProductDetail({ ...raw, offer_price: 130000 }, toUrl)!.offerPrice).toBeNull()
    expect(toProductDetail({ ...raw, has_offer: false }, toUrl)!.offerPrice).toBeNull()
  })

  it('sin respuesta no hay detalle', () => {
    expect(toProductDetail(null, toUrl)).toBeNull()
  })

  it('disponibilidad y mensaje de WhatsApp', () => {
    expect(availabilityLabel(false, 4)).toBe('Sin stock')
    expect(availabilityLabel(true, 1)).toBe('Última unidad')
    expect(availabilityLabel(true, 3)).toBe('Últimas 3 unidades')
    expect(availabilityLabel(true, 40)).toBe('Disponible')
    expect(availabilityLabel(true, null)).toBe('Disponible')
    expect(whatsappProductLine('Remera', null)).toBe('Remera')
    expect(whatsappProductLine('Remera', { id: 'v1', name: 'Talle M', price: 1, stock: 1, inStock: true })).toBe('Remera (Talle M)')
  })
})
