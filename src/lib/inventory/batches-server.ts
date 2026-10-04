import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_TIMEZONE, todayIn } from '@/lib/agenda/time'
import { estimateBatches, type EstimatedBatch, type ProductBatch } from '@/lib/inventory/batches'

export const BATCH_COLUMNS = 'id, product_id, variant_id, lot_code, expires_on, quantity, received_on, notes, discarded_at, discarded_reason'

const MISSING_TABLE = /does not exist|could not find|schema cache/i

export function isMissingBatchesTable(error: { message?: string } | null | undefined) {
  return Boolean(error?.message && MISSING_TABLE.test(error.message))
}

/** Hoy en la zona horaria de la empresa (el servidor está en UTC). */
export async function organizationToday(supabase: SupabaseClient, organizationId: string) {
  const { data } = await supabase.from('organization_settings').select('timezone').eq('organization_id', organizationId).maybeSingle()
  return todayIn((data as { timezone?: string | null } | null)?.timezone || DEFAULT_TIMEZONE)
}

export type BatchWithProduct = EstimatedBatch<ProductBatch> & { product_name: string; variant_name: string | null; stock: number }

/**
 * Lotes con lo que se estima que queda de cada uno. Se estima por producto (o
 * por variante, si el lote es de una variante) contra su stock actual.
 */
export async function loadEstimatedBatches(
  supabase: SupabaseClient,
  organizationId: string,
  options: { productId?: string; includeDiscarded?: boolean } = {},
): Promise<{ batches: BatchWithProduct[]; today: string } | { missing: true }> {
  let query = supabase.from('product_batches').select(BATCH_COLUMNS).eq('organization_id', organizationId).order('expires_on').limit(5000)
  if (options.productId) query = query.eq('product_id', options.productId)
  if (!options.includeDiscarded) query = query.is('discarded_at', null)
  const [{ data, error }, today] = await Promise.all([query, organizationToday(supabase, organizationId)])
  if (error) {
    if (isMissingBatchesTable(error)) return { missing: true }
    throw new Error(error.message)
  }
  const rows = (data ?? []) as ProductBatch[]
  if (rows.length === 0) return { batches: [], today }

  const productIds = [...new Set(rows.map((row) => row.product_id))]
  const variantIds = [...new Set(rows.map((row) => row.variant_id).filter((id): id is string => Boolean(id)))]
  const [{ data: products }, { data: variants }] = await Promise.all([
    supabase.from('products').select('id, name, stock_quantity').eq('organization_id', organizationId).in('id', productIds),
    variantIds.length
      ? supabase.from('product_variants').select('id, variant_name, stock_quantity').eq('organization_id', organizationId).in('id', variantIds)
      : Promise.resolve({ data: [] as Array<{ id: string; variant_name: string; stock_quantity: number }> }),
  ])
  const productById = new Map(((products ?? []) as Array<{ id: string; name: string; stock_quantity: number | null }>).map((row) => [row.id, row]))
  const variantById = new Map(((variants ?? []) as Array<{ id: string; variant_name: string; stock_quantity: number | null }>).map((row) => [row.id, row]))

  const groups = new Map<string, ProductBatch[]>()
  for (const row of rows) {
    const key = `${row.product_id}:${row.variant_id ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const batches: BatchWithProduct[] = []
  for (const group of groups.values()) {
    const { product_id: productId, variant_id: variantId } = group[0]
    const product = productById.get(productId)
    const variant = variantId ? variantById.get(variantId) : null
    const stock = Number((variant ?? product)?.stock_quantity ?? 0)
    for (const batch of estimateBatches(group, stock, today)) {
      batches.push({ ...batch, product_name: product?.name ?? 'Producto', variant_name: variant?.variant_name ?? null, stock })
    }
  }
  batches.sort((a, b) => a.expires_on.localeCompare(b.expires_on))
  return { batches, today }
}
