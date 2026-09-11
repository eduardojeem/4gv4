'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowRight,
  MessageCircle,
  Sparkles,
  Tag,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  ShoppingBag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { formatPrice, cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { getWhatsAppLink } from '@/lib/whatsapp'
import type { PublicProduct } from '@/types/public'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from './newest-products'

interface FashionCampaignBannerProps {
  phoneClean?: string
}

export function FashionCampaignBanner({ phoneClean: propPhoneClean }: FashionCampaignBannerProps = {}) {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const { settings } = useWebsiteSettings()

  const { data: products } = useSWR(
    newestProductsKey(tenantSlug),
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )

  // Filtrar y ordenar productos para el carrusel editorial:
  // 1. Con stock + en oferta  (prioridad máxima)
  // 2. Con stock + destacados
  // 3. Con stock + recién llegados
  // 4. Agotados (al final, para que nunca ocupen el primer lugar)
  const candidateProducts = useMemo(() => {
    if (!products || products.length === 0) return []

    const inStock = products.filter((p) => p.in_stock !== false)
    const outOfStock = products.filter((p) => p.in_stock === false)

    const sortGroup = (group: typeof products) => {
      const withOffer = group.filter((p) => p.has_offer && (p.offer_price ?? 0) > 0)
      const featured = group.filter((p) => p.featured && !p.has_offer)
      const newest = group.filter((p) => !p.has_offer && !p.featured)
      return [...withOffer, ...featured, ...newest]
    }

    const list = [...sortGroup(inStock), ...sortGroup(outOfStock)]
    return list.slice(0, 8)
  }, [products])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  // isMounted evita hydration mismatch: el servidor y el primer render del cliente
  // ven los mismos datos vacíos. SWR puede tener cache en el cliente pero no en el servidor.
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  // Mantener índice en rango válido si cambia candidateProducts
  useEffect(() => {
    if (candidateProducts.length > 0 && currentIndex >= candidateProducts.length) {
      setCurrentIndex(0)
    }
  }, [candidateProducts.length, currentIndex])

  const changeSlide = useCallback((newIdx: number) => {
    setIsAnimating(true)
    setCurrentIndex(newIdx)
    setTimeout(() => {
      setIsAnimating(false)
    }, 400)
  }, [])

  const nextSlide = useCallback(() => {
    if (candidateProducts.length <= 1) return
    const nextIdx = (currentIndex + 1) % candidateProducts.length
    changeSlide(nextIdx)
  }, [candidateProducts.length, currentIndex, changeSlide])

  const prevSlide = useCallback(() => {
    if (candidateProducts.length <= 1) return
    const prevIdx = (currentIndex - 1 + candidateProducts.length) % candidateProducts.length
    changeSlide(prevIdx)
  }, [candidateProducts.length, currentIndex, changeSlide])

  // Rotación automática cada 5 segundos
  useEffect(() => {
    if (isPaused || candidateProducts.length <= 1) return
    const timer = setInterval(() => {
      nextSlide()
    }, 5000)
    return () => clearInterval(timer)
  }, [isPaused, candidateProducts.length, nextSlide])

  // Hasta el mount el producto es siempre undefined: servidor y cliente inicial
  // renderizan el mismo fallback, evitando el hydration mismatch por SWR cache.
  const currentProduct: PublicProduct | undefined = isMounted ? candidateProducts[currentIndex] : undefined

  // Teléfono de contacto
  const settingsPhone = settings?.company_info?.whatsapp || settings?.company_info?.phone || ''
  const phoneClean = propPhoneClean || settingsPhone.replace(/\D/g, '')

  // Fallback si todavía no cargaron productos
  const productImage = currentProduct?.image || currentProduct?.images?.[0] || null
  const resolvedImageUrl = productImage
    ? resolveProductImageUrl(productImage)
    : 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85'

  const displayPrice = currentProduct?.has_offer && currentProduct?.offer_price
    ? currentProduct.offer_price
    : currentProduct?.sale_price ?? 0

  const originalPrice = currentProduct?.has_offer && currentProduct?.offer_price
    ? currentProduct.sale_price
    : null

  // Etiqueta distintiva dinámica
  const productBadge = useMemo(() => {
    if (!currentProduct) {
      return { label: 'COLECCIÓN ESENCIALES 2026', icon: Sparkles, color: 'text-amber-300' }
    }
    if (currentProduct.has_offer && currentProduct.offer_price) {
      return { label: 'OFERTA ESPECIAL', icon: Tag, color: 'text-rose-400' }
    }
    if (currentProduct.featured) {
      return { label: 'PRODUCTO DESTACADO', icon: Sparkles, color: 'text-amber-300' }
    }
    return { label: 'RECIÉN LLEGADO', icon: TrendingUp, color: 'text-sky-400' }
  }, [currentProduct])

  const whatsappMessage = currentProduct
    ? `Hola! Quiero consultar por ${currentProduct.name} (${formatPrice(displayPrice)}).`
    : 'Hola! Quiero consultar por la colección de básicos.'

  const whatsappHref = phoneClean
    ? getWhatsAppLink({ phone: phoneClean, message: whatsappMessage })
    : null

  const productHref = currentProduct
    ? `${tenantPrefix}/productos/${currentProduct.id}`
    : `${tenantPrefix}/productos`

  return (
    <section
      className="py-8 sm:py-12 bg-background"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-900 text-white shadow-2xl">
          {/* Fondo difuminado ambiental del producto actual */}
          <div
            key={`bg-${currentProduct?.id || 'static'}`}
            className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-2xl scale-125 transition-all duration-1000"
            style={{ backgroundImage: `url('${resolvedImageUrl}')` }}
          />

          {/* Gradientes de contraste para legibilidad superior */}
          <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-black/95 via-black/85 to-black/60 z-0" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent pointer-events-none" />

          {/* Layout Principal: 2 columnas en pantallas medianas/grandes */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 p-6 sm:p-10 lg:p-14">
            {/* Columna Izquierda: Información del Producto / Campaña */}
            <div className="lg:col-span-7 flex flex-col justify-center max-w-2xl">
              {/* Badge de sección + categoría / estado */}
              <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md text-white shadow-xs">
                  <productBadge.icon className={cn('h-3.5 w-3.5', productBadge.color)} />
                  <span className="tracking-wide">{productBadge.label}</span>
                </div>

                {currentProduct?.category?.name && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300 border border-white/10 backdrop-blur-xs">
                    {currentProduct.category.name}
                  </span>
                )}

                {currentProduct?.brand && (
                  <span className="rounded-full bg-primary/20 text-primary-foreground px-3 py-1 text-xs font-bold border border-primary/30">
                    {currentProduct.brand}
                  </span>
                )}
              </div>

              {/* Título y Descripción con animación suave al cambiar de producto */}
              <div
                key={`info-${currentProduct?.id || 'default'}`}
                className={cn(
                  'transition-all duration-500 ease-out',
                  isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                )}
              >
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  {currentProduct?.name || 'Prendas básicas con calce y confort perfecto'}
                </h2>

                <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-300 leading-relaxed line-clamp-2 sm:line-clamp-3">
                  {currentProduct?.description ||
                    'Confeccionadas con materiales premium de alta durabilidad. Diseñadas para acompañarte todos los días con estilo y versatilidad.'}
                </p>

                {/* Precios y beneficios directos del producto */}
                <div className="mt-6 flex flex-wrap items-baseline gap-3">
                  {displayPrice > 0 && (
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {formatPrice(displayPrice)}
                    </span>
                  )}
                  {originalPrice && (
                    <span className="text-lg sm:text-xl text-slate-400 line-through font-medium">
                      {formatPrice(originalPrice)}
                    </span>
                  )}
                  {currentProduct?.has_offer && originalPrice && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold">
                      Ahorrás {formatPrice(originalPrice - displayPrice)}
                    </span>
                  )}
                </div>

                {/* Chips de stock y variantes */}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  {currentProduct?.in_stock === false ? (
                    <span className="inline-flex items-center gap-1.5 bg-red-900/50 border border-red-500/40 px-3 py-1 rounded-full backdrop-blur-xs text-red-300 font-bold uppercase tracking-wider text-[11px]">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      AGOTADO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-xs">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      Stock disponible
                    </span>
                  )}

                  {currentProduct?.has_variants && (
                    <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-xs">
                      <ShoppingBag className="h-3 w-3 text-amber-300" />
                      Varios talles y colores
                    </span>
                  )}

                  {currentProduct?.in_stock !== false && (
                    <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-xs">
                      <Clock className="h-3 w-3 text-slate-400" />
                      Entrega rápida
                    </span>
                  )}
                </div>
              </div>

              {/* Acciones principales */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full font-bold px-7 bg-white text-slate-950 hover:bg-slate-100 shadow-lg hover:shadow-xl transition-all"
                >
                  <Link href={productHref}>
                    <span>Ver Producto</span>
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>

                {whatsappHref && (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-full font-semibold px-6 border-white/30 text-white hover:bg-white/15 hover:border-white/50 backdrop-blur-xs transition-all"
                  >
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-2 text-emerald-400" />
                      <span>Consultar WhatsApp</span>
                    </a>
                  </Button>
                )}

                <Button
                  asChild
                  variant="ghost"
                  className="rounded-full text-slate-300 hover:text-white hover:bg-white/10 text-xs sm:text-sm font-medium"
                >
                  <Link href={`${tenantPrefix}/productos`}>
                    Explorar todo el catálogo
                  </Link>
                </Button>
              </div>
            </div>

            {/* Columna Derecha: Tarjeta / Showcase Fotográfico del Producto */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-full max-w-sm sm:max-w-md aspect-[4/5] rounded-2xl overflow-hidden border border-white/15 bg-white/5 shadow-2xl group">
                <Link href={productHref} className="block relative w-full h-full">
                  <Image
                    key={`img-${currentProduct?.id || 'static'}`}
                    src={resolvedImageUrl}
                    alt={currentProduct?.name || 'Producto destacado'}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                    className={cn(
                      'object-cover transition-all duration-700 group-hover:scale-105',
                      isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                    )}
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                  {/* Badge AGOTADO sobre imagen */}
                  {currentProduct?.in_stock === false && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px] z-10">
                      <span className="rounded-full bg-white/10 border border-white/30 px-5 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg backdrop-blur-md">
                        AGOTADO
                      </span>
                    </div>
                  )}

                  {/* Badge flotante de precio sobre la imagen */}
                  {displayPrice > 0 && (
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/20">
                      <div>
                        <p className="text-xs text-slate-300 line-clamp-1 font-medium">
                          {currentProduct?.name}
                        </p>
                        <p className="text-base font-extrabold text-white">
                          {formatPrice(displayPrice)}
                        </p>
                      </div>
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-white text-black group-hover:scale-110 transition-transform">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  )}
                </Link>

                {/* Controles de Navegación manual sobre la tarjeta */}
                {isMounted && candidateProducts.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        prevSlide()
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/20 flex items-center justify-center backdrop-blur-md transition-transform active:scale-95 shadow-md"
                      aria-label="Producto anterior"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        nextSlide()
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/20 flex items-center justify-center backdrop-blur-md transition-transform active:scale-95 shadow-md"
                      aria-label="Siguiente producto"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Indicadores de diapositivas tipo barra inferior */}
              {isMounted && candidateProducts.length > 1 && (
                <div className="mt-4 flex items-center gap-2">
                  {candidateProducts.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => changeSlide(idx)}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        idx === currentIndex
                          ? 'w-8 bg-white'
                          : 'w-2 bg-white/30 hover:bg-white/50'
                      )}
                      aria-label={`Ir al producto ${idx + 1}: ${p.name}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
