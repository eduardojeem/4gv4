import { createClient } from '@/lib/supabase/server'
import { PublicProduct } from '@/types/public'

// Sanitize search input to prevent PostgREST injection
function sanitizeSearch(input: string): string {
  // Remove PostgREST special characters: . , ( ) : ! < > = & | %
  return input.replace(/[.,()!<>=&|%:*\\]/g, '').trim().slice(0, 100)
}

export type ProductFilters = {
  query?: string
  categoryId?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sort?: string
  page?: number
  perPage?: number
}

export type ProductsResponse = {
  products: PublicProduct[]
  total: number
  page: number
  perPage: number
  totalPages: number
  brands: string[]
  priceRange: { min: number; max: number }
}

export async function getPublicProducts(filters: ProductFilters): Promise<ProductsResponse> {
  const supabase = await createClient()

  const {
    query: rawQuery = '',
    categoryId,
    brand,
    minPrice = 0,
    maxPrice = 99999999,
    inStock = false,
    sort = 'name',
    page = 1,
    perPage = 20,
  } = filters

  const query = sanitizeSearch(rawQuery)

  // Only check wholesale status if user has a session (skip 2 queries for anonymous)
  let isWholesale = false
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    const role = profile?.role || session.user.user_metadata?.role
    isWholesale = role === 'mayorista' || role === 'client_mayorista'
  }

  // Build query - only active products, never select wholesale_price for non-wholesale
  const selectFields = isWholesale
    ? 'id, name, sku, description, brand, sale_price, wholesale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)'
    : 'id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)'

  let queryBuilder = supabase
    .from('products')
    .select(selectFields, { count: 'exact' })
    .eq('is_active', true)

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

  if (minPrice > 0 || maxPrice < 99999999) {
    const priceCol = isWholesale ? 'wholesale_price' : 'sale_price'
    queryBuilder = queryBuilder.gte(priceCol, minPrice).lte(priceCol, maxPrice)
  }

  if (inStock) {
    queryBuilder = queryBuilder.gt('stock_quantity', 0)
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
  const publicProducts: PublicProduct[] = (products || []).map((p: any) => {
    const category = Array.isArray(p.category) ? p.category[0] : p.category
    const cat = category as { id: string; name: string } | null
    return {
      id: p.id as string,
      name: p.name as string,
      sku: p.sku as string,
      description: p.description as string | null,
      brand: p.brand as string | null,
      category: cat ? { id: cat.id, name: cat.name } : undefined,
      sale_price: p.sale_price as number,
      wholesale_price: isWholesale ? (p.wholesale_price as number | null) : null,
      stock_quantity: (p.stock_quantity as number) > 0 ? 1 : 0,
      is_active: p.is_active as boolean,
      featured: (p.featured as boolean) || false,
      image: (p.image_url as string | null) || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null),
      images: p.images as string[] | null,
      unit_measure: p.unit_measure as string,
      barcode: p.barcode as string | null,
    }
  })

  // Fetch meta data (brands and price range) - can be optimized, but good for now to have it all in one server action if needed, or fetched separately.
  // For now, let's keep it simple and just return the products, and let the page fetch meta if needed or we can add it here.
  // Actually, the page likely needs brands for the filter sidebar. Let's fetch them in parallel if they are lightweight, or defer.
  // The current page implementation fetches meta separately. We can replicate that pattern or bundle it.
  // Bundling is better for SSR to avoid waterfalls.

  const { data: brandsData } = await supabase
      .from('products')
      .select('brand')
      .eq('is_active', true)
      .not('brand', 'is', null)

  const brands = Array.from(new Set(brandsData?.map((p: any) => p.brand) || [])).sort() as string[]

  const { data: priceData } = await supabase
      .from('products')
      .select('sale_price')
      .eq('is_active', true)

  const prices = priceData?.map((p: any) => p.sale_price).filter((p: number) => p > 0) || []
  const metaMinPrice = prices.length > 0 ? Math.floor(Math.min(...prices) / 5000) * 5000 : 0
  const metaMaxPrice = prices.length > 0 ? Math.ceil(Math.max(...prices) / 5000) * 5000 : 5000000

  return {
    products: publicProducts,
    total: count || 0,
    page,
    perPage,
    totalPages: Math.ceil((count || 0) / perPage),
    brands,
    priceRange: { min: metaMinPrice, max: metaMaxPrice }
  }
}

export async function getPublicCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')
  return data || []
}

export async function getPublicProduct(id: string) {
  const supabase = await createClient()
  
  // Clean ID
  const cleanId = decodeURIComponent(id).trim()

  // Check wholesale
  let isWholesale = false
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    const role = profile?.role || session.user.user_metadata?.role
    isWholesale = role === 'mayorista' || role === 'client_mayorista'
  }

  const selectFields = isWholesale
    ? 'id, name, sku, description, brand, sale_price, wholesale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)'
    : 'id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)'

  const { data, error } = await supabase
    .from('products')
    .select(selectFields)
    .eq('id', cleanId)
    .single()

  if (error || !data) return null

  // Transform
  const p = data as any
  const category = Array.isArray(p.category) ? p.category[0] : p.category
  const cat = category as { id: string; name: string } | null
  
  const product: PublicProduct = {
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    brand: p.brand,
    category: cat ? { id: cat.id, name: cat.name } : undefined,
    sale_price: p.sale_price,
    wholesale_price: isWholesale ? (p.wholesale_price as number | null) : null,
    stock_quantity: (p.stock_quantity as number) > 0 ? 1 : 0,
    is_active: p.is_active,
    featured: p.featured || false,
    image: p.image_url || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null),
    images: p.images,
    unit_measure: p.unit_measure,
    barcode: p.barcode,
  }

  return product
}
