'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { AppImage } from '@/components/ui/app-image'
import { usePathname } from 'next/navigation'
import {
  Search,
  Menu,
  User,
  UserPlus,
  LogIn,
  LogOut,
  ChevronDown,
  Phone,
  Mail,
  X,
  ArrowRight,
  Tag,
  ShoppingBag,
  Heart,
  Truck,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { useAuth } from '@/contexts/auth-context'
import { canOpenDashboard, loginHrefWithReturn } from '@/lib/auth/dashboard-access'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'

export function WholesaleHeader({ settings }: { settings: WebsiteSettings | null }) {
  const pathname = usePathname()
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? '/' + slug : ''
  const { categories } = usePublicCategories()
  const company = settings?.company_info
  const catalog = prefix + '/productos'
  const categoryHref = (id: string) => catalog + '?category_id=' + encodeURIComponent(id)

  const { user, signOut } = useAuth()
  const canAccessDashboard = canOpenDashboard(user)

  const loginHref = loginHrefWithReturn(slug ? prefix + '/cliente/login' : '/login', pathname, slug ? 'next' : 'redirect')
  const registerHref = slug ? prefix + '/cliente/registro' : '/registro'
  const profileHref = prefix + '/perfil'
  const ordersHref = prefix + '/perfil?tab=orders'
  const favoritesHref = prefix + '/favoritos'
  const trackHref = prefix + '/track'

  const userInitials = useMemo(() => {
    if (!user?.profile?.name) return 'U'
    return user.profile.name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [user])

  const brands = useMemo(() => {
    return settings?.brands_section?.enabled && settings.brands_section.showOnHome !== false
      ? settings.brands_section.items.filter((x) => x.active && x.name.trim())
      : []
  }, [settings])

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  // Estados para el Mega Menú interactivo estilo B2B (MobileSentrix)
  const [activeMegaCategoryId, setActiveMegaCategoryId] = useState<string>('')
  const [megaSearchQuery, setMegaSearchQuery] = useState('')

  // Estados para el Menú de Marcas interactivo estilo B2B (MobileSentrix)
  const [activeBrandId, setActiveBrandId] = useState<string>('')
  const [brandSearchQuery, setBrandSearchQuery] = useState('')
  const [mobileCategoryQuery, setMobileCategoryQuery] = useState('')

  // Categoría y marca resueltas (con fallback a la primera sin efectos)
  const effectiveMegaCategoryId = activeMegaCategoryId || categories[0]?.id || ''
  const effectiveBrandId = activeBrandId || brands[0]?.id || ''

  // Categorías filtradas en el drawer móvil
  const filteredDrawerCategories = useMemo(() => {
    const q = mobileCategoryQuery.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.subcategories?.some((s) => s.name.toLowerCase().includes(q))
    )
  }, [categories, mobileCategoryQuery])

  // Reset mobile drawer when navigating to a new path
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setMobileDrawerOpen(false)
  }

  // Prevent background scroll when mobile drawer is open
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

  // Categoría seleccionada en el Mega Menú
  const activeMegaCategory = useMemo(() => {
    return categories.find((c) => c.id === effectiveMegaCategoryId) || categories[0] || null
  }, [categories, effectiveMegaCategoryId])

  // Subcategorías filtradas por la búsqueda rápida dentro del Mega Menú
  const filteredSubcategories = useMemo(() => {
    if (!activeMegaCategory?.subcategories) return []
    const q = megaSearchQuery.trim().toLowerCase()
    if (!q) return activeMegaCategory.subcategories
    return activeMegaCategory.subcategories.filter((sub) =>
      sub.name.toLowerCase().includes(q)
    )
  }, [activeMegaCategory, megaSearchQuery])

  // Marca seleccionada en el menú de marcas
  const activeBrand = useMemo(() => {
    return brands.find((b) => b.id === effectiveBrandId) || brands[0] || null
  }, [brands, effectiveBrandId])

  // Rubros de marcas filtrados por búsqueda rápida
  const filteredBrandCategories = useMemo(() => {
    const q = brandSearchQuery.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, brandSearchQuery])

  return (
    <header className="relative z-30 border-b bg-background text-foreground" data-wholesale-header>
      {/* ── 1. Top utility bar (Desktop) ── */}
      {company?.showTopBar !== false && (company?.phone || company?.email) && (
        <div className="border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {company.phone && (
                <a
                  href={'tel:' + company.phone.replace(/[^+0-9]/g, '')}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Phone className="h-3 w-3 shrink-0" aria-hidden />
                  <span>{company.phone}</span>
                </a>
              )}
              {company.email && (
                <a
                  href={'mailto:' + company.email}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Mail className="h-3 w-3 shrink-0" aria-hidden />
                  <span>{company.email}</span>
                </a>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-4 text-xs font-medium">
              {user ? (
                <div className="flex items-center gap-3">
                  <Link
                    href={profileHref}
                    className="font-semibold text-foreground hover:underline transition-colors"
                  >
                    Hola, {user.profile?.name?.split(' ')[0] || 'Mi cuenta'}
                  </Link>
                  <span className="text-border" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="text-muted-foreground hover:text-destructive transition-colors text-xs font-medium"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Link
                    href={loginHref}
                    className="transition-colors hover:text-foreground font-medium"
                  >
                    Iniciar sesión
                  </Link>
                  <span className="text-border" aria-hidden="true">|</span>
                  <Link
                    href={registerHref}
                    className="font-bold text-primary transition-colors hover:underline"
                  >
                    Registrate como cliente
                  </Link>
                </div>
              )}
              {company.phone && (
                <a
                  href={'https://wa.me/' + company.phone.replace(/\D/g, '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary transition-colors hover:underline"
                >
                  Atención comercial
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Main Header ── */}
      <div className="mx-auto max-w-7xl px-4 py-3 sm:py-3.5">
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-6">
          {/* Left: Mobile trigger & Logo */}
          <div className="flex items-center gap-3 order-1">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Abrir menú de navegación"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-foreground transition-colors hover:bg-muted lg:hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <Link
              href={prefix + '/inicio'}
              className="flex shrink-0 items-center truncate text-xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-90 focus-visible:outline-primary"
            >
              {company?.logoUrl ? (
                <AppImage
                  src={company.logoUrl}
                  alt={company.name || 'Tienda'}
                  width={190}
                  height={46}
                  className="max-h-11 max-w-[170px] sm:max-w-[210px] object-contain"
                />
              ) : (
                <span className="truncate">{company?.name || 'Tienda'}</span>
              )}
            </Link>
          </div>

          {/* Center: Dominant search form (Responsive: Row 2 on mobile, Center on desktop) */}
          <form
            action={catalog}
            role="search"
            className="order-3 lg:order-2 w-full lg:w-auto lg:flex-1 lg:max-w-2xl lg:mx-auto group flex min-w-0 items-center overflow-hidden rounded-lg border border-border bg-background shadow-xs transition-all hover:border-foreground/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
          >
            <label htmlFor="wholesale-search" className="sr-only">
              Buscar por producto, SKU, descripción o marca
            </label>
            <div className="flex items-center pl-3.5 pr-1 text-muted-foreground group-focus-within:text-primary">
              <Search className="h-4 w-4" aria-hidden />
            </div>
            <input
              id="wholesale-search"
              name="query"
              type="search"
              placeholder="Buscar por producto, SKU, descripción o marca"
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 sm:py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="m-1 rounded-md bg-primary px-4 sm:px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Buscar
            </button>
          </form>

          {/* Right actions: Account & Cart */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3 order-2 lg:order-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden sm:inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition-all hover:bg-muted hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Menú de mi cuenta"
                  >
                    <Avatar className="h-6 w-6 border border-border/80">
                      <AvatarImage src={user.profile?.avatar_url || ''} alt={user.profile?.name || 'Usuario'} />
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[110px] truncate text-left leading-tight">
                      <span className="block text-[10px] font-normal text-muted-foreground">Hola,</span>
                      <span className="block font-bold truncate">{user.profile?.name?.split(' ')[0] || 'Mi cuenta'}</span>
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-2 shadow-2xl rounded-2xl border-border/80 bg-background/95 backdrop-blur-md" align="end" sideOffset={8}>
                  <DropdownMenuLabel className="font-normal p-1.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9 border border-border shadow-xs">
                        <AvatarImage src={user.profile?.avatar_url || ''} alt={user.profile?.name || 'Usuario'} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{userInitials}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <p className="text-xs font-bold leading-tight truncate text-foreground">
                          {user.profile?.name || 'Cliente'}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {user.email || ''}
                        </p>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-3 w-3" />
                          Cuenta verificada
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={profileHref} className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer">
                      <User className="h-4 w-4 text-primary" aria-hidden />
                      <span>Mi perfil y datos</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={ordersHref} className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <span>Mis compras y pedidos</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={favoritesHref} className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer">
                      <Heart className="h-4 w-4 text-rose-500" aria-hidden />
                      <span>Mis favoritos</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={trackHref} className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer">
                      <Truck className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <span>Rastrear pedido</span>
                    </Link>
                  </DropdownMenuItem>
                  {canAccessDashboard && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-bold text-primary cursor-pointer">
                          <LayoutDashboard className="h-4 w-4" aria-hidden />
                          <span>Panel de control</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void signOut()}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden sm:inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Acceso a Mi cuenta"
                  >
                    <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="text-left leading-tight">
                      <span className="block text-[10px] font-normal text-muted-foreground">Acceso</span>
                      <span className="block font-bold">Mi cuenta</span>
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 p-3.5 shadow-2xl rounded-2xl border-border/80 bg-background/95 backdrop-blur-md" align="end" sideOffset={8}>
                  <div className="space-y-1 pb-2.5">
                    <p className="text-xs font-bold text-foreground">Acceso clientes mayoristas y retail</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Iniciá sesión o registrate para consultar listas de precios y tus compras.
                    </p>
                  </div>

                  <div className="grid gap-2 pt-1 pb-2">
                    <Link
                      href={loginHref}
                      className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                      <LogIn className="h-3.5 w-3.5" aria-hidden />
                      <span>Iniciar sesión</span>
                    </Link>
                    <Link
                      href={registerHref}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted hover:text-primary"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden />
                      <span>Crear cuenta nueva</span>
                    </Link>
                  </div>

                  <DropdownMenuSeparator />

                  <div className="space-y-0.5 pt-1">
                    <DropdownMenuItem asChild>
                      <Link href={loginHref} className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground/80 hover:text-foreground cursor-pointer">
                        <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        <span>Mis compras y pedidos</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={favoritesHref} className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground/80 hover:text-foreground cursor-pointer">
                        <Heart className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        <span>Lista de favoritos</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={trackHref} className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground/80 hover:text-foreground cursor-pointer">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        <span>Rastrear pedido</span>
                      </Link>
                    </DropdownMenuItem>
                    {company?.phone && (
                      <DropdownMenuItem asChild>
                        <a
                          href={'https://wa.me/' + company.phone.replace(/\D/g, '') + '?text=' + encodeURIComponent('Hola! Me gustaría solicitar la lista de precios mayorista.')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          <span>Pedir lista mayorista por WhatsApp</span>
                        </a>
                      </DropdownMenuItem>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Acceso móvil directo a Mi cuenta */}
            <Link
              href={user ? profileHref : loginHref}
              aria-label={user ? 'Mi perfil' : 'Iniciar sesión'}
              className="flex sm:hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              {user ? (
                <Avatar className="h-6 w-6 border border-border/80">
                  <AvatarImage src={user.profile?.avatar_url || ''} alt={user.profile?.name || 'Usuario'} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <User className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </Link>

            <PublicCartButton />
          </div>
        </div>
      </div>

      {/* ── 3. Category Navigation & B2B Mega Menu (Estilo MobileSentrix) ── */}
      <nav aria-label="Catálogo mayorista y minorista" className="border-t bg-muted/20">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1.5 text-sm">
          {/* Mobile Horizontal Category Rail (Touch swipeable para celulares y tablets) */}
          <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 w-full">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary border border-primary/25 shadow-2xs hover:bg-primary/20 transition-colors"
              aria-label="Abrir menú de categorías"
            >
              <Menu className="h-3.5 w-3.5" aria-hidden />
              <span>Departamentos</span>
            </button>

            {categories.slice(0, 10).map((cat) => (
              <Link
                key={cat.id}
                href={categoryHref(cat.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-muted transition-colors"
              >
                <span className="truncate max-w-[130px]">{cat.name}</span>
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-semibold">
                    {cat.subcategories.length}
                  </span>
                )}
              </Link>
            ))}

            {brands.length > 0 && (
              <a
                href="#wholesale-brands"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:bg-muted transition-colors"
              >
                <span>🏷 Marcas</span>
              </a>
            )}

            {settings?.offers_section?.enabled && (
              <Link
                href={prefix + '/ofertas'}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-300/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400"
              >
                <Tag className="h-3 w-3" aria-hidden />
                <span>Ofertas</span>
              </Link>
            )}

            <Link
              href={catalog}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:underline"
            >
              <span>Ver todo</span>
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>

          {/* Desktop Mega Menu Dropdown con Split Layout (MobileSentrix) */}
          {categories.length > 0 && (
            <details className="hidden lg:block group relative">
              <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring">
                <Menu className="h-3.5 w-3.5" aria-hidden />
                <span>Todas las categorías</span>
                <ChevronDown className="h-3 w-3 transition-transform duration-200 group-open:rotate-180" aria-hidden />
              </summary>

              <div className="absolute left-0 top-full z-50 mt-1.5 max-h-[75vh] w-[min(94vw,68rem)] overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl backdrop-blur-md">
                {/* Buscador superior del Mega Menú (Estilo MobileSentrix) */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <input
                      type="text"
                      value={megaSearchQuery}
                      onChange={(e) => setMegaSearchQuery(e.target.value)}
                      placeholder="Buscar por subrubro o serie…"
                      className="w-full rounded-full border border-border/80 bg-background pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                    />
                    {megaSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMegaSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Limpiar filtro"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <Link
                    href={catalog}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
                  >
                    <span>Ver catálogo completo</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>

                {/* Split View: Columna izquierda de Departamentos + Grilla multiecolumna derecha */}
                <div className="flex flex-col md:flex-row min-h-[320px] max-h-[58vh]">
                  {/* Columna Izquierda (Sidebar de Departamentos / Series) */}
                  <div
                    className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border/70 p-2.5 overflow-y-auto bg-muted/15 space-y-1"
                    role="tablist"
                    aria-label="Departamentos del catálogo"
                  >
                    {categories.map((category) => {
                      const isSelected = category.id === (activeMegaCategory?.id ?? '')
                      return (
                        <button
                          key={category.id}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => setActiveMegaCategoryId(category.id)}
                          onMouseEnter={() => setActiveMegaCategoryId(category.id)}
                          className={cn(
                            'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-all',
                            isSelected
                              ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                              : 'text-foreground/80 hover:bg-muted hover:text-foreground font-medium'
                          )}
                        >
                          <span className="truncate">{category.name}</span>
                          {category.subcategories && category.subcategories.length > 0 && (
                            <span className="ml-1 text-[10px] text-muted-foreground/80 shrink-0">
                              {category.subcategories.length}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Columna Derecha (Multiecolumna de modelos/subítems en 3 a 5 columnas) */}
                  <div className="flex-1 p-5 overflow-y-auto bg-background space-y-4">
                    {activeMegaCategory ? (
                      <>
                        <div className="flex items-center justify-between border-b pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-sm font-bold tracking-tight text-foreground">
                              {activeMegaCategory.name}
                            </h3>
                            {activeMegaCategory.subcategories && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                {activeMegaCategory.subcategories.length} subrubros
                              </span>
                            )}
                          </div>
                          <Link
                            href={categoryHref(activeMegaCategory.id)}
                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            <span>Ver todo en {activeMegaCategory.name}</span>
                            <ArrowRight className="h-3 w-3" aria-hidden />
                          </Link>
                        </div>

                        {/* Grilla 3-5 columnas compacta tipo MobileSentrix */}
                        {filteredSubcategories.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2">
                            {filteredSubcategories.map((sub, idx) => (
                              <Link
                                key={sub.id}
                                href={categoryHref(sub.id)}
                                aria-label={sub.name}
                                className="group/sub flex items-center justify-between gap-1.5 rounded py-1 px-1.5 text-xs text-foreground/85 transition-colors hover:bg-muted/60 hover:text-primary"
                              >
                                <span className="truncate group-hover/sub:underline underline-offset-2">
                                  {sub.name}
                                </span>
                                {idx % 5 === 0 && (
                                  <span aria-hidden="true" className="shrink-0 rounded bg-emerald-500/15 px-1 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                    new
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="py-10 text-center text-xs text-muted-foreground space-y-2">
                            <p>
                              {megaSearchQuery
                                ? `No se encontraron subrubros que coincidan con "${megaSearchQuery}".`
                                : `No hay subrubros específicos para ${activeMegaCategory.name}.`}
                            </p>
                            <Link
                              href={categoryHref(activeMegaCategory.id)}
                              className="inline-block font-semibold text-primary underline"
                            >
                              Explorar productos de {activeMegaCategory.name}
                            </Link>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Seleccioná un departamento a la izquierda para explorar sus subcategorías.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </details>
          )}

          {/* Quick horizontal categories with submenus (Desktop) */}
          <div className="hidden lg:flex items-center gap-1">
            {categories.slice(0, 6).map((category) => {
              const hasSubs = Boolean(category.subcategories && category.subcategories.length > 0)
              if (!hasSubs) {
                return (
                  <Link
                    key={category.id}
                    href={categoryHref(category.id)}
                    className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {category.name}
                  </Link>
                )
              }

              return (
                <div key={category.id} className="group relative">
                  <Link
                    href={categoryHref(category.id)}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring group-hover:text-primary group-hover:bg-muted/70"
                  >
                    <span>{category.name}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-hover:rotate-180" aria-hidden />
                  </Link>

                  {/* Submenu flyout */}
                  <div className="invisible group-hover:visible group-focus-within:visible opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 absolute left-0 top-full z-50 pt-1.5 min-w-[240px]">
                    <div className="rounded-xl border border-border/80 bg-background/95 backdrop-blur-md p-2.5 shadow-xl">
                      <Link
                        href={categoryHref(category.id)}
                        className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                      >
                        <span>Ver todo en {category.name}</span>
                        <ArrowRight className="h-3 w-3" aria-hidden />
                      </Link>
                      <div className="my-1 border-t border-border/50" />
                      <div className="space-y-0.5 max-h-60 overflow-y-auto">
                        {category.subcategories!.map((sub) => (
                          <Link
                            key={sub.id}
                            href={categoryHref(sub.id)}
                            aria-label={`${category.name}: ${sub.name}`}
                            className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Menú interactivo de Marcas estilo B2B (MobileSentrix) */}
          {brands.length > 0 && (
            <div className="group relative hidden lg:block">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring group-hover:text-primary group-hover:bg-muted/70"
              >
                <Tag className="h-3 w-3 text-primary" aria-hidden />
                <span>Marcas</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-hover:rotate-180" aria-hidden />
              </button>

              <div className="invisible group-hover:visible group-focus-within:visible opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 absolute left-0 top-full z-50 pt-1.5 w-[min(94vw,66rem)]">
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl backdrop-blur-md">
                  {/* Buscador superior de Marcas */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      <input
                        type="text"
                        value={brandSearchQuery}
                        onChange={(e) => setBrandSearchQuery(e.target.value)}
                        placeholder="Buscar por departamento para marcas…"
                        className="w-full rounded-full border border-border/80 bg-background pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                      />
                      {brandSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setBrandSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label="Limpiar filtro"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <Link
                      href={catalog}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Ver todas las marcas</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>

                  {/* Split View: Columna izquierda con Marcas + Panel derecho con rubros de esa marca */}
                  <div className="flex flex-col md:flex-row min-h-[300px] max-h-[56vh]">
                    {/* Columna Izquierda: Lista de Marcas */}
                    <div
                      className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border/70 p-2.5 overflow-y-auto bg-muted/15 space-y-1"
                      role="tablist"
                      aria-label="Marcas disponibles"
                    >
                      {brands.map((brand) => {
                        const isSelected = brand.id === (activeBrand?.id ?? '')
                        return (
                          <button
                            key={brand.id}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => setActiveBrandId(brand.id)}
                            onMouseEnter={() => setActiveBrandId(brand.id)}
                            className={cn(
                              'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all',
                              isSelected
                                ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                                : 'text-foreground/80 hover:bg-muted hover:text-foreground font-medium'
                            )}
                          >
                            {brand.imageUrl ? (
                              <AppImage
                                src={brand.imageUrl}
                                alt={brand.name}
                                width={20}
                                height={20}
                                className="h-4 w-4 object-contain grayscale"
                              />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                            )}
                            <span className="truncate">{brand.name}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Columna Derecha: Rubros de la marca seleccionada en multiecolumna */}
                    <div className="flex-1 p-5 overflow-y-auto bg-background space-y-4">
                      {activeBrand ? (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                            <div className="flex items-center gap-3">
                              {activeBrand.imageUrl ? (
                                <div className="flex h-10 w-20 items-center justify-center rounded-md border border-border/60 bg-muted/20 p-1">
                                  <AppImage
                                    src={activeBrand.imageUrl}
                                    alt={activeBrand.name}
                                    width={70}
                                    height={30}
                                    className="max-h-7 max-w-full object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 font-bold text-xs text-primary">
                                  {activeBrand.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-bold text-foreground">{activeBrand.name}</h3>
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    Marca destacada
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  Filtros directos por departamento y catálogo oficial.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Link
                                href={catalog + '?marca=' + encodeURIComponent(activeBrand.name)}
                                className="inline-flex min-h-8 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
                              >
                                <span>Ver catálogo de {activeBrand.name}</span>
                                <ArrowRight className="h-3 w-3" aria-hidden />
                              </Link>
                            </div>
                          </div>

                          {/* Rubros de la marca en multiecolumna */}
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Departamentos de {activeBrand.name}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2">
                              <Link
                                href={catalog + '?marca=' + encodeURIComponent(activeBrand.name)}
                                className="block rounded py-1 px-1.5 text-xs font-semibold text-primary hover:underline"
                              >
                                Todo {activeBrand.name}
                              </Link>
                              {filteredBrandCategories.map((cat) => (
                                <Link
                                  key={cat.id}
                                  href={`${catalog}?marca=${encodeURIComponent(activeBrand.name)}&category_id=${encodeURIComponent(cat.id)}`}
                                  aria-label={`${cat.name} en ${activeBrand.name}`}
                                  className="block rounded py-1 px-1.5 text-xs text-foreground/80 hover:bg-muted/60 hover:text-primary transition-colors truncate"
                                >
                                  {cat.name}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                          Seleccioná una marca a la izquierda.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick horizontal scroll pills (Mobile / Tablet) */}
          <div className="flex lg:hidden flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {categories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                href={categoryHref(category.id)}
                className="whitespace-nowrap rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-foreground/80 hover:border-primary/50 hover:text-foreground transition-colors"
              >
                {category.name}
              </Link>
            ))}
          </div>

          {/* Offers button if enabled */}
          {settings?.offers_section?.enabled && (
            <Link
              href={prefix + '/ofertas'}
              className="ml-auto lg:ml-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ofertas
            </Link>
          )}

          {/* All catalog link (Desktop) */}
          <Link
            href={catalog}
            className="hidden sm:inline-flex items-center gap-1 ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-primary hover:underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>Todo el catálogo</span>
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </nav>

      {/* ── 4. Mobile Navigation Drawer ── */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú principal de categorías"
          className="fixed inset-0 z-50 flex lg:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative flex w-full max-w-xs flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3.5">
              <span className="font-bold text-sm tracking-tight text-foreground">Menú y Departamentos</span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* Account shortcut */}
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-3">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={user.profile?.avatar_url || ''} alt={user.profile?.name || 'Usuario'} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{userInitials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-foreground">{user.profile?.name || 'Cliente'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email || ''}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                      <Link
                        href={profileHref}
                        onClick={() => setMobileDrawerOpen(false)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:text-primary"
                      >
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span>Mi perfil</span>
                      </Link>
                      <Link
                        href={ordersHref}
                        onClick={() => setMobileDrawerOpen(false)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:text-primary"
                      >
                        <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Mis pedidos</span>
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileDrawerOpen(false)
                        void signOut()
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-foreground">Acceso clientes mayoristas y retail</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Iniciá sesión o registrate para consultar listas y gestionar pedidos.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href={loginHref}
                        onClick={() => setMobileDrawerOpen(false)}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        <span>Iniciar sesión</span>
                      </Link>
                      <Link
                        href={registerHref}
                        onClick={() => setMobileDrawerOpen(false)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <UserPlus className="h-3.5 w-3.5 text-primary" />
                        <span>Crear cuenta</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Direct links */}
              <div className="space-y-1">
                <Link
                  href={prefix + '/inicio'}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="block rounded-md px-2.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Inicio
                </Link>
                <Link
                  href={catalog}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="block rounded-md px-2.5 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  Ver todo el catálogo
                </Link>
                {settings?.offers_section?.enabled && (
                  <Link
                    href={prefix + '/ofertas'}
                    onClick={() => setMobileDrawerOpen(false)}
                    className="block rounded-md px-2.5 py-2 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    Ofertas y Liquidación
                  </Link>
                )}
              </div>

              {/* Categories list with interactive submenus */}
              {categories.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Departamentos</p>
                    <span className="text-[11px] text-muted-foreground">{categories.length} rubros</span>
                  </div>

                  {/* Buscador rápido en el drawer móvil */}
                  {categories.length > 1 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      <input
                        type="text"
                        value={mobileCategoryQuery}
                        onChange={(e) => setMobileCategoryQuery(e.target.value)}
                        placeholder="Buscar categoría o subrubro…"
                        className="w-full rounded-lg border border-border/80 bg-background pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                      />
                      {mobileCategoryQuery && (
                        <button
                          type="button"
                          onClick={() => setMobileCategoryQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                          aria-label="Limpiar búsqueda"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {filteredDrawerCategories.map((category) => {
                      const hasSubs = Boolean(category.subcategories && category.subcategories.length > 0)
                      const isExpanded = Boolean(expandedCategories[category.id] || mobileCategoryQuery.trim())

                      if (!hasSubs) {
                        return (
                          <div key={category.id} className="space-y-1">
                            <Link
                              href={categoryHref(category.id)}
                              onClick={() => setMobileDrawerOpen(false)}
                              className="flex items-center justify-between min-h-10 rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                            >
                              <span>{category.name}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
                            </Link>
                          </div>
                        )
                      }

                      return (
                        <div key={category.id} className="rounded-xl border border-border/50 bg-card/60 p-1.5 transition-all">
                          <div className="flex items-center justify-between min-h-10">
                            <Link
                              href={categoryHref(category.id)}
                              onClick={() => setMobileDrawerOpen(false)}
                              className="flex-1 rounded-md px-2.5 py-1.5 text-sm font-bold text-foreground hover:text-primary"
                            >
                              <span>{category.name}</span>
                              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-normal">
                                {category.subcategories!.length}
                              </span>
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCategories((prev) => ({
                                  ...prev,
                                  [category.id]: !prev[category.id],
                                }))
                              }
                              aria-label={`${isExpanded ? 'Ocultar' : 'Mostrar'} submenú de ${category.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <ChevronDown
                                className={cn('h-4 w-4 transition-transform duration-200', isExpanded && 'rotate-180')}
                                aria-hidden
                              />
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-1 space-y-1 border-t border-border/40 pt-2 pb-1 px-1">
                              <Link
                                href={categoryHref(category.id)}
                                onClick={() => setMobileDrawerOpen(false)}
                                className="flex items-center justify-between rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
                              >
                                <span>Ver todo en {category.name}</span>
                                <ArrowRight className="h-3 w-3" aria-hidden />
                              </Link>
                              <div className="grid grid-cols-1 gap-1 pt-1">
                                {category.subcategories!.map((sub) => (
                                  <Link
                                    key={sub.id}
                                    href={categoryHref(sub.id)}
                                    onClick={() => setMobileDrawerOpen(false)}
                                    className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                                  >
                                    <span>{sub.name}</span>
                                    <span className="text-[10px] text-muted-foreground">›</span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Brands in mobile drawer */}
              {brands.length > 0 && (
                <div className="space-y-2 pt-3 border-t">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marcas</p>
                    <span className="text-[11px] text-muted-foreground">{brands.length} disponibles</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {brands.map((brand) => (
                      <Link
                        key={brand.id}
                        href={catalog + '?marca=' + encodeURIComponent(brand.name)}
                        onClick={() => setMobileDrawerOpen(false)}
                        className="flex items-center gap-1.5 rounded-md border border-border/40 bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span className="truncate">{brand.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact info */}
              {(company?.phone || company?.email) && (
                <div className="space-y-2 pt-4 border-t text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Contacto de atención</p>
                  {company.phone && (
                    <a href={'tel:' + company.phone.replace(/[^+0-9]/g, '')} className="block hover:text-foreground">
                      {company.phone}
                    </a>
                  )}
                  {company.email && (
                    <a href={'mailto:' + company.email} className="block break-all hover:text-foreground">
                      {company.email}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
