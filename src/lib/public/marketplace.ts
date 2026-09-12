import { createAdminSupabase } from '@/lib/supabase/admin'
import type { PublicProduct } from '@/types/public'
import { applyAutomaticPromotionToProduct, buildPublicOfferCandidateFilter, mapPublicPromotion } from '@/lib/public-promotions'
import { getCompanyMapsHref } from '@/lib/website/company-maps-url'
import { sanitizeFilterTerm } from '@/lib/api/sanitize-search'
import { unstable_cache } from 'next/cache'
import type { PublicProductVariant } from '@/types/public'
import { deriveVariantAttributeConfig } from '@/lib/products/variant-attributes'

// Precio, stock y promociones cambian con frecuencia. El directorio y sus
// facetas cambian mucho menos, por eso pueden vivir mas tiempo sin volver a
// materializar miles de filas en cada funcion de Vercel.
export const MARKETPLACE_CATALOG_REVALIDATE_SECONDS = 30
export const MARKETPLACE_DIRECTORY_REVALIDATE_SECONDS = 300

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Los ids de categoria se interpolan dentro de un `.or(...)` de PostgREST, donde
 * la coma separa condiciones. Comprobar que sean UUID es lo que impide que un
 * `?categoria=` armado a mano agregue condiciones propias, y de paso evita
 * mandar a la base una consulta que solo puede fallar.
 */
function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim())
}

/**
 * Terminos de busqueda dentro de un `.or('col.ilike.%term%,...')`.
 *
 * `sanitizeFilterTerm` saca lo que rompe la gramatica del filtro —la coma, los
 * parentesis, la comilla, la barra y los comodines `%` y `*`— pero conserva el
 * punto y el guion bajo, que son parte de nombres y codigos reales: un SKU como
 * `ABC-1.5L` tiene que seguir encontrandose.
 */
function buildProductSearchExpression(rawQuery: string) {
  const term = sanitizeFilterTerm(rawQuery)
  if (!term) return null

  return ['name', 'sku', 'brand', 'description']
    .map((column) => `${column}.ilike.%${term}%`)
    .join(',')
}

/**
 * Una categoria padre incluye a sus hijas. Devuelve null cuando el id no es un
 * UUID: no existe esa categoria, asi que no hace falta preguntarle nada a la
 * base y el catalogo filtrado por ella esta vacio.
 */
async function resolveCategoryIds(
  supabase: ReturnType<typeof createAdminSupabase>,
  categoria: string
): Promise<string[] | null> {
  if (!isUuid(categoria)) return null

  const id = categoria.trim()
  const { data } = await supabase
    .from('categories')
    .select('id')
    .or(`id.eq.${id},parent_id.eq.${id},global_category_id.eq.${id}`)

  const ids = (data ?? []).map((row) => String(row.id))
  return ids.length > 0 ? ids : [id]
}

export type MarketplaceOrganization = {
  id: string
  name: string
  slug: string
  plan: string | null
  logo_url: string | null
  business_vertical?: string | null
  operating_model?: string | null
  rubro?: string | null
  city?: string | null
  address?: string | null
  maps_url?: string | null
  slogan?: string | null
  description?: string | null
  brand_color?: string | null
  custom_brand_color?: string | null
  phone?: string | null
  email?: string | null
  whatsapp?: string | null
  instagram?: string | null
  facebook?: string | null
  tiktok?: string | null
  hours?: {
    weekdays?: string
    saturday?: string
    sunday?: string
  } | null
  ruc?: string | null
  business_type?: string | null
  created_at: string | null
  /** Publicados y con stock: lo que un comprador ve en el marketplace. */
  products_count: number
  /**
   * Todo lo activo, publicado o no. La diferencia con `products_count` es lo que
   * permite decir «catalogo interno» en vez de «sin productos» a una tienda que
   * usa el sistema puertas adentro.
   */
  products_total?: number
  featured_products: PublicProduct[]
  review_rating_avg?: number | null
  review_count?: number | null
}

export type MarketplaceProduct = PublicProduct & {
  organization_id: string
  organization_name: string
  organization_slug: string
  organization_logo_url?: string | null
  organization_city?: string | null
  organization_address?: string | null
  organization_maps_url?: string | null
  created_at?: string | null
}

export type MarketplaceCategory = {
  id: string
  name: string
  parent_id?: string | null
  organization_count: number
  product_count: number
}

export type MarketplaceBrand = {
  name: string
  logo_url?: string | null
  product_count: number
  organization_count: number
}

type OrganizationRow = {
  id: string
  name: string
  slug: string
  plan: string | null
  logo_url: string | null
  business_vertical?: string | null
  operating_model?: string | null
  created_at: string | null
  review_rating_avg?: number | null
  review_count?: number | null
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
  has_variants?: boolean | null
  variant_attribute_config?: PublicProduct['variant_attribute_config'] | null
  created_at?: string | null
  categories?: { id: string; name: string } | { id: string; name: string }[] | null
  organizations?: { id: string; name: string; slug: string; logo_url?: string | null } | { id: string; name: string; slug: string; logo_url?: string | null }[] | null
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
    has_variants: Boolean(product.has_variants),
    variant_attribute_config: product.variant_attribute_config ?? undefined,
  }
}

function getProductCategory(product: ProductRow) {
  return Array.isArray(product.categories) ? product.categories[0] : product.categories
}

