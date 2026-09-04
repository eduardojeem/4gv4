'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Eye, Pause, Play, Sparkles, Store, Tag, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { MarketplaceProduct } from '@/lib/public/marketplace'
import { MarketplaceProductModal } from './MarketplaceProductModal'
import { FavoriteButton } from './Favorites'
import { cn } from '@/lib/utils'

type Props = {
  products: MarketplaceProduct[]
  variant?: 'default' | 'offers' | 'featured'
  autoPlay?: boolean
  autoPlayInterval?: number
}

function ProductImage({ product }: { product: MarketplaceProduct }) {
  const [failed, setFailed] = useState(false)
  const imageSrc = failed ? '/placeholder-product.svg' : resolveProductImageUrl(product.image)
  return (
    <Image
      src={imageSrc}
      alt={product.name}
      fill
      unoptimized
      sizes="(max-width: 640px) 78vw, 260px"
      onError={() => setFailed(true)}
      className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
    />
  )
}

export function MarketplaceProductCarousel({
  products,
  variant = 'default',
  autoPlay,
  autoPlayInterval = 3500,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [userToggledPause, setUserToggledPause] = useState(false)

  const isOffers = variant === 'offers'
  const isFeatured = variant === 'featured'
  const normalizedProducts = useMemo(() => products.slice(0, 30), [products])
  const enableAutoPlay = (autoPlay ?? (isFeatured || isOffers || normalizedProducts.length >= 4)) && !userToggledPause

  function scroll(direction: 'left' | 'right') {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector<HTMLElement>('[data-carousel-card]')
    const step = (card?.offsetWidth ?? 256) + 16
    const nextIndex =
      direction === 'right'
        ? Math.min(activeIndex + 1, normalizedProducts.length - 1)
        : Math.max(activeIndex - 1, 0)
    setActiveIndex(nextIndex)
    track.scrollBy({ left: direction === 'right' ? step : -step, behavior: 'smooth' })
  }

  // Efecto de movimiento tipo pasarela / auto-scrolling continuo
  useEffect(() => {
    if (!enableAutoPlay || isPaused || normalizedProducts.length <= 1) return

    const timer = setInterval(() => {
      const track = trackRef.current
      if (!track) return

      const card = track.querySelector<HTMLElement>('[data-carousel-card]')
      const step = (card?.offsetWidth ?? 256) + 16
      const maxScroll = track.scrollWidth - track.clientWidth

      // Si llegó al final, vuelve suavemente al inicio (efecto bucle infinito de pasarela)
      if (track.scrollLeft >= maxScroll - 24) {
        track.scrollTo({ left: 0, behavior: 'smooth' })
        setActiveIndex(0)
      } else {
        track.scrollBy({ left: step, behavior: 'smooth' })
        setActiveIndex((prev) => (prev >= normalizedProducts.length - 1 ? 0 : prev + 1))
      }
    }, autoPlayInterval)

    return () => clearInterval(timer)
  }, [enableAutoPlay, isPaused, normalizedProducts.length, autoPlayInterval])

  // Listener para actualizar el índice activo cuando el usuario hace scroll manual
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const handleScroll = () => {
      const card = track.querySelector<HTMLElement>('[data-carousel-card]')
      const step = (card?.offsetWidth ?? 256) + 16
      if (step > 0) {
        const calculated = Math.round(track.scrollLeft / step)
        setActiveIndex(Math.min(Math.max(calculated, 0), normalizedProducts.length - 1))
      }
    }

    track.addEventListener('scroll', handleScroll, { passive: true })
    return () => track.removeEventListener('scroll', handleScroll)
  }, [normalizedProducts.length])

  if (!normalizedProducts.length) return null

  return (
    <>
      <div
        className="relative group/carousel"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => {
          window.setTimeout(() => setIsPaused(false), 2500)
        }}
      >
        {/* ── Fades laterales indicadoras de scroll ─────────────────────── */}
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r to-transparent transition-opacity',
            isOffers
              ? 'from-rose-50/80 dark:from-slate-950'
              : isFeatured
                ? 'from-amber-50/80 dark:from-slate-950'
                : 'from-white dark:from-slate-950'
          )}
          style={{ opacity: activeIndex > 0 ? 1 : 0 }}
        />
        <div
          className={cn(
            'pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l to-transparent transition-opacity',
            isOffers
              ? 'from-rose-50/80 dark:from-slate-950'
              : isFeatured
                ? 'from-amber-50/80 dark:from-slate-950'
                : 'from-white dark:from-slate-950'
          )}
          style={{ opacity: activeIndex < normalizedProducts.length - 1 ? 1 : 0 }}
        />

        {/* ── Track de la Pasarela ──────────────────────────────────────── */}
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pt-1 scrollbar-hide scroll-smooth"
          aria-label="Pasarela de productos del marketplace"
        >
          {normalizedProducts.map((product, idx) => {
            const hasOffer = Boolean(
              product.has_offer && product.offer_price && product.offer_price < product.sale_price
            )
            const displayPrice = hasOffer ? product.offer_price! : product.sale_price
            const discountPct = hasOffer
              ? Math.round((1 - product.offer_price! / product.sale_price) * 100)
              : 0

            return (
              <div
                key={`${product.organization_slug}-${product.id}`}
                data-carousel-card
                className={cn(
                  'group relative flex w-[78vw] max-w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border text-left transition-all duration-300 hover:-translate-y-1 sm:w-64 bg-card shadow-2xs',
                  isOffers
                    ? 'border-rose-200/70 hover:border-rose-300 hover:shadow-xl hover:shadow-rose-500/10 dark:border-rose-900/40 dark:hover:border-rose-700'
                    : isFeatured
                      ? 'border-amber-200/80 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/15 dark:border-amber-900/40 dark:hover:border-amber-600 ring-1 ring-transparent hover:ring-amber-400/30'
                      : 'border-border/80 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-500/5 dark:hover:border-cyan-800'
                )}
              >
                {/* Imagen (clic abre el detalle) */}
                <div className="absolute right-2 top-2 z-20"><FavoriteButton item={{ productId: product.id, slug: product.organization_slug, name: product.name, store: product.organization_name, image: product.image, price: product.sale_price }} /></div>
                <div
                  onClick={() => setSelected(product)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(product) }}
                  aria-label={`Ver detalle de ${product.name}`}
                  className={cn(
                    'relative aspect-square overflow-hidden cursor-pointer',
                    isOffers
                      ? 'bg-gradient-to-br from-rose-50/80 to-rose-100/40 dark:from-rose-950/20 dark:to-rose-900/10'
                      : isFeatured
                        ? 'bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-950/25 dark:to-slate-900'
                        : 'bg-gradient-to-br from-muted/50 to-muted/20'
                  )}
                >
                  <ProductImage product={product} />

                  {/* Badges superiores */}
                  <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1.5 pointer-events-none">
                    {hasOffer && discountPct > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        <Tag className="h-2.5 w-2.5" />
                        -{discountPct}%
                      </span>
                    )}
                    {(isFeatured || product.featured) && !hasOffer && (
                      <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        <Sparkles className="h-2.5 w-2.5" />
                        Destacado
                      </span>
                    )}
                  </div>

                  {/* Stock / Agotado */}
                  {!product.in_stock && (
                    <div className="absolute inset-0 flex items-end justify-center bg-background/60 pb-3 backdrop-blur-[2px]">
                      <span className="rounded-full bg-slate-900/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                        Agotado
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col p-4 justify-between">
                  <div>
                    <Link
                      href={`/${product.organization_slug}/inicio`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
                    >
                      <Store className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isOffers ? 'text-rose-500' : isFeatured ? 'text-amber-600 dark:text-amber-400' : 'text-cyan-600 dark:text-cyan-400'
                      )} />
                      <span className={cn(
                        'truncate max-w-[170px]',
                        isOffers ? 'text-rose-700 dark:text-rose-400' : isFeatured ? 'text-amber-800 dark:text-amber-300' : 'text-cyan-700 dark:text-cyan-400'
                      )}>
                        {product.organization_name}
                      </span>
                    </Link>

                    {product.category && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {product.category.name}
                      </p>
                    )}

                    <h3
                      onClick={() => setSelected(product)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(product) }}
                      className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary cursor-pointer"
                    >
                      {product.name}
                    </h3>
                  </div>

                  <div className="mt-3.5 space-y-3 border-t border-border/40 pt-2.5">
                    <div className="flex items-baseline gap-2">
                      <p
                        className={cn(
                          'text-base sm:text-lg font-bold tabular-nums leading-none',
                          hasOffer
                            ? 'text-rose-600 dark:text-rose-400'
                            : isFeatured
                              ? 'text-amber-700 dark:text-amber-300 font-extrabold'
                              : 'text-foreground'
                        )}
                      >
                        {formatPrice(displayPrice)}
                      </p>
                      {hasOffer && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.sale_price)}
                        </p>
                      )}
                    </div>

                    {/* Botones de acción: Ver detalle + Ir a tienda */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelected(product)}
                        className="h-8 rounded-xl text-xs font-semibold gap-1 px-2 hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Detalle</span>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl text-xs font-semibold gap-1 px-2 border-border/80 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        <Link href={`/${product.organization_slug}/productos/${product.id}`}>
                          <span>Ir a tienda</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Botones de navegación ──────────────────────────────────────── */}
        {normalizedProducts.length > 1 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scroll('left')}
              disabled={activeIndex === 0}
              className={cn(
                'absolute -left-3.5 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 rounded-full shadow-md disabled:opacity-0 sm:inline-flex bg-background border-border hover:bg-muted',
                isFeatured && 'hover:border-amber-400 hover:text-amber-600',
                isOffers && 'hover:border-rose-400 hover:text-rose-600'
              )}
              aria-label="Productos anteriores"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scroll('right')}
              disabled={activeIndex >= normalizedProducts.length - 1}
              className={cn(
                'absolute -right-3.5 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 rounded-full shadow-md disabled:opacity-0 sm:inline-flex bg-background border-border hover:bg-muted',
                isFeatured && 'hover:border-amber-400 hover:text-amber-600',
                isOffers && 'hover:border-rose-400 hover:text-rose-600'
              )}
              aria-label="Productos siguientes"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* ── Indicador inferior de pasarela con botón de pausa opcional ── */}
        {normalizedProducts.length > 4 && (
          <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className={cn(
                'h-2 w-2 rounded-full transition-colors',
                isPaused || userToggledPause
                  ? 'bg-muted-foreground/40'
                  : 'bg-emerald-500 animate-pulse'
              )} />
              <span>
                {isPaused || userToggledPause
                  ? 'Pasarela pausada'
                  : 'Pasarela en movimiento automático'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setUserToggledPause((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label={userToggledPause ? 'Reanudar pasarela' : 'Pausar pasarela'}
            >
              {userToggledPause ? (
                <>
                  <Play className="h-3 w-3" />
                  <span>Reanudar</span>
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3" />
                  <span>Pausar</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      <MarketplaceProductModal
        product={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
