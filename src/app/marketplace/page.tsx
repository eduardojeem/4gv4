import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Building2, CheckCircle2, Package, Rocket, ShoppingBag, Sparkles, Store, Tag, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketplaceProductCarousel } from '@/components/public/MarketplaceProductCarousel'
import { CategoryCarouselSection } from '@/components/public/CategoryCarouselSection'
import { MarketplaceSearchBox } from '@/components/public/MarketplaceSearchBox'
import { MarketplaceOffersSection, type MarketplaceOfferGroup } from '@/components/public/MarketplaceOffersSection'
import { getMarketplaceOrganizations, getMarketplaceProductsPage, getMarketplaceBrands, getMarketplaceOffers } from '@/lib/public/marketplace'
import { MarketplaceBrandsSection } from '@/components/public/MarketplaceBrandsSection'
import { getPlatformBranding } from '@/lib/platform/branding'
import { getPlatformAnnouncements } from '@/lib/platform/announcement'
import { pickLiveAnnouncement } from '@/lib/announcements/announcement'
import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import { MarketplaceOrgProductGrid } from '@/components/public/MarketplaceOrgProductGrid'
import { MarketplaceOrgMarquee } from '@/components/public/MarketplaceOrgMarquee'
import { MarketplaceBusinessPromoShowcase } from '@/components/public/MarketplaceBusinessPromoShowcase'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return {
    title: `${branding.marketplaceName} | ${branding.platformName}`,
    description: branding.seoDescription,
  }
}

// La pagina puede reutilizar el HTML/RSC durante la misma ventana corta que el
// catalogo. Los filtros personales viven en otras rutas y no forman parte de
// esta salida publica.
export const revalidate = 30

export default async function MarketplacePage() {
  const [organizations, marketplacePage, brands, marketplaceOffers, announcement] = await Promise.all([
    getMarketplaceOrganizations(),
    getMarketplaceProductsPage(48),
    getMarketplaceBrands(30),
    getMarketplaceOffers(100),
    getPlatformAnnouncements(),
  ])
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

  return (
    <div>
      <AnnouncementModal announcement={pickLiveAnnouncement(announcement, new Date())} scope="marketplace" />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,rgba(6,182,212,0.13),transparent)] dark:bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,rgba(6,182,212,0.07),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
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
              Catálogos públicos de organizaciones reales. Cada tienda es independiente y mantiene sus datos aislados.
            </p>

            {/* Stats */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-5 text-sm">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-950/50">
                  <Building2 className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
                </span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">{organizations.length}</strong> empresas
              </div>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-950/50">
                  <Package className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
                </span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">{totalProducts}</strong> productos
              </div>
            </div>

            <MarketplaceSearchBox className="mx-auto mt-7 max-w-xl" />
          </div>
        </div>
      </section>

      {/* ── Carrusel de categorías ── */}
      {offerGroups.length > 0 && <MarketplaceOffersSection groups={offerGroups} />}

      <section className="border-b border-slate-100 py-4 dark:border-slate-800/60">
        <CategoryCarouselSection
          showViewAll
          showCount
        />
      </section>

      {/* ── Marcas ── */}
      {brands.length > 0 && (
        <section className="border-b border-slate-100 py-10 dark:border-slate-800/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <MarketplaceBrandsSection
              brands={brands}
              variant="carousel"
              maxItems={20}
              showViewAll={true}
              viewAllHref="/marketplace/categorias#marcas"
            />
          </div>
        </section>
      )}

      {/* ── Carrusel de productos ── */}
      {carouselProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Productos destacados
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Catálogo público de todas las empresas
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="hidden gap-2 sm:flex">
              <Link href="/marketplace/productos">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <MarketplaceProductCarousel products={carouselProducts} />
        </section>
      )}

      {/* ── Vitrina Publicitaria de Negocios Registrados (Estilo umarket) ── */}
      {organizations.length > 0 && (
        <MarketplaceBusinessPromoShowcase organizations={organizations} />
      )}

      {/* ── Banner Especial: ¿Tenés un negocio? (Ultra-Resaltado) ── */}
      <section className="relative overflow-hidden border-y border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 py-12 sm:py-16 text-white shadow-2xl">
        {/* Luces ambientales de fondo */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 lg:flex-row lg:items-center">
            
            {/* Texto y Beneficios */}
            <div className="text-center lg:text-left space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-bold text-cyan-300 shadow-xs backdrop-blur-md">
                <Rocket className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                <span>Especial para Comercios y Servicios Técnicos</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                ¿Tenés un negocio o taller?
              </h2>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Publicá tu catálogo en el marketplace, gestioná órdenes de reparación, controlá tu inventario y multiplicá tus ventas con nuestra plataforma.
              </p>

              {/* Beneficios rápidos */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 backdrop-blur-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                  Tienda online sincronizada
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 backdrop-blur-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                  Control de Reparaciones & Taller
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 backdrop-blur-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                  Inventario & POS
                </span>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto shrink-0">
              <Button
                asChild
                className="w-full sm:w-auto h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm px-6 shadow-xl shadow-cyan-500/25 transition-all active:scale-[0.98] border border-white/20"
              >
                <Link href="/register" className="flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Crear mi tienda</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto h-12 rounded-xl border-white/30 bg-white/10 hover:bg-white/20 text-white font-bold text-sm px-5 backdrop-blur-md transition-all"
              >
                <Link href="/saas">Conocer funciones SaaS</Link>
              </Button>
            </div>

          </div>
        </div>
      </section>

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

          {/* Carrusel en movimiento de empresas asociadas */}
          <MarketplaceOrgMarquee organizations={organizations} className="mt-2" />
        </section>
      )}

      {/* ── Productos por empresa ── */}
      {organizations.filter((o) => o.featured_products.length > 0).slice(0, 8).length > 0 && (
        <MarketplaceOrgProductGrid
          organizations={organizations.filter((o) => o.featured_products.length > 0).slice(0, 8)}
        />
      )}
    </div>
  )
}
