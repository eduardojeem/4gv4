import { describe, expect, it } from 'vitest'

import { getImageSourceValidationMessage, isSupportedImageSource } from './image-url-policy'
import { resolveProductImageUrl, shouldBypassImageOptimization } from './images'

const vtexImage = 'https://pyunicentroprod.vtexassets.com/arquivos/ids/2894614-800-auto?v=1&width=800'
const napaliImage = 'https://images.napali.app/global/element-products/all/default/xlarge/elykt00170_element,f_tec0_frt1.jpg'

describe('image URL policy', () => {
  it('accepts the configured VTEX image CDN even without a file extension', () => {
    expect(isSupportedImageSource(vtexImage)).toBe(true)
    expect(getImageSourceValidationMessage(vtexImage)).toBeNull()
    expect(resolveProductImageUrl(vtexImage)).toBe(vtexImage)
  })

  it('accepts the Napali product-image CDN used by existing variants', () => {
    expect(isSupportedImageSource(napaliImage)).toBe(true)
    expect(resolveProductImageUrl(napaliImage)).toBe(napaliImage)
  })

  it('rejects an external host that Next/Image cannot render', () => {
    const unsupported = 'https://unsupported.example.net/product.png'
    expect(isSupportedImageSource(unsupported)).toBe(false)
    expect(getImageSourceValidationMessage(unsupported)).toContain('no está habilitado')
    expect(resolveProductImageUrl(unsupported)).toBe('/placeholder-product.svg')
  })

  it('continues to accept local and uploaded storage paths', () => {
    expect(isSupportedImageSource('/products/item.webp')).toBe(true)
    expect(isSupportedImageSource('product-images/item.webp')).toBe(true)
  })

  // Dos productos quedaron guardados como /images/products/x.webp?v=518f9871
  // y rompieron el build: Next no optimiza una imagen local con query string
  // que no esté en images.localPatterns y el prerender de /marketplace falla.
  it('quita query y hash de las rutas locales de /public', () => {
    expect(resolveProductImageUrl('/images/products/campera-softshell-corporativa.webp?v=518f9871'))
      .toBe('/images/products/campera-softshell-corporativa.webp')
    expect(resolveProductImageUrl('/images/products/remera.webp#frente')).toBe('/images/products/remera.webp')
  })

  it('bypasses Vercel transformations for sources that are already optimized', () => {
    expect(shouldBypassImageOptimization(vtexImage)).toBe(true)
    expect(shouldBypassImageOptimization('/placeholder-product.svg')).toBe(true)
    expect(shouldBypassImageOptimization('/images/products/item.webp?v=abc123')).toBe(true)
    expect(shouldBypassImageOptimization('data:image/webp;base64,AAAA')).toBe(true)
    expect(shouldBypassImageOptimization('https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images/item.jpg')).toBe(false)
  })

  it('bypasses normalized Supabase WebP but keeps legacy raster compatibility', () => {
    const base = 'https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images'
    expect(shouldBypassImageOptimization(`${base}/products/item.webp`)).toBe(true)
    expect(shouldBypassImageOptimization(`${base}/products/item.webp?download=1`)).toBe(true)
    expect(shouldBypassImageOptimization(`${base}/products/item.jpg`)).toBe(false)
    expect(shouldBypassImageOptimization(`${base}/products/item.png`)).toBe(false)
  })

  it('keeps external and local raster assets eligible for optimization', () => {
    expect(shouldBypassImageOptimization('https://images.example.com/item.webp')).toBe(false)
    expect(shouldBypassImageOptimization('/images/item.webp')).toBe(false)
    expect(shouldBypassImageOptimization('/images/item.png')).toBe(false)
  })

  it('bypasses GIF, SVG, data and blob sources', () => {
    expect(shouldBypassImageOptimization('/animation.gif?version=2')).toBe(true)
    expect(shouldBypassImageOptimization('/brand.svg#logo')).toBe(true)
    expect(shouldBypassImageOptimization('data:image/png;base64,AAAA')).toBe(true)
    expect(shouldBypassImageOptimization('blob:https://www.mitiendapy.com/id')).toBe(true)
  })
})
