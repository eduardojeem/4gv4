'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  ChevronRight, 
  Grid3X3, 
  Package, 
  ShoppingCart, 
  ShoppingBasket, 
  Utensils, 
  Coffee, 
  Dumbbell, 
  Mountain, 
  Bike, 
  Gamepad2, 
  Music, 
  BookOpen, 
  Camera, 
  Heart, 
  PawPrint, 
  Car, 
  Plane, 
  Map, 
  Briefcase, 
  FileText, 
  GraduationCap, 
  Shirt, 
  Sparkles, 
  Scissors, 
  Armchair, 
  Home, 
  Leaf, 
  HardHat, 
  Wrench, 
  Cpu, 
  Monitor, 
  Laptop, 
  Smartphone, 
  Tv, 
  Trophy,
  Search,
  X,
  Store,
  Compass,
  ArrowRight
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { MarketplaceCategory } from '@/lib/public/marketplace'

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  categories: MarketplaceCategory[]
}

type FilterType = 'all' | 'popular' | 'multi-org'

// ─── Icon map ──────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  electrónica: Cpu, electronica: Cpu,
  tecnología: Monitor, tecnologia: Monitor,
  computación: Laptop, computacion: Laptop,
  celulares: Smartphone, smartphones: Smartphone,
  tablets: Smartphone, televisores: Tv, tv: Tv,
  ropa: Shirt, indumentaria: Shirt, moda: Sparkles,
  calzado: ShoppingBasket, zapatillas: ShoppingBasket,
  accesorios: Sparkles, joyería: Sparkles, joyeria: Sparkles,
  belleza: Sparkles, cosméticos: Sparkles, cosmeticos: Sparkles,
  peluquería: Scissors, peluqueria: Scissors,
  hogar: Home, muebles: Armchair, decoración: Sparkles, decoracion: Sparkles,
  jardín: Leaf, jardin: Leaf, construcción: HardHat, construccion: HardHat,
  herramientas: Wrench,
  alimentos: ShoppingBasket, comida: Utensils, bebidas: Coffee,
  supermercado: ShoppingCart, restaurante: Utensils,
  deportes: Trophy, fitness: Dumbbell, outdoor: Mountain, bicicletas: Bike,
  juguetes: Gamepad2, videojuegos: Gamepad2, música: Music, musica: Music,
  libros: BookOpen, fotografía: Camera, fotografia: Camera,
  salud: Heart, farmacia: Heart, mascotas: PawPrint,
  autos: Car, automotor: Car, motos: Bike,
  viajes: Plane, turismo: Map, servicios: Briefcase,
  oficina: Briefcase, papelería: FileText, papeleria: FileText,
  educación: GraduationCap, educacion: GraduationCap,
}

function getCategoryIcon(name: string): React.ElementType {
  const key = name.toLowerCase().trim()
  if (ICON_MAP[key]) return ICON_MAP[key]
  for (const [k, Icon] of Object.entries(ICON_MAP)) {
    if (key.includes(k) || k.includes(key)) return Icon
  }
  return Package
}