function getProductOrganization(product: ProductRow) {
  return Array.isArray(product.organizations) ? product.organizations[0] : product.organizations
}

export function resolveOrganizationRubro(
  org: { business_vertical?: string | null; name?: string },
  products: ProductRow[] = []
): string {
  const vertical = (org.business_vertical ?? '').toLowerCase().trim()
  if (vertical) {
    if (vertical.includes('tecno') || vertical.includes('celular') || vertical.includes('comput') || vertical.includes('electr')) return 'tecnologia'
    if (vertical.includes('indum') || vertical.includes('ropa') || vertical.includes('calzad') || vertical.includes('moda')) return 'indumentaria'
    if (vertical.includes('gastro') || vertical.includes('comida') || vertical.includes('restaur') || vertical.includes('alimento') || vertical.includes('super')) return 'alimentos'
    if (vertical.includes('ferret') || vertical.includes('herram') || vertical.includes('constr')) return 'ferreteria'
    if (vertical.includes('belleza') || vertical.includes('cosmet') || vertical.includes('estet') || vertical.includes('peluq')) return 'belleza'
    if (vertical.includes('hogar') || vertical.includes('mueble') || vertical.includes('bazar') || vertical.includes('decor')) return 'hogar'
    if (vertical.includes('salud') || vertical.includes('farma')) return 'salud'
    if (vertical.includes('auto') || vertical.includes('moto') || vertical.includes('repuesto')) return 'automotor'
    return vertical
  }

  // Inferir desde las categorías de sus productos
  for (const p of products) {
    const cat = getProductCategory(p)
    const catName = (cat?.name ?? '').toLowerCase()
    if (catName.includes('tecno') || catName.includes('celular') || catName.includes('comput') || catName.includes('electr')) return 'tecnologia'
    if (catName.includes('ropa') || catName.includes('indum') || catName.includes('calzad') || catName.includes('moda')) return 'indumentaria'
    if (catName.includes('alimento') || catName.includes('comida') || catName.includes('bebida') || catName.includes('super')) return 'alimentos'
    if (catName.includes('ferret') || catName.includes('herram') || catName.includes('constr')) return 'ferreteria'
    if (catName.includes('belleza') || catName.includes('cosmet') || catName.includes('peluq')) return 'belleza'
    if (catName.includes('hogar') || catName.includes('mueble') || catName.includes('jardin')) return 'hogar'
    if (catName.includes('salud') || catName.includes('farma')) return 'salud'
    if (catName.includes('auto') || catName.includes('moto')) return 'automotor'
  }

  return 'comercio'
}

