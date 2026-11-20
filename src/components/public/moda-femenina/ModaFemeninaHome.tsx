'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowRight,
  Award,
  Clock,
  CreditCard,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useHydrated } from '@/hooks/use-hydrated'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import { fetchPublicProducts, newestProductsKey, NEWEST_PRODUCTS_SWR_OPTIONS } from '@/components/public/inicio/newest-products'
import { ProductCard } from '@/components/public/ProductCard'
import { categoryCards, cityFromAddress, offerCards, productPhoto } from '@/components/public/especial-cosmeticos/cosmetics-home-data'
import type { WebsiteSettings } from '@/types/website-settings'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import './moda-femenina.css'

interface ModaFemeninaHomeProps {
  settings: WebsiteSettings
  branches?: BranchLocationData[]
  capabilities?: StorefrontCapabilities
}

/** Fotos de ambientación de la plantilla: decorativas, se usan solo si la tienda no tiene fotos propias. */
const TEMPLATE_PHOTOS = {
  hero: '/images/templates/moda-femenina/hero-model.jpg',
  offers: '/images/templates/moda-femenina/promo-sale.jpg',
  categories: [
    '/images/templates/moda-femenina/cat-dresses.jpg',
    '/images/templates/moda-femenina/cat-tops.jpg',
    '/images/templates/moda-femenina/cat-outerwear.jpg',
    '/images/templates/moda-femenina/cat-bottoms.jpg',
  ],
}

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

const ACCENT_TEXT = 'text-[#C2531F] dark:text-[#F07C48]'

/**
 * Inicio de la plantilla «Boutique Femenina». Todo lo que muestra sale de la
 * tienda: nombre, textos de portada, beneficios, categorías, ofertas y
 * productos. Lo que el comercio no cargó no aparece: la primera versión traía
 * cifras («10K+ clientas», «4.9/5»), envío gratis, cambios a 30 días y un
 * «Hasta 50% Off» escritos a mano que se mostraban en todas las tiendas.
 */
