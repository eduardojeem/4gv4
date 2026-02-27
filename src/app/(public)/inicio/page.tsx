'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Package, Wrench, Shield, Clock, Star, CheckCircle, Phone, Mail, MapPin, Loader2, MessageCircle, Smartphone, Monitor, Battery, Cpu, Zap, Headset, Laptop, Sparkles, Droplet, Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'

const iconMap = {
  wrench: Wrench,
  package: Package,
  shield: Shield,
  smartphone: Smartphone,
  monitor: Monitor,
  battery: Battery,
  cpu: Cpu,
  zap: Zap,
  headset: Headset,
  laptop: Laptop,
  clock: Clock,
  sparkles: Sparkles,
  droplet: Droplet,
  camera: Camera,
  microchip: Cpu
}

const colorMap = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', hover: 'group-hover:bg-blue-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600', hover: 'group-hover:bg-green-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', hover: 'group-hover:bg-purple-600' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', hover: 'group-hover:bg-orange-600' },
  red: { bg: 'bg-red-100', text: 'text-red-600', hover: 'group-hover:bg-red-600' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', hover: 'group-hover:bg-indigo-600' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600', hover: 'group-hover:bg-teal-600' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600', hover: 'group-hover:bg-rose-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', hover: 'group-hover:bg-amber-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', hover: 'group-hover:bg-emerald-600' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', hover: 'group-hover:bg-cyan-600' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-600', hover: 'group-hover:bg-sky-600' }
}

