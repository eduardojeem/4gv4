'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  Battery,
  Cable,
  Camera,
  Coffee,
  Cpu,
  Flame,
  Gamepad2,
  HardDrive,
  Headphones,
  Home,
  Laptop,
  Layers,
  Package,
  Shield,
  Smartphone,
  Snowflake,
  Speaker,
  Tablet,
  Tv,
  Utensils,
  Volume2,
  WashingMachine,
  Watch,
  Wind,
  Wrench,
  Sparkles,
  Grid3X3,
} from 'lucide-react'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
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
    gradient: 'from-blue-600 to-indigo-700',
    accentBg: 'group-hover:border-blue-500/50 group-hover:shadow-blue-500/10',
  },
  {
    keywords: ['heladera', 'refrigerador', 'freezer', 'frio', 'congelador', 'cava'],
    icon: Snowflake,
    gradient: 'from-cyan-500 to-blue-600',
    accentBg: 'group-hover:border-cyan-500/50 group-hover:shadow-cyan-500/10',
  },
  {
    keywords: ['lavarropa', 'lavado', 'secarropa', 'lavavajilla'],
    icon: WashingMachine,
    gradient: 'from-sky-500 to-indigo-600',
    accentBg: 'group-hover:border-sky-500/50 group-hover:shadow-sky-500/10',
  },
  {
    keywords: ['climatizacion', 'aire acondicionado', 'aire', 'split', 'ventilador', 'calefaccion', 'estufa', 'caloventor'],
    icon: Wind,
    gradient: 'from-teal-500 to-cyan-700',
    accentBg: 'group-hover:border-teal-500/50 group-hover:shadow-teal-500/10',
  },
  {
    keywords: ['cocina', 'horno', 'microondas', 'anafe', 'parrilla', 'extractor', 'campana'],
    icon: Flame,
    gradient: 'from-amber-500 to-orange-600',
    accentBg: 'group-hover:border-orange-500/50 group-hover:shadow-orange-500/10',
  },
  {
    keywords: ['pequeño electrodomestico', 'licuadora', 'cafetera', 'tostadora', 'batidora', 'pava', 'aspiradora', 'plancha'],
    icon: Coffee,
    gradient: 'from-amber-600 to-rose-600',
    accentBg: 'group-hover:border-amber-500/50 group-hover:shadow-amber-500/10',
  },
  {
    keywords: ['audio', 'parlante', 'equipo de musica', 'soundbar', 'bafle', 'microfono'],
    icon: Speaker,
    gradient: 'from-violet-600 to-purple-700',
    accentBg: 'group-hover:border-violet-500/50 group-hover:shadow-violet-500/10',
  },

  // ── Tecnología, Celulares & Computación ──
  {
    keywords: ['celular', 'telefono', 'smartphone', 'phone', 'movil', 'iphone', 'samsung', 'xiaomi', 'motorola'],
    icon: Smartphone,
    gradient: 'from-blue-500 to-indigo-600',
    accentBg: 'group-hover:border-blue-500/50 group-hover:shadow-blue-500/10',
  },
  {
    keywords: ['computadora', 'notebook', 'laptop', 'pc', 'computacion', 'all in one'],
    icon: Laptop,
    gradient: 'from-slate-700 to-zinc-900',
    accentBg: 'group-hover:border-slate-500/50 group-hover:shadow-slate-500/10',
  },
  {
    keywords: ['tablet', 'ipad'],
    icon: Tablet,
    gradient: 'from-teal-600 to-emerald-700',
    accentBg: 'group-hover:border-teal-500/50 group-hover:shadow-teal-500/10',
  },
  {
    keywords: ['smartwatch', 'reloj', 'wearable', 'band'],
    icon: Watch,
    gradient: 'from-cyan-600 to-sky-700',
    accentBg: 'group-hover:border-cyan-500/50 group-hover:shadow-cyan-500/10',
  },
  {
    keywords: ['auricular', 'audifono', 'headphone', 'airpods', 'tws', 'casco'],
    icon: Headphones,
    gradient: 'from-purple-600 to-pink-600',
    accentBg: 'group-hover:border-purple-500/50 group-hover:shadow-purple-500/10',
  },
  {
    keywords: ['gamer', 'gaming', 'consola', 'playstation', 'ps5', 'xbox', 'nintendo', 'joystick'],
    icon: Gamepad2,
    gradient: 'from-emerald-500 to-green-700',
    accentBg: 'group-hover:border-emerald-500/50 group-hover:shadow-emerald-500/10',
  },
  {
    keywords: ['cable', 'cargador', 'fuente', 'adaptador', 'hub', 'usb'],
    icon: Cable,
    gradient: 'from-indigo-500 to-blue-600',
    accentBg: 'group-hover:border-indigo-500/50 group-hover:shadow-indigo-500/10',
  },
  {
    keywords: ['bateria', 'powerbank', 'pila'],
    icon: Battery,
    gradient: 'from-emerald-600 to-teal-700',
    accentBg: 'group-hover:border-emerald-500/50 group-hover:shadow-emerald-500/10',
  },
  {
    keywords: ['almacenamiento', 'disco', 'ssd', 'pendrive', 'memoria', 'sd'],
    icon: HardDrive,
    gradient: 'from-cyan-700 to-blue-800',
    accentBg: 'group-hover:border-cyan-500/50 group-hover:shadow-cyan-500/10',
  },
  {
    keywords: ['repuesto', 'pantalla', 'display', 'modulo', 'flex', 'placa'],
    icon: Cpu,
    gradient: 'from-orange-500 to-amber-600',
    accentBg: 'group-hover:border-orange-500/50 group-hover:shadow-orange-500/10',
  },
  {
    keywords: ['funda', 'case', 'protector', 'vidrio templado', 'hidrogel'],
    icon: Shield,
    gradient: 'from-rose-500 to-pink-600',
    accentBg: 'group-hover:border-rose-500/50 group-hover:shadow-rose-500/10',
  },
  {
    keywords: ['camara', 'foto', 'video', 'seguridad', 'dvr'],
    icon: Camera,
    gradient: 'from-amber-500 to-yellow-600',
    accentBg: 'group-hover:border-amber-500/50 group-hover:shadow-amber-500/10',
  },
  {
    keywords: ['herramienta', 'servicio', 'taller', 'ferreteria', 'soldador'],
    icon: Wrench,
    gradient: 'from-zinc-700 to-zinc-900',
    accentBg: 'group-hover:border-zinc-500/50 group-hover:shadow-zinc-500/10',
  },
  {
    keywords: ['hogar', 'mueble', 'bazar', 'deco', 'cocina y comedor'],
    icon: Home,
    gradient: 'from-stone-600 to-zinc-800',
    accentBg: 'group-hover:border-stone-500/50 group-hover:shadow-stone-500/10',
  },
]

