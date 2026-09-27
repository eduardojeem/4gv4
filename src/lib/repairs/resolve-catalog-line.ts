import { isServiceLikeProduct } from '@/lib/products/is-service-like'
import { resolveCatalogPartPrice } from './catalog-part-pricing'

type CatalogRepairProduct = {
  id: string
  name: string
  sku?: string | null
  unit_measure?: string | null
  purchase_price?: number | null
  sale_price?: number | null
  offer_price?: number | null
  wholesale_price?: number | null
  tax_rate?: number | null
  category?: { name?: string | null } | Array<{ name?: string | null }> | null
}

export function resolveCatalogRepairLines(
  product: CatalogRepairProduct,
  customerIsWholesale: boolean,
  quantity: number,
) {
  const pricing = resolveCatalogPartPrice(product, customerIsWholesale)
  const normalizedQuantity = Math.max(1, Math.trunc(Number(quantity) || 1))
  const taxRate = [0, 5, 10].includes(Number(product.tax_rate))
    ? Number(product.tax_rate) as 0 | 5 | 10
    : 10

  const category = Array.isArray(product.category) ? product.category[0] ?? null : product.category
  if (isServiceLikeProduct({ ...product, category })) {
    const serviceLine = {
      product_id: product.id,
      part_name: product.name,
      part_number: product.sku ?? null,
      supplier: null,
      quantity: normalizedQuantity,
      unit_price: pricing.unitPrice,
      unit_cost: 0,
      line_type: 'service' as const,
      discount_amount: 0,
      tax_rate: taxRate,
    }
    if (pricing.unitCost <= 0) return [serviceLine]

    return [serviceLine, {
      product_id: null,
      part_name: `Material incluido · ${product.name}`,
      part_number: product.sku ?? null,
      supplier: null,
      quantity: normalizedQuantity,
      unit_price: 0,
      unit_cost: pricing.unitCost,
      line_type: 'included_material' as const,
      discount_amount: 0,
      tax_rate: taxRate,
    }]
  }

  return [{
    product_id: product.id,
    part_name: product.name,
    part_number: product.sku ?? null,
    supplier: null,
    quantity: normalizedQuantity,
    unit_price: pricing.unitPrice,
    unit_cost: pricing.unitCost,
    line_type: 'charged_part' as const,
    discount_amount: 0,
    tax_rate: taxRate,
  }]
}
