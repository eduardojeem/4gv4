'use client'

import {BarberLocation} from '@/components/public/barber/BarberLocation'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowRight,
  Award,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  LogIn,
  Package,
  Scissors,
  Sparkles,
  Tag,
  UserPlus,
  Users,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { ProductCard } from '@/components/public/ProductCard'
import { FloatingWhatsAppButton } from '@/components/public/FloatingWhatsAppButton'
import { BranchLocations, type BranchLocationData } from '@/components/public/inicio/BranchLocations'
import { OrganizationReviews } from '@/components/public/inicio/OrganizationReviews'
import { ProcessSteps } from '@/components/public/inicio/ProcessSteps'
import { BookingSection, ServiceGallery, useNextFreeSlot, usePublicAgenda } from '@/components/public/inicio/ServicesHome'
import { ServicesGrid } from '@/components/public/inicio/ServicesGrid'
import { StoreTrustBar } from '@/components/public/inicio/StoreTrustBar'
import { fetchPublicProducts, newestProductsKey, NEWEST_PRODUCTS_SWR_OPTIONS } from '@/components/public/inicio/newest-products'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { useHydrated } from '@/hooks/use-hydrated'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { hidesPublicPrice } from '@/lib/products/price-visibility'
import { resolveProductImageUrl, shouldBypassImageOptimization } from '@/lib/images'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import { getBrandLogoOrFallback } from '@/lib/website/brand-catalog'
import { getPublicProcessFlows } from '@/lib/website/process-steps'
import { canPublishServices, type StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import {
  BARBERO_DEFAULT_HERO_GRADIENT,
  getOverlayGradient,
  isLightColor,
  isSlideTextHidden,
  shouldUseBarberoSignatureGradient,
  SLIDE_ALIGNMENT_FLEX,
  SLIDE_FONT_CLASS,
} from '@/lib/website/carousel-presentation'
import type { PublicProduct } from '@/types/public'
import type { PromotionalCarouselSlide, WebsiteSettings } from '@/types/website-settings'
import './especial-barbero.css'

interface EspecialBarberoHomeProps {
  settings: WebsiteSettings
  branches?: BranchLocationData[]
  capabilities: StorefrontCapabilities
}

function hasRealOffer(product: PublicProduct): boolean {
  return (
    !hidesPublicPrice(product) &&
    Boolean(product.has_offer) &&
    typeof product.offer_price === 'number' &&
    product.offer_price > 0 &&
    product.offer_price < product.sale_price
  )
}

function useRevealObserver(triggerKey: string) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-ebs-reveal]'))
    if (reduced) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    )
    nodes.forEach((node) => {
      if (!node.classList.contains('is-visible')) {
        observer.observe(node)
      }
    })
    return () => observer.disconnect()
  }, [triggerKey])
}

