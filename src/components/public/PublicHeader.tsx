'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Package, Store, Menu, X, Phone, User, Shield, Clock, LayoutDashboard, Truck, Briefcase, Tag, ChevronRight, Search, MapPin, Sparkles, Flame, Mail, MessageCircle, ShieldCheck } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { PublicRepairReadyNotifications } from '@/components/public/PublicRepairReadyNotifications'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { PublicFavorites } from '@/components/public/Favorites'
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
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getTenantSlugFromPathname, isTenantPublicSection } from '@/lib/saas/tenant'
import { AuthModal } from '@/components/public/AuthModal'
import { isPublicServicesPageAvailable, isPublicRepairsAvailable } from '@/lib/website/services'
import type { WebsiteSettings } from '@/types/website-settings'

function formatSocialUrl(handleOrUrl: string, platform: 'instagram' | 'facebook' | 'tiktok') {
  if (!handleOrUrl) return ''
  if (handleOrUrl.startsWith('http://') || handleOrUrl.startsWith('https://')) return handleOrUrl
  const clean = handleOrUrl.replace(/^@/, '').trim()
  if (platform === 'instagram') return `https://instagram.com/${clean}`
  if (platform === 'facebook') return `https://facebook.com/${clean}`
  if (platform === 'tiktok') return `https://tiktok.com/@${clean}`
  return handleOrUrl
}

