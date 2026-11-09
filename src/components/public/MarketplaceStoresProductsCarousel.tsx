'use client'

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  Store,
  MapPin,
  ArrowRight,
  Star,
  BadgeCheck,
  Package,
  Sparkles,
  ShieldCheck,
  ShoppingBag,
  Play,
  Pause,
  Search,
  X,
  SlidersHorizontal,
  Tag,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice, cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { hidesPublicPrice } from '@/lib/products/price-visibility'
import { getWhatsAppLink } from '@/lib/whatsapp'
import { organizationAccentColor } from '@/lib/public/organization-brand'
import { RUBRO_LABELS } from '@/components/public/OrganizationDirectoryCard'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

interface Props {
  organizations: MarketplaceOrganization[]
  className?: string
  exploreAllHref?: string
  exploreAllLabel?: string
  title?: string
  subtitle?: string
}

function getStoreBackdrop(rubro?: string | null): string {
  switch (rubro) {
    case 'tecnologia':
    case 'electronica':
      return 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80&auto=format'
    case 'indumentaria':
    case 'moda':
      return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80&auto=format'
    case 'hogar':
    case 'muebles':
      return 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80&auto=format'
    case 'belleza':
    case 'estetica':
      return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80&auto=format'
    case 'alimentos':
    case 'gastronomia':
      return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80&auto=format'
    case 'servicios':
    case 'reparaciones':
      return 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&auto=format'
    default:
      return 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80&auto=format'
  }
}

function getStoreAmbientGradient(rubro?: string | null): string {
  switch (rubro) {
    case 'tecnologia':
    case 'electronica':
      return 'from-cyan-900/80 via-blue-950/60 to-background'
    case 'indumentaria':
    case 'moda':
      return 'from-purple-900/80 via-violet-950/60 to-background'
    case 'hogar':
    case 'muebles':
      return 'from-amber-900/80 via-stone-950/60 to-background'
    case 'alimentos':
    case 'gastronomia':
      return 'from-amber-800/80 via-yellow-950/60 to-background'
    case 'belleza':
    case 'estetica':
      return 'from-rose-900/80 via-pink-950/60 to-background'
    case 'servicios':
    case 'reparaciones':
      return 'from-sky-900/80 via-slate-950/60 to-background'
    default:
      return 'from-primary/30 via-card/70 to-background'
  }
}

