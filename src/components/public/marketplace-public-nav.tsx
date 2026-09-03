'use client'

import Link from 'next/link'
import { PublicFavorites } from './Favorites'
import { useState, useEffect } from 'react'
import {
  Building2,
  ChevronRight,
  Grid3X3,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Rocket,
  Search,
  ShoppingBag,
  Store,
  User,
  X,
  Layers,
  Sparkles,
} from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MarketplaceSearchBox } from '@/components/public/MarketplaceSearchBox'
import { useAuth } from '@/contexts/auth-context'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePlatformBranding } from '@/hooks/use-platform-branding'
import type { PlatformBranding } from '@/lib/platform/branding'
import { resolveLogoSize } from '@/lib/platform/logo-size'
import { AuthModal } from '@/components/public/AuthModal'

// ─── Nav items ────────────────────────────────────────────────────────────────
const navItems = [
  { href: '/marketplace', label: 'Inicio', icon: Home, exact: true },
  { href: '/marketplace/productos', label: 'Productos', icon: Package, exact: false },
  { href: '/marketplace/categorias', label: 'Categorías', icon: Grid3X3, exact: false },
  { href: '/marketplace/empresas', label: 'Tiendas', icon: Store, exact: false },
]

export function MarketplacePublicNav({ initialBranding }: { initialBranding?: PlatformBranding }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const { branding } = usePlatformBranding(initialBranding)

  // Cerrar drawer al cambiar de ruta
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [pathname])

  // Bloquear scroll cuando el drawer está abierto
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileDrawerOpen])

  const canAccessDashboard =
    user?.role === 'super_admin' ||
    user?.role === 'admin' ||
    user?.role === 'tecnico' ||
    user?.role === 'vendedor'

  const userInitials = user?.profile?.name
    ? user.profile.name
        .split(' ')
        .map((part: string) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  // Tamaño del logo: definicion unica compartida con el nav de la landing.
  const logoSize = resolveLogoSize(branding)

  async function handleLogout() {
    await signOut()
    setMobileDrawerOpen(false)
    router.push('/marketplace')
    router.refresh()
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <Link href="/marketplace" className="flex shrink-0 items-center gap-3 group">
            {branding.logoUrl || branding.logoDarkUrl ? (
              <div className="flex items-center transition-transform duration-200 group-hover:scale-[1.02]">
                {branding.logoDarkUrl && branding.logoUrl ? (
                  <>
                    <img
                      src={branding.logoUrl}
                      alt={branding.platformName}
                      className={`${
                        logoSize.className
                      } w-auto object-contain dark:hidden drop-shadow-xs`}
                      style={logoSize.style}
                    />
                    <img
                      src={branding.logoDarkUrl}
                      alt={branding.platformName}
                      className={`${
                        logoSize.className
                      } w-auto object-contain hidden dark:block ${branding.logoGlowDark !== false ? 'drop-shadow-[0_2px_14px_rgba(6,182,212,0.35)]' : ''}`}
                      style={logoSize.style}
                    />
                  </>
                ) : (
                  <img
                    src={branding.logoUrl || branding.logoDarkUrl}
                    alt={branding.platformName}
                    className={`${
                      logoSize.className
                    } w-auto object-contain`}
                    style={logoSize.style}
                  />
                )}
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <LayoutGrid className="h-5 w-5" />
              </div>
            )}
            {!branding.hideNavBrandText && (
              <div className="hidden sm:block">
                <div className="text-sm font-bold leading-none text-foreground">
                  {branding.marketplaceName}
                </div>
                {!branding.hideNavTagline && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{branding.marketplaceTagline}</div>
                )}
              </div>
            )}
          </Link>

          {/* Search — desktop */}
          <div className="hidden min-w-0 flex-1 justify-center px-2 xl:flex">
            <MarketplaceSearchBox compact className="w-full max-w-sm" buttonClassName="hidden" />
          </div>

          {/* Desktop nav links */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => {
              const active = isActive(item.href, item.exact)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <InstallPrompt />
            <PublicFavorites />
            <ThemeToggle />

            {/* SaaS CTA — desktop */}
            <Link
              href="/saas"
              className="hidden items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 lg:flex"
            >
              <Rocket className="h-3.5 w-3.5" />
              ¿Tenés un negocio?
            </Link>

            {user ? (
              /* Avatar dropdown cuando está logueado */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage
                        src={user.profile?.avatar_url || ''}
                        alt={user.profile?.name || 'Usuario'}
                      />
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="font-normal">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{user.profile?.name || 'Usuario'}</p>
                      <p className="break-all text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canAccessDashboard && (
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Panel administrativo
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/marketplace" className="cursor-pointer">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Marketplace
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/saas" className="cursor-pointer">
                      <Rocket className="mr-2 h-4 w-4" />
                      Planes SaaS
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                {/* Botón "Mi cuenta" — desktop */}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAuthOpen(true)}
                  className="group hidden gap-2 rounded-full bg-primary text-primary-foreground shadow-xs transition-all hover:bg-primary/90 sm:inline-flex"
                >
                  <User className="h-3.5 w-3.5" />
                  Mi cuenta
                </Button>
              </>
            )}

            {/* Botón de Menú Drawer para Mobile y Tablet */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground hover:bg-muted transition-colors lg:hidden"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MODAL / DRAWER LATERAL OFF-CANVAS (SHEET) ─────────────────────────── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Difuminado */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Panel Deslizante Lateral Derecho */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col bg-card p-6 shadow-2xl border-l border-border/80 transition-transform duration-300 animate-in slide-in-from-right">
            
            {/* Cabecera del Drawer con Logo y Botón Cerrar */}
            <div className="flex items-center justify-between pb-5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                  <LayoutGrid className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-foreground">
                  {branding.marketplaceName}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sección de Usuario / Cuenta */}
            <div className="py-4 border-b border-border/60">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={user.profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {user.profile?.name || 'Usuario'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  {canAccessDashboard && (
                    <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2 rounded-xl">
                      <Link href="/dashboard" onClick={() => setMobileDrawerOpen(false)}>
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                        Panel administrativo
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Accedé a tu cuenta o registrate para comprar:</p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-xs"
                    onClick={() => {
                      setMobileDrawerOpen(false)
                      setAuthOpen(true)
                    }}
                  >
                    <User className="h-4 w-4" />
                    Iniciar sesión / Registro
                  </Button>
                </div>
              )}
            </div>

            {/* Enlaces de Navegación Principal */}
            <nav className="flex-1 overflow-y-auto py-4 space-y-1">
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Secciones del Marketplace
              </p>

              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href, item.exact)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </Link>
                )
              })}

              <div className="pt-3">
                <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Para Comerciantes
                </p>
                <Link
                  href="/saas"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/[0.04] px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/[0.08] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Rocket className="h-4 w-4" />
                    <span>Publicar mi tienda SaaS</span>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-70" />
                </Link>
              </div>
            </nav>

            {/* Pie del Drawer */}
            <div className="pt-4 border-t border-border/60 space-y-3">
              {user && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Auth modal */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
