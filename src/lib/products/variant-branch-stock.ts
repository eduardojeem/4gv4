import type { createAdminSupabase } from '@/lib/supabase/admin'

/** The delta is applied to one branch, so its starting stock must use that branch. */
export async function loadVariantBranchStock(client: ReturnType<typeof createAdminSupabase>, organizationId: string, branchId: string, variantIds: string[]) {
  if (!variantIds.length) return new Map<string, number>()
  const { data, error } = await client.from('branch_variant_inventory')
    .select('variant_id, stock_quantity')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .in('variant_id', variantIds)
  if (error) throw new Error('No se pudo verificar el stock de variantes en la sucursal seleccionada.')
  return new Map((data ?? []).map(row => [String(row.variant_id), Number(row.stock_quantity ?? 0)]))
}

/** Opt-in edit projection; list/detail consumers keep their aggregate stock. */
export function applyVariantBranchStock<T extends { id: string; stock_quantity?: number | null }>(rows: T[], stock: ReadonlyMap<string, number>): T[] {
  return rows.map(row => ({ ...row, stock_quantity: stock.get(row.id) ?? 0 }))
}
