'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Clock,
  CreditCard,
  Droplets,
  HeartHandshake,
  Instagram,
  Layers,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Sun,
  Truck,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { EspecialCosmeticosCarousel } from './EspecialCosmeticosCarousel'
import { ProductCard } from '@/components/public/ProductCard'
import { fetchPublicProducts, newestProductsKey, NEWEST_PRODUCTS_SWR_OPTIONS } from '@/components/public/inicio/newest-products'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useHydrated } from '@/hooks/use-hydrated'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import { getCompanyMapsEmbedSrc, getDirectionsHref } from '@/lib/website/company-maps-url'
import { BranchLocations, type BranchLocationData } from '@/components/public/inicio/BranchLocations'
import { StoreBrandTicker } from '@/components/public/inicio/StoreBrandTicker'
import { ServiceGallery } from '@/components/public/inicio/ServicesHome'
import { ProcessSteps } from '@/components/public/inicio/ProcessSteps'
import { getPublicProcessFlows } from '@/lib/website/process-steps'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { categoryCards, cityFromAddress, offerCards, productPhoto, type CosmeticsProductPhoto } from './cosmetics-home-data'
import './especial-cosmeticos.css'

interface EspecialCosmeticosHomeProps {
  settings: WebsiteSettings
  branches?: BranchLocationData[]
  capabilities?: StorefrontCapabilities
}

const CATEGORY_ICONS: LucideIcon[] = [Droplets, Sparkles, Zap, Sun, Layers]

const TRUST_ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  'credit-card': CreditCard,
  shield: ShieldCheck,
  message: MessageCircle,
  star: Star,
  award: Award,
  package: Package,
  'map-pin': MapPin,
  sparkles: Sparkles,
  handshake: HeartHandshake,
  clock: Clock,
}
const TRUST_TONES = [
  'bg-[var(--cosmetics-500)]/10 text-[var(--cosmetics-ink)] dark:bg-[var(--cosmetics-950)]/50 dark:text-[var(--cosmetics-300)]',
  'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  'bg-amber-500/10 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
  'bg-purple-500/10 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300',
]

const formatGs = (value: number) => `Gs. ${value.toLocaleString('es-PY')}`

/** Etiqueta sobre una foto grande: qué producto es, cuánto sale y enlace a su página. */
function PhotoProductTag({ photo, href }: { photo: CosmeticsProductPhoto; href: string }) {
  return (
    <Link
      href={href}
      className="group/tag absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--cosmetics-150)]/70 bg-white/95 p-3.5 shadow-lg backdrop-blur-md transition-colors hover:border-[var(--cosmetics-300)] dark:border-zinc-700 dark:bg-zinc-900/95 sm:bottom-6 sm:left-6 sm:right-6 sm:p-4"
    >
      <div className="min-w-0">
        <p className="font-serif text-sm font-bold text-stone-900 line-clamp-1 group-hover/tag:text-[var(--cosmetics-ink)] dark:text-stone-100">
          {photo.name}
        </p>
        {photo.price !== null && (
          <p className="text-xs font-semibold text-[var(--cosmetics-ink)] dark:text-[var(--cosmetics-400)]">{formatGs(photo.price)}</p>
        )}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--cosmetics-500)] px-3 py-1.5 text-[11px] font-bold text-white">
        Ver <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

/**
 * Inicio de la plantilla «Especial Cosméticos». Todo lo que muestra sale de la
 * tienda: productos, ofertas, categorías, contacto y horarios. Antes, si la
 * consulta de productos fallaba (y fallaba siempre: recibía el slug en vez de
 * la URL), se mostraba un catálogo de ejemplo con otra marca, y había cifras,
 * cupones y combos escritos a mano. Lo que el comercio no cargó no aparece.
 */
