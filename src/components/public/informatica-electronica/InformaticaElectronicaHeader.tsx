'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Laptop,
  Flame,
  Search,
  Truck,
  ShieldCheck,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  MapPin,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/contexts/auth-context'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useHydrated } from '@/hooks/use-hydrated'
import { canOpenDashboard } from '@/lib/auth/dashboard-access'
import { categoryVisual } from '@/lib/public/category-taxonomy'
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
import { AuthModal } from '@/components/public/AuthModal'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'

export function InformaticaElectronicaHeader({ settings }: { settings: WebsiteSettings | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeCategoryId = searchParams?.get('category_id') ?? null
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? '/' + slug : ''
  const homeHref = prefix ? `${prefix}/inicio` : '/'

  const company = settings?.company_info
  const storeName = company?.name?.trim() || 'Tienda Oficial'
  const storeSlogan = company?.slogan?.trim() || 'Tecnología, informática y accesorios con garantía'
  const phoneClean = (company?.phone || '').replace(/\D/g, '')

  const storeAddress = company?.address?.trim() || ''

  const { categories } = usePublicCategories()
  const { user, signOut } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const hydrated = useHydrated()

  // Categorías reales de la organización para la barra superior (solo con productos o agregadas por la org)
  const navCategories = useMemo(() => {
    const rootCategories = (categories || []).filter((c) => !c.parent_id)
    if (rootCategories.length === 0) return []

    // Si algunas categorías tienen productCount especificado, priorizar aquellas con > 0
    const hasCounts = rootCategories.some((c) => typeof c.productCount === 'number')
    const filtered = hasCounts
      ? rootCategories.filter((c) => (c.productCount ?? 0) > 0)
      : rootCategories

    const listToShow = filtered.length > 0 ? filtered : rootCategories

    return listToShow.map((cat) => ({
      id: cat.id,
      label: cat.name,
      icon: categoryVisual(cat.name).icon,
      href: `${prefix}/productos?category_id=${encodeURIComponent(cat.id)}`,
    }))
  }, [categories, prefix])

  const canAccessDashboard = canOpenDashboard(user)

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
      await signOut()
      router.push(homeHref)
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setIsLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  const customerLoginHref = prefix ? `${prefix}/cliente/login` : '/login'
  const customerRegisterHref = prefix ? `${prefix}/cliente/registro` : '/register'

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    router.push(`${prefix}/productos?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  return (
    <div className="w-full flex flex-col font-sans border-b border-border/80 sticky top-0 z-40">
      {/* ── 0. Borde superior de acento con gradiente de marca ── */}
      <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/80 to-primary/50" />

      {/* ── 1. Barra superior: datos reales de la tienda (dirección y WhatsApp) ── */}
      {(storeAddress || phoneClean) && (
        <div className="bg-slate-100/95 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs py-1.5 px-4 border-b border-slate-200 dark:border-slate-800 transition-colors">
          <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2.5">
            {storeAddress ? (
              <span className="inline-flex min-w-0 items-center gap-1 text-slate-500 dark:text-slate-400">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{storeAddress}</span>
              </span>
            ) : <span />}
            {phoneClean && (
              <a
                href={`https://wa.me/${phoneClean}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex shrink-0 items-center gap-1.5 text-[#1da851] dark:text-[#25D366] font-bold hover:underline transition-colors"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                <span>Atención por WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── 2. Encabezado Principal Neutro con Acento de Marca ── */}
      <header className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            {/* Logo e identidad de la tienda (Redirige siempre a /inicio) */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>

              <Link href={homeHref} className="group flex items-center gap-2.5">
                {company?.logoUrl ? (
                  <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-slate-100 dark:bg-white p-1 border border-primary/25 shadow-2xs group-hover:border-primary transition-colors">
                    <AppImage
                      src={company.logoUrl}
                      alt={storeName}
                      fill
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 text-primary shadow-2xs group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <Laptop className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate block">
                    {storeName}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[220px] sm:max-w-xs">
                    {storeSlogan}
                  </p>
                </div>
              </Link>
            </div>

            {/* Buscador Central Pro con acento de marca */}
            <form onSubmit={handleSearchSubmit} className="hidden sm:flex flex-1 max-w-xl mx-2 md:mx-4">
              <div className="relative w-full flex items-center rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-inner overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
                <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos, marcas o modelos..."
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1"
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors shrink-0 shadow-xs"
                >
                  Buscar
                </button>
              </div>
            </form>

            {/* Accesos a la derecha: Reubicado Ofertas, WhatsApp, Perfil, Modo Oscuro y Carrito */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Botón Reubicado y Prominente de Ofertas */}
              <Link
                href={`${prefix}/ofertas`}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white px-3 py-1.5 text-xs font-black shadow-xs hover:shadow-md transition-all active:scale-95 shrink-0"
                title="Ver Ofertas Especiales"
              >
                <Flame className="h-4 w-4 fill-current text-amber-200 animate-pulse" />
                <span>Ofertas</span>
              </Link>

              {phoneClean && (
                <a
                  href={`https://wa.me/${phoneClean}?text=Hola,%20tengo%20una%20consulta%20por%20un%20producto`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 px-3 py-1.5 text-xs font-bold text-[#1da851] dark:text-[#25D366] transition-all"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>Ventas WhatsApp</span>
                </a>
              )}

              {/* ── Menú de Perfil / Cuenta de Usuario ── */}
              {hydrated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white transition-all shadow-2xs"
                      aria-label="Mi Perfil"
                    >
                      <Avatar className="h-6 w-6 border border-slate-300 dark:border-slate-600">
                        <AvatarImage src={user.profile?.avatar_url || ''} alt={user.profile?.name || 'Usuario'} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden lg:inline font-bold text-xs max-w-[100px] truncate">
                        {user.profile?.name?.split(' ')[0] || 'Mi Perfil'}
                      </span>
                      <ChevronDown className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60 p-2 shadow-xl rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 z-50" align="end" sideOffset={8}>
                    <DropdownMenuLabel className="p-1">
                      <div className="flex items-center gap-2.5 px-1 py-1">
                        <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700">
                          <AvatarImage src={user.profile?.avatar_url || ''} alt={user.profile?.name || 'Usuario'} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                            {userInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{user.profile?.name || 'Usuario'}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                    <DropdownMenuItem asChild className="focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white cursor-pointer">
                      <Link href={prefix ? `${prefix}/perfil` : '/perfil'} className="flex items-center gap-2 text-xs font-medium">
                        <User className="h-4 w-4 text-primary" />
                        <span>Ver Mi Perfil</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white cursor-pointer">
                      <Link href={prefix ? `${prefix}/track` : '/track'} className="flex items-center gap-2 text-xs font-medium">
                        <Truck className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span>Rastrear Pedidos</span>
                      </Link>
                    </DropdownMenuItem>
                    {prefix && (
                      <DropdownMenuItem asChild className="focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white cursor-pointer">
                        <Link href={`${prefix}/perfil/autorizados`} className="flex items-center gap-2 text-xs font-medium">
                          <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          <span>Personas Autorizadas</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canAccessDashboard && (
                      <>
                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                        <DropdownMenuItem asChild className="focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white cursor-pointer">
                          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-primary">
                            <LayoutDashboard className="h-4 w-4" />
                            <span>Panel Administrativo</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                    <DropdownMenuItem
                      onClick={() => setLogoutOpen(true)}
                      className="focus:bg-rose-500/10 focus:text-rose-600 text-rose-600 dark:text-rose-400 cursor-pointer text-xs font-medium"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      <span>Cerrar Sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white transition-all shadow-2xs"
                      aria-label="Mi Perfil"
                    >
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span className="hidden sm:inline">Mi Perfil</span>
                      <ChevronDown className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 p-2 shadow-xl rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 z-50" align="end" sideOffset={8}>
                    <DropdownMenuLabel className="p-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Acceso a tu cuenta</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Iniciá sesión para ver tus compras</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                    <DropdownMenuItem
                      onClick={() => setAuthOpen(true)}
                      className="focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white cursor-pointer text-xs font-bold text-primary"
                    >
                      <User className="h-4 w-4 mr-2" />
                      <span>Iniciar sesión / Registro</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white cursor-pointer">
                      <Link href={prefix ? `${prefix}/track` : '/track'} className="flex items-center gap-2 text-xs font-medium">
                        <Truck className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span>Rastrear Pedido</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Selector de Modo Claro / Oscuro */}
              {hydrated && (
                <div className="flex items-center text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                  <ThemeToggle />
                </div>
              )}

              {/* El botón se oculta solo cuando la tienda vende por WhatsApp */}
              {hydrated && <PublicCartButton />}
            </div>
          </div>

          {/* Buscador móvil */}
          <form onSubmit={handleSearchSubmit} className="sm:hidden mt-3">
            <div className="relative w-full flex items-center rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-primary">
              <Search className="absolute left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos de tecnología..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
              />
              <button
                type="submit"
                className="bg-primary text-primary-foreground px-3 py-2 text-xs font-bold"
              >
                Buscar
              </button>
            </div>
          </form>
        </div>

        {/* ── 3. Barra de Navegación: Ofertas al inicio + Catálogo + Categorías de la Organización ── */}
        <div className="border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-none">
              {/* Ofertas reubicado al inicio de la barra */}
              <Link
                href={`${prefix}/ofertas`}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black transition-all shrink-0 shadow-2xs',
                  pathname === `${prefix}/ofertas`
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 ring-offset-1'
                    : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white'
                )}
              >
                <Flame className="h-3.5 w-3.5 fill-current text-amber-200" />
                <span>OFERTAS RELÁMPAGO</span>
              </Link>

              {/* Catálogo Completo */}
              <Link
                href={`${prefix}/productos`}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shrink-0',
                  pathname === `${prefix}/productos` && !activeCategoryId
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-slate-700 hover:bg-primary/10 hover:text-primary dark:text-slate-300 dark:hover:bg-primary/20 dark:hover:text-primary'
                )}
              >
                <span>Catálogo Completo</span>
              </Link>

              {/* Categorías reales existentes de la organización con iconos mejorados */}
              {hydrated && navCategories.map((item) => {
                const Icon = item.icon
                const isActive = pathname === `${prefix}/productos` && activeCategoryId === item.id
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shrink-0',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-slate-700 hover:bg-primary/10 hover:text-primary dark:text-slate-300 dark:hover:bg-primary/20 dark:hover:text-primary'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Menú desplegable móvil */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-2 text-slate-900 dark:text-slate-100">
            {/* Sección de usuario en móvil */}
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
              {hydrated && user ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700">
                      <AvatarImage src={user.profile?.avatar_url || ''} alt={user.profile?.name || 'Usuario'} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.profile?.name || 'Usuario'}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); setLogoutOpen(true) }}
                    className="text-rose-600 dark:text-rose-400 p-1 text-xs font-bold hover:underline"
                  >
                    Salir
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setAuthOpen(true) }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-xs"
                >
                  <User className="h-4 w-4" />
                  <span>Iniciar sesión / Registro</span>
                </button>
              )}
            </div>

            {/* Ofertas reubicado arriba en móvil */}
            <Link
              href={`${prefix}/ofertas`}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 text-white px-3 py-2 text-sm font-black shadow-xs"
            >
              <Flame className="h-4 w-4 fill-current text-amber-200" />
              <span>Ofertas Relámpago</span>
            </Link>

            <Link
              href={`${prefix}/productos`}
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white hover:bg-primary/10 hover:text-primary"
            >
              Catálogo Completo
            </Link>

            {hydrated &&
              navCategories.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 dark:hover:text-primary"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  <span>{item.label}</span>
                </Link>
              ))}

            {/* Selector de Modo Claro / Oscuro en Móvil */}
            {hydrated && (
              <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                <span className="text-xs font-semibold">Tema visual</span>
                <ThemeToggle />
              </div>
            )}
          </div>
        )}
      </header>

      {/* Modal de Autenticación */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        loginHref={customerLoginHref}
        registerHref={customerRegisterHref}
      />

      {/* Diálogo de Confirmación de Cierre de Sesión */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a salir de tu cuenta en esta tienda. Podés volver a iniciar sesión cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isLoggingOut ? 'Cerrando...' : 'Cerrar sesión'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
