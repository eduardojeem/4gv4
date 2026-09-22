'use client'

import { useMemo, useState } from 'react'
import { useHydrated } from '@/hooks/use-hydrated'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { useStorefrontStyle } from '@/components/public/storefront-style-context'
import { CategoryCollections, categoryCoverImages } from './CategoryCollections'
import {
  ArrowRight,
  Battery,
  Cable,
  Camera,
  ChevronDown,
  Coffee,
  Cpu,
  Dumbbell,
  Flame,
  Footprints,
  Gamepad2,
  Grid3X3,
  HardDrive,
  Headphones,
  Home,
  Laptop,
  Layers,
  Lightbulb,
  Package,
  Printer,
  Shield,
  Shirt,
  Smartphone,
  Snowflake,
  Sparkles,
  Speaker,
  Tablet,
  Tv,
  WashingMachine,
  Watch,
  Wifi,
  Wind,
  Wrench,
} from 'lucide-react'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { resolveProductImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import {
  NEWEST_PRODUCTS_SWR_OPTIONS,
  fetchPublicProducts,
  newestProductsKey,
} from './newest-products'
import type { LucideIcon } from 'lucide-react'

interface CategoryPreset {
  keywords: string[]
  icon: LucideIcon
  gradient: string
  accentBg: string
}

const CATEGORY_PRESETS: CategoryPreset[] = [
  // ── Electrodomésticos & Climatización ──
  {
    keywords: ['tv', 'televisor', 'smart tv', 'pantallas', 'proyector'],
    icon: Tv,
    gradient: 'from-blue-600 via-indigo-600 to-indigo-700',
    accentBg: 'group-hover:border-blue-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(59,130,246,0.25)]',
  },
  {
    keywords: ['heladera', 'refrigerador', 'freezer', 'frio', 'congelador', 'cava'],
    icon: Snowflake,
    gradient: 'from-cyan-500 via-sky-500 to-blue-600',
    accentBg: 'group-hover:border-cyan-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(6,182,212,0.25)]',
  },
  {
    keywords: ['lavarropa', 'lavado', 'secarropa', 'lavavajilla'],
    icon: WashingMachine,
    gradient: 'from-sky-500 via-blue-500 to-indigo-600',
    accentBg: 'group-hover:border-sky-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(14,165,233,0.25)]',
  },
  {
    keywords: ['climatizacion', 'aire acondicionado', 'aire', 'split', 'ventilador', 'calefaccion', 'estufa', 'caloventor'],
    icon: Wind,
    gradient: 'from-teal-500 via-teal-600 to-cyan-700',
    accentBg: 'group-hover:border-teal-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(20,184,166,0.25)]',
  },
  {
    keywords: ['cocina', 'horno', 'microondas', 'anafe', 'parrilla', 'extractor', 'campana'],
    icon: Flame,
    gradient: 'from-amber-500 via-orange-500 to-red-600',
    accentBg: 'group-hover:border-orange-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(249,115,22,0.25)]',
  },
  {
    keywords: ['pequeño electrodomestico', 'licuadora', 'cafetera', 'tostadora', 'batidora', 'pava', 'aspiradora', 'plancha'],
    icon: Coffee,
    gradient: 'from-amber-600 via-orange-600 to-rose-600',
    accentBg: 'group-hover:border-amber-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(245,158,11,0.25)]',
  },
  {
    keywords: ['audio', 'parlante', 'equipo de musica', 'soundbar', 'bafle', 'microfono'],
    icon: Speaker,
    gradient: 'from-violet-600 via-purple-600 to-fuchsia-700',
    accentBg: 'group-hover:border-violet-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(139,92,246,0.25)]',
  },

  // ── Tecnología, Celulares & Computación ──
  {
    keywords: ['celular', 'telefono', 'smartphone', 'phone', 'movil', 'iphone', 'samsung', 'xiaomi', 'motorola'],
    icon: Smartphone,
    gradient: 'from-blue-500 via-indigo-600 to-violet-600',
    accentBg: 'group-hover:border-blue-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(59,130,246,0.25)]',
  },
  {
    keywords: ['computadora', 'notebook', 'laptop', 'pc', 'computacion', 'all in one'],
    icon: Laptop,
    gradient: 'from-slate-700 via-zinc-800 to-neutral-900',
    accentBg: 'group-hover:border-slate-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(100,116,139,0.25)]',
  },
  {
    keywords: ['tablet', 'ipad'],
    icon: Tablet,
    gradient: 'from-teal-600 via-emerald-600 to-teal-700',
    accentBg: 'group-hover:border-teal-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(20,184,166,0.25)]',
  },
  {
    keywords: ['smartwatch', 'reloj', 'wearable', 'band'],
    icon: Watch,
    gradient: 'from-cyan-600 via-sky-600 to-blue-700',
    accentBg: 'group-hover:border-cyan-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(6,182,212,0.25)]',
  },
  {
    keywords: ['auricular', 'audifono', 'headphone', 'airpods', 'tws', 'casco'],
    icon: Headphones,
    gradient: 'from-purple-600 via-fuchsia-600 to-pink-600',
    accentBg: 'group-hover:border-purple-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(168,85,247,0.25)]',
  },
  {
    keywords: ['gamer', 'gaming', 'consola', 'playstation', 'ps5', 'xbox', 'nintendo', 'joystick'],
    icon: Gamepad2,
    gradient: 'from-emerald-500 via-teal-600 to-green-700',
    accentBg: 'group-hover:border-emerald-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.25)]',
  },
  {
    keywords: ['cable', 'cargador', 'fuente', 'adaptador', 'hub', 'usb'],
    icon: Cable,
    gradient: 'from-indigo-500 via-indigo-600 to-blue-600',
    accentBg: 'group-hover:border-indigo-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.25)]',
  },
  {
    keywords: ['bateria', 'powerbank', 'pila'],
    icon: Battery,
    gradient: 'from-emerald-600 via-green-600 to-teal-700',
    accentBg: 'group-hover:border-emerald-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.25)]',
  },
  {
    keywords: ['almacenamiento', 'disco', 'ssd', 'pendrive', 'memoria', 'sd'],
    icon: HardDrive,
    gradient: 'from-cyan-700 via-blue-700 to-indigo-800',
    accentBg: 'group-hover:border-cyan-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(6,182,212,0.25)]',
  },
  {
    keywords: ['repuesto', 'pantalla', 'display', 'modulo', 'flex', 'placa'],
    icon: Cpu,
    gradient: 'from-orange-500 via-amber-600 to-red-600',
    accentBg: 'group-hover:border-orange-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(249,115,22,0.25)]',
  },
  {
    keywords: ['funda', 'case', 'protector', 'vidrio templado', 'hidrogel'],
    icon: Shield,
    gradient: 'from-rose-500 via-pink-600 to-rose-700',
    accentBg: 'group-hover:border-rose-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(244,63,94,0.25)]',
  },
  {
    keywords: ['camara', 'foto', 'video', 'seguridad', 'dvr'],
    icon: Camera,
    gradient: 'from-amber-500 via-yellow-600 to-orange-600',
    accentBg: 'group-hover:border-amber-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(245,158,11,0.25)]',
  },
  {
    keywords: ['herramienta', 'servicio', 'taller', 'ferreteria', 'soldador'],
    icon: Wrench,
    gradient: 'from-zinc-700 via-stone-800 to-zinc-900',
    accentBg: 'group-hover:border-zinc-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(113,113,122,0.25)]',
  },

  // ── Moda, Indumentaria & Calzado ──
  {
    keywords: ['ropa', 'indumentaria', 'moda', 'textil', 'remera', 'buzo', 'pantalon', 'campera', 'vestido', 'bermuda'],
    icon: Shirt,
    gradient: 'from-violet-500 via-purple-600 to-fuchsia-600',
    accentBg: 'group-hover:border-violet-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(139,92,246,0.25)]',
  },
  {
    keywords: ['calzado', 'zapatilla', 'zapato', 'bota', 'ojota', 'sandalia'],
    icon: Footprints,
    gradient: 'from-indigo-600 via-blue-600 to-violet-700',
    accentBg: 'group-hover:border-indigo-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.25)]',
  },

  // ── Iluminación, Redes & Oficina ──
  {
    keywords: ['iluminacion', 'lampara', 'led', 'foco', 'tira led', 'velador'],
    icon: Lightbulb,
    gradient: 'from-amber-400 via-yellow-500 to-orange-500',
    accentBg: 'group-hover:border-yellow-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(234,179,8,0.25)]',
  },
  {
    keywords: ['redes', 'wifi', 'router', 'conectividad', 'switch', 'antena', 'repetidor'],
    icon: Wifi,
    gradient: 'from-blue-600 via-cyan-600 to-sky-600',
    accentBg: 'group-hover:border-cyan-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(6,182,212,0.25)]',
  },
  {
    keywords: ['impresora', 'impresion', 'toner', 'cartucho', 'oficina', 'libreria', 'papeleria'],
    icon: Printer,
    gradient: 'from-slate-600 via-zinc-700 to-neutral-800',
    accentBg: 'group-hover:border-slate-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(100,116,139,0.25)]',
  },

  // ── Belleza, Deportes & Hogar ──
  {
    keywords: ['belleza', 'cuidado personal', 'salud', 'afeitadora', 'secador', 'planchita', 'barberia', 'perfume'],
    icon: Sparkles,
    gradient: 'from-pink-500 via-rose-500 to-fuchsia-600',
    accentBg: 'group-hover:border-pink-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(236,72,153,0.25)]',
  },
  {
    keywords: ['deporte', 'fitness', 'gimnasio', 'entrenamiento', 'aire libre', 'camping'],
    icon: Dumbbell,
    gradient: 'from-emerald-600 via-teal-600 to-green-700',
    accentBg: 'group-hover:border-emerald-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.25)]',
  },
  {
    keywords: ['hogar', 'mueble', 'bazar', 'deco', 'cocina y comedor', 'decoracion'],
    icon: Home,
    gradient: 'from-stone-600 via-zinc-700 to-zinc-800',
    accentBg: 'group-hover:border-stone-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(120,113,108,0.25)]',
  },
  {
    keywords: ['accesorio', 'varios', 'complementos'],
    icon: Layers,
    gradient: 'from-indigo-600 via-blue-600 to-sky-600',
    accentBg: 'group-hover:border-indigo-500/50 group-hover:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.25)]',
  },
]

const FALLBACK_PRESET: CategoryPreset = {
  keywords: [],
  icon: Package,
  gradient: 'from-primary via-primary/90 to-primary/80',
  accentBg: 'group-hover:border-primary/50 group-hover:shadow-primary/10',
}

function getCategoryPreset(name: string): CategoryPreset {
  const lower = name.toLowerCase()
  return CATEGORY_PRESETS.find((p) => p.keywords.some((k) => lower.includes(k))) ?? FALLBACK_PRESET
}

export function CategoryShowcase() {
  const storefrontStyle = useStorefrontStyle()
  // Moda y deportivo muestran colecciones con foto: los iconos de abajo son de
  // tecnología y electrodomésticos.
  if (storefrontStyle !== 'classic') return <CategoryCollections style={storefrontStyle} />
  return <ClassicCategoryShowcase />
}

function ClassicCategoryShowcase() {
  const mounted = useHydrated()
  const [showAll, setShowAll] = useState(false)


  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const { categories, isLoading } = usePublicCategories()
  const { data: products } = useSWR(newestProductsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)

  const covers = useMemo(() => categoryCoverImages(products ?? []), [products])

  if (!mounted || isLoading) {
    return (
      <section className="py-12 bg-background border-b border-border/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/60" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  const hasCounts = categories.some((c) => typeof c.productCount === 'number')
  const withProducts = hasCounts
    ? categories.filter((c) => (c.productCount ?? 0) > 0)
    : categories

  if (withProducts.length === 0) return null

  // Ordenar por cantidad de productos y nombre
  const sortedItems = [...withProducts].sort(
    (a, b) => (b.productCount ?? 0) - (a.productCount ?? 0) || a.name.localeCompare(b.name)
  )

  const items = showAll ? sortedItems : sortedItems.slice(0, 12)
  const hasMore = sortedItems.length > 12

  return (
    <section aria-labelledby="categorias-principales-heading" className="relative py-12 sm:py-16 bg-background border-b border-border/80 overflow-hidden">
      {/* Luz ambiental sutil en el fondo de la sección */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_70%_50%_at_50%_-15%,rgba(59,130,246,0.08),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-15%,rgba(59,130,246,0.12),rgba(0,0,0,0))]"
        aria-hidden="true"
      />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cabecera de Sección Renovada */}
        <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider mb-2 shadow-2xs">
              <Grid3X3 className="h-3.5 w-3.5 text-primary" />
              <span>Categorías Principales</span>
            </div>
            <h2
              id="categorias-principales-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground"
            >
              Comprá por Categoría
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
              Encontrá rápidamente lo que buscás navegando en nuestros rubros y líneas de productos con stock y promociones actualizadas.
            </p>
          </div>

          <Link
            href={`${tenantPrefix}/productos`}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card/90 backdrop-blur-xs px-4 py-2.5 text-xs font-bold text-foreground shadow-2xs hover:border-primary/50 hover:bg-muted/80 hover:text-primary transition-all duration-200 group"
          >
            <span>Ver catálogo completo</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 text-primary" />
          </Link>
        </div>

        {/* Grid de Categorías con Cards Modernas, Iluminación y Micro-Interacciones */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-4">
          {items.map((category) => {
            const preset = getCategoryPreset(category.name)
            const Icon = preset.icon
            const count = category.productCount ?? 0
            const cover = covers.get(category.id)
            const coverUrl = cover ? resolveProductImageUrl(cover) : null

            return (
              <div
                key={category.id}
                className={cn(
                  'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/75 bg-card/90 backdrop-blur-xs p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
                  preset.accentBg
                )}
              >
                {/* Resplandor ambiental de color al hacer hover */}
                <div
                  className={cn(
                    'pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-40 bg-gradient-to-br',
                    preset.gradient
                  )}
                  aria-hidden="true"
                />

                {/* Cabecera de la Card: Icono Squircle Elevado y Contador */}
                <div className="relative z-10 flex items-start justify-between gap-2">
                  <div className="relative flex-shrink-0">
                    <div
                      className={cn(
                        'absolute inset-0 rounded-2xl blur-xs opacity-35 transition-opacity duration-300 group-hover:opacity-60 bg-gradient-to-br',
                        preset.gradient
                      )}
                      aria-hidden="true"
                    />
                    <div
                      className={cn(
                        'relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-xs ring-1 ring-white/20 transition-all duration-300 group-hover:scale-105 group-hover:-rotate-3',
                        preset.gradient
                      )}
                    >
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300" />
                    </div>
                  </div>

                  {/* Miniatura de producto con foto si existe, o Badge de conteo */}
                  <div className="flex items-center gap-1.5">
                    {coverUrl && (
                      <div className="relative h-9 w-9 sm:h-10 sm:w-10 overflow-hidden rounded-xl border border-border/70 bg-muted/40 shadow-2xs transition-transform duration-300 group-hover:scale-105">
                        <Image
                          src={coverUrl}
                          alt={category.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized={coverUrl.startsWith('data:')}
                        />
                      </div>
                    )}

                    {count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors tabular-nums">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Contenido Central: Título y Píldoras de Subcategorías */}
                <div className="relative z-10 mt-4 flex-1">
                  <h3 className="text-xs sm:text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                    {category.name}
                  </h3>

                  {/* Subcategorías directas si las tiene disponibles */}
                  {category.subcategories && category.subcategories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 relative z-20">
                      {category.subcategories.slice(0, 2).map((sub) => (
                        <Link
                          key={sub.id}
                          href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(sub.id)}`}
                          className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/70 hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-colors truncate max-w-[100px]"
                        >
                          {sub.name}
                        </Link>
                      ))}
                      {category.subcategories.length > 2 && (
                        <span className="text-[9px] font-medium text-muted-foreground/70 self-center pl-0.5">
                          +{category.subcategories.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Interactivo con Botón Circular y Flecha */}
                <div className="relative z-10 mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  <span className="text-[11px]">Ver productos</span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/70 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </div>

                {/* Enlace principal a pantalla completa para la tarjeta */}
                <Link
                  href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(category.id)}`}
                  className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Ver productos de ${category.name}`}
                />
              </div>
            )
          })}
        </div>

        {/* Botón Ver Más / Ver Menos si hay más de 12 categorías */}
        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card/90 px-5 py-2.5 text-xs font-bold text-foreground shadow-2xs hover:border-primary/50 hover:bg-muted transition-all cursor-pointer"
            >
              <span>{showAll ? 'Mostrar menos categorías' : `Ver todas las categorías (${sortedItems.length})`}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 text-primary transition-transform duration-200', showAll && 'rotate-180')} />
            </button>
          </div>
        )}

        {/* Botón Ver Todo el Catálogo en Mobile */}
        <div className="mt-6 text-center sm:hidden">
          <Link
            href={`${tenantPrefix}/productos`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-xs hover:bg-muted"
          >
            <span>Ver todo el catálogo</span>
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
          </Link>
        </div>

      </div>
    </section>
  )
}
