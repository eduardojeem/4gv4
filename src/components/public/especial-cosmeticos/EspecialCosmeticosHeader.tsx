'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Droplets,
  Flame,
  Heart,
  Layers,
  LogIn,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  User,
  X,
  Zap,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AuthModal } from '@/components/public/AuthModal'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { InstagramIcon, WhatsAppIcon } from '@/components/public/SocialIcons'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/contexts/auth-context'
import { useHydrated } from '@/hooks/use-hydrated'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'
import { cityFromAddress } from './cosmetics-home-data'
import './especial-cosmeticos.css'

interface EspecialCosmeticosHeaderProps {
  settings?: WebsiteSettings | null
}

// Subsecciones curadas de cosmética & skincare
const BEAUTY_CATEGORIES = [
  {
    key: 'serums',
    name: 'Sérums Activos & Concentrados',
    desc: 'Ácido Hialurónico, Vitamina C y Niacinamida',
    icon: Zap,
    query: 'serum',
    tag: 'Más Buscado',
  },
  {
    key: 'cremas',
    name: 'Cremas & Hidratantes',
    desc: 'Nutrición multicapa, péptidos y barrera cutánea',
    icon: Sparkles,
    query: 'crema',
    tag: 'Esencial',
  },
  {
    key: 'limpieza',
    name: 'Limpieza Facial & Desmaquillante',
    desc: 'Espumas suaves, tónicos botánicos y aguas micelares',
    icon: Droplets,
    query: 'limpiador',
  },
  {
    key: 'solar',
    name: 'Protección Solar FPS 50+',
    desc: 'Toque seco invisible de amplio espectro diario',
    icon: Sun,
    query: 'solar',
    tag: 'Diario',
  },
  {
    key: 'mascarillas',
    name: 'Mascarillas & Cuidado Especial',
    desc: 'Tratamientos hidroplásticos y exfoliación suave',
    icon: Layers,
    query: 'mascarilla',
  },
  {
    key: 'labios',
    name: 'Bálsamos & Cuidado de Labios',
    desc: 'Reparación intensiva y nutrición con manteca de karité',
    icon: Heart,
    query: 'labios',
  },
]

const BEAUTY_ROUTINES = [
  {
    name: 'Rutina Glow & Luminosidad',
    desc: 'Tono uniforme, efecto dewy y luminosidad botánica',
    icon: Sparkles,
    query: 'glow',
    badge: 'Popular',
  },
  {
    name: 'Piel Sensible & Calma',
    desc: 'Centella asiática, fórmulas sin fragancia y alivio',
    icon: ShieldCheck,
    query: 'calma',
  },
  {
    name: 'Anti-Edad & Firmeza',
    desc: 'Péptidos bioactivos, rosa mosqueta y elasticidad',
    icon: Flame,
    query: 'reparador',
  },
  {
    name: 'Limpieza Profunda & Poros',
    desc: 'Equilibrio de oleosidad sin agredir la barrera',
    icon: Droplets,
    query: 'limpieza',
  },
]

const SEARCH_SUGGESTIONS = [
  'Sérum Ácido Hialurónico',
  'Protector Solar FPS 50+',
  'Crema Péptidos',
  'Espuma Camelia',
  'Vitamina C',
  'Aceite Rosa Mosqueta',
]

