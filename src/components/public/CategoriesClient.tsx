'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Boxes,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Coffee,
  Cpu,
  Dumbbell,
  FileText,
  FolderTree,
  Gamepad2,
  GraduationCap,
  HardHat,
  Heart,
  Home,
  Laptop,
  Layers,
  LayoutGrid,
  Leaf,
  MapPin,
  Monitor,
  Music,
  Package,
  PawPrint,
  Plane,
  Scissors,
  Search,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  Trophy,
  Tv,
  Utensils,
  Wrench,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { MarketplaceCategory } from '@/lib/public/marketplace'
import { cn } from '@/lib/utils'

type Props = {
  categories: MarketplaceCategory[]
}

type FilterType = 'all' | 'popular' | 'multi-org'
type ViewMode = 'branches' | 'grid'

// ─── Estructura de Ramas Principales de la Taxonomía ─────────────────────────────
type BranchDefinition = {
  id: string
  name: string
  description: string
  icon: React.ElementType
  keywords: string[]
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
    keywords: ['electrónica', 'electronica', 'tecnología', 'tecnologia', 'computación', 'computacion', 'computadoras', 'celulares', 'smartphone', 'tablets', 'tv', 'televisores', 'repuestos', 'audio', 'video', 'redes', 'impresoras', 'gaming', 'almacenamiento', 'accesorios', 'pantallas', 'baterias', 'cargadores', 'discos', 'pendrives'],
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
    keywords: ['ropa', 'indumentaria', 'moda', 'calzado', 'zapatillas', 'zapatos', 'vestidos', 'remeras', 'pantalones', 'camisas', 'joyería', 'joyeria', 'relojes', 'bolsos', 'carteras', 'moda'],
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
    keywords: ['hogar', 'muebles', 'decoración', 'decoracion', 'jardín', 'jardin', 'bazar', 'cocina', 'electrodomésticos', 'electrodomesticos', 'colchones', 'living', 'comedor', 'iluminación', 'iluminacion'],
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
    keywords: ['alimentos', 'comida', 'bebidas', 'supermercado', 'restaurante', 'café', 'cafe', 'golosinas', 'vinos', 'cervezas', 'lácteos', 'lacteos', 'carnes', 'panadería', 'panaderia', 'gourmet', 'despensa'],
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
    keywords: ['herramientas', 'ferretería', 'ferreteria', 'construcción', 'construccion', 'pinturas', 'repuestos', 'automotor', 'autos', 'motos', 'plomería', 'plomeria', 'electricidad', 'tornillos', 'materiales'],
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
    description: 'Cuidado de la piel, perfumería, cosméticos, farmacia, estética y mascotas',
    icon: Sparkles,
    keywords: ['belleza', 'cosméticos', 'cosmeticos', 'perfumería', 'perfumeria', 'peluquería', 'peluqueria', 'salud', 'farmacia', 'cuidado', 'skincare', 'maquillaje', 'mascotas', 'veterinaria'],
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
    keywords: ['deportes', 'fitness', 'gimnasio', 'pesas', 'bicicletas', 'outdoor', 'camping', 'pesca', 'juguetes', 'videojuegos', 'música', 'musica', 'instrumentos', 'libros', 'fotografía', 'fotografia'],
    theme: {
      iconBg: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
      badge: 'border-teal-200/60 bg-teal-50 text-teal-700 dark:border-teal-900/40 dark:bg-teal-950/40 dark:text-teal-300',
      hoverBorder: 'hover:border-teal-400/60 dark:hover:border-teal-500/60 hover:shadow-teal-500/10',
      glowBg: 'bg-teal-500',
    },
  },
  {
    id: 'servicios',
    name: 'Servicios, Librería & Otros',
    description: 'Papelería comercial, insumos de oficina, servicios profesionales y otros rubros',
    icon: Briefcase,
    keywords: ['servicios', 'oficina', 'papelería', 'papeleria', 'librería', 'libreria', 'educación', 'educacion', 'impresiones', 'capacitacion', 'varios', 'otros', 'insumos'],
    theme: {
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
      badge: 'border-indigo-200/60 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300',
      hoverBorder: 'hover:border-indigo-400/60 dark:hover:border-indigo-500/60 hover:shadow-indigo-500/10',
      glowBg: 'bg-indigo-500',
    },
  },
]

