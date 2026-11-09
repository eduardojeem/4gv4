'use client'

import { createElement, useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FolderTree,
  Home,
  House,
  LayoutGrid,
  Leaf,
  Package,
  Plug,
  Search,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Speaker,
  Store,
  Trophy,
  UtensilsCrossed,
  Watch,
  Wrench,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { MarketplaceCategory } from '@/lib/public/marketplace'
import { cn } from '@/lib/utils'
import { categoryVisual, type CategoryBranchId } from '@/lib/public/category-taxonomy'
import { displayCategoryName } from '@/lib/public/display-names'

type Props = {
  categories: MarketplaceCategory[]
}

type FilterType = 'all' | 'popular' | 'multi-org'
type ViewMode = 'branches' | 'grid'

// ─── Ramas Principales de la Taxonomía ──────────────────────────────────────────
type BranchDefinition = {
  id: CategoryBranchId
  name: string
  description: string
  icon: React.ElementType
  theme: {
    iconBg: string
    badge: string
    hoverBorder: string
    glowBg: string
  }
}

const MAIN_BRANCHES: BranchDefinition[] = [
  {
    id: 'tecnologia',
    name: 'Tecnología & Electrónica',
    description: 'Celulares, computadoras, repuestos, gaming, audio y accesorios tecnológicos',
    icon: Cpu,
    theme: {
      iconBg: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
      badge: 'border-cyan-200/60 bg-cyan-50 text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/40 dark:text-cyan-300',
      hoverBorder: 'hover:border-cyan-400/60 dark:hover:border-cyan-500/60 hover:shadow-cyan-500/10',
      glowBg: 'bg-cyan-500',
    },
  },
  {
    id: 'moda',
    name: 'Moda, Ropa & Calzados',
    description: 'Indumentaria masculina, femenina, calzados, zapatillas y accesorios de vestir',
    icon: Shirt,
    theme: {
      iconBg: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
      badge: 'border-violet-200/60 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-300',
      hoverBorder: 'hover:border-violet-400/60 dark:hover:border-violet-500/60 hover:shadow-violet-500/10',
      glowBg: 'bg-violet-500',
    },
  },
  {
    id: 'hogar',
    name: 'Hogar, Muebles & Decoración',
    description: 'Mobiliario, electrodomésticos, jardín, bazar, iluminación y confort',
    icon: Home,
    theme: {
      iconBg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
      badge: 'border-amber-200/60 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300',
      hoverBorder: 'hover:border-amber-400/60 dark:hover:border-amber-500/60 hover:shadow-amber-500/10',
      glowBg: 'bg-amber-500',
    },
  },
  {
    id: 'alimentos',
    name: 'Alimentos, Bebidas & Supermercado',
    description: 'Productos de despensa, bebidas, confitería, gastronomía y almacén',
    icon: ShoppingBasket,
    theme: {
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      badge: 'border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300',
      hoverBorder: 'hover:border-emerald-400/60 dark:hover:border-emerald-500/60 hover:shadow-emerald-500/10',
      glowBg: 'bg-emerald-500',
    },
  },
  {
    id: 'ferreteria',
    name: 'Ferretería, Herramientas & Obras',
    description: 'Herramientas eléctricas y manuales, repuestos mecánicos, construcción y automotor',
    icon: Wrench,
    theme: {
      iconBg: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
      badge: 'border-orange-200/60 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-300',
      hoverBorder: 'hover:border-orange-400/60 dark:hover:border-orange-500/60 hover:shadow-orange-500/10',
      glowBg: 'bg-orange-500',
    },
  },
  {
    id: 'belleza',
    name: 'Belleza, Salud & Cosmética',
    description: 'Cuidado de la piel, perfumería, cosméticos, farmacia, estética y bienestar',
    icon: Sparkles,
    theme: {
      iconBg: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
      badge: 'border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300',
      hoverBorder: 'hover:border-rose-400/60 dark:hover:border-rose-500/60 hover:shadow-rose-500/10',
      glowBg: 'bg-rose-500',
    },
  },
  {
    id: 'deportes',
    name: 'Deportes, Ocio & Hobbies',
    description: 'Equipamiento deportivo, fitness, aire libre, bicicletas, música y juguetes',
    icon: Trophy,
    theme: {
      iconBg: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
      badge: 'border-teal-200/60 bg-teal-50 text-teal-700 dark:border-teal-900/40 dark:bg-teal-950/40 dark:text-teal-300',
      hoverBorder: 'hover:border-teal-400/60 dark:hover:border-teal-500/60 hover:shadow-teal-500/10',
      glowBg: 'bg-teal-500',
    },
  },
  {
    id: 'servicios',
    name: 'Servicios, Técnicos & Otros',
    description: 'Servicios profesionales, soporte técnico, reparaciones y otros rubros',
    icon: Briefcase,
    theme: {
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
      badge: 'border-indigo-200/60 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300',
      hoverBorder: 'hover:border-indigo-400/60 dark:hover:border-indigo-500/60 hover:shadow-indigo-500/10',
      glowBg: 'bg-indigo-500',
    },
  },
]

function classifyCategoryIntoBranch(categoryName: string): CategoryBranchId {
  return categoryVisual(categoryName).branch
}

// ─── Slides Destacados del Showcase Hero (Rubros Reales de la Plataforma) ──────
type ShowcaseSlide = {
  id: string
  eyebrow: string
  title: string
  description: string
  image: string
  searchTerm: string
  ambientGradient: string
  accentPill: string
}

const SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    id: 'belleza',
    eyebrow: 'BRILLA CON CONFIANZA',
    title: 'Belleza',
    description: 'Esenciales de piel, cabello y belleza hechos para ti.',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80&auto=format',
    searchTerm: 'belleza',
    ambientGradient: 'from-emerald-700/85 via-teal-800/60 to-emerald-950/20',
    accentPill: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  {
    id: 'servicios',
    eyebrow: 'PROFESIONALES DE CONFIANZA',
    title: 'Servicios',
    description: 'Descubre expertos locales listos para ayudarte.',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&auto=format',
    searchTerm: 'servicios',
    ambientGradient: 'from-sky-700/85 via-blue-800/60 to-slate-950/20',
    accentPill: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  {
    id: 'electronica',
    eyebrow: 'MÁS CONECTADO CADA DÍA',
    title: 'Electrónica',
    description: 'Dispositivos y tecnología para una vida conectada.',
    image: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800&q=80&auto=format',
    searchTerm: 'electronica',
    ambientGradient: 'from-purple-700/85 via-violet-800/60 to-indigo-950/20',
    accentPill: 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
  },
  {
    id: 'electrodomesticos',
    eyebrow: 'CONFORT & TECNOLOGÍA EN CASA',
    title: 'Electrodomésticos',
    description: 'Heladeras, lavarropas, climatización y cocina para tu día a día.',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80&auto=format',
    searchTerm: 'electrodomesticos',
    ambientGradient: 'from-blue-700/85 via-indigo-800/60 to-slate-950/20',
    accentPill: 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  },
  {
    id: 'muebles',
    eyebrow: 'CONFORT & DISEÑO',
    title: 'Muebles & Hogar',
    description: 'Muebles de diseño y confort para transformar tus ambientes.',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80&auto=format',
    searchTerm: 'muebles',
    ambientGradient: 'from-amber-800/85 via-stone-800/60 to-neutral-950/20',
    accentPill: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  {
    id: 'computacion',
    eyebrow: 'PRODUCTIVIDAD & EQUIPAMIENTO',
    title: 'Computación',
    description: 'Pantallas, teclados, mouse, impresoras y conectividad.',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80&auto=format',
    searchTerm: 'computacion',
    ambientGradient: 'from-indigo-700/85 via-cyan-800/60 to-slate-950/20',
    accentPill: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  {
    id: 'audio',
    eyebrow: 'SONIDO DE ALTA FIDELIDAD',
    title: 'Audio & Video',
    description: 'Auriculares, parlantes y sonido envolvente.',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80&auto=format',
    searchTerm: 'audio',
    ambientGradient: 'from-cyan-700/85 via-blue-800/60 to-slate-950/20',
    accentPill: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
  },
  {
    id: 'moda',
    eyebrow: 'TU PROPIO ESTILO',
    title: 'Moda & Relojería',
    description: 'Remeras básicas, indumentaria corporativa y relojes.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80&auto=format',
    searchTerm: 'reloj',
    ambientGradient: 'from-rose-700/85 via-pink-800/60 to-stone-950/20',
    accentPill: 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  },
]

// ─── Rubros Comerciales Reales (Eliminados rubros no existentes) ───────────────
type CanonicalRubro = {
  key: string
  name: string
  subtitle: string
  icon: React.ElementType
  iconBg: string
  branch: CategoryBranchId
  defaultSearch: string
}

const CANONICAL_RUBROS: CanonicalRubro[] = [
  {
    key: 'muebles',
    name: 'Muebles',
    subtitle: 'Muebles y decoración para ca...',
    icon: BedDouble,
    iconBg: 'bg-[#f8ede5] text-[#b36b3b] dark:bg-[#78350f]/30 dark:text-[#fde68a]',
    branch: 'hogar',
    defaultSearch: 'mueble',
  },
  {
    key: 'hogar',
    name: 'Hogar',
    subtitle: 'Esenciales para un hogar hermoso.',
    icon: House,
    iconBg: 'bg-[#ede9fe] text-[#7c3aed] dark:bg-[#5b21b6]/30 dark:text-[#ddd6fe]',
    branch: 'hogar',
    defaultSearch: 'hogar',
  },
  {
    key: 'alimentos',
    name: 'Alimentos y b...',
    subtitle: 'Alimentos, bebidas y productos diarios.',
    icon: UtensilsCrossed,
    iconBg: 'bg-[#fef3c7] text-[#d97706] dark:bg-[#78350f]/30 dark:text-[#fde68a]',
    branch: 'alimentos',
    defaultSearch: 'alimento',
  },
  {
    key: 'salud',
    name: 'Salud y biene...',
    subtitle: 'Bienestar, ejercicio y vida saludable.',
    icon: Leaf,
    iconBg: 'bg-[#dcfce7] text-[#16a34a] dark:bg-[#14532d]/30 dark:text-[#86efac]',
    branch: 'belleza',
    defaultSearch: 'salud',
  },
  {
    key: 'belleza',
    name: 'Belleza',
    subtitle: 'Perfumes, estética y cosmética.',
    icon: Sparkles,
    iconBg: 'bg-[#ffe4e6] text-[#e11d48] dark:bg-[#881337]/30 dark:text-[#fecdd3]',
    branch: 'belleza',
    defaultSearch: 'belleza',
  },
  {
    key: 'electronica',
    name: 'Electrónica',
    subtitle: 'Celulares, cargadores y accesorios.',
    icon: Smartphone,
    iconBg: 'bg-[#e0f2fe] text-[#0284c7] dark:bg-[#0c4a6e]/30 dark:text-[#bae6fd]',
    branch: 'tecnologia',
    defaultSearch: 'electronica',
  },
  {
    key: 'electrodomesticos',
    name: 'Electrodomésticos',
    subtitle: 'Heladeras, lavarropas, cocina y frío.',
    icon: Plug,
    iconBg: 'bg-[#e0e7ff] text-[#4338ca] dark:bg-[#312e81]/40 dark:text-[#c7d2fe]',
    branch: 'hogar',
    defaultSearch: 'electrodomesticos',
  },
  {
    key: 'computacion',
    name: 'Computación',
    subtitle: 'Pantallas, teclados, mouse e impresoras.',
    icon: Cpu,
    iconBg: 'bg-[#f1f5f9] text-[#0284c7] dark:bg-[#0c4a6e]/30 dark:text-[#bae6fd]',
    branch: 'tecnologia',
    defaultSearch: 'teclados',
  },
  {
    key: 'audio',
    name: 'Audio y Video',
    subtitle: 'Auriculares, parlantes y sonido.',
    icon: Speaker,
    iconBg: 'bg-[#ccfbf1] text-[#0d9488] dark:bg-[#134e4a]/30 dark:text-[#99f6e4]',
    branch: 'tecnologia',
    defaultSearch: 'audio',
  },
  {
    key: 'servicios',
    name: 'Servicios',
    subtitle: 'Reparaciones y servicio técnico.',
    icon: Briefcase,
    iconBg: 'bg-[#f1f5f9] text-[#475569] dark:bg-[#1e293b]/60 dark:text-[#cbd5e1]',
    branch: 'servicios',
    defaultSearch: 'servicio',
  },
  {
    key: 'moda',
    name: 'Moda y Ropa',
    subtitle: 'Remeras básicas e indumentaria.',
    icon: Shirt,
    iconBg: 'bg-[#f3e8ff] text-[#9333ea] dark:bg-[#701a75]/30 dark:text-[#f5d0fe]',
    branch: 'moda',
    defaultSearch: 'ropa',
  },
  {
    key: 'relojeria',
    name: 'Relojería',
    subtitle: 'Relojes de pulsera y smartwatches.',
    icon: Watch,
    iconBg: 'bg-[#fdf4ff] text-[#a21caf] dark:bg-[#701a75]/30 dark:text-[#f5d0fe]',
    branch: 'moda',
    defaultSearch: 'reloj',
  },
]

export function CategoriesClient({ categories: rawCategories }: Props) {
  // Los nombres como se muestran en todo el marketplace: «HOGAR» → «Hogar».
  const categories = useMemo(
    () => rawCategories.map((category) => ({ ...category, name: displayCategoryName(category.name) })),
    [rawCategories]
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  // Cuadricula por defecto: es la que muestra todas las categorias de una,
  // sin tener que abrir rama por rama.
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({})
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [showFiltersPanel, setShowFiltersPanel] = useState(false)
  const carouselTrackRef = useRef<HTMLDivElement>(null)

  const toggleBranch = (branchId: string) => {
    setCollapsedBranches((prev) => ({
      ...prev,
      [branchId]: !prev[branchId],
    }))
  }

  // Sincronización del slide activo en scroll
  const handleCarouselScroll = useCallback(() => {
    const el = carouselTrackRef.current
    if (!el) return
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 300
    const scrollIndex = Math.round(el.scrollLeft / cardWidth)
    const clamped = Math.max(0, Math.min(SHOWCASE_SLIDES.length - 1, scrollIndex))
    setActiveSlideIndex(clamped)
  }, [])

  useEffect(() => {
    const el = carouselTrackRef.current
    if (!el) return
    el.addEventListener('scroll', handleCarouselScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleCarouselScroll)
  }, [handleCarouselScroll])

  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = carouselTrackRef.current
    if (!el) return
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 320
    const nextIndex = direction === 'right' ? Math.min(SHOWCASE_SLIDES.length - 1, activeSlideIndex + 1) : Math.max(0, activeSlideIndex - 1)
    el.scrollTo({ left: nextIndex * cardWidth, behavior: 'smooth' })
    setActiveSlideIndex(nextIndex)
  }

  // Filtrado de categorías existentes en base de datos
  const filteredCategories = useMemo(() => {
    let result = [...categories]

    if (activeFilter === 'popular') {
      result = result.filter((cat) => cat.product_count >= 5)
    } else if (activeFilter === 'multi-org') {
      result = result.filter((cat) => cat.organization_count > 1)
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      result = result.filter((cat) => cat.name.toLowerCase().includes(query))
    }

    return result
  }, [categories, searchQuery, activeFilter])

  // Unión con rubros canónicos reales de la plataforma
  const displayRubros = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return CANONICAL_RUBROS.filter((rubro) => {
      if (activeFilter === 'popular') return true
      if (activeFilter === 'multi-org') return true
      if (!query) return true
      return (
        rubro.name.toLowerCase().includes(query) ||
        rubro.subtitle.toLowerCase().includes(query) ||
        rubro.defaultSearch.toLowerCase().includes(query)
      )
    }).map((rubro) => {
      // Buscar si existe una categoría real en Supabase que coincida
      const matchedCat = categories.find((c) => {
        const cName = c.name.toLowerCase()
        return (
          cName === rubro.name.toLowerCase() ||
          cName.includes(rubro.defaultSearch) ||
          rubro.name.toLowerCase().includes(cName)
        )
      })

      const href = matchedCat
        ? `/marketplace/productos?categoria=${matchedCat.id}`
        : `/marketplace/productos?q=${encodeURIComponent(rubro.defaultSearch)}`

      const productCount = matchedCat ? matchedCat.product_count : undefined
      const orgCount = matchedCat ? matchedCat.organization_count : undefined

      return {
        ...rubro,
        href,
        productCount,
        orgCount,
        matchedCatId: matchedCat?.id,
      }
    })
  }, [categories, searchQuery, activeFilter])

  // Agrupación de categorías por Ramas (Hierarchy Tree)
  const branchGroups = useMemo(() => {
    const map = new Map<string, { branch: BranchDefinition; categories: MarketplaceCategory[]; totalProducts: number; totalOrgs: Set<string> }>()

    MAIN_BRANCHES.forEach((b) => {
      map.set(b.id, {
        branch: b,
        categories: [],
        totalProducts: 0,
        totalOrgs: new Set(),
      })
    })

    filteredCategories.forEach((cat) => {
      const branchId = classifyCategoryIntoBranch(cat.name)
      const group = map.get(branchId) ?? map.get('servicios')!
      group.categories.push(cat)
      group.totalProducts += cat.product_count
      group.totalOrgs.add(String(cat.organization_count))
    })

    // Retorna sólo ramas que tienen categorías o si no hay búsqueda
    return Array.from(map.values()).filter((g) => g.categories.length > 0)
  }, [filteredCategories])

  const activeSlide = SHOWCASE_SLIDES[activeSlideIndex] ?? SHOWCASE_SLIDES[0]

  return (
    <div className="space-y-8">
      {/* ── SHOWCASE HERO SECTION CON FONDO DINÁMICO & CARRUSEL (EXACTO FOTOS) ── */}
      <section className={cn(
        'relative -mx-4 -mt-10 overflow-hidden sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-6 pb-8 transition-all duration-700',
        'bg-gradient-to-b',
        activeSlide.ambientGradient
      )}>
        {/* Glows ambientales sutiles */}
        <div className="pointer-events-none absolute -left-16 -top-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-1/4 h-80 w-80 rounded-full bg-black/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          {/* Top Bar: < SHOWCASE y Botones de Acción */}
          <div className="mb-4 flex items-center justify-between">
            <Link
              href="/marketplace"
              className="group inline-flex items-center gap-1.5 text-white/95 hover:text-white transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-md border border-white/20 shadow-xs group-hover:bg-white/25 transition-all">
                <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
              </div>
              <span className="text-lg sm:text-xl font-black tracking-wider uppercase drop-shadow-xs">
                SHOWCASE
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/marketplace/productos"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white shadow-xs hover:bg-white/25 transition-all"
                title="Ver productos"
              >
                <ShoppingBag className="h-4 w-4" />
              </Link>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setShowFiltersPanel((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white shadow-xs hover:bg-white/25 transition-all"
                title="Filtros"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Barra de Búsqueda Flotante tipo Cápsula Blanca (Foto) */}
          <div className="relative mb-6">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar categorías..."
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
                aria-label="Alternar filtros"
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/95 dark:bg-card/95 shadow-md backdrop-blur-md transition-all',
                  showFiltersPanel
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
                    onClick={() => setActiveFilter('all')}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                      activeFilter === 'all'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-muted dark:text-muted-foreground'
                    )}
                  >
                    Todas ({categories.length || displayRubros.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('popular')}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                      activeFilter === 'popular'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-muted dark:text-muted-foreground'
                    )}
                  >
                    Más populares
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('multi-org')}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                      activeFilter === 'multi-org'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-muted dark:text-muted-foreground'
                    )}
                  >
                    Multi-tienda
                  </button>
                </div>

                {/* Switch de Modo de Vista */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all',
                      viewMode === 'grid'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-muted-foreground'
                    )}
                    title="Vista en cuadrícula"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Cuadrícula</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('branches')}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all',
                      viewMode === 'branches'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-muted-foreground'
                    )}
                    title="Vista jerárquica por ramas"
                  >
                    <FolderTree className="h-3.5 w-3.5" />
                    <span>Por Ramas</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Carrusel de Tarjetas Gigantes Destacadas (Swipeable Cards) */}
          <div className="relative">
            {/* Controles de flecha desktop */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => scrollCarousel('left')}
              disabled={activeSlideIndex === 0}
              aria-label="Slide anterior"
              className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl backdrop-blur-md hover:bg-white disabled:opacity-0 transition-all"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => scrollCarousel('right')}
              disabled={activeSlideIndex === SHOWCASE_SLIDES.length - 1}
              aria-label="Siguiente slide"
              className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl backdrop-blur-md hover:bg-white disabled:opacity-0 transition-all"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Pista de tarjetas */}
            <div
              ref={carouselTrackRef}
              className="flex gap-4 overflow-x-auto pb-4 pt-1 scroll-smooth scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {SHOWCASE_SLIDES.map((slide, idx) => {
                const isActive = idx === activeSlideIndex

                return (
                  <div
                    key={slide.id}
                    className={cn(
                      'relative shrink-0 overflow-hidden rounded-[28px] sm:rounded-[32px] shadow-2xl transition-all duration-300',
                      'w-[82vw] max-w-[340px] sm:w-[360px] md:w-[390px]',
                      'h-[380px] sm:h-[420px]',
                      isActive ? 'scale-100 ring-2 ring-white/40' : 'scale-[0.97] opacity-90'
                    )}
                    style={{ scrollSnapAlign: 'center' }}
                  >
                    {/* Imagen de Fondo de Alta Calidad */}
                    <Image
                      src={slide.image}
                      alt={slide.title}
                      fill
                      sizes="(max-width: 768px) 85vw, 420px"
                      className="object-cover transition-transform duration-700 hover:scale-105"
                      priority={idx < 2}
                    />

                    {/* Gradientes Oscuros Superior e Inferior para Legibilidad Cristalina */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/85" />

                    {/* Contenido Superior: Eyebrow + Título + Descripción */}
                    <div className="absolute left-0 right-0 top-0 p-5 sm:p-6 text-white">
                      <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-white/90 drop-shadow-sm">
                        {slide.eyebrow}
                      </span>
                      <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
                        {slide.title}
                      </h2>
                      <p className="mt-1.5 text-xs sm:text-sm text-white/90 font-medium leading-relaxed max-w-[270px] drop-shadow-sm">
                        {slide.description}
                      </p>
                    </div>

                    {/* Botón Cápsula "Explorar ahora" con Flecha Circular (Foto) */}
                    <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5">
                      <Link
                        href={`/marketplace/productos?q=${encodeURIComponent(slide.searchTerm)}`}
                        className="group/btn flex items-center justify-between rounded-full bg-white/95 dark:bg-card/95 py-2.5 px-4 sm:py-3 sm:px-5 text-slate-900 dark:text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-white"
                      >
                        <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                          Explorar ahora
                        </span>
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition-transform group-hover/btn:translate-x-1 shadow-sm">
                          <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
                        </div>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Indicador de Bolitas de Slides */}
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {SHOWCASE_SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  suppressHydrationWarning
                  onClick={() => {
                    const el = carouselTrackRef.current
                    if (!el) return
                    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 320
                    el.scrollTo({ left: i * cardWidth, behavior: 'smooth' })
                    setActiveSlideIndex(i)
                  }}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === activeSlideIndex
                      ? 'w-6 bg-white shadow-xs'
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN "VER TODO" CON BADGE "12 CATEGORÍAS" (EXACTO FOTO) ── */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Ver todo
          </h2>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 font-extrabold px-3.5 py-1 text-xs sm:text-sm shadow-xs border border-purple-200/50 dark:border-purple-800/40">
              {displayRubros.length} categorías
            </span>
          </div>
        </div>

        {/* ── VISTA 1: CUADRÍCULA DIRECTA (GRID VIEW - EXACTA A LA FOTO) ── */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {displayRubros.map((rubro) => {
              const Icon = rubro.icon

              return (
                <Link
                  key={rubro.key}
                  href={rubro.href}
                  className={cn(
                    'group relative flex items-center justify-between gap-2.5 rounded-[22px] border border-border/70 bg-card p-3 sm:p-4 transition-all duration-200',
                    'hover:-translate-y-0.5 hover:shadow-md hover:border-purple-300/80 dark:hover:border-purple-700/80 shadow-xs'
                  )}
                >
                  {/* Ícono de Color Pastel Cuadrado Redondeado (Foto) */}
                  <div className={cn(
                    'flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl shadow-xs transition-transform group-hover:scale-105',
                    rubro.iconBg
                  )}>
                    <Icon className="h-6 w-6 stroke-[2]" />
                  </div>

                  {/* Nombre y Subtítulo */}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xs sm:text-sm font-bold tracking-tight text-foreground group-hover:text-purple-600 transition-colors">
                      {rubro.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[10px] sm:text-xs text-muted-foreground">
                      {rubro.subtitle}
                    </p>
                  </div>

                  {/* Botón Flecha Arriba-Derecha ↗ Color Lavanda (Foto) */}
                  <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs">
                    <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* ── VISTA 2: POR RAMAS / JERARQUÍA (TREE BRANCHES) ── */}
        {viewMode === 'branches' && branchGroups.length > 0 && (
          <div className="space-y-6">
            {branchGroups.map(({ branch, categories: subCats, totalProducts }) => {
              const Icon = branch.icon
              const isCollapsed = Boolean(collapsedBranches[branch.id])

              return (
                <div
                  key={branch.id}
                  className={cn(
                    'overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs transition-all duration-200',
                    branch.theme.hoverBorder
                  )}
                >
                  {/* Cabecera de la Rama Principal */}
                  <div
                    onClick={() => toggleBranch(branch.id)}
                    className="flex cursor-pointer items-center justify-between gap-4 p-5 transition-colors hover:bg-muted/20 select-none"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 shadow-xs',
                        branch.theme.iconBg
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold tracking-tight text-foreground">
                            {branch.name}
                          </h2>
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                            branch.theme.badge
                          )}>
                            {subCats.length} {subCats.length === 1 ? 'categoría' : 'subcategorías'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate hidden sm:block">
                          {branch.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        {totalProducts} productos
                      </span>
                      <button
                        type="button"
                        aria-label={isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:text-foreground transition-transform"
                      >
                        <ChevronDown className={cn(
                          'h-4 w-4 transition-transform duration-200',
                          isCollapsed ? '-rotate-90' : 'rotate-0'
                        )} />
                      </button>
                    </div>
                  </div>

                  {/* Sub-ramas / Subcategorías (Contenido Desplegable) */}
                  {!isCollapsed && (
                    <div className="border-t border-border/60 bg-muted/10 p-5">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
                        {subCats.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/marketplace/productos?categoria=${sub.id}`}
                            className="group flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-background p-3.5 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/[0.03] hover:shadow-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {createElement(categoryVisual(sub.name).icon, { className: 'h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary', 'aria-hidden': true })}
                              <span className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                                {sub.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {sub.product_count}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Categorías de Catálogo Adicionales (si hay más categorías específicas) ── */}
        {viewMode === 'grid' && filteredCategories.length > 0 && (
          <div className="mt-8 border-t border-border/80 pt-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                Todas las subcategorías catalogadas
              </h3>
              <span className="text-xs text-muted-foreground">
                {filteredCategories.length} subcategorías
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredCategories.map((cat) => {
                const branchId = classifyCategoryIntoBranch(cat.name)
                const branch = MAIN_BRANCHES.find((b) => b.id === branchId) ?? MAIN_BRANCHES[0]
                const href = `/marketplace/productos?categoria=${cat.id}`

                return (
                  <Link
                    key={cat.id}
                    href={href}
                    className={cn(
                      'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-all duration-200',
                      'hover:-translate-y-0.5 hover:shadow-md',
                      branch.theme.hoverBorder
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105',
                          branch.theme.iconBg
                        )}>
                          {createElement(categoryVisual(cat.name).icon, { className: 'h-5 w-5', 'aria-hidden': true })}
                        </div>

                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                          branch.theme.badge
                        )}>
                          {cat.product_count}
                        </span>
                      </div>

                      <div className="mt-3">
                        <h4 className="text-xs sm:text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-primary truncate">
                          {cat.name}
                        </h4>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 text-[10px]">
                        <Store className="h-3 w-3 opacity-70" />
                        {cat.organization_count} {cat.organization_count === 1 ? 'tienda' : 'tiendas'}
                      </span>

                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                        Ver
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Estado Vacío si la búsqueda no arroja nada ── */}
        {displayRubros.length === 0 && filteredCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card shadow-sm max-w-lg mx-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              No se encontraron categorías
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground max-w-xs leading-relaxed">
              No hay categorías que coincidan con &ldquo;{searchQuery}&rdquo;. Probá con otro término o restablecé los filtros.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setActiveFilter('all')
              }}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              Ver todas las categorías
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