export function EspecialCosmeticosHeader({ settings = null }: EspecialCosmeticosHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const company = useStorefrontCompanyInfo(settings?.company_info)
  const { user, signOut } = useAuth()
  const hydrated = useHydrated()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [logoError, setLogoError] = useState(false)

  const megaTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [prevPathname, setPrevPathname] = useState(pathname)

  // Cerrar menús al cambiar de ruta
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    if (mobileMenuOpen) setMobileMenuOpen(false)
    if (megaMenuOpen) setMegaMenuOpen(false)
    if (isSearchOpen) setIsSearchOpen(false)
  }

  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto focus search input when opened
  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isSearchOpen])

  // Solo datos que cargó el comercio: nada de nombres, logos o teléfonos de
  // ejemplo (antes un comercio sin logo mostraba el de Paravos y sin teléfono,
  // el +595 981 111 111).
  const storeName = company?.name?.trim() || 'Tienda'
  const slogan = company?.slogan?.trim() || ''
  const logoUrl = company?.logoUrl?.trim() || ''
  const phone = company?.phone?.trim() || ''
  const whatsapp = company?.whatsapp?.trim() || phone
  const whatsappClean = whatsapp.replace(/\D/g, '')
  const city = cityFromAddress(company?.address)
  const weekdayHours = company?.hours?.weekdays?.trim() || ''

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    router.push(`${prefix}/productos?q=${encodeURIComponent(q)}`)
    setIsSearchOpen(false)
    setMobileMenuOpen(false)
  }

  const handleQuickSearch = (term: string) => {
    setSearchQuery(term)
    router.push(`${prefix}/productos?q=${encodeURIComponent(term)}`)
    setIsSearchOpen(false)
    setMobileMenuOpen(false)
  }

  const handleMegaEnter = () => {
    if (megaTimeoutRef.current) clearTimeout(megaTimeoutRef.current)
    setMegaMenuOpen(true)
  }

  const handleMegaLeave = () => {
    megaTimeoutRef.current = setTimeout(() => {
      setMegaMenuOpen(false)
    }, 180)
  }

  // Active check helper
  const isHome = pathname === `${prefix}/inicio` || pathname === `${prefix}` || pathname === '/'
  const isProducts = pathname.startsWith(`${prefix}/productos`)
  const isOffers = pathname.startsWith(`${prefix}/ofertas`)

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full transition-all duration-300',
          scrolled
            ? 'bg-[#FFFDFB]/95 dark:bg-zinc-950/95 shadow-md shadow-rose-950/5 backdrop-blur-md border-b border-rose-150/70 dark:border-rose-900/30 py-1.5'
            : 'bg-[#FFFDFB] dark:bg-zinc-950 border-b border-rose-100 dark:border-zinc-800/80 py-2.5'
        )}
      >
        {/* ── 1. Barra superior de anuncios boutique ── */}
        {company?.showTopBar !== false && (
          <div className="border-b border-rose-100/70 bg-[#FFF5F6] py-1 text-xs text-rose-900 dark:border-rose-950 dark:bg-rose-950/40 dark:text-rose-200">
            <div className="container mx-auto flex items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                <span className="font-medium tracking-wide">
                  {[city, weekdayHours].filter(Boolean).join(' · ') || slogan || storeName}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-4 text-[11px]">
                {whatsappClean && (
                  <a
                    href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent('¡Hola! Me gustaría asesorarme sobre productos y rutinas para mi tipo de piel.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300 hover:text-emerald-600 transition-colors"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600" />
                    <span>WhatsApp: {whatsapp}</span>
                  </a>
                )}
                {company?.instagram && (
                  <a
                    href={`https://instagram.com/${company.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-rose-600 transition-colors"
                  >
                    <InstagramIcon className="h-3.5 w-3.5 text-rose-500" />
                    <span>@{company.instagram.replace(/^@/, '')}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 2. Barra principal de navegación ── */}
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo & Marca */}
          <Link href={`${prefix}/inicio`} className="flex items-center gap-3 group shrink-0">
            {logoUrl && !logoError ? (
              <div className="relative h-11 w-11 overflow-hidden rounded-full border border-rose-200/80 shadow-xs bg-white">
                <AppImage
                  src={logoUrl}
                  alt={storeName}
                  fill
                  className="object-cover"
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-rose-100 via-pink-50 to-amber-100 border border-rose-200/80 shadow-xs group-hover:scale-105 transition-transform duration-300">
                <svg
                  className="h-6 w-6 text-rose-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3c-1.5 3-4 6-4 9a4 4 0 0 0 8 0c0-3-2.5-6-4-9z" />
                  <path d="M8 12c-2.5-1.5-5-1-6 1 1 3 4 4 6 3" />
                  <path d="M16 12c2.5-1.5 5-1 6 1-1 3-4 4-6 3" />
                  <path d="M10 18c-2 2-5 2-7 1 1.5-2 3.5-2.5 6-1.5" />
                  <path d="M14 18c2 2 5 2 7 1-1.5-2-3.5-2.5-6-1.5" />
                  <path d="M12 18v3" />
                </svg>
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50 group-hover:text-rose-600 transition-colors">
                {storeName}
              </span>
              {slogan && (
                <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-rose-600/90 dark:text-rose-400">
                  {slogan}
                </span>
              )}
            </div>
          </Link>

          {/* Menú de navegación Desktop */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
            {/* Inicio */}
            <Link
              href={`${prefix}/inicio`}
              className={cn(
                'text-sm font-medium tracking-wide transition-colors relative py-1',
                isHome
                  ? 'text-rose-600 font-semibold dark:text-rose-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-rose-500'
                  : 'text-stone-700 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400'
              )}
            >
              Inicio
            </Link>

            {/* Dropdown Mega-Menú de Productos */}
            <div
              className="relative"
              onMouseEnter={handleMegaEnter}
              onMouseLeave={handleMegaLeave}
            >
              <button
                type="button"
                onClick={() => setMegaMenuOpen(!megaMenuOpen)}
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium tracking-wide transition-colors py-1',
                  isProducts || megaMenuOpen
                    ? 'text-rose-600 font-semibold dark:text-rose-400'
                    : 'text-stone-700 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400'
                )}
                aria-expanded={megaMenuOpen}
              >
                <span>Productos</span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    megaMenuOpen ? 'rotate-180 text-rose-600' : 'text-stone-400'
                  )}
                />
              </button>

              {/* Panel Mega Menú Flotante */}
              {megaMenuOpen && (
                <div className="absolute top-full -left-24 pt-2.5 w-[760px] z-50 cosmeticos-dropdown-animate">
                  <div className="cosmeticos-glass-panel rounded-3xl p-6 shadow-2xl overflow-hidden border border-rose-200/70 dark:border-zinc-800">
                    <div className="grid grid-cols-12 gap-6">
                      {/* Columna 1: Por Categoría (7 cols) */}
                      <div className="col-span-7 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-rose-100 dark:border-zinc-800">
                          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" />
                            <span>Líneas de Cuidado & Fórmulas</span>
                          </span>
                          <Link
                            href={`${prefix}/productos`}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1"
                          >
                            <span>Ver catálogo</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {BEAUTY_CATEGORIES.map((cat) => {
                            const IconC = cat.icon
                            return (
                              <Link
                                key={cat.key}
                                href={`${prefix}/productos?q=${encodeURIComponent(cat.query)}`}
                                className="group flex items-start gap-2.5 p-2.5 rounded-2xl hover:bg-rose-50/80 dark:hover:bg-zinc-900/80 transition-colors"
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100/70 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 group-hover:bg-rose-500 group-hover:text-white transition-all shadow-2xs">
                                  <IconC className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 truncate">
                                      {cat.name.split(' & ')[0]}
                                    </p>
                                    {cat.tag && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                        {cat.tag}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                                    {cat.desc}
                                  </p>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      </div>

                      {/* Columna 2: Por Objetivo & Tarjeta Destacada (5 cols) */}
                      <div className="col-span-5 flex flex-col justify-between space-y-4 pl-4 border-l border-rose-100 dark:border-zinc-800">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-400 flex items-center gap-1.5 mb-2.5">
                            <Heart className="h-3 w-3" />
                            <span>Objetivo de Rutina</span>
                          </span>
                          <div className="space-y-1.5">
                            {BEAUTY_ROUTINES.map((routine) => {
                              const IconR = routine.icon
                              return (
                                <Link
                                  key={routine.name}
                                  href={`${prefix}/productos?q=${encodeURIComponent(routine.query)}`}
                                  className="group flex items-center justify-between p-2 rounded-xl hover:bg-rose-50/70 dark:hover:bg-zinc-900/70 text-xs transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <IconR className="h-3.5 w-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
                                    <span className="font-medium text-stone-800 dark:text-stone-200 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                                      {routine.name}
                                    </span>
                                  </div>
                                  <ChevronRight className="h-3.5 w-3.5 text-stone-400 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                                </Link>
                              )
                            })}
                          </div>
                        </div>

                        {/* Acceso a las ofertas reales de la tienda */}
                        <Link
                          href={`${prefix}/ofertas`}
                          className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-zinc-900 dark:to-zinc-850 border border-rose-200/80 dark:border-zinc-750 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:border-rose-300"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5" />
                            Ver ofertas de la tienda
                          </span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Pie del Mega Menú con llamada de asesoría */}
                    <div className="mt-4 pt-3 border-t border-rose-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                        <Clock className="h-3.5 w-3.5 text-rose-500" />
                        <span>{[city, weekdayHours].filter(Boolean).join(' · ') || storeName}</span>
                      </div>
                      <Link
                        href={`${prefix}/productos`}
                        className="inline-flex items-center gap-1.5 font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 group"
                      >
                        <span>Explorar todo el catálogo</span>
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Categorías */}
            <Link
              href={`${prefix}/inicio#categorias`}
              className="text-sm font-medium tracking-wide text-stone-700 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400 transition-colors relative py-1"
            >
              Categorías
            </Link>

            {/* Ofertas Especiales con Badge llamativo */}
            <Link
              href={`${prefix}/ofertas`}
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-medium tracking-wide transition-colors relative py-1',
                isOffers
                  ? 'text-rose-600 font-semibold dark:text-rose-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-rose-500'
                  : 'text-stone-700 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400'
              )}
            >
              <span>Ofertas</span>
            </Link>

            {/* Rutina / Cuidados */}
            <Link
              href={`${prefix}/inicio#rutina`}
              className="text-sm font-medium tracking-wide text-stone-700 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400 transition-colors relative py-1"
            >
              Rutina
            </Link>

            {/* Nosotros */}
            <Link
              href={`${prefix}/inicio#nosotros`}
              className="text-sm font-medium tracking-wide text-stone-700 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400 transition-colors relative py-1"
            >
              Nosotros
            </Link>

            {/* Ubicación */}
            <Link
              href={`${prefix}/inicio#ubicacion`}
              className="text-sm font-medium tracking-wide text-stone-700 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400 transition-colors relative py-1"
            >
              Ubicación
            </Link>
          </nav>

          {/* Acciones del encabezado: Buscador, Favoritos, Carrito, Usuario */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Buscador expandible con sugerencias rápidas */}
            <div className="relative">
              {isSearchOpen ? (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-50 flex items-center">
                  <div className="flex items-center rounded-full border border-rose-300 bg-white dark:bg-zinc-900 shadow-xl py-1 pl-4 pr-2">
                    <form onSubmit={handleSearchSubmit} className="flex items-center">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Buscar sérums, crema, solar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-48 sm:w-72 bg-transparent text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none dark:text-stone-200"
                      />
                      <button
                        type="submit"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 shadow-2xs ml-1"
                        aria-label="Ejecutar búsqueda"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(false)}
                      className="ml-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                      aria-label="Cerrar búsqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 hover:bg-rose-50 hover:text-rose-600 dark:text-stone-300 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Buscar cosméticos"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Selector de tema */}
            <ThemeToggle />

            {/* Botón Carrito con contador en vivo */}
            <PublicCartButton />

            {/* Perfil de Usuario / Inicio de sesión */}
            {hydrated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-rose-300"
                    aria-label="Menú de usuario"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-rose-100 text-rose-700 text-xs font-semibold">
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl border border-rose-150 p-2 shadow-xl bg-white dark:bg-zinc-900">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      Mi Cuenta
                    </p>
                    <p className="text-[11px] text-stone-500 truncate">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`${prefix}/perfil`} className="flex items-center gap-2 text-xs">
                      <User className="h-3.5 w-3.5 text-rose-600" />
                      <span>Mis Datos & Perfil</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`${prefix}/perfil?tab=orders`} className="flex items-center gap-2 text-xs">
                      <ShoppingBag className="h-3.5 w-3.5 text-rose-600" />
                      <span>Mis Pedidos</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="flex items-center gap-2 text-xs text-rose-600 focus:text-rose-700"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50/70 px-3.5 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100 hover:border-rose-300 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 transition-colors shadow-2xs"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Ingresar</span>
              </button>
            )}

            {/* Botón menú móvil */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-rose-50 dark:text-stone-300 dark:hover:bg-zinc-800 lg:hidden"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* ── 3. Menú Móvil Desplegable (Drawer Completo) ── */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-rose-100 bg-[#FFFDFB] px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950 shadow-2xl animate-in slide-in-from-top-2 duration-200">
            {/* Buscador visible integrado en móvil */}
            <form onSubmit={handleSearchSubmit} className="relative mb-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar cosméticos, sérums, cremas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-rose-200 bg-white py-2 pl-10 pr-20 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-zinc-900 dark:border-zinc-800 dark:text-stone-200"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-rose-500 px-3 py-1 text-[11px] font-bold text-white shadow-2xs"
              >
                Buscar
              </button>
            </form>

            {/* Tags de búsqueda rápida */}
            <div className="flex flex-wrap gap-1.5 mb-4 pb-3 border-b border-rose-100 dark:border-zinc-800">
              {SEARCH_SUGGESTIONS.slice(0, 4).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleQuickSearch(tag)}
                  className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-150 dark:border-rose-900"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Enlaces de Navegación Móvil */}
            <nav className="flex flex-col gap-1 text-sm font-medium text-stone-800 dark:text-stone-200">
              <Link
                href={`${prefix}/inicio`}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-rose-50 dark:hover:bg-zinc-900"
              >
                Inicio
              </Link>

              {/* Acordeón de Productos */}
              <div className="rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
                  className="flex w-full items-center justify-between px-3 py-2 text-stone-800 dark:text-stone-200 hover:bg-rose-50 dark:hover:bg-zinc-900"
                >
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    Productos & Fórmulas
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200 text-rose-500',
                      mobileProductsOpen && 'rotate-180'
                    )}
                  />
                </button>

                {mobileProductsOpen && (
                  <div className="pl-4 pr-2 py-2 space-y-1 bg-rose-50/40 dark:bg-zinc-900/50 rounded-xl mb-1">
                    <Link
                      href={`${prefix}/productos`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between p-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-100/50"
                    >
                      <span>Ver Todo el Catálogo →</span>
                    </Link>
                    {BEAUTY_CATEGORIES.map((cat) => {
                      const IconComp = cat.icon
                      return (
                        <Link
                          key={cat.key}
                          href={`${prefix}/productos?q=${encodeURIComponent(cat.query)}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 p-1.5 rounded-lg text-xs hover:bg-rose-100/50"
                        >
                          <IconComp className="h-3.5 w-3.5 text-rose-500" />
                          <span>{cat.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              <Link
                href={`${prefix}/inicio#categorias`}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-rose-50 dark:hover:bg-zinc-900"
              >
                Categorías
              </Link>

              <Link
                href={`${prefix}/ofertas`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-rose-50 dark:hover:bg-zinc-900"
              >
                <span>Ofertas Especiales</span>
              </Link>

              <Link
                href={`${prefix}/inicio#rutina`}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-rose-50 dark:hover:bg-zinc-900"
              >
                Rutina de Cuidado Diario
              </Link>

              <Link
                href={`${prefix}/inicio#nosotros`}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-rose-50 dark:hover:bg-zinc-900"
              >
                Nosotros & Showroom
              </Link>

              <Link
                href={`${prefix}/inicio#ubicacion`}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-rose-50 dark:hover:bg-zinc-900"
              >
                Ubicación & Google Maps
              </Link>

              <div className="my-2 border-t border-rose-100 dark:border-zinc-800" />

              {/* Botón Asesoría WhatsApp Móvil */}
              {whatsappClean && (
                <a
                  href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent('¡Hola! Me gustaría asesorarme sobre productos y rutinas para mi piel.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 shadow-2xs mb-2"
                >
                  <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
                  <span>Asesoramiento por WhatsApp</span>
                </a>
              )}

              {/* Botón Iniciar Sesión / Registrarse */}
              {(!hydrated || !user) && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setAuthModalOpen(true)
                  }}
                  className="flex items-center justify-center gap-2 rounded-full bg-rose-500 py-2.5 text-sm font-semibold text-white shadow-sm"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Iniciar Sesión / Registrarse</span>
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Modal de autenticación */}
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  )
}
