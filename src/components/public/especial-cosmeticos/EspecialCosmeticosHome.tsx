'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowRight,
  Clock,
  Droplets,
  Heart,
  Instagram,
  Layers,
  MapPin,
  MessageCircle,
  Navigation,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Truck,
  Zap,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { ProductCard } from '@/components/public/ProductCard'
import { FloatingWhatsAppButton } from '@/components/public/FloatingWhatsAppButton'
import { fetchPublicProducts, newestProductsKey, NEWEST_PRODUCTS_SWR_OPTIONS } from '@/components/public/inicio/newest-products'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { getCompanyMapsEmbedSrc, getDirectionsHref } from '@/lib/website/company-maps-url'
import { cn } from '@/lib/utils'
import type { PublicProduct } from '@/types/public'
import type { WebsiteSettings } from '@/types/website-settings'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import './especial-cosmeticos.css'

interface EspecialCosmeticosHomeProps {
  settings: WebsiteSettings
  branches?: BranchLocationData[]
  capabilities?: StorefrontCapabilities
}

const SUPABASE_CDN = 'https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images'
const IMG_PEDESTAL = `${SUPABASE_CDN}/promotions/hero-cosmetica-pedestal.webp`
const IMG_MODELO = `${SUPABASE_CDN}/promotions/hero-cosmetica-modelo.webp`
const IMG_SERUM = `${SUPABASE_CDN}/promotions/hero-cosmetica-serum.webp`
const IMG_SPA = `${SUPABASE_CDN}/promotions/hero-cosmetica-spa.webp`
const IMG_BOUTIQUE = `${SUPABASE_CDN}/promotions/hero-cosmetica-boutique.webp`

// Fallback catalog curated for cosmetics boutique
const FALLBACK_COSMETICS_PRODUCTS: PublicProduct[] = [
  {
    id: 'cosm-1',
    name: 'Sérum Hidratante Ácido Hialurónico Puro 2% + B5',
    sku: 'SER-HA-01',
    description: 'Hidratación multicapa profunda con 3 pesos moleculares para devolver la elasticidad y luminosidad.',
    sale_price: 145000,
    wholesale_price: null,
    stock_quantity: 25,
    in_stock: true,
    is_active: true,
    featured: true,
    brand: 'Glowora Lab',
    category: {
      id: 'serums',
      name: 'Sérums Activos',
    },
    image: IMG_PEDESTAL,
    images: [IMG_PEDESTAL],
    unit_measure: 'unidad',
    barcode: null,
  },
  {
    id: 'cosm-2',
    name: 'Crema Hidratante Facial Péptidos & Niacinamida 50ml',
    sku: 'CRM-PEP-02',
    description: 'Barrera cutánea fortalecida, textura suave y acabado aterciopelado no graso para todo tipo de piel.',
    sale_price: 185000,
    wholesale_price: null,
    stock_quantity: 18,
    in_stock: true,
    is_active: true,
    featured: true,
    brand: 'Glowora Lab',
    category: {
      id: 'hidratantes',
      name: 'Hidratantes',
    },
    image: IMG_SERUM,
    images: [IMG_SERUM],
    unit_measure: 'unidad',
    barcode: null,
  },
  {
    id: 'cosm-3',
    name: 'Protector Solar Invisible Fluido FPS 50+ Toque Seco',
    sku: 'SOL-FPS-03',
    description: 'Protección UVA/UVB de amplio espectro, resistente al agua y sudor, sin residuos blancos.',
    sale_price: 120000,
    wholesale_price: null,
    stock_quantity: 30,
    in_stock: true,
    is_active: true,
    featured: true,
    brand: 'Glowora Shield',
    category: {
      id: 'solar',
      name: 'Protección Solar',
    },
    image: IMG_MODELO,
    images: [IMG_MODELO],
    unit_measure: 'unidad',
    barcode: null,
  },
  {
    id: 'cosm-4',
    name: 'Espuma Limpiadora Suave con Extracto de Camelia 150ml',
    sku: 'LIM-CAM-04',
    description: 'Limpia poros suavemente sin alterar el manto lipídico natural. Fórmula calmante botánica.',
    sale_price: 95000,
    wholesale_price: null,
    stock_quantity: 22,
    in_stock: true,
    is_active: true,
    featured: false,
    brand: 'Glowora Pure',
    category: {
      id: 'limpieza',
      name: 'Limpieza Facial',
    },
    image: IMG_SPA,
    images: [IMG_SPA],
    unit_measure: 'unidad',
    barcode: null,
  },
  {
    id: 'cosm-5',
    name: 'Aceite Reparador Facial Rosa Mosqueta & Escualano',
    sku: 'OIL-ROSE-05',
    description: 'Nutrición botánica intensiva para la noche, regenera manchas y líneas finas de expresión.',
    sale_price: 160000,
    wholesale_price: null,
    stock_quantity: 14,
    in_stock: true,
    is_active: true,
    featured: true,
    brand: 'Glowora Botanicals',
    category: {
      id: 'serums',
      name: 'Sérums Activos',
    },
    image: IMG_BOUTIQUE,
    images: [IMG_BOUTIQUE],
    unit_measure: 'unidad',
    barcode: null,
  },
  {
    id: 'cosm-6',
    name: 'Mascarilla Hidroplástica Calmante de Centella Asiática',
    sku: 'MSK-CENT-06',
    description: 'Tratamiento exprés de hidratación y calma post-solar o para pieles sensibles y estresadas.',
    sale_price: 75000,
    wholesale_price: null,
    stock_quantity: 40,
    in_stock: true,
    is_active: true,
    featured: false,
    brand: 'Glowora Spa',
    category: {
      id: 'mascarillas',
      name: 'Mascarillas & Spa',
    },
    image: IMG_SPA,
    images: [IMG_SPA],
    unit_measure: 'unidad',
    barcode: null,
  },
]

