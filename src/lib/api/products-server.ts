
import { createClient } from '@/lib/supabase/server'
import { PublicProduct } from '@/types/public'

// Sanitize search input to prevent PostgREST injection
function sanitizeSearch(input: string): string {
  // Remove PostgREST special characters: . , ( ) : ! < > = & | %
  return input.replace(/[.,()!<>=&|%:*\\]/g, '').trim().slice(0, 100)
}

/** Resolve whether the current session belongs to a wholesale customer.
 *  Accepts an optional pre-fetched supabase client to avoid creating a new one. */
export async function resolveWholesaleStatus(): Promise<{ isWholesale: boolean }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { isWholesale: false }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()
  const role = profile?.role || session.user.user_metadata?.role
  const isWholesale = role === 'mayorista' || role === 'client_mayorista'
  return { isWholesale }
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

const MAX_PRICE = 50_000_000

export async function getPublicProducts(filters: ProductFilters): Promise<ProductsResponse> {
  const supabase = await createClient()

  const {
    query: rawQuery = '',
    categoryId,
    brand,
    minPrice = 0,
    maxPrice = MAX_PRICE,
    inStock = false,
    sort = 'name',
    page = 1,
    perPage = 20,
  } = filters

  const query = sanitizeSearch(rawQuery)

  // Resolve wholesale status — use caller-supplied value if available to avoid re-querying.
  let isWholesale = filters.isWholesale ?? false
  if (filters.isWholesale === undefined) {
    const result = await resolveWholesaleStatus()
    isWholesale = result.isWholesale
  }

  // Build query - only active products, never select wholesale_price for non-wholesale
  const selectFields = isWholesale
    ? 'id, name, sku, description, brand, sale_price, wholesale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'
    : 'id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'

  let queryBuilder = supabase
    .from('products')
    .select(selectFields, { count: 'exact' })
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
      brand: p.brand_details?.name || p.brand as string | null,
      category: cat ? { id: cat.id, name: cat.name } : undefined,
      sale_price: p.sale_price as number,
      wholesale_price: isWholesale ? (p.wholesale_price as number | null) : null,
      // Expose real stock quantity — UI can decide how to format it
      stock_quantity: p.stock_quantity as number,
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
    .eq('is_active', true)
    // Also apply visibility filter to brands query to show relevant brands only
    .or(isWholesale ? 'visibility.in.(public,wholesale)' : 'visibility.eq.public')

  const uniqueBrands = new Set<string>()
  productsData?.forEach((p: any) => {
    const brandName = p.brand_details?.name || p.brand
    if (brandName) uniqueBrands.add(brandName)
  })

  const brands = Array.from(uniqueBrands).sort()

  // Fetch price range meta — use the appropriate price column for the user type
  const priceCol = isWholesale ? 'wholesale_price' : 'sale_price'
  const { data: priceData } = await supabase
    .from('products')
    .select(priceCol)
    .eq('is_active', true)
    .not(priceCol, 'is', null)
    // Also apply visibility filter
    .or(isWholesale ? 'visibility.in.(public,wholesale)' : 'visibility.eq.public')

  const prices = priceData?.map((p: any) => p[priceCol]).filter((p: number) => p > 0) || []
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

export async function getPublicCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .order('name')
  
  const categories = data || []
  
  // Organizar categorías en jerarquía
  const categoryMap = new Map(categories.map(cat => [cat.id, { ...cat, subcategories: [] as any[] }]))
  const rootCategories: any[] = []
  
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
  const supabase = await createClient()

  // Clean ID
  const cleanId = decodeURIComponent(id).trim()

  // Resolve wholesale status — accept pre-computed value to avoid redundant queries
  let isWholesale = isWholesaleOverride ?? false
  if (isWholesaleOverride === undefined) {
    const result = await resolveWholesaleStatus()
    isWholesale = result.isWholesale
  }

  const selectFields = isWholesale
    ? 'id, name, sku, description, brand, sale_price, wholesale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'
    : 'id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), brand_details:brands(name)'

  let queryBuilder = supabase
    .from('products')
    .select(selectFields)
    .eq('id', cleanId)

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
  const p = data as any
  const category = Array.isArray(p.category) ? p.category[0] : p.category
  const cat = category as { id: string; name: string } | null

  const product: PublicProduct = {
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    brand: p.brand_details?.name || p.brand,
    category: cat ? { id: cat.id, name: cat.name } : undefined,
    sale_price: p.sale_price,
    wholesale_price: isWholesale ? (p.wholesale_price as number | null) : null,
    // Real stock quantity exposed
    stock_quantity: p.stock_quantity as number,
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
