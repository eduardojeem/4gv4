import { MarketplaceBusinessPromo } from '@/components/public/MarketplaceBusinessPromo'
import { getScopedLocationCatalog } from '@/lib/public/marketplace-location-catalog'
import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seo/page-metadata'
import Link from './MarketplaceLink'
import { ArrowRight, Building2, Package, Sparkles, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketplaceProductCarousel } from '@/components/public/MarketplaceProductCarousel'
import { CategoryCarouselSection } from '@/components/public/CategoryCarouselSection'
import { MarketplaceSearchBox } from '@/components/public/MarketplaceSearchBox'
import { MarketplaceOffersSection, type MarketplaceOfferGroup } from '@/components/public/MarketplaceOffersSection'
import { getMarketplaceOrganizations, getMarketplaceOrganizationCount, getMarketplaceProductsPage, getMarketplaceBrands, getMarketplaceOffers } from '@/lib/public/marketplace'
import { MarketplaceBrandsSection } from '@/components/public/MarketplaceBrandsSection'
import { DEFAULT_PLATFORM_BRANDING, getPlatformBranding } from '@/lib/platform/branding'
import { getPlatformAnnouncements } from '@/lib/platform/announcement'
import { pickLiveAnnouncement } from '@/lib/announcements/announcement'
import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import { OrganizationDirectoryCard } from '@/components/public/OrganizationDirectoryCard'
import { MarketplaceBusinessPromoShowcase } from '@/components/public/MarketplaceBusinessPromoShowcase'
import { MarketplaceCategoriesShowcase } from '@/components/public/MarketplaceCategoriesShowcase'
import { visibleDirectoryStats } from '@/lib/public/business-directory'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding().catch(() => DEFAULT_PLATFORM_BRANDING)
  return publicPageMetadata({
    title: `${branding.marketplaceName} | ${branding.platformName}`,
    description: branding.marketplaceTagline?.trim()
      ? `${branding.marketplaceTagline.trim()}. Productos, tiendas y servicios técnicos en un solo lugar.`
      : 'Encontrá productos, tiendas y servicios técnicos de comercios de todo el país en un solo lugar.',
    path: '/marketplace',
  })
}

// Cinco minutos de respaldo; las escrituras del catálogo invalidan sus tags.
// Debe ser literal para que Next pueda analizar la configuración de la ruta.
export const revalidate = 300
const MARKETPLACE_HOME_PRODUCT_LIMIT = 24
const MARKETPLACE_HOME_OFFER_LIMIT = 48

/**
 * Respaldo solo para `next build`. En CI se compila con un Supabase de prueba y
 * la portada se prerenderiza: sin respaldo el build fallaba. En producción un
 * fallo del catálogo tiene que llegar a error.tsx («No pudimos cargar el
 * marketplace» con «Reintentar»), no mostrar un marketplace vacío que parece
 * no tener productos. Lo prerenderizado vacío se regenera a los 5 minutos.
 */
function duringBuild<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return process.env.NEXT_PHASE === 'phase-production-build' ? promise.catch(() => fallback) : promise
}

