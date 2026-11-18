import type { InstallmentPlanOption, Product, ProductVariantRecord } from '@/types/product-unified'

export type PosProductRow = {
  id: string
  name: string
  sku: string | null
  barcode?: string | null
  sale_price: number
  wholesale_price?: number | null
  offer_price?: number | string | null
  has_offer?: boolean | null
  stock_quantity: number
  category_id: string | null
  categories?: { name: string } | Array<{ name: string }> | null
  description?: string | null
  brand?: string | null
  image_url?: string | null
  images?: string[] | null
  unit_measure?: string | null
  is_active: boolean
  cost_price?: number | null
  installments_enabled?: boolean | null
  installments_public?: boolean | null
  installments_plans?: unknown
  has_variants?: boolean | null
  variants?: unknown
  organization_id?: string | null
  visibility?: Product['visibility']
  hide_price?: boolean | null
  variant_attribute_config?: Product['variant_attribute_config']
  device_brand?: string | null
  device_models?: string[] | null
  warranty_months?: number | null
  warranty_info?: string | null
  return_policy?: string | null
  exchange_policy?: string | null
}

function mapInstallmentPlans(value: unknown): InstallmentPlanOption[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((plan) => {
    if (!plan || typeof plan !== 'object') return []

    const candidate = plan as Record<string, unknown>
    const count = Number(candidate.count)
    const rate = Number(candidate.rate)

    if (!Number.isFinite(count) || !Number.isFinite(rate)) return []
    return [{ count, rate }]
  })
}

export function mapProductForPOS(row: PosProductRow): Product {
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories
  const rawVariants = Array.isArray(row.variants) ? (row.variants as ProductVariantRecord[]) : []
  const hasVariants = Boolean(row.has_variants || rawVariants.length > 0)
  const variantStock = hasVariants && rawVariants.length > 0
    ? (rawVariants as Array<{ is_active?: boolean | null; stock_quantity?: number | null }>).reduce(
        (sum: number, v) => (v.is_active !== false ? sum + Number(v.stock_quantity || 0) : sum),
        0
      )
    : null
  const stockQuantity = hasVariants && variantStock !== null && Number(row.stock_quantity || 0) === 0
    ? variantStock
    : Number(row.stock_quantity || 0)

  return {
    id: row.id,
    name: row.name,
    sku: row.sku || '',
    barcode: row.barcode || null,
    sale_price: Number(row.sale_price),
    wholesale_price: row.wholesale_price == null ? null : Number(row.wholesale_price),
    // Sin estos dos el POS cobraba el precio de lista aunque la tienda mostrara la oferta.
    offer_price: row.offer_price == null ? undefined : Number(row.offer_price),
    has_offer: row.has_offer === true,
    stock_quantity: stockQuantity,
    category_id: row.category_id,
    category: category
      ? { id: row.category_id, name: category.name }
      : undefined,
    description: row.description || null,
    brand: row.brand || null,
    image: (Array.isArray(row.images) && row.images.length > 0 ? row.images[0] : undefined) || row.image_url || undefined,
    image_url: row.image_url || null,
    images: row.images || null,
    unit_measure: row.unit_measure || 'unidad',
    is_active: row.is_active,
    purchase_price: Number(row.cost_price || 0),
    installments_enabled: Boolean(row.installments_enabled),
    installments_public: Boolean(row.installments_public),
    installments_plans: mapInstallmentPlans(row.installments_plans),
    has_variants: hasVariants,
    variants: rawVariants,
    organization_id: row.organization_id ?? null,
    visibility: row.visibility,
    hide_price: row.hide_price,
    variant_attribute_config: row.variant_attribute_config,
    device_brand: row.device_brand,
    device_models: row.device_models,
    warranty_months: row.warranty_months ?? null,
    warranty_info: row.warranty_info ?? null,
    return_policy: row.return_policy ?? null,
    exchange_policy: row.exchange_policy ?? null,
  } as Product
}
