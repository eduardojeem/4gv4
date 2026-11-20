'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowRight,
  ArrowLeft,
  Truck,
  RotateCcw,
  ShieldCheck,
  Headphones,
  Sparkles,
  Star,
  Lock,
  Play,
  Heart,
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { fetchPublicProducts, newestProductsKey, NEWEST_PRODUCTS_SWR_OPTIONS } from '@/components/public/inicio/newest-products'
import { ProductCard } from '@/components/public/ProductCard'
import type { WebsiteSettings } from '@/types/website-settings'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import './moda-femenina.css'

interface ModaFemeninaHomeProps {
  settings: WebsiteSettings
  branches?: BranchLocationData[]
  capabilities?: StorefrontCapabilities
}

export function ModaFemeninaHome({ settings, branches, capabilities }: ModaFemeninaHomeProps) {
  const pathname = usePathname()
  const company = useStorefrontCompanyInfo(settings.company_info)
  const { categories: liveCategories } = usePublicCategories()
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''
  const hasCatalog = capabilities?.hasCatalog !== false

  // Carga de productos reales de la tienda
  const { data: productsData, isLoading: productsLoading } = useSWR(
    hasCatalog ? newestProductsKey(slug) : null,
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )

  const products = useMemo(() => {
    return productsData ?? []
  }, [productsData])

  // Categorías de moda femenina predeterminadas con soporte a datos en vivo
  const displayCategories = useMemo(() => {
    const fallbackCategories = [
      {
        id: 'dresses',
        name: 'Vestidos',
        englishName: 'Dresses',
        count: 24,
        image: '/images/templates/moda-femenina/cat-dresses.jpg',
        href: `${prefix}/productos?category=Vestidos`,
      },
      {
        id: 'tops',
        name: 'Tops & Blusas',
        englishName: 'Tops',
        count: 18,
        image: '/images/templates/moda-femenina/cat-tops.jpg',
        href: `${prefix}/productos?category=Tops`,
      },
      {
        id: 'outerwear',
        name: 'Blazers & Abrigos',
        englishName: 'Outerwear',
        count: 20,
        image: '/images/templates/moda-femenina/cat-outerwear.jpg',
        href: `${prefix}/productos?category=Outerwear`,
      },
      {
        id: 'bottoms',
        name: 'Pantalones & Jeans',
        englishName: 'Bottoms',
        count: 16,
        image: '/images/templates/moda-femenina/cat-bottoms.jpg',
        href: `${prefix}/productos?category=Bottoms`,
      },
    ]

    if (!liveCategories || liveCategories.length === 0) {
      return fallbackCategories
    }

    // Si la tienda tiene categorías reales, adaptamos sus nombres
    return fallbackCategories.map((fallback, idx) => {
      const match = liveCategories[idx]
      if (!match) return fallback
      return {
        id: match.id,
        name: match.name,
        englishName: match.name,
        count: match.productCount ?? fallback.count,
        image: fallback.image,
        href: `${prefix}/productos?category=${encodeURIComponent(match.name)}`,
      }
    })
  }, [liveCategories, prefix])

  // Beneficios de confianza
  const trustItems = useMemo(() => {
    return [
      {
        icon: Truck,
        title: 'Envío Gratis',
        subtitle: 'En compras superiores a Gs. 200.000',
      },
      {
        icon: RotateCcw,
        title: 'Cambios Fáciles',
        subtitle: 'Garantía de cambio por 30 días',
      },
      {
        icon: ShieldCheck,
        title: 'Pago Seguro',
        subtitle: '100% protegido con todas las tarjetas',
      },
      {
        icon: Headphones,
        title: 'Atención 24/7',
        subtitle: 'Asesoría de estilo por WhatsApp',
      },
    ]
  }, [])

  // Imagen del hero
  const heroImage = '/images/templates/moda-femenina/hero-model.jpg'
  const heroBadge = settings.hero_content?.badge || 'NUEVA COLECCIÓN 2026'
  const heroTitle = settings.hero_content?.title || 'Elegancia'
  const heroSubtitle =
    settings.hero_content?.subtitle ||
    'Diseños minimalistas. Máximo impacto. Redefiní tu guardarropa con prendas que transmiten sofisticación.'

  return (
    <div className="moda-femenina-root min-h-screen flex flex-col font-sans selection:bg-[#E06B3A]/20 selection:text-[#E06B3A]">
      <main className="flex-1">
        {/* ── 1. PORTADA HERO (Timeless Elegance) ── */}
        <section className="relative overflow-hidden pt-8 pb-16 sm:pb-24 lg:pt-12 lg:pb-32 bg-[#FAF7F2] dark:bg-[#181513] transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Columna Izquierda: Tipografía y Botones */}
              <div className="lg:col-span-7 space-y-6 sm:space-y-8 z-10 text-center lg:text-left">
                {/* Overline / Badge */}
                <div className="inline-flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-[#E06B3A]">
                    {heroBadge}
                  </span>
                </div>

                {/* Título Principal Editorial */}
                <h1 className="font-editorial text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F7F3EE] leading-[1.05]">
                  {heroTitle}
                  <span className="block font-signature text-[#E06B3A] text-6xl sm:text-8xl lg:text-9xl font-normal leading-[1.1] pt-1">
                    Atemporal
                  </span>
                </h1>

                {/* Descripción */}
                <p className="max-w-xl mx-auto lg:mx-0 text-base sm:text-lg text-[#736B63] dark:text-[#A89F95] leading-relaxed">
                  {heroSubtitle}
                </p>

                {/* Botones de Acción */}
                <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                  <Link
                    href={`${prefix}/productos`}
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#1A1A1A] hover:bg-[#E06B3A] text-white text-sm font-semibold tracking-wide transition-all shadow-md group"
                  >
                    <span>Explorar Colección</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>

                  <a
                    href="#colecciones"
                    className="inline-flex items-center gap-2.5 px-7 py-4 rounded-full bg-white/90 dark:bg-[#221E1B] hover:bg-stone-50 dark:hover:bg-[#2A2421] text-[#1A1A1A] dark:text-[#F7F3EE] text-sm font-semibold border border-[#736B63]/20 transition-all shadow-sm"
                  >
                    <Play className="w-4 h-4 fill-current text-[#E06B3A]" />
                    <span>Ver Lookbook</span>
                  </a>
                </div>

                {/* Insignias de confianza en escritorio */}
                <div className="pt-6 hidden sm:flex items-center justify-center lg:justify-start gap-6 text-xs text-[#736B63] dark:text-[#A89F95]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#E06B3A]" />
                    <span>Diseños exclusivos</span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#736B63]/30" />
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>4.9 / 5 estrellas de clientas</span>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Composición Sol Terracota + Modelo */}
              <div className="lg:col-span-5 relative flex items-center justify-center">
                {/* Gran Círculo Sol Terracota de fondo */}
                <div className="relative w-72 h-72 sm:w-96 sm:h-96 lg:w-[440px] lg:h-[440px] flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full moda-sun-circle" />

                  {/* Foto de la modelo */}
                  <div className="relative z-10 w-full h-full flex items-end justify-center overflow-hidden rounded-b-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroImage}
                      alt="Modelo Moda Femenina"
                      className="w-full h-full object-cover object-top drop-shadow-2xl scale-105 transition-transform duration-700 hover:scale-110"
                    />
                  </div>

                  {/* Floating Badge 1: 10K+ Happy Customers */}
                  <div className="absolute -left-4 sm:-left-8 top-16 z-20 moda-floating-pill px-4 py-2.5 rounded-2xl flex items-center gap-3 animate-fade-in shadow-lg">
                    <div className="w-8 h-8 rounded-full bg-[#E06B3A]/15 flex items-center justify-center text-[#E06B3A]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">10K+</p>
                      <p className="text-[10px] text-[#736B63] dark:text-[#A89F95]">Clientas Felices</p>
                    </div>
                  </div>

                  {/* Floating Badge 2: 4.9 Rating */}
                  <div className="absolute -left-2 sm:-left-6 bottom-24 z-20 moda-floating-pill px-4 py-2.5 rounded-2xl flex items-center gap-3 animate-fade-in shadow-lg">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">4.9 / 5.0</p>
                      <p className="text-[10px] text-[#736B63] dark:text-[#A89F95]">Valoración promedio</p>
                    </div>
                  </div>

                  {/* Floating Badge 3: Premium Quality */}
                  <div className="absolute -right-2 sm:-right-6 top-8 z-20 moda-floating-pill px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-lg">
                    <ShieldCheck className="w-5 h-5 text-[#E06B3A]" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">Premium</p>
                      <p className="text-[10px] text-[#736B63] dark:text-[#A89F95]">Calidad Garantizada</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. BARRA FLOTANTE DE BENEFICIOS (Trust Bar) ── */}
        <section className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-12">
          <div className="moda-floating-pill rounded-3xl p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {trustItems.map((item, index) => {
              const Icon = item.icon
              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#E06B3A]/10 dark:bg-[#E06B3A]/20 flex items-center justify-center text-[#E06B3A] shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">
                      {item.title}
                    </h4>
                    <p className="text-xs text-[#736B63] dark:text-[#A89F95] mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 3. COMPRAR POR CATEGORÍA (Shop by Category) ── */}
        <section id="colecciones" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Encabezado de Sección */}
          <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4 mb-12">
            <h2 className="font-editorial text-3xl sm:text-5xl font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">
              Comprar por{' '}
              <span className="font-signature text-[#E06B3A] font-normal italic">
                Categoría
              </span>
            </h2>

            <Link
              href={`${prefix}/productos`}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#E06B3A] hover:text-[#C95627] transition-colors group"
            >
              <span>Ver todas las categorías</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Grilla de 4 Categorías de Moda Femenina */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {displayCategories.map((cat) => (
              <Link
                key={cat.id}
                href={cat.href}
                className="group relative block rounded-3xl overflow-hidden moda-category-card bg-[#F5EFEB] dark:bg-[#221E1B] border border-[#736B63]/15"
              >
                {/* Imagen vertical de la modelo */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-200 dark:bg-stone-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Degradado suave inferior para legibilidad */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                </div>

                {/* Información superpuesta abajo */}
                <div className="absolute bottom-0 inset-x-0 p-5 flex items-end justify-between z-10">
                  <div className="text-white">
                    <h3 className="font-editorial text-xl font-bold tracking-tight text-white group-hover:text-[#F07C48] transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-stone-300 font-medium mt-0.5">
                      {cat.count} {cat.count === 1 ? 'Prenda' : 'Prendas'}
                    </p>
                  </div>

                  {/* Botón circular de flecha */}
                  <div className="w-10 h-10 rounded-full bg-white/95 dark:bg-[#1A1A1A] text-[#1A1A1A] dark:text-white flex items-center justify-center shadow-md group-hover:bg-[#E06B3A] group-hover:text-white transition-all transform group-hover:rotate-45">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 4. BANNER SUMMER SALE (Liquidación de Temporada) ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
          <div className="rounded-3xl bg-[#F5EFEB] dark:bg-[#221E1B] border border-[#736B63]/15 overflow-hidden p-8 sm:p-12 lg:p-16 relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Contenido Texto */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left z-10">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[#E06B3A]">
                  Liquidación de Temporada
                </span>
                <h2 className="font-editorial text-4xl sm:text-6xl font-bold text-[#1A1A1A] dark:text-[#F7F3EE] leading-[1.1]">
                  Hasta 50% Off
                </h2>
                <p className="max-w-md mx-auto lg:mx-0 text-sm sm:text-base text-[#736B63] dark:text-[#A89F95] leading-relaxed">
                  Renová tu estilo esta temporada con nuestra colección exclusiva de prendas seleccionadas. ¡Por tiempo limitado!
                </p>
                <div className="pt-2">
                  <Link
                    href={`${prefix}/ofertas`}
                    className="inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-[#1A1A1A] hover:bg-[#E06B3A] text-white text-sm font-semibold tracking-wide transition-all shadow-md group"
                  >
                    <span>Ver Ofertas</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Imagen Summer Sale */}
              <div className="lg:col-span-5 relative flex items-center justify-center">
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-white dark:border-[#2A2421] shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/templates/moda-femenina/promo-sale.jpg"
                    alt="Summer Sale"
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>

                {/* Floating Badge "Limited Offer." */}
                <div className="absolute bottom-4 right-4 sm:right-10 bg-white dark:bg-[#1A1A1A] border border-[#736B63]/20 shadow-xl rounded-full w-20 h-20 flex flex-col items-center justify-center text-center p-2">
                  <span className="font-editorial text-xs font-bold text-[#1A1A1A] dark:text-[#F7F3EE] leading-tight">
                    Oferta
                  </span>
                  <span className="font-signature text-xs text-[#E06B3A] italic">
                    Limitada
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. COLECCIÓN DESTACADA (Catálogo de Productos) ── */}
        {hasCatalog && (
          <section className="py-12 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#736B63]/10">
            <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4 mb-10">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#E06B3A]">
                  Selección de la Casa
                </span>
                <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-[#1A1A1A] dark:text-[#F7F3EE] mt-1">
                  Colección Destacada
                </h2>
              </div>

              <Link
                href={`${prefix}/productos`}
                className="inline-flex items-center gap-2 text-sm font-bold text-[#1A1A1A] dark:text-[#F7F3EE] hover:text-[#E06B3A] transition-colors group"
              >
                <span>Explorar todo el catálogo</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-[3/4] rounded-3xl bg-[#736B63]/10 animate-pulse" />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
                {products.slice(0, 8).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-[#F5EFEB] dark:bg-[#221E1B] rounded-3xl border border-[#736B63]/15">
                <ShoppingBag className="w-12 h-12 text-[#E06B3A] mx-auto mb-4 opacity-80" />
                <h3 className="font-editorial text-xl font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">
                  Próximamente nuevas prendas
                </h3>
                <p className="text-sm text-[#736B63] dark:text-[#A89F95] mt-1 max-w-sm mx-auto">
                  Estamos preparando el catálogo de temporada. Ingresá en unos momentos para ver las novedades.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