async function getMarketplaceOrganizationsUncached(
  limit = 24,
  options?: { q?: string }
): Promise<MarketplaceOrganization[]> {
  const supabase = createAdminSupabase()

  let organizationQuery = supabase
    .from('organizations')
    .select('id, name, slug, plan, logo_url, business_vertical, operating_model, created_at, review_rating_avg, review_count')
    .eq('marketplace_public', true)
    .eq('storefront_public', true)

  if (options?.q) {
    const term = sanitizeFilterTerm(options.q)
    if (term) {
      organizationQuery = organizationQuery.or(`name.ilike.%${term}%,slug.ilike.%${term}%`)
    }
  }

  const { data: organizations, error: organizationError } = await organizationQuery.limit(limit)

  if (organizationError || !organizations?.length) return []

  const organizationRows = organizations as OrganizationRow[]
  const organizationIds = organizationRows.map((organization) => organization.id)

  const [
    { data: products },
    { data: orgSettings },
    { data: branches },
    { data: websiteSettings },
    { data: countRows },
    { data: subscriptionRows },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('id, organization_id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, has_offer, offer_price, image_url, images, unit_measure, barcode, categories(id, name)')
      .in('organization_id', organizationIds)
      .eq('is_active', true)
      .eq('visibility', 'public')
      .gt('stock_quantity', 0)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit * 4),
    supabase
      .from('organization_settings')
      .select('organization_id, city, company_address')
      .in('organization_id', organizationIds),
    supabase
      .from('branches')
      .select('organization_id, city, address, is_default, is_active')
      .in('organization_id', organizationIds)
      .eq('is_active', true),
    supabase
      .from('website_settings')
      .select('organization_id, key, value')
      .in('organization_id', organizationIds)
      .in('key', ['company_info', 'hero_content']),
    // Conteo aparte, sin tope por empresa.
    //
    // `products_count` salia de contar las filas que le tocaban a cada tienda
    // dentro del pozo de arriba, que esta capado en `limit * 4` y ordenado a
    // nivel global: una tienda con muchos productos recientes se llevaba el pozo
    // entero y las demas mostraban 0 aunque tuvieran catalogo.
    //
    // Se traen todos los activos, no solo los publicados, para poder distinguir
    // tres situaciones que antes se veian igual: la tienda que todavia no cargo
    // nada, la que carga pero no publica —usa el sistema puertas adentro— y la
    // que publica pero se quedo sin stock.
    supabase
      .from('products')
      .select('organization_id, visibility, stock_quantity')
      .in('organization_id', organizationIds)
      .eq('is_active', true)
      .limit(20000),
    // Una tienda suspendida o dada de baja no puede seguir figurando entre los
    // comercios adheridos. `organizations` no tiene estado propio: vive en la
    // suscripcion.
    supabase
      .from('subscriptions')
      .select('organization_id, status')
      .in('organization_id', organizationIds),
  ])

  /** Publicados y con stock: lo que un comprador puede ver en el marketplace. */
  const productCountByOrganization = new Map<string, number>()
  /** Todo lo activo, publicado o no: sirve para saber si el catalogo es interno. */
  const productTotalByOrganization = new Map<string, number>()

  ;((countRows ?? []) as Array<{ organization_id: string; visibility: string | null; stock_quantity: number | null }>)
    .forEach((row) => {
      const org = row.organization_id
      productTotalByOrganization.set(org, (productTotalByOrganization.get(org) ?? 0) + 1)

      if (row.visibility === 'public' && Number(row.stock_quantity ?? 0) > 0) {
        productCountByOrganization.set(org, (productCountByOrganization.get(org) ?? 0) + 1)
      }
    })

  const productsByOrganization = new Map<string, ProductRow[]>()
  ;((products ?? []) as unknown as ProductRow[]).forEach((product) => {
    const rows = productsByOrganization.get(product.organization_id) ?? []
    rows.push(product)
    productsByOrganization.set(product.organization_id, rows)
  })

  const settingsByOrganization = new Map<string, { city?: string | null; company_address?: string | null }>()
  ;(orgSettings ?? []).forEach((s) => {
    settingsByOrganization.set(s.organization_id, s)
  })

  const branchesByOrganization = new Map<string, Array<{ city?: string | null; address?: string | null; is_default?: boolean }>>()
  ;(branches ?? []).forEach((b) => {
    const list = branchesByOrganization.get(b.organization_id) ?? []
    list.push(b)
    branchesByOrganization.set(b.organization_id, list)
  })

  const webSettingsByOrganization = new Map<string, Map<string, Record<string, unknown>>>()
  ;(websiteSettings ?? []).forEach((w) => {
    if (w.value && typeof w.value === 'object') {
      const orgMap = webSettingsByOrganization.get(w.organization_id) ?? new Map<string, Record<string, unknown>>()
      orgMap.set(w.key, w.value as Record<string, unknown>)
      webSettingsByOrganization.set(w.organization_id, orgMap)
    }
  })

  /**
   * Estados que sacan a la tienda de la vitrina publica: `past_due`, `canceled`
   * y `suspended`. Una organizacion sin fila de suscripcion se deja pasar a
   * proposito —ya opto explicitamente por publicarse con `marketplace_public` y
   * `storefront_public`—: excluir por un dato faltante vaciaria la seccion sin
   * que nadie sepa por que.
   */
  const ESTADOS_FUERA_DE_VITRINA = new Set(['past_due', 'canceled', 'suspended'])
  const excluidas = new Set(
    ((subscriptionRows ?? []) as Array<{ organization_id: string; status: string | null }>)
      .filter((row) => ESTADOS_FUERA_DE_VITRINA.has(String(row.status ?? '')))
      .map((row) => row.organization_id)
  )

  return organizationRows.filter((organization) => !excluidas.has(organization.id)).map((organization) => {
    const organizationProducts = productsByOrganization.get(organization.id) ?? []
    const resolvedRubro = resolveOrganizationRubro(organization, organizationProducts)
    const orgSetting = settingsByOrganization.get(organization.id)
    const orgBranches = branchesByOrganization.get(organization.id) ?? []
    const defaultBranch = orgBranches.find((b) => b.is_default) || orgBranches[0]
    const orgWebMap = webSettingsByOrganization.get(organization.id)
    const companyInfo = orgWebMap?.get('company_info')
    const heroContent = orgWebMap?.get('hero_content')

    const companyMapsUrl = typeof companyInfo?.mapsUrl === 'string' ? companyInfo.mapsUrl : null
    const companyAddress = typeof companyInfo?.address === 'string' ? companyInfo.address : null
    const slogan = typeof companyInfo?.slogan === 'string' ? companyInfo.slogan : null
    const rawDescription = typeof companyInfo?.description === 'string' && companyInfo.description.trim()
      ? companyInfo.description.trim()
      : (typeof heroContent?.subtitle === 'string' && heroContent.subtitle.trim() ? heroContent.subtitle.trim() : null)
    const description = rawDescription || slogan || null
    const brandColor = typeof companyInfo?.brandColor === 'string' ? companyInfo.brandColor : null
    const customBrandColor = typeof companyInfo?.customBrandColor === 'string' ? companyInfo.customBrandColor : null
    const phone = typeof companyInfo?.phone === 'string' ? companyInfo.phone : (orgSetting as any)?.company_phone || null
    const email = typeof companyInfo?.email === 'string' ? companyInfo.email : (orgSetting as any)?.company_email || null
    const whatsapp = typeof companyInfo?.whatsapp === 'string' ? companyInfo.whatsapp : null
    const instagram = typeof companyInfo?.instagram === 'string' ? companyInfo.instagram : null
    const facebook = typeof companyInfo?.facebook === 'string' ? companyInfo.facebook : null
    const tiktok = typeof companyInfo?.tiktok === 'string' ? companyInfo.tiktok : null
    const hours = (companyInfo?.hours && typeof companyInfo.hours === 'object') ? (companyInfo.hours as { weekdays?: string; saturday?: string; sunday?: string }) : null
    const ruc = typeof companyInfo?.ruc === 'string' ? companyInfo.ruc : (orgSetting as any)?.company_ruc || null
    const businessType = typeof companyInfo?.businessType === 'string' ? companyInfo.businessType : null

    const city = orgSetting?.city?.trim() || defaultBranch?.city?.trim() || null
    const address = orgSetting?.company_address?.trim() || defaultBranch?.address?.trim() || companyAddress?.trim() || null
    const mapsHref = getCompanyMapsHref(companyMapsUrl, address || (city ? `${city}, Paraguay` : null))

    return {
      ...organization,
      rubro: resolvedRubro,
      city,
      address,
      maps_url: mapsHref,
      slogan,
      description,
      brand_color: brandColor,
      custom_brand_color: customBrandColor,
      phone,
      email,
      whatsapp,
      instagram,
      facebook,
      tiktok,
      hours,
      ruc,
      business_type: businessType,
      products_count: productCountByOrganization.get(organization.id) ?? 0,
      products_total: productTotalByOrganization.get(organization.id) ?? 0,
      featured_products: organizationProducts.slice(0, 3).map(toPublicProduct),
      review_rating_avg: organization.review_rating_avg ?? null,
      review_count: organization.review_count ?? null,
    }
  }).sort((a, b) => {
    // Primero por calificación promedio (mayor primero)
    const ratingA = Number(a.review_rating_avg ?? 0)
    const ratingB = Number(b.review_rating_avg ?? 0)
    if (ratingB !== ratingA) return ratingB - ratingA
    // Luego por cantidad de reseñas (más primero)
    const countA = Number(a.review_count ?? 0)
    const countB = Number(b.review_count ?? 0)
    if (countB !== countA) return countB - countA
    // Finalmente por fecha de creación (más reciente primero)
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })
}

