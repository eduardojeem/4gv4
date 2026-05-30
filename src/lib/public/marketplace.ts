import { createAdminSupabase } from '@/lib/supabase/admin'
import type { PublicProduct } from '@/types/public'

export type MarketplaceOrganization = {
  id: string
  name: string
  slug: string
  plan: string | null
  logo_url: string | null
  created_at: string | null
  products_count: number
  featured_products: PublicProduct[]
}

export type MarketplaceProduct = PublicProduct & {
  organization_id: string
  organization_name: string
  organization_slug: string
}

export type MarketplaceCategory = {
  id: string
  name: string
  organization_count: number
  product_count: number
}

export type MarketplaceBrand = {
  name: string
  product_count: number
  organization_count: number
}

type OrganizationRow = {
  id: string
  name: string
  slug: string
  plan: string | null
  logo_url: string | null
  created_at: string | null
}

type ProductRow = {
  id: string
  organization_id: string
  name: string
  sku: string | null
  description: string | null
  brand: string | null
  sale_price: number | null
  stock_quantity: number | null
  is_active: boolean | null
  featured: boolean | null
  has_offer: boolean | null
  offer_price: number | null
  image_url: string | null
  images: string[] | null
  unit_measure: string | null
  barcode: string | null
  categories?: { id: string; name: string } | { id: string; name: string }[] | null
  organizations?: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null
}

function toPublicProduct(product: ProductRow): PublicProduct {
  const category = Array.isArray(product.categories) ? product.categories[0] : product.categories

  return {
    id: product.id,
    name: product.name,
    sku: product.sku ?? '',
    description: product.description,
    brand: product.brand,
    category: category ? { id: category.id, name: category.name } : undefined,
    sale_price: Number(product.sale_price ?? 0),
    wholesale_price: null,
    stock_quantity: Number(product.stock_quantity ?? 0),
    in_stock: Number(product.stock_quantity ?? 0) > 0,
    is_active: product.is_active !== false,
    featured: Boolean(product.featured),
    has_offer: Boolean(product.has_offer),
    offer_price: typeof product.offer_price === 'number' ? product.offer_price : null,
    image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : product.image_url,
    images: product.images,
    unit_measure: product.unit_measure ?? 'unidad',
    barcode: product.barcode,
  }
}

function getProductCategory(product: ProductRow) {
  return Array.isArray(product.categories) ? product.categories[0] : product.categories
}

function getProductOrganization(product: ProductRow) {
  return Array.isArray(product.organizations) ? product.organizations[0] : product.organizations
}