export default function HomePage() {
  const { settings, isLoading, error } = useWebsiteSettings()
  const [offersLoading, setOffersLoading] = useState(true)
  const [offersFetchFailed, setOffersFetchFailed] = useState(false)
  const [offerCards, setOfferCards] = useState<Array<{
    id: string
    title: string
    description: string
    priceLabel: string
    originalPriceLabel?: string
    tag: string
    ctaHref: string
    image: string | null
    brand: string | null
    inStock: boolean
  }>>([])
  const [activeOfferIndex, setActiveOfferIndex] = useState(0)
  const [isOfferCarouselPaused, setIsOfferCarouselPaused] = useState(false)
  const [isOffersSectionVisible, setIsOffersSectionVisible] = useState(true)
  const [isDocumentVisible, setIsDocumentVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const offersTrackRef = useRef<HTMLDivElement | null>(null)
  const offersSectionRef = useRef<HTMLElement | null>(null)
  const company_info = settings?.company_info ?? {
    name: '4G Movil',
    phone: '',
    email: '',
    address: '',
    hours: { weekdays: '', saturday: '', sunday: '' },
    brandColor: 'blue' as const,
  }
  const hero_stats = settings?.hero_stats ?? {
    repairs: '0+',
    satisfaction: '0%',
    avgTime: '24h',
  }
  const hero_content = settings?.hero_content ?? {
    badge: 'Servicio tecnico',
    title: 'Reparacion y venta de tecnologia',
    subtitle: 'Atencion experta para mantener tus equipos en su mejor estado.',
  }
  const safeServices = useMemo(() => Array.isArray(settings?.services) ? settings.services.filter(s => s.active !== false) : [], [settings?.services])
  const safeTestimonials = useMemo(() => Array.isArray(settings?.testimonials) ? settings.testimonials.filter(t => t.active !== false) : [], [settings?.testimonials])
  const fallbackOffers = useMemo(() => {
    const serviceCards = safeServices.slice(0, 8).map((service, index) => ({
      id: `service-${service.id || index}`,
      title: service.title,
      description: service.description || 'Servicio tecnico profesional',
      priceLabel: 'Consulta precio',
      originalPriceLabel: undefined,
      tag: 'Servicio',
      ctaHref: '/inicio#contacto',
      image: null,
      brand: company_info?.name || null,
      inStock: true,
    }))

    if (serviceCards.length > 0) return serviceCards

    return [
      {
        id: 'fallback-1',
        title: 'Cambio de pantalla',
        description: 'Repuestos de calidad con garantia escrita.',
        priceLabel: 'Desde $49.990',
        originalPriceLabel: undefined,
        tag: 'Oferta',
        ctaHref: '/inicio#contacto',
        image: null,
        brand: company_info?.name || null,
        inStock: true,
      },
      {
        id: 'fallback-2',
        title: 'Bateria nueva',
        description: 'Recupera autonomia y rendimiento de carga.',
        priceLabel: 'Desde $29.990',
        originalPriceLabel: undefined,
        tag: 'Top venta',
        ctaHref: '/inicio#contacto',
        image: null,
        brand: company_info?.name || null,
        inStock: true,
      },
      {
        id: 'fallback-3',
        title: 'Limpieza interna',
        description: 'Mantenimiento preventivo y optimizacion.',
        priceLabel: 'Desde $19.990',
        originalPriceLabel: undefined,
        tag: 'Promo',
        ctaHref: '/inicio#contacto',
        image: null,
        brand: company_info?.name || null,
        inStock: true,
      },
    ]
  }, [safeServices, company_info?.name])
  const phoneClean = (company_info?.phone || '').replace(/\D/g, '')
  const emailSafe = company_info?.email || ''
  const contactHref = phoneClean
    ? `https://wa.me/${phoneClean}`
    : emailSafe
      ? `mailto:${emailSafe}`
      : '/inicio#contacto'

  const brandColor = company_info.brandColor || 'blue'
  const brandMap: Record<string, { hero: string; text200: string; text300: string; cta: string }> = {
    blue: { hero: 'from-blue-600 via-blue-700 to-blue-900', text200: 'text-blue-200', text300: 'text-blue-300', cta: 'from-blue-600 to-blue-800' },
    green: { hero: 'from-green-600 via-emerald-600 to-teal-700', text200: 'text-green-200', text300: 'text-green-300', cta: 'from-green-600 to-teal-700' },
    purple: { hero: 'from-purple-600 via-fuchsia-600 to-pink-700', text200: 'text-purple-200', text300: 'text-purple-300', cta: 'from-purple-600 to-pink-700' },
    orange: { hero: 'from-orange-600 via-amber-600 to-red-700', text200: 'text-orange-200', text300: 'text-orange-300', cta: 'from-orange-600 to-red-700' },
    red: { hero: 'from-red-600 via-rose-600 to-red-800', text200: 'text-red-200', text300: 'text-red-300', cta: 'from-red-600 to-rose-700' },
    indigo: { hero: 'from-indigo-600 via-indigo-700 to-blue-800', text200: 'text-indigo-200', text300: 'text-indigo-300', cta: 'from-indigo-600 to-blue-800' },
    teal: { hero: 'from-teal-600 via-emerald-600 to-green-700', text200: 'text-teal-200', text300: 'text-teal-300', cta: 'from-teal-600 to-emerald-700' },
    rose: { hero: 'from-rose-600 via-pink-600 to-rose-700', text200: 'text-rose-200', text300: 'text-rose-300', cta: 'from-rose-600 to-pink-700' },
    amber: { hero: 'from-amber-500 via-orange-500 to-yellow-600', text200: 'text-amber-100', text300: 'text-amber-200', cta: 'from-amber-500 to-orange-700' },
    emerald: { hero: 'from-emerald-600 via-teal-600 to-green-700', text200: 'text-emerald-100', text300: 'text-emerald-200', cta: 'from-emerald-600 to-teal-700' },
    cyan: { hero: 'from-cyan-600 via-sky-600 to-blue-700', text200: 'text-cyan-100', text300: 'text-cyan-200', cta: 'from-cyan-600 to-sky-700' },
    sky: { hero: 'from-sky-500 via-blue-500 to-indigo-600', text200: 'text-sky-100', text300: 'text-sky-200', cta: 'from-sky-500 to-blue-700' }
  }
  const brand = brandMap[brandColor] ?? brandMap.blue

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadOffers() {
      try {
        setOffersLoading(true)
        const response = await fetch('/api/public/products?per_page=50&sort=newest&has_offer=true', { signal: controller.signal })
        const body = await response.json().catch(() => null)
        const products = body?.data?.products

        if (!response.ok || !Array.isArray(products)) {
          setOffersFetchFailed(true)
          setOfferCards(fallbackOffers)
          return
        }

        const selected = [...products]
          .filter((product) => {
            const salePrice = Number(product?.sale_price || 0)
            const offerPrice = Number(product?.offer_price || 0)
            return Boolean(product?.has_offer) && offerPrice > 0 && salePrice > 0 && offerPrice < salePrice
          })
          .sort((a, b) => Number(Boolean(b?.featured)) - Number(Boolean(a?.featured)))
          .slice(0, 8)
          .map((product) => ({
            id: String(product.id),
            title: String(product.name || 'Producto destacado'),
            description: String(product.description || 'Disponible para entrega inmediata y retiro en tienda.'),
            priceLabel: typeof product.offer_price === 'number' ? `$${product.offer_price.toLocaleString('es-CL')}` : 'Consultar precio',
            originalPriceLabel: typeof product.sale_price === 'number' ? `$${product.sale_price.toLocaleString('es-CL')}` : undefined,
            tag: 'Oferta activa',
            ctaHref: product.id ? `/productos/${product.id}` : '/productos',
            image: product.image || (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null),
            brand: product.brand || null,
            inStock: Number(product.stock_quantity || 0) > 0,
          }))

        setOffersFetchFailed(false)
        setOfferCards(selected)
      } catch {
        if (!controller.signal.aborted) {
          setOffersFetchFailed(true)
          setOfferCards(fallbackOffers)
        }
      } finally {
        if (!controller.signal.aborted) {
          setOffersLoading(false)
        }
      }
    }

    loadOffers()
    return () => controller.abort()
  }, [fallbackOffers])

  useEffect(() => {
    if (offerCards.length === 0) {
      setActiveOfferIndex(0)
      return
    }
    setActiveOfferIndex((prev) => Math.min(prev, offerCards.length - 1))
  }, [offerCards.length])

  useEffect(() => {
    const handleVisibility = () => {
      setIsDocumentVisible(document.visibilityState === 'visible')
    }
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    if (!offersSectionRef.current || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setIsOffersSectionVisible(Boolean(entry?.isIntersecting))
      },
      { threshold: 0.2 }
    )

    observer.observe(offersSectionRef.current)
    return () => observer.disconnect()
  }, [offersLoading])

  const findNearestOfferIndex = () => {
    const track = offersTrackRef.current
    if (!track) return 0
    const children = Array.from(track.children) as HTMLElement[]
    if (children.length === 0) return 0

    const left = track.scrollLeft
    let nearest = 0
    let minDistance = Number.POSITIVE_INFINITY
    children.forEach((child, idx) => {
      const distance = Math.abs(child.offsetLeft - left)
      if (distance < minDistance) {
        minDistance = distance
        nearest = idx
      }
    })

    return nearest
  }

  useEffect(() => {
    if (isOfferCarouselPaused || offerCards.length <= 1 || !isOffersSectionVisible || !isDocumentVisible) return

    const interval = window.setInterval(() => {
      setActiveOfferIndex((prev) => {
        const next = (prev + 1) % offerCards.length
        const node = offersTrackRef.current?.children?.item(next) as HTMLElement | null
        node?.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          inline: 'start',
          block: 'nearest',
        })
        return next
      })
    }, 5000)

    return () => window.clearInterval(interval)
  }, [offerCards.length, isOfferCarouselPaused, isOffersSectionVisible, isDocumentVisible, prefersReducedMotion])

  const goToOffer = (index: number) => {
    if (offerCards.length === 0) return
    const normalized = (index + offerCards.length) % offerCards.length
    setActiveOfferIndex(normalized)
    const node = offersTrackRef.current?.children?.item(normalized) as HTMLElement | null
    node?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      inline: 'start',
      block: 'nearest',
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Error al cargar el contenido</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className={`relative overflow-hidden bg-gradient-to-br ${brand.hero} py-20 text-white md:py-32`}>
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="container relative">
          <div className="mx-auto max-w-4xl text-center">
            {company_info.logoUrl && (
              <div className="mb-6 flex justify-center">
                <Image src={company_info.logoUrl} alt={company_info.name || 'Logo'} width={72} height={72} className="rounded-xl shadow-lg" />
              </div>
            )}
            <div className="mb-6 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
              {hero_content.badge}
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              {hero_content.title}
            </h1>
            <p className={`mt-6 text-lg ${brand.text200} sm:text-xl`}>
              {hero_content.subtitle}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
                <Link href="/mis-reparaciones">
                  Rastrear mi reparación
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <a href={contactHref} target={phoneClean ? "_blank" : undefined} rel={phoneClean ? "noopener noreferrer" : undefined}>
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Escribinos
                </a>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-16 grid gap-8 text-center sm:grid-cols-3">
              <div>
                <div className="text-4xl font-bold">{hero_stats.repairs}</div>
                <div className={`mt-1 text-sm ${brand.text200}`}>Reparaciones realizadas</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{hero_stats.satisfaction}</div>
                <div className={`mt-1 text-sm ${brand.text200}`}>Clientes satisfechos</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{hero_stats.avgTime}</div>
                <div className={`mt-1 text-sm ${brand.text200}`}>Tiempo promedio</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ofertas y productos destacados */}
      <section ref={offersSectionRef} className="border-t bg-background py-14 md:py-20">
        <div className="container">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">Tienda</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Ofertas y productos destacados</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Precios actualizados, servicios populares y equipos recomendados por nuestros tecnicos.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/productos">
                Ver catalogo completo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {offersLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-64 animate-pulse rounded-2xl border bg-muted/40" />
              ))}
            </div>
          ) : !offersFetchFailed && offerCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
              <p className="text-base font-semibold">No hay ofertas activas en este momento</p>
              <p className="mt-2 text-sm text-muted-foreground">Cuando actives productos con precio en oferta, apareceran aqui automaticamente.</p>
            </div>
          ) : (
            <div
              className="relative"
              onMouseEnter={() => setIsOfferCarouselPaused(true)}
              onMouseLeave={() => setIsOfferCarouselPaused(false)}
            >
              <div
                ref={offersTrackRef}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                tabIndex={0}
                role="region"
                aria-label="Carrusel de ofertas destacadas"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    goToOffer(activeOfferIndex - 1)
                  } else if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    goToOffer(activeOfferIndex + 1)
                  }
                }}
                onScroll={(event) => {
                  const next = findNearestOfferIndex()
                  setActiveOfferIndex(Math.max(0, Math.min(offerCards.length - 1, next)))
                }}
              >
                {offerCards.map((offer) => (
                  <article
                    key={offer.id}
                    className="min-w-[88%] snap-start overflow-hidden rounded-2xl border bg-card sm:min-w-[62%] lg:min-w-[36%]"
                  >
                    <div className="relative h-40 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                      {offer.image ? (
                        <Image
                          src={offer.image}
                          alt={offer.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 88vw, (max-width: 1200px) 62vw, 36vw"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-12 w-12 text-slate-500/60" />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white">
                        {offer.tag}
                      </span>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="line-clamp-1 text-lg font-semibold">{offer.title}</h3>
                          <p className="text-xs text-muted-foreground">{offer.brand || company_info.name || '4G Movil'}</p>
                        </div>
                        <div className="text-right">
                          {offer.originalPriceLabel && (
                            <p className="text-xs text-muted-foreground line-through">{offer.originalPriceLabel}</p>
                          )}
                          <p className="text-lg font-bold text-primary">{offer.priceLabel}</p>
                        </div>
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{offer.description}</p>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${offer.inStock ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {offer.inStock ? 'Disponible' : 'Sin stock'}
                        </span>
                        <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
                          <Link href={offer.ctaHref}>Ver detalle</Link>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {offerCards.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute left-2 top-1/2 hidden -translate-y-1/2 bg-background/90 sm:flex"
                    onClick={() => goToOffer(activeOfferIndex - 1)}
                    aria-label="Oferta anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-1/2 hidden -translate-y-1/2 bg-background/90 sm:flex"
                    onClick={() => goToOffer(activeOfferIndex + 1)}
                    aria-label="Siguiente oferta"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="mt-3 flex justify-center gap-2">
                    {offerCards.map((offer, idx) => (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => goToOffer(idx)}
                        className={`h-2.5 rounded-full transition-all ${idx === activeOfferIndex ? 'w-8 bg-primary' : 'w-2.5 bg-muted-foreground/30'}`}
                        aria-label={`Ir a oferta ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Servicios Principales */}
      <section className="border-t bg-muted/40 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Nuestros servicios
            </h2>
            <p className="mt-4 text-muted-foreground">
              Soluciones completas para tu dispositivo
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {safeServices.map((service) => {
              const IconComponent = iconMap[service.icon] || Wrench
              const colors = colorMap[service.color] || colorMap.blue

              return (
                <Card key={service.id} className="group transition-all hover:shadow-lg">
                  <CardContent className="pt-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg} ${colors.text} ${colors.hover} group-hover:text-white transition-colors`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{service.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {service.description}
                    </p>
                    <ul className="mt-4 space-y-2 text-sm">
                      {service.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Proceso */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Cómo funciona
            </h2>
            <p className="mt-4 text-muted-foreground">
              Proceso simple y transparente en 4 pasos
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                1
              </div>
              <h3 className="mt-4 font-semibold">Diagnóstico</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Evaluamos tu dispositivo de forma gratuita
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                2
              </div>
              <h3 className="mt-4 font-semibold">Presupuesto</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Te damos un precio claro y sin sorpresas
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                3
              </div>
              <h3 className="mt-4 font-semibold">Reparación</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Nuestros técnicos reparan tu celular
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-600">
                4
              </div>
              <h3 className="mt-4 font-semibold">Entrega</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Recoge tu dispositivo como nuevo
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="border-t bg-muted/40 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Lo que dicen nuestros clientes
            </h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {safeTestimonials.map((testimonial) => (
              <Card key={testimonial.id}>
                <CardContent className="pt-6">
                  <div className="flex gap-1 text-yellow-400">
                    {[...Array(Math.max(0, Math.min(5, Math.round(Number(testimonial.rating) || 0))))].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    "{testimonial.comment}"
                  </p>
                  <p className="mt-4 text-sm font-semibold">{testimonial.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section id="contacto" className={`border-t bg-gradient-to-br ${brand.cta} py-16 text-white md:py-24`}>
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              ¿Listo para reparar tu celular?
            </h2>
            <p className="mt-4 text-lg text-blue-100">
              Visítanos o contáctanos para un diagnóstico gratuito
            </p>
            
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
                <Link href="/mis-reparaciones">
                  Rastrear mi reparación
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <a href={contactHref} target={phoneClean ? "_blank" : undefined} rel={phoneClean ? "noopener noreferrer" : undefined}>
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Escribinos
                </a>
              </Button>
            </div>

            {/* Contact info */}
            <div className="mt-16 grid gap-8 text-left sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <Phone className={`h-5 w-5 ${brand.text300}`} />
                <div>
                  <p className="font-semibold">Teléfono</p>
                  <p className={`mt-1 text-sm ${brand.text200}`}>{company_info.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className={`h-5 w-5 ${brand.text300}`} />
                <div>
                  <p className="font-semibold">Email</p>
                  <p className={`mt-1 text-sm ${brand.text200}`}>{company_info.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className={`h-5 w-5 ${brand.text300}`} />
                <div>
                  <p className="font-semibold">Ubicación</p>
                  <p className={`mt-1 text-sm ${brand.text200}`}>{company_info.address}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
