'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Truck,
  Wrench,
  Hammer,
  ShoppingBag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'


// Filtros por rubro comercial
const CATEGORY_FILTERS = [
  { id: 'all', label: 'Todos los Negocios', icon: Store },
  { id: 'tecnologia', label: 'Tecnología & Talleres', icon: Smartphone },
  { id: 'ferreteria', label: 'Ferreterías & Repuestos', icon: Hammer },
  { id: 'indumentaria', label: 'Moda & Retail', icon: ShoppingBag },
  { id: 'automotor', label: 'Automotor & Repuestos', icon: Truck },
]

// Beneficios directos de adherir el negocio
const ADHERED_PERKS = [
  {
    icon: Sparkles,
    title: 'Catálogo Web Automático',
    desc: 'Tu propio enlace público con fotos, precios y botón directo a WhatsApp.',
  },
  {
    icon: ShieldCheck,
    title: 'Operación 100% Blindada',
    desc: 'Caja sin diferencias, arqueos ciegos y control de stock en tiempo real.',
  },
  {
    icon: Star,
    title: 'Visibilidad en el Marketplace',
    desc: 'Miles de clientes locales descubren tu tienda y consultan tus productos.',
  },
]

// Animaciones de Framer Motion
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.45, delay },
})

interface Props {
  initialOrganizations?: MarketplaceOrganization[]
}