/** Cabecera de banda oscura estilo Prime Barber Supply con franja vertical del color de la organización */
function DarkBandHeader({
  id,
  eyebrow,
  title,
  countLabel,
  ctaLabel,
  ctaHref,
}: {
  id: string
  eyebrow: string
  title: string
  countLabel?: string
  ctaLabel?: string
  ctaHref?: string
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-[#111116] px-4 py-3.5 text-white shadow-sm sm:px-6">
      <div className="flex items-center gap-3.5 min-w-0">
        <span
          aria-hidden="true"
          className="h-9 w-1 shrink-0 rounded-full"
          style={{
            background:
              'linear-gradient(180deg, var(--primary), color-mix(in oklch, var(--primary) 82%, #f97316 18%))',
          }}
        />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
          <div className="flex items-center gap-2.5">
            <h2 id={id} className="truncate text-lg font-black uppercase tracking-tight text-white sm:text-xl">
              {title}
            </h2>
            {countLabel && (
              <span className="hidden sm:inline-flex rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-zinc-300">
                {countLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="group/cta inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          <span>{ctaLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}

/** Banner promocional intercalado entre secciones con zoom suave 600ms al pasar el cursor */
function InterleavedPromoBanner({
  slide,
  prefix,
  fallbackStoreName,
}: {
  slide: PromotionalCarouselSlide
  prefix: string
  fallbackStoreName: string
}) {
  const imageSrc = slide.imageUrl ? resolveProductImageUrl(slide.imageUrl) : ''
  const href = slide.ctaHref
    ? slide.ctaHref.startsWith('/') && prefix && !slide.ctaHref.startsWith(prefix)
      ? `${prefix}${slide.ctaHref}`
      : slide.ctaHref
    : `${prefix}/productos`

  return (
    <div data-ebs-reveal className="ebs-reveal is-visible">
      <Link
        href={href}
        className="ebs-banner-card group relative flex min-h-[160px] sm:min-h-[210px] w-full items-center overflow-hidden border border-white/10 bg-[#111116] text-white shadow-md"
      >
        {imageSrc && imageSrc !== '/placeholder-product.svg' && (
          <AppImage
            src={imageSrc}
            alt={slide.imageAlt || slide.title || fallbackStoreName}
            fill
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="ebs-banner-media object-cover opacity-55"
            unoptimized={shouldBypassImageOptimization(imageSrc)}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(100deg, rgba(9,9,13,0.92) 0%, rgba(9,9,13,0.72) 55%, color-mix(in oklch, var(--primary) 24%, rgba(9,9,13,0.45)) 100%)',
          }}
        />
        <div className="relative z-10 flex w-full flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="max-w-2xl space-y-1.5">
            {slide.badge && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground">
                <Sparkles className="h-3 w-3" />
                {slide.badge}
              </span>
            )}
            {!slide.hideText && (
              <>
                <h3 className="text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
                  {slide.title || fallbackStoreName}
                </h3>
                {slide.message && (
                  <p className="line-clamp-2 text-xs text-zinc-300 sm:text-sm">
                    {slide.message}
                  </p>
                )}
              </>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-950 transition-all group-hover:bg-primary group-hover:text-primary-foreground sm:self-center">
            <span>{slide.ctaText || 'Ver promoción'}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </div>
  )
}

export function EspecialBarberoHome({
  settings,
  branches = [],
  capabilities,
}: EspecialBarberoHomeProps) {
  const pathname = usePathname()
  const pathSlug = getTenantSlugFromPathname(pathname)
  const company = useStorefrontCompanyInfo(settings.company_info) ?? settings.company_info
  const slug = pathSlug || company?.slug || ''
  const prefix = pathSlug ? `/${pathSlug}` : ''
  const hydrated = useHydrated()

  const storeName = company?.name?.trim() || 'Barber Supply'
  const phone = company?.phone?.trim() || ''
  const rawWhatsapp = (company?.whatsapp || company?.phone || '').trim()
  const phoneClean = rawWhatsapp.replace(/\D/g, '')
  const whatsappHref = phoneClean
    ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hola ${storeName}, quisiera consultar sobre sus productos y precios.`)}`
    : null
  const brandTheme = getBrandTheme(company?.brandColor)

  // Categorías y productos reales desde el backend (con soporte minorista / mayorista)
  const { categories } = usePublicCategories()
  const {
    data: products,
    error: productsError,
    isLoading: isLoadingProducts,
  } = useSWR(
    capabilities.hasCatalog ? newestProductsKey(slug) : null,
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )

  const productList = useMemo(() => (Array.isArray(products) ? products : []), [products])

  // El backend solo envía wholesale_price cuando la sesión tiene acceso mayorista habilitado
  const isWholesaleAccount = useMemo(
    () => productList.some((p) => p.wholesale_price != null),
    [productList]
  )

  const activeSlides = useMemo(() => {
    if (settings.promotional_carousel?.enabled === false) return []
    const slides = settings.promotional_carousel?.slides ?? []
    return slides.filter((s) => s.active)
  }, [settings.promotional_carousel])

  const secondarySlides = activeSlides.length > 1 ? activeSlides.slice(1) : []
  const [slideIndex, setSlideIndex] = useState(0)
  const [carouselPaused, setCarouselPaused] = useState(false)

  useEffect(() => {
    if (activeSlides.length <= 1 || carouselPaused) return
    if (settings.promotional_carousel?.autoplay === false) return
    const intervalMs = Math.max(3, settings.promotional_carousel?.intervalSeconds || 5) * 1000
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % activeSlides.length)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [activeSlides.length, carouselPaused, settings.promotional_carousel?.autoplay, settings.promotional_carousel?.intervalSeconds])

  const safeSlideIndex = activeSlides.length > 0 ? slideIndex % activeSlides.length : 0

  const handleCarouselKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (activeSlides.length <= 1) return
      if (e.key === 'ArrowRight') {
        setSlideIndex((prev) => (prev + 1) % activeSlides.length)
      } else if (e.key === 'ArrowLeft') {
        setSlideIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length)
      }
    },
    [activeSlides.length]
  )

  // Productos con oferta real y destacados
  const offerProducts = useMemo(() => productList.filter(hasRealOffer), [productList])
  const featuredProducts = useMemo(
    () => productList.filter((p) => Boolean(p.featured)),
    [productList]
  )

  // Categorías reales con sus productos asociados
  const rootCategories = useMemo(() => {
    const roots = (categories || []).filter((c) => !c.parent_id)
    const active = roots.filter((c) => (c.productCount ?? 0) > 0)
    const list = active.length > 0 ? active : roots
    return [...list].sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0))
  }, [categories])

  const categoryRows = useMemo(() => {
    const childToParent = new Map<string, { id: string; name: string }>()
    for (const root of rootCategories) {
      childToParent.set(root.id, { id: root.id, name: root.name })
      for (const sub of root.subcategories ?? []) {
        childToParent.set(sub.id, { id: root.id, name: root.name })
      }
    }

    const grouped = new Map<string, { id: string; name: string; items: PublicProduct[] }>()
    for (const product of productList) {
      if (!product.category?.id) continue
      const target = childToParent.get(product.category.id) ?? {
        id: product.category.id,
        name: product.category.name,
      }
      const existing = grouped.get(target.id)
      if (existing) {
        existing.items.push(product)
      } else {
        grouped.set(target.id, { id: target.id, name: target.name, items: [product] })
      }
    }

    return Array.from(grouped.values())
      .filter((g) => g.items.length > 0)
      .slice(0, 4)
  }, [rootCategories, productList])

  // Marcas reales configuradas en Sitio Web o extraídas de productos reales
  const displayBrands = useMemo(() => {
    if (settings.brands_section?.enabled === false) return []
    const configured = (settings.brands_section?.items ?? []).filter(
      (b) => b.active && b.name.trim()
    )
    if (configured.length > 0) {
      return configured.map((b) => ({
        id: b.id,
        name: b.name.trim(),
        imageUrl: b.imageUrl?.trim() || '',
        href: b.href?.trim() || `${prefix}/productos?marca=${encodeURIComponent(b.name.trim())}`,
      }))
    }
    const seen = new Set<string>()
    const derived: Array<{ id: string; name: string; imageUrl: string; href: string }> = []
    for (const product of productList) {
      const brandName = (product.brand || '').trim()
      if (!brandName) continue
      const key = brandName.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      derived.push({
        id: `brand-${key}`,
        name: brandName,
        imageUrl: '',
        href: `${prefix}/productos?marca=${encodeURIComponent(brandName)}`,
      })
    }
    return derived.slice(0, 12)
  }, [settings.brands_section, productList, prefix])

  // Módulos opcionales (solo si la organización los habilitó)
  const heroContent = settings.hero_content
  const heroVisible = heroContent?.enabled !== false
  const trustBarVisible = settings.trust_bar?.enabled !== false
  const hasServices = canPublishServices(
    capabilities,
    company?.servicesPageEnabled,
    settings.services
  )
  const bookingEnabled = capabilities.hasServices && Boolean(settings.booking_section?.enabled)
  const agendaState = usePublicAgenda(bookingEnabled, company?.slug)
  const effectiveAgenda = hydrated ? agendaState.agenda : null
  const nextSlot = useNextFreeSlot(agendaState.tenantSlug, Boolean(effectiveAgenda) && bookingEnabled)
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>()

  const { safeServices, agendaServiceIdByServiceId } = useMemo(() => {
    const raw = Array.isArray(settings.services)
      ? settings.services.filter((s) => s.active !== false)
      : []
    const agendaList = effectiveAgenda?.services ?? []
    const byId = new Map(agendaList.map((a) => [a.id, a]))
    const byName = new Map(
      agendaList.map((a) => [a.name.trim().toLowerCase(), a])
    )
    const idMap = new Map<string, string>()

    const enriched = raw.map((service) => {
      const match =
        byId.get(service.id) ||
        byName.get(service.title.trim().toLowerCase())
      if (match) {
        idMap.set(service.id, match.id)
      }
      if (!service.duration?.trim() && match && match.duration > 0) {
        return {
          ...service,
          duration: `${match.duration} min`,
        }
      }
      return service
    })

    return {
      safeServices: enriched,
      agendaServiceIdByServiceId: idMap,
    }
  }, [settings.services, effectiveAgenda])

  const processFlows = useMemo(
    () =>
      getPublicProcessFlows(
        settings.process_flows,
        Array.isArray(settings.process_steps) ? settings.process_steps : []
      ),
    [settings.process_flows, settings.process_steps]
  )
  const hasProcessSteps = company?.processSectionEnabled !== false && processFlows.length > 0

  useRevealObserver(`${productList.length}-${categoryRows.length}-${displayBrands.length}`)

  const loginHref = pathSlug ? `${prefix}/cliente/login` : '/login'
  const registerHref = pathSlug ? `${prefix}/cliente/registro` : '/register'

  return (
    <div
      data-especial-barbero-home
      className="min-w-0 bg-[#F6F6F6] text-zinc-900 dark:bg-[#09090D] dark:text-zinc-100"
    >
      {!heroVisible && activeSlides.length === 0 && (
        <h1 className="sr-only">{storeName}</h1>
      )}

      {/* ── 1. Hero Carrusel con indicadores pill animables ── */}
      {activeSlides.length > 0 && (
        <section
          aria-label="Portada promocional"
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
          onFocus={() => setCarouselPaused(true)}
          onBlur={() => setCarouselPaused(false)}
          onKeyDown={handleCarouselKey}
          tabIndex={0}
          className="group/hero relative overflow-hidden bg-[#09090D] text-white focus:outline-none"
        >
          <div className="relative overflow-hidden">
            <div
              className="ebs-slide-track flex"
              style={{ transform: `translate3d(-${safeSlideIndex * 100}%, 0, 0)` }}
            >
              {activeSlides.map((slide, idx) => {
                const src = slide.imageUrl ? resolveProductImageUrl(slide.imageUrl) : ''
                const href = slide.ctaHref
                  ? slide.ctaHref.startsWith('/') && prefix && !slide.ctaHref.startsWith(prefix)
                    ? `${prefix}${slide.ctaHref}`
                    : slide.ctaHref
                  : `${prefix}/productos`
                const HeadingTag = idx === 0 ? 'h1' : 'h2'
                const align = slide.contentAlign || 'left'
                const tone = slide.textTone || 'light'
                const isTextHidden = isSlideTextHidden(slide)
                const intensity = slide.overlayIntensity || (isTextHidden ? 'none' : 'strong')
                const overlayColor = slide.overlayColor || (tone === 'light' ? 'black' : 'white')
                const useSignatureGradient =
                  !isTextHidden && shouldUseBarberoSignatureGradient(slide) && intensity !== 'none'
                const titleSizeClass = {
                  compact: 'text-2xl sm:text-3xl font-bold',
                  normal: 'text-3xl sm:text-5xl font-black',
                  large: 'text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight',
                }[slide.titleSize || 'normal']
                const titleFontClass = SLIDE_FONT_CLASS[slide.fontFamily || 'display']
                const hasLightTitle = slide.titleColor
                  ? isLightColor(slide.titleColor)
                  : tone === 'light'
                const containerJustifyClass =
                  align === 'center'
                    ? 'justify-center'
                    : align === 'right'
                      ? 'justify-end'
                      : 'justify-start'

                return (
                  <div
                    key={slide.id}
                    style={slide.backgroundColor ? { backgroundColor: slide.backgroundColor } : undefined}
                    className="relative min-h-[290px] w-full shrink-0 sm:min-h-[380px] lg:min-h-[430px]"
                  >
                    {src && src !== '/placeholder-product.svg' && (
                      <AppImage
                        src={src}
                        alt={slide.imageAlt || slide.title || storeName}
                        fill
                        priority={idx === 0}
                        sizes="100vw"
                        className="object-cover"
                        unoptimized={shouldBypassImageOptimization(src)}
                      />
                    )}
                    {intensity !== 'none' && (
                      <div
                        className={cn(
                          'absolute inset-0 transition-opacity',
                          !useSignatureGradient && getOverlayGradient(tone, align, intensity, overlayColor)
                        )}
                        style={
                          useSignatureGradient
                            ? { background: BARBERO_DEFAULT_HERO_GRADIENT }
                            : undefined
                        }
                      />
                    )}

                    <div
                      className={cn(
                        'container relative z-10 mx-auto flex h-full min-h-[290px] items-center px-4 py-10 sm:min-h-[380px] sm:px-6 lg:min-h-[430px] lg:px-8',
                        containerJustifyClass
                      )}
                    >
                      {!isTextHidden ? (
                        <div className={cn('flex max-w-2xl flex-col space-y-4', SLIDE_ALIGNMENT_FLEX[align])}>
                          {slide.badge && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-black uppercase tracking-widest shadow-sm',
                                tone === 'light'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'border border-black/15 bg-black/10 text-zinc-950 backdrop-blur-xs'
                              )}
                            >
                              <Sparkles className="h-3 w-3" />
                              {slide.badge}
                            </span>
                          )}
                          <HeadingTag
                            style={slide.titleColor ? { color: slide.titleColor } : undefined}
                            className={cn(
                              'text-balance leading-tight',
                              titleSizeClass,
                              titleFontClass,
                              !slide.titleColor && (tone === 'light' ? 'text-white' : 'text-zinc-950'),
                              hasLightTitle && 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]'
                            )}
                          >
                            {slide.title || storeName}
                          </HeadingTag>
                          {slide.message && (
                            <p
                              className={cn(
                                'max-w-xl text-sm leading-relaxed sm:text-base',
                                tone === 'light' ? 'text-zinc-200' : 'text-zinc-800 font-medium'
                              )}
                            >
                              {slide.message}
                            </p>
                          )}
                          {slide.ctaText && (
                            <div className="pt-1">
                              <Link
                                href={href}
                                className={cn(
                                  'inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase tracking-wider shadow-lg transition-all hover:brightness-110 active:scale-95',
                                  tone === 'light'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-zinc-950 text-white hover:bg-zinc-800'
                                )}
                              >
                                <span>{slide.ctaText}</span>
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Link
                          href={href}
                          aria-label={slide.title || slide.imageAlt || storeName}
                          className="absolute inset-0 z-10"
                        >
                          <span className="sr-only">{slide.title || slide.imageAlt || storeName}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {activeSlides.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Diapositiva anterior"
                  onClick={() =>
                    setSlideIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length)
                  }
                  className="absolute left-4 top-1/2 z-20 flex h-[46px] w-[46px] -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white opacity-90 backdrop-blur-sm transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground sm:opacity-0 sm:group-hover/hero:opacity-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Diapositiva siguiente"
                  onClick={() => setSlideIndex((prev) => (prev + 1) % activeSlides.length)}
                  className="absolute right-4 top-1/2 z-20 flex h-[46px] w-[46px] -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white opacity-90 backdrop-blur-sm transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground sm:opacity-0 sm:group-hover/hero:opacity-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-xs">
                  {activeSlides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Ir a la portada ${idx + 1}`}
                      aria-current={idx === safeSlideIndex ? 'true' : undefined}
                      onClick={() => setSlideIndex(idx)}
                      className={cn(
                        'ebs-dot cursor-pointer bg-white/45 hover:bg-white/75',
                        idx === safeSlideIndex && 'is-active'
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* ── 2. #pbh-intro: Tarjeta oscura de bienvenida + accesos rápido categorías + minorista/mayorista ── */}
      {heroVisible && (
        <section className="container mx-auto px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
          <div
            id="pbh-intro"
            className="relative overflow-hidden rounded-[24px] border border-white/10 p-6 text-white shadow-xl sm:p-8 lg:p-10"
            style={{
              background:
                'radial-gradient(circle at 88% 18%, color-mix(in oklch, var(--primary) 26%, transparent), transparent 46%), linear-gradient(135deg, #111116 0%, #1F1F26 100%)',
            }}
          >
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-3">
                {heroContent?.badge && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-primary">
                    <Scissors className="h-3 w-3" />
                    {heroContent.badge}
                  </span>
                )}

                {activeSlides.length === 0 ? (
                  <h1 className="text-balance text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">
                    {heroContent?.title || storeName}
                  </h1>
                ) : (
                  <h2 className="text-balance text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                    {heroContent?.title || storeName}
                  </h2>
                )}

                {heroContent?.subtitle && (
                  <p className="max-w-xl text-xs leading-relaxed text-zinc-300 sm:text-sm">
                    {heroContent.subtitle}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Link
                    href={`${prefix}/productos`}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider text-primary-foreground shadow-md transition-all hover:brightness-110 active:scale-95"
                  >
                    <span>{heroContent?.ctaPrimaryText || 'Explorar catálogo'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  {whatsappHref && (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/15"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{heroContent?.ctaSecondaryText || 'Atención por WhatsApp'}</span>
                    </a>
                  )}

                  {isWholesaleAccount ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-extrabold text-emerald-300">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      <span>Precios mayoristas activos</span>
                    </span>
                  ) : (
                    <Link
                      href={loginHref}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>Acceso mayorista</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Chips rápidos de categorías reales */}
              {rootCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                  {rootCategories.slice(0, 8).map((cat) => (
                    <Link
                      key={cat.id}
                      href={`${prefix}/productos?category_id=${encodeURIComponent(cat.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <span>{cat.name}</span>
                      {typeof cat.productCount === 'number' && cat.productCount > 0 && (
                        <span className="text-[10px] opacity-75">({cat.productCount})</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Barra de confianza real (si está habilitada) ── */}
      {trustBarVisible && (
        <div className="pt-4">
          <StoreTrustBar settings={settings.trust_bar} className="py-4 sm:py-5" />
        </div>
      )}

      {/* ── 4. Catálogo en bandas oscuras + tarjetas blancas de alto contraste ── */}
      {capabilities.hasCatalog && (
        <div className="container mx-auto space-y-10 px-4 py-8 sm:px-6 lg:px-8">
          {/* Ofertas reales (solo si existen productos con descuento real y precio público visible) */}
          {offerProducts.length > 0 && (
            <section aria-labelledby="ebs-offers-heading">
              <DarkBandHeader
                id="ebs-offers-heading"
                eyebrow={settings.offers_section?.eyebrow || 'Precios promocionales'}
                title={settings.offers_section?.title || 'Ofertas activas'}
                countLabel={`${offerProducts.length} en oferta`}
                ctaLabel="Ver ofertas"
                ctaHref={`${prefix}/ofertas`}
              />
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                {offerProducts.slice(0, 8).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isWholesale={product.wholesale_price != null}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Banner promocional intercalado #1 (de las diapositivas configuradas en el sistema) */}
          {secondarySlides[0] && (
            <InterleavedPromoBanner
              slide={secondarySlides[0]}
              prefix={prefix}
              fallbackStoreName={storeName}
            />
          )}

          {/* Productos destacados o últimos ingresos reales */}
          <section aria-labelledby="ebs-catalog-heading">
            <DarkBandHeader
              id="ebs-catalog-heading"
              eyebrow={isWholesaleAccount ? 'Lista mayorista y retail' : 'Stock actualizado'}
              title={
                featuredProducts.length >= 4 && offerProducts.length === 0
                  ? 'Productos destacados'
                  : 'Novedades y catálogo'
              }
              countLabel={productList.length > 0 ? `${productList.length} disponibles` : undefined}
              ctaLabel="Ver catálogo completo"
              ctaHref={`${prefix}/productos`}
            />

            {productsError ? (
              <div role="status" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                No pudimos cargar el catálogo en este momento.{' '}
                <Link href={`${prefix}/productos`} className="font-bold text-primary underline">
                  Ir a productos
                </Link>
              </div>
            ) : isLoadingProducts ? (
              <div role="status" className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className="h-72 animate-pulse rounded-[18px] border border-border bg-card p-4"
                  />
                ))}
              </div>
            ) : productList.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <Package className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Todavía no hay productos publicados en la tienda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                {(featuredProducts.length >= 4 && offerProducts.length === 0
                  ? featuredProducts
                  : productList
                )
                  .slice(0, 8)
                  .map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      priority={index < 4}
                      isWholesale={product.wholesale_price != null}
                    />
                  ))}
              </div>
            )}
          </section>

          {/* Filas dinámicas por categorías reales del comercio */}
          {categoryRows.map((row, idx) => (
            <div key={row.id} className="space-y-10">
              {idx === 1 && secondarySlides[1] && (
                <InterleavedPromoBanner
                  slide={secondarySlides[1]}
                  prefix={prefix}
                  fallbackStoreName={storeName}
                />
              )}

              <section aria-labelledby={`ebs-cat-${row.id}`} data-ebs-reveal className="ebs-reveal is-visible">
                <DarkBandHeader
                  id={`ebs-cat-${row.id}`}
                  eyebrow="Categoría"
                  title={row.name}
                  countLabel={`${row.items.length} ${row.items.length === 1 ? 'producto' : 'productos'}`}
                  ctaLabel="Ver todos"
                  ctaHref={`${prefix}/productos?category_id=${encodeURIComponent(row.id)}`}
                />
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                  {row.items.slice(0, 4).map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isWholesale={product.wholesale_price != null}
                    />
                  ))}
                </div>
              </section>
            </div>
          ))}

          {/* Portal Minorista / Mayorista real */}
          <section
            aria-labelledby="ebs-wholesale-portal"
            className="relative overflow-hidden rounded-[22px] border border-primary/30 bg-[#111116] p-6 text-white shadow-lg sm:p-8"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary">
                  <Flame className="h-3.5 w-3.5" />
                  {isWholesaleAccount ? 'Cuenta Mayorista Verificada' : 'Venta Minorista y Mayorista'}
                </span>
                <h2 id="ebs-wholesale-portal" className="text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
                  {isWholesaleAccount
                    ? 'Tus precios mayoristas están aplicados en todo el catálogo'
                    : '¿Comprás para tu barbería o revendés insumos?'}
                </h2>
                <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm">
                  {isWholesaleAccount
                    ? 'Explorá las categorías y agregá al carrito o consultá stock por sucursal con tu tarifa mayorista activa.'
                    : 'Iniciá sesión con tu cuenta habilitada o registrate para consultar listas de precios, hacer seguimiento y gestionar pedidos.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {isWholesaleAccount ? (
                  <Link
                    href={`${prefix}/productos?mayorista=true`}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider text-primary-foreground hover:brightness-110"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>Ver lista mayorista</span>
                  </Link>
                ) : (
                  <>
                    <Link
                      href={registerHref}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider text-primary-foreground hover:brightness-110"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Crear cuenta</span>
                    </Link>
                    <Link
                      href={loginHref}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold text-white hover:border-primary hover:text-primary"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>Ingresar</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── 5. #pbm: Grilla oscura de marcas oficiales (desde settings o marcas reales de productos) ── */}
      {displayBrands.length > 0 && (
        <section id="marcas" className="py-6 sm:py-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div
              id="pbm"
              className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0B0B0F] px-5 py-8 text-white shadow-xl sm:px-8 sm:py-10"
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{
                  background:
                    'linear-gradient(90deg, var(--primary), color-mix(in oklch, var(--primary) 82%, #f97316 18%))',
                }}
              />
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-primary">
                    <Award className="h-3.5 w-3.5" />
                    Catálogo oficial
                  </span>
                  <h2 className="mt-1 text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
                    {settings.brands_section?.title || 'Marcas disponibles'}
                  </h2>
                  {settings.brands_section?.subtitle && (
                    <p className="mt-1 text-xs text-zinc-400">{settings.brands_section.subtitle}</p>
                  )}
                </div>
                <Link
                  href={`${prefix}/productos`}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-primary hover:underline"
                >
                  <span>Explorar todas</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {displayBrands.map((brand) => {
                  const presetLogo = getBrandLogoOrFallback(brand.id) || getBrandLogoOrFallback(brand.name)
                  return (
                    <Link
                      key={brand.id}
                      href={brand.href}
                      className="ebs-brand-tile flex h-20 items-center justify-center border border-zinc-200 bg-white px-4 py-3 text-center text-zinc-900 shadow-xs"
                    >
                      {brand.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brand.imageUrl}
                          alt={brand.name}
                          className="max-h-10 max-w-full object-contain"
                        />
                      ) : presetLogo ? (
                        presetLogo
                      ) : (
                        <span className="truncate text-xs font-black uppercase tracking-wide text-zinc-900 sm:text-sm">
                          {brand.name}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. Secciones reales opcionales configuradas por la organización ── */}
      {hasServices && safeServices.length > 0 && (
        <ServicesGrid
          services={safeServices}
          variant="barbero"
          bookingEnabled={Boolean(bookingEnabled && effectiveAgenda)}
          onBookService={(serviceId) => {
            const targetId = agendaServiceIdByServiceId.get(serviceId) ?? serviceId
            setBookingServiceId(targetId)
            document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      )}

      {bookingEnabled && effectiveAgenda && agendaState.tenantSlug && settings.booking_section && (
        <BookingSection
          settings={settings.booking_section}
          agenda={effectiveAgenda}
          slug={agendaState.tenantSlug}
          serviceId={bookingServiceId}
          nextSlot={nextSlot}
          onBookNext={(id) => {
            setBookingServiceId(id)
            document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      )}

      {settings.gallery_section?.enabled && (
        <ServiceGallery settings={settings.gallery_section} />
      )}

      {hasProcessSteps && (
        <ProcessSteps
          brand={brandTheme}
          flows={processFlows}
          tenantPrefix={prefix}
          phoneClean={phoneClean}
          variant="store"
          showCatalog={capabilities.hasCatalog}
        />
      )}

      {branches.length > 1 && (
        <BranchLocations branches={branches} brand={brandTheme} />
      )}

      <BarberLocation company={company ?? {}} />

      <OrganizationReviews hasRepairs={capabilities.hasRepairs} />

      <FloatingWhatsAppButton fallbackPhone={phoneClean || phone} />
    </div>
  )
}