export async function MarketplaceHomeContent({scoped=null}:{scoped?:Awaited<ReturnType<typeof getScopedLocationCatalog>>|null}={}) {
  const [organizationRows, organizationCount, marketplacePage, brands, marketplaceOffers, announcement] = await Promise.all([
    scoped?Promise.resolve(scoped.stores):getMarketplaceOrganizations().catch(() => []),
    scoped?Promise.resolve(scoped.stores.length):getMarketplaceOrganizationCount().catch(() => 0),
    scoped?Promise.resolve({products:scoped.products.slice(0,MARKETPLACE_HOME_PRODUCT_LIMIT),total:scoped.products.length}):duringBuild(getMarketplaceProductsPage(MARKETPLACE_HOME_PRODUCT_LIMIT), { products: [], total: 0 }),
    scoped?Promise.resolve([...new Map(scoped.products.filter(product=>product.brand).map(product=>[product.brand!,{name:product.brand!,logo_url:null,product_count:scoped.products.filter(item=>item.brand===product.brand).length,organization_count:new Set(scoped.products.filter(item=>item.brand===product.brand).map(item=>item.organization_id)).size}])).values()]):duringBuild(getMarketplaceBrands(30), []),
    scoped?Promise.resolve(scoped.products.filter(product=>product.has_offer&&!product.hide_price).slice(0,MARKETPLACE_HOME_OFFER_LIMIT)):duringBuild(getMarketplaceOffers(MARKETPLACE_HOME_OFFER_LIMIT), []),
    getPlatformAnnouncements().catch(() => []),
  ])
  // Both client sections share these objects; neither displays more than four
  // products per store. Trim once to preserve RSC reference deduplication.
  const organizations = organizationRows.map(organization => ({
    ...organization,
    featured_products: organization.featured_products.slice(0, 4),
  }))
  const marketplaceProducts = marketplacePage.products

  const featuredProducts = marketplaceProducts.filter((product) => product.featured)
  const restProducts = marketplaceProducts.filter((product) => !product.featured)
  const carouselProducts = [...featuredProducts, ...restProducts].slice(0, 24)
  const offerGroupsMap = new Map<string, MarketplaceOfferGroup>()

  marketplaceOffers
    .filter((product) => product.has_offer && product.offer_price && product.offer_price < product.sale_price)
    .forEach((product) => {
      const existing = offerGroupsMap.get(product.organization_id) ?? {
        organizationId: product.organization_id,
        organizationName: product.organization_name,
        organizationSlug: product.organization_slug,
        products: [],
      }

      existing.products.push(product)
      offerGroupsMap.set(product.organization_id, existing)
    })

  const offerGroups = Array.from(offerGroupsMap.values())
    .map((group) => ({
      ...group,
      products: group.products
        .sort((a, b) => Number(b.featured) - Number(a.featured))
        .slice(0, 12),
    }))
    .sort((a, b) => b.products.length - a.products.length)

  const totalProducts = marketplacePage.total
  // Mismo criterio que /saas/negocios: «10 tiendas» resta más de lo que suma.
  // Cada cifra aparece sola al llegar a su mínimo.
  const storeCount = Math.max(organizations.length, organizationCount)
  const shownStats = new Set(visibleDirectoryStats({ stores: storeCount, cities: 0, products: totalProducts }).map((stat) => stat.key))

  const scopedCategoryMap=new Map<string,{id:string;name:string;parent_id:null;product_count:number;organization_count:number}>()
  if(scoped)for(const product of scoped.products)if(product.category){const category=scopedCategoryMap.get(product.category.id)??{id:product.category.id,name:product.category.name,parent_id:null,product_count:0,organization_count:1};category.product_count++;scopedCategoryMap.set(category.id,category)}
  return (
    <div>
      <AnnouncementModal announcement={pickLiveAnnouncement(announcement, new Date())} scope="marketplace" />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,rgba(6,182,212,0.13),transparent)] dark:bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,rgba(6,182,212,0.07),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-1.5 text-sm font-medium text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">
              <Store className="h-3.5 w-3.5" />
              Marketplace público
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-50">
              Productos de empresas
              <span className="block text-cyan-600 dark:text-cyan-400">en un solo lugar</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 dark:text-slate-400">
              Buscá por nombre, marca o código. Compará productos y consultá directamente con la tienda que los publica.
            </p>

            {/* Stats, cuando ya pesan */}
            {shownStats.size > 0 && (
            <div className="mt-7 flex flex-wrap items-center justify-center gap-5 text-sm">
              {shownStats.has('stores') && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-950/50">
                  <Building2 className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
                </span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">{storeCount}</strong> tiendas para explorar
              </div>
              )}
              {shownStats.size > 1 && <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />}
              {shownStats.has('products') && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-950/50">
                  <Package className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
                </span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">{totalProducts.toLocaleString('es-PY')}</strong> productos
              </div>
              )}
            </div>
            )}

            <MarketplaceSearchBox className="mx-auto mt-7 max-w-xl" />
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button asChild><Link href="/marketplace/productos">Ver todos los productos</Link></Button>
              <Button asChild variant="outline"><Link href="/marketplace/empresas">Explorar tiendas</Link></Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Carrusel de categorías ── */}
      <section className="border-b border-slate-100 py-4 dark:border-slate-800/60">
        <CategoryCarouselSection
          categories={scoped?[...scopedCategoryMap.values()]:undefined}
          showViewAll
          showCount
        />
      </section>

      {/* ── Carrusel Showcase de Categorías ── */}
      <MarketplaceCategoriesShowcase />

      {offerGroups.length > 0 && <MarketplaceOffersSection groups={offerGroups.slice(0, 6)} />}

      {/* ── Marcas ── */}
      {brands.length > 0 && (
        <section className="border-b border-slate-100 py-8 dark:border-slate-800/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <MarketplaceBrandsSection
              brands={brands}
              variant="carousel"
              maxItems={12}
              showViewAll={true}
              viewAllHref="/marketplace/categorias#marcas"
            />
          </div>
        </section>
      )}

      {/* ── Carrusel de productos ── */}
      {carouselProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Descubrí productos
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Catálogo público de todas las empresas
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
              <Link href="/marketplace/productos">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <MarketplaceProductCarousel products={carouselProducts.slice(0, 16)} rows={2} autoPlay={false} />
        </section>
      )}

      {/* Vitrina visual original: navegación manual, sin repetir otra grilla de productos por tienda. */}
      {organizations.length > 0 && (
        <MarketplaceBusinessPromoShowcase organizations={organizations} />
      )}

      <MarketplaceBusinessPromo />

      {/* ── Empresas asociadas ── */}
      {organizations.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Empresas asociadas
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Tiendas con catálogo público activo
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/marketplace/empresas">
                Ver directorio
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {organizations.slice(0, 8).map((organization) => (
              <OrganizationDirectoryCard key={organization.id} organization={organization} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
