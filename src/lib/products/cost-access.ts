import type { createAdminSupabase } from '@/lib/supabase/admin'

export const PRODUCT_READ_COST_PERMISSION = 'products.read_cost'
export const PRODUCT_UPDATE_COST_PERMISSION = 'products.update_cost'
export type ProductCostAccess = { canReadCost: boolean; canWriteCost: boolean }
type Client = ReturnType<typeof createAdminSupabase>
export class ProductCostInputError extends Error {}

/** Verify membership and grants in the target organization. Global roles grant nothing here. */
export async function resolveOrganizationProductCostAccess(
  client: Client,
  scope: { userId: string; organizationId: string; organizationRole?: string },
): Promise<ProductCostAccess> {
  const membership = await client.from('organization_members').select('role')
    .eq('user_id', scope.userId).eq('organization_id', scope.organizationId)
    .eq('status', 'active').maybeSingle()
  if (membership.error) throw new Error('No se pudieron verificar los permisos de costos.')
  if (!membership.data) return { canReadCost: false, canWriteCost: false }
  if (['owner', 'admin'].includes(membership.data.role)) return { canReadCost: true, canWriteCost: true }

  const { data, error } = await client.from('user_permissions').select('permission')
    .eq('user_id', scope.userId).eq('organization_id', scope.organizationId).eq('is_active', true)
    .in('permission', [PRODUCT_READ_COST_PERMISSION, PRODUCT_UPDATE_COST_PERMISSION])
  if (error) throw new Error('No se pudieron verificar los permisos de costos.')
  const grants = new Set((data ?? []).map(row => row.permission))
  return { canReadCost: grants.has(PRODUCT_READ_COST_PERMISSION), canWriteCost: grants.has(PRODUCT_UPDATE_COST_PERMISSION) }
}

const fields = ['purchase_price', 'purchasePrice', 'foreign_purchase_price', 'cost_price']

export function redactProductCosts<T extends Record<string, unknown>>(
  product: T,
  access: Pick<ProductCostAccess, 'canReadCost'>,
): T {
  if (access.canReadCost) return product
  const copy: Record<string, unknown> = { ...product }
  for (const field of fields) delete copy[field]
  if (Array.isArray(copy.variants)) {
    copy.variants = copy.variants.map(row => row && typeof row === 'object' ? redactProductCosts(row, access) : row)
  }
  return copy as T
}

export function hasExplicitProductCost(input: Record<string, unknown>): boolean {
  return fields.some(field => input[field] !== undefined && input[field] !== null)
    || (Array.isArray(input.variants) && input.variants.some(row => row && typeof row === 'object' && hasExplicitProductCost(row)))
}

export function normalizeUnknownProductCosts(input: Record<string, unknown>, creating: boolean): Record<string, unknown> {
  const result = { ...input }
  for (const field of fields) {
    if (result[field] === null || result[field] === undefined) delete result[field]
  }
  if (Array.isArray(result.variants)) {
    result.variants = result.variants.map(row => row && typeof row === 'object' ? normalizeUnknownProductCosts(row, false) : row)
  }
  if (creating && result.purchase_price === undefined) result.purchase_price = 0
  return result
}

/** Hydrate omitted variant costs from the same product and tenant; reject unrelated variant IDs. */
export async function prepareProductCostInput(
  client: Client,
  input: Record<string, unknown>,
  organizationId: string,
  productId?: string,
): Promise<Record<string, unknown>> {
  const result = normalizeUnknownProductCosts(input, !productId)
  if (!Array.isArray(result.variants)) return result
  const ids = result.variants.filter(row => row && typeof row === 'object' && row.id).map(row => row.id as string)
  const costs = new Map<string, number>()
  if (ids.length) {
    if (!productId) throw new ProductCostInputError('Las variantes nuevas no pueden usar IDs existentes.')
    const { data, error } = await client.from('product_variants').select('id,purchase_price')
      .eq('organization_id', organizationId).eq('product_id', productId).in('id', ids)
    if (error) throw new Error('No se pudieron verificar los costos de variantes.')
    for (const row of data ?? []) costs.set(row.id, row.purchase_price)
    if (ids.some(id => !costs.has(id))) throw new ProductCostInputError('La variante no pertenece al producto de esta organización.')
  }
  result.variants = result.variants.map(row => {
    if (!row || typeof row !== 'object') return row
    const variant = normalizeUnknownProductCosts(row, false)
    if (variant.purchasePrice === undefined) {
      variant.purchasePrice = variant.purchase_price ?? (variant.id ? costs.get(String(variant.id)) : 0)
    }
    delete variant.purchase_price
    return variant
  })
  return result
}

/** A currency change can indirectly change or erase a foreign purchase cost in the database trigger. */
export async function changesForeignCostCurrency(
  client: Client,
  input: Record<string, unknown>,
  organizationId: string,
  productId?: string,
): Promise<boolean> {
  if (!productId || !Object.prototype.hasOwnProperty.call(input, 'price_currency')) return false
  const { data, error } = await client.from('products')
    .select('price_currency,foreign_purchase_price')
    .eq('id', productId).eq('organization_id', organizationId).maybeSingle()
  if (error) throw new Error('No se pudo verificar la moneda del costo.')
  if (data?.foreign_purchase_price === null || data?.foreign_purchase_price === undefined) return false
  const normalize = (value: unknown) => typeof value === 'string' ? value.trim().toUpperCase() : null
  return normalize(input.price_currency) !== normalize(data.price_currency)
}

