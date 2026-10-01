/**
 * Lo que el bot lee del catálogo. Las mismas reglas que la tienda pública:
 * tienda con `storefront_public`, producto activo y con visibilidad `public`,
 * y el precio oculto se respeta. El bot usa la service role, así que nada de
 * esto lo cuida RLS: si un filtro falta acá, el producto se filtra a Telegram.
 */

import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { productsHaveHidePriceColumn } from '@/lib/products/price-visibility'
import { PAGE_SIZE, type BotCategory, type BotProduct, type BotStore, type StoreContact } from '@/lib/telegram/messages'

type Admin = ReturnType<typeof createAdminSupabase>

const STORE_FIELDS = 'id, name, slug'
const PRODUCT_FIELDS = 'id, name, brand, description, sale_price, offer_price, has_offer, stock_quantity, image_url, images'

/** Términos de búsqueda sin los caracteres que rompen el filtro `or` de PostgREST. */
export function searchTerms(query: string): string[] {
  return query
    .replace(/[.,()!<>=&|%:*\\"'`]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .slice(0, 5)
}

function toStore(row: unknown): BotStore | null {
  const org = (Array.isArray(row) ? row[0] : row) as Partial<BotStore> | null
  return org?.id && org.slug ? { id: org.id, name: org.name || org.slug, slug: org.slug } : null
}

function toProducts(rows: unknown[] | null): BotProduct[] {
  return (rows ?? []).flatMap((row) => {
    const { organizations, ...product } = row as Record<string, unknown>
    const store = toStore(organizations)
    return store ? [{ ...(product as Omit<BotProduct, 'store'>), store }] : []
  })
}

// ── Tiendas ────────────────────────────────────────────────────────────────

async function publicStoreBy(admin: Admin, column: 'id' | 'slug', value: string): Promise<BotStore | null> {
  const { data } = await admin
    .from('organizations')
    .select(STORE_FIELDS)
    .eq(column, value)
    .eq('storefront_public', true)
    .maybeSingle()
  return toStore(data)
}

/** La tienda fija del bot (TELEGRAM_ORG_ID o TELEGRAM_ORG_SLUG), si es pública. */
export async function defaultStore(admin: Admin): Promise<BotStore | null> {
  const id = process.env.TELEGRAM_ORG_ID?.trim()
  if (id) return publicStoreBy(admin, 'id', id)
  const slug = process.env.TELEGRAM_ORG_SLUG?.trim()
  if (slug) return publicStoreBy(admin, 'slug', slug)
  return null
}

export function storeById(admin: Admin, id: string) {
  return publicStoreBy(admin, 'id', id)
}

export function storeBySlug(admin: Admin, slug: string) {
  return publicStoreBy(admin, 'slug', slug.toLowerCase())
}

/**
 * Tiendas del marketplace. Sin texto, las que tienen catálogo; con texto,
 * las que coinciden por nombre o slug.
 */
export async function listStores(admin: Admin, term?: string, limit = 8): Promise<BotStore[]> {
  let query = admin
    .from('organizations')
    .select(STORE_FIELDS)
    .eq('marketplace_public', true)
    .eq('storefront_public', true)
  const words = term ? searchTerms(term) : []
  for (const word of words) query = query.or(`name.ilike.%${word}%,slug.ilike.%${word}%`)
  const { data, error } = await query.order('name', { ascending: true }).limit(limit)
  if (error) logger.warn('[telegram] no se pudieron listar las tiendas', { error: error.message })
  return (data ?? []).flatMap((row) => toStore(row) ?? [])
}

// ── Tienda elegida por chat ────────────────────────────────────────────────
// La tabla `telegram_chats` llega con una migración: hasta que se aplique, el
// bot funciona igual pero no recuerda la elección entre mensajes.

export async function chatStore(admin: Admin, chatId: number): Promise<{ store: BotStore | null; chosen: boolean }> {
  const { data, error } = await admin
    .from('telegram_chats')
    .select('organization_id')
    .eq('chat_id', chatId)
    .maybeSingle()
  if (!error && data) {
    // Fila con organization_id null = eligió «todas las tiendas».
    const orgId = (data as { organization_id: string | null }).organization_id
    const store = orgId ? await storeById(admin, orgId) : null
    // Si la tienda dejó de ser pública, vuelve a la tienda por defecto.
    if (!orgId || store) return { store, chosen: true }
  }
  return { store: await defaultStore(admin), chosen: false }
}

export async function rememberChatStore(admin: Admin, chatId: number, store: BotStore | null): Promise<boolean> {
  const { error } = await admin
    .from('telegram_chats')
    .upsert({ chat_id: chatId, organization_id: store?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' })
  if (error) logger.warn('[telegram] no se pudo guardar la tienda del chat', { error: error.message })
  return !error
}

// ── Productos ──────────────────────────────────────────────────────────────

/** Los campos del producto; `hide_price` sólo si la migración ya está. */
async function productFields(admin: Admin): Promise<string> {
  const hidePrice = await productsHaveHidePriceColumn(admin)
  return `${PRODUCT_FIELDS}${hidePrice ? ', hide_price' : ''}, organizations!inner(${STORE_FIELDS})`
}

// Sin `async`: el query builder es «thenable» y devolverlo desde una función
// async lo ejecutaría antes de sumarle los filtros.

/** Productos publicados de tiendas públicas, con su tienda. */
function publicProducts(admin: Admin, fields: string) {
  return admin
    .from('products')
    .select(fields)
    .eq('is_active', true)
    .eq('visibility', 'public')
    .eq('organizations.storefront_public', true)
}

/** Los de una tienda, o sin tienda elegida los de todo el marketplace. */
function productQuery(admin: Admin, fields: string, store: BotStore | null) {
  const query = publicProducts(admin, fields)
  return store ? query.eq('organization_id', store.id) : query.eq('organizations.marketplace_public', true)
}

type Page = { products: BotProduct[]; hasMore: boolean }

async function runPage(
  query: ReturnType<typeof productQuery>,
  page: number,
  context: string,
): Promise<Page> {
  const from = Math.max(0, page) * PAGE_SIZE
  // Uno de más para saber si hay otra página sin contar todo.
  const { data, error } = await query
    .order('stock_quantity', { ascending: false })
    .order('name', { ascending: true })
    .range(from, from + PAGE_SIZE)
  if (error) {
    logger.warn(`[telegram] falló ${context}`, { error: error.message })
    return { products: [], hasMore: false }
  }
  const products = toProducts(data as unknown[])
  return { products: products.slice(0, PAGE_SIZE), hasMore: products.length > PAGE_SIZE }
}

/** Cada palabra tiene que aparecer en el nombre, la marca, el SKU o el código. */
export async function searchProducts(admin: Admin, store: BotStore | null, text: string, page = 0): Promise<Page> {
  const words = searchTerms(text)
  if (words.length === 0) return { products: [], hasMore: false }
  let query = productQuery(admin, await productFields(admin), store)
  for (const word of words) {
    query = query.or(`name.ilike.%${word}%,brand.ilike.%${word}%,sku.ilike.%${word}%,barcode.ilike.%${word}%`)
  }
  return runPage(query, page, 'la búsqueda')
}

export async function productsInCategory(admin: Admin, store: BotStore, categoryId: string, page = 0): Promise<Page> {
  const query = productQuery(admin, await productFields(admin), store).eq('category_id', categoryId)
  return runPage(query, page, 'la categoría')
}

export async function offers(admin: Admin, store: BotStore | null, page = 0): Promise<Page> {
  const query = productQuery(admin, await productFields(admin), store).eq('has_offer', true).gt('offer_price', 0)
  return runPage(query, page, 'las ofertas')
}

/** La ficha se abre aunque la tienda no esté en el marketplace: basta con que sea pública. */
export async function productById(admin: Admin, id: string): Promise<BotProduct | null> {
  const { data, error } = await publicProducts(admin, await productFields(admin)).eq('id', id).limit(1)
  if (error) logger.warn('[telegram] falló la ficha', { error: error.message })
  return toProducts((data ?? null) as unknown[] | null)[0] ?? null
}

/** Categorías con productos publicados, las más cargadas primero. */
export async function categoriesWithProducts(admin: Admin, store: BotStore, limit = 12): Promise<BotCategory[]> {
  const { data: rows } = await admin
    .from('products')
    .select('category_id')
    .eq('organization_id', store.id)
    .eq('is_active', true)
    .eq('visibility', 'public')
    .not('category_id', 'is', null)
    .limit(5000)
  const counts = new Map<string, number>()
  for (const row of (rows ?? []) as Array<{ category_id: string }>) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1)
  }
  if (counts.size === 0) return []
  const { data: categories } = await admin
    .from('categories')
    .select('id, name')
    .eq('organization_id', store.id)
    .in('id', [...counts.keys()])
  return ((categories ?? []) as Array<{ id: string; name: string }>)
    .map((category) => ({ ...category, count: counts.get(category.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}

/** WhatsApp, teléfono y dirección que la tienda cargó en su web. */
export async function storeContact(admin: Admin, store: BotStore): Promise<StoreContact | null> {
  const [{ data: info }, { data: settings }] = await Promise.all([
    admin.from('website_settings').select('value').eq('organization_id', store.id).eq('key', 'company_info').maybeSingle(),
    admin.from('organization_settings').select('company_address, city').eq('organization_id', store.id).maybeSingle(),
  ])
  const value = ((info as { value?: unknown } | null)?.value ?? {}) as Record<string, unknown>
  const text = (key: string) => (typeof value[key] === 'string' && (value[key] as string).trim()) || null
  const fallback = settings as { company_address?: string | null; city?: string | null } | null
  const address = text('address') || [fallback?.company_address, fallback?.city].filter(Boolean).join(', ') || null
  const contact = { whatsapp: text('whatsapp'), phone: text('phone'), email: text('email'), address, instagram: text('instagram') }
  return Object.values(contact).some(Boolean) ? contact : null
}