type MarketplaceProductFilters = {
  q?: string
  categoria?: string
  subcategoria?: string
  marca?: string
}

// Solo se cachea informacion expresamente publica. Los argumentos forman parte
// de la clave, por lo que filtros distintos no mezclan resultados entre si.
const getCachedMarketplaceOrganizations = unstable_cache(
  getMarketplaceOrganizationsUncached,
  ['marketplace-organizations'],
  { revalidate: MARKETPLACE_DIRECTORY_REVALIDATE_SECONDS, tags: ['marketplace:organizations'] }
)

const getCachedMarketplaceProductsPage = unstable_cache(
  getMarketplaceProductsPageUncached,
  ['marketplace-products'],
  { revalidate: MARKETPLACE_CATALOG_REVALIDATE_SECONDS, tags: ['marketplace:products'] }
)

export const getMarketplaceCategories = unstable_cache(
  getMarketplaceCategoriesUncached,
  ['marketplace-categories'],
  { revalidate: MARKETPLACE_DIRECTORY_REVALIDATE_SECONDS, tags: ['marketplace:categories'] }
)

const getCachedMarketplaceBrands = unstable_cache(
  getMarketplaceBrandsUncached,
  ['marketplace-brands'],
  { revalidate: MARKETPLACE_DIRECTORY_REVALIDATE_SECONDS, tags: ['marketplace:brands'] }
)

export const getMarketplaceOffers = unstable_cache(
  getMarketplaceOffersUncached,
  ['marketplace-offers'],
  { revalidate: MARKETPLACE_CATALOG_REVALIDATE_SECONDS, tags: ['marketplace:offers'] }
)

function hasMarketplaceProductFilters(options?: MarketplaceProductFilters) {
  return Boolean(options?.q || options?.categoria || options?.subcategoria || options?.marca)
}

export function getMarketplaceOrganizations(limit = 24, options?: { q?: string }) {
  // Una busqueda libre puede producir claves ilimitadas. Solo el directorio
  // estable se comparte entre visitas.
  return options?.q
    ? getMarketplaceOrganizationsUncached(limit, options)
    : getCachedMarketplaceOrganizations(limit)
}

export function getMarketplaceProductsPage(limit = 48, options?: MarketplaceProductFilters) {
  return hasMarketplaceProductFilters(options)
    ? getMarketplaceProductsPageUncached(limit, options)
    : getCachedMarketplaceProductsPage(limit)
}

export function getMarketplaceBrands(limit = 50, options?: { categoria?: string }) {
  // Las variantes por categoria se consultan bajo demanda; la portada reutiliza
  // el ranking global y evita materializar hasta 20.000 filas por visita.
  return options?.categoria
    ? getMarketplaceBrandsUncached(limit, options)
    : getCachedMarketplaceBrands(limit)
}

export type MarketplaceProductsPage = {
  products: MarketplaceProduct[]
  total: number
}