export function EspecialCosmeticosHome({ settings, branches, capabilities }: EspecialCosmeticosHomeProps) {
  const pathname = usePathname()
  const company = useStorefrontCompanyInfo(settings.company_info)
  const { categories: liveCategories } = usePublicCategories()

  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''
  const hasCatalog = capabilities?.hasCatalog !== false

  const { data: productsData, isLoading: productsFetching, error: productsError } = useSWR(
    hasCatalog ? newestProductsKey(slug) : null,
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )
  const { data: offerData } = useSWR(
    hasCatalog ? withOrgQuery('/api/public/products?per_page=50&sort=newest&has_offer=true', slug) : null,
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )

  // La caché de SWR es global: en el navegador los productos pueden estar desde
  // el primer dibujo y en el servidor no (error de hidratación). Hasta hidratar
  // se dibuja lo mismo que el servidor.
  const hydrated = useHydrated()
  const products = hydrated ? productsData : undefined
  const offerProducts = hydrated ? offerData : undefined
  const productsLoading = !hydrated || productsFetching

  const offers = useMemo(() => offerCards(offerProducts), [offerProducts])
  const maxDiscount = offers.reduce((max, offer) => Math.max(max, offer.discountPercent), 0)
  const categories = useMemo(() => categoryCards(liveCategories, prefix), [liveCategories, prefix])
  const catalogCount = useMemo(
    () => (liveCategories || []).reduce((sum, category) => sum + (Number(category.productCount) || 0), 0),
    [liveCategories]
  )

  const storeName = company?.name?.trim() || 'Nuestra tienda'
  const slogan = company?.slogan?.trim() || ''
  const description = company?.description?.trim() || ''
  const address = company?.address?.trim() || ''
  const city = cityFromAddress(address)
  const phone = company?.phone?.trim() || ''
  const instagram = company?.instagram?.trim().replace(/^@/, '') || ''
  const hours = company?.hours
  const mapsEmbed = address || company?.mapsUrl ? getCompanyMapsEmbedSrc(company?.mapsUrl, address) : null
  const directionsHref = address || company?.mapsUrl ? getDirectionsHref(company?.mapsUrl, address) : null
  const hasLocation = Boolean(address || company?.mapsUrl)

  const brand = getBrandTheme(company?.brandColor)
  const phoneClean = (company?.whatsapp || company?.phone || '').replace(/\D/g, '')

  const processSteps = useMemo(
    () => (Array.isArray(settings.process_steps) ? settings.process_steps : []),
    [settings.process_steps]
  )
  const processFlows = useMemo(
    () => getPublicProcessFlows(settings.process_flows, processSteps),
    [settings.process_flows, processSteps]
  )
  const hasProcessSteps = company?.processSectionEnabled !== false && processFlows.length > 0

  const heroPhoto = productPhoto(products)
  const editorialPhoto = productPhoto(products, 1)
  const storyPhoto = productPhoto(products, 2)
  const productHref = (id: string) => `${prefix}/productos/${encodeURIComponent(id)}`

  const heroVisible = settings.hero_content?.enabled !== false
  const heroBadge = settings.hero_content?.badge || city
  const heroTitle = settings.hero_content?.title || storeName
  const heroSubtitle = settings.hero_content?.subtitle || (slogan ? `${slogan}. ${description}` : description)
  const heroCtaText = settings.hero_content?.ctaPrimaryText || 'Ver productos'
  const heroCtaHref = `${prefix}/productos`
  const heroImageSrc = heroPhoto?.image

  const offersVisible = offers.length > 0 && settings.offers_section?.enabled !== false
  const offersTitle = settings.offers_section?.title || 'Productos en Oferta'
  const offersEyebrow = settings.offers_section?.eyebrow || 'Ofertas de la tienda'
  const offersSubtitle = settings.offers_section?.subtitle

  const trustItems = settings.trust_bar?.enabled === false
    ? []
    : (settings.trust_bar?.items || []).filter((item) => item.active !== false && item.title?.trim())

  const hasConfiguredSlides =
    settings.promotional_carousel?.enabled !== false &&
    Boolean(settings.promotional_carousel?.slides?.some((slide) => slide.active))

  const stats = [
    catalogCount > 0 && { value: catalogCount.toLocaleString('es-PY'), label: 'Productos en catálogo' },
    categories.length > 0 && { value: String((liveCategories || []).filter((c) => Number(c.productCount) > 0).length), label: 'Líneas de cuidado' },
    offers.length > 0 && { value: `${maxDiscount}%`, label: 'Descuento máximo hoy' },
  ].filter(Boolean) as { value: string; label: string }[]

  return (
    <div className="cosmetics-brand-surface flex flex-col min-h-screen bg-[var(--cosmetics-page)] text-stone-800 dark:bg-zinc-950 dark:text-stone-100">
      <h1 className="sr-only">{storeName}{slogan ? ` - ${slogan}` : ''}</h1>

      {/* Acceso para volver al Marketplace */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-1">
        <Link
          href="/marketplace"
          aria-label="Volver al Marketplace"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-[var(--cosmetics-ink)] dark:hover:text-[var(--cosmetics-400)] transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <Store className="h-3.5 w-3.5 text-[var(--cosmetics-ink)]" />
          <span>Volver al Marketplace</span>
        </Link>
      </div>

      {/* ── 0. CARRUSEL PROMOCIONAL (lo carga el comercio) ── */}
      {hasConfiguredSlides && settings.promotional_carousel && (
        <EspecialCosmeticosCarousel
          settings={settings.promotional_carousel}
          brandColor={company?.brandColor ?? settings.company_info.brandColor}
          customBrandColor={company?.customBrandColor ?? settings.company_info.customBrandColor}
        />
      )}

      {/* ── 1. PORTADA: solo si no hay carrusel activo y la portada está habilitada ── */}
      {!hasConfiguredSlides && heroVisible && (
        <section data-cosmetics-hero className="relative overflow-hidden bg-gradient-to-b from-[var(--cosmetics-tint)] via-[var(--cosmetics-page)] to-[var(--cosmetics-page)] dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950 py-12 sm:py-20 lg:py-28">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="space-y-6 text-center lg:text-left">
                {heroBadge && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-[var(--cosmetics-100)]/90 px-3.5 py-1 text-xs font-semibold tracking-wide text-[var(--cosmetics-ink)] dark:bg-[var(--cosmetics-950)]/60 dark:text-[var(--cosmetics-200)] border border-[var(--cosmetics-200)] dark:border-[var(--cosmetics-800)] shadow-2xs">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--cosmetics-ink)]" />
                    <span>{heroBadge}</span>
                  </div>
                )}

                <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-[1.12]">
                  {heroTitle}
                  {slogan && !settings.hero_content?.title && (
                    <>
                      <br />
                      <span className="bg-gradient-to-r from-[var(--cosmetics-600)] via-[var(--cosmetics-600)] to-[var(--cosmetics-400)] bg-clip-text text-transparent italic text-2xl sm:text-4xl lg:text-5xl">
                        {slogan}
                      </span>
                    </>
                  )}
                </h2>

                {heroSubtitle && (
                  <p className="max-w-xl text-base sm:text-lg leading-relaxed text-stone-600 dark:text-stone-300 mx-auto lg:mx-0">
                    {heroSubtitle}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                  <Link
                    href={heroCtaHref}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--cosmetics-500)] px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-[var(--cosmetics-500)]/25 hover:bg-[var(--cosmetics-600)] hover:shadow-lg hover:shadow-[var(--cosmetics-500)]/35 transition-all transform hover:-translate-y-0.5"
                  >
                    <span>{heroCtaText}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {offersVisible && (
                    <Link
                      href={`${prefix}/ofertas`}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--cosmetics-200)] bg-white/80 px-6 py-3.5 text-sm font-semibold text-stone-700 hover:bg-[var(--cosmetics-50)] hover:border-[var(--cosmetics-300)] hover:text-[var(--cosmetics-ink)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-stone-200 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
                    >
                      <span>Ver ofertas</span>
                    </Link>
                  )}
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-[var(--cosmetics-200)]/80 bg-gradient-to-br from-[var(--cosmetics-100)] via-[var(--cosmetics-50)] to-[var(--cosmetics-soft)] shadow-2xl shadow-[var(--cosmetics-950)]/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 dark:border-zinc-800">
                  {heroPhoto ? (
                    <>
                      <AppImage
                        src={heroImageSrc || heroPhoto.image}
                        alt={heroPhoto.name}
                        fill
                        priority
                        className="object-cover transition-transform duration-700 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 via-transparent to-transparent" />
                      <PhotoProductTag photo={heroPhoto} href={productHref(heroPhoto.id)} />
                    </>
                  ) : heroImageSrc ? (
                    <AppImage
                      src={heroImageSrc}
                      alt={heroTitle}
                      fill
                      priority
                      className="object-cover transition-transform duration-700 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Sparkles className="h-16 w-16 text-[var(--cosmetics-300)]" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 2. BENEFICIOS: los que configuró el comercio, ninguno inventado ── */}
      {trustItems.length > 0 && (
        <section className="border-y border-[var(--cosmetics-100)] bg-[var(--cosmetics-page)] py-8 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {trustItems.slice(0, 4).map((item, idx) => {
                const Icon = (item.icon && TRUST_ICONS[item.icon.toLowerCase()]) || ShieldCheck
                return (
                  <div
                    key={('id' in item && item.id) || idx}
                    className="flex items-center gap-4 p-3 rounded-2xl bg-[var(--cosmetics-soft)] dark:bg-zinc-850/50 border border-[var(--cosmetics-100)]/60 dark:border-zinc-800"
                  >
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${TRUST_TONES[idx % TRUST_TONES.length]}`}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <h4 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">{item.title}</h4>
                      {item.description && (
                        <p className="text-xs text-stone-500 dark:text-stone-400 leading-tight mt-0.5">{item.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. CATEGORÍAS REALES (con su cantidad de productos) ── */}
      {categories.length > 0 && (
        <section id="categorias" className="scroll-mt-20 py-16 sm:py-20 bg-[var(--cosmetics-page)] dark:bg-zinc-950">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-block rounded-full bg-[var(--cosmetics-500)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--cosmetics-ink)] dark:text-[var(--cosmetics-300)]">
                Líneas de Cuidado
              </span>
              <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mt-2">
                Explorá por Necesidad
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
                Elegí una línea para ver todos sus productos.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
              {categories.map((cat, idx) => {
                const IconComp = CATEGORY_ICONS[idx % CATEGORY_ICONS.length]
                return (
                  <Link
                    key={cat.id}
                    href={cat.href}
                    className="group flex flex-col items-center justify-center p-6 rounded-3xl bg-[var(--cosmetics-soft)] dark:bg-zinc-900 border border-[var(--cosmetics-150)]/70 dark:border-zinc-800 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[var(--cosmetics-300)] hover:shadow-lg hover:shadow-[var(--cosmetics-500)]/10"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-zinc-800 text-[var(--cosmetics-ink)] shadow-sm border border-[var(--cosmetics-100)] dark:border-zinc-700 group-hover:scale-110 group-hover:bg-[var(--cosmetics-500)] group-hover:text-white transition-all duration-300 mb-3">
                      <IconComp className="h-7 w-7" />
                    </div>
                    <h4 className="font-serif text-sm font-bold text-stone-800 dark:text-stone-200 group-hover:text-[var(--cosmetics-ink)] dark:group-hover:text-[var(--cosmetics-400)] transition-colors">
                      {cat.name}
                    </h4>
                    <span className="text-[11px] font-medium text-stone-400 mt-1">
                      {cat.count} {cat.count === 1 ? 'producto' : 'productos'}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 3.5 MARCAS CON LAS QUE TRABAJAMOS ── */}
      <StoreBrandTicker settings={settings.brands_section} />

      {/* ── 4. TU CUIDADO DIARIO: texto de la plantilla + cifras reales de la tienda ── */}
      <section id="rutina" className="scroll-mt-20 py-16 bg-gradient-to-r from-[var(--cosmetics-50)] via-[var(--cosmetics-tint)] to-[var(--cosmetics-50)] dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 border-y border-[var(--cosmetics-150)]/80 dark:border-zinc-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid items-center gap-10 ${editorialPhoto ? 'lg:grid-cols-2' : ''}`}>
            <div className="space-y-5 text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cosmetics-200)]/80 px-3 py-1 text-xs font-bold text-[var(--cosmetics-ink)] dark:bg-[var(--cosmetics-950)] dark:text-[var(--cosmetics-200)]">
                <Sparkles className="h-3 w-3 text-[var(--cosmetics-ink)]" />
                <span>Tu Cuidado Diario ✦</span>
              </span>
              <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Armá tu rutina con {storeName}
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-stone-600 dark:text-stone-300 max-w-xl mx-auto lg:mx-0">
                Limpieza, hidratación y protección: buscá por línea de cuidado y, si tenés dudas sobre qué te conviene, escribinos y te ayudamos a elegir.
              </p>

              {stats.length > 0 && (
                <div className="flex items-center justify-center lg:justify-start gap-8 py-2">
                  {stats.map((stat, idx) => (
                    <React.Fragment key={stat.label}>
                      {idx > 0 && <div className="h-10 w-px bg-[var(--cosmetics-200)] dark:bg-zinc-800" />}
                      <div>
                        <p className="font-serif text-2xl sm:text-3xl font-bold text-[var(--cosmetics-ink)] dark:text-[var(--cosmetics-400)]">{stat.value}</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">{stat.label}</p>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}

              <div>
                <Link
                  href={`${prefix}/productos`}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--cosmetics-500)] px-7 py-3 text-sm font-semibold text-white shadow-md hover:bg-[var(--cosmetics-600)] transition-colors"
                >
                  <span>Explorar Colección →</span>
                </Link>
              </div>
            </div>

            {editorialPhoto && (
              <figure className="space-y-3">
                <div className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden rounded-3xl border border-[var(--cosmetics-200)] bg-white shadow-xl dark:border-zinc-800">
                  <AppImage src={editorialPhoto.image} alt={editorialPhoto.name} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 via-transparent to-transparent" />
                  <PhotoProductTag photo={editorialPhoto} href={productHref(editorialPhoto.id)} />
                </div>
                {editorialPhoto.description && (
                  <figcaption className="px-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                    {editorialPhoto.description}
                  </figcaption>
                )}
              </figure>
            )}
          </div>
        </div>
      </section>

      {/* ── 5. OFERTAS REALES (productos con precio de oferta) ── */}
      {offersVisible && (
        <section id="ofertas" className="scroll-mt-20 relative py-20 sm:py-28 overflow-hidden bg-gradient-to-b from-[var(--cosmetics-tint)] via-[var(--cosmetics-soft)] to-[var(--cosmetics-page)] dark:from-zinc-900/90 dark:via-zinc-950 dark:to-zinc-950 border-y border-[var(--cosmetics-200)]/80 dark:border-zinc-800">
          <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-[var(--cosmetics-300)]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[var(--cosmetics-300)]/20 blur-3xl" />

          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 lg:mb-16 gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--cosmetics-600)] px-3.5 py-1 text-xs font-bold tracking-wider text-white shadow-md shadow-[var(--cosmetics-950)]/15 uppercase">
                  <span>{offersEyebrow}</span>
                  <span className="h-1 w-1 rounded-full bg-white" />
                  <span>Hasta {maxDiscount}% OFF</span>
                </div>
                <h3 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-[1.15]">
                  {offersTitle}
                </h3>
                {offersSubtitle && (
                  <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 max-w-xl">
                    {offersSubtitle}
                  </p>
                )}
              </div>

              <Link
                href={`${prefix}/ofertas`}
                className="inline-flex items-center gap-2 self-start md:self-auto rounded-2xl bg-white/90 dark:bg-zinc-900/90 hover:bg-[var(--cosmetics-50)] dark:hover:bg-zinc-800 px-5 py-3 text-xs font-bold text-[var(--cosmetics-ink)] dark:text-[var(--cosmetics-400)] border border-[var(--cosmetics-200)]/90 dark:border-zinc-800 shadow-sm transition-all"
              >
                <span>Ver todas las ofertas</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-[var(--cosmetics-200)]/90 bg-white/95 dark:bg-zinc-900/90 dark:border-zinc-800/90 p-6 shadow-md hover:shadow-2xl hover:border-[var(--cosmetics-300)] dark:hover:border-[var(--cosmetics-900)]/50 transition-all duration-500 hover:-translate-y-1.5 backdrop-blur-xs"
                >
                  <div>
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[var(--cosmetics-50)]/50 dark:bg-zinc-800/50">
                      {offer.image ? (
                        <AppImage
                          src={offer.image}
                          alt={offer.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBag className="h-10 w-10 text-[var(--cosmetics-300)]" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 rounded-full bg-[var(--cosmetics-600)] px-3.5 py-1 text-xs font-black text-white shadow-lg shadow-[var(--cosmetics-950)]/20">
                        -{offer.discountPercent}% OFF
                      </div>
                      <div className="absolute top-3 left-3 max-w-[60%] truncate rounded-full bg-stone-950/80 backdrop-blur-xs px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                        {offer.tag}
                      </div>
                    </div>

                    <div className="pt-5">
                      <h4 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 line-clamp-2 group-hover:text-[var(--cosmetics-ink)] transition-colors">
                        {offer.name}
                      </h4>
                    </div>
                  </div>

                  <div className="pt-5 border-t border-[var(--cosmetics-100)] dark:border-zinc-800 mt-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-stone-400 line-through">{formatGs(offer.originalPrice)}</span>
                        <span className="rounded-md bg-[var(--cosmetics-50)] dark:bg-[var(--cosmetics-950)]/60 px-1.5 py-0.5 text-[10px] font-bold text-[var(--cosmetics-ink)] dark:text-[var(--cosmetics-400)]">
                          Ahorrás {formatGs(offer.savings)}
                        </span>
                      </div>
                      <span className="font-serif text-xl sm:text-2xl font-black text-[var(--cosmetics-ink)] dark:text-[var(--cosmetics-400)] block mt-0.5">
                        {formatGs(offer.salePrice)}
                      </span>
                    </div>

                    <Link
                      href={`${prefix}/productos/${encodeURIComponent(offer.id)}`}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--cosmetics-500)] to-[var(--cosmetics-600)] px-5 py-3 text-xs font-bold text-white shadow-md shadow-[var(--cosmetics-950)]/15 hover:from-[var(--cosmetics-600)] hover:to-[var(--cosmetics-700)] hover:shadow-lg transition-all"
                    >
                      <span>Ver</span>
                      <ShoppingBag className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. NOVEDADES: los productos reales de la tienda ── */}
      {hasCatalog && (
        <section id="productos" className="scroll-mt-20 py-16 sm:py-20 bg-[var(--cosmetics-page)] dark:bg-zinc-950 border-t border-[var(--cosmetics-100)] dark:border-zinc-800">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-block rounded-full bg-[var(--cosmetics-500)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--cosmetics-ink)] dark:text-[var(--cosmetics-300)]">
                Lo Nuevo
              </span>
              <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mt-2">
                Novedades de la Tienda
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
                Los últimos productos que sumamos al catálogo.
              </p>
            </div>

            {products && products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {products.slice(0, 8).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : productsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6" aria-busy="true" aria-label="Cargando productos">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="aspect-[3/4] animate-pulse rounded-3xl bg-[var(--cosmetics-50)] dark:bg-zinc-900" />
                ))}
              </div>
            ) : (
              <div className="mx-auto max-w-md rounded-3xl border border-[var(--cosmetics-100)] bg-[var(--cosmetics-soft)] p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <ShoppingBag className="mx-auto h-8 w-8 text-[var(--cosmetics-400)]" />
                <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
                  {productsError ? 'No pudimos cargar los productos en este momento.' : 'Todavía no hay productos publicados.'}
                </p>
                <Link href={`${prefix}/productos`} className="mt-4 inline-flex text-xs font-semibold text-[var(--cosmetics-ink)] hover:underline">
                  Ir al catálogo
                </Link>
              </div>
            )}

            {products && products.length > 8 && (
              <div className="mt-10 text-center">
                <Link
                  href={`${prefix}/productos`}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--cosmetics-200)] px-6 py-3 text-sm font-semibold text-[var(--cosmetics-ink)] hover:bg-[var(--cosmetics-50)] dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  Ver todo el catálogo <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 7. NOSOTROS: descripción, horarios e Instagram que cargó el comercio ── */}
      <section id="nosotros" className="scroll-mt-20 py-16 sm:py-20 bg-[var(--cosmetics-soft)] dark:bg-zinc-900/60 border-t border-[var(--cosmetics-100)] dark:border-zinc-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid items-center gap-12 ${storyPhoto ? 'lg:grid-cols-2' : ''}`}>
            {storyPhoto && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-[var(--cosmetics-200)] bg-white shadow-xl dark:border-zinc-800">
                <AppImage src={storyPhoto.image} alt={storyPhoto.name} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 via-transparent to-transparent" />
                <PhotoProductTag photo={storyPhoto} href={productHref(storyPhoto.id)} />
              </div>
            )}

            <div className={`space-y-5 ${storyPhoto ? '' : 'mx-auto max-w-2xl text-center'}`}>
              <span className="inline-block rounded-full bg-[var(--cosmetics-500)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--cosmetics-ink)] dark:text-[var(--cosmetics-300)]">
                Nosotros
              </span>
              <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                {storeName}
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-stone-600 dark:text-stone-300">
                {description || slogan || `Conocé los productos de ${storeName} y consultanos lo que necesites.`}
              </p>

              {(hours?.weekdays?.trim() || instagram) && (
                <div className={`grid gap-4 pt-2 ${hours?.weekdays?.trim() && instagram ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'} ${storyPhoto ? '' : 'mx-auto'}`}>
                  {hours?.weekdays?.trim() && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-[var(--cosmetics-150)]/60 dark:border-zinc-700 text-left">
                      <Clock className="h-5 w-5 text-[var(--cosmetics-ink)] mb-2" />
                      <h5 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">Horarios</h5>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{hours.weekdays}</p>
                      {hours.saturday?.trim() && <p className="text-xs text-stone-500 dark:text-stone-400">{hours.saturday}</p>}
                    </div>
                  )}
                  {instagram && (
                    <a
                      href={`https://instagram.com/${instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-[var(--cosmetics-150)]/60 dark:border-zinc-700 text-left hover:border-[var(--cosmetics-300)]"
                    >
                      <Instagram className="h-5 w-5 text-[var(--cosmetics-ink)] mb-2" />
                      <h5 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">Instagram</h5>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">@{instagram}</p>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 7.5 GALERÍA DE FOTOS & SHOWROOM ── */}
      <ServiceGallery settings={settings.gallery_section} />

      {/* ── 7.6 CÓMO COMPRAR / PROCESO DE ATENCIÓN ── */}
      {hasProcessSteps && (
        <ProcessSteps
          brand={brand}
          flows={processFlows}
          tenantPrefix={prefix}
          phoneClean={phoneClean}
          variant="store"
          showCatalog={hasCatalog}
        />
      )}

      {/* ── 7.7 SUCURSALES (si hay más de 1) ── */}
      {branches && branches.length > 1 && (
        <BranchLocations branches={branches} brand={brand} />
      )}

      {/* ── 8. UBICACIÓN: solo con la dirección real ── */}
      {hasLocation && (
        <section id="ubicacion" className="scroll-mt-20 py-16 sm:py-20 bg-[var(--cosmetics-page)] dark:bg-zinc-950 border-t border-[var(--cosmetics-100)] dark:border-zinc-800">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-3xl border border-[var(--cosmetics-200)]/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
                {mapsEmbed ? (
                  <iframe
                    title={`Ubicación de ${storeName}`}
                    src={mapsEmbed}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-80 w-full border-0 lg:h-full min-h-[340px]"
                  />
                ) : (
                  <div className="flex h-80 lg:h-full min-h-[340px] items-center justify-center bg-[var(--cosmetics-50)]/50 dark:bg-zinc-800/40 p-6 text-center">
                    <div className="space-y-2">
                      <MapPin className="h-8 w-8 text-[var(--cosmetics-ink)] mx-auto" />
                      <p className="text-xs text-stone-500">{address}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col justify-center gap-5 p-8 lg:p-10 bg-[var(--cosmetics-page)] dark:bg-zinc-900">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cosmetics-100)] text-[var(--cosmetics-ink)] dark:bg-[var(--cosmetics-950)] dark:text-[var(--cosmetics-300)]">
                    <MapPin className="h-6 w-6" />
                  </span>
                  <div>
                    <h4 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                      {city ? `Encontranos en ${city}` : 'Encontranos'}
                    </h4>
                    <p className="font-medium text-stone-800 dark:text-stone-200 mt-1">{storeName}</p>
                    {address && (
                      <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mt-1">{address}</p>
                    )}
                  </div>

                  {(phone || hours?.weekdays?.trim()) && (
                    <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400">
                      {phone && <p><strong>Teléfono:</strong> {phone}</p>}
                      {hours?.weekdays?.trim() && <p><strong>Horario:</strong> {hours.weekdays}</p>}
                    </div>
                  )}

                  {directionsHref && (
                    <a
                      href={directionsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-[var(--cosmetics-500)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--cosmetics-600)] transition-colors"
                    >
                      <Navigation className="h-4 w-4" />
                      <span>Cómo llegar en Google Maps</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* El botón de WhatsApp lo pone el diseño general de la tienda: acá había
          un segundo botón (y un cartel que rebotaba) que se superponían. */}
    </div>
  )
}
