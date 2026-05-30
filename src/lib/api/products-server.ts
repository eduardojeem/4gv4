
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { PublicProduct } from '@/types/public'
import { resolveWholesaleAccessForUser } from '@/lib/auth/wholesale-access'
import { SupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { getTenantSlugFromHost } from '@/lib/saas/tenant'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'

import { PRODUCTS_MAX_PRICE } from '@/lib/constants/products'

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

  return resolvePublicOrganizationBySlug(tenantSlug, supabase)
}

/** Resolve whether the current session belongs to a wholesale customer.
 *  Supports both legacy roles and explicit per-user permission. */
export async function resolveWholesaleStatus(options?: {
  supabase?: SupabaseClient
  user?: { id: string; user_metadata?: Record<string, unknown> | null } | null
}): Promise<{ isWholesale: boolean }> {
  const supabase = options?.supabase ?? (await createClient())
  const user =
    options?.user ??
    (await supabase.auth.getSession()).data.session?.user ??
    null

  if (!user?.id) return { isWholesale: false }

  const metadataRole =
    user.user_metadata && typeof user.user_metadata.role === 'string'
      ? user.user_metadata.role
      : undefined

  const isWholesale = await resolveWholesaleAccessForUser(supabase, user.id, metadataRole)
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
}

const MAX_PRICE = PRODUCTS_MAX_PRICE

