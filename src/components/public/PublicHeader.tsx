'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Package, Store, Menu, X, Phone, User, Shield, Clock, LayoutDashboard, Truck, Briefcase, Tag, ChevronRight } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { PublicRepairReadyNotifications } from '@/components/public/PublicRepairReadyNotifications'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LogOut } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { getTenantSlugFromPathname, isTenantPublicSection } from '@/lib/saas/tenant'
import { AuthModal } from '@/components/public/AuthModal'
import { isPublicServicesPageAvailable, isPublicRepairsAvailable } from '@/lib/website/services'
import type { WebsiteSettings } from '@/types/website-settings'

export function PublicHeader({ initialSettings = null }: { initialSettings?: WebsiteSettings | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { user, signOut } = useAuth()
  const { settings } = useWebsiteSettings()
  const effectiveSettings = settings ?? initialSettings
  const router = useRouter()
  const pathname = usePathname()
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const companyInfo = effectiveSettings?.company_info
  // Only show the organization's own phone — never the platform-level env fallback.
  const phoneDisplay = companyInfo?.phone || ''
  const phoneClean = phoneDisplay?.replace(/\D/g, '')
  const companyLogoUrl = companyInfo?.logoUrl?.trim() || ''
  const weekdayHours = companyInfo?.hours?.weekdays?.trim() || ''
  const showTopBar = companyInfo?.showTopBar !== false
  const canAccessDashboard = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'tecnico' || user?.role === 'vendedor'
  const pathTenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = pathTenantSlug ? `/${pathTenantSlug}` : ''
  const withTenantPrefix = (href: string) => {
    const section = href.split(/[/?#]/)[1]
    if (!tenantPrefix || !isTenantPublicSection(section)) {
      return href
    }

    return `${tenantPrefix}${href}`
  }

  // Scroll detection for shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mobileMenuOpen])

  // Close mobile menu with Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [mobileMenuOpen])

  // Prevent body scroll while mobile menu is open
  useEffect(() => {
    if (!mobileMenuOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [mobileMenuOpen])

  const userInitials = useMemo(() => {
    if (!user?.profile?.name) return 'U'
    return user.profile.name
      .split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [user])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      await signOut()
      router.push(tenantPrefix ? `${tenantPrefix}/inicio` : '/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setIsLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  const servicesEnabled = isPublicServicesPageAvailable(
    effectiveSettings?.company_info?.servicesPageEnabled,
    effectiveSettings?.services
  )
  const repairsEnabled = isPublicRepairsAvailable(
    effectiveSettings?.company_info,
    effectiveSettings?.services
  )
  const offersEnabled = effectiveSettings?.offers_section?.enabled !== false

  const navLinks = [
    { href: withTenantPrefix('/inicio'), label: 'Inicio', icon: null },
    { href: withTenantPrefix('/productos'), label: 'Productos', icon: Package },
    ...(offersEnabled ? [{ href: withTenantPrefix('/ofertas'), label: 'Ofertas', icon: Tag }] : []),
    ...(servicesEnabled ? [{ href: withTenantPrefix('/servicios'), label: 'Servicios', icon: Briefcase }] : []),
    ...(repairsEnabled ? [{ href: withTenantPrefix('/mis-reparaciones'), label: 'Reparaciones', icon: Shield }] : []),
    { href: withTenantPrefix('/track'), label: 'Rastrear pedidos', icon: Truck },
  ]
  const customerLoginHref = tenantPrefix ? `${tenantPrefix}/cliente/login` : '/login'
  const customerRegisterHref = tenantPrefix ? `${tenantPrefix}/cliente/registro` : '/register'

  const isActive = (href: string) => {
    if (href.endsWith('/inicio')) return pathname === href || pathname === '/'
    if (href.endsWith('/perfil')) return pathname === href || pathname.startsWith(`${href}/`)
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'shadow-lg shadow-gray-200/20 dark:shadow-black/10 py-1 border-b border-border/40'
          : 'py-2 border-b border-transparent'
      } ${
        companyInfo?.headerStyle === 'accent'
          ? 'bg-primary text-primary-foreground'
          : companyInfo?.headerStyle === 'dark'
          ? 'bg-slate-950 text-white border-slate-900'
          : companyInfo?.headerStyle === 'solid'
          ? 'bg-background text-foreground border-border/80'
          : 'bg-background/80 backdrop-blur-lg border-b border-border/40'
      }`}
    >
      {/* Top bar — only when the org actually provides contact info */}
      {showTopBar && (phoneDisplay || weekdayHours) && (
        <div className={`hidden border-b md:block py-1.5 transition-colors ${
          companyInfo?.headerStyle === 'accent'
            ? 'border-white/10 bg-white/5 text-primary-foreground/90'
            : companyInfo?.headerStyle === 'dark'
            ? 'border-slate-900 bg-slate-900/30 text-slate-400'
            : 'border-border/30 bg-muted/40 text-muted-foreground'
        }`}>
          <div className="container flex h-auto items-center text-xs font-medium">
            <div className="flex items-center gap-6">
              {phoneDisplay && (
                <a
                  href={phoneClean ? `tel:${phoneClean}` : undefined}
                  className="flex items-center gap-1.5 transition-colors hover:opacity-80"
                  aria-label="Llamar al local"
                >
                  <Phone className={`h-3.5 w-3.5 ${companyInfo?.headerStyle === 'accent' ? 'text-white' : 'text-primary'}`} />
                  <span>{phoneDisplay}</span>
                </a>
              )}
              {weekdayHours && (
                <span className="flex items-center gap-1.5">
                  <Clock className={`h-3.5 w-3.5 ${companyInfo?.headerStyle === 'accent' ? 'text-white' : 'text-primary'}`} />
                  {weekdayHours}
                  {companyInfo?.hours?.saturday ? ` | Sáb: ${companyInfo.hours.saturday}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main header */}
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link href={withTenantPrefix('/inicio')} className="group flex items-center gap-3 shrink-0" aria-label="Ir a inicio">
          <div className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl p-1 shadow-md shadow-primary/10 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3 ${
            companyInfo?.headerStyle === 'accent'
              ? 'bg-white text-primary'
              : 'bg-primary text-primary-foreground'
          }`}>
            {companyLogoUrl ? (
              <Image
                src={companyLogoUrl}
                alt={companyInfo?.name || 'Logo'}
                fill
                sizes="40px"
                className="object-contain p-0.5"
              />
            ) : (
              <Store className="h-5.5 w-5.5" />
            )}
          </div>
          <div className="hidden sm:block">
            <span className="block text-base font-extrabold leading-tight tracking-tight">
              {companyInfo?.name || 'Tienda'}
            </span>
            <span className={`block text-[10px] font-medium leading-tight ${
              companyInfo?.headerStyle === 'accent' ? 'text-white/80' : 'text-muted-foreground'
            }`}>
              {companyInfo?.slogan || 'Reparación y Servicios'}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegacion principal">
          {navLinks.map((link) => {
            const active = isActive(link.href)
            const LinkIcon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  active
                    ? companyInfo?.headerStyle === 'accent'
                      ? 'text-primary bg-white shadow-sm'
                      : 'text-foreground bg-accent'
                    : companyInfo?.headerStyle === 'accent'
                    ? 'text-white/80 hover:text-white hover:bg-white/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                }`}
              >
                {LinkIcon && <LinkIcon className="h-4 w-4 shrink-0" />}
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side: Theme toggle + CTA + User */}
        <div className="flex items-center gap-2.5">
          {tenantPrefix && (
            <>
              {/* Desktop Marketplace button */}
              <Button
                asChild
                variant="default"
                size="sm"
                className="hidden gap-2 rounded-lg border border-cyan-500/80 bg-cyan-600 font-semibold text-white shadow-sm shadow-cyan-600/20 transition-colors hover:bg-cyan-500 hover:text-white lg:inline-flex"
              >
                <Link href="/marketplace" aria-label="Volver al marketplace">
                  <Store className="h-4 w-4" />
                  <span>Marketplace</span>
                </Link>
              </Button>

              {/* Mobile Marketplace compact button */}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="inline-flex lg:hidden h-8 gap-1 rounded-lg border-cyan-500/40 bg-cyan-50/70 dark:bg-cyan-950/40 px-2 py-1 text-[11px] font-bold text-cyan-700 dark:text-cyan-300 shadow-2xs hover:bg-cyan-100"
              >
                <Link href="/marketplace" aria-label="Volver al marketplace">
                  <Store className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Marketplace</span>
                </Link>
              </Button>
            </>
          )}

          <PublicCartButton />

          {/* Theme toggle - visible on all screens */}
          {mounted && <ThemeToggle />}

          {user?.id && repairsEnabled && <PublicRepairReadyNotifications userId={user.id} />}

          {/* User menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full p-0 ring-2 ring-transparent transition-all hover:ring-border"
                >
                  <Avatar className="h-8 w-8 border border-border shadow-sm">
                    <AvatarImage
                      src={user?.profile?.avatar_url || ''}
                      alt={user?.profile?.name || 'Usuario'}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-2" align="end" sideOffset={8}>
                <DropdownMenuLabel className="font-normal p-1">
                  <div className="flex items-center gap-2.5 px-1 py-1.5">
                    <Avatar className="h-9 w-9 border border-border shadow-sm">
                      <AvatarImage src={user?.profile?.avatar_url || ''} alt={user?.profile?.name || 'Usuario'} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">{userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold leading-none truncate">
                          {user?.profile?.name || 'Usuario'}
                        </p>
                      </div>
                      <p className="text-xs leading-none text-muted-foreground break-all truncate">
                        {user?.email || 'usuario@email.com'}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canAccessDashboard && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2.5 cursor-pointer font-medium text-primary">
                      <LayoutDashboard className="h-4 w-4" />
                      Ir al Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                {canAccessDashboard && <DropdownMenuSeparator />}
                <DropdownMenuItem asChild>
                  <Link href={withTenantPrefix('/perfil')} className="flex items-center gap-2.5 cursor-pointer">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={withTenantPrefix('/perfil/autorizados')} className="flex items-center gap-2.5 cursor-pointer">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Personas Autorizadas
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLogoutOpen(true)}
                  className="flex items-center gap-2.5 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {/* Botón "Mi cuenta" — desktop (mismo diseño que el marketplace) */}
              <Button
                type="button"
                size="sm"
                onClick={() => setAuthOpen(true)}
                className="group hidden gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-sky-600 pl-1.5 pr-4 text-white shadow-md shadow-cyan-600/25 transition-all duration-200 hover:from-cyan-500 hover:to-sky-500 hover:shadow-lg hover:shadow-cyan-500/30 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 active:scale-[0.97] dark:focus-visible:ring-offset-slate-950 md:inline-flex"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:scale-110">
                  <User className="h-3.5 w-3.5" />
                </span>
                Mi cuenta
              </Button>
              {/* Icono "Mi cuenta" — mobile */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setAuthOpen(true)}
                className="h-9 w-9 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700 transition-colors hover:bg-cyan-100 hover:text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-950/70 md:hidden"
                aria-label="Mi cuenta"
              >
                <User className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Mobile & Tablet menu toggle */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground hover:bg-muted transition-colors lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── MODAL / DRAWER LATERAL OFF-CANVAS (SHEET) ESTILO MARKETPLACE ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Difuminado */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Panel Deslizante Lateral Derecho */}
          <div
            id="public-mobile-menu"
            ref={mobileMenuRef}
            // Sin aria-hidden: este panel solo se monta cuando el menu esta
            // abierto, asi que cerrado no existe en el DOM para nadie.
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col bg-card p-6 shadow-2xl border-l border-border/80 transition-transform duration-300 animate-in slide-in-from-right"
          >
            {/* Cabecera del Drawer con Logo y Botón Cerrar */}
            <div className="flex items-center justify-between pb-5 border-b border-border/60">
              <div className="flex items-center gap-2.5 min-w-0">
                {companyLogoUrl ? (
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-background p-0.5 shadow-xs">
                    <Image
                      src={companyLogoUrl}
                      alt={companyInfo?.name || 'Logo'}
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-xs">
                    {companyInfo?.name?.slice(0, 2).toUpperCase() || '4G'}
                  </div>
                )}
                <span className="font-bold text-sm text-foreground truncate">
                  {companyInfo?.name || 'Tienda Oficial'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
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
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
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
                    <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2 rounded-xl text-xs font-semibold text-primary">
                      <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <LayoutDashboard className="h-4 w-4" />
                        Panel administrativo
                      </Link>
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <Link
                      href={withTenantPrefix('/perfil')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Mi Perfil</span>
                    </Link>
                    <Link
                      href={withTenantPrefix('/perfil/autorizados')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span>Autorizados</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Accedé a tu cuenta o registrate para comprar:</p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-xs"
                    onClick={() => {
                      setMobileMenuOpen(false)
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
            <nav className="flex-1 overflow-y-auto py-4 space-y-1 scrollbar-thin scrollbar-thumb-muted">
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Secciones de la Tienda
              </p>

              {navLinks.map((link) => {
                const Icon = link.icon
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{link.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </Link>
                )
              })}

              {tenantPrefix && (
                <div className="pt-3">
                  <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Explorar
                  </p>
                  <Link
                    href="/marketplace"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/[0.05] px-3 py-2.5 text-sm font-semibold text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/[0.1] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Store className="h-4 w-4" />
                      <span>Volver al Marketplace</span>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-70" />
                  </Link>
                </div>
              )}

              {/* Horarios & Teléfono de Atención */}
              {(weekdayHours || phoneDisplay) && (
                <div className="mt-4 rounded-2xl border border-border/60 bg-muted/40 p-3 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Atención y Contacto
                  </span>
                  {weekdayHours && (
                    <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{weekdayHours}</span>
                    </div>
                  )}
                  {phoneDisplay && (
                    <a
                      href={`tel:${phoneClean}`}
                      className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{phoneDisplay}</span>
                    </a>
                  )}
                </div>
              )}
            </nav>

            {/* Pie del Drawer */}
            <div className="pt-4 border-t border-border/60 space-y-3">
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setLogoutOpen(true)
                  }}
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

      {/* Auth modal — login/registro del cliente, scopeado al tenant */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        loginHref={customerLoginHref}
        registerHref={customerRegisterHref}
      />

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="max-w-[400px] overflow-hidden border shadow-2xl">
          <div className="flex flex-col items-center text-center p-2">
            <div className="relative mb-5 h-16 w-16">
              <div className="absolute inset-0 rounded-full bg-destructive/10 animate-pulse" />
              <div className="absolute inset-2 flex items-center justify-center rounded-full border-2 border-destructive/20 bg-background shadow-inner">
                <LogOut className="ml-0.5 h-6 w-6 text-destructive" />
              </div>
            </div>

            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-center">
                {'Cerrar sesion?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5 text-center text-sm">
                {'Hola '}
                <span className="font-semibold text-foreground">
                  {user?.profile?.name?.split(' ')[0] || 'Usuario'}
                </span>
                {', estas seguro que quieres salir?'}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="mt-6 w-full gap-3 sm:justify-center flex-col-reverse sm:flex-row">
              <AlertDialogCancel className="mt-0" disabled={isLoggingOut}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoggingOut ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-destructive-foreground/30 border-t-destructive-foreground animate-spin" />
                    Cerrando...
                  </div>
                ) : (
                  'Si, cerrar sesion'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
