import { withOrgQuery } from '@/lib/saas/tenant'
import type { PublicProduct } from '@/types/public'

/**
 * Los productos mas nuevos de la tienda. El inicio los usa en varias secciones
 * (destacados y, en Moda y Deportivo, la portada y las categorias); con la misma
 * clave SWR se hace una sola consulta.
 */
export function newestProductsKey(tenantSlug: string) {
  return withOrgQuery('/api/public/products?per_page=32&sort=newest', tenantSlug)
}

export const NEWEST_PRODUCTS_SWR_OPTIONS = { revalidateOnFocus: false, dedupingInterval: 60000 } as const

export async function fetchPublicProducts(url: string): Promise<PublicProduct[]> {
  const res = await fetch(url)
  const body = await res.json().catch(() => null)
  const products = body?.data?.products
  if (!res.ok || !Array.isArray(products)) {
    throw new Error('Failed to fetch products')
  }
  return products as PublicProduct[]
}
