import type { RepairCatalogItem } from './types'

export function catalogItemPrice(item: RepairCatalogItem, wholesale: boolean) {
  if (wholesale && item.wholesale_price) return item.wholesale_price
  return item.offer_price || item.sale_price || 0
}

export function toRepairPart(item: RepairCatalogItem, wholesale: boolean) {
  return {
    name: item.name,
    cost: catalogItemPrice(item, wholesale),
    internalCost: item.purchase_price ?? undefined,
    quantity: 1,
    stockAvailable: item.stock_quantity ?? null,
    supplier: 'Inventario Local',
    partNumber: item.sku || '',
    productId: item.id,
  }
}
