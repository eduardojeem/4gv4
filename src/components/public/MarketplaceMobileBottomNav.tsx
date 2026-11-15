'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronRight,
  Grid3X3,
  Heart,
  Home,
  LayoutDashboard,
  MapPin,
  Package,
  Plus,
  Rocket,
  Search,
  ShoppingBag,
  Store,
  Tag,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { AuthModal } from '@/components/public/AuthModal'
import { useMarketplaceLocationHref } from '@/components/public/MarketplaceLocationPicker'
import { canOpenDashboard } from '@/lib/auth/dashboard-access'
import { parseMarketplaceLocation } from '@/lib/public/marketplace-location'
import { useFavorites } from '@/lib/public/favorites-store'
import { countryLabel } from '@/lib/regional/country-labels'
import { cn } from '@/lib/utils'

export const MARKETPLACE_PROFILE_PATH = '/marketplace/perfil'

function formatLocationChip(countryParam: string | null, cityParam: string | null): string {
  const selection = parseMarketplaceLocation({
    country: countryParam ?? 'all',
    city: cityParam ?? 'all',
  })
  if (selection.city !== 'all') {
    const rawCity = selection.city.split(':').pop() ?? ''
    if (rawCity) {
      return rawCity
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    }
  }
  if (selection.country !== 'all') {
    return selection.country === 'unknown' ? 'Otra zona' : countryLabel(selection.country)
  }
  return 'Todas las zonas'
}