// Fallback curated offers
const COSMETICS_DEALS = [
  {
    id: 'deal-1',
    name: 'Set Rutina Glow Completa (Limpiador + Sérum + Hidratante)',
    tag: 'COMBO ESTRELLA',
    discount: '-25% OFF',
    originalPrice: 425000,
    salePrice: 318000,
    image: IMG_SPA,
    description: 'Los 3 pasos fundamentales para lograr piel radiante y equilibrada todos los días.',
  },
  {
    id: 'deal-2',
    name: 'Dúo Solar Anti-Manchas (FPS 50+ & Sérum Vitamina C 15%)',
    tag: 'MÁS VENDIDO',
    discount: '-30% OFF',
    originalPrice: 320000,
    salePrice: 224000,
    image: IMG_PEDESTAL,
    description: 'Máxima protección antioxidante contra el fotoenvejecimiento y tono apagado.',
  },
  {
    id: 'deal-3',
    name: 'Kit Spa Renovación Nocturna (Aceite Botánico + Gua Sha de Cuarzo)',
    tag: 'EDICIÓN ESPECIAL',
    discount: '-20% OFF',
    originalPrice: 250000,
    salePrice: 200000,
    image: IMG_SERUM,
    description: 'Masaje linfático facial y nutrición nocturna profunda para despertar descansada.',
  },
]

