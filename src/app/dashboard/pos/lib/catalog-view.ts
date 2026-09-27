import { isServiceLikeProduct } from '@/lib/products/is-service-like'
import type { Product } from '@/types/product-unified'

/**
 * Qué muestra la grilla del POS: los productos físicos o los servicios.
 *
 * Los servicios viven en la misma tabla que los productos. Se reconocen con la
 * regla que ya usan el catálogo de reparaciones, la API de productos y la web
 * (unidad «servicio», categoría de servicios, SKU SRV-…), para que un mismo
 * ítem no sea servicio en una pantalla y producto en otra.
 */
export type POSCatalogView = 'products' | 'services'

export const DEFAULT_POS_CATALOG_VIEW: POSCatalogView = 'products'

export function isPOSService(product: Pick<Product, 'name' | 'sku' | 'unit_measure' | 'category'>): boolean {
  const category = product.category as unknown
  const categoryName = typeof category === 'string'
    ? category
    : (category as { name?: string | null } | null | undefined)?.name ?? null
  return isServiceLikeProduct({
    name: product.name,
    sku: product.sku,
    unit_measure: product.unit_measure,
    category: { name: categoryName },
  })
}

export function matchesCatalogView(
  product: Pick<Product, 'name' | 'sku' | 'unit_measure' | 'category'>,
  view: POSCatalogView,
): boolean {
  return view === 'services' ? isPOSService(product) : !isPOSService(product)
}

export function countByCatalogView(products: Array<Pick<Product, 'name' | 'sku' | 'unit_measure' | 'category'>>) {
  let services = 0
  for (const product of products) if (isPOSService(product)) services += 1
  return { products: products.length - services, services }
}