export function PublicHeader({ initialSettings = null }: { initialSettings?: WebsiteSettings | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const { user, signOut } = useAuth()
  const { settings } = useWebsiteSettings()
  const effectiveSettings = settings ?? initialSettings
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (pathname.includes('/productos')) {
      setSearchQuery(searchParams?.get('query') || '')
    }
  }, [pathname, searchParams])

  const companyInfo = effectiveSettings?.company_info
  // Only show the organization's own phone — never the platform-level env fallback.
  const phoneDisplay = companyInfo?.phone || ''
  const phoneClean = phoneDisplay?.replace(/\D/g, '')
  const companyLogoUrl = companyInfo?.logoUrl?.trim() || ''
  const weekdayHours = companyInfo?.hours?.weekdays?.trim() || ''
  const showTopBar = companyInfo?.showTopBar !== false
  const emailDisplay = companyInfo?.email?.trim() || ''
  const addressDisplay = companyInfo?.address?.trim() || ''
  const mapsUrl = companyInfo?.mapsUrl?.trim() || ''
  const whatsappNumber = (companyInfo?.whatsapp || companyInfo?.phone || '').replace(/\D/g, '')
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}` : ''
  const instagramUrl = companyInfo?.instagram ? formatSocialUrl(companyInfo.instagram, 'instagram') : ''
  const facebookUrl = companyInfo?.facebook ? formatSocialUrl(companyInfo.facebook, 'facebook') : ''
  const tiktokUrl = companyInfo?.tiktok ? formatSocialUrl(companyInfo.tiktok, 'tiktok') : ''
  const hasSocials = Boolean(instagramUrl || facebookUrl || tiktokUrl)

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) {
      router.push(`${withTenantPrefix('/productos')}?query=${encodeURIComponent(q)}`)
    } else {
      router.push(withTenantPrefix('/productos'))
    }
    setMobileMenuOpen(false)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    if (pathname.includes('/productos')) {
      router.push(withTenantPrefix('/productos'))
    }
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
    ...(offersEnabled ? [{ href: withTenantPrefix('/ofertas'), label: 'Ofertas', icon: Tag, highlight: true }] : []),
    ...(servicesEnabled ? [{ href: withTenantPrefix('/servicios'), label: 'Servicios', icon: Briefcase }] : []),
    ...(repairsEnabled ? [{ href: withTenantPrefix('/mis-reparaciones'), label: 'Reparaciones', icon: Shield }] : []),
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
          ? 'shadow-md shadow-black/5 dark:shadow-black/20 py-0.5 border-b border-border/60 bg-background/95 backdrop-blur-md'
          : 'py-1.5 border-b border-border/40 bg-background/90 backdrop-blur-md'
      } ${
        companyInfo?.headerStyle === 'accent'
          ? 'bg-primary text-primary-foreground border-primary/20'
          : companyInfo?.headerStyle === 'dark'
          ? 'bg-slate-950 text-white border-slate-900'
          : companyInfo?.headerStyle === 'solid'
          ? 'bg-background text-foreground border-border/80'
          : 'bg-background/90 backdrop-blur-md border-border/40'
      }`}
    >
      {/* Top bar — only when the org provides contact or location info */}
      {showTopBar && (phoneDisplay || weekdayHours || addressDisplay || hasSocials || emailDisplay || whatsappUrl) && (
        <div className={`hidden border-b md:block py-1.5 transition-colors text-[11px] font-medium ${
          companyInfo?.headerStyle === 'accent'
            ? 'border-white/10 bg-black/15 text-primary-foreground/90'
            : companyInfo?.headerStyle === 'dark'
            ? 'border-slate-900 bg-slate-900/60 text-slate-400'
            : 'border-border/50 bg-muted/40 text-muted-foreground'
        }`}>
          <div className="container flex h-auto items-center justify-between gap-4">
            {/* Left: Contact info & Hours */}
            <div className="flex items-center gap-3.5 lg:gap-4 overflow-hidden text-xs">
              {phoneDisplay && (
                <a
                  href={phoneClean ? `tel:${phoneClean}` : undefined}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-primary hover:opacity-100"
                  aria-label="Llamar al local"
                >
                  <Phone className={`h-3.5 w-3.5 ${companyInfo?.headerStyle === 'accent' ? 'text-white' : 'text-primary'}`} />
                  <span className="truncate font-semibold">{phoneDisplay}</span>
                </a>
              )}

              {whatsappUrl && (
                <>
                  <span className="h-3 w-px bg-border/60" aria-hidden="true" />
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold transition-colors"
                    aria-label="Contactar por WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5 fill-emerald-500/20" />
                    <span>WhatsApp</span>
                  </a>
                </>
              )}

              {weekdayHours && (
                <>
                  <span className="h-3 w-px bg-border/60" aria-hidden="true" />
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <Clock className={`h-3.5 w-3.5 ${companyInfo?.headerStyle === 'accent' ? 'text-white' : 'text-primary'}`} />
                    <span>{weekdayHours}{companyInfo?.hours?.saturday ? ` · Sáb: ${companyInfo.hours.saturday}` : ''}</span>
                  </span>
                </>
              )}

              {addressDisplay && (
                <>
                  <span className="hidden xl:inline-block h-3 w-px bg-border/60" aria-hidden="true" />
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden xl:inline-flex items-center gap-1.5 truncate hover:text-primary transition-colors"
                      title="Ver en Google Maps"
                    >
                      <MapPin className={`h-3.5 w-3.5 ${companyInfo?.headerStyle === 'accent' ? 'text-white' : 'text-primary'}`} />
                      <span className="truncate">{addressDisplay}</span>
                    </a>
                  ) : (
                    <span className="hidden xl:inline-flex items-center gap-1.5 truncate">
                      <MapPin className={`h-3.5 w-3.5 ${companyInfo?.headerStyle === 'accent' ? 'text-white' : 'text-primary'}`} />
                      <span className="truncate">{addressDisplay}</span>
                    </span>
                  )}
                </>
              )}

              {emailDisplay && (
                <>
                  <span className="hidden 2xl:inline-block h-3 w-px bg-border/60" aria-hidden="true" />
                  <a
                    href={`mailto:${emailDisplay}`}
                    className="hidden 2xl:inline-flex items-center gap-1.5 truncate hover:text-primary transition-colors"
                  >
                    <Mail className={`h-3.5 w-3.5 ${companyInfo?.headerStyle === 'accent' ? 'text-white' : 'text-primary'}`} />
                    <span className="truncate">{emailDisplay}</span>
                  </a>
                </>
              )}
            </div>

            {/* Right: Social media & Verification */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Tienda Oficial
              </span>

              {hasSocials && (
                <>
                  <span className="h-3 w-px bg-border/60" aria-hidden="true" />
                  <div className="flex items-center gap-1.5">
                    {instagramUrl && (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full p-1 text-muted-foreground hover:text-pink-600 hover:bg-pink-500/10 transition-colors"
                        title="Instagram"
                        aria-label="Instagram de la tienda"
                      >
                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </a>
                    )}
                    {facebookUrl && (
                      <a
                        href={facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full p-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                        title="Facebook"
                        aria-label="Facebook de la tienda"
                      >
                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </a>
                    )}
                    {tiktokUrl && (
                      <a
                        href={tiktokUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                        title="TikTok"
                        aria-label="TikTok de la tienda"
                      >
                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.01 3.5 2.89 1.53-.02 2.89-.99 3.42-2.42.23-.58.33-1.22.33-1.84V.02z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main header */}
      <div className="container flex h-14 sm:h-16 items-center justify-between gap-2.5 sm:gap-4 lg:gap-5">
        {/* Logo & Store Name */}
        <Link href={withTenantPrefix('/inicio')} className="group flex items-center gap-2 shrink-0" aria-label="Ir a inicio">
          {companyLogoUrl ? (
            <div className="relative flex h-8 sm:h-9 max-w-[110px] sm:max-w-[140px] items-center justify-start overflow-hidden transition-all duration-300 group-hover:scale-[1.02]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={companyLogoUrl}
                alt={companyInfo?.name || 'Logo'}
                className="h-8 sm:h-9 w-auto max-h-8 sm:max-h-9 max-w-full object-contain"
              />
            </div>
          ) : (
            <div className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center overflow-hidden rounded-xl p-1 shadow-sm transition-all duration-300 group-hover:scale-105 ${
              companyInfo?.headerStyle === 'accent'
                ? 'bg-white text-primary'
                : 'bg-primary text-primary-foreground'
            }`}>
              <Store className="h-4.5 w-4.5" />
            </div>
          )}
          <div className="hidden sm:block min-w-0">
            <span className="block text-xs sm:text-sm font-extrabold leading-tight tracking-tight text-foreground truncate max-w-[140px] lg:max-w-[170px]">
              {companyInfo?.name || 'Tienda'}
            </span>
            {companyInfo?.slogan && (
              <span className={`block text-[8.5px] font-normal leading-tight tracking-tight truncate max-w-[140px] lg:max-w-[170px] ${
                companyInfo?.headerStyle === 'accent' ? 'text-white/75' : 'text-muted-foreground/80'
              }`}>
                {companyInfo.slogan}
              </span>
            )}
          </div>
        </Link>

        {/* Search Bar — desktop / tablet */}
        <div
          className={cn(
            'hidden md:flex items-center transition-all duration-300 ease-in-out',
            searchFocused
              ? 'flex-1 max-w-2xl mx-3'
              : 'flex-1 max-w-xs xl:max-w-sm mx-2'
          )}
        >
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search
              className={cn(
                'absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors pointer-events-none',
                searchFocused ? 'h-4.5 w-4.5 text-primary' : 'h-4 w-4 text-muted-foreground'
              )}
            />
            <input
              type="search"
              placeholder={`Buscar productos en ${companyInfo?.name || 'la tienda'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.currentTarget.blur()
                  setSearchFocused(false)
                }
              }}
              className={cn(
                'w-full rounded-full border transition-all duration-300 outline-none placeholder:text-muted-foreground',
                searchFocused
                  ? 'h-10 border-primary bg-background pl-10 pr-20 text-sm ring-2 ring-primary/25 shadow-md text-foreground'
                  : 'h-9 border-border/70 bg-muted/35 pl-9 pr-8 text-xs text-foreground hover:border-border hover:bg-muted/60'
              )}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleClearSearch}
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {searchFocused && (
                <kbd className="hidden lg:inline-flex items-center rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground select-none">
                  Esc
                </kbd>
              )}
            </div>
          </form>
        </div>

        {/* Desktop Navigation Links — hidden smoothly when search is focused */}
        <nav
          className={cn(
            'items-center gap-1 transition-all duration-300 ease-in-out',
            searchFocused
              ? 'hidden opacity-0 pointer-events-none -translate-x-2'
              : 'hidden xl:flex opacity-100 translate-x-0'
          )}
          aria-label="Navegacion principal"
        >
          {navLinks.map((link) => {
            const active = isActive(link.href)
            const LinkIcon = link.icon
            const isOffer = link.href.includes('/ofertas')
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200',
                  active
                    ? companyInfo?.headerStyle === 'accent'
                      ? 'text-primary bg-white shadow-xs'
                      : 'text-primary bg-primary/10 ring-1 ring-primary/20'
                    : companyInfo?.headerStyle === 'accent'
                    ? 'text-white/85 hover:text-white hover:bg-white/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {LinkIcon && <LinkIcon className={cn('h-3.5 w-3.5 shrink-0', isOffer && 'text-rose-500 animate-pulse')} />}
                <span>{link.label}</span>
                {isOffer && (
                  <span className="rounded-full bg-rose-600 px-1 py-0.2 text-[8px] font-black uppercase text-white shadow-2xs">
                    Hot
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right side: Marketplace + Cart + Favs + Theme + User */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {tenantPrefix && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden lg:inline-flex h-8 gap-1.5 rounded-full border-border/80 bg-background/80 hover:bg-muted font-semibold text-xs transition-all shadow-xs"
            >
              <Link href="/marketplace" aria-label="Volver al marketplace">
                <Store className="h-3.5 w-3.5 text-primary" />
                <span>Marketplace</span>
              </Link>
            </Button>
          )}

          <PublicCartButton />
          <PublicFavorites />

          <InstallPrompt compact />

          {/* Theme toggle - visible on all screens */}
          {mounted && <ThemeToggle />}

          {user?.id && repairsEnabled && <PublicRepairReadyNotifications userId={user.id} />}

          {/* User menu / Profile Button */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-border/80 bg-background/90 hover:bg-muted/80 pl-1 pr-2.5 py-1 text-xs font-semibold text-foreground transition-all shadow-xs hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Mi Perfil"
                  title="Mi Perfil y Configuración"
                >
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarImage
                      src={user?.profile?.avatar_url || ''}
                      alt={user?.profile?.name || 'Usuario'}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline font-bold text-xs truncate max-w-[100px]">
                    {user?.profile?.name?.split(' ')[0] || 'Mi Perfil'}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 rotate-90 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-2 shadow-xl rounded-2xl border-border/80" align="end" sideOffset={8}>
                <DropdownMenuLabel className="font-normal p-1">
                  <div className="flex items-center gap-2.5 px-1 py-1.5">
                    <Avatar className="h-9 w-9 border border-border shadow-xs">
                      <AvatarImage src={user?.profile?.avatar_url || ''} alt={user?.profile?.name || 'Usuario'} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">{userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold leading-none truncate">
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
                <DropdownMenuItem asChild>
                  <Link href={withTenantPrefix('/perfil')} className="flex items-center gap-2.5 cursor-pointer font-semibold text-foreground">
                    <User className="h-4 w-4 text-primary" />
                    <span>Ver Mi Perfil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={withTenantPrefix('/track')} className="flex items-center gap-2.5 cursor-pointer">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span>Rastrear Pedidos</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={withTenantPrefix('/perfil/autorizados')} className="flex items-center gap-2.5 cursor-pointer">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span>Personas Autorizadas</span>
                  </Link>
                </DropdownMenuItem>
                {canAccessDashboard && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center gap-2.5 cursor-pointer font-medium text-primary">
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Panel Administrativo</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <InstallPrompt variant="menu-item" />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLogoutOpen(true)}
                  className="flex items-center gap-2.5 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3.5 py-1.5 shadow-sm shadow-primary/20 transition-all duration-200 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97] font-bold text-xs"
                  aria-label="Mi Perfil"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Mi Perfil</span>
                  <ChevronRight className="h-3.5 w-3.5 rotate-90 text-primary-foreground/70 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 p-2 shadow-xl rounded-2xl border-border/80" align="end" sideOffset={8}>
                <DropdownMenuLabel className="font-normal p-1">
                  <p className="text-xs font-bold text-foreground">Acceso a tu cuenta</p>
                  <p className="text-[11px] text-muted-foreground">Iniciá sesión para ver tus compras y perfil</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setAuthOpen(true)}
                  className="flex items-center gap-2.5 cursor-pointer font-semibold text-primary"
                >
                  <User className="h-4 w-4" />
                  <span>Iniciar sesión / Registro</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={withTenantPrefix('/track')} className="flex items-center gap-2.5 cursor-pointer text-foreground font-medium">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span>Rastrear Pedido</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <InstallPrompt variant="menu-item" />
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile & Tablet menu toggle */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground hover:bg-muted transition-colors xl:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── MODAL / DRAWER LATERAL OFF-CANVAS (SHEET) ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
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
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col bg-card p-5 shadow-2xl border-l border-border/80 transition-transform duration-300 animate-in slide-in-from-right"
          >
            {/* Cabecera del Drawer con Logo y Botón Cerrar */}
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5 min-w-0">
                {companyLogoUrl ? (
                  <div className="relative h-8 max-w-[120px] shrink-0 flex items-center justify-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={companyLogoUrl}
                      alt={companyInfo?.name || 'Logo'}
                      className="h-8 w-auto max-h-8 max-w-full object-contain"
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

            {/* Mobile Search Input */}
            <div className="pt-3 pb-2">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border bg-muted/40 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </form>
            </div>

            {/* Sección de Usuario / Cuenta */}
            <div className="py-3 border-b border-border/60">
              {user ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={user.profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {user.profile?.name || 'Usuario'}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  {canAccessDashboard && (
                    <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2 rounded-xl text-xs font-semibold text-primary">
                      <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        Panel administrativo
                      </Link>
                    </Button>
                  )}

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <Link
                      href={withTenantPrefix('/perfil')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border/70 bg-background px-1.5 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-center"
                    >
                      <User className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="leading-tight">Mi Perfil</span>
                    </Link>
                    <Link
                      href={withTenantPrefix('/track')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border/70 bg-background px-1.5 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-center"
                    >
                      <Truck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="leading-tight">Rastrear</span>
                    </Link>
                    <Link
                      href={withTenantPrefix('/perfil/autorizados')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border/70 bg-background px-1.5 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-center"
                    >
                      <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="leading-tight">Autorizados</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Accedé a tu cuenta o registrate para comprar:</p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-xs text-xs"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      setAuthOpen(true)
                    }}
                  >
                    <User className="h-4 w-4" />
                    Iniciar sesión / Registro
                  </Button>
                  <Link
                    href={withTenantPrefix('/track')}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    <span>Rastrear un Pedido</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Enlaces de Navegación Principal */}
            <nav className="flex-1 overflow-y-auto py-3 space-y-1 scrollbar-thin scrollbar-thumb-muted">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Secciones de la Tienda
              </p>

              {navLinks.map((link) => {
                const Icon = link.icon
                const active = isActive(link.href)
                const isOffer = link.href.includes('/ofertas')
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
                    <div className="flex items-center gap-2.5">
                      {Icon && <Icon className={cn('h-4 w-4', isOffer && 'text-rose-500')} />}
                      <span>{link.label}</span>
                      {isOffer && (
                        <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[8px] font-black uppercase text-white shadow-2xs">
                          Hot
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </Link>
                )
              })}

              {tenantPrefix && (
                <div className="pt-2">
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Explorar
                  </p>
                  <Link
                    href="/marketplace"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/40 px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Store className="h-4 w-4 text-primary" />
                      <span>Volver al Marketplace</span>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-70" />
                  </Link>
                </div>
              )}

              <div className="pt-2">
                <InstallPrompt variant="menu-item" className="border border-border/70 bg-background hover:bg-muted" />
              </div>

              {/* Horarios & Teléfono de Atención */}
              {(weekdayHours || phoneDisplay || addressDisplay || hasSocials) && (
                <div className="mt-3 rounded-2xl border border-border/60 bg-muted/40 p-3 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Contacto y Horarios
                  </span>
                  {phoneDisplay && (
                    <a
                      href={`tel:${phoneClean}`}
                      className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{phoneDisplay}</span>
                    </a>
                  )}
                  {weekdayHours && (
                    <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{weekdayHours}</span>
                    </div>
                  )}
                  {addressDisplay && (
                    <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{addressDisplay}</span>
                    </div>
                  )}
                  {hasSocials && (
                    <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                      {instagramUrl && (
                        <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:opacity-80">
                          Instagram
                        </a>
                      )}
                      {facebookUrl && (
                        <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:opacity-80">
                          Facebook
                        </a>
                      )}
                      {tiktokUrl && (
                        <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-foreground hover:opacity-80">
                          TikTok
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* Pie del Drawer */}
            <div className="pt-3 border-t border-border/60 space-y-2">
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
                {'¿Cerrar sesión?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5 text-center text-sm">
                {'Hola '}
                <span className="font-semibold text-foreground">
                  {user?.profile?.name?.split(' ')[0] || 'Usuario'}
                </span>
                {', ¿estás seguro que quieres salir?'}
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
                  'Sí, cerrar sesión'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}

