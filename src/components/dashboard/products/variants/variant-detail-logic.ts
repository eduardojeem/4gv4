export interface DetailVariant {
  id: string; name: string; sku: string; barcode?: string; salePrice: number
  purchasePrice?: number | null; wholesalePrice?: number; stockQuantity: number
  minStock?: number; isActive: boolean; attributes: Record<string, string>
}
export type VariantStockStatus = 'out_of_stock' | 'low_stock' | 'in_stock'
export function getVariantStockStatus(quantity: number, minimum: number | null | undefined): VariantStockStatus {
  if (quantity <= 0) return 'out_of_stock'
  if (quantity <= Number(minimum ?? 0)) return 'low_stock'
  return 'in_stock'
}
export interface DetailFilters { search: string; stock: string; status: string; attributes: Record<string, string> }
export function summarizeVariants(variants: DetailVariant[]) {
  const active = variants.filter(v => v.isActive)
  return {
    total: variants.length,
    active: active.length,
    outOfStock: active.filter(v => getVariantStockStatus(v.stockQuantity, v.minStock) === 'out_of_stock').length,
    lowStock: active.filter(v => getVariantStockStatus(v.stockQuantity, v.minStock) === 'low_stock').length,
    inStock: active.filter(v => getVariantStockStatus(v.stockQuantity, v.minStock) === 'in_stock').length,
    stock: active.reduce((sum, v) => sum + v.stockQuantity, 0),
  }
}
export function filterDetailVariants(variants: DetailVariant[], filters: DetailFilters) {
  const query = filters.search.trim().toLocaleLowerCase()
  return variants.filter(v => (!query || [v.name, v.sku, ...Object.values(v.attributes)].join(' ').toLocaleLowerCase().includes(query))
    && (filters.stock === 'all' || (filters.stock === 'in_stock' ? v.stockQuantity > 0 : v.stockQuantity <= 0))
    && (filters.status === 'all' || v.isActive === (filters.status === 'active'))
    && Object.entries(filters.attributes).every(([key, value]) => !value || v.attributes[key] === value))
}
