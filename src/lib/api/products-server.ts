
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { PublicProduct } from '@/types/public'
import { resolveWholesaleAccessForUser } from '@/lib/auth/wholesale-access'
import { SupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { getTenantSlugFromHost } from '@/lib/saas/tenant'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { applyAutomaticPromotionToProduct, mapPublicPromotion } from '@/lib/public-promotions'
import { buildVisibleCategoryTree, resolveEffectiveProductStock } from '@/lib/public/catalog'

import { PRODUCTS_MAX_PRICE, PRODUCTS_PER_PAGE } from '@/lib/constants/products'

// Sanitize search input to prevent PostgREST injection
function sanitizeSearch(input: string): string {
  // Remove PostgREST special characters: . , ( ) : ! < > = & | %
  return input.replace(/[.,()!<>=&|%:*\\]/g, '').trim().slice(0, 100)
}

async function resolveServerPublicOrganization(supabase: SupabaseClient) {
  const headerStore = await headers()
  const tenantSlug =
    headerStore.get('x-tenant-slug') ||
    getTenantSlugFromHost(headerStore.get('host') ?? '')

  return resolvePublicStorefrontOrganizationBySlug(tenantSlug, supabase)
}

/** Resolve whether the current session belongs to a wholesale customer.
 *  Supports both legacy roles and explicit per-user permission. */
export async function resolveWholesaleStatus(options?: {
  supabase?: SupabaseClient
  user?: { id: string; user_metadata?: Record<string, unknown> | null } | null
  organizationId?: string
}): Promise<{ isWholesale: boolean }> {
  const supabase = options?.supabase ?? (await createClient())
  const user =
    options?.user ??
    (await supabase.auth.getSession()).data.session?.user ??
    null

  if (!user?.id) return { isWholesale: false }

  const organizationId = options?.organizationId ??
    (await resolveServerPublicOrganization(createAdminSupabase() as SupabaseClient))?.id
  if (!organizationId) return { isWholesale: false }

  const isWholesale = await resolveWholesaleAccessForUser(supabase, user.id, organizationId)
  return { isWholesale }
}

export type ProductFilters = {
  query?: string
  categoryId?: string
  brand?: string
  branchId?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  offers?: boolean
  sort?: string
  page?: number
  perPage?: number
  /** Pass the already-resolved wholesale status to skip a redundant DB round-trip. */
  isWholesale?: boolean
}

export type ProductsResponse = {
  products: PublicProduct[]
  total: number
  page: number
  perPage: number
  totalPages: number
  brands: string[]
  priceRange: { min: number; max: number }
  isWholesale: boolean
  branchFilterUnavailable?: boolean
}

const MAX_PRICE = PRODUCTS_MAX_PRICE

/**
 * Facetas del sidebar (marcas disponibles + rango de precio) para una
 * organización. Un solo scan de products en vez de dos, y cacheado con
 * unstable_cache (5 min) porque cambia poco y no depende de los filtros
 * activos de la búsqueda. La cache-key incluye organización y tipo de usuario
 * (retail/mayorista ven distinto set de precios y visibilidad).
 */
async function getProductFacetsUncached(
  organizationId: string,
  isWholesale: boolean
): Promise<{ brands: string[]; priceRange: { min: number; max: number } }> {
  const supabase = createAdminSupabase() as SupabaseClient
  const priceCol = isWholesale ? 'wholesale_price' : 'sale_price'
  const visibilityFilter = isWholesale
    ? 'visibility.in.(public,wholesale)'
    : 'visibility.eq.public'

  const { data } = await supabase
    .from('products')
    .select(`brand, ${priceCol}, brand_details:brands(name)`)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .or(visibilityFilter)

  const uniqueBrands = new Set<string>()
  const prices: number[] = []
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const rel = row.brand_details as { name: string }[] | { name: string } | null
    const relName = Array.isArray(rel) ? rel[0]?.name : rel?.name
    const brandName = relName || (row.brand as string | null)
    if (brandName) uniqueBrands.add(brandName)

    const price = Number(row[priceCol])
    if (Number.isFinite(price) && price > 0) prices.push(price)
  }

  const min = prices.length > 0 ? Math.floor(Math.min(...prices) / 5000) * 5000 : 0
  const max = prices.length > 0 ? Math.ceil(Math.max(...prices) / 5000) * 5000 : MAX_PRICE

  return { brands: Array.from(uniqueBrands).sort(), priceRange: { min, max } }
}