async function getMarketplaceProductsPageUncached(
  limit = 48,
  options?: MarketplaceProductFilters
): Promise<MarketplaceProductsPage> {
  const supabase = createAdminSupabase()

  let query = supabase
    .from('products')
    .select('id, organization_id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, has_offer, offer_price, image_url, images, unit_measure, barcode, has_variants, variant_attribute_config, categories(id, name, parent_id), organizations!inner(id, name, slug, logo_url)', { count: 'exact' })
    .eq('is_active', true)
    .eq('visibility', 'public')
    .eq('organizations.marketplace_public', true)
    .eq('organizations.storefront_public', true)
    .gt('stock_quantity', 0)

  // Filtro por marca
  if (options?.marca) {
    const marcaClean = options.marca.trim()
    if (marcaClean) {
      query = query.ilike('brand', marcaClean)
    }
  }

  // Filtro por subcategoría específica
  if (options?.subcategoria) {
    query = query.eq('category_id', options.subcategoria)
  } else if (options?.categoria) {
    // Si se pasa una categoría padre, buscar todos los hijos/subcategorías para incluir sus productos
    const categoryIds = await resolveCategoryIds(supabase, options.categoria)
    if (!categoryIds) return { products: [], total: 0 }
    query = query.in('category_id', categoryIds)
  }

  if (options?.q) {
    const searchExpression = buildProductSearchExpression(options.q)
    if (searchExpression) {
      query = query.or(searchExpression)
    }
  }

  const { data, count, error } = await query
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return { products: [], total: 0 }

  const rows = (data ?? []) as unknown as ProductRow[]
  const productIds = rows.map((product) => product.id)
  const { data: variantRows } = productIds.length > 0
    ? await supabase
        .from('product_variants')
        .select('id, product_id, variant_name, attributes, sku, sale_price, stock_quantity, is_active')
        .in('product_id', productIds)
        .eq('is_active', true)
        .order('variant_name')
    : { data: [] }
  const variantsByProduct = new Map<string, PublicProductVariant[]>()
  for (const variant of variantRows ?? []) {
    const key = String(variant.product_id)
    const list = variantsByProduct.get(key) ?? []
    list.push({
      id: String(variant.id),
      product_id: key,
      variant_name: String(variant.variant_name ?? ''),
      attributes: variant.attributes && typeof variant.attributes === 'object' && !Array.isArray(variant.attributes) ? variant.attributes as Record<string, string> : {},
      sku: variant.sku ? String(variant.sku) : null,
      sale_price: Number(variant.sale_price ?? 0),
      stock_quantity: Number(variant.stock_quantity ?? 0),
      is_active: Boolean(variant.is_active),
    })
    variantsByProduct.set(key, list)
  }
  const organizationIds = [...new Set(rows.map((product) => product.organization_id))]
  const [
    { data: automaticRows },
    { data: orgSettings },
    { data: branches },
    { data: websiteSettings },
  ] = organizationIds.length > 0
    ? await Promise.all([
        supabase.from('promotions').select('*').in('organization_id', organizationIds).eq('public_mode', 'automatic').eq('is_active', true),
        supabase.from('organization_settings').select('organization_id, city, company_address').in('organization_id', organizationIds),
        supabase.from('branches').select('organization_id, city, address, is_default, is_active').in('organization_id', organizationIds).eq('is_active', true),
        supabase.from('website_settings').select('organization_id, key, value').in('organization_id', organizationIds).in('key', ['company_info']),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const promotionsByOrganization = new Map<string, ReturnType<typeof mapPublicPromotion>[]>()
  ;(automaticRows ?? []).forEach((row) => {
    const organizationId = String(row.organization_id)
    const promotions = promotionsByOrganization.get(organizationId) ?? []
    promotions.push(mapPublicPromotion(row as Record<string, unknown>))
    promotionsByOrganization.set(organizationId, promotions)
  })

  const settingsByOrganization = new Map<string, { city?: string | null; company_address?: string | null }>()
  ;(orgSettings ?? []).forEach((s) => {
    settingsByOrganization.set(s.organization_id, s)
  })

  const branchesByOrganization = new Map<string, Array<{ city?: string | null; address?: string | null; is_default?: boolean }>>()
  ;(branches ?? []).forEach((b) => {
    const list = branchesByOrganization.get(b.organization_id) ?? []
    list.push(b)
    branchesByOrganization.set(b.organization_id, list)
  })

  const webSettingsByOrganization = new Map<string, Record<string, unknown>>()
  ;(websiteSettings ?? []).forEach((w) => {
    if (w.value && typeof w.value === 'object') {
      webSettingsByOrganization.set(w.organization_id, w.value as Record<string, unknown>)
    }
  })

  const products = rows
    .map<MarketplaceProduct | null>((product) => {
      const organization = getProductOrganization(product)
      if (!organization) return null
      const publicProduct = toPublicProduct(product)
      const variants = variantsByProduct.get(product.id) ?? []
      const priced = applyAutomaticPromotionToProduct({
        ...publicProduct,
        category_id: publicProduct.category?.id ?? null,
      }, promotionsByOrganization.get(product.organization_id) ?? [])

      const orgSetting = settingsByOrganization.get(product.organization_id)
      const orgBranches = branchesByOrganization.get(product.organization_id) ?? []
      const defaultBranch = orgBranches.find((b) => b.is_default) || orgBranches[0]
      const companyInfo = webSettingsByOrganization.get(product.organization_id)

      const city = orgSetting?.city?.trim() || defaultBranch?.city?.trim() || null
      const companyAddress = typeof companyInfo?.address === 'string' ? companyInfo.address : null
      const companyMapsUrl = typeof companyInfo?.mapsUrl === 'string' ? companyInfo.mapsUrl : null
      const address = orgSetting?.company_address?.trim() || defaultBranch?.address?.trim() || companyAddress?.trim() || null
      const mapsHref = getCompanyMapsHref(companyMapsUrl, address || (city ? `${city}, Paraguay` : null))

      return {
        ...publicProduct,
        has_variants: variants.length > 0,
        variants,
        has_offer: priced.has_offer,
        offer_price: priced.offer_price,
        promotion_name: priced.promotion_name,
        organization_id: product.organization_id,
        organization_name: organization.name,
        organization_slug: organization.slug,
        organization_logo_url: organization.logo_url ?? null,
        organization_city: city,
        organization_address: address,
        organization_maps_url: mapsHref,
      }
    })
    .filter((product): product is MarketplaceProduct => product !== null)

  return {
    products,
    total: count ?? products.length,
  }
}

async function getMarketplaceCategoriesUncached(): Promise<MarketplaceCategory[]> {
  const supabase = createAdminSupabase()

  // Doble nivel: si la categoría tenant tiene global_category_id →
  // agrupa por la categoría global (normalizada). Si no → usa la del tenant.
  const { data, error } = await supabase
    .from('products')
    .select(`
      organization_id,
      categories(id, name, parent_id, global_category_id, global_categories:global_category_id(id, name, slug, parent_id)),
      organizations!inner(id)
    `)
    .eq('is_active', true)
    .eq('visibility', 'public')
    .eq('organizations.marketplace_public', true)
    .eq('organizations.storefront_public', true)
    .gt('stock_quantity', 0)
    .limit(20000)

  if (error || !data) return []

  const categories = new Map<string, MarketplaceCategory & { organizationIds: Set<string> }>()

  ;((data ?? []) as unknown as ProductRow[]).forEach((product) => {
    const tenantCategory = getProductCategory(product)
    if (!tenantCategory) return

    // Preferir la categoría global si existe
    const globalCategoryRelation = (tenantCategory as { parent_id?: string | null; global_categories?: { id: string; name: string; parent_id?: string | null } | { id: string; name: string; parent_id?: string | null }[] | null }).global_categories
    const globalCat = Array.isArray(globalCategoryRelation) ? globalCategoryRelation[0] : globalCategoryRelation
    const displayId   = globalCat?.id   ?? tenantCategory.id
    const displayName = globalCat?.name ?? tenantCategory.name
    const parentId    = globalCat?.parent_id ?? (tenantCategory as { parent_id?: string | null }).parent_id ?? null

    const existing = categories.get(displayId) ?? {
      id: displayId,
      name: displayName,
      parent_id: parentId,
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
    .map((category) => ({
      id: category.id,
      name: category.name,
      parent_id: category.parent_id ?? null,
      product_count: category.product_count,
      organization_count: category.organization_count,
    }))
    .sort((a, b) => b.product_count - a.product_count)
}

async function getMarketplaceBrandsUncached(
  limit = 50,
  options?: { categoria?: string }
): Promise<MarketplaceBrand[]> {
  const supabase = createAdminSupabase()

  let query = supabase
    .from('products')
    .select('organization_id, brand, brand_id, category_id, brands:brand_id(name, logo_url), organizations!inner(id)')
    .eq('is_active', true)
    .eq('visibility', 'public')
    .eq('organizations.marketplace_public', true)
    .eq('organizations.storefront_public', true)
    .gt('stock_quantity', 0)

  if (options?.categoria) {
    const categoryIds = await resolveCategoryIds(supabase, options.categoria)
    if (!categoryIds) return []
    query = query.in('category_id', categoryIds)
  }

  const { data, error } = await query.limit(20000)

  if (error || !data) return []

  type BrandRow = { organization_id: string; brand: string | null; brands: { name: string; logo_url?: string | null } | null }
  const brands = new Map<string, MarketplaceBrand & { organizationIds: Set<string>; nameCounts: Map<string, number> }>()

  ;((data ?? []) as unknown as BrandRow[]).forEach((row) => {
    const rawName = (row.brands?.name ?? row.brand ?? '').trim()
    if (!rawName) return

    const key = rawName.toLowerCase()
    const brandLogo = row.brands?.logo_url || null

    const existing = brands.get(key) ?? {
      name: rawName,
      logo_url: brandLogo,
      product_count: 0,
      organization_count: 0,
      organizationIds: new Set<string>(),
      nameCounts: new Map<string, number>(),
    }

    if (brandLogo && !existing.logo_url) {
      existing.logo_url = brandLogo
    }

    existing.product_count += 1
    existing.organizationIds.add(row.organization_id)
    existing.organization_count = existing.organizationIds.size

    const count = existing.nameCounts.get(rawName) ?? 0
    existing.nameCounts.set(rawName, count + 1)

    let best = existing.name
    let bestCount = existing.nameCounts.get(best) ?? 0
    for (const [n, c] of existing.nameCounts) {
      if (c > bestCount) { best = n; bestCount = c }
    }
    existing.name = best

    brands.set(key, existing)
  })

  return Array.from(brands.values())
    .filter((brand) => brand.product_count > 0)
    .map((brand) => ({
      name: brand.name,
      logo_url: brand.logo_url ?? null,
      product_count: brand.product_count,
      organization_count: brand.organization_count,
    }))
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, limit)
}

export async function getPublicOrganizationPage(slug: string) {
  const supabase = createAdminSupabase()

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, logo_url, business_vertical, created_at')
    .eq('slug', slug)
    .eq('marketplace_public', true)
    .eq('storefront_public', true)
    .maybeSingle()

  if (organizationError || !organization) return null

  // Una tienda suspendida o dada de baja tampoco tiene perfil publico: sin esto
  // salia del listado pero su pagina seguia accesible por URL directa.
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('organization_id', organization.id)
    .maybeSingle()

  if (subscription && ['past_due', 'canceled', 'suspended'].includes(String(subscription.status ?? ''))) {
    return null
  }

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
    .gt('stock_quantity', 0)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(24)

  const productRows = (products ?? []) as unknown as ProductRow[]

  return {
    organization: {
      ...(organization as OrganizationRow),
      // El rubro no venia resuelto en esta pagina: se calcula igual que en el
      // listado, del `business_vertical` o de las categorias de sus productos.
      rubro: resolveOrganizationRubro(organization as OrganizationRow, productRows),
    },
    companyInfo: settingsMap.get('company_info') as Record<string, unknown> | undefined,
    heroContent: settingsMap.get('hero_content') as Record<string, unknown> | undefined,
    products: productRows.map(toPublicProduct),
  }
}

export async function getStorefrontOffers(tenantSlug: string | null): Promise<MarketplaceProduct[]> {
  const supabase = createAdminSupabase()
  const slug = tenantSlug || 'default'

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, logo_url, marketplace_public, storefront_public')
    .eq('slug', slug)
    .maybeSingle()

  if (!organization || organization.storefront_public !== true) {
    return []
  }

  const { data: promotionRows } = await supabase
    .from('promotions')
    .select('*')
    .eq('organization_id', organization.id)
    .eq('public_mode', 'automatic')
    .eq('is_active', true)

  const automaticPromotions = (promotionRows ?? []).map((row) => mapPublicPromotion(row as Record<string, unknown>))
  const offerCandidateFilter = buildPublicOfferCandidateFilter(automaticPromotions)

  const { data, error } = await supabase
    .from('products')
    // Agregamos has_variants y variant_attribute_config para calcular stock y atributos reales de productos con variantes
    .select('id, organization_id, name, sku, description, brand, sale_price, stock_quantity, has_variants, variant_attribute_config, is_active, featured, has_offer, offer_price, image_url, images, unit_measure, barcode, created_at, categories(id, name)')
    .eq('organization_id', organization.id)
    .eq('is_active', true)
    .eq('visibility', 'public')
    .or(offerCandidateFilter)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !data) return []

  const rows = data as unknown as (ProductRow & { has_variants?: boolean })[]

  // Buscar variantes de productos que las tengan, para calcular stock real
  const variantProductIds = rows
    .filter((r) => Boolean(r.has_variants))
    .map((r) => r.id)

  let variantsByProduct = new Map<string, PublicProductVariant[]>()
  if (variantProductIds.length > 0) {
    const { data: variantsData } = await supabase
      .from('product_variants')
      .select('id, product_id, variant_name, attributes, sku, sale_price, stock_quantity, is_active')
      .in('product_id', variantProductIds)
      .eq('is_active', true)

    if (variantsData) {
      for (const v of variantsData) {
        const key = String(v.product_id)
        if (!variantsByProduct.has(key)) variantsByProduct.set(key, [])
        variantsByProduct.get(key)!.push({
          id: String(v.id),
          product_id: key,
          variant_name: String(v.variant_name ?? ''),
          attributes: v.attributes && typeof v.attributes === 'object' && !Array.isArray(v.attributes) ? v.attributes as Record<string, string> : {},
          sku: v.sku ? String(v.sku) : null,
          sale_price: Number(v.sale_price ?? 0),
          stock_quantity: Number(v.stock_quantity ?? 0),
          is_active: Boolean(v.is_active),
        })
      }
    }
  }

  return rows
    .map<MarketplaceProduct>((product) => {
      const category = Array.isArray(product.categories) ? product.categories[0] : product.categories
      const cat = category ? { id: category.id, name: category.name } : undefined

      // Stock real: suma variantes si has_variants, de lo contrario usa el campo del producto
      const productVariants = variantsByProduct.get(String(product.id)) ?? []
      const publicStock = Boolean(product.has_variants) && productVariants.length > 0
        ? productVariants.reduce((sum, v) => sum + v.stock_quantity, 0)
        : Number(product.stock_quantity ?? 0)

      const variantConfig = (Array.isArray(product.variant_attribute_config) && product.variant_attribute_config.length > 0)
        ? product.variant_attribute_config
        : (productVariants.length > 0 ? (deriveVariantAttributeConfig(productVariants) as PublicProduct['variant_attribute_config']) : undefined)

      const publicProduct = toPublicProduct(product)
      // Sobrescribir in_stock y stock_quantity con el valor variant-aware
      publicProduct.in_stock = publicStock > 0
      publicProduct.stock_quantity = publicStock
      publicProduct.has_variants = Boolean(product.has_variants) || productVariants.length > 0
      publicProduct.variant_attribute_config = variantConfig
      publicProduct.variants = productVariants

      const priced = applyAutomaticPromotionToProduct({
        ...publicProduct,
        category_id: cat?.id ?? null,
      }, automaticPromotions)

      return {
        ...publicProduct,
        has_variants: productVariants.length > 0,
        variants: productVariants,
        variant_attribute_config: variantConfig,
        category: cat,
        has_offer: priced.has_offer,
        offer_price: priced.offer_price,
        promotion_name: priced.promotion_name,
        organization_id: organization.id,
        organization_name: organization.name,
        organization_slug: organization.slug,
        created_at: product.created_at ?? null,
      }
    })
    .filter((product) => Boolean(product.has_offer && product.offer_price && product.offer_price < product.sale_price))
}

async function getMarketplaceOffersUncached(limit = 100): Promise<MarketplaceProduct[]> {
  const supabase = createAdminSupabase()

  // 1. Obtener todas las organizaciones públicas en el marketplace
  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, name, slug, logo_url')
    .eq('marketplace_public', true)
    .eq('storefront_public', true)

  if (!organizations || organizations.length === 0) return []

  const organizationIds = organizations.map((o) => o.id)
  const orgMap = new Map(organizations.map((o) => [o.id, o]))

  // 2. Obtener promociones automáticas vigentes y datos de ubicación de estas organizaciones
  const [
    { data: promotionRows },
    { data: orgSettings },
    { data: branches },
    { data: websiteSettings },
  ] = await Promise.all([
    supabase.from('promotions').select('*').in('organization_id', organizationIds).eq('public_mode', 'automatic').eq('is_active', true),
    supabase.from('organization_settings').select('organization_id, city, company_address').in('organization_id', organizationIds),
    supabase.from('branches').select('organization_id, city, address, is_default, is_active').in('organization_id', organizationIds).eq('is_active', true),
    supabase.from('website_settings').select('organization_id, key, value').in('organization_id', organizationIds).in('key', ['company_info']),
  ])

  const automaticPromotions = (promotionRows ?? []).map((row) => mapPublicPromotion(row as Record<string, unknown>))
  const promotionsByOrg = new Map<string, ReturnType<typeof mapPublicPromotion>[]>()
  ;(promotionRows ?? []).forEach((row) => {
    const orgId = String(row.organization_id)
    const list = promotionsByOrg.get(orgId) ?? []
    list.push(mapPublicPromotion(row as Record<string, unknown>))
    promotionsByOrg.set(orgId, list)
  })

  const settingsByOrganization = new Map<string, { city?: string | null; company_address?: string | null }>()
  ;(orgSettings ?? []).forEach((s) => {
    settingsByOrganization.set(s.organization_id, s)
  })

  const branchesByOrganization = new Map<string, Array<{ city?: string | null; address?: string | null; is_default?: boolean }>>()
  ;(branches ?? []).forEach((b) => {
    const list = branchesByOrganization.get(b.organization_id) ?? []
    list.push(b)
    branchesByOrganization.set(b.organization_id, list)
  })

  const webSettingsByOrganization = new Map<string, Record<string, unknown>>()
  ;(websiteSettings ?? []).forEach((w) => {
    if (w.value && typeof w.value === 'object') {
      webSettingsByOrganization.set(w.organization_id, w.value as Record<string, unknown>)
    }
  })

  const offerCandidateFilter = buildPublicOfferCandidateFilter(automaticPromotions)

  // 3. Consultar todos los productos con oferta directa o promociones automáticas
  const { data, error } = await supabase
    .from('products')
    .select('id, organization_id, name, sku, description, brand, sale_price, stock_quantity, is_active, featured, has_offer, offer_price, image_url, images, unit_measure, barcode, created_at, categories(id, name)')
    .in('organization_id', organizationIds)
    .eq('is_active', true)
    .eq('visibility', 'public')
    .gt('stock_quantity', 0)
    .or(offerCandidateFilter)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  const rows = data as unknown as ProductRow[]

  return rows
    .map<MarketplaceProduct | null>((product) => {
      const org = orgMap.get(product.organization_id)
      if (!org) return null

      const category = Array.isArray(product.categories) ? product.categories[0] : product.categories
      const cat = category ? { id: category.id, name: category.name } : undefined
      const publicProduct = toPublicProduct(product)
      const orgPromos = promotionsByOrg.get(product.organization_id) ?? []
      const priced = applyAutomaticPromotionToProduct({
        ...publicProduct,
        category_id: cat?.id ?? null,
      }, orgPromos)

      const orgSetting = settingsByOrganization.get(product.organization_id)
      const orgBranches = branchesByOrganization.get(product.organization_id) ?? []
      const defaultBranch = orgBranches.find((b) => b.is_default) || orgBranches[0]
      const companyInfo = webSettingsByOrganization.get(product.organization_id)

      const city = orgSetting?.city?.trim() || defaultBranch?.city?.trim() || null
      const companyAddress = typeof companyInfo?.address === 'string' ? companyInfo.address : null
      const companyMapsUrl = typeof companyInfo?.mapsUrl === 'string' ? companyInfo.mapsUrl : null
      const address = orgSetting?.company_address?.trim() || defaultBranch?.address?.trim() || companyAddress?.trim() || null
      const mapsHref = getCompanyMapsHref(companyMapsUrl, address || (city ? `${city}, Paraguay` : null))

      return {
        ...publicProduct,
        category: cat,
        has_offer: priced.has_offer,
        offer_price: priced.offer_price,
        promotion_name: priced.promotion_name,
        organization_id: org.id,
        organization_name: org.name,
        organization_slug: org.slug,
        organization_logo_url: org.logo_url ?? null,
        organization_city: city,
        organization_address: address,
        organization_maps_url: mapsHref,
        created_at: product.created_at ?? null,
      }
    })
    .filter((product): product is MarketplaceProduct => Boolean(product && product.has_offer && product.offer_price && product.offer_price < product.sale_price))
}
