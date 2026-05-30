'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Armchair, Bike, BookOpen, Briefcase, Camera, Car, ChevronLeft, ChevronRight,
  Coffee, Cpu, Dumbbell, FileText, Gamepad2, GraduationCap, Grid3X3, HardHat,
  Heart, Home, Laptop, Leaf, Map, Monitor, Mountain, Music, Package,
  PawPrint, Plane, Scissors, Shirt, ShoppingBasket, ShoppingCart,
  Smartphone, Sparkles, Tag, Trophy, Tv, Utensils, Wrench, Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { useReducedMotion } from 'framer-motion'
import type { MarketplaceCategory } from '@/lib/public/marketplace'

// ─── Icon map ──────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  // Tech / electronics
  electrónica: Cpu, electronica: Cpu,
  tecnología: Monitor, tecnologia: Monitor,
  computación: Laptop, computacion: Laptop,
  celulares: Smartphone, smartphones: Smartphone,
  tablets: Tablet2, televisores: Tv, tv: Tv,
  // Fashion
  ropa: Shirt, indumentaria: Shirt, moda: Sparkles,
  calzado: ShoppingBasket, zapatillas: ShoppingBasket,
  accesorios: Zap, joyería: Sparkles, joyeria: Sparkles,
  belleza: Sparkles, cosméticos: Sparkles, cosmeticos: Sparkles,
  peluquería: Scissors, peluqueria: Scissors,
  // Home
  hogar: Home, muebles: Armchair, decoración: Sparkles, decoracion: Sparkles,
  jardín: Leaf, jardin: Leaf, construcción: HardHat, construccion: HardHat,
  herramientas: Wrench,
  // Food
  alimentos: ShoppingBasket, comida: Utensils, bebidas: Coffee,
  supermercado: ShoppingCart, restaurante: Utensils,
  // Sports / outdoors
  deportes: Trophy, fitness: Dumbbell, outdoor: Mountain, bicicletas: Bike,
  // Entertainment
  juguetes: Gamepad2, videojuegos: Gamepad2, música: Music, musica: Music,
  libros: BookOpen, fotografía: Camera, fotografia: Camera,
  // Health
  salud: Heart, farmacia: Heart, mascotas: PawPrint,
  // Transport
  autos: Car, automotor: Car, motos: Bike,
  // Travel / services
  viajes: Plane, turismo: Map, servicios: Briefcase,
  oficina: Briefcase, papelería: FileText, papeleria: FileText,
  educación: GraduationCap, educacion: GraduationCap,
}

// Tablet2 might not exist — fallback to Smartphone
function Tablet2(props: React.SVGProps<SVGSVGElement>) {
  return <Smartphone {...(props as React.ComponentProps<typeof Smartphone>)} />
}

function getCategoryIcon(name: string): React.ElementType {
  const key = name.toLowerCase().trim()
  // exact match
  if (ICON_MAP[key]) return ICON_MAP[key]
  // partial match
  for (const [k, Icon] of Object.entries(ICON_MAP)) {
    if (key.includes(k) || k.includes(key)) return Icon
  }
  return Package
}

