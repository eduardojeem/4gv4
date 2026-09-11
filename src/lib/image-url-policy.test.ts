import { describe, expect, it } from 'vitest'

import { getImageSourceValidationMessage, isSupportedImageSource } from './image-url-policy'
import { resolveProductImageUrl } from './images'

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
})
