'use client'

import Link from 'next/link'
import { Package, Wrench, Menu, X, Phone, MessageCircle, User, Shield, Clock, LayoutDashboard } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { WHOLESALE_PRICE_PERMISSION } from '@/lib/auth/roles-permissions'
import { PublicRepairReadyNotifications } from '@/components/public/PublicRepairReadyNotifications'
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

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { user, signOut, hasPermission } = useAuth()
  const { settings } = useWebsiteSettings()
  const router = useRouter()
  const pathname = usePathname()
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const companyInfo = settings?.company_info
  const envSupportPhone = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || process.env.NEXT_PUBLIC_COMPANY_PHONE || '').toString()
  const envSupportEmail = (process.env.NEXT_PUBLIC_COMPANY_EMAIL || '').toString()
  const phoneDisplay = companyInfo?.phone || envSupportPhone
  const phoneClean = phoneDisplay?.replace(/\D/g, '')
  const emailDisplay = companyInfo?.email || envSupportEmail
  const showTopBar = companyInfo?.showTopBar !== false
  const canAccessDashboard = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'tecnico' || user?.role === 'vendedor'
  const isWholesaleUser = hasPermission(WHOLESALE_PRICE_PERMISSION)

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
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setIsLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  const navLinks = [
    { href: '/inicio', label: 'Inicio', icon: null },
    { href: '/productos', label: 'Productos', icon: Package },
    { href: '/mis-reparaciones', label: 'Rastrear reparaciones', icon: Wrench },
  ]

  const isActive = (href: string) => {
    if (href === '/inicio') return pathname === '/inicio' || pathname === '/'
    if (href === '/perfil') return pathname === '/perfil' || pathname.startsWith('/perfil/')
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-background/95 backdrop-blur-lg shadow-sm border-b border-border/50'
          : 'bg-background/80 backdrop-blur-md border-b border-transparent'
      }`}
    >
      {/* Top bar */}
      {showTopBar && (
        <div className="hidden border-b border-border/40 bg-muted/30 md:block">
          <div className="container flex h-9 items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-5">
              <a
                href={phoneClean ? `tel:${phoneClean}` : undefined}
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                aria-label="Llamar al local"
              >
                <Phone className="h-3 w-3" />
                <span>{phoneDisplay || '(sin telefono)'}</span>
              </a>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {companyInfo?.hours?.weekdays || 'Lun - Vie: 8:00 - 18:00'}
                {companyInfo?.hours?.saturday ? ` | Sab: ${companyInfo.hours.saturday}` : ''}
              </span>
            </div>
            <a
              href={phoneClean ? `https://wa.me/${phoneClean}` : (emailDisplay ? `mailto:${emailDisplay}` : '/inicio#contacto')}
              target={phoneClean ? '_blank' : undefined}
              rel={phoneClean ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <MessageCircle className="h-3 w-3" />
              Escribinos por WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Main header */}
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/inicio" className="group flex items-center gap-3 shrink-0" aria-label="Ir a inicio">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <span className="block text-base font-bold leading-tight tracking-tight text-foreground">
              {companyInfo?.name || '4G Celulares'}
            </span>
            <span className="block text-[11px] font-medium text-muted-foreground leading-tight">
              {'Reparacion y Service'}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegacion principal">
          {navLinks.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'text-foreground bg-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                {link.icon && <link.icon className="h-4 w-4" />}
                {link.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
          {mounted && !user && (
            <Link
              href="/login"
              className="relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
            >
              <User className="h-4 w-4" />
              Iniciar sesión
            </Link>
          )}
        </nav>

        {/* Right side: Theme toggle + CTA + User */}
        <div className="flex items-center gap-2">
          {/* Theme toggle - visible on all screens */}
          {mounted && <ThemeToggle />}

          {user?.id && <PublicRepairReadyNotifications userId={user.id} />}

          {/* Desktop CTA */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden lg:inline-flex gap-2 rounded-lg"
          >
            <a
              href={phoneClean ? `https://wa.me/${phoneClean}` : (emailDisplay ? `mailto:${emailDisplay}` : '/inicio#contacto')}
              target={phoneClean ? '_blank' : undefined}
              rel={phoneClean ? 'noopener noreferrer' : undefined}
              aria-label="Escribir por WhatsApp o Email"
            >
              <MessageCircle className="h-4 w-4" />
              Escribinos
            </a>
          </Button>

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
              <DropdownMenuContent className="w-60" align="end" sideOffset={8}>
                <DropdownMenuLabel className="font-normal pb-0">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold leading-none">
                        {user?.profile?.name || 'Usuario'}
                      </p>
                      {isWholesaleUser && (
                        <Badge className="h-4 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold">
                          Mayorista
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-all">
                      {user?.email || 'usuario@email.com'}
                    </p>
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
                  <Link href="/perfil" className="flex items-center gap-2.5 cursor-pointer">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/mis-reparaciones" className="flex items-center gap-2.5 cursor-pointer">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    Mis Reparaciones
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/perfil/autorizados" className="flex items-center gap-2.5 cursor-pointer">
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
            <Button 
              asChild 
              size="sm" 
              className="hidden rounded-lg px-5 md:inline-flex bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all duration-300 font-semibold"
            >
              <Link href="/login" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Iniciar sesión
              </Link>
            </Button>
          )}

          {/* Mobile menu toggle */}
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="public-mobile-menu"
        ref={mobileMenuRef}
        className={`overflow-y-auto border-t border-border/50 bg-background transition-all duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'max-h-[calc(100vh-4rem)] opacity-100' : 'max-h-0 opacity-0 border-transparent'
        }`}
      >
        <nav className="container flex flex-col gap-1 py-4" aria-label="Navegacion movil">
          {navLinks.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                {link.icon && <link.icon className="h-4 w-4" />}
                {link.label}
              </Link>
            )
          })}

          <div className="my-3 border-t border-border/50" />

          {/* Mobile CTAs */}
          <div className="flex flex-col gap-2 px-1">
            <Button asChild size="sm" className="w-full rounded-lg">
              <a
                href={phoneClean ? `https://wa.me/${phoneClean}` : (emailDisplay ? `mailto:${emailDisplay}` : '/inicio#contacto')}
                target={phoneClean ? '_blank' : undefined}
                rel={phoneClean ? 'noopener noreferrer' : undefined}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Escribinos por WhatsApp
              </a>
            </Button>

            {user ? (
              <>
                {canAccessDashboard && (
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-primary bg-primary/10 transition-colors hover:bg-primary/20"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Ir al Panel
                  </Link>
                )}
                <Link
                  href="/perfil"
                  className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  <User className="h-4 w-4" />
                  Mi Perfil
                </Link>
                <Link
                  href="/perfil/autorizados"
                  className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  <Shield className="h-4 w-4" />
                  Personas Autorizadas
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setLogoutOpen(true)
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesion
                </Button>
              </>
            ) : (
              <Button 
                asChild 
                size="sm" 
                className="w-full rounded-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all duration-300 font-semibold"
              >
                <Link href="/login" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Iniciar sesión
                </Link>
              </Button>
            )}
          </div>

          {/* Mobile contact info */}
          <div className="mt-3 border-t border-border/50 px-4 pt-4">
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>{companyInfo?.hours?.weekdays || 'Lun - Vie: 8:00 - 18:00'}</span>
              </div>
              {companyInfo?.hours?.saturday && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{'Sab: '}{companyInfo.hours.saturday}</span>
                </div>
              )}
              {phoneDisplay && (
                <a
                  href={`tel:${phoneClean}`}
                  className="flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>{phoneDisplay}</span>
                </a>
              )}
            </div>
          </div>
        </nav>
      </div>

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
