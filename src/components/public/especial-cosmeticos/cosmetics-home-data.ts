import type { PublicProduct } from '@/types/public'

/**
 * Datos del inicio «Especial Cosméticos», sacados solo de lo que cargó el
 * comercio. La plantilla traía productos, combos, cifras y ciudades de
 * ejemplo que se mostraban como si fueran de la tienda; acá no se inventa
 * nada: si un dato falta, la sección no se muestra.
 */

/** Ciudad de una dirección «calle, ciudad» (la última parte). */
export function cityFromAddress(address?: string | null): string {
  const parts = (address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return ''
  const city = parts[parts.length - 1]
  // «Paraguay» no es una ciudad: se usa la parte anterior.
  if (/^paraguay$/i.test(city)) return parts.length >= 3 ? parts[parts.length - 2] : ''
  return city
}

export interface CosmeticsOfferCard {
  id: string
  name: string
  image: string | null
  tag: string
  originalPrice: number
  salePrice: number
  savings: number
  discountPercent: number
}

/** Productos con una oferta de verdad (precio de oferta menor al normal). */
export function offerCards(products: readonly PublicProduct[] | null | undefined, limit = 3): CosmeticsOfferCard[] {
  return (products || [])
    .filter((product) => {
      if (product.hide_price) return false
      const offer = Number(product.offer_price)
      const price = Number(product.sale_price)
      return product.has_offer !== false && offer > 0 && price > 0 && offer < price
    })
    .map((product) => {
      const originalPrice = Number(product.sale_price)
      const salePrice = Number(product.offer_price)
      return {
        id: product.id,
        name: product.name,
        image: product.image || product.images?.[0] || null,
        tag: product.promotion_name?.trim() || product.category?.name || 'Oferta',
        originalPrice,
        salePrice,
        savings: originalPrice - salePrice,
        discountPercent: Math.round(((originalPrice - salePrice) / originalPrice) * 100),
      }
    })
    .filter((offer) => offer.discountPercent > 0)
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, limit)
}

export interface CosmeticsCategoryInput {
  id: string
  name: string
  productCount?: number
}

export interface CosmeticsCategoryCard {
  id: string
  name: string
  count: number
  href: string
}

/**
 * Las categorías con más productos. El catálogo filtra por id
 * (`?categoria=<id>`): con el nombre la página de productos daba error.
 */
export function categoryCards(
  categories: readonly CosmeticsCategoryInput[] | null | undefined,
  prefix: string,
  limit = 5,
): CosmeticsCategoryCard[] {
  return (categories || [])
    .filter((category) => category.id && category.name && Number(category.productCount) > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      count: Number(category.productCount),
      href: `${prefix}/productos?categoria=${encodeURIComponent(category.id)}`,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}

export interface CosmeticsProductPhoto {
  id: string
  name: string
  image: string
  /** Precio que paga el cliente (el de oferta si tiene); null si está oculto. */
  price: number | null
  description: string
}

/**
 * Las fotos grandes del inicio son de productos reales, y cada una sabe de
 * qué producto es: así la foto lleva su nombre, precio y enlace (antes eran
 * imágenes «mudas» con un texto genérico).
 */
export function productPhoto(products: readonly PublicProduct[] | null | undefined, skip = 0): CosmeticsProductPhoto | null {
  const withImage = (products || []).filter((product) => product.image || product.images?.[0])
  const product = withImage[skip] ?? withImage[0]
  if (!product) return null
  const offer = Number(product.offer_price)
  const price = Number(product.sale_price)
  return {
    id: product.id,
    name: product.name,
    image: (product.image || product.images?.[0]) as string,
    price: product.hide_price ? null : offer > 0 && offer < price ? offer : price > 0 ? price : null,
    description: shortDescription(product.description),
  }
}

/** La descripción del producto recortada a una línea o dos, sin cortar palabras. */
export function shortDescription(text: string | null | undefined, max = 120): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`
}