function classifyCategoryIntoBranch(categoryName: string): string {
  const normalized = categoryName.toLowerCase().trim()

  for (const branch of MAIN_BRANCHES) {
    for (const kw of branch.keywords) {
      if (normalized.includes(kw) || kw.includes(normalized)) {
        return branch.id
      }
    }
  }

  return 'servicios' // Default branch
}

export function CategoriesClient({ categories }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('branches')
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({})

  const toggleBranch = (branchId: string) => {
    setCollapsedBranches((prev) => ({
      ...prev,
      [branchId]: !prev[branchId],
    }))
  }

  // Filtrado de categorías
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

  const totalProductsCount = useMemo(() => {
    return categories.reduce((acc, c) => acc + c.product_count, 0)
  }, [categories])

  return (
    <div className="space-y-8">
      {/* ── Panel Superior de Control y Filtros ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Buscador de Categorías */}
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre de categoría..."
            className="h-10 rounded-xl pl-10 pr-9 text-xs sm:text-sm bg-background border-border/80 focus-visible:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filtros y Modo de Vista (Ramas vs Cuadrícula) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filtro por Popularidad */}
          <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Todas ({categories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('popular')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeFilter === 'popular'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Más populares
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('multi-org')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                activeFilter === 'multi-org'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Multi-tienda
            </button>
          </div>

          {/* Toggle de Vista: Ramas vs Cuadrícula */}
          <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/40">
            <button
              type="button"
              onClick={() => setViewMode('branches')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
                viewMode === 'branches'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Vista jerárquica por ramas"
            >
              <FolderTree className="h-3.5 w-3.5" />
              <span>Por Ramas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Vista en cuadrícula"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cuadrícula</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub-header: Conteo de resultados ── */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          Mostrando <strong className="text-foreground font-semibold">{filteredCategories.length}</strong> categorías
          {viewMode === 'branches' ? ` en ${branchGroups.length} ramas principales` : ''}
          {searchQuery ? ` para "${searchQuery}"` : ''}
        </span>
        <Link
          href="/marketplace/productos"
          className="flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Ver todos los productos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── VISTA 1: POR RAMAS / JERARQUÍA (TREE BRANCHES) ── */}
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
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {subCats.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/marketplace/productos?categoria=${sub.id}`}
                          className="group flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-background p-3.5 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/[0.03] hover:shadow-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-2 w-2 rounded-full bg-primary/60 group-hover:bg-primary group-hover:scale-125 transition-all" />
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

      {/* ── VISTA 2: CUADRÍCULA DIRECTA (GRID VIEW) ── */}
      {viewMode === 'grid' && filteredCategories.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredCategories.map((cat, i) => {
            const branchId = classifyCategoryIntoBranch(cat.name)
            const branch = MAIN_BRANCHES.find((b) => b.id === branchId) ?? MAIN_BRANCHES[0]
            const Icon = branch.icon
            const href = `/marketplace/productos?categoria=${cat.id}`

            return (
              <Link
                key={cat.id}
                href={href}
                className={cn(
                  'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-5 transition-all duration-200',
                  'hover:-translate-y-1 hover:shadow-lg',
                  branch.theme.hoverBorder
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105',
                      branch.theme.iconBg
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
                      branch.theme.badge
                    )}>
                      {cat.product_count} {cat.product_count === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-base font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {cat.name}
                    </h3>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Store className="h-3.5 w-3.5 opacity-70" />
                    {cat.organization_count} {cat.organization_count === 1 ? 'tienda' : 'tiendas'}
                  </span>

                  <span className="flex items-center gap-1 text-[11px] font-semibold text-primary opacity-90 transition-transform group-hover:translate-x-1">
                    Explorar
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Estado Vacío ── */}
      {filteredCategories.length === 0 && (
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
    </div>
  )
}