function getProductFacets(organizationId: string, isWholesale: boolean) {
  return unstable_cache(
    () => getProductFacetsUncached(organizationId, isWholesale),
    ['product-facets', organizationId, isWholesale ? 'wholesale' : 'retail'],
    { revalidate: 300, tags: [`product-facets:${organizationId}`] }
  )()
}

export async function getPublicProducts(filters: ProductFilters): Promise<ProductsResponse> {
  const supabase = createAdminSupabase() as SupabaseClient
  const organization = await resolveServerPublicOrganization(supabase)

  const {
    query: rawQuery = '',
    categoryId,
    brand: rawBrand,
    branchId,
    minPrice = 0,
    maxPrice = MAX_PRICE,
    inStock = false,
    sort: rawSort = 'name',
    page: rawPage = 1,
    perPage = PRODUCTS_PER_PAGE,
  } = filters

  // Defensa ante callers que pasen page inválido (p.ej. de la URL): un page
  // negativo genera un range PostgREST inválido y explota el render.
  const page = Math.max(1, Math.floor(rawPage) || 1)
  const query = sanitizeSearch(rawQuery)

  // #2 — Sanitizar brand igual que query para prevenir inyección PostgREST.
  const brand = sanitizeSearch(rawBrand ?? '')

  // #4 — max_price negativo o cero produce un rango [0,0] vacío sin aviso.
  // Se trata cualquier valor <= 0 o no-finito como "sin límite superior".
  const rawMaxPrice = maxPrice
  const effectiveMaxPrice =
    Number.isFinite(rawMaxPrice) && rawMaxPrice > 0 ? rawMaxPrice : MAX_PRICE

  // #8 — Validar sort contra lista permitida; valores desconocidos caen a 'name'.
  const ALLOWED_SORTS = ['name', 'price_asc', 'price_desc', 'newest', 'discount_desc', 'featured', 'default'] as const
  type AllowedSort = typeof ALLOWED_SORTS[number]
  const sort: AllowedSort = (ALLOWED_SORTS as readonly string[]).includes(rawSort)
    ? (rawSort as AllowedSort)
    : 'name'

  if (!organization) {
    return {
      products: [],
      total: 0,
      page,
      perPage,
      totalPages: 0,
      brands: [],
      priceRange: { min: 0, max: MAX_PRICE },
      isWholesale: false,
    }
  }

  interface DBProduct {
    id: string
    name: string
    sku: string
    description: string | null
    brand: string | null
    sale_price: number
    wholesale_price: number | null
    has_offer: boolean | null
    offer_price: number | null
    installments_enabled: boolean | null
    installments_public: boolean | null
    installments_plans: { count: number; rate: number }[] | null
    stock_quantity: number
    is_active: boolean
    featured: boolean
    image_url: string | null
    images: string[] | null
    unit_measure: string
    barcode: string | null
    category: { id: string; name: string } | { id: string; name: string }[] | null
    brand_details: { name: string } | null
    branch_stock?: Array<{ stock_quantity: number | null }> | { stock_quantity: number | null } | null
  }

  // Resolve wholesale status — use caller-supplied value if available to avoid re-querying.
  let isWholesale = filters.isWholesale ?? false
  if (filters.isWholesale === undefined) {
    const result = await resolveWholesaleStatus({ organizationId: organization.id })
    isWholesale = result.isWholesale
  }

  const { data: automaticPromotionRows } = await supabase
    .from('promotions')
    .select('*')
    .eq('organization_id', organization.id)
    .eq('public_mode', 'automatic')
    .eq('is_active', true)
  const automaticPromotions = (automaticPromotionRows ?? []).map((row) =>
    mapPublicPromotion(row as Record<string, unknown>)
  )

  // Filtro por sucursal: se resuelve ANTES de armar el select porque, cuando
  // aplica, se filtra con un join !inner sobre branch_inventory (escalable: no
  // hay que traer todos los product_id de la sucursal para un .in()).
  // Se valida que la sucursal pertenezca a esta organización para que un
  // branch_id falsificado en la URL no consulte inventario de otro tenant.
  let useBranchJoin = false
  if (branchId) {
    const { data: branchRow, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (branchError) {
      // La tabla puede no existir en este deployment: se ignora el filtro en
      // vez de devolver un catálogo vacío.
      console.warn('[getPublicProducts] Branch filter skipped:', branchError.message)
    } else if (!branchRow) {
      // Sucursal inexistente o de otra organización → sin resultados.
      return {
        products: [],
        total: 0,
        page,
        perPage,
        totalPages: 0,
        brands: [],
        priceRange: { min: 0, max: MAX_PRICE },
        isWholesale,
      }
    } else {
      useBranchJoin = true
    }
  }

  // Build query - only active products, never select wholesale_price for non-wholesale
  // Typed as string to avoid TS2590 (union type too complex with long string literals)
  const baseSelectFields: string = isWholesale
    ? 'id, name, sku, description, brand, sale_price, wholesale_price, has_offer, offer_price, installments_enabled, installments_public, installments_plans, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'
    : 'id, name, sku, description, brand, sale_price, has_offer, offer_price, installments_enabled, installments_public, installments_plans, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'

  // Sub-consultas que dependen de la BD se resuelven una sola vez, antes de
  // armar el query, para que el builder de abajo sea sincrónico y reutilizable.
  let categoryIds: string[] = []
  if (categoryId) {
    // Una categoría padre debe incluir los productos de sus subcategorías,
    // no solo los asignados directamente a ella.
    const { data: childCategories } = await supabase
      .from('categories')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('parent_id', categoryId)

    categoryIds = [categoryId, ...(childCategories ?? []).map((c) => c.id)]
  }

  // El listado de marcas se arma con brand_details.name (relación brands) con
  // fallback al campo de texto `brand`; el filtro debe aceptar ambas fuentes,
  // si no una marca listada por la relación devolvería 0 resultados.
  let brandRowId: string | null = null
  if (brand) {
    const { data: brandRow } = await supabase
      .from('brands')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('name', brand)
      .maybeSingle()
    brandRowId = brandRow?.id ?? null
  }

  const priceCol = isWholesale ? 'wholesale_price' : 'sale_price'

  /** Arma el query completo. `withBranchJoin` permite reintentar sin el join. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildQuery = (withBranchJoin: boolean): any => {
    const selectFields = withBranchJoin
      ? `${baseSelectFields}, branch_stock:branch_inventory!inner(branch_id, stock_quantity)`
      : baseSelectFields

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from('products')
      .select(selectFields, { count: 'exact' })
      .eq('organization_id', organization.id)
      .eq('is_active', true)

    if (withBranchJoin) {
      q = q.eq('branch_stock.branch_id', branchId).gt('branch_stock.stock_quantity', 0)
    }

    // Visibilidad: mayorista ve 'public' y 'wholesale'; retail solo 'public'.
    q = isWholesale ? q.in('visibility', ['public', 'wholesale']) : q.eq('visibility', 'public')

    if (query) {
      q = q.or(
        `name.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%,brand.ilike.%${query}%`
      )
    }

    if (categoryIds.length > 1) q = q.in('category_id', categoryIds)
    else if (categoryIds.length === 1) q = q.eq('category_id', categoryIds[0])

    if (brand) {
      if (brandRowId) {
        // Valor citado y sin comillas/backslashes para el .or() de PostgREST.
        const quotedBrand = `"${brand.replace(/[\\"]/g, '')}"`
        q = q.or(`brand.eq.${quotedBrand},brand_id.eq.${brandRowId}`)
      } else {
        q = q.eq('brand', brand)
      }
    }

    if (minPrice > 0 || effectiveMaxPrice < MAX_PRICE) {
      q = q.gte(priceCol, minPrice).lte(priceCol, effectiveMaxPrice)
    }

    if (inStock) q = q.gt('stock_quantity', 0)

    if (filters.offers) {
      q = q.eq('has_offer', true)
    }

    switch (sort) {
      case 'price_asc':
        return q.order(priceCol, { ascending: true })
      case 'price_desc':
        return q.order(priceCol, { ascending: false })
      case 'newest':
        return q.order('created_at', { ascending: false })
      case 'discount_desc':
        return q.order('has_offer', { ascending: false }).order('created_at', { ascending: false })
      case 'featured':
      case 'default':
        return q.order('featured', { ascending: false }).order('has_offer', { ascending: false }).order('created_at', { ascending: false })
      default:
        return q.order('name', { ascending: true })
    }
  }

  // Apply pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let { data: products, error, count } = await buildQuery(useBranchJoin).range(from, to)
  let branchFilterUnavailable = false

  // Do not fall back to global stock while a branch filter is active.
  if (error && useBranchJoin) {
    console.warn('[getPublicProducts] Branch inventory unavailable:', error.message)
    products = []
    count = 0
    error = null
    branchFilterUnavailable = true
  }

  if (error) {
    throw new Error(error.message)
  }

  // Transform to PublicProduct type - hide sensitive data
  const publicProducts: PublicProduct[] = ((products as unknown as DBProduct[]) || []).map((p) => {
    const category = Array.isArray(p.category) ? p.category[0] : p.category
    const cat = category as { id: string; name: string } | null
    const stockQuantity = resolveEffectiveProductStock(p.stock_quantity, p.branch_stock, useBranchJoin)
    const priced = applyAutomaticPromotionToProduct({
      id: p.id,
      category_id: cat?.id ?? null,
      sale_price: Number(p.sale_price ?? 0),
      has_offer: p.has_offer,
      offer_price: p.offer_price,
    }, automaticPromotions)
    return {
      id: p.id as string,
      name: p.name as string,
      sku: p.sku as string,
      description: p.description as string | null,
      brand: p.brand_details?.name || p.brand as string | null,
      category: cat ? { id: cat.id, name: cat.name } : undefined,
      sale_price: p.sale_price as number,
      wholesale_price: isWholesale ? (p.wholesale_price as number | null) : null,
      has_offer: priced.has_offer,
      offer_price: priced.offer_price,
      promotion_name: priced.promotion_name,
      installments_enabled: (p.installments_enabled as boolean) || false,
      installments_public: (p.installments_public as boolean) ?? true,
      installments_plans: Array.isArray(p.installments_plans) ? p.installments_plans : [],
      stock_quantity: stockQuantity,
      in_stock: stockQuantity > 0,
      is_active: p.is_active as boolean,
      featured: (p.featured as boolean) || false,
      image: Array.isArray(p.images)
        ? (p.images.length > 0 ? p.images[0] : null)
        : (p.image_url as string | null),
      images: p.images as string[] | null,
      unit_measure: p.unit_measure as string,
      barcode: p.barcode as string | null,
    }
  })

  // Facetas del sidebar (marcas + rango de precio): un único scan cacheado por
  // organización/tipo de usuario, en vez de dos scans completos por request.
  const { brands, priceRange } = await getProductFacets(organization.id, isWholesale)
  const { min: metaMinPrice, max: metaMaxPrice } = priceRange

  return {
    products: publicProducts,
    total: count || 0,
    page,
    perPage,
    totalPages: Math.ceil((count || 0) / perPage),
    brands,
    priceRange: { min: metaMinPrice, max: metaMaxPrice },
    isWholesale,
    branchFilterUnavailable,
  }
}

interface DBCategory {
  id: string
  name: string
  parent_id: string | null
}

interface CategoryWithSub extends DBCategory {
  subcategories: CategoryWithSub[]
}

export async function getPublicCategories(isWholesale = false): Promise<CategoryWithSub[]> {
  const supabase = createAdminSupabase() as SupabaseClient
  const organization = await resolveServerPublicOrganization(supabase)

  if (!organization) {
    return []
  }

  const { data } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .eq('organization_id', organization.id)
    .order('name')
  
  const categories = (data as DBCategory[]) || []
  
  let productCategoriesQuery = supabase
    .from('products')
    .select('category_id')
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    .not('category_id', 'is', null)

  productCategoriesQuery = isWholesale
    ? productCategoriesQuery.in('visibility', ['public', 'wholesale'])
    : productCategoriesQuery.eq('visibility', 'public')

  const { data: productCategoryRows } = await productCategoriesQuery
  return buildVisibleCategoryTree(
    categories,
    (productCategoryRows ?? []).map((row) => row.category_id),
  )
}

export async function getPublicProduct(id: string, isWholesaleOverride?: boolean) {
  const supabase = createAdminSupabase() as SupabaseClient
  const organization = await resolveServerPublicOrganization(supabase)

  if (!organization) return null

  // Clean ID
  const cleanId = decodeURIComponent(id).trim()

  // Resolve wholesale status — accept pre-computed value to avoid redundant queries
  let isWholesale = isWholesaleOverride ?? false
  if (isWholesaleOverride === undefined) {
    const result = await resolveWholesaleStatus({ organizationId: organization.id })
    isWholesale = result.isWholesale
  }

  // Typed as string to avoid TS2590 with long string literal unions
  const selectFields: string = isWholesale
    ? 'id, name, sku, description, brand, sale_price, wholesale_price, has_offer, offer_price, installments_enabled, installments_public, installments_plans, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'
    : 'id, name, sku, description, brand, sale_price, has_offer, offer_price, installments_enabled, installments_public, installments_plans, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let queryBuilder = (supabase as any)
    .from('products')
    .select(selectFields)
    .eq('id', cleanId)
    .eq('organization_id', organization.id)
    .eq('is_active', true)

  // Visibility check is tricky with single() because if filtered out it returns null/error.
  // We can't use .or() easily here for filtering visibility because it's an AND condition with ID.
  // So we fetch it and then check visibility if we want to be strict, OR add the filter to the query.
  // Adding filter to query:
  
  if (isWholesale) {
    queryBuilder = queryBuilder.in('visibility', ['public', 'wholesale'])
  } else {
    queryBuilder = queryBuilder.eq('visibility', 'public')
  }

  const { data, error } = await queryBuilder.single()

  if (error || !data) return null

  // Transform
  const p = data as unknown as { id: string; name: string; sku: string; description: string; brand: string; sale_price: number; wholesale_price?: number; has_offer?: boolean; offer_price?: number | null; installments_enabled?: boolean; installments_public?: boolean; installments_plans?: { count: number; rate: number }[] | null; stock_quantity: number; is_active: boolean; featured: boolean; image_url: string | null; images: string[] | null; unit_measure: string | null; barcode: string | null; category: { id: string; name: string } | { id: string; name: string }[] | null; brand_details: { name: string }[] | null }
  const category = Array.isArray(p.category) ? p.category[0] : p.category
  const cat = category as { id: string; name: string } | null
  const { data: automaticPromotionRows } = await supabase
    .from('promotions')
    .select('*')
    .eq('organization_id', organization.id)
    .eq('public_mode', 'automatic')
    .eq('is_active', true)
  const priced = applyAutomaticPromotionToProduct({
    id: p.id,
    category_id: cat?.id ?? null,
    sale_price: Number(p.sale_price ?? 0),
    has_offer: p.has_offer,
    offer_price: p.offer_price,
  }, (automaticPromotionRows ?? []).map((row) => mapPublicPromotion(row as Record<string, unknown>)))

  const product: PublicProduct = {
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    brand: p.brand_details?.[0]?.name || p.brand,
    category: cat ? { id: cat.id, name: cat.name } : undefined,
    sale_price: p.sale_price,
    wholesale_price: isWholesale ? (p.wholesale_price as number | null) : null,
    has_offer: priced.has_offer,
    offer_price: priced.offer_price,
    promotion_name: priced.promotion_name,
    installments_enabled: p.installments_enabled || false,
    installments_public: p.installments_public ?? true,
    installments_plans: Array.isArray(p.installments_plans) ? p.installments_plans : [],
    stock_quantity: (p.stock_quantity as number) ?? 0,
    in_stock: ((p.stock_quantity as number) ?? 0) > 0,
    is_active: p.is_active,
    featured: p.featured || false,
    image: Array.isArray(p.images)
      ? (p.images.length > 0 ? p.images[0] : null)
      : (p.image_url as string | null),
    images: p.images,
    unit_measure: p.unit_measure,
    barcode: p.barcode,
  }

  return { product, isWholesale }
}

// ============================================================================
// Branch Stock Availability (for product detail page)
// ============================================================================

export interface BranchStockInfo {
  branchId: string
  branchName: string
  city: string | null
  phone: string | null
  stockQuantity: number
  isAvailable: boolean
}

type BranchInventoryRow = {
  stock_quantity: number | null
  branch: Array<{
    id: string
    organization_id?: string
    name: string
    city: string | null
    phone: string | null
    is_active: boolean
  }> | null
}

/**
 * Get stock availability per branch for a specific product.
 * Used in the public product detail page to show "Available at X sucursales".
 * Returns empty array if branch_inventory table doesn't exist yet.
 */
export async function getProductBranchStock(productId: string): Promise<BranchStockInfo[]> {
  const supabase = createAdminSupabase() as SupabaseClient
  const organization = await resolveServerPublicOrganization(supabase)

  if (!organization) return []

  try {
    const { data, error } = await supabase
      .from('branch_inventory')
      .select(`
        stock_quantity,
        branch:branches(id, organization_id, name, city, phone, is_active)
      `)
      .eq('product_id', productId)

    if (error) {
      // Table might not exist yet — graceful fallback
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('relation')) {
        return []
      }
      console.error('[getProductBranchStock] Error:', error.message)
      return []
    }

    if (!data || data.length === 0) return []

    // Filter only active branches and map to public-safe format
    return (data as unknown as BranchInventoryRow[])
      .map((row) => ({
        stock_quantity: row.stock_quantity,
        branch: Array.isArray(row.branch) ? row.branch[0] ?? null : null,
      }))
      .filter((row) => row.branch?.is_active === true)
      .filter((row) => row.branch?.organization_id === undefined || row.branch?.organization_id === organization.id)
      .map((row) => ({
        branchId: row.branch!.id,
        branchName: row.branch!.name,
        city: row.branch!.city,
        phone: row.branch!.phone,
        stockQuantity: row.stock_quantity ?? 0,
        isAvailable: (row.stock_quantity ?? 0) > 0,
      }))
      .sort((a: BranchStockInfo, b: BranchStockInfo) => b.stockQuantity - a.stockQuantity)
  } catch {
    return []
  }
}

/**
 * Get active branches for the public branch filter.
 * Returns empty array if branches table doesn't exist yet.
 */
export interface PublicBranch {
  id: string
  name: string
  city: string | null
}

export async function getPublicBranches(): Promise<PublicBranch[]> {
  const supabase = createAdminSupabase() as SupabaseClient
  const organization = await resolveServerPublicOrganization(supabase)

  if (!organization) return []

  try {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, city')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('relation')) {
        return []
      }
      return []
    }

    return (data || []) as PublicBranch[]
  } catch {
    return []
  }
}