// ─── Color palette (12 themes) ────────────────────────────────────────────────
const PALETTES = [
  { glowBg: 'bg-cyan-500', iconBg: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400', pill: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300', hoverBorder: 'group-hover:border-cyan-300/60 dark:group-hover:border-cyan-700/50' },
  { glowBg: 'bg-violet-500', iconBg: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400', pill: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300', hoverBorder: 'group-hover:border-violet-300/60 dark:group-hover:border-violet-700/50' },
  { glowBg: 'bg-amber-500', iconBg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400', pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', hoverBorder: 'group-hover:border-amber-300/60 dark:group-hover:border-amber-700/50' },
  { glowBg: 'bg-emerald-500', iconBg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', hoverBorder: 'group-hover:border-emerald-300/60 dark:group-hover:border-emerald-700/50' },
  { glowBg: 'bg-rose-500', iconBg: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400', pill: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300', hoverBorder: 'group-hover:border-rose-300/60 dark:group-hover:border-rose-700/50' },
  { glowBg: 'bg-blue-500', iconBg: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400', pill: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300', hoverBorder: 'group-hover:border-blue-300/60 dark:group-hover:border-blue-700/50' },
  { glowBg: 'bg-fuchsia-500', iconBg: 'bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400', pill: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300', hoverBorder: 'group-hover:border-fuchsia-300/60 dark:group-hover:border-fuchsia-700/50' },
  { glowBg: 'bg-orange-500', iconBg: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400', pill: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300', hoverBorder: 'group-hover:border-orange-300/60 dark:group-hover:border-orange-700/50' },
  { glowBg: 'bg-teal-500', iconBg: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400', pill: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300', hoverBorder: 'group-hover:border-teal-300/60 dark:group-hover:border-teal-700/50' },
  { glowBg: 'bg-indigo-500', iconBg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400', pill: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300', hoverBorder: 'group-hover:border-indigo-300/60 dark:group-hover:border-indigo-700/50' },
  { glowBg: 'bg-pink-500', iconBg: 'bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400', pill: 'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300', hoverBorder: 'group-hover:border-pink-300/60 dark:group-hover:border-pink-700/50' },
  { glowBg: 'bg-lime-500', iconBg: 'bg-lime-500/10 text-lime-600 dark:bg-lime-500/20 dark:text-lime-400', pill: 'bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300', hoverBorder: 'group-hover:border-lime-300/60 dark:group-hover:border-lime-700/50' },
]

function getPalette(index: number) {
  return PALETTES[index % PALETTES.length]
}

export function CategoriesClient({ categories }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  // ─── Estadísticas ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalProducts = categories.reduce((sum, c) => sum + c.product_count, 0)
    // Para las organizaciones podemos calcular la media o el número máximo estimado por categorías
    const totalConnections = categories.reduce((sum, c) => sum + c.organization_count, 0)
    return {
      totalCategories: categories.length,
      totalProducts,
      totalConnections
    }
  }, [categories])

  // ─── Filtrado Reactivo ──────────────────────────────────────────────────────
  const filteredCategories = useMemo(() => {
    let result = categories

    // Filtro por tipo
    if (activeFilter === 'popular') {
      result = result.filter((cat) => cat.product_count >= 10)
    } else if (activeFilter === 'multi-org') {
      result = result.filter((cat) => cat.organization_count > 1)
    }

    // Filtro por texto
    const query = searchQuery.trim().toLowerCase()
    if (query) {
      result = result.filter((cat) => cat.name.toLowerCase().includes(query))
    }

    return result
  }, [categories, searchQuery, activeFilter])

  return (
    <div className="space-y-10">
      
      {/* ─── Fila Superior: Estadísticas Rápidas (Glassmorphic) ────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-slate-200/60 dark:divide-slate-800/60 rounded-3xl border border-slate-200/50 dark:border-slate-800/40 bg-white/50 dark:bg-slate-900/40 p-4 sm:p-6 backdrop-blur-md max-w-4xl mx-auto shadow-sm">
        <div className="text-center px-2">
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 tabular-nums">
            {stats.totalCategories}
          </p>
          <p className="mt-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Categorías
          </p>
        </div>
        <div className="text-center px-2">
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-cyan-600 dark:text-cyan-400 tabular-nums">
            {stats.totalProducts}
          </p>
          <p className="mt-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Productos Activos
          </p>
        </div>
        <div className="text-center px-2">
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-violet-600 dark:text-violet-400 tabular-nums">
            {stats.totalConnections}
          </p>
          <p className="mt-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Asociaciones
          </p>
        </div>
      </div>

      {/* ─── Controles de Búsqueda y Filtros ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl mx-auto bg-white/40 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-200/30 dark:border-slate-800/20 backdrop-blur-sm">
        
        {/* Buscador */}
        <div className="relative w-full md:max-w-xs shrink-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar categorías..."
            className="h-10 rounded-xl pl-10 pr-9 text-xs border-slate-200/60 focus-visible:ring-cyan-500 bg-white/80 dark:bg-slate-900/80 dark:border-slate-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Botones de Filtro Rápido */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                : 'bg-white/60 text-slate-600 hover:bg-white dark:bg-slate-950/40 dark:text-slate-400 dark:hover:bg-slate-950'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setActiveFilter('popular')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'popular'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-white/60 text-slate-600 hover:bg-white dark:bg-slate-950/40 dark:text-slate-400 dark:hover:bg-slate-950'
            }`}
          >
            Más Populares (+10)
          </button>
          <button
            onClick={() => setActiveFilter('multi-org')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'multi-org'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white/60 text-slate-600 hover:bg-white dark:bg-slate-950/40 dark:text-slate-400 dark:hover:bg-slate-950'
            }`}
          >
            Multi-Empresa
          </button>
        </div>
      </div>

      {/* ─── Directorio en Grid Premium ────────────────────────────────────────── */}
      {filteredCategories.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredCategories.map((cat, i) => {
            const palette = getPalette(i)
            const Icon = getCategoryIcon(cat.name)
            const href = `/marketplace/productos?categoria=${cat.id}`

            return (
              <Link
                key={cat.id}
                href={href}
                aria-label={`Explorar categoría ${cat.name}, contiene ${cat.product_count} productos de ${cat.organization_count} empresas`}
                className={[
                  "group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/50 bg-white/70 backdrop-blur-md transition-all duration-300",
                  "hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/5",
                  "dark:border-slate-800/40 dark:bg-slate-950/60 dark:hover:shadow-cyan-500/5",
                  palette.hoverBorder
                ].join(' ')}
              >
                {/* Orbe de brillo trasero */}
                <div className={`absolute -left-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-30 ${palette.glowBg}`} />

                <div className="relative flex flex-1 flex-col p-6 pb-16">
                  {/* Icon Header */}
                  <div className="flex items-center justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${palette.iconBg}`}>
                      <Icon className="h-6 w-6" strokeWidth={1.8} />
                    </div>
                    
                    <div className={`flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border border-slate-200/20 dark:border-slate-800/40 ${palette.pill}`}>
                      {cat.product_count} items
                    </div>
                  </div>

                  {/* Category Info */}
                  <div className="mt-6">
                    <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      {cat.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 opacity-60" />
                      {cat.organization_count} empresa{cat.organization_count !== 1 ? 's' : ''} asociada{cat.organization_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                {/* Botón flotante siempre visible (a11y) y con desplazamiento (hover) */}
                <div className="absolute bottom-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-850 transition-all duration-300 opacity-90 group-hover:opacity-100 group-hover:border-slate-350 dark:group-hover:border-slate-700 group-hover:translate-x-0.5 shadow-sm">
                  <ChevronRight className="h-4 w-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200" />
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200/60 bg-white/50 py-24 text-center dark:border-slate-800/40 dark:bg-slate-900/30 backdrop-blur-md max-w-xl mx-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-900 mb-5">
            <Compass className="h-8 w-8 text-slate-400 dark:text-slate-500 animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Sin categorías encontradas
          </h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400 mx-auto">
            Ninguna categoría coincide con los filtros aplicados. Intentá borrar los términos o restablecer el filtro.
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-6 flex items-center gap-1.5 rounded-xl bg-slate-950 dark:bg-white dark:text-slate-950 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Borrar filtro de búsqueda
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