export async function getPublicProducts(filters: ProductFilters): Promise<ProductsResponse> {
  const supabase = createAdminSupabase() as SupabaseClient
  const organization = await resolveServerPublicOrganization(supabase)

  const {
    query: rawQuery = '',
    categoryId,
    brand,
    branchId,
    minPrice = 0,
    maxPrice = MAX_PRICE,
    inStock = false,
    sort = 'name',
    page = 1,
    perPage = 20,
  } = filters

  const query = sanitizeSearch(rawQuery)

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
    stock_quantity: number
    is_active: boolean
    featured: boolean
    image_url: string | null
    images: string[] | null
    unit_measure: string
    barcode: string | null
    category: { id: string; name: string } | { id: string; name: string }[] | null
    brand_details: { name: string } | null
  }

  // Resolve wholesale status — use caller-supplied value if available to avoid re-querying.
  let isWholesale = filters.isWholesale ?? false
  if (filters.isWholesale === undefined) {
    const result = await resolveWholesaleStatus()
    isWholesale = result.isWholesale
  }

  // Build query - only active products, never select wholesale_price for non-wholesale
  // Typed as string to avoid TS2590 (union type too complex with long string literals)
  const selectFields: string = isWholesale
    ? 'id, name, sku, description, brand, sale_price, wholesale_price, has_offer, offer_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'
    : 'id, name, sku, description, brand, sale_price, has_offer, offer_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let queryBuilder = (supabase as any)
    .from('products')
    .select(selectFields, { count: 'exact' })
    .eq('organization_id', organization.id)
    .eq('is_active', true)

  // Filter visibility
  // If wholesale: show 'public' and 'wholesale'
  // If retail: show 'public' only
  if (isWholesale) {
    queryBuilder = queryBuilder.in('visibility', ['public', 'wholesale'])
  } else {
    queryBuilder = queryBuilder.eq('visibility', 'public')
  }

  // Apply search filter with sanitized input
  if (query) {
    queryBuilder = queryBuilder.or(
      `name.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%,brand.ilike.%${query}%`
    )
  }

  if (categoryId) {
    queryBuilder = queryBuilder.eq('category_id', categoryId)
  }

  if (brand) {
    queryBuilder = queryBuilder.eq('brand', brand)
  }

  if (minPrice > 0 || maxPrice < MAX_PRICE) {
    const priceCol = isWholesale ? 'wholesale_price' : 'sale_price'
    queryBuilder = queryBuilder.gte(priceCol, minPrice).lte(priceCol, maxPrice)
  }

  if (inStock) {
    queryBuilder = queryBuilder.gt('stock_quantity', 0)
  }

  // Branch filter: only show products available at the selected branch
  if (branchId) {
    try {
      const { data: branchProducts } = await supabase
        .from('branch_inventory')
        .select('product_id')
        .eq('branch_id', branchId)
        .gt('stock_quantity', 0)

      if (branchProducts && branchProducts.length > 0) {
        const productIds = branchProducts.map(bp => bp.product_id)
        queryBuilder = queryBuilder.in('id', productIds)
      } else {
        // No products in this branch — return empty
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
      }
    } catch (err) {
      // branch_inventory table might not exist — log and ignore filter
      console.warn('[getPublicProducts] Branch filter skipped:', err instanceof Error ? err.message : err)
    }
  }

  // Apply sorting
  switch (sort) {
    case 'price_asc':
      queryBuilder = queryBuilder.order(isWholesale ? 'wholesale_price' : 'sale_price', { ascending: true })
      break
    case 'price_desc':
      queryBuilder = queryBuilder.order(isWholesale ? 'wholesale_price' : 'sale_price', { ascending: false })
      break
    case 'newest':
      queryBuilder = queryBuilder.order('created_at', { ascending: false })
      break
    default:
      queryBuilder = queryBuilder.order('name', { ascending: true })
  }

  // Apply pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data: products, error, count } = await queryBuilder.range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  // Transform to PublicProduct type - hide sensitive data
  const publicProducts: PublicProduct[] = ((products as unknown as DBProduct[]) || []).map((p) => {
    const category = Array.isArray(p.category) ? p.category[0] : p.category
    const cat = category as { id: string; name: string } | null
    return {
      id: p.id as string,
      name: p.name as string,
      sku: p.sku as string,
      description: p.description as string | null,
      brand: p.brand_details?.name || p.brand as string | null,
      category: cat ? { id: cat.id, name: cat.name } : undefined,
      sale_price: p.sale_price as number,
      wholesale_price: isWholesale ? (p.wholesale_price as number | null) : null,
      has_offer: (p.has_offer as boolean) || false,
      offer_price: (p.offer_price as number | null) ?? null,
      stock_quantity: (p.stock_quantity as number) ?? 0,
      in_stock: ((p.stock_quantity as number) ?? 0) > 0,
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

  // Fetch brands for filter sidebar
  // Priority: 1. brands relation, 2. brand text field
  const { data: productsData } = await supabase
    .from('products')
    .select('brand, brand_details:brands(name)')
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    // Also apply visibility filter to brands query to show relevant brands only
    .or(isWholesale ? 'visibility.in.(public,wholesale)' : 'visibility.eq.public')

  const uniqueBrands = new Set<string>()
  productsData?.forEach((p) => {
    const brandName = (p.brand_details as { name: string }[] | null)?.[0]?.name || (p.brand as string)
    if (brandName) uniqueBrands.add(brandName)
  })

  const brands = Array.from(uniqueBrands).sort()

  // Fetch price range meta — use the appropriate price column for the user type
  const priceCol = isWholesale ? 'wholesale_price' : 'sale_price'
  const { data: priceData } = await supabase
    .from('products')
    .select(priceCol)
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    .not(priceCol, 'is', null)
    // Also apply visibility filter
    .or(isWholesale ? 'visibility.in.(public,wholesale)' : 'visibility.eq.public')

  const prices = priceData?.map((p) => p[priceCol] as number).filter((p: number) => p > 0) || []
  const metaMinPrice = prices.length > 0 ? Math.floor(Math.min(...prices) / 5000) * 5000 : 0
  const metaMaxPrice = prices.length > 0 ? Math.ceil(Math.max(...prices) / 5000) * 5000 : MAX_PRICE

  return {
    products: publicProducts,
    total: count || 0,
    page,
    perPage,
    totalPages: Math.ceil((count || 0) / perPage),
    brands,
    priceRange: { min: metaMinPrice, max: metaMaxPrice },
    isWholesale,
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

export async function getPublicCategories(): Promise<CategoryWithSub[]> {
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
  
  // Organizar categorías en jerarquía
  const categoryMap = new Map(categories.map(cat => [cat.id, { ...cat, subcategories: [] } as CategoryWithSub]))
  const rootCategories: CategoryWithSub[] = []
  
  categoryMap.forEach(category => {
    if (category.parent_id) {
      const parent = categoryMap.get(category.parent_id)
      if (parent) {
        parent.subcategories.push(category)
      } else {
        // Si el padre no existe, tratarla como raíz
        rootCategories.push(category)
      }
    } else {
      rootCategories.push(category)
    }
  })
  
  return rootCategories
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
    const result = await resolveWholesaleStatus()
    isWholesale = result.isWholesale
  }

  // Typed as string to avoid TS2590 with long string literal unions
  const selectFields: string = isWholesale
    ? 'id, name, sku, description, brand, sale_price, wholesale_price, has_offer, offer_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'
    : 'id, name, sku, description, brand, sale_price, has_offer, offer_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'

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
  const p = data as unknown as { id: string; name: string; sku: string; description: string; brand: string; sale_price: number; wholesale_price?: number; has_offer?: boolean; offer_price?: number | null; stock_quantity: number; is_active: boolean; featured: boolean; image_url: string | null; images: string[] | null; unit_measure: string | null; barcode: string | null; category: { id: string; name: string } | { id: string; name: string }[] | null; brand_details: { name: string }[] | null }
  const category = Array.isArray(p.category) ? p.category[0] : p.category
  const cat = category as { id: string; name: string } | null

  const product: PublicProduct = {
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    brand: p.brand_details?.[0]?.name || p.brand,
    category: cat ? { id: cat.id, name: cat.name } : undefined,
    sale_price: p.sale_price,
    wholesale_price: isWholesale ? (p.wholesale_price as number | null) : null,
    has_offer: p.has_offer || false,
    offer_price: p.offer_price ?? null,
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
    return data
      .filter((row: any) => row.branch?.is_active === true)
      .filter((row: any) => row.branch?.organization_id === undefined || row.branch?.organization_id === organization.id)
      .map((row: any) => ({
        branchId: row.branch.id,
        branchName: row.branch.name,
        city: row.branch.city,
        phone: row.branch.phone,
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
