import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Grid3X3, Store, Package, ShoppingCart, ShoppingBasket, Utensils, Coffee, Dumbbell, Mountain, Bike, Gamepad2, Music, BookOpen, Camera, Heart, PawPrint, Car, Plane, Map, Briefcase, FileText, GraduationCap, Shirt, Sparkles, Scissors, Armchair, Home, Leaf, HardHat, Wrench, Cpu, Monitor, Laptop, Smartphone, Tv } from 'lucide-react'
import { getMarketplaceCategories, getMarketplaceBrands } from '@/lib/public/marketplace'
import { MarketplaceBrandsSection } from '@/components/public/MarketplaceBrandsSection'

export const metadata: Metadata = {
  title: 'Categorías | Marketplace MiPOS',
  description: 'Explora todos los productos del marketplace por categoría.',
}

export const dynamic = 'force-dynamic'

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

// Fallback trophy si no se importa, uso Sparkles o algo genérico
function Trophy(props: any) { return <Sparkles {...props} /> }

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
  { bg: 'from-cyan-50 to-cyan-100/80', dark: 'dark:from-cyan-950/40 dark:to-cyan-900/30', border: 'border-cyan-200/70 dark:border-cyan-800/50', icon: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', pill: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300', hoverGlow: 'hover:shadow-cyan-500/20' },
  { bg: 'from-violet-50 to-violet-100/80', dark: 'dark:from-violet-950/40 dark:to-violet-900/30', border: 'border-violet-200/70 dark:border-violet-800/50', icon: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300', hoverGlow: 'hover:shadow-violet-500/20' },
  { bg: 'from-amber-50 to-amber-100/80', dark: 'dark:from-amber-950/40 dark:to-amber-900/30', border: 'border-amber-200/70 dark:border-amber-800/50', icon: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', hoverGlow: 'hover:shadow-amber-500/20' },
  { bg: 'from-emerald-50 to-emerald-100/80', dark: 'dark:from-emerald-950/40 dark:to-emerald-900/30', border: 'border-emerald-200/70 dark:border-emerald-800/50', icon: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', hoverGlow: 'hover:shadow-emerald-500/20' },
  { bg: 'from-rose-50 to-rose-100/80', dark: 'dark:from-rose-950/40 dark:to-rose-900/30', border: 'border-rose-200/70 dark:border-rose-800/50', icon: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300', hoverGlow: 'hover:shadow-rose-500/20' },
  { bg: 'from-blue-50 to-blue-100/80', dark: 'dark:from-blue-950/40 dark:to-blue-900/30', border: 'border-blue-200/70 dark:border-blue-800/50', icon: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', hoverGlow: 'hover:shadow-blue-500/20' },
  { bg: 'from-fuchsia-50 to-fuchsia-100/80', dark: 'dark:from-fuchsia-950/40 dark:to-fuchsia-900/30', border: 'border-fuchsia-200/70 dark:border-fuchsia-800/50', icon: 'bg-fuchsia-500', text: 'text-fuchsia-700 dark:text-fuchsia-300', pill: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/50 dark:text-fuchsia-300', hoverGlow: 'hover:shadow-fuchsia-500/20' },
  { bg: 'from-orange-50 to-orange-100/80', dark: 'dark:from-orange-950/40 dark:to-orange-900/30', border: 'border-orange-200/70 dark:border-orange-800/50', icon: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', pill: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', hoverGlow: 'hover:shadow-orange-500/20' },
  { bg: 'from-teal-50 to-teal-100/80', dark: 'dark:from-teal-950/40 dark:to-teal-900/30', border: 'border-teal-200/70 dark:border-teal-800/50', icon: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', pill: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300', hoverGlow: 'hover:shadow-teal-500/20' },
  { bg: 'from-indigo-50 to-indigo-100/80', dark: 'dark:from-indigo-950/40 dark:to-indigo-900/30', border: 'border-indigo-200/70 dark:border-indigo-800/50', icon: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-300', pill: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300', hoverGlow: 'hover:shadow-indigo-500/20' },
  { bg: 'from-pink-50 to-pink-100/80', dark: 'dark:from-pink-950/40 dark:to-pink-900/30', border: 'border-pink-200/70 dark:border-pink-800/50', icon: 'bg-pink-500', text: 'text-pink-700 dark:text-pink-300', pill: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300', hoverGlow: 'hover:shadow-pink-500/20' },
  { bg: 'from-lime-50 to-lime-100/80', dark: 'dark:from-lime-950/40 dark:to-lime-900/30', border: 'border-lime-200/70 dark:border-lime-800/50', icon: 'bg-lime-500', text: 'text-lime-700 dark:text-lime-300', pill: 'bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300', hoverGlow: 'hover:shadow-lime-500/20' },
]

function getPalette(index: number) {
  return PALETTES[index % PALETTES.length]
}

export default async function MarketplaceCategoriesPage() {
  const [categories, brands] = await Promise.all([
    getMarketplaceCategories(),
    getMarketplaceBrands(48),
  ])

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── Header ── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(6,182,212,0.07),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/marketplace" className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              <Store className="h-3 w-3" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-slate-700 dark:text-slate-200">Directorio de Categorías</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                <Grid3X3 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Explorar Categorías
                </h1>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                  {categories.length} categoría{categories.length !== 1 ? 's' : ''} disponibles con miles de productos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grid Directory ── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {categories.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat, i) => {
              const palette = getPalette(i)
              const Icon = getCategoryIcon(cat.name)
              const href = `/marketplace/productos?categoria=${cat.id}`

              return (
                <Link
                  key={cat.id}
                  href={href}
                  className={[
                    "group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300",
                    "hover:-translate-y-1 hover:shadow-xl",
                    palette.hoverGlow,
                    palette.bg,
                    palette.dark,
                    palette.border
                  ].join(' ')}
                >
                  <div className="flex flex-1 flex-col p-6">
                    {/* Icon Header */}
                    <div className="flex items-center justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-300 group-hover:scale-110 ${palette.icon}`}>
                        <Icon className="h-6 w-6" strokeWidth={1.8} />
                      </div>
                      
                      <div className={`flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${palette.pill}`}>
                        {cat.product_count} items
                      </div>
                    </div>

                    {/* Category Info */}
                    <div className="mt-6">
                      <h3 className={`text-lg font-bold tracking-tight transition-colors group-hover:text-slate-900 dark:group-hover:text-white ${palette.text}`}>
                        {cat.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {cat.organization_count} empresa{cat.organization_count !== 1 ? 's' : ''} asociada{cat.organization_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  {/* Bottom fade visual effect */}
                  <div className="absolute bottom-0 right-0 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <ChevronRight className={`h-5 w-5 ${palette.text}`} />
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-24 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <Grid3X3 className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Sin categorías aún</h3>
            <p className="mt-2 max-w-sm text-base text-slate-500 dark:text-slate-400">
              Las categorías aparecerán automáticamente aquí cuando las empresas comiencen a publicar sus productos.
            </p>
          </div>
        )}
      </section>

      {/* ── Sección de Marcas ── */}
      {brands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mb-8 border-t border-slate-200 pt-12 dark:border-slate-800" />
          <MarketplaceBrandsSection
            brands={brands}
            variant="grid"
            title="Explorar por Marca"
            subtitle="Buscá productos de tus marcas favoritas"
            showViewAll={false}
          />
        </section>
      )}
    </main>
  )
}