/**
 * For a set of products, resolve in which active branches each one has stock.
 * Returns a plain map (serializable to client components) of
 * productId -> [{ id, name }]. Used to show branch badges when the shopper is
 * browsing "all branches". Returns {} when there are no branches/inventory.
 */
export async function getProductsBranchPresence(
  productIds: string[],
  branches: { id: string; name: string }[]
): Promise<Record<string, { id: string; name: string }[]>> {
  if (productIds.length === 0 || branches.length === 0) return {}

  const supabase = createAdminSupabase() as SupabaseClient
  try {
    const { data, error } = await supabase
      .from('branch_inventory')
      .select('product_id, branch_id, stock_quantity')
      .in('product_id', productIds)
      .gt('stock_quantity', 0)

    if (error || !data) return {}

    const branchById = new Map(branches.map((branch) => [branch.id, branch]))
    const result: Record<string, { id: string; name: string }[]> = {}

    for (const row of data as Array<{ product_id: string; branch_id: string }>) {
      const branch = branchById.get(row.branch_id)
      if (!branch) continue
      const list = result[row.product_id] ?? (result[row.product_id] = [])
      if (!list.some((entry) => entry.id === branch.id)) {
        list.push({ id: branch.id, name: branch.name })
      }
    }

    return result
  } catch {
    return {}
  }
}

/**
 * Get branches with full contact info for the homepage locations section.
 * Returns empty array if branches table doesn't exist.
 */
export interface BranchLocationInfo {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  managerName: string | null
  isDefault: boolean
}

export async function getPublicBranchLocations(): Promise<BranchLocationInfo[]> {
  const supabase = createAdminSupabase() as SupabaseClient
  const organization = await resolveServerPublicOrganization(supabase)

  if (!organization) return []

  try {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, address, city, phone, email, manager_name, is_default')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('relation')) {
        return []
      }
      return []
    }

    return (data || []).map(b => ({
      id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      phone: b.phone,
      email: b.email,
      managerName: b.manager_name,
      isDefault: b.is_default,
    }))
  } catch {
    return []
  }
}
