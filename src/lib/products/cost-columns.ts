/**
 * Columnas de `products` y `product_variants` que un cliente con la sesión del
 * usuario (navegador o API con `createClient()`) puede leer.
 *
 * Desde S1 Etapa 2b la base retira el SELECT de las columnas de costo
 * (`purchase_price`, `foreign_purchase_price`): un `select('*')` sobre estas
 * tablas falla con `permission denied`. El costo se pide aparte con
 * `get_product_costs` / `get_variant_costs`, que solo lo devuelven a quien
 * tiene `products.read_cost` en esa organización (dueño y administrador
 * incluidos). Sin permiso, el costo llega como `null`.
 *
 * Debe coincidir con supabase/pending-migrations/s1-product-cost/03_cost_column_privileges.sql.
 */
export const PRODUCT_CLIENT_COLUMN_LIST = [
  'id', 'sku', 'name', 'description', 'category_id', 'brand', 'supplier_id',
  'sale_price', 'wholesale_price', 'offer_price', 'has_offer', 'stock_quantity', 'min_stock', 'max_stock',
  'unit_measure', 'barcode', 'images', 'image_url', 'weight', 'dimensions', 'location', 'tags', 'is_active', 'featured',
  'created_at', 'updated_at', 'brand_id', 'visibility', 'warranty_months', 'warranty_info', 'return_window_days',
  'exchange_window_days', 'return_policy', 'exchange_policy', 'stock_status_computed', 'organization_id',
  'installments_enabled', 'installments_plans', 'installments_public', 'deactivated_by_plan', 'archived_by_plan_at',
  'tax_rate', 'has_variants', 'variant_attribute_config', 'device_brand', 'device_models', 'device_sort_key',
  'hide_price', 'price_currency', 'foreign_sale_price', 'foreign_wholesale_price', 'search_text', 'public_price',
] as const

export const VARIANT_CLIENT_COLUMN_LIST = [
  'id', 'product_id', 'variant_name', 'sku', 'price_adjustment', 'stock_quantity', 'is_active', 'created_at', 'updated_at',
  'organization_id', 'attributes', 'barcode', 'sale_price', 'wholesale_price', 'min_stock',
] as const

export const PRODUCT_COST_COLUMN_LIST = ['purchase_price', 'foreign_purchase_price'] as const
export const VARIANT_COST_COLUMN_LIST = ['purchase_price'] as const

/**
 * Reemplazo de `select('*')` sobre `products`. Literal (no `.join`) para que el
 * cliente tipado de Supabase infiera las columnas; una prueba verifica que
 * coincida con PRODUCT_CLIENT_COLUMN_LIST.
 */
export const PRODUCT_CLIENT_COLUMNS = 'id, sku, name, description, category_id, brand, supplier_id, sale_price, wholesale_price, offer_price, has_offer, stock_quantity, min_stock, max_stock, unit_measure, barcode, images, image_url, weight, dimensions, location, tags, is_active, featured, created_at, updated_at, brand_id, visibility, warranty_months, warranty_info, return_window_days, exchange_window_days, return_policy, exchange_policy, stock_status_computed, organization_id, installments_enabled, installments_plans, installments_public, deactivated_by_plan, archived_by_plan_at, tax_rate, has_variants, variant_attribute_config, device_brand, device_models, device_sort_key, hide_price, price_currency, foreign_sale_price, foreign_wholesale_price, search_text, public_price' as const
/** Reemplazo de `product_variants(*)` / `select('*')` sobre variantes. */
export const VARIANT_CLIENT_COLUMNS = 'id, product_id, variant_name, sku, price_adjustment, stock_quantity, is_active, created_at, updated_at, organization_id, attributes, barcode, sale_price, wholesale_price, min_stock' as const

export type ProductCost = { purchase_price: number | null; foreign_purchase_price: number | null }
export type VariantCost = { purchase_price: number | null }

type RpcResult = { data: unknown; error: { message?: string } | null }
/** Lo único que se necesita del cliente de Supabase: evita atar el helper a un tipo generado. */
export type CostRpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult> }

const CHUNK = 1000

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function uniqueIds(ids: Iterable<unknown>): string[] {
  const out = new Set<string>()
  for (const id of ids) if (typeof id === 'string' && id) out.add(id)
  return [...out]
}

async function callCostRpc(client: CostRpcClient, fn: string, idsKey: string, ids: string[], organizationId?: string | null) {
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; offset < ids.length; offset += CHUNK) {
    const args: Record<string, unknown> = { [idsKey]: ids.slice(offset, offset + CHUNK) }
    if (organizationId) args.p_organization_id = organizationId
    const { data, error } = await client.rpc(fn, args)
    if (error) throw new Error(error.message || `No se pudieron obtener los costos (${fn}).`)
    if (Array.isArray(data)) rows.push(...(data as Record<string, unknown>[]))
  }
  return rows
}

/**
 * Costos que el usuario puede ver, por id de producto. Los productos que no
 * aparecen son los que no tiene permiso de ver (o que no existen).
 */
