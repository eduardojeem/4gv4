interface CatalogPartPricingRow {
  purchase_price?: number | null
  sale_price?: number | null
  offer_price?: number | null
  wholesale_price?: number | null
}

export function resolveCatalogPartPrice(product: CatalogPartPricingRow, wholesale: boolean) {
  const unitCost = Math.max(0, Number(product.purchase_price) || 0)
  const salePrice = Math.max(0, Number(product.sale_price) || 0)
  const offerPrice = Math.max(0, Number(product.offer_price) || 0)
  const retailPrice = offerPrice > 0 ? offerPrice : salePrice
  const wholesalePrice = Math.max(0, Number(product.wholesale_price) || 0)
  return {
    unitCost,
    unitPrice: wholesale && wholesalePrice > 0 ? wholesalePrice : retailPrice,
  }
}