export function ModaFemeninaHome({ settings, capabilities }: ModaFemeninaHomeProps) {
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
  // el primer dibujo y en el servidor no. Hasta hidratar se dibuja lo mismo que el servidor.
  const hydrated = useHydrated()
  const products = useMemo(() => (hydrated ? productsData ?? [] : []), [hydrated, productsData])
  const offerProducts = hydrated ? offerData : undefined
  const productsLoading = hasCatalog && (!hydrated || productsFetching)

  const offers = useMemo(() => offerCards(offerProducts, 50), [offerProducts])
  const maxDiscount = offers.reduce((max, offer) => Math.max(max, offer.discountPercent), 0)
  const categories = useMemo(
    () => (hasCatalog ? categoryCards(liveCategories, prefix, 4) : []),
    [hasCatalog, liveCategories, prefix]
  )

  const storeName = company?.name?.trim() || 'Nuestra tienda'
  const slogan = company?.slogan?.trim() || ''
  const description = company?.description?.trim() || ''
  const city = cityFromAddress(company?.address)

  const heroVisible = settings.hero_content?.enabled !== false
  const heroBadge = settings.hero_content?.badge?.trim() || city
  const heroTitle = settings.hero_content?.title?.trim() || storeName
  const heroSubtitle = settings.hero_content?.subtitle?.trim() || slogan || description
  const heroCtaText = settings.hero_content?.ctaPrimaryText?.trim() || 'Ver colección'
  const heroPhoto = productPhoto(products)

  const trustItems = settings.trust_bar?.enabled === false
    ? []
    : (settings.trust_bar?.items || []).filter((item) => item.active !== false && item.title?.trim()).slice(0, 4)

  const offersVisible = hasCatalog && offers.length > 0 && settings.offers_section?.enabled !== false
  const offersEyebrow = settings.offers_section?.eyebrow?.trim() || 'Ofertas de la tienda'
  const offersTitle = settings.offers_section?.title?.trim() || (maxDiscount > 0 ? `Hasta ${maxDiscount}% de descuento` : 'Productos en oferta')
  const offersSubtitle = settings.offers_section?.subtitle?.trim() || `${offers.length} ${offers.length === 1 ? 'producto rebajado' : 'productos rebajados'} en la tienda.`
  const offerImage = offers.find((offer) => offer.image)?.image || TEMPLATE_PHOTOS.offers

  return (
    <div className="moda-femenina-root min-h-screen flex flex-col font-sans selection:bg-[#E06B3A]/20">
      <div className="flex-1">
        {heroVisible && (
          <section className="relative overflow-hidden pt-8 pb-16 sm:pb-24 lg:pt-12 lg:pb-28 bg-[#FAF7F2] dark:bg-[#181513] transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                <div className="lg:col-span-7 space-y-6 sm:space-y-8 z-10 text-center lg:text-left">
                  {heroBadge && (
                    <p className={`text-xs sm:text-sm font-bold uppercase tracking-[0.25em] ${ACCENT_TEXT}`}>{heroBadge}</p>
                  )}
                  <h1 className="font-editorial text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F7F3EE] leading-[1.05] break-words">
                    {heroTitle}
                  </h1>
                  {heroSubtitle && (
                    <p className="max-w-xl mx-auto lg:mx-0 text-base sm:text-lg text-[#5F5750] dark:text-[#A89F95] leading-relaxed">
                      {heroSubtitle}
                    </p>
                  )}
                  <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                    {hasCatalog && (
                      <Link
                        href={`${prefix}/productos`}
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#1A1A1A] hover:bg-[#C2531F] text-white text-sm font-semibold tracking-wide transition-all shadow-md group dark:bg-[#F7F3EE] dark:text-[#1A1A1A] dark:hover:bg-[#F07C48]"
                      >
                        <span>{heroCtaText}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden />
                      </Link>
                    )}
                    {categories.length > 0 && (
                      <a
                        href="#colecciones"
                        className="inline-flex items-center gap-2.5 px-7 py-4 rounded-full bg-white/90 dark:bg-[#221E1B] hover:bg-stone-50 dark:hover:bg-[#2A2421] text-[#1A1A1A] dark:text-[#F7F3EE] text-sm font-semibold border border-[#736B63]/20 transition-all shadow-sm"
                      >
                        Ver categorías
                      </a>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 relative flex items-center justify-center">
                  <div className="relative w-72 h-72 sm:w-96 sm:h-96 lg:w-[440px] lg:h-[440px]">
                    <div className="absolute inset-0 rounded-full moda-sun-circle" aria-hidden />
                    <div className="absolute inset-0 z-10 overflow-hidden rounded-b-full">
                      <AppImage
                        src={heroPhoto?.image || TEMPLATE_PHOTOS.hero}
                        alt={heroPhoto?.name || ''}
                        fill
                        priority
                        sizes="(min-width: 1024px) 440px, (min-width: 640px) 384px, 288px"
                        className="object-cover object-top"
                      />
                    </div>
                    {heroPhoto && (
                      <Link
                        href={`${prefix}/productos/${encodeURIComponent(heroPhoto.id)}`}
                        className="absolute -left-2 sm:-left-6 bottom-10 z-20 moda-floating-pill max-w-[70%] px-4 py-2.5 rounded-2xl shadow-lg"
                      >
                        <span className="block text-xs font-bold text-[#1A1A1A] dark:text-[#F7F3EE] line-clamp-1">{heroPhoto.name}</span>
                        {heroPhoto.price !== null && (
                          <span className={`block text-xs font-semibold ${ACCENT_TEXT}`}>Gs. {heroPhoto.price.toLocaleString('es-PY')}</span>
                        )}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {trustItems.length > 0 && (
          <section aria-label="Beneficios" className={`relative z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${heroVisible ? '-mt-8 sm:-mt-12' : 'pt-10'}`}>
            <ul className="moda-floating-pill rounded-3xl p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {trustItems.map((item, index) => {
                const Icon = (item.icon && TRUST_ICONS[item.icon.toLowerCase()]) || ShieldCheck
                return (
                  <li key={`${item.title}-${index}`} className="flex items-center gap-4">
                    <span className={`w-12 h-12 rounded-2xl bg-[#E06B3A]/10 dark:bg-[#E06B3A]/20 flex items-center justify-center shrink-0 ${ACCENT_TEXT}`}>
                      <Icon className="w-6 h-6" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">{item.title}</span>
                      {item.description?.trim() && (
                        <span className="block text-xs text-[#5F5750] dark:text-[#A89F95] mt-0.5">{item.description}</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {categories.length > 0 && (
          <section id="colecciones" className="scroll-mt-24 py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4 mb-12">
              <h2 className="font-editorial text-3xl sm:text-5xl font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">
                Comprar por <span className={`font-signature font-normal italic ${ACCENT_TEXT}`}>categoría</span>
              </h2>
              <Link href={`${prefix}/productos`} className={`inline-flex items-center gap-2 text-sm font-bold hover:underline group ${ACCENT_TEXT}`}>
                <span>Ver todo el catálogo</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden />
              </Link>
            </div>
            <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
              {categories.map((category, index) => (
                <li key={category.id}>
                  <Link
                    href={category.href}
                    className="group relative block rounded-3xl overflow-hidden moda-category-card bg-[#F5EFEB] dark:bg-[#221E1B] border border-[#736B63]/15"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-200 dark:bg-stone-800">
                      <AppImage
                        src={TEMPLATE_PHOTOS.categories[index % TEMPLATE_PHOTOS.categories.length]}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 flex items-end justify-between gap-2">
                      <div className="min-w-0 text-white">
                        <h3 className="font-editorial text-lg sm:text-xl font-bold tracking-tight line-clamp-2">{category.name}</h3>
                        <p className="text-xs text-stone-200 font-medium mt-0.5">
                          {category.count} {category.count === 1 ? 'producto' : 'productos'}
                        </p>
                      </div>
                      <span className="hidden sm:flex w-10 h-10 shrink-0 rounded-full bg-white/95 text-[#1A1A1A] items-center justify-center shadow-md group-hover:bg-[#E06B3A] group-hover:text-white transition-all" aria-hidden>
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {offersVisible && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
            <div className="rounded-3xl bg-[#F5EFEB] dark:bg-[#221E1B] border border-[#736B63]/15 overflow-hidden p-8 sm:p-12 lg:p-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                  <p className={`text-xs sm:text-sm font-bold uppercase tracking-[0.2em] ${ACCENT_TEXT}`}>{offersEyebrow}</p>
                  <h2 className="font-editorial text-4xl sm:text-6xl font-bold text-[#1A1A1A] dark:text-[#F7F3EE] leading-[1.1]">{offersTitle}</h2>
                  <p className="max-w-md mx-auto lg:mx-0 text-sm sm:text-base text-[#5F5750] dark:text-[#A89F95] leading-relaxed">{offersSubtitle}</p>
                  <Link
                    href={`${prefix}/ofertas`}
                    className="inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-[#1A1A1A] hover:bg-[#C2531F] text-white text-sm font-semibold tracking-wide transition-all shadow-md group dark:bg-[#F7F3EE] dark:text-[#1A1A1A] dark:hover:bg-[#F07C48]"
                  >
                    <span>Ver ofertas</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden />
                  </Link>
                </div>
                <div className="lg:col-span-5 flex items-center justify-center">
                  <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-white dark:border-[#2A2421] shadow-2xl">
                    <AppImage src={offerImage} alt="" fill sizes="320px" className="object-cover" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {hasCatalog && (
          <section className="py-12 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#736B63]/10">
            <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4 mb-10">
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest ${ACCENT_TEXT}`}>Recién llegados</p>
                <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-[#1A1A1A] dark:text-[#F7F3EE] mt-1">Novedades de la tienda</h2>
              </div>
              {products.length > 0 && (
                <Link href={`${prefix}/productos`} className="inline-flex items-center gap-2 text-sm font-bold text-[#1A1A1A] dark:text-[#F7F3EE] hover:underline group">
                  <span>Ver todo el catálogo</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden />
                </Link>
              )}
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6" aria-busy="true" aria-label="Cargando productos">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-[3/4] rounded-3xl bg-[#736B63]/10 animate-pulse" />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-8">
                {products.slice(0, 8).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-[#F5EFEB] dark:bg-[#221E1B] rounded-3xl border border-[#736B63]/15">
                <ShoppingBag className={`w-12 h-12 mx-auto mb-4 ${ACCENT_TEXT}`} aria-hidden />
                <h3 className="font-editorial text-xl font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">
                  {productsError ? 'No pudimos cargar los productos' : 'Todavía no hay productos publicados'}
                </h3>
                <p className="text-sm text-[#5F5750] dark:text-[#A89F95] mt-1 max-w-sm mx-auto">
                  {productsError
                    ? 'Probá de nuevo en unos minutos o entrá al catálogo.'
                    : `Cuando ${storeName} publique su catálogo, vas a verlo acá.`}
                </p>
                {productsError && (
                  <Link href={`${prefix}/productos`} className={`mt-4 inline-flex text-sm font-semibold hover:underline ${ACCENT_TEXT}`}>
                    Ir al catálogo
                  </Link>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
