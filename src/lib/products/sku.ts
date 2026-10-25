/** Must agree with the database's organization_id + lower(trim(sku)) key. */
export const normalizeSku = (sku: string): string => sku.trim().toLowerCase()

export type SkuMatch = { id: string; name: string | null; sku: string | null }
export type SkuLookupClient = {
  rpc: (name: 'find_product_sku_conflict', args: {
    p_organization_id: string; p_sku: string; p_exclude_id: string | null
  }) => PromiseLike<{ data: SkuMatch[] | null; error: { message: string } | null }>
}

/** Parameterized, exact comparison: '_' in a SKU is never a wildcard. RLS applies. */
export async function findProductSku(client: SkuLookupClient, organizationId: string, sku: string, excludeId?: string): Promise<SkuMatch | null> {
  const { data, error } = await client.rpc('find_product_sku_conflict', {
    p_organization_id: organizationId, p_sku: normalizeSku(sku), p_exclude_id: excludeId ?? null,
  })
  if (error) throw new Error(error.message)
  return data?.[0] ?? null
}
