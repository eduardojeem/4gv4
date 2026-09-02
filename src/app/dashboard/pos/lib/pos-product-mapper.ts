import type { InstallmentPlanOption, Product } from '@/types/product-unified'

export type PosProductRow = {
  id: string
  name: string
  sku: string | null
  barcode?: string | null
  sale_price: number
  wholesale_price?: number | null
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

  return {
    id: row.id,
    name: row.name,
    sku: row.sku || '',
    barcode: row.barcode || null,
    sale_price: Number(row.sale_price),
    wholesale_price: row.wholesale_price == null ? null : Number(row.wholesale_price),
    stock_quantity: Number(row.stock_quantity),
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
  } as Product
}
