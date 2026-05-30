import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Building2, Package, ShoppingBag, Sparkles, Store, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketplaceProductCarousel } from '@/components/public/MarketplaceProductCarousel'
import { CategoryCarouselSection } from '@/components/public/CategoryCarouselSection'
import { MarketplaceSearchBox } from '@/components/public/MarketplaceSearchBox'
import { MarketplaceOffersSection, type MarketplaceOfferGroup } from '@/components/public/MarketplaceOffersSection'
import { getMarketplaceOrganizations, getMarketplaceProducts, getMarketplaceBrands } from '@/lib/public/marketplace'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import { MarketplaceBrandsSection } from '@/components/public/MarketplaceBrandsSection'

export const metadata: Metadata = {
  title: 'Marketplace | MiPOS',
  description: 'Descubre productos y empresas publicadas en el marketplace de MiPOS.',
}

export const dynamic = 'force-dynamic'

export default async function MarketplacePage() {
  const [organizations, marketplaceProducts, brands] = await Promise.all([
    getMarketplaceOrganizations(),
    getMarketplaceProducts(48),
    getMarketplaceBrands(30),
  ])

  const featuredProducts = marketplaceProducts.filter((product) => product.featured)
  const restProducts = marketplaceProducts.filter((product) => !product.featured)
  const carouselProducts = [...featuredProducts, ...restProducts].slice(0, 24)
  const offerGroupsMap = new Map<string, MarketplaceOfferGroup>()

  marketplaceProducts
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

  const totalProducts = organizations.reduce((s, o) => s + o.products_count, 0)

  return (
    <main>
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

      <section className="border-b border-slate-100 py-10 dark:border-slate-800/60">
        <CategoryCarouselSection
          title="Explorar por categoría"
          subtitle="Encontrá lo que buscás directamente"
          compact
          showViewAll
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
              showViewAll={false}
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
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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

      {/* ── Promociones / Banner ── */}
      <section className="border-y border-slate-200 bg-gradient-to-br from-cyan-600 to-cyan-700 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
            <div className="text-white">
              <div className="mb-1 flex items-center justify-center gap-2 sm:justify-start">
                <Tag className="h-4 w-4 opacity-80" />
                <span className="text-sm font-medium opacity-80">Para empresas</span>
              </div>
              <h2 className="text-2xl font-bold">¿Tenés un negocio?</h2>
              <p className="mt-1 text-sm opacity-80">
                Publicá tu catálogo y llegá a más clientes desde el marketplace.
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              <Button asChild size="sm" className="bg-white text-cyan-700 hover:bg-cyan-50">
                <Link href="/register">
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Crear mi tienda
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                <Link href="/saas">Ver planes</Link>
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
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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

          {/* Horizontal scroll de logos */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {organizations.map((org) => (
              <Link
                key={org.id}
                href={`/${org.slug}/inicio`}
                className="group flex shrink-0 flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-700"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                  {org.logo_url ? (
                    <Image
                      src={org.logo_url}
                      alt={org.name}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <span className="max-w-[88px] truncate text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                  {org.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Productos por empresa ── */}
      {organizations.filter((o) => o.featured_products.length > 0).slice(0, 3).map((org) => (
        <section key={org.id} className="border-t border-slate-100 dark:border-slate-800/60">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  {org.logo_url ? (
                    <Image src={org.logo_url} alt={org.name} width={36} height={36} className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">{org.name}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{org.products_count} productos</p>
                </div>
              </div>
              <Link
                href={`/${org.slug}/inicio`}
                className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-400"
              >
                Ir a la tienda
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {org.featured_products.slice(0, 5).map((product) => {
                const imageSrc = resolveProductImageUrl(product.image)
                return (
                  <Link
                    key={product.id}
                    href={`/${org.slug}/productos/${product.id}`}
                    className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition-all hover:border-cyan-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-700"
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-900">
                      {imageSrc ? (
                        <Image
                          src={imageSrc}
                          alt={product.name}
                          fill
                          className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                          sizes="200px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs font-medium text-slate-800 dark:text-slate-200">{product.name}</p>
                      <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-50">{formatPrice(product.sale_price)}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      ))}
    </main>
  )
}
