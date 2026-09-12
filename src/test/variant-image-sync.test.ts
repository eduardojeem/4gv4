import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  galleryWithVariantImages,
  variantImageIndex,
  variantImageSource,
} from '@/lib/public/variant-image'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const variante = (color: string, size: string, image?: string | null) => ({
  attributes: { color, size, ...(image ? { image_url: image } : {}) },
})

const blancaM = variante('Blanco', 'M', '/img/blanca.jpg')
const blancaL = variante('Blanco', 'L')
const negraM = variante('Negro', 'M', '/img/negra.jpg')
const negraL = variante('Negro', 'L')

describe('la foto de una variante', () => {
  it('sale de image_url o de sus atributos', () => {
    expect(variantImageSource({ image_url: '/img/directa.jpg' })).toBe('/img/directa.jpg')
    expect(variantImageSource(blancaM)).toBe('/img/blanca.jpg')
    expect(variantImageSource(blancaL)).toBeNull()
    expect(variantImageSource(null)).toBeNull()
  })
})

describe('la galería del producto', () => {
  it('suma las fotos de las variantes sin repetir', () => {
    expect(galleryWithVariantImages(['/img/blanca.jpg', null, ''], [blancaM, negraM, negraL]))
      .toEqual(['/img/blanca.jpg', '/img/negra.jpg'])
  })

  it('acepta la resolución de URL de cada vista', () => {
    expect(galleryWithVariantImages(['/img/blanca.jpg'], [negraM], (image) => `https://cdn${image}`))
      .toEqual(['https://cdn/img/blanca.jpg', 'https://cdn/img/negra.jpg'])
  })
})

describe('qué foto mostrar al elegir una variante', () => {
  const galeria = galleryWithVariantImages(['/img/blanca.jpg'], [blancaM, blancaL, negraM, negraL])

  it('la suya, cuando la tiene', () => {
    expect(variantImageIndex(galeria, negraM, [blancaM, blancaL, negraM, negraL])).toBe(1)
  })

  it('la de otra variante del mismo color: los talles comparten foto', () => {
    // «Negro / L» no tiene foto propia, pero «Negro / M» sí.
    expect(variantImageIndex(galeria, negraL, [blancaM, blancaL, negraM, negraL])).toBe(1)
    expect(variantImageIndex(galeria, blancaL, [blancaM, blancaL, negraM, negraL])).toBe(0)
  })

  it('sin foto ni color no cambia nada', () => {
    expect(variantImageIndex(galeria, { attributes: { size: 'M' } }, [blancaM])).toBe(-1)
    expect(variantImageIndex(galeria, null, [blancaM])).toBe(-1)
    expect(variantImageIndex([], negraM, [negraM])).toBe(-1)
  })

  it('una foto que no está en la galería no rompe', () => {
    expect(variantImageIndex(['/img/blanca.jpg'], variante('Verde', 'M', '/img/verde.jpg'), [])).toBe(-1)
  })
})

describe('los modales muestran la foto de la variante', () => {
  const modales = [
    'src/components/public/ProductCard.tsx',
    'src/components/public/offers/OfferDetailModal.tsx',
    'src/components/public/MarketplaceProductModal.tsx',
  ]

  it.each(modales)('%s sincroniza la foto con la variante elegida', (ruta) => {
    const fuente = leer(ruta)
    expect(fuente).toContain('galleryWithVariantImages')
    expect(fuente).toContain('variantImageIndex')
    expect(fuente).toContain('if (variantImageIdx === -1) return')
  })

  it('el modal de ofertas calcula la galería antes del corte, donde valen los hooks', () => {
    const fuente = leer('src/components/public/offers/OfferDetailModal.tsx')
    const galeria = fuente.indexOf('const galleryImages = useMemo(')
    const corte = fuente.indexOf('if (!offer) return null')
    expect(galeria).toBeGreaterThan(-1)
    expect(galeria).toBeLessThan(corte)
  })
})