// ─── Color palette (12 themes, light + dark) ────────────────────────────────
const PALETTES = [
  { bg: 'from-cyan-50 to-cyan-100/80', dark: 'dark:from-cyan-950/40 dark:to-cyan-900/30', border: 'border-cyan-200/70 dark:border-cyan-800/50', icon: 'bg-cyan-500', ring: 'ring-cyan-400', text: 'text-cyan-700 dark:text-cyan-300', pill: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300' },
  { bg: 'from-violet-50 to-violet-100/80', dark: 'dark:from-violet-950/40 dark:to-violet-900/30', border: 'border-violet-200/70 dark:border-violet-800/50', icon: 'bg-violet-500', ring: 'ring-violet-400', text: 'text-violet-700 dark:text-violet-300', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300' },
  { bg: 'from-amber-50 to-amber-100/80', dark: 'dark:from-amber-950/40 dark:to-amber-900/30', border: 'border-amber-200/70 dark:border-amber-800/50', icon: 'bg-amber-500', ring: 'ring-amber-400', text: 'text-amber-700 dark:text-amber-300', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  { bg: 'from-emerald-50 to-emerald-100/80', dark: 'dark:from-emerald-950/40 dark:to-emerald-900/30', border: 'border-emerald-200/70 dark:border-emerald-800/50', icon: 'bg-emerald-500', ring: 'ring-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  { bg: 'from-rose-50 to-rose-100/80', dark: 'dark:from-rose-950/40 dark:to-rose-900/30', border: 'border-rose-200/70 dark:border-rose-800/50', icon: 'bg-rose-500', ring: 'ring-rose-400', text: 'text-rose-700 dark:text-rose-300', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' },
  { bg: 'from-blue-50 to-blue-100/80', dark: 'dark:from-blue-950/40 dark:to-blue-900/30', border: 'border-blue-200/70 dark:border-blue-800/50', icon: 'bg-blue-500', ring: 'ring-blue-400', text: 'text-blue-700 dark:text-blue-300', pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { bg: 'from-fuchsia-50 to-fuchsia-100/80', dark: 'dark:from-fuchsia-950/40 dark:to-fuchsia-900/30', border: 'border-fuchsia-200/70 dark:border-fuchsia-800/50', icon: 'bg-fuchsia-500', ring: 'ring-fuchsia-400', text: 'text-fuchsia-700 dark:text-fuchsia-300', pill: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/50 dark:text-fuchsia-300' },
  { bg: 'from-orange-50 to-orange-100/80', dark: 'dark:from-orange-950/40 dark:to-orange-900/30', border: 'border-orange-200/70 dark:border-orange-800/50', icon: 'bg-orange-500', ring: 'ring-orange-400', text: 'text-orange-700 dark:text-orange-300', pill: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  { bg: 'from-teal-50 to-teal-100/80', dark: 'dark:from-teal-950/40 dark:to-teal-900/30', border: 'border-teal-200/70 dark:border-teal-800/50', icon: 'bg-teal-500', ring: 'ring-teal-400', text: 'text-teal-700 dark:text-teal-300', pill: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300' },
  { bg: 'from-indigo-50 to-indigo-100/80', dark: 'dark:from-indigo-950/40 dark:to-indigo-900/30', border: 'border-indigo-200/70 dark:border-indigo-800/50', icon: 'bg-indigo-500', ring: 'ring-indigo-400', text: 'text-indigo-700 dark:text-indigo-300', pill: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' },
  { bg: 'from-pink-50 to-pink-100/80', dark: 'dark:from-pink-950/40 dark:to-pink-900/30', border: 'border-pink-200/70 dark:border-pink-800/50', icon: 'bg-pink-500', ring: 'ring-pink-400', text: 'text-pink-700 dark:text-pink-300', pill: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300' },
  { bg: 'from-lime-50 to-lime-100/80', dark: 'dark:from-lime-950/40 dark:to-lime-900/30', border: 'border-lime-200/70 dark:border-lime-800/50', icon: 'bg-lime-500', ring: 'ring-lime-400', text: 'text-lime-700 dark:text-lime-300', pill: 'bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300' },
]

function getPalette(index: number) {
  return PALETTES[index % PALETTES.length]
}

// ─── Skeleton card ───────────────────────────────────────────────────────────
function CategorySkeleton() {
  return (
    <div className="flex w-36 shrink-0 flex-col items-center gap-3 sm:w-44">
      <div className="h-36 w-36 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800 sm:h-44 sm:w-44" />
      <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
      <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
    </div>
  )
}

// ─── Animation variants ──────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 380, damping: 26 } },
}

// ─── Props ───────────────────────────────────────────────────────────────────
export type CategoryCarouselProps = {
  categories: MarketplaceCategory[]
  activeId?: string
  title?: string
  subtitle?: string
  showCount?: boolean
  compact?: boolean
}

// ─── Main component ──────────────────────────────────────────────────────────
export function CategoryCarousel({
  categories,
  activeId,
  title = 'Categorías',
  subtitle,
  showCount = true,
  compact = false,
}: CategoryCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const router = useRouter()

  const [{ canLeft, canRight }, dispatch] = useReducer(
    (_: { canLeft: boolean; canRight: boolean }, el: HTMLDivElement) => ({
      canLeft: el.scrollLeft > 8,
      canRight: el.scrollLeft < el.scrollWidth - el.clientWidth - 8,
    }),
    { canLeft: false, canRight: true }
  )

  const updateArrows = useCallback(() => {
    if (scrollRef.current) dispatch(scrollRef.current)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect() }
  }, [updateArrows, categories.length])

  function scrollBy(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const card = el.querySelector('[data-cat-card]') as HTMLElement | null
    const step = (card?.offsetWidth ?? 176) * 3 + 16 * 2
    el.scrollBy({ left: dir === 'right' ? step : -step, behavior: 'smooth' })
  }

  const loading = categories.length === 0
  const skeletonCount = 8

  const cardSize = compact
    ? 'w-32 h-28 sm:w-36 sm:h-32'
    : 'w-36 h-36 sm:w-44 sm:h-44'

  const iconSize = compact ? 'h-8 w-8' : 'h-10 w-10 sm:h-12 sm:w-12'
  const labelWidth = compact ? 'max-w-28' : 'max-w-36'

  return (
    <div className="relative">
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-5 flex items-end justify-between">
          <div>
            {title && (
              <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                <Grid3X3 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          {/* Desktop arrows */}
          <div className="hidden items-center gap-1 sm:flex">
            <button
              onClick={() => scrollBy('left')}
              disabled={!canLeft}
              aria-label="Categorías anteriores"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollBy('right')}
              disabled={!canRight}
              aria-label="Categorías siguientes"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Scroll area */}
      <div className="relative">
        {/* Left fade */}
        <div
          className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-white to-transparent transition-opacity dark:from-slate-950"
          style={{ opacity: canLeft ? 1 : 0 }}
        />
        {/* Right fade */}
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-white to-transparent transition-opacity dark:from-slate-950"
          style={{ opacity: canRight ? 1 : 0 }}
        />

        <div
          ref={scrollRef}
          role="list"
          aria-label="Categorías del marketplace"
          className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide sm:gap-4"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          {loading ? (
            Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} role="listitem" style={{ scrollSnapAlign: 'start' }}>
                <CategorySkeleton />
              </div>
            ))
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="cards"
                className="flex gap-3 sm:gap-4"
                variants={shouldReduceMotion ? undefined : containerVariants}
                initial="hidden"
                animate="show"
              >
                {categories.map((cat, i) => {
                  const palette = getPalette(i)
                  const Icon = getCategoryIcon(cat.name)
                  const isActive = activeId === cat.id
                  const href = `/marketplace/productos?categoria=${cat.id}`

                  return (
                    <motion.div
                      key={cat.id}
                      role="listitem"
                      data-cat-card
                      variants={shouldReduceMotion ? undefined : cardVariants}
                      style={{ scrollSnapAlign: 'start' }}
                    >
                      <motion.div
                        whileHover={shouldReduceMotion ? {} : { y: -5, scale: 1.03 }}
                        whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                      >
                        <Link
                          href={href}
                          onClick={() => router.prefetch(href)}
                          aria-label={`${cat.name}${showCount ? ` — ${cat.product_count} productos` : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                          className={[
                            'group flex flex-col items-center gap-2.5 outline-none',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500',
                          ].join(' ')}
                        >
                          {/* Card face */}
                          <div
                            className={[
                              cardSize,
                              'relative flex flex-col items-center justify-center overflow-hidden rounded-lg border',
                              'bg-gradient-to-br transition duration-300 group-hover:-translate-y-0.5',
                              palette.bg, palette.dark, palette.border,
                              isActive
                                ? `ring-2 ring-offset-2 shadow-lg ${palette.ring}`
                                : 'shadow-sm group-hover:shadow-md',
                            ].join(' ')}
                          >
                            {/* Icon container */}
                            <div className={`relative flex h-14 w-14 items-center justify-center rounded-lg ${palette.icon} shadow-sm`}>
                              <Icon className={`${iconSize} text-white`} strokeWidth={1.8} />
                            </div>

                            {/* Active indicator dot */}
                            {isActive && (
                              <motion.div
                                layoutId="active-dot"
                                className={`absolute bottom-2 h-1.5 w-6 rounded-full ${palette.icon}`}
                              />
                            )}
                          </div>

                          {/* Name */}
                          <span className={`line-clamp-1 ${labelWidth} text-center text-xs font-semibold ${isActive ? palette.text : 'text-slate-700 dark:text-slate-200'}`}>
                            {cat.name}
                          </span>

                          {/* Count pill */}
                          {showCount && cat.product_count > 0 && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${palette.pill}`}>
                              {cat.product_count} {cat.product_count === 1 ? 'producto' : 'productos'}
                            </span>
                          )}
                        </Link>
                      </motion.div>
                    </motion.div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Mobile dot indicator */}
      {categories.length > 6 && (
        <div className="mt-3 flex justify-center gap-1 sm:hidden">
          <div className="h-1 w-8 rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full w-1/3 rounded-full bg-cyan-500 transition-all" />
          </div>
        </div>
      )}
    </div>
  )
}