export async function fetchProductCosts(
  client: CostRpcClient,
  productIds: Iterable<unknown>,
  organizationId?: string | null,
): Promise<Map<string, ProductCost>> {
  const ids = uniqueIds(productIds)
  const map = new Map<string, ProductCost>()
  if (ids.length === 0) return map
  for (const row of await callCostRpc(client, 'get_product_costs', 'p_product_ids', ids, organizationId)) {
    map.set(String(row.product_id), {
      purchase_price: toNumber(row.purchase_price),
      foreign_purchase_price: toNumber(row.foreign_purchase_price),
    })
  }
  return map
}

export async function fetchVariantCosts(
  client: CostRpcClient,
  variantIds: Iterable<unknown>,
  organizationId?: string | null,
): Promise<Map<string, VariantCost>> {
  const ids = uniqueIds(variantIds)
  const map = new Map<string, VariantCost>()
  if (ids.length === 0) return map
  for (const row of await callCostRpc(client, 'get_variant_costs', 'p_variant_ids', ids, organizationId)) {
    map.set(String(row.variant_id), { purchase_price: toNumber(row.purchase_price) })
  }
  return map
}

type WithId = { id?: unknown }
export type WithProductCost<T> = T & ProductCost

export type AttachCostOptions = {
  organizationId?: string | null
  /** Clave de las variantes anidadas (p. ej. `variants` o `product_variants`). */
  variantsKey?: string
  /** Si la consulta de costos falla, se deja el costo en null en vez de propagar el error. */
  failSoft?: boolean
}

/**
 * Agrega `purchase_price` y `foreign_purchase_price` a cada producto (y
 * `purchase_price` a sus variantes anidadas) con lo que el usuario puede ver.
 * Sin permiso o sin costo cargado quedan en `null`, nunca en 0.
 */
export async function attachProductCosts<T extends WithId>(
  client: CostRpcClient,
  rows: readonly T[],
  options: AttachCostOptions = {},
): Promise<Array<WithProductCost<T>>> {
  const { organizationId, variantsKey, failSoft = true } = options
  let productCosts = new Map<string, ProductCost>()
  let variantCosts = new Map<string, VariantCost>()
  try {
    productCosts = await fetchProductCosts(client, rows.map(row => row.id), organizationId)
    if (variantsKey) {
      const variantIds = rows.flatMap(row => {
        const nested = (row as Record<string, unknown>)[variantsKey]
        return Array.isArray(nested) ? nested.map(variant => (variant as WithId)?.id) : []
      })
      variantCosts = await fetchVariantCosts(client, variantIds, organizationId)
    }
  } catch (error) {
    if (!failSoft) throw error
  }
  return rows.map(row => {
    const cost = productCosts.get(String(row.id)) ?? { purchase_price: null, foreign_purchase_price: null }
    const next: Record<string, unknown> = { ...row, ...cost }
    if (variantsKey) {
      const nested = (row as Record<string, unknown>)[variantsKey]
      if (Array.isArray(nested)) {
        next[variantsKey] = nested.map(variant => {
          if (!variant || typeof variant !== 'object') return variant
          const id = String((variant as WithId).id)
          return { ...variant, purchase_price: variantCosts.get(id)?.purchase_price ?? null }
        })
      }
    }
    return next as WithProductCost<T>
  })
}

/** Igual que `attachProductCosts` para un solo producto. */
export async function attachProductCost<T extends WithId>(
  client: CostRpcClient,
  row: T,
  options: AttachCostOptions = {},
): Promise<WithProductCost<T>> {
  const [result] = await attachProductCosts(client, [row], options)
  return result
}

type EmbeddedProduct = { id?: unknown; purchase_price?: unknown; foreign_purchase_price?: unknown }

/**
 * Para productos embebidos en otra consulta (`sale_items.product`,
 * `product_movements.product`, …): completa su costo EN EL LUGAR. El embebido
 * tiene que traer `id`. Si la consulta de costos falla, el costo queda en null.
 */
export async function fillEmbeddedProductCosts(
  client: CostRpcClient,
  products: Iterable<EmbeddedProduct | null | undefined>,
  options: Pick<AttachCostOptions, 'organizationId'> = {},
): Promise<void> {
  const list = [...products].filter((p): p is EmbeddedProduct => Boolean(p && typeof p === 'object'))
  let costs = new Map<string, ProductCost>()
  try {
    costs = await fetchProductCosts(client, list.map(p => p.id), options.organizationId)
  } catch {
    costs = new Map()
  }
  for (const product of list) {
    const cost = costs.get(String(product.id))
    product.purchase_price = cost?.purchase_price ?? null
    product.foreign_purchase_price = cost?.foreign_purchase_price ?? null
  }
}

/** Cliente de Supabase tipado (generado) → cliente mínimo que necesitan estos helpers. */
export function asCostRpcClient(client: unknown): CostRpcClient {
  return client as CostRpcClient
}