export function MarketplaceStoresProductsCarousel({
  organizations,
  className,
  exploreAllHref = '/marketplace/empresas',
  exploreAllLabel = 'Ver todas',
  title = 'Tiendas destacadas y sus productos',
  subtitle = 'Explorá las tiendas oficiales del marketplace y descubrí sus últimos productos disponibles con compra y atención directa.',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [activeScrollIndex, setActiveScrollIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [autoplayEnabled, setAutoplayEnabled] = useState(true)

  // Búsqueda y filtros interactivos de tiendas (estilo Showcase de categorías)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFiltersPanel, setShowFiltersPanel] = useState(false)
  const [selectedRubro, setSelectedRubro] = useState<string>('all')
  const [onlyOffers, setOnlyOffers] = useState(false)

  // Priorizar tiendas que tengan al menos 1 producto cargado
  const storesWithProducts = useMemo(() => {
    const withProds = organizations.filter(
      (org) => (org.featured_products && org.featured_products.length > 0) || org.products_count > 0
    )
    return withProds.length > 0 ? withProds : organizations
  }, [organizations])

  // Filtrado reactivo de tiendas por nombre, eslogan, ciudad o rubro
  const filteredStores = useMemo(() => {
    let list = storesWithProducts

    if (selectedRubro !== 'all') {
      list = list.filter((org) => org.rubro === selectedRubro)
    }

    if (onlyOffers) {
      list = list.filter((org) =>
        org.featured_products?.some((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price)
      )
    }

    const q = searchQuery.trim().toLowerCase()
    if (!q) return list

    return list.filter((org) => {
      const nameMatch = org.name.toLowerCase().includes(q)
      const sloganMatch = (org.slogan || '').toLowerCase().includes(q)
      const descMatch = (org.description || '').toLowerCase().includes(q)
      const cityMatch = (org.city || '').toLowerCase().includes(q)
      const rubroMatch = (org.rubro || '').toLowerCase().includes(q)
      const prodMatch = (org.featured_products || []).some((p) => p.name.toLowerCase().includes(q))
      return nameMatch || sloganMatch || descMatch || cityMatch || rubroMatch || prodMatch
    })
  }, [storesWithProducts, searchQuery, selectedRubro, onlyOffers])

  // Extraer rubros únicos disponibles para los filtros rápidos
  const availableRubros = useMemo(() => {
    const rubrosSet = new Set<string>()
    storesWithProducts.forEach((s) => {
      if (s.rubro) rubrosSet.add(s.rubro)
    })
    return Array.from(rubrosSet)
  }, [storesWithProducts])

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10)

    const card = el.querySelector<HTMLElement>('[data-store-card]')
    const cardWidth = card ? card.offsetWidth + 16 : 380
    const currentIndex = Math.round(el.scrollLeft / cardWidth)
    setActiveScrollIndex(Math.max(0, Math.min(currentIndex, Math.max(0, filteredStores.length - 1))))
  }, [filteredStores.length])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  // Desplazamiento automático (Autoplay) cada 4.5s con pausa al interactuar
  useEffect(() => {
    if (!autoplayEnabled || isPaused || filteredStores.length <= 1) return

    const timer = setInterval(() => {
      const el = scrollRef.current
      if (!el) return

      const card = el.querySelector<HTMLElement>('[data-store-card]')
      const cardWidth = card ? card.offsetWidth + 16 : 380
      const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 30

      if (isAtEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: cardWidth, behavior: 'smooth' })
      }
    }, 4500)

    return () => clearInterval(timer)
  }, [autoplayEnabled, isPaused, filteredStores.length])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-store-card]')
    const cardWidth = card ? card.offsetWidth + 16 : 380
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current
    if (!el) return
    const cards = el.querySelectorAll<HTMLElement>('[data-store-card]')
    const targetCard = cards[index]
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      setActiveScrollIndex(index)
    }
  }

  if (storesWithProducts.length === 0) return null

  const activeStore = filteredStores[activeScrollIndex] ?? filteredStores[0] ?? storesWithProducts[0]
  const activeAmbientGradient = getStoreAmbientGradient(activeStore?.rubro)

  return (
    <section
      aria-labelledby="marketplace-stores-carousel-heading"
      suppressHydrationWarning
      className={cn(
        'relative py-8 sm:py-14 border-b border-border/80 overflow-hidden transition-all duration-700 bg-gradient-to-b',
        activeAmbientGradient,
        className
      )}
    >
      {/* ── Luces y resplandores ambientales dinámicos (Showcase Glows) ── */}
      <div className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-80 w-80 rounded-full bg-black/15 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Encabezado Premium de la Sección ── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white shadow-2xs backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300 animate-pulse" />
              <span>Selección Oficial · Comercios Verificados</span>
              <span className="h-1 w-1 rounded-full bg-white/60" />
              <span className="text-[11px] font-semibold text-white/85">
                {filteredStores.length} {filteredStores.length === 1 ? 'tienda' : 'tiendas'}
              </span>
            </div>

            <h2
              id="marketplace-stores-carousel-heading"
              className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-sm"
            >
              {title}
            </h2>

            <p className="text-xs sm:text-sm text-white/85 leading-relaxed font-medium">
              {subtitle}
            </p>
          </div>

          {/* Acciones y Autoplay Desktop */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-white/25 bg-white/15 backdrop-blur-md text-white text-xs font-bold hover:bg-white/25 hover:text-white shadow-xs transition-all"
            >
              <Link href={exploreAllHref}>
                <span>{exploreAllLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>

            {/* Control sutil de reproducción automática */}
            {filteredStores.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAutoplayEnabled((prev) => !prev)}
                className="h-9 w-9 rounded-full border-white/25 bg-white/15 backdrop-blur-md text-white hover:bg-white/25 hover:text-white shadow-xs transition-all active:scale-95"
                aria-label={autoplayEnabled ? 'Pausar avance automático' : 'Activar avance automático'}
                title={autoplayEnabled ? 'Pausar avance automático' : 'Activar avance automático'}
              >
                {autoplayEnabled ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* ── Barra de Búsqueda Flotante tipo Cápsula Blanca (Estilo Showcase) ── */}
        <div className="relative mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tiendas o comercios..."
                className="h-12 w-full rounded-full border-0 bg-white/95 dark:bg-card/95 text-slate-900 dark:text-foreground pl-11 pr-10 text-sm shadow-md backdrop-blur-md placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Botón Circular Filtros al lado del buscador */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setShowFiltersPanel((prev) => !prev)}
              aria-label="Alternar filtros de tiendas"
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/95 dark:bg-card/95 shadow-md backdrop-blur-md transition-all',
                showFiltersPanel || selectedRubro !== 'all' || onlyOffers
                  ? 'bg-purple-600 text-white ring-2 ring-white/50'
                  : 'text-purple-600 hover:bg-white'
              )}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>

          {/* Panel de Filtros Desplegable */}
          {showFiltersPanel && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-white/95 dark:bg-card/95 p-3.5 shadow-xl backdrop-blur-md border border-white/20">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setSelectedRubro('all')}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                    selectedRubro === 'all'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-muted dark:text-muted-foreground'
                  )}
                >
                  Todas ({storesWithProducts.length})
                </button>

                {availableRubros.map((rubroKey) => {
                  const meta = RUBRO_LABELS[rubroKey] ?? { label: rubroKey }
                  const isSel = selectedRubro === rubroKey
                  return (
                    <button
                      key={rubroKey}
                      type="button"
                      suppressHydrationWarning
                      onClick={() => setSelectedRubro(isSel ? 'all' : rubroKey)}
                      className={cn(
                        'rounded-xl px-3 py-1.5 text-xs font-bold transition-all capitalize',
                        isSel
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-muted dark:text-muted-foreground'
                      )}
                    >
                      {meta.label}
                    </button>
                  )
                })}

                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setOnlyOffers((prev) => !prev)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                    onlyOffers
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-muted dark:text-muted-foreground'
                  )}
                >
                  <Tag className="h-3 w-3" />
                  <span>Con ofertas</span>
                </button>
              </div>

              {(searchQuery || selectedRubro !== 'all' || onlyOffers) && (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedRubro('all')
                    setOnlyOffers(false)
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-muted-foreground dark:hover:text-foreground underline underline-offset-2"
                >
                  Restablecer
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Contenedor Relativo con Flechas Flotantes Laterales (Mismo diseño de categorías) ── */}
        {filteredStores.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-8 sm:p-12 text-center text-white my-4">
            <Store className="h-12 w-12 text-white/50 mb-3" />
            <h3 className="text-lg font-bold">
              No encontramos tiendas {searchQuery ? `para "${searchQuery}"` : 'con los filtros seleccionados'}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-white/80 max-w-md">
              Probá con otro término de búsqueda o restablecé los filtros para ver todas las tiendas disponibles.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setSelectedRubro('all')
                setOnlyOffers(false)
              }}
              className="mt-4 rounded-full border-white/30 bg-white/20 text-white hover:bg-white hover:text-slate-900 transition-all font-semibold"
            >
              Restablecer búsqueda
            </Button>
          </div>
        ) : (
          <div className="relative">
            {/* Controles de flecha desktop flotantes a los costados del carrusel */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="Tienda anterior"
              className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl backdrop-blur-md hover:bg-white disabled:opacity-0 transition-all active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="Siguiente tienda"
              className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl backdrop-blur-md hover:bg-white disabled:opacity-0 transition-all active:scale-95"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Carril Deslizable de Tarjetas Gigantes (Showcase Hero Style) */}
            <div
              ref={scrollRef}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
              className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 pt-1 scroll-smooth scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {filteredStores.map((org, index) => {
                const rubroKey = org.rubro || 'comercio'
                const rubroMeta = RUBRO_LABELS[rubroKey] ?? RUBRO_LABELS.comercio
                const RubroIcon = rubroMeta.icon
                const storeUrl = `/${org.slug}/inicio`
                const products = (org.featured_products || []).slice(0, 4)
                const accentColor = organizationAccentColor(org)
                const backdropImg = getStoreBackdrop(org.rubro)
                const isActive = index === activeScrollIndex

                const whatsappDigits = (org.whatsapp || org.phone || '').replace(/\D/g, '')
                const whatsappHref = whatsappDigits.length >= 6
                  ? getWhatsAppLink({
                      phone: org.whatsapp || org.phone!,
                      message: `¡Hola ${org.name}! Vi su tienda en el Marketplace y quería hacerles una consulta sobre sus productos.`,
                    })
                  : null

                return (
                  <div
                    key={org.id}
                    data-store-card
                    className={cn(
                      'group/card relative shrink-0 overflow-hidden rounded-[28px] sm:rounded-[32px] shadow-2xl transition-all duration-300 flex flex-col justify-between',
                      'w-[85vw] max-w-[360px] sm:w-[420px] md:w-[460px]',
                      'h-[460px] sm:h-[490px]',
                      isActive ? 'scale-100 ring-2 ring-white/50' : 'scale-[0.98] opacity-95'
                    )}
                    style={{ scrollSnapAlign: 'center' }}
                  >
                    {/* ── Imagen de Fondo de Alta Calidad (Showcase Cover) ── */}
                    <Image
                      src={backdropImg}
                      alt={org.name}
                      fill
                      sizes="(max-width: 768px) 85vw, 460px"
                      className="object-cover transition-transform duration-700 group-hover/card:scale-105"
                      priority={index < 2}
                    />

                    {/* ── Doble Gradiente Oscuro para Legibilidad Cristalina (Estilo Showcase) ── */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/85 via-black/40 to-black/90" />

                    {/* ── Parte Superior: Identidad, Logo y Badges ── */}
                    <div className="relative z-10 p-5 sm:p-6 text-white space-y-3">
                      {/* Eyebrow de Verificación y Ubicación */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-cyan-300 drop-shadow-sm flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          <span>Tienda Oficial</span>
                          {org.city && <span>· {org.city}</span>}
                        </span>

                        {(org.review_count ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 backdrop-blur-md border border-amber-300/30 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                            <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                            {Number(org.review_rating_avg ?? 0).toFixed(1)}
                            <span className="text-[9px] opacity-75">({org.review_count})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                            <ShieldCheck className="h-3 w-3 text-emerald-400" />
                            <span>Verificada</span>
                          </span>
                        )}
                      </div>

                      {/* Logo + Nombre de la Tienda */}
                      <div className="flex items-center gap-3.5">
                        <Link
                          href={storeUrl}
                          className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/80 bg-white p-1.5 shadow-xl transition-transform duration-300 group-hover/card:scale-105"
                        >
                          {org.logo_url ? (
                            <AppImage
                              src={org.logo_url}
                              alt={org.name}
                              width={64}
                              height={64}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div
                              className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-700 font-black text-base text-white shadow-xs"
                              style={accentColor ? { backgroundColor: accentColor, backgroundImage: 'none' } : undefined}
                            >
                              {org.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={storeUrl}
                              className="font-black text-lg sm:text-2xl text-white hover:text-cyan-200 transition-colors truncate tracking-tight drop-shadow-md"
                            >
                              {org.name}
                            </Link>
                            <BadgeCheck className="h-4.5 w-4.5 shrink-0 text-cyan-400 fill-cyan-400/20" />
                          </div>

                          {/* Chips de rubro */}
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white/90">
                              <RubroIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">{rubroMeta.label}</span>
                            </span>

                            {org.products_count > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-md px-2 py-0.5 text-[10px] text-white/80 font-medium">
                                <Package className="h-3 w-3 text-cyan-300" />
                                <span>{org.products_count} productos</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Slogan o Descripción */}
                      {(org.slogan || org.description) && (
                        <p className="text-xs text-white/90 line-clamp-1 leading-relaxed font-medium bg-black/30 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/15 drop-shadow-xs">
                          {org.slogan || org.description}
                        </p>
                      )}
                    </div>

                    {/* ── Parte Central: Vitrina de Productos con Fondo Esmerilado ── */}
                    <div className="relative z-10 px-5 sm:px-6 flex-1 flex flex-col justify-center">
                      <div className="rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 p-3 shadow-inner">
                        <div className="mb-2 flex items-center justify-between text-white/90">
                          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-cyan-300">
                            <ShoppingBag className="h-3.5 w-3.5" />
                            <span>Productos destacados</span>
                          </div>
                          <Link
                            href={storeUrl}
                            className="text-[11px] font-bold text-white/90 hover:text-white hover:underline flex items-center gap-0.5"
                          >
                            <span>Ver catálogo</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>

                        {products.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2">
                            {products.map((prod) => {
                              const prodImg = resolveProductImageUrl(prod.image)
                              const precioOculto = hidesPublicPrice(prod)
                              const hasDiscount = !precioOculto && Boolean(prod.has_offer && prod.offer_price && prod.offer_price < prod.sale_price)
                              const displayPrice = hasDiscount && prod.offer_price ? prod.offer_price : prod.sale_price
                              const prodHref = `/${org.slug}/productos/${prod.id}`

                              return (
                                <Link
                                  key={prod.id}
                                  href={prodHref}
                                  className="group/prod flex flex-col justify-between rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 p-1.5 shadow-sm transition-all duration-200"
                                >
                                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black/20 p-1">
                                    {prodImg ? (
                                      <AppImage
                                        src={prodImg}
                                        alt={prod.name}
                                        fill
                                        className="object-contain transition-transform duration-300 group-hover/prod:scale-110"
                                        sizes="90px"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center">
                                        <Package className="h-4 w-4 text-white/40" />
                                      </div>
                                    )}
                                    {hasDiscount && (
                                      <span className="absolute top-1 right-1 rounded-full bg-rose-600 px-1 py-0.2 text-[8px] font-black text-white uppercase tracking-wider shadow-xs">
                                        Oferta
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 space-y-0.5 text-left">
                                    <p className="text-[10px] font-semibold text-white/90 truncate group-hover/prod:text-cyan-200 transition-colors">
                                      {prod.name}
                                    </p>
                                    <p className="text-[11px] font-black text-white tracking-tight">
                                      {precioOculto
                                        ? 'Consultar'
                                        : formatPrice(displayPrice, org.currency ?? 'PYG')}
                                    </p>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        ) : (
                          <Link
                            href={storeUrl}
                            className="flex items-center justify-between gap-2.5 rounded-xl bg-white/10 hover:bg-white/20 p-3 transition-all"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                                <Store className="h-4 w-4" />
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-bold text-white">
                                  Catálogo completo disponible
                                </p>
                                <p className="text-[10px] text-white/75">
                                  Precios y atención online directa.
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-cyan-300" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* ── Parte Inferior: Botón Cápsula "Visitar tienda" y WhatsApp ── */}
                    <div className="relative z-10 p-4 sm:p-5 flex items-center gap-2.5">
                      <Link
                        href={storeUrl}
                        className="group/btn flex-1 flex items-center justify-between rounded-full bg-white/95 dark:bg-card/95 py-2.5 px-4 sm:py-3 sm:px-5 text-slate-900 dark:text-foreground shadow-xl backdrop-blur-md transition-all hover:bg-white"
                      >
                        <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                          Visitar tienda
                        </span>
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition-transform group-hover/btn:translate-x-1 shadow-sm">
                          <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
                        </div>
                      </Link>

                      {/* Botón WhatsApp Directo */}
                      {whatsappHref && (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-11 sm:h-12 items-center gap-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white px-3.5 sm:px-4 text-xs font-bold shadow-lg backdrop-blur-md transition-all active:scale-95 shrink-0"
                          aria-label={`Contactar por WhatsApp a ${org.name}`}
                        >
                          <WhatsAppIcon className="h-4 w-4 fill-white" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Indicador de Bolitas de Slides ── */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {filteredStores.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  suppressHydrationWarning
                  onClick={() => scrollToIndex(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === activeScrollIndex
                      ? 'w-6 bg-white shadow-xs'
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  )}
                  aria-label={`Tienda ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