export async function getMarketplaceOrganizations(limit = 24): Promise<MarketplaceOrganization[]> {
  const supabase = createAdminSupabase()

  const { data: organizations, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, logo_url, created_at')
    .eq('marketplace_public', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (organizationError || !organizations?.length) return []

  const organizationRows = organizations as OrganizationRow[]
  const organizationIds = organizationRows.map((organization) => organization.id)

  const { data: products } = await supabase
    .from('products')
    .select('id, organization_id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, has_offer, offer_price, image_url, images, unit_measure, barcode, categories(id, name)')
    .in('organization_id', organizationIds)
    .eq('is_active', true)
    .eq('visibility', 'public')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit * 4)

  const productsByOrganization = new Map<string, ProductRow[]>()
  ;((products ?? []) as unknown as ProductRow[]).forEach((product) => {
    const rows = productsByOrganization.get(product.organization_id) ?? []
    rows.push(product)
    productsByOrganization.set(product.organization_id, rows)
  })

  return organizationRows.map((organization) => {
    const organizationProducts = productsByOrganization.get(organization.id) ?? []

    return {
      ...organization,
      products_count: organizationProducts.length,
      featured_products: organizationProducts.slice(0, 3).map(toPublicProduct),
    }
  })
}

export async function getMarketplaceProducts(limit = 48): Promise<MarketplaceProduct[]> {
  const supabase = createAdminSupabase()

  const { data, error } = await supabase
    .from('products')
    .select('id, organization_id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, has_offer, offer_price, image_url, images, unit_measure, barcode, categories(id, name), organizations!inner(id, name, slug)')
    .eq('is_active', true)
    .eq('visibility', 'public')
    .eq('organizations.marketplace_public', true)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return ((data ?? []) as unknown as ProductRow[])
    .map((product) => {
      const organization = getProductOrganization(product)
      if (!organization) return null

      return {
        ...toPublicProduct(product),
        organization_id: product.organization_id,
        organization_name: organization.name,
        organization_slug: organization.slug,
      }
    })
    .filter((product): product is MarketplaceProduct => Boolean(product))
}

export async function getMarketplaceCategories(): Promise<MarketplaceCategory[]> {
  const supabase = createAdminSupabase()

  // Doble nivel: si la categoría tenant tiene global_category_id →
  // agrupa por la categoría global (normalizada). Si no → usa la del tenant.
  const { data, error } = await supabase
    .from('products')
    .select(`
      organization_id,
      categories(id, name, global_category_id, global_categories:global_category_id(id, name, slug)),
      organizations!inner(id)
    `)
    .eq('is_active', true)
    .eq('visibility', 'public')
    .eq('organizations.marketplace_public', true)
    .limit(2000)

  if (error || !data) return []

  const categories = new Map<string, MarketplaceCategory & { organizationIds: Set<string> }>()

  ;((data ?? []) as unknown as ProductRow[]).forEach((product) => {
    const tenantCategory = getProductCategory(product)
    if (!tenantCategory) return

    // Preferir la categoría global si existe
    const globalCat = (tenantCategory as any).global_categories
    const displayId   = globalCat?.id   ?? tenantCategory.id
    const displayName = globalCat?.name ?? tenantCategory.name

    const existing = categories.get(displayId) ?? {
      id: displayId,
      name: displayName,
      product_count: 0,
      organization_count: 0,
      organizationIds: new Set<string>(),
    }

    existing.product_count += 1
    existing.organizationIds.add(product.organization_id)
    existing.organization_count = existing.organizationIds.size
    categories.set(displayId, existing)
  })

  return Array.from(categories.values())
    .map(({ organizationIds, ...category }) => category)
    .sort((a, b) => b.product_count - a.product_count)
}

export async function getMarketplaceBrands(limit = 50): Promise<MarketplaceBrand[]> {
  const supabase = createAdminSupabase()

  // Incluye brand_id con join a brands para obtener nombre canónico
  const { data, error } = await supabase
    .from('products')
    .select('organization_id, brand, brand_id, brands:brand_id(name), organizations!inner(id)')
    .eq('is_active', true)
    .eq('visibility', 'public')
    .eq('organizations.marketplace_public', true)
    .limit(3000)

  if (error || !data) return []

  type BrandRow = { organization_id: string; brand: string | null; brands: { name: string } | null }
  const brands = new Map<string, MarketplaceBrand & { organizationIds: Set<string>; nameCounts: Map<string, number> }>()

  ;((data ?? []) as unknown as BrandRow[]).forEach((row) => {
    // Preferir nombre canónico del registro brands si existe
    const rawName = (row.brands?.name ?? row.brand ?? '').trim()
    if (!rawName) return

    // Clave siempre en minúsculas para agrupar variantes ("samsung" = "SAMSUNG")
    const key = rawName.toLowerCase()

    const existing = brands.get(key) ?? {
      name: rawName,
      product_count: 0,
      organization_count: 0,
      organizationIds: new Set<string>(),
      nameCounts: new Map<string, number>(),
    }

    existing.product_count += 1
    existing.organizationIds.add(row.organization_id)
    existing.organization_count = existing.organizationIds.size

    // Registra cuántas veces aparece cada capitalización para elegir la más usada
    const count = existing.nameCounts.get(rawName) ?? 0
    existing.nameCounts.set(rawName, count + 1)

    // Usar la capitalización más frecuente como nombre display
    let best = existing.name
    let bestCount = existing.nameCounts.get(best) ?? 0
    for (const [n, c] of existing.nameCounts) {
      if (c > bestCount) { best = n; bestCount = c }
    }
    existing.name = best

    brands.set(key, existing)
  })

  return Array.from(brands.values())
    .map(({ organizationIds, nameCounts, ...brand }) => brand)
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, limit)
}

export async function getPublicOrganizationPage(slug: string) {
  const supabase = createAdminSupabase()

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, logo_url, created_at')
    .eq('slug', slug)
    .eq('marketplace_public', true)
    .maybeSingle()

  if (organizationError || !organization) return null

  const { data: settings } = await supabase
    .from('website_settings')
    .select('key, value')
    .eq('organization_id', organization.id)

  const settingsMap = new Map<string, unknown>()
  ;(settings ?? []).forEach((row: { key: string; value: unknown }) => settingsMap.set(row.key, row.value))

  const { data: products } = await supabase
    .from('products')
    .select('id, organization_id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, has_offer, offer_price, image_url, images, unit_measure, barcode, categories(id, name)')
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    .eq('visibility', 'public')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(24)

  return {
    organization: organization as OrganizationRow,
    companyInfo: settingsMap.get('company_info') as Record<string, unknown> | undefined,
    heroContent: settingsMap.get('hero_content') as Record<string, unknown> | undefined,
    products: ((products ?? []) as unknown as ProductRow[]).map(toPublicProduct),
  }
}
