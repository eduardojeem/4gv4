import type { createClient } from '@/lib/supabase/server'
import type { createAdminSupabase } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'

type Client = Awaited<ReturnType<typeof createClient>>
type CostClient = ReturnType<typeof createAdminSupabase>
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

type ProductRow = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  purchase_price: number | null
  unit_measure: string | null
  has_variants: boolean | null
  categories: { name: string } | Array<{ name: string }> | null
}
type VariantRow = { id: string; product_id: string; variant_name: string; sku: string | null; barcode: string | null; purchase_price: number | null }

/** A count must persist a real snapshot; missing privileged data is not zero. */
export function resolveCountUnitCost(variantCost: number | null | undefined, productCost: number | null | undefined): number {
  const value = variantCost ?? productCost
  if (value == null || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new Error('COUNT_COST_UNAVAILABLE')
  }
  return Number(value)
}

export type NewCountItem = {
  product_id: string
  variant_id: string | null
  name: string
  sku: string | null
  barcode: string | null
  category_name: string | null
  unit_cost: number
  system_qty: number
}

/**
 * Lo que hay que contar en la sucursal: cada producto activo (o cada variante
 * activa, si el producto tiene variantes) con el stock que el sistema tiene
 * en este momento. Los servicios no se cuentan.
 *
 * El costo unitario queda guardado en la toma (lo usa la valorización), así que
 * tiene que ser el real aunque quien la abre no pueda ver costos: desde S1 la
 * sesión del usuario ya no lee esas columnas y el costo sale de `costClient`
 * (servicio), acotado a la organización. La respuesta lo oculta según el permiso.
 */
export async function buildCountItems(supabase: Client, organizationId: string, branchId: string, categoryId: string | null, costClient: CostClient): Promise<NewCountItem[]> {
  const products = await fetchAllRows<ProductRow>((from, to) => {
    let query = supabase
      .from('products')
      .select('id, name, sku, barcode, unit_measure, has_variants, categories(name)')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name')
      .range(from, to)
    if (categoryId) query = query.eq('category_id', categoryId)
    return query as unknown as Page<ProductRow>
  })
  const countable = products.filter((product) => (product.unit_measure ?? '').toLowerCase() !== 'servicio')
  if (countable.length === 0) return []

  const [stockRows, variants, variantStockRows] = await Promise.all([
    fetchAllRows<{ product_id: string; stock_quantity: number }>((from, to) =>
      supabase.from('branch_inventory').select('product_id, stock_quantity').eq('branch_id', branchId).range(from, to) as unknown as Page<{ product_id: string; stock_quantity: number }>),
    fetchAllRows<VariantRow>((from, to) =>
      supabase
        .from('product_variants')
        .select('id, product_id, variant_name, sku, barcode')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .range(from, to) as unknown as Page<VariantRow>),
    fetchAllRows<{ variant_id: string; stock_quantity: number }>((from, to) =>
      supabase
        .from('branch_variant_inventory')
        .select('variant_id, stock_quantity')
        .eq('organization_id', organizationId)
        .eq('branch_id', branchId)
        .range(from, to) as unknown as Page<{ variant_id: string; stock_quantity: number }>),
  ])

  const [productCostRows, variantCostRows] = await Promise.all([
    fetchAllRows<{ id: string; purchase_price: number | null }>((from, to) =>
      costClient.from('products').select('id, purchase_price').eq('organization_id', organizationId).eq('is_active', true).order('id').range(from, to) as unknown as Page<{ id: string; purchase_price: number | null }>),
    fetchAllRows<{ id: string; purchase_price: number | null }>((from, to) =>
      costClient.from('product_variants').select('id, purchase_price').eq('organization_id', organizationId).eq('is_active', true).order('id').range(from, to) as unknown as Page<{ id: string; purchase_price: number | null }>),
  ])
  const productCost = new Map(productCostRows.map((row) => [row.id, row.purchase_price]))
  const variantCost = new Map(variantCostRows.map((row) => [row.id, row.purchase_price]))
  for (const product of countable) product.purchase_price = productCost.get(product.id) ?? null
  for (const variant of variants) variant.purchase_price = variantCost.get(variant.id) ?? null

  const stock = new Map(stockRows.map((row) => [row.product_id, Number(row.stock_quantity) || 0]))
  const variantStock = new Map(variantStockRows.map((row) => [row.variant_id, Number(row.stock_quantity) || 0]))
  const variantsByProduct = new Map<string, VariantRow[]>()
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.product_id) ?? []
    list.push(variant)
    variantsByProduct.set(variant.product_id, list)
  }

  return countable.flatMap((product) => {
    const category = Array.isArray(product.categories) ? product.categories[0]?.name ?? null : product.categories?.name ?? null
    const productVariants = product.has_variants ? variantsByProduct.get(product.id) ?? [] : []
    if (productVariants.length > 0) {
      return productVariants.map((variant) => ({
        product_id: product.id,
        variant_id: variant.id,
        name: `${product.name} — ${variant.variant_name}`,
        sku: variant.sku || product.sku,
        barcode: variant.barcode || null,
        category_name: category,
        unit_cost: resolveCountUnitCost(variant.purchase_price, product.purchase_price),
        system_qty: variantStock.get(variant.id) ?? 0,
      }))
    }
    return [{
      product_id: product.id,
      variant_id: null,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      category_name: category,
      unit_cost: resolveCountUnitCost(undefined, product.purchase_price),
      system_qty: stock.get(product.id) ?? 0,
    }]
  })
}

/** Stock que tiene el sistema ahora para cada ítem: la base para medir la diferencia. */
export async function currentStock(
  supabase: Client,
  organizationId: string,
  branchId: string,
  items: Array<{ id: string; product_id: string; variant_id: string | null }>,
): Promise<Map<string, number>> {
  const productIds = items.filter((item) => !item.variant_id).map((item) => item.product_id)
  const variantIds = items.filter((item) => item.variant_id).map((item) => item.variant_id as string)
  const [products, variants] = await Promise.all([
    productIds.length
      ? supabase.from('branch_inventory').select('product_id, stock_quantity').eq('branch_id', branchId).in('product_id', productIds)
      : Promise.resolve({ data: [] as Array<{ product_id: string; stock_quantity: number }> }),
    variantIds.length
      ? supabase.from('branch_variant_inventory').select('variant_id, stock_quantity').eq('organization_id', organizationId).eq('branch_id', branchId).in('variant_id', variantIds)
      : Promise.resolve({ data: [] as Array<{ variant_id: string; stock_quantity: number }> }),
  ])
  const byProduct = new Map(((products.data ?? []) as Array<{ product_id: string; stock_quantity: number }>).map((row) => [row.product_id, Number(row.stock_quantity) || 0]))
  const byVariant = new Map(((variants.data ?? []) as Array<{ variant_id: string; stock_quantity: number }>).map((row) => [row.variant_id, Number(row.stock_quantity) || 0]))
  return new Map(items.map((item) => [item.id, item.variant_id ? byVariant.get(item.variant_id) ?? 0 : byProduct.get(item.product_id) ?? 0]))
}
