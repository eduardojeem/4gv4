import { isServiceLikeProduct } from './is-service-like'

export type ProductCatalogKind = 'service' | 'part'

export function parseProductCatalogKind(value: string | null): ProductCatalogKind | null {
  return value === 'service' || value === 'part' ? value : null
}

export function filterProductsByCatalogKind<T extends Record<string, unknown>>(products: T[], kind: ProductCatalogKind | null): T[] {
  if (!kind) return products
  return products.filter((product) => kind === 'service'
    ? isServiceLikeProduct(product)
    : !isServiceLikeProduct(product))
}