const costKeys = new Set(['unit_cost', 'unitCost', 'value_difference', 'valueDifference', 'stockCostValue', 'weightedMargin', 'purchase_price'])

/**
 * Oculta, en cualquier respuesta, las claves que son costo o se derivan de él (costo
 * unitario, valor de la diferencia de una toma, valor del stock al costo, margen).
 * Recorre objetos y listas anidados; quien puede leer costos recibe todo igual.
 */
export function redactCostFields<T>(value: T, access: Pick<ProductCostAccess, 'canReadCost'>): T {
  if (access.canReadCost) return value
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (!node || typeof node !== 'object') return node
    const copy: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      if (costKeys.has(key)) continue
      copy[key] = walk(item)
    }
    return copy
  }
  return walk(value) as T
}

/**
 * Para rutas que leen productos con la sesión del usuario (RLS) y que, desde S1
 * Etapa 2b, ya no pueden pedir las columnas de costo: completa `purchase_price` y
 * `foreign_purchase_price` (y el `purchase_price` de las variantes anidadas en
 * `variantsKey`) desde el cliente de servicio, acotado a la organización. Las
 * filas siguen siendo las que la RLS dejó ver; la respuesta se oculta después
 * con `redactProductCosts` según el permiso, igual que antes.
 */
export async function hydrateProductCostsFromService<T extends { id?: unknown }>(
  client: Client,
  organizationId: string,
  rows: T[],
  variantsKey?: string,
): Promise<T[]> {
  const productIds = [...new Set(rows.map(row => row?.id).filter((id): id is string => typeof id === 'string'))]
  if (productIds.length === 0) return rows
  const { data, error } = await client.from('products')
    .select('id,purchase_price,foreign_purchase_price')
    .eq('organization_id', organizationId).in('id', productIds)
  if (error) throw new Error('No se pudieron leer los costos de los productos.')
  const productCosts = new Map((data ?? []).map(row => [String(row.id), row]))
  const variantCosts = new Map<string, number | null>()
  if (variantsKey) {
    const variantIds = rows.flatMap(row => {
      const nested = (row as Record<string, unknown>)[variantsKey]
      return Array.isArray(nested) ? nested.map(variant => (variant as { id?: unknown })?.id).filter((id): id is string => typeof id === 'string') : []
    })
    if (variantIds.length) {
      const variants = await client.from('product_variants').select('id,purchase_price')
        .eq('organization_id', organizationId).in('id', [...new Set(variantIds)])
      if (variants.error) throw new Error('No se pudieron leer los costos de las variantes.')
      for (const row of variants.data ?? []) variantCosts.set(String(row.id), row.purchase_price)
    }
  }
  return rows.map(row => {
    const cost = productCosts.get(String(row.id))
    const next: Record<string, unknown> = {
      ...row,
      purchase_price: cost?.purchase_price ?? null,
      foreign_purchase_price: cost?.foreign_purchase_price ?? null,
    }
    if (variantsKey && Array.isArray(next[variantsKey])) {
      next[variantsKey] = (next[variantsKey] as unknown[]).map(variant => variant && typeof variant === 'object'
        ? { ...variant, purchase_price: variantCosts.get(String((variant as { id?: unknown }).id)) ?? null }
        : variant)
    }
    return next as T
  })
}

/**
 * Variantes leídas con la sesión del usuario junto a su producto embebido
 * (`product:products(...)`): completa `purchase_price` de la variante y del
 * producto desde el cliente de servicio, acotado a la organización.
 */
export async function hydrateVariantCostsFromService<T extends { id?: unknown; product_id?: unknown; product?: unknown }>(
  client: Client,
  organizationId: string,
  rows: T[],
): Promise<T[]> {
  const variantIds = [...new Set(rows.map(row => row?.id).filter((id): id is string => typeof id === 'string'))]
  const productIds = [...new Set(rows.map(row => row?.product_id).filter((id): id is string => typeof id === 'string'))]
  if (variantIds.length === 0) return rows
  const [variants, products] = await Promise.all([
    client.from('product_variants').select('id,purchase_price').eq('organization_id', organizationId).in('id', variantIds),
    productIds.length
      ? client.from('products').select('id,purchase_price').eq('organization_id', organizationId).in('id', productIds)
      : Promise.resolve({ data: [] as Array<{ id: string; purchase_price: number | null }>, error: null }),
  ])
  if (variants.error || products.error) throw new Error('No se pudieron leer los costos de las variantes.')
  const variantCost = new Map((variants.data ?? []).map(row => [String(row.id), row.purchase_price]))
  const productCost = new Map((products.data ?? []).map(row => [String(row.id), row.purchase_price]))
  return rows.map(row => {
    const embedded = row.product
    const product = Array.isArray(embedded) ? embedded[0] : embedded
    return {
      ...row,
      purchase_price: variantCost.get(String(row.id)) ?? null,
      product: product && typeof product === 'object'
        ? { ...(product as Record<string, unknown>), purchase_price: productCost.get(String(row.product_id)) ?? null }
        : embedded,
    } as T
  })
}
