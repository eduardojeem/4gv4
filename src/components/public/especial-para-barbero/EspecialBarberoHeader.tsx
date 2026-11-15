'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Clock,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Package,
  Phone,
  Scissors,
  Search,
  Shield,
  Sparkles,
  Store,
  Tag,
  Truck,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/public/SocialIcons'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/contexts/auth-context'
import { useHydrated } from '@/hooks/use-hydrated'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { canOpenDashboard, loginHrefWithReturn } from '@/lib/auth/dashboard-access'
import { socialProfileUrl } from '@/lib/public/social-links'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import { isPublicRepairsAvailable, isPublicServicesPageAvailable } from '@/lib/website/services'
import type { WebsiteSettings } from '@/types/website-settings'
import './especial-barbero.css'

interface EspecialBarberoHeaderProps {
  settings?: WebsiteSettings | null
  repairsModuleEnabled?: boolean
  servicesModuleEnabled?: boolean
}

export function EspecialBarberoHeader({
  settings: initialSettings = null,
  repairsModuleEnabled = false,
  servicesModuleEnabled = true,
}: EspecialBarberoHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hydrated = useHydrated()
  const { user, signOut } = useAuth()
  const { settings } = useWebsiteSettings()
  const effectiveSettings = settings ?? initialSettings
  const companyInfo = useStorefrontCompanyInfo(effectiveSettings?.company_info)
  const { categories } = usePublicCategories()

  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''
  const homeHref = prefix ? `${prefix}/inicio` : '/inicio'
  const catalogHref = `${prefix}/productos`

  const [searchQuery, setSearchQuery] = useState('')
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedMobileCategoryIds, setExpandedMobileCategoryIds] = useState<Record<string, boolean>>({})
  const [authOpen, setAuthOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const megaContainerRef = useRef<HTMLDivElement>(null)
  const closeMegaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const urlSearchValue = searchParams?.get('query') || searchParams?.get('q') || ''
  useEffect(() => {
    if (pathname.includes('/productos')) {
      setSearchQuery(urlSearchValue)
    }
  }, [pathname, urlSearchValue])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMegaMenuOpen(false)
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!megaMenuOpen && !mobileMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMegaMenuOpen(false)
        setMobileMenuOpen(false)
      }
    }
    const onOutside = (e: MouseEvent) => {
      if (megaMenuOpen && megaContainerRef.current && !megaContainerRef.current.contains(e.target as Node)) {
        setMegaMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
    }
  }, [megaMenuOpen, mobileMenuOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileMenuOpen])

  const storeName = companyInfo?.name?.trim() || 'Barber Supply'
  const storeSlogan = companyInfo?.slogan?.trim() || ''
  const logoUrl = companyInfo?.logoUrl?.trim() || ''
  const phoneDisplay = companyInfo?.phone?.trim() || ''
  const phoneClean = phoneDisplay.replace(/\D/g, '')
  const rawWhatsapp = (companyInfo?.whatsapp || companyInfo?.phone || '').trim()
  const whatsappClean = rawWhatsapp.replace(/\D/g, '')
  const whatsappUrl = whatsappClean ? `https://wa.me/${whatsappClean}` : ''
  const addressDisplay = companyInfo?.address?.trim() || ''
  const hoursDisplay = companyInfo?.hours?.weekdays?.trim() || ''
  const instagramUrl = companyInfo?.instagram ? socialProfileUrl(companyInfo.instagram, 'instagram') : ''
  const facebookUrl = companyInfo?.facebook ? socialProfileUrl(companyInfo.facebook, 'facebook') : ''
  const tiktokUrl = companyInfo?.tiktok ? socialProfileUrl(companyInfo.tiktok, 'tiktok') : ''
  const showTopBar = companyInfo?.showTopBar !== false

  const headerStyle = companyInfo?.headerStyle || 'dark'
  const isAccent = headerStyle === 'accent'
  const isSolid = headerStyle === 'solid' || headerStyle === 'glass'
  const isDarkChrome = !isAccent && !isSolid

  const rootCategories = useMemo(() => {
    const roots = (categories || []).filter((c) => !c.parent_id)
    const withProducts = roots.filter((c) => (c.productCount ?? 0) > 0)
    const pool = withProducts.length > 0 ? withProducts : roots
    return [...pool].sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0) || a.name.localeCompare(b.name))
  }, [categories])

  const activeCategoryId = pathname.includes('/productos') ? (searchParams?.get('category_id') || searchParams?.get('categoria')) : null
  const offersEnabled = effectiveSettings?.offers_section?.enabled !== false
  const servicesEnabled =
    servicesModuleEnabled &&
    isPublicServicesPageAvailable(companyInfo?.servicesPageEnabled, effectiveSettings?.services)
  const repairsEnabled =
    repairsModuleEnabled &&
    isPublicRepairsAvailable(companyInfo, effectiveSettings?.services)

  const canAccessDashboard = canOpenDashboard(user)
  const customerLoginHref = slug
    ? loginHrefWithReturn(`${prefix}/cliente/login`, pathname, 'next')
    : loginHrefWithReturn('/login', pathname, 'redirect')
  const customerRegisterHref = slug ? `${prefix}/cliente/registro` : '/register'

  const fullName = user?.profile?.name?.trim() || user?.email?.split('@')[0] || ''
  const firstName = fullName.split(/\s+/)[0] || 'Mi Cuenta'
  const userInitials = useMemo(() => {
    if (!fullName) return storeName.slice(0, 1).toUpperCase()
    return fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')
  }, [fullName, storeName])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    router.push(trimmed ? `${catalogHref}?query=${encodeURIComponent(trimmed)}` : catalogHref)
    setMobileMenuOpen(false)
    setMegaMenuOpen(false)
  }

  const openMega = () => {
    if (closeMegaTimeoutRef.current) clearTimeout(closeMegaTimeoutRef.current)
    setMegaMenuOpen(true)
  }

  const scheduleCloseMega = () => {
    if (closeMegaTimeoutRef.current) clearTimeout(closeMegaTimeoutRef.current)
    closeMegaTimeoutRef.current = setTimeout(() => setMegaMenuOpen(false), 140)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
      router.push(homeHref)
      router.refresh()
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    } finally {
      setIsLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  return (
    <header
      data-especial-barbero-header
      className={cn(
        'sticky top-0 z-40 w-full transition-shadow duration-200',
        scrolled && 'shadow-xl shadow-black/20'
      )}
    >
      {/* ── Borde superior dinámico con el color de la organización ── */}
      <div
        className="h-[3px] w-full"
        style={{
          background:
            'linear-gradient(90deg, var(--primary), color-mix(in oklch, var(--primary) 82%, #f97316 18%))',
        }}
      />

      {/* ── 1. Utility Top Bar (teléfono, WhatsApp vivo, horarios, redes) ── */}
      {showTopBar && (phoneDisplay || whatsappUrl || addressDisplay || hoursDisplay || instagramUrl || facebookUrl || tiktokUrl) && (
        <div
          className={cn(
            'border-b text-[11px] font-medium transition-colors',
            isAccent
              ? 'border-white/15 bg-black/20 text-primary-foreground/95'
              : isSolid
              ? 'border-border bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300'
              : 'border-white/10 bg-[#050507] text-zinc-300'
          )}
        >
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 ebs-pulse-dot" />
                  <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>WhatsApp directo</span>
                </a>
              )}
              {phoneDisplay && (
                <a
                  href={`tel:${phoneClean}`}
                  className={cn(
                    'inline-flex items-center gap-1.5 transition-colors hover:text-primary',
                    isAccent && 'hover:text-white'
                  )}
                >
                  <Phone className="h-3 w-3 text-primary shrink-0" />
                  <span>{phoneDisplay}</span>
                </a>
              )}
              {hoursDisplay && (
                <span className="hidden md:inline-flex items-center gap-1.5 truncate">
                  <Clock className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate">{hoursDisplay}</span>
                </span>
              )}
              {addressDisplay && (
                <span className="hidden xl:inline-flex items-center gap-1.5 truncate max-w-xs">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate">{addressDisplay}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`${prefix}/track`}
                className={cn(
                  'hidden sm:inline-flex items-center gap-1 transition-colors hover:text-primary',
                  isAccent && 'hover:text-white'
                )}
              >
                <Truck className="h-3 w-3" />
                <span>Rastrear pedido</span>
              </Link>

              {(instagramUrl || facebookUrl || tiktokUrl) && (
                <div className="flex items-center gap-1.5">
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="ebs-social-btn flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-current"
                    >
                      <InstagramIcon className="h-3 w-3" />
                    </a>
                  )}
                  {facebookUrl && (
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      className="ebs-social-btn flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-current"
                    >
                      <FacebookIcon className="h-3 w-3" />
                    </a>
                  )}
                  {tiktokUrl && (
                    <a
                      href={tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="TikTok"
                      className="ebs-social-btn flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-current"
                    >
                      <TikTokIcon className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Main Obsidian Bar: Logo + Wide Pill Search + Account / Cart ── */}
      <div
        className={cn(
          'border-b transition-colors',
          isAccent
            ? 'border-white/15 bg-primary text-primary-foreground'
            : isSolid
            ? 'border-border bg-background text-foreground'
            : 'border-white/10 bg-[#0B0B0F] text-white'
        )}
      >
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {/* Izquierda: Menú móvil + Identidad */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
              className={cn(
                'lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                isDarkChrome
                  ? 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                  : isAccent
                  ? 'border-white/25 bg-white/10 text-primary-foreground hover:bg-white/20'
                  : 'border-border bg-muted/40 text-foreground hover:bg-muted'
              )}
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href={homeHref} className="group flex items-center gap-3 min-w-0">
              {logoUrl ? (
                <div
                  className={cn(
                    'relative h-10 w-10 sm:h-11 sm:w-11 shrink-0 overflow-hidden rounded-xl border p-1 transition-transform duration-200 group-hover:scale-105',
                    isDarkChrome
                      ? 'border-primary/40 bg-white'
                      : 'border-border bg-white'
                  )}
                >
                  <AppImage src={logoUrl} alt={storeName} fill className="object-contain" />
                </div>
              ) : (
                <div
                  className={cn(
                    'flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl font-black shadow-sm transition-transform duration-200 group-hover:scale-105',
                    isAccent
                      ? 'bg-white text-primary'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  <Scissors className="h-5 w-5" />
                </div>
              )}

              <div className="min-w-0">
                <span className="block truncate text-base sm:text-xl font-black uppercase tracking-tight leading-none">
                  {storeName}
                </span>
                {storeSlogan && (
                  <span
                    className={cn(
                      'mt-0.5 block truncate text-[11px] font-medium max-w-[175px] sm:max-w-xs',
                      isDarkChrome
                        ? 'text-zinc-400'
                        : isAccent
                        ? 'text-primary-foreground/85'
                        : 'text-muted-foreground'
                    )}
                  >
                    {storeSlogan}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Centro: Buscador ancho tipo pill */}
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            aria-label="Buscar productos en la tienda"
            className="hidden md:flex flex-1 max-w-xl mx-3"
          >
            <div
              className={cn(
                'relative flex w-full items-center rounded-full border transition-all focus-within:ring-2 focus-within:ring-primary',
                isDarkChrome
                  ? 'border-white/15 bg-[#16161e] text-white focus-within:border-primary'
                  : isAccent
                  ? 'border-white/25 bg-white text-zinc-900'
                  : 'border-border bg-muted/40 text-foreground focus-within:border-primary'
              )}
            >
              <Search className="pointer-events-none ml-4 h-4 w-4 text-zinc-400 shrink-0" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar máquinas, trimmers, shavers, insumos..."
                className="w-full bg-transparent px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="mr-1.5 rounded-full p-1 text-zinc-400 hover:text-current"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="submit"
                className={cn(
                  'm-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider transition-all',
                  isAccent
                    ? 'bg-zinc-950 text-white hover:bg-zinc-800'
                    : 'bg-primary text-primary-foreground hover:brightness-110'
                )}
              >
                <span>Buscar</span>
              </button>
            </div>
          </form>

          {/* Derecha: Cuenta (Minorista / Mayorista) + Tema + Carrito */}
          <div className="flex items-center gap-2 shrink-0">
            {slug && (
              <Link
                href="/marketplace"
                aria-label="Volver al marketplace"
                className={cn(
                  'hidden lg:inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                  isDarkChrome
                    ? 'border-white/15 bg-white/5 text-white hover:border-primary hover:text-primary'
                    : isAccent
                    ? 'border-white/25 bg-white/15 text-primary-foreground hover:bg-white/25'
                    : 'border-border bg-background text-foreground hover:border-primary hover:text-primary'
                )}
              >
                <Store className="h-3.5 w-3.5" />
                <span>Marketplace</span>
              </Link>
            )}
            {hydrated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                      isDarkChrome
                        ? 'border-white/15 bg-white/5 text-white hover:border-primary/60 hover:bg-white/10'
                        : isAccent
                        ? 'border-white/25 bg-white/15 text-primary-foreground hover:bg-white/25'
                        : 'border-border bg-muted/40 text-foreground hover:bg-muted'
                    )}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.profile?.avatar_url || undefined} alt={fullName} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline max-w-[100px] truncate">{firstName}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{fullName || user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canAccessDashboard && (
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
                        <LayoutDashboard className="h-4 w-4" />
                        Panel de Control
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`${prefix}/perfil`} className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Mi Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`${prefix}/perfil?tab=orders`} className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Mis Pedidos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`${prefix}/favoritos`} className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Favoritos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setLogoutOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                    isDarkChrome
                      ? 'border-white/15 bg-white/5 text-white hover:border-primary hover:text-primary'
                      : isAccent
                      ? 'border-white/25 bg-white/15 text-primary-foreground hover:bg-white/25'
                      : 'border-border bg-background text-foreground hover:border-primary'
                  )}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Ingresar</span>
                </button>
                <Link
                  href={customerRegisterHref}
                  className={cn(
                    'hidden xl:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold transition-all',
                    isAccent
                      ? 'bg-white text-primary hover:bg-white/90'
                      : 'bg-primary text-primary-foreground hover:brightness-110'
                  )}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Mayorista / Registro</span>
                </Link>
              </div>
            )}

            <div className={cn('rounded-full', isDarkChrome && 'text-white')}>
              <ThemeToggle />
            </div>

            <PublicCartButton />
          </div>
        </div>

        {/* Buscador visible en móvil */}
        <div className="md:hidden border-t border-white/10 px-4 py-2">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar máquinas, insumos, marcas..."
              className={cn(
                'w-full rounded-full border py-2 pl-9 pr-20 text-xs focus:outline-none focus:ring-2 focus:ring-primary',
                isDarkChrome
                  ? 'border-white/15 bg-[#16161e] text-white placeholder:text-zinc-400'
                  : 'border-border bg-background text-foreground'
              )}
            />
            <button
              type="submit"
              className="absolute right-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* ── 3. Desktop Sub-Nav + 4-Column Animated Mega Menu ── */}
      <div
        ref={megaContainerRef}
        onMouseLeave={scheduleCloseMega}
        className={cn(
          'relative hidden lg:block border-b transition-colors',
          isDarkChrome
            ? 'border-white/10 bg-[#14141b] text-zinc-200'
            : isAccent
            ? 'border-black/15 bg-[#111116] text-zinc-100'
            : 'border-border bg-zinc-950 text-zinc-100'
        )}
      >
        <div className="container mx-auto flex items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
          {/* Botón disparador del Mega Menú */}
          <div onMouseEnter={openMega} className="relative">
            <button
              type="button"
              aria-expanded={megaMenuOpen}
              aria-haspopup="true"
              onClick={() => setMegaMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-black uppercase tracking-wider text-primary-foreground shadow-sm transition-transform hover:brightness-110 active:scale-95"
            >
              <Menu className="h-3.5 w-3.5" />
              <span>Todas las categorías</span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200',
                  megaMenuOpen && 'rotate-180'
                )}
              />
            </button>
          </div>

          {/* Tira horizontal de accesos rápidos y categorías reales */}
          <nav
            aria-label="Navegación principal de la tienda"
            className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-hide"
          >
            <Link
              href={homeHref}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                pathname === homeHref
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white'
              )}
            >
              Inicio
            </Link>
            <Link
              href={catalogHref}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                pathname === catalogHref && !activeCategoryId
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white'
              )}
            >
              Catálogo
            </Link>

            {rootCategories.slice(0, 6).map((cat) => {
              const selected = activeCategoryId === cat.id
              return (
                <Link
                  key={cat.id}
                  href={`${catalogHref}?category_id=${encodeURIComponent(cat.id)}`}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {cat.name}
                </Link>
              )
            })}

            {offersEnabled && (
              <Link
                href={`${prefix}/ofertas`}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors',
                  pathname.startsWith(`${prefix}/ofertas`)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-primary hover:bg-primary/15'
                )}
              >
                <Tag className="h-3 w-3" />
                <span>Ofertas</span>
              </Link>
            )}

            {servicesEnabled && (
              <Link
                href={`${prefix}/servicios`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <Briefcase className="h-3 w-3" />
                <span>Servicios</span>
              </Link>
            )}

            {repairsEnabled && (
              <Link
                href={`${prefix}/mis-reparaciones`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <Shield className="h-3 w-3" />
                <span>Reparaciones</span>
              </Link>
            )}
          </nav>
        </div>

        {/* ── Mega Menú de 4 Columnas animado ── */}
        {megaMenuOpen && (
          <div
            onMouseEnter={openMega}
            className="ebs-mega-panel absolute inset-x-0 top-full z-50 border-b border-primary/30 bg-[#111116] text-zinc-100 shadow-2xl shadow-black/60"
          >
            <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                {rootCategories.length > 0 ? (
                  rootCategories.slice(0, 12).map((cat) => (
                    <div
                      key={cat.id}
                      className="rounded-xl border border-white/10 bg-[#181820] p-3.5 transition-colors hover:border-primary/45"
                    >
                      <Link
                        href={`${catalogHref}?category_id=${encodeURIComponent(cat.id)}`}
                        onClick={() => setMegaMenuOpen(false)}
                        className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wider text-white hover:text-primary transition-colors"
                      >
                        <span className="truncate">{cat.name}</span>
                        {typeof cat.productCount === 'number' && cat.productCount > 0 && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {cat.productCount}
                          </span>
                        )}
                      </Link>

                      {cat.subcategories && cat.subcategories.length > 0 && (
                        <ul className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2">
                          {cat.subcategories.slice(0, 5).map((sub) => (
                            <li key={sub.id}>
                              <Link
                                href={`${catalogHref}?category_id=${encodeURIComponent(sub.id)}`}
                                onClick={() => setMegaMenuOpen(false)}
                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-primary transition-colors truncate"
                              >
                                <ChevronRight className="h-3 w-3 shrink-0 text-primary/70" />
                                <span className="truncate">{sub.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 rounded-xl border border-white/10 bg-[#181820] p-5 text-sm text-zinc-300">
                    Explorá el catálogo completo de productos disponibles.
                  </div>
                )}

                {/* Columna de acceso directo minorista / mayorista */}
                <div className="flex flex-col justify-between rounded-xl border border-primary/35 bg-gradient-to-br from-primary/20 via-[#181820] to-[#111116] p-4">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-foreground">
                      <Sparkles className="h-3 w-3" />
                      Minorista &amp; Mayorista
                    </span>
                    <h3 className="text-sm font-black uppercase tracking-tight text-white">
                      Todo el catálogo en {storeName}
                    </h3>
                    <p className="text-xs leading-relaxed text-zinc-300">
                      Accedé con tu cuenta para consultar precios mayoristas habilitados, ofertas activas y pedidos.
                    </p>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      href={catalogHref}
                      onClick={() => setMegaMenuOpen(false)}
                      className="inline-flex items-center justify-between rounded-full bg-primary px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-primary-foreground hover:brightness-110"
                    >
                      <span>Ver todos los productos</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    {offersEnabled && (
                      <Link
                        href={`${prefix}/ofertas`}
                        onClick={() => setMegaMenuOpen(false)}
                        className="inline-flex items-center justify-between rounded-full border border-white/20 px-4 py-1.5 text-xs font-bold text-white hover:border-primary hover:text-primary"
                      >
                        <span>Ofertas activas</span>
                        <Tag className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Mobile Drawer con acordeón de categorías ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-xs flex-col overflow-y-auto bg-[#0B0B0F] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
              <div className="flex items-center gap-2 min-w-0">
                <Scissors className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate text-sm font-black uppercase tracking-tight">
                  {storeName}
                </span>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 p-4">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={homeHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl border border-white/10 bg-[#16161e] px-3 py-2.5 text-xs font-bold text-white"
                >
                  Inicio
                </Link>
                <Link
                  href={catalogHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl bg-primary px-3 py-2.5 text-xs font-extrabold text-primary-foreground"
                >
                  Catálogo
                </Link>
                {offersEnabled && (
                  <Link
                    href={`${prefix}/ofertas`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl border border-primary/40 bg-primary/15 px-3 py-2.5 text-xs font-bold text-primary"
                  >
                    Ofertas
                  </Link>
                )}
                <Link
                  href={`${prefix}/track`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl border border-white/10 bg-[#16161e] px-3 py-2.5 text-xs font-bold text-zinc-200"
                >
                  Rastrear pedido
                </Link>
                {servicesEnabled && (
                  <Link
                    href={`${prefix}/servicios`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl border border-white/10 bg-[#16161e] px-3 py-2.5 text-xs font-bold text-zinc-200"
                  >
                    Servicios
                  </Link>
                )}
                {repairsEnabled && (
                  <Link
                    href={`${prefix}/mis-reparaciones`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl border border-white/10 bg-[#16161e] px-3 py-2.5 text-xs font-bold text-zinc-200"
                  >
                    Reparaciones
                  </Link>
                )}
              </div>

              {rootCategories.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-primary">
                    Categorías
                  </p>
                  <div className="space-y-1.5">
                    {rootCategories.map((cat) => {
                      const hasSubs = Boolean(cat.subcategories && cat.subcategories.length > 0)
                      const expanded = Boolean(expandedMobileCategoryIds[cat.id])
                      return (
                        <div key={cat.id} className="rounded-xl border border-white/10 bg-[#14141b]">
                          <div className="flex items-center justify-between">
                            <Link
                              href={`${catalogHref}?category_id=${encodeURIComponent(cat.id)}`}
                              onClick={() => setMobileMenuOpen(false)}
                              className="flex-1 px-3 py-2.5 text-xs font-bold text-zinc-100"
                            >
                              {cat.name}
                            </Link>
                            {hasSubs && (
                              <button
                                type="button"
                                aria-label={`Subcategorías de ${cat.name}`}
                                onClick={() =>
                                  setExpandedMobileCategoryIds((prev) => ({
                                    ...prev,
                                    [cat.id]: !prev[cat.id],
                                  }))
                                }
                                className="px-3 py-2.5 text-zinc-400 hover:text-primary"
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-4 w-4 transition-transform',
                                    expanded && 'rotate-180'
                                  )}
                                />
                              </button>
                            )}
                          </div>
                          {hasSubs && expanded && (
                            <div className="border-t border-white/10 px-3 py-2 space-y-1">
                              {cat.subcategories!.map((sub) => (
                                <Link
                                  key={sub.id}
                                  href={`${catalogHref}?category_id=${encodeURIComponent(sub.id)}`}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className="block py-1 text-xs text-zinc-400 hover:text-primary"
                                >
                                  {sub.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {!user && (
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      setAuthOpen(true)
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 py-2.5 text-xs font-bold text-white"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Iniciar sesión
                  </button>
                  <Link
                    href={customerRegisterHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-xs font-extrabold text-primary-foreground"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Cuenta mayorista / registro
                  </Link>
                </div>
              )}

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-xs font-extrabold text-white"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Consultar por WhatsApp
                </a>
              )}
            </div>
          </aside>
        </div>
      )}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        loginHref={customerLoginHref}
        registerHref={customerRegisterHref}
      />

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Hola <span className="font-semibold text-foreground">{firstName}</span>, ¿querés cerrar tu sesión?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoggingOut ? 'Cerrando...' : 'Sí, cerrar sesión'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* En el celular, la vuelta al marketplace va en una franja propia, como en las demás plantillas. */}
      {slug && (
        <div className="border-t border-primary-foreground/15 bg-primary text-primary-foreground lg:hidden">
          <Link
            href="/marketplace"
            aria-label="Volver al Marketplace"
            className="container mx-auto flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm font-bold transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground/70"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Volver al Marketplace</span>
          </Link>
        </div>
      )}
    </header>
  )
}