export function MarketplaceMobileBottomNav() {
  const withLocation = useMarketplaceLocationHref()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const favorites = useFavorites()

  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const routeKey = `${pathname}?${searchParams.toString()}`
  const [previousRouteKey, setPreviousRouteKey] = useState(routeKey)
  if (previousRouteKey !== routeKey) {
    setPreviousRouteKey(routeKey)
    setMenuOpen(false)
    setSearchQuery('')
  }

  useEffect(() => {
    if (!menuOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const canAccessDashboard = canOpenDashboard(user)
  const accountHref = canAccessDashboard ? '/dashboard' : MARKETPLACE_PROFILE_PATH
  const accountActive = canAccessDashboard
    ? pathname.startsWith('/dashboard')
    : pathname === MARKETPLACE_PROFILE_PATH || pathname.startsWith(`${MARKETPLACE_PROFILE_PATH}/`)

  const offersActive =
    pathname.startsWith('/marketplace/productos') && searchParams.get('ofertas') === '1'
  const homeActive = pathname === '/marketplace' || pathname === '/marketplace/explorar'
  const productsActive =
    (pathname.startsWith('/marketplace/productos') && !offersActive) ||
    pathname.startsWith('/marketplace/buscar')
  const exploreSecondaryActive =
    pathname.startsWith('/marketplace/empresas') ||
    pathname.startsWith('/marketplace/categorias') ||
    pathname.startsWith('/marketplace/favoritos')

  const favoritesCount = favorites.items.length
  const locationLabel = formatLocationChip(
    searchParams.get('country'),
    searchParams.get('city') ?? searchParams.get('ciudad')
  )

  const closeMenu = () => {
    setMenuOpen(false)
    setSearchQuery('')
  }

  const handleQuickSearch = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = searchQuery.trim()
    const target = trimmed
      ? `/marketplace/buscar?q=${encodeURIComponent(trimmed)}`
      : '/marketplace/buscar'
    closeMenu()
    router.push(withLocation(target))
  }

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú de accesos rápidos"
            onClick={closeMenu}
            className="absolute inset-0 bg-slate-950/55 dark:bg-slate-950/75 backdrop-blur-[2px] animate-in fade-in duration-150"
          />

          <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-3 px-3.5 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <section
              id="marketplace-quick-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Accesos rápidos del marketplace"
              className="w-full max-h-[76dvh] overflow-y-auto rounded-[28px] border border-border/80 bg-card p-4 pt-2.5 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />

              {/* Cabecera del panel Bento */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[19px] font-black tracking-tight text-foreground">
                  Accesos rápidos
                </h2>
                <span className="inline-flex max-w-[165px] items-center gap-1 rounded-full border border-border/80 bg-muted px-2.5 py-1 text-[11px] font-bold text-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{locationLabel}</span>
                </span>
              </div>

              {/* Buscador integrado */}
              <form
                onSubmit={handleQuickSearch}
                className="mb-3 flex h-11 items-center gap-2 rounded-full border border-border/80 bg-muted/80 pl-3.5 pr-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
              >
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar productos, marcas…"
                  aria-label="Buscar productos o marcas"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  aria-label="Buscar productos"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </form>

              {!user ? (
                <div className="space-y-2.5">
                  {/* Modo Visitante: Tarjetas Bento principales */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={withLocation('/marketplace/productos')}
                      onClick={closeMenu}
                      className="group flex flex-col justify-between gap-1.5 rounded-[20px] border border-blue-200/90 bg-blue-50/90 p-3.5 transition-transform active:scale-[0.98] dark:border-blue-500/30 dark:bg-blue-500/15"
                    >
                      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-[13px] bg-blue-600 text-white shadow-sm">
                        <Search className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold tracking-tight text-foreground">
                          Buscar productos
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          Catálogo, ofertas y marcas
                        </p>
                      </div>
                      <span className="mt-1 inline-flex w-fit items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-extrabold text-blue-700 dark:bg-blue-500/30 dark:text-blue-200">
                        Explorar ›
                      </span>
                    </Link>

                    <Link
                      href={withLocation('/marketplace/empresas')}
                      onClick={closeMenu}
                      className="group flex flex-col justify-between gap-1.5 rounded-[20px] border border-indigo-200/90 bg-indigo-50/90 p-3.5 transition-transform active:scale-[0.98] dark:border-indigo-500/30 dark:bg-indigo-500/15"
                    >
                      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-[13px] bg-indigo-600 text-white shadow-sm">
                        <Store className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold tracking-tight text-foreground">
                          Ver tiendas
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          Comercios adheridos
                        </p>
                      </div>
                      <span className="mt-1 inline-flex w-fit items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-200">
                        Directorio ›
                      </span>
                    </Link>
                  </div>

                  {/* Fila secundaria compacta */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={withLocation('/marketplace/categorias')}
                      onClick={closeMenu}
                      className="flex items-center gap-2.5 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 transition-transform active:scale-[0.98] dark:border-amber-500/30 dark:bg-amber-500/15"
                    >
                      <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[11px] bg-amber-500 text-white">
                        <Grid3X3 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-extrabold text-foreground">
                          Categorías
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">Todos los rubros</p>
                      </div>
                    </Link>

                    <Link
                      href="/marketplace/favoritos"
                      onClick={closeMenu}
                      className="flex items-center gap-2.5 rounded-2xl border border-rose-200/90 bg-rose-50/90 px-3 py-2.5 transition-transform active:scale-[0.98] dark:border-rose-500/30 dark:bg-rose-500/15"
                    >
                      <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[11px] bg-rose-500 text-white">
                        <Heart className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-extrabold text-foreground">
                          Favoritos
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {favoritesCount} guardado{favoritesCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </Link>
                  </div>

                  {/* Banner oscuro de acceso */}
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu()
                      setAuthOpen(true)
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-[18px] bg-slate-900 px-3.5 py-3 text-left text-white shadow-sm transition-opacity hover:opacity-95 active:scale-[0.99] dark:border dark:border-slate-700 dark:bg-slate-800"
                  >
                    <span className="text-xs font-bold leading-snug">
                      Entrá para ver tus pedidos y reparaciones
                    </span>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-slate-900">
                      Acceder ›
                    </span>
                  </button>

                  <Link
                    href="/saas"
                    onClick={closeMenu}
                    className="flex items-center justify-center gap-1.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <Rocket className="h-3.5 w-3.5 text-primary" />
                    <span>
                      ¿Tenés un negocio?{' '}
                      <strong className="font-extrabold text-foreground">Publicá tu tienda ›</strong>
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Modo Con Sesión: Exploración compacta */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={withLocation('/marketplace/productos')}
                      onClick={closeMenu}
                      className="flex items-center gap-2.5 rounded-2xl border border-blue-200/90 bg-blue-50/90 px-3 py-2.5 transition-transform active:scale-[0.98] dark:border-blue-500/30 dark:bg-blue-500/15"
                    >
                      <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[11px] bg-blue-600 text-white">
                        <Search className="h-4 w-4" />
                      </div>
                      <span className="text-[13px] font-extrabold leading-tight text-foreground">
                        Buscar productos
                      </span>
                    </Link>

                    <Link
                      href={withLocation('/marketplace/empresas')}
                      onClick={closeMenu}
                      className="flex items-center gap-2.5 rounded-2xl border border-indigo-200/90 bg-indigo-50/90 px-3 py-2.5 transition-transform active:scale-[0.98] dark:border-indigo-500/30 dark:bg-indigo-500/15"
                    >
                      <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[11px] bg-indigo-600 text-white">
                        <Store className="h-4 w-4" />
                      </div>
                      <span className="text-[13px] font-extrabold leading-tight text-foreground">
                        Ver tiendas
                      </span>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={withLocation('/marketplace/categorias')}
                      onClick={closeMenu}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/70 px-3 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
                    >
                      <Grid3X3 className="h-4 w-4 text-amber-500" />
                      <span className="truncate">Categorías</span>
                    </Link>

                    <Link
                      href="/marketplace/favoritos"
                      onClick={closeMenu}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/70 px-3 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
                    >
                      <Heart className="h-4 w-4 text-rose-500" />
                      <span className="truncate">Favoritos ({favoritesCount})</span>
                    </Link>
                  </div>

                  {/* Tu Actividad (solo con sesión) */}
                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-center gap-1.5 px-0.5">
                      <span className="text-[11px] font-extrabold tracking-wider text-muted-foreground">
                        TU ACTIVIDAD
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <Link
                        href="/marketplace/perfil#pedidos"
                        onClick={closeMenu}
                        className="flex flex-col justify-between gap-1.5 rounded-[20px] border border-sky-200/90 bg-sky-50/90 p-3.5 transition-transform active:scale-[0.98] dark:border-sky-500/35 dark:bg-blue-500/15"
                      >
                        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-[13px] bg-blue-600 text-white shadow-sm">
                          <ShoppingBag className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold tracking-tight text-foreground">
                            Mis pedidos
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Compras en tiendas
                          </p>
                        </div>
                        <span className="mt-1 inline-flex w-fit items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-blue-700 shadow-2xs dark:bg-blue-500/30 dark:text-blue-200">
                          Ver compras ›
                        </span>
                      </Link>

                      <Link
                        href="/marketplace/mis-reparaciones"
                        onClick={closeMenu}
                        className="flex flex-col justify-between gap-1.5 rounded-[20px] border border-cyan-200/90 bg-cyan-50/90 p-3.5 transition-transform active:scale-[0.98] dark:border-cyan-500/35 dark:bg-cyan-500/15"
                      >
                        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-[13px] bg-cyan-600 text-white shadow-sm">
                          <Wrench className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold tracking-tight text-foreground">
                            Mis reparaciones
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Estado en taller
                          </p>
                        </div>
                        <span className="mt-1 inline-flex w-fit items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-cyan-700 shadow-2xs dark:bg-cyan-500/30 dark:text-cyan-200">
                          Rastrear ›
                        </span>
                      </Link>
                    </div>
                  </div>

                  {/* Franja oscura inferior: Panel o Empezar negocio */}
                  <Link
                    href={canAccessDashboard ? '/dashboard' : '/saas'}
                    onClick={closeMenu}
                    className={cn(
                      'flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-white shadow-sm transition-opacity hover:opacity-95',
                      canAccessDashboard
                        ? 'border-cyan-500 bg-slate-900 dark:bg-slate-800'
                        : 'border-slate-900 bg-slate-900 dark:border-slate-700 dark:bg-slate-800'
                    )}
                  >
                    {canAccessDashboard ? (
                      <LayoutDashboard className="h-4 w-4 shrink-0 text-sky-400" />
                    ) : (
                      <Rocket className="h-4 w-4 shrink-0 text-sky-400" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold tracking-tight">
                      {canAccessDashboard
                        ? user?.organization?.name
                          ? `Panel de ${user.organization.name}`
                          : 'Ir al panel de gestión'
                        : '¿Tenés un negocio? Empezar gratis'}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </Link>
                </div>
              )}
            </section>

            {/* Botón central X (morfado desde el botón +) */}
            <button
              type="button"
              onClick={closeMenu}
              aria-label="Cerrar accesos rápidos"
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-xl transition-transform active:scale-95 dark:border-slate-700 dark:bg-slate-50 dark:text-slate-950"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegación móvil"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-5 items-center border-t border-border/80 bg-background/95 px-1.5 shadow-lg backdrop-blur-xl lg:hidden"
      >
        {/* Tab 1: Inicio */}
        <Link
          href={withLocation('/marketplace')}
          aria-current={!menuOpen && homeActive ? 'page' : undefined}
          className={cn(
            'group flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold transition-all select-none',
            !menuOpen && homeActive
              ? 'text-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div
            className={cn(
              'flex h-7 w-10 items-center justify-center rounded-xl transition-all duration-200',
              !menuOpen && homeActive
                ? 'bg-primary/12 text-primary scale-105'
                : 'group-hover:bg-muted text-muted-foreground'
            )}
          >
            <Home className="h-4.5 w-4.5" />
          </div>
          <span className="truncate leading-none">Inicio</span>
        </Link>

        {/* Tab 2: Productos */}
        <Link
          href={withLocation('/marketplace/productos')}
          aria-current={!menuOpen && productsActive ? 'page' : undefined}
          className={cn(
            'group flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold transition-all select-none',
            !menuOpen && productsActive
              ? 'text-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div
            className={cn(
              'flex h-7 w-10 items-center justify-center rounded-xl transition-all duration-200',
              !menuOpen && productsActive
                ? 'bg-primary/12 text-primary scale-105'
                : 'group-hover:bg-muted text-muted-foreground'
            )}
          >
            <Package className="h-4.5 w-4.5" />
          </div>
          <span className="truncate leading-none">Productos</span>
        </Link>

        {/* Slot 3: Botón central + (Menú Bento de accesos rápidos) */}
        <div className="relative flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? 'Cerrar accesos rápidos' : 'Abrir accesos rápidos del Marketplace'}
            aria-expanded={menuOpen}
            aria-controls="marketplace-quick-menu"
            className={cn(
              '-mt-5 flex h-13 w-13 items-center justify-center rounded-full border-[3px] border-background text-white shadow-lg transition-transform active:scale-95',
              !menuOpen && exploreSecondaryActive
                ? 'bg-slate-900 dark:bg-slate-800'
                : 'bg-primary'
            )}
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
          {!menuOpen && exploreSecondaryActive && (
            <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" />
          )}
        </div>

        {/* Tab 4: Ofertas (reemplaza Tiendas, que vive dentro del menú +) */}
        <Link
          href={withLocation('/marketplace/productos?ofertas=1#catalogo')}
          aria-current={!menuOpen && offersActive ? 'page' : undefined}
          className={cn(
            'group flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold transition-all select-none',
            !menuOpen && offersActive
              ? 'text-red-600 dark:text-red-400 font-bold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div
            className={cn(
              'flex h-7 w-10 items-center justify-center rounded-xl transition-all duration-200',
              !menuOpen && offersActive
                ? 'bg-red-500/12 text-red-600 dark:text-red-400 scale-105'
                : 'group-hover:bg-muted text-muted-foreground'
            )}
          >
            <Tag className="h-4.5 w-4.5" />
          </div>
          <span className="truncate leading-none">Ofertas</span>
        </Link>

        {/* Tab 5: Mi Cuenta / Panel */}
        {user ? (
          <Link
            href={accountHref}
            aria-current={!menuOpen && accountActive ? 'page' : undefined}
            className={cn(
              'group flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold transition-all select-none',
              !menuOpen && accountActive
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div
              className={cn(
                'flex h-7 w-10 items-center justify-center rounded-xl transition-all duration-200',
                !menuOpen && accountActive
                  ? 'bg-primary/12 text-primary scale-105'
                  : 'group-hover:bg-muted text-muted-foreground'
              )}
            >
              {canAccessDashboard ? (
                <LayoutDashboard className="h-4.5 w-4.5" />
              ) : (
                <User className="h-4.5 w-4.5" />
              )}
            </div>
            <span className="truncate leading-none">
              {canAccessDashboard ? 'Panel' : 'Perfil'}
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="group flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold text-muted-foreground transition-all select-none hover:text-foreground"
          >
            <div className="flex h-7 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 group-hover:bg-muted">
              <User className="h-4.5 w-4.5" />
            </div>
            <span className="truncate leading-none">Acceder</span>
          </button>
        )}
      </nav>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