export function EspecialCosmeticosHome({ settings, branches = [] }: EspecialCosmeticosHomeProps) {
  const pathname = usePathname()
  const company = useStorefrontCompanyInfo(settings.company_info)
  const { categories: liveCategories } = usePublicCategories()

  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''

  // Swr fetch for real organization products
  const { data: realProducts, isLoading } = useSWR(
    newestProductsKey(company.slug),
    () => fetchPublicProducts(company.slug),
    NEWEST_PRODUCTS_SWR_OPTIONS
  )

  const productsToDisplay = useMemo(() => {
    if (realProducts && realProducts.length > 0) {
      return realProducts
    }
    return FALLBACK_COSMETICS_PRODUCTS
  }, [realProducts])

  // Company info with fallbacks
  const storeName = company?.name?.trim() || 'Glowora'
  const slogan = company?.slogan?.trim() || 'Revelá Tu Brillo Natural'
  const address = company?.address?.trim() || 'Avda. Santa Teresa c/ Herminio Maldonado, Asunción'
  const phone = company?.phone?.trim() || '+595 981 123 456'
  const rawWhatsapp = (company?.whatsapp || company?.phone || '').trim()
  const whatsappClean = rawWhatsapp.replace(/\D/g, '') || '595981123456'
  const mapsEmbed = getCompanyMapsEmbedSrc(company?.mapsUrl, address)
  const directionsHref = getDirectionsHref(company?.mapsUrl, address)

  // Categories config
  const defaultCategories = [
    { name: 'Limpieza Facial', count: 12, icon: Droplets, href: `${prefix}/productos?categoria=limpieza` },
    { name: 'Hidratantes', count: 18, icon: Sparkles, href: `${prefix}/productos?categoria=hidratantes` },
    { name: 'Sérums Activos', count: 24, icon: Zap, href: `${prefix}/productos?categoria=serums` },
    { name: 'Protección Solar', count: 9, icon: Sun, href: `${prefix}/productos?categoria=solar` },
    { name: 'Mascarillas & Spa', count: 15, icon: Layers, href: `${prefix}/productos?categoria=mascarillas` },
  ]

  const categoriesToShow = useMemo(() => {
    if (liveCategories && liveCategories.length > 0) {
      return liveCategories.slice(0, 5).map((cat, idx) => ({
        name: cat.name,
        count: cat.productCount || 8 + idx * 3,
        icon: [Droplets, Sparkles, Zap, Sun, Layers][idx % 5],
        href: `${prefix}/productos?categoria=${encodeURIComponent(cat.name)}`,
      }))
    }
    return defaultCategories
  }, [liveCategories, prefix])

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFDFB] text-stone-800 dark:bg-zinc-950 dark:text-stone-100">
      <h1 className="sr-only">{storeName} - Cosmética & Skincare Premium</h1>

      {/* ── 1. HERO SECTION BOUTIQUE GLOWORA ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#FFF5F6] via-[#FFFDFB] to-[#FFFDFB] dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950 py-12 sm:py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Texto y llamadas a la acción */}
            <div className="space-y-6 text-center lg:text-left">
              {/* Badge promocional superior */}
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-100/90 px-3.5 py-1 text-xs font-semibold tracking-wide text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800 shadow-2xs">
                <Sparkles className="h-3.5 w-3.5 text-rose-500 animate-spin-slow" />
                <span>20% OFF Clientes Nuevos</span>
                <span className="h-1 w-1 rounded-full bg-rose-400" />
                <span className="font-mono text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-300">
                  CUPÓN: GLOW20
                </span>
              </div>

              {/* Título de portada */}
              <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-[1.12]">
                Revelá Tu Brillo <br />
                <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 bg-clip-text text-transparent italic">
                  Natural & Saludable
                </span>
              </h2>

              <p className="max-w-xl text-base sm:text-lg leading-relaxed text-stone-600 dark:text-stone-300 mx-auto lg:mx-0">
                Fórmulas botánicas dermatológicamente comprobadas para hidratar, proteger y devolver la luminosidad a tu piel en solo 14 días.
              </p>

              {/* Botones de acción */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  href={`${prefix}/inicio#productos`}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-rose-500/25 hover:bg-rose-600 hover:shadow-lg hover:shadow-rose-500/35 transition-all transform hover:-translate-y-0.5"
                >
                  <span>Comprar Ahora</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`${prefix}/inicio#rutina`}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-6 py-3.5 text-sm font-semibold text-stone-700 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-stone-200 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
                >
                  <span>▷ Ver Rutina Paso a Paso</span>
                </Link>
              </div>

              {/* Sellos de confianza botánicos */}
              <div className="pt-6 border-t border-rose-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-stone-600 dark:text-stone-400">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    ✓
                  </span>
                  <span>100% Vegano</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    ♥
                  </span>
                  <span>Cruelty Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    ★
                  </span>
                  <span>Testado Dermatológicamente</span>
                </div>
              </div>
            </div>

            {/* Imagen editorial de modelo con piel luminosa */}
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-rose-200/80 shadow-2xl shadow-rose-950/10">
                <AppImage
                  src={IMG_MODELO}
                  fallbackSrc="https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images/promotions/hero-cosmetica-modelo.webp"
                  alt="Modelo con piel luminosa y dewy aplicando sérum facial"
                  fill
                  priority
                  className="object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 via-transparent to-transparent" />
                
                {/* Floating badge sobre la foto */}
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-white/95 p-4 backdrop-blur-md dark:bg-zinc-900/95 border border-rose-150/70 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
                        Piel de Porcelana Radiante
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Resultados visibles en 14 días de uso continuo
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500 font-bold text-xs bg-amber-50 dark:bg-amber-950/50 px-2 py-1 rounded-full border border-amber-200/50">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>4.9 / 5.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. TRUST BAR LIMPIA (4 ELEMENTOS, SIN GARANTÍA DE ORIGINALIDAD) ── */}
      <section className="border-y border-rose-100 bg-[#FFFDFB] py-8 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Beneficio 1 */}
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#FFF9F9] dark:bg-zinc-850/50 border border-rose-100/60 dark:border-zinc-800">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                <Truck className="h-6 w-6" />
              </span>
              <div>
                <h4 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
                  Envíos a Todo el País
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-tight mt-0.5">
                  Asunción en 24h y envíos a todo el interior por encomienda.
                </p>
              </div>
            </div>

            {/* Beneficio 2 */}
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#FFF9F9] dark:bg-zinc-850/50 border border-rose-100/60 dark:border-zinc-800">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <h4 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
                  Pagos 100% Seguros
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-tight mt-0.5">
                  QR bancario, transferencias, tarjetas de crédito y efectivo.
                </p>
              </div>
            </div>

            {/* Beneficio 3 */}
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#FFF9F9] dark:bg-zinc-850/50 border border-rose-100/60 dark:border-zinc-800">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
                <RefreshCw className="h-6 w-6" />
              </span>
              <div>
                <h4 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
                  Cambios y Devoluciones
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-tight mt-0.5">
                  Hasta 7 días para cambios directos con tu comprobante.
                </p>
              </div>
            </div>

            {/* Beneficio 4 */}
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#FFF9F9] dark:bg-zinc-850/50 border border-rose-100/60 dark:border-zinc-800">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300">
                <MessageCircle className="h-6 w-6" />
              </span>
              <div>
                <h4 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">
                  Asesoría Personalizada
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-tight mt-0.5">
                  Nuestras cosmetólogas te guían por WhatsApp para armar tu rutina.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. CATEGORÍAS EN TARJETAS SUAVES ── */}
      <section id="categorias" className="scroll-mt-20 py-16 sm:py-20 bg-[#FFFDFB] dark:bg-zinc-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-block rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
              Líneas de Cuidado
            </span>
            <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mt-2">
              Explorá por Necesidad
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
              Seleccioná la fase de tu rutina diaria para encontrar las fórmulas diseñadas a tu medida.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {categoriesToShow.map((cat) => {
              const IconComp = cat.icon
              return (
                <Link
                  key={cat.name}
                  href={cat.href}
                  className="group flex flex-col items-center justify-center p-6 rounded-3xl bg-[#FFF9F9] dark:bg-zinc-900 border border-rose-150/70 dark:border-zinc-800 text-center transition-all duration-300 hover:-translate-y-1 hover:border-rose-300 hover:shadow-lg hover:shadow-rose-500/10"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-zinc-800 text-rose-500 shadow-sm border border-rose-100 dark:border-zinc-700 group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300 mb-3">
                    <IconComp className="h-7 w-7" />
                  </div>
                  <h4 className="font-serif text-sm font-bold text-stone-800 dark:text-stone-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                    {cat.name}
                  </h4>
                  <span className="text-[11px] font-medium text-stone-400 mt-1">
                    {cat.count} productos
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 4. BANNER PROMOCIONAL MEDIO ("TU CUIDADO DIARIO ✦") ── */}
      <section id="rutina" className="scroll-mt-20 py-16 bg-gradient-to-r from-rose-50 via-[#FFF5F6] to-pink-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 border-y border-rose-150/80 dark:border-zinc-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="space-y-5 text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-200/80 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                <Sparkles className="h-3 w-3 text-rose-600" />
                <span>Tu Cuidado Diario ✦</span>
              </span>
              <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Cosmética Que Cuida y Nutre Tu Piel
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-stone-600 dark:text-stone-300 max-w-xl mx-auto lg:mx-0">
                No se trata de cubrir imperfecciones, sino de restaurar la barrera hidrolipídica de tu piel con activos de pureza clínica y extractos botánicos nobles.
              </p>

              {/* Métricas de prueba social */}
              <div className="flex items-center justify-center lg:justify-start gap-8 py-2">
                <div>
                  <p className="font-serif text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400">
                    10.000+
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Clientes Satisfechas</p>
                </div>
                <div className="h-10 w-px bg-rose-200 dark:bg-zinc-800" />
                <div>
                  <p className="font-serif text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400">
                    4.9 ★
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Rating Promedio</p>
                </div>
                <div className="h-10 w-px bg-rose-200 dark:bg-zinc-800" />
                <div>
                  <p className="font-serif text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400">
                    24 Horas
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Envíos en Asunción</p>
                </div>
              </div>

              <div>
                <Link
                  href={`${prefix}/inicio#productos`}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-7 py-3 text-sm font-semibold text-white shadow-md hover:bg-rose-600 transition-colors"
                >
                  <span>Explorar Colección →</span>
                </Link>
              </div>
            </div>

            {/* Foto pedestal de cosméticos con rosas */}
            <div className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden rounded-3xl border border-rose-200 shadow-xl">
              <AppImage
                src={IMG_PEDESTAL}
                fallbackSrc="https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images/promotions/hero-cosmetica-pedestal.webp"
                alt="Pedestal con frascos de sérum y rosas"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/50 via-transparent to-transparent flex items-end p-6">
                <span className="rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-rose-800 shadow-md">
                  ✦ Fórmulas Botánicas Puras
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. SECCIÓN DE OFERTAS CON DESCUENTOS DESTACADOS ── */}
      <section id="ofertas" className="scroll-mt-20 py-16 sm:py-20 bg-[#FFFDFB] dark:bg-zinc-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <span className="inline-block rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
                Oportunidades de la Semana ⏳
              </span>
              <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mt-2">
                Kits & Ofertas Especiales
              </h3>
            </div>
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-full border border-rose-200">
              Descuentos automáticos al carrito
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {COSMETICS_DEALS.map((deal) => (
              <div
                key={deal.id}
                className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-rose-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 transition-all hover:shadow-xl hover:border-rose-300"
              >
                <div>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-rose-50 dark:bg-zinc-800">
                    <AppImage src={deal.image} alt={deal.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    {/* Badge de porcentaje OFF */}
                    <span className="absolute top-3 right-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-md">
                      {deal.discount}
                    </span>
                    <span className="absolute top-3 left-3 rounded-full bg-stone-900/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-semibold text-white uppercase">
                      {deal.tag}
                    </span>
                  </div>

                  <div className="pt-4 space-y-2">
                    <h4 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100 line-clamp-1">
                      {deal.name}
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2">
                      {deal.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-rose-100 dark:border-zinc-800 mt-4 flex items-center justify-between">
                  <div>
                    <span className="block text-[11px] text-stone-400 line-through">
                      Gs. {deal.originalPrice.toLocaleString('es-PY')}
                    </span>
                    <span className="font-serif text-lg font-bold text-rose-600 dark:text-rose-400">
                      Gs. {deal.salePrice.toLocaleString('es-PY')}
                    </span>
                  </div>
                  <Link
                    href={`${prefix}/inicio#productos`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 shadow-sm transition-colors"
                    aria-label={`Comprar ${deal.name}`}
                  >
                    <ShoppingBag className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. GRILLA DE PRODUCTOS DESTACADOS ── */}
      <section id="productos" className="scroll-mt-20 py-16 sm:py-20 bg-[#FFFDFB] dark:bg-zinc-950 border-t border-rose-100 dark:border-zinc-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-block rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
              Favoritos de la Comunidad
            </span>
            <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mt-2">
              Productos Más Elegidos
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
              Fórmulas certificadas con precios en Guaraníes y disponibilidad en tiempo real.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {productsToDisplay.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. PERFIL DE LA BOUTIQUE & NOSOTROS ── */}
      <section id="nosotros" className="scroll-mt-20 py-16 sm:py-20 bg-[#FFF9F9] dark:bg-zinc-900/60 border-t border-rose-100 dark:border-zinc-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Foto interior de la boutique */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-rose-200 shadow-xl">
              <AppImage
                src={IMG_BOUTIQUE}
                fallbackSrc="https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/product-images/promotions/hero-cosmetica-boutique.webp"
                alt="Interior boutique de cosmética y skincare de lujo"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-transparent flex items-end p-6">
                <div className="text-white">
                  <p className="font-serif text-lg font-bold">Boutique & Showroom Asunción</p>
                  <p className="text-xs text-white/80">Vení a probar las texturas y recibir asesoramiento en vivo</p>
                </div>
              </div>
            </div>

            {/* Historia y filosofía de la tienda */}
            <div className="space-y-5">
              <span className="inline-block rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
                Nuestra Filosofía
              </span>
              <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Belleza Consciente y Resultados Que Se Sienten
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-stone-600 dark:text-stone-300">
                En {storeName}, creemos que el cuidado de la piel debe ser un ritual placentero y transparente. Seleccionamos cuidadosamente marcas éticas con concentraciones efectivas para brindar hidratación, luminosidad y protección duradera.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-rose-150/60 dark:border-zinc-700">
                  <Clock className="h-5 w-5 text-rose-500 mb-2" />
                  <h5 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">Horarios</h5>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    {company.hours?.weekdays || 'Lun a Vie 08:30 - 19:30'}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-rose-150/60 dark:border-zinc-700">
                  <Instagram className="h-5 w-5 text-rose-500 mb-2" />
                  <h5 className="font-serif text-sm font-bold text-stone-900 dark:text-stone-100">Comunidad</h5>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    @{company.instagram ? company.instagram.replace(/^@/, '') : 'gloworapy'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. UBICACIÓN & GOOGLE MAPS INTERACTIVO ── */}
      <section id="ubicacion" className="scroll-mt-20 py-16 sm:py-20 bg-[#FFFDFB] dark:bg-zinc-950 border-t border-rose-100 dark:border-zinc-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-rose-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
              {/* Mapa de Google */}
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
                <div className="flex h-80 lg:h-full min-h-[340px] items-center justify-center bg-rose-50/50 dark:bg-zinc-800/40 p-6 text-center">
                  <div className="space-y-2">
                    <MapPin className="h-8 w-8 text-rose-500 mx-auto" />
                    <p className="font-serif text-sm font-bold text-stone-800 dark:text-stone-200">
                      Showroom y Tienda Física
                    </p>
                    <p className="text-xs text-stone-500">{address}</p>
                  </div>
                </div>
              )}

              {/* Datos de dirección y botón de Google Maps */}
              <div className="flex flex-col justify-center gap-5 p-8 lg:p-10 bg-[#FFFDFB] dark:bg-zinc-900">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                  <MapPin className="h-6 w-6" />
                </span>
                <div>
                  <h4 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                    Encontranos en Asunción
                  </h4>
                  <p className="font-medium text-stone-800 dark:text-stone-200 mt-1">{storeName}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mt-1">
                    {address}
                  </p>
                </div>

                <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400">
                  <p><strong>Teléfono:</strong> {phone}</p>
                  <p><strong>Atención al cliente:</strong> Lunes a Sábados</p>
                </div>

                {directionsHref && (
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 transition-colors"
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

      {/* ── 9. BOTÓN FLOTANTE DE WHATSAPP CON TOOLTIP ACTIVO ── */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        {/* Tooltip de recomendación de rutina */}
        <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-stone-800 shadow-lg border border-rose-200/80 backdrop-blur-md animate-bounce">
          <Sparkles className="h-3.5 w-3.5 text-rose-500" />
          <span>¡Hola! ¿Te asesoramos con tu rutina?</span>
        </div>

        <FloatingWhatsAppButton
          fallbackPhone={whatsappClean}
        />
      </div>
    </div>
  )
}
