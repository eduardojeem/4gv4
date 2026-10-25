export interface DetailVariant {
  id: string; name: string; sku: string; barcode?: string; salePrice: number
  purchasePrice?: number | null; wholesalePrice?: number; stockQuantity: number
  minStock?: number; isActive: boolean; attributes: Record<string, string>
}
export interface DetailFilters { search: string; stock: string; status: string; attributes: Record<string, string> }
export function summarizeVariants(variants: DetailVariant[]) {
  return { total: variants.length, active: variants.filter(v => v.isActive).length,
    outOfStock: variants.filter(v => v.stockQuantity <= 0).length,
    stock: variants.reduce((sum, v) => sum + v.stockQuantity, 0) }
}
export function filterDetailVariants(variants: DetailVariant[], filters: DetailFilters) {
  const query = filters.search.trim().toLocaleLowerCase()
  return variants.filter(v => (!query || [v.name, v.sku, ...Object.values(v.attributes)].join(' ').toLocaleLowerCase().includes(query))
    && (filters.stock === 'all' || (filters.stock === 'in_stock' ? v.stockQuantity > 0 : v.stockQuantity <= 0))
    && (filters.status === 'all' || v.isActive === (filters.status === 'active'))
    && Object.entries(filters.attributes).every(([key, value]) => !value || v.attributes[key] === value))
}
