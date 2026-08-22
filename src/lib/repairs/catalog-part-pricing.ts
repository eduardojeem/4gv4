interface CatalogPartPricingRow {
  purchase_price?: number | null
  sale_price?: number | null
  wholesale_price?: number | null
}

export function resolveCatalogPartPrice(product: CatalogPartPricingRow, wholesale: boolean) {
  const unitCost = Math.max(0, Number(product.purchase_price) || 0)
  const retailPrice = Math.max(0, Number(product.sale_price) || 0)
  const wholesalePrice = Math.max(0, Number(product.wholesale_price) || 0)
  return {
    unitCost,
    unitPrice: wholesale && wholesalePrice > 0 ? wholesalePrice : retailPrice,
  }
}