const FALLBACK_PRESET: CategoryPreset = {
  keywords: [],
  icon: Package,
  gradient: 'from-primary to-primary/80',
  accentBg: 'group-hover:border-primary/50 group-hover:shadow-primary/10',
}

function getCategoryPreset(name: string): CategoryPreset {
  const lower = name.toLowerCase()
  return CATEGORY_PRESETS.find((p) => p.keywords.some((k) => lower.includes(k))) ?? FALLBACK_PRESET
}

export function CategoryShowcase() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const { categories, isLoading } = usePublicCategories()

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

  // Mostrar hasta 12 categorías si hay variedad (electrodomésticos, tecno, etc.)
  const items = [...withProducts]
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 12)

  return (
    <section className="py-12 sm:py-16 bg-background border-b border-border/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cabecera de Sección */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Grid3X3 className="h-3.5 w-3.5" />
              Categorías Principales
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Comprá por Categoría
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Encontrá rápidamente lo que buscás navegando en nuestros rubros y líneas de productos.
            </p>
          </div>

          <Link
            href={`${tenantPrefix}/productos`}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground shadow-xs hover:border-primary/50 hover:bg-muted transition-all group"
          >
            <span>Ver catálogo completo</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 text-primary" />
          </Link>
        </div>

        {/* Grid de Categorías con Cards Modernas y Vibrantes */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-4">
          {items.map((category) => {
            const preset = getCategoryPreset(category.name)
            const Icon = preset.icon
            const count = category.productCount ?? 0

            return (
              <Link
                key={category.id}
                href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(category.id)}`}
                className={cn(
                  'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md',
                  preset.accentBg
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-xs transition-transform duration-200 group-hover:scale-110',
                      preset.gradient
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {count > 0 && (
                    <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                    {category.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                    <span>Ver productos</span>
                    <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Botón Ver Todo en Mobile */}
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
