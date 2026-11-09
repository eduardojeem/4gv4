import type { Service } from '@/types/website-settings'

/** Fila de `products` con lo que la página pública de servicios necesita. */
export type InventoryServiceRow = {
  id: string
  name: string
  description?: string | null
  sale_price?: number | null
  hide_price?: boolean | null
  visibility?: string | null
  is_active?: boolean | null
  image_url?: string | null
  images?: string[] | null
  category?: unknown
}

// La relación categories(name) puede venir como objeto o como array de uno.
function categoryName(raw: unknown): string | undefined {
  if (!raw) return undefined
  if (Array.isArray(raw)) return (raw[0] as { name?: string } | undefined)?.name
  return (raw as { name?: string }).name
}

/** La portada es la primera foto del producto; `image_url` es su copia legada. */
export function serviceCoverUrl(row: Pick<InventoryServiceRow, 'image_url' | 'images'>): string | undefined {
  return row.images?.find(Boolean) || row.image_url || undefined
}

/**
 * Servicios del catálogo para la web: solo los activos y marcados para la
 * página web (visibility = public). Respeta «precio a consultar».
 */
export function inventoryServicesForWebsite(rows: readonly InventoryServiceRow[]): Service[] {
  return rows
    .filter((row) => row.is_active !== false && (row.visibility ?? 'public') === 'public')
    .map((row) => ({
      id: row.id,
      title: row.name,
      description: row.description || '',
      price: row.hide_price ? null : row.sale_price || 0,
      icon: 'wrench',
      color: 'blue',
      benefits: ['Garantía escrita', 'Atención profesional'],
      category: categoryName(row.category) || 'Servicios Técnicos',
      active: true,
      source: 'inventory' as const,
      ...(serviceCoverUrl(row) ? { imageUrl: serviceCoverUrl(row) } : {}),
    }))
}

/**
 * Suma los servicios del catálogo a los cargados en el sitio. Si ya hay uno
 * con el mismo nombre, no se duplica: se le presta la portada si no tiene.
 */
export function mergeInventoryServices(website: Service[], inventory: Service[]): Service[] {
  const merged = [...website]
  const byTitle = new Map(merged.map((service, index) => [(service.title || '').toLowerCase().trim(), index]))
  for (const service of inventory) {
    const index = byTitle.get(service.title.toLowerCase().trim())
    if (index === undefined) {
      byTitle.set(service.title.toLowerCase().trim(), merged.length)
      merged.push(service)
    } else if (!merged[index].imageUrl && service.imageUrl) {
      merged[index] = { ...merged[index], imageUrl: service.imageUrl }
    }
  }
  return merged
}
