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
    lineType: 'charged_part' as const,
  }
}

export function toRepairServiceLines(item: RepairCatalogItem, wholesale: boolean) {
  const serviceLine = {
    name: item.name,
    cost: catalogItemPrice(item, wholesale),
    internalCost: 0,
    quantity: 1,
    stockAvailable: null,
    supplier: 'Catálogo de servicios',
    partNumber: item.sku || '',
    productId: item.id,
    lineType: 'service' as const,
  }
  const includedMaterialCost = Math.max(0, Number(item.purchase_price) || 0)
  if (includedMaterialCost === 0) return [serviceLine]

  return [serviceLine, {
    name: `Material incluido · ${item.name}`,
    cost: 0,
    internalCost: includedMaterialCost,
    quantity: 1,
    stockAvailable: null,
    supplier: 'Incluido en el servicio',
    partNumber: item.sku || '',
    productId: null,
    lineType: 'included_material' as const,
  }]
}