export function SaaSBusinessPageContent({ initialOrganizations = [] }: Props) {
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Solo negocios reales.
  //
  // Antes, si habia menos de cuatro adheridos, la lista se completaba con
  // `DEMO_PREMIER_STORES`: seis comercios inventados, con calificaciones,
  // cantidades de productos, ciudades y direcciones inventadas, y sin ninguna
  // marca que los distinguiera de los reales. La pagina se titula «Negocios y
  // Comercios Adheridos», asi que los presentaba como clientes de la
  // plataforma. Ademas su boton «Visitar Tienda Online» llevaba a
  // /megatech/inicio, que no existe.
  const combinedStores = initialOrganizations

  // Filtrado reactivo en memoria para máxima velocidad
  const filteredStores = combinedStores.filter((store) => {
    const matchesFilter =
      selectedFilter === 'all' ||
      (store.rubro || '').toLowerCase().includes(selectedFilter) ||
      (store.business_vertical || '').toLowerCase().includes(selectedFilter)

    const matchesSearch =
      !searchQuery.trim() ||
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.slogan || '').toLowerCase().includes(searchQuery.toLowerCase())

    return matchesFilter && matchesSearch
  })

  // Lista para el marquee continuo (carrusel animado moderno)
  const marqueeStores = [...combinedStores, ...combinedStores]

  return (
    <div className="overflow-hidden">
      {/* ── HERO COMPACTO Y PUBLICITARIO ────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white py-14 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(6,182,212,0.18),transparent)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            {...fadeUp(0)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-600/30 bg-cyan-100/70 dark:border-cyan-500/40 dark:bg-cyan-950/40 px-4 py-1.5 text-xs font-semibold text-cyan-800 dark:text-cyan-300 shadow-xs backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Comercios & Talleres Adheridos</span>
          </motion.div>

          <motion.h1
            {...fadeUp(0.1)}
            className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl max-w-4xl mx-auto leading-tight text-slate-950 dark:text-white"
          >
            Negocios que crecen con{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 dark:from-cyan-400 dark:via-teal-300 dark:to-blue-500 bg-clip-text text-transparent">
              nuestra plataforma
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.2)}
            className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl mx-auto"
          >
            Descubrí las tiendas, importadoras y talleres técnicos que profesionalizaron su atención al cliente, optimizaron su stock y publican su catálogo con nosotros.
          </motion.p>

          <motion.div
            {...fadeUp(0.3)}
            className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
          >
            <Button
              asChild
              size="lg"
              className="h-12 px-7 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 dark:from-cyan-500 dark:to-blue-600 dark:hover:from-cyan-400 dark:hover:to-blue-500 text-white dark:text-slate-950 font-bold shadow-lg shadow-cyan-600/20 dark:shadow-cyan-500/25 rounded-xl text-sm"
            >
              <Link href="/register">
                Publicar y Digitalizar Mi Negocio
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 px-6 border-slate-300 bg-white hover:bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-800 dark:text-slate-200 font-semibold rounded-xl text-sm"
            >
              <Link href="/marketplace/empresas">
                Explorar Directorio Completo
              </Link>
            </Button>
          </motion.div>

          {/* 3 Ventajas Rápidas de estar adherido */}
          <motion.div
            {...fadeUp(0.4)}
            className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-200 dark:border-slate-800/80 pt-8 text-left"
          >
            {ADHERED_PERKS.map((perk, i) => {
              const Icon = perk.icon
              return (
                <div
                  key={i}
                  className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40 p-4 shadow-xs"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/40">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {perk.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-snug">
                      {perk.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ── CINTA MARQUEE ANIMADA (LOGO STRIP EN MOVIMIENTO) ────────────────── */}
      {combinedStores.length > 0 && (
      <section className="relative border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50 py-5 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white dark:from-slate-950" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white dark:from-slate-950" />

        <div className="flex w-max gap-4 animate-marquee-left hover:[animation-play-state:paused]">
          {marqueeStores.map((store, idx) => (
            <Link
              key={`${store.slug}-${idx}`}
              href={`/${store.slug}/inicio`}
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 shadow-2xs transition-all hover:border-cyan-500/50 hover:bg-cyan-50/40 hover:scale-[1.02] dark:border-slate-800 dark:bg-slate-950/80 dark:hover:border-cyan-500/40"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 font-bold text-xs text-white shadow-xs">
                {store.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  {store.name}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <MapPin className="h-2.5 w-2.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{store.city || 'Paraguay'}</span>
                  {(store.review_count ?? 0) > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        {Number(store.review_rating_avg ?? 0).toFixed(1)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      )}

      {/* ── SHOWCASE MODERNO DE TIENDAS ADHERIDAS ──────────────────────────── */}
      <section className="py-14 sm:py-20 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header de la vitrina */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-200 dark:border-slate-800">
            <div>
              <Badge variant="outline" className="text-xs font-bold text-cyan-700 dark:text-cyan-400 border-cyan-600/30 dark:border-cyan-500/30 px-3 py-1 bg-cyan-50 dark:bg-cyan-950/30">
                Red de Comercios Adheridos
              </Badge>
              <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Conocé las tiendas que ya operan en vivo
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                Ingresá directamente al catálogo digital de cada comercio para ver sus productos y atención al cliente.
              </p>
            </div>

            {/* Buscador Rápido */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar tienda o ciudad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 shadow-2xs outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Filtros Pills */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {CATEGORY_FILTERS.map((cat) => {
              const Icon = cat.icon
              const isSelected = selectedFilter === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedFilter(cat.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-cyan-600 text-white shadow-sm dark:bg-cyan-500 dark:text-slate-950'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>

          {/* Grid Dinámica de Tarjetas de Tiendas */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredStores.map((store) => (
                <motion.div
                  key={store.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Glow decorativo de tarjeta */}
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl transition-all group-hover:bg-cyan-500/20" />

                  <div>
                    {/* Header de la tienda */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 font-black text-sm text-white shadow-md">
                          {store.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                            {store.name}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3 w-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                            <span className="truncate">{store.city || 'Paraguay'}</span>
                          </div>
                        </div>
                      </div>

                      {store.plan && (
                        <Badge variant="outline" className="text-[10px] font-bold border-cyan-500/30 text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40">
                          {store.plan}
                        </Badge>
                      )}
                    </div>

                    {/* Slogan y descripción comercial */}
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                      {store.slogan || store.description || 'Tienda verificada en plataforma MiPOS'}
                    </p>

                    {/* Dirección física */}
                    {store.address && (
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        📍 {store.address}
                      </p>
                    )}

                    {/* Indicadores rápidos.
                        Los respaldos inventaban datos de negocios reales: una
                        tienda sin productos mostraba «+150 productos», y una sin
                        reseñas «4.9 (50)». Ahora se dice lo que hay. */}
                    <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-2 text-slate-600 dark:text-slate-400">
                        <span className="block text-[10px] text-slate-400">Artículos publicados</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {store.products_count > 0
                            ? `${store.products_count.toLocaleString('es-PY')} producto${store.products_count === 1 ? '' : 's'}`
                            : 'Catálogo en preparación'}
                        </span>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-2 text-slate-600 dark:text-slate-400">
                        <span className="block text-[10px] text-slate-400">Calificación</span>
                        {(store.review_count ?? 0) > 0 ? (
                          <span className="font-bold text-amber-500 flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {Number(store.review_rating_avg ?? 0).toFixed(1)} ({store.review_count})
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            Sin reseñas todavía
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botón de visita a la tienda online */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full justify-between rounded-xl font-bold text-xs h-9 border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/50 dark:border-slate-800 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-950/30 group-hover:bg-cyan-600 group-hover:text-white dark:group-hover:bg-cyan-500 dark:group-hover:text-slate-950 transition-all"
                    >
                      <Link href={`/${store.slug}/inicio`}>
                        <span>Visitar Tienda Online</span>
                        <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filteredStores.length === 0 && (
            <div className="mt-12 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center">
              <Building2 className="mx-auto h-10 w-10 text-slate-400 mb-3" />
              {/* No es lo mismo «el filtro no encontró» que «todavía no hay
                  ninguno»: decir lo primero cuando pasa lo segundo manda a la
                  persona a probar filtros que no van a devolver nada. */}
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {combinedStores.length === 0
                  ? 'Todavía no hay negocios publicados'
                  : 'No se encontraron tiendas con ese filtro'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {combinedStores.length === 0
                  ? 'Los comercios aparecen acá cuando publican su tienda en el marketplace.'
                  : 'Probá con otra categoría o restablecé los filtros de búsqueda.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFilter('all')
                  setSearchQuery('')
                }}
                className="mt-4 rounded-xl text-xs"
              >
                Ver todos los comercios
              </Button>
            </div>
          )}

          {/* CTA para sumar tu negocio */}
          <div className="mt-14 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-blue-950/40 p-8 sm:p-10 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
              <div className="max-w-xl">
                <Badge variant="outline" className="border-cyan-400/40 text-cyan-300 bg-cyan-950/60 mb-2">
                  Sumate a la Red
                </Badge>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                  ¿Tenés un comercio o taller técnico?
                </h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  Adherí tu negocio hoy mismo. Configuralo en 5 minutos y empezá a vender con catálogo público, caja blindada y control de stock.
                </p>
              </div>

              <Button
                asChild
                size="lg"
                className="h-12 px-8 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-xl text-sm shrink-0 shadow-lg shadow-cyan-400/20"
              >
                <Link href="/register">
                  Crear Mi Negocio Ahora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
