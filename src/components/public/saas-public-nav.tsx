'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2,
  ChevronRight,
  CreditCard,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Rocket,
  Sparkles,
  Store,
  User,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { usePlatformBranding } from '@/hooks/use-platform-branding'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AuthModal } from '@/components/public/AuthModal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Inicio', href: '/saas', icon: Sparkles, exact: true },
  { label: 'Características', href: '/saas#caracteristicas', icon: Zap, exact: false },
  { label: 'Negocios', href: '/saas/negocios', icon: Building2, exact: false },
  { label: 'Planes', href: '/saas/planes', icon: CreditCard, exact: false },
]

interface SaaSPublicNavProps {
  variant?: 'default' | 'dark'
}

export function SaaSPublicNav({ variant = 'default' }: SaaSPublicNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const isDark = variant === 'dark'
  const { branding } = usePlatformBranding()

  // Cerrar drawer al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Bloquear scroll cuando el drawer está abierto
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

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

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    if (href.includes('#')) return pathname === '/saas'
    return pathname === href || pathname.startsWith(href + '/')
  }

  async function handleLogout() {
    await signOut()
    setMobileOpen(false)
    router.push('/saas')
    router.refresh()
  }

  // Clases dinámicas según el tamaño del logo configurado
  const heightClasses = {
    sm: 'h-8 sm:h-9 max-w-[160px]',
    md: 'h-10 sm:h-12 max-w-[220px]',
    lg: 'h-12 sm:h-14 max-w-[270px]',
    xl: 'h-14 sm:h-16 max-w-[320px]',
  }
  const currentHeight = heightClasses[branding.logoHeight || 'md']
  const darkGlowClass =
    branding.logoGlowDark !== false
      ? 'drop-shadow-[0_3px_18px_rgba(6,182,212,0.4)]'
      : 'drop-shadow-xs'

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-2xl transition-colors duration-200 ${
          isDark
            ? 'border-slate-800/80 bg-slate-950/90 shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
            : 'border-slate-200/80 bg-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:border-slate-800/80 dark:bg-slate-950/90 dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
        }`}
      >
        <div className="mx-auto flex h-16 sm:h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo & Identidad */}
          <Link
            href="/saas"
            className="group flex items-center gap-3.5 shrink-0 transition-transform duration-200 active:scale-[0.98]"
          >
            {branding.logoUrl || branding.logoDarkUrl ? (
              <div className="flex items-center transition-all duration-300 group-hover:scale-[1.03]">
                {branding.logoDarkUrl && branding.logoUrl ? (
                  <>
                    <img
                      src={branding.logoUrl}
                      alt={branding.platformName}
                      className={`${currentHeight} w-auto object-contain drop-shadow-xs ${
                        isDark ? 'hidden' : 'dark:hidden'
                      }`}
                    />
                    <img
                      src={branding.logoDarkUrl}
                      alt={branding.platformName}
                      className={`${currentHeight} w-auto object-contain ${darkGlowClass} ${
                        isDark ? 'block' : 'hidden dark:block'
                      }`}
                    />
                  </>
                ) : (
                  <img
                    src={branding.logoUrl || branding.logoDarkUrl}
                    alt={branding.platformName}
                    className={`${currentHeight} w-auto object-contain ${
                      isDark ? darkGlowClass : 'drop-shadow-xs'
                    }`}
                  />
                )}
              </div>
            ) : (
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg transition-transform group-hover:scale-105 ${
                  isDark
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-950/50'
                    : 'bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-slate-950/20 dark:from-cyan-500 dark:to-blue-600 dark:shadow-cyan-950/50'
                }`}
              >
                <Building2 className="h-5 w-5" />
              </div>
            )}

            {!branding.hideNavBrandText && (
              <div className="hidden min-[420px]:block">
                <div
                  className={`text-sm sm:text-base font-extrabold leading-none tracking-tight transition-colors ${
                    isDark
                      ? 'text-white group-hover:text-cyan-300'
                      : 'text-slate-950 group-hover:text-cyan-700 dark:text-slate-50 dark:group-hover:text-cyan-300'
                  }`}
                >
                  {branding.platformName}
                </div>
                {!branding.hideNavTagline && (
                  <div
                    className={`mt-1 text-[11px] font-medium leading-tight ${
                      isDark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {branding.platformTagline}
                  </div>
                )}
              </div>
            )}
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1.5 lg:flex rounded-full border border-slate-200/80 bg-slate-100/70 p-1 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            {navLinks.map((link) => {
              const active = isActive(link.href, link.exact)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    active
                      ? isDark
                        ? 'bg-cyan-500 text-slate-950 shadow-xs'
                        : 'bg-white text-slate-950 shadow-xs dark:bg-cyan-500 dark:text-slate-950'
                      : isDark
                        ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            {/* Marketplace Button */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className={`hidden gap-2 sm:inline-flex rounded-xl font-semibold text-xs h-9 ${
                isDark
                  ? 'border-slate-800 bg-slate-900/80 text-slate-200 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                  : 'border-slate-200/90 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200'
              }`}
            >
              <Link href={branding.secondaryCtaHref}>
                <Store className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                {branding.secondaryCtaLabel}
              </Link>
            </Button>

            {user ? (
              <Button
                asChild
                size="sm"
                className="hidden gap-2 lg:inline-flex bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-md shadow-cyan-600/20 rounded-xl h-9 px-4 text-xs"
              >
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Ir al Panel
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setAuthOpen(true)}
                className="group hidden gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 pl-2 pr-4 text-slate-950 font-bold shadow-md shadow-cyan-500/25 transition-all duration-200 active:scale-[0.97] lg:inline-flex h-9 text-xs"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-950/15 transition-transform duration-200 group-hover:scale-110">
                  <User className="h-3.5 w-3.5 text-slate-950" />
                </span>
                Mi cuenta
              </Button>
            )}

            {/* Mobile & Tablet Drawer Trigger Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground hover:bg-muted transition-colors lg:hidden"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MODAL / DRAWER LATERAL OFF-CANVAS (SHEET ESTILO MARKETPLACE) ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Difuminado */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Panel Deslizante Lateral Derecho */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col bg-card p-6 shadow-2xl border-l border-border/80 transition-transform duration-300 animate-in slide-in-from-right">
            
            {/* Cabecera del Drawer */}
            <div className="flex items-center justify-between pb-5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xs">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-foreground truncate">
                  {branding.platformName}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
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
                      <AvatarFallback className="bg-cyan-500/10 text-cyan-600 font-bold text-xs">
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
                    <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2 rounded-xl text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                      <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                        <LayoutDashboard className="h-4 w-4" />
                        Panel administrativo
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Accedé a tu panel SaaS o registrate:</p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-xs hover:from-cyan-400 hover:to-blue-500"
                    onClick={() => {
                      setMobileOpen(false)
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
                Secciones SaaS
              </p>

              {navLinks.map((link) => {
                const Icon = link.icon
                const active = isActive(link.href, link.exact)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{link.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </Link>
                )
              })}

              <div className="pt-3">
                <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Ecosistema
                </p>
                <Link
                  href={branding.secondaryCtaHref}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/[0.05] px-3 py-2.5 text-sm font-semibold text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/[0.1] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Store className="h-4 w-4" />
                    <span>{branding.secondaryCtaLabel}</span>
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
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        loginHref="/login"
        registerHref="/register"
      />
    </>
  )
}
