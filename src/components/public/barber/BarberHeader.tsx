'use client'

import { WhatsAppIcon, InstagramIcon, FacebookIcon, TikTokIcon } from '@/components/public/SocialIcons'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarCheck2,
  CalendarOff,
  ChevronDown,
  Clock,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Package,
  Phone,
  Scissors,
  ShoppingBag,
  Sparkles,
  Truck,
  User,
  X,
} from 'lucide-react'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AuthModal } from '@/components/public/AuthModal'
import { usePublicAgenda } from '@/components/public/inicio/ServicesHome'
import { useAuth } from '@/contexts/auth-context'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useHydrated } from '@/hooks/use-hydrated'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { canOpenDashboard, loginHrefWithReturn } from '@/lib/auth/dashboard-access'
import { openStatus, openStatusLabel } from '@/lib/website/opening-hours'
import { closuresToAnnounce, describeClosure, type PublicClosure } from '@/lib/agenda/closures'
import { getSocialLinks } from '@/lib/public/social-links'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'

interface BarberHeaderProps {
  settings?: WebsiteSettings | null
  catalogEnabled?: boolean
}

/** La sección del inicio que se está viendo, para marcarla en el menú. */
function useActiveSection(ids: string[], enabled: boolean) {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(',')
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return
    const elements = key
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (elements.length === 0) return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        const best = [...visible.entries()].filter(([, ratio]) => ratio > 0).sort((a, b) => b[1] - a[1])[0]
        setActive(best ? best[0] : null)
      },
      { rootMargin: '-30% 0px -40% 0px', threshold: [0, 0.25, 0.5, 1] }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [key, enabled])
  return enabled ? active : null
}

export function BarberHeader({ settings: initialSettings = null, catalogEnabled = true }: BarberHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { settings } = useWebsiteSettings()
  const effectiveSettings = initialSettings ?? settings
  const companyInfo = useStorefrontCompanyInfo(effectiveSettings?.company_info)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const pathSlug = getTenantSlugFromPathname(pathname)
  const prefix = pathSlug ? `/${pathSlug}` : ''
  const { agenda } = usePublicAgenda(true, companyInfo?.slug)
  const hydrated = useHydrated()

  const bookingEnabled = effectiveSettings?.booking_section?.enabled !== false
  const dedicatedBookingHref = `${prefix}/reservas`
  const bookingHref = dedicatedBookingHref

  // Datos reales de la organización
  const name = companyInfo?.name?.trim() || 'Barbería'
  const logo = companyInfo?.logoUrl?.trim()
  const slogan = companyInfo?.slogan?.trim()
  const phone = companyInfo?.phone?.trim()
  const rawWhatsapp = companyInfo?.whatsapp || companyInfo?.phone || ''
  const whatsappClean = rawWhatsapp.replace(/\D/g, '')
  const whatsappHref = whatsappClean ? `https://wa.me/${whatsappClean}` : null
  const email = companyInfo?.email?.trim()
  const hours = companyInfo?.hours?.weekdays?.trim()
  const address = companyInfo?.address?.trim()
  const mapsHref =
    companyInfo?.mapsUrl?.trim() ||
    (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null)

  const socialLinks = useMemo(() => getSocialLinks(companyInfo), [companyInfo])

  // Cierres programados
  const agendaExtras = (hydrated ? agenda : null) as unknown as { closures?: PublicClosure[]; timeZone?: string } | null
  const closure = closuresToAnnounce(agendaExtras?.closures ?? [])[0] ?? null
  const closureText = closure ? describeClosure(closure, agendaExtras?.timeZone || 'America/Asuncion') : null
  const status = !hydrated
    ? { state: 'unknown' as const }
    : closureText?.active
      ? { state: 'closed' as const, opensAt: null }
      : openStatus(companyInfo?.hours, new Date(), agendaExtras?.timeZone || 'America/Asuncion')
  const statusLabel = closureText?.active ? `Cerrado · ${closureText.detail}` : openStatusLabel(status)

  const signedIn = hydrated && Boolean(user)
  const canAccessDashboard = canOpenDashboard(user)
  const customerLoginHref = prefix
    ? loginHrefWithReturn(`${prefix}/cliente/login`, pathname, 'next')
    : loginHrefWithReturn('/login', pathname, 'redirect')
  const customerRegisterHref = prefix ? `${prefix}/cliente/registro` : '/register'

  const fullName = user?.profile?.name?.trim() || user?.email?.split('@')[0] || ''
  const firstName = fullName.split(/\s+/)[0] || 'Mi Perfil'
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || name.slice(0, 1).toUpperCase() || 'B'

  const onHome = pathname === `${prefix}/inicio` || pathname === prefix || pathname === '/'
  const activeSection = useActiveSection(['experiencia', 'rituales', 'barberos', 'reservar', 'sedes', 'boutique'], onHome)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileMenuOpen])

  // Enlaces de navegación en el orden exacto del recorrido de la barbería
  const homeAnchor = (id: string) => (onHome ? `#${id}` : `${prefix}/inicio#${id}`)

  const navLinks = [
    { href: onHome ? '#' : `${prefix}/inicio`, label: 'Inicio', sectionId: null },
    { href: homeAnchor('rituales'), label: 'Servicios', sectionId: 'rituales' },
    { href: homeAnchor('barberos'), label: 'Barberos', sectionId: 'barberos' },
    {
      href: dedicatedBookingHref,
      label: 'Reservas',
      sectionId: 'reservar',
      icon: CalendarCheck2,

    },
    ...(address || (effectiveSettings as any)?.branches?.length
      ? [{ href: homeAnchor('sedes'), label: 'Ubicación', sectionId: 'sedes' }]
      : []),
    ...(catalogEnabled
      ? [
          {
            href: `${prefix}/productos`,
            label: 'Productos',
            sectionId: 'boutique',
            icon: Package,

          },
        ]
      : []),
  ]

  const isLinkActive = (item: (typeof navLinks)[number]) => {
    if (item.href.includes('/productos') || item.sectionId === 'boutique') {
      return pathname.startsWith(`${prefix}/productos`) || (onHome && activeSection === 'boutique')
    }
    if (item.sectionId === 'reservar' || item.href.includes('/reservas') || item.href.includes('/turnos')) {
      return pathname.startsWith(`${prefix}/reservas`) || pathname.startsWith(`${prefix}/turnos`) || (onHome && activeSection === 'reservar')
    }
    if (item.sectionId) {
      return onHome && activeSection === item.sectionId
    }
    return (
      onHome &&
      !activeSection &&
      !pathname.includes('/productos') &&
      !pathname.includes('/reservas') &&
      !pathname.includes('/turnos')
    )
  }

  const primaryReservationHref = dedicatedBookingHref

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setMobileMenuOpen(false)
    if (href.startsWith('#')) {
      e.preventDefault()
      if (href === '#' || href === '#inicio') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        const id = href.replace(/^#/, '')
        const target = document.getElementById(id)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' })
        }
      }
      if (mobileMenuOpen) setMobileMenuOpen(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      router.refresh()
    } catch (err) {
      console.error('Error logging out:', err)
    }
  }

  // Adaptación de estilos según lo configurado por la organización
  const headerStyle = companyInfo?.headerStyle || 'dark'
  const isAccent = headerStyle === 'accent'
  const isSolid = headerStyle === 'solid'
  const isGlass = headerStyle === 'glass'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300 border-b',
        isAccent
          ? 'bg-primary text-primary-foreground border-primary/30'
          : isSolid
            ? 'bg-background text-foreground border-border/80'
            : isGlass
              ? 'bg-background/85 text-foreground backdrop-blur-md border-border/60'
              : 'bg-zinc-950 text-zinc-100 border-border/40 dark:bg-black/95 dark:border-white/10',
        scrolled ? 'shadow-lg shadow-black/10 dark:shadow-black/40' : ''
      )}
      data-storefront-header="barber"
      data-header-style={headerStyle}
    >
      {/* Aviso de cierre programado */}
      {closureText && (
        <div role="status" className="bg-primary text-primary-foreground py-1.5 px-4 text-center text-xs font-bold shadow-inner">
          <div className="container mx-auto flex items-center justify-center gap-2">
            <CalendarOff className="h-4 w-4 shrink-0" />
            <span>{closureText.title}</span>
            <span>·</span>
            <span>{closureText.detail}</span>
            {closureText.reopens && <span className="opacity-90">({closureText.reopens})</span>}
          </div>
        </div>
      )}

      {/* ── 1. Top Bar de Información Real (Horarios, Estado, Ubicación, Contacto, Redes) ── */}
      {companyInfo?.showTopBar !== false && (hours || address || phone || statusLabel || socialLinks.length > 0) && (
        <div
          className={cn(
            'hidden border-b py-1.5 text-xs md:block transition-all',
            isAccent
              ? 'bg-black/15 text-primary-foreground/90 border-white/10'
              : isSolid
                ? 'bg-muted/60 text-muted-foreground border-border/60'
                : isGlass
                  ? 'bg-muted/40 text-muted-foreground border-border/40'
                  : 'bg-zinc-900/80 text-zinc-400 border-white/5 dark:bg-zinc-950'
          )}
        >
          <div className="container mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              {statusLabel && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-2 w-2 rounded-full',
                      status.state === 'open' ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50' : 'bg-zinc-500'
                    )}
                  />
                  <span>{statusLabel}</span>
                </span>
              )}
              {hours && (
                <span className={cn('inline-flex items-center gap-1.5 border-l pl-4', isAccent ? 'border-white/20' : 'border-border/60')}>
                  <Clock className={cn('h-3.5 w-3.5', isAccent ? 'text-primary-foreground' : 'text-primary')} />
                  <span>{hours}</span>
                </span>
              )}
              <span className={cn('hidden xl:inline-flex items-center gap-1.5 border-l pl-4 font-medium', isAccent ? 'border-white/20 text-primary-foreground/90' : 'border-border/60 text-primary')}>
                <Sparkles className="h-3 w-3" />
                <span>Elegí tu servicio y reservá online</span>
              </span>
            </div>

            <div className="flex items-center gap-4">
              {address && (
                <span className="inline-flex items-center gap-1.5 truncate">
                  <MapPin className={cn('h-3.5 w-3.5 shrink-0', isAccent ? 'text-primary-foreground' : 'text-primary')} />
                  {mapsHref ? (
                    <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {address}
                    </a>
                  ) : (
                    <span>{address}</span>
                  )}
                </span>
              )}
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                  className={cn('inline-flex items-center gap-1.5 hover:underline border-l pl-4', isAccent ? 'border-white/20' : 'border-border/60')}
                >
                  <Phone className={cn('h-3.5 w-3.5 shrink-0', isAccent ? 'text-primary-foreground' : 'text-primary')} />
                  <span>{phone}</span>
                </a>
              )}
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1.5 font-semibold border-l pl-4',
                    isAccent ? 'border-white/20 text-white hover:underline' : 'border-border/60 text-emerald-500 hover:text-emerald-400'
                  )}
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
              {/* Redes sociales reales */}
              {socialLinks.length > 0 && (
                <div className={cn('hidden lg:flex items-center gap-2 border-l pl-4', isAccent ? 'border-white/20' : 'border-border/60')}>
                  {socialLinks.map((s) => {
                    const Icon = s.platform === 'instagram' ? InstagramIcon : s.platform === 'facebook' ? FacebookIcon : TikTokIcon
                    return (
                      <a
                        key={s.platform}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label}
                        className={cn('transition-colors', isAccent ? 'text-primary-foreground/80 hover:text-white' : 'text-muted-foreground hover:text-primary')}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Barra Principal (Logo, Navegación, Productos, Reservas, Perfil y Carrito) ── */}
      <div className="container mx-auto flex min-h-18 items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo Real de la Organización */}
        <Link
          href={`${prefix}/inicio`}
          className="group flex min-w-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg py-1"
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={name}
              className={cn(
                'h-11 w-11 shrink-0 rounded-xl object-contain ring-1 p-0.5',
                isAccent ? 'bg-white/10 ring-white/30' : 'bg-muted/30 ring-primary/30'
              )}
            />
          ) : (
            <span
              className={cn(
                'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md ring-1',
                isAccent
                  ? 'bg-white text-primary ring-white/40 shadow-black/10'
                  : 'bg-primary text-primary-foreground ring-primary/40 shadow-primary/20'
              )}
            >
              <Scissors className="h-5 w-5" />
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <span
              className={cn(
                'truncate max-w-[130px] sm:max-w-[220px] font-serif text-base md:text-xl font-bold tracking-tight transition-colors',
                isAccent
                  ? 'text-primary-foreground group-hover:opacity-90'
                  : 'text-inherit group-hover:text-primary'
              )}
            >
              {name}
            </span>
            <span
              className={cn(
                'text-[10px] uppercase tracking-[0.2em] font-semibold -mt-0.5 truncate max-w-[180px] sm:max-w-xs',
                isAccent ? 'text-primary-foreground/80' : 'text-primary'
              )}
            >
              {slogan || 'Servicios y reservas'}
            </span>
          </div>
        </Link>

        {/* Navegación de escritorio (Recorrido de la Barbería) */}
        <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navLinks.map((item) => {
            const active = isLinkActive(item)
            const Icon = (item as any).icon
            const badge = (item as any).badge
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 rounded-lg group',
                  isAccent
                    ? active
                      ? 'bg-white/20 text-white font-bold'
                      : 'text-primary-foreground/85 hover:bg-white/10 hover:text-white'
                    : active
                      ? 'text-primary bg-primary/10 font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-white/5'
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5 opacity-80" />}
                <span>{item.label}</span>
                {badge && (
                  <span
                    className={cn(
                      'ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider',
                      item.sectionId === 'reservar'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    )}
                  >
                    {item.sectionId === 'reservar' && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    <span>{badge}</span>
                  </span>
                )}
                {active && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-x-3 bottom-0 h-0.5 rounded-full',
                      isAccent
                        ? 'bg-white'
                        : 'bg-gradient-to-r from-transparent via-primary to-transparent'
                    )}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Acciones de la derecha: ThemeToggle, Carrito, Selector de Perfil y CTA */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* ThemeToggle */}
          <div className={cn('hidden sm:block', isAccent ? 'text-primary-foreground/85 hover:text-white' : 'text-muted-foreground hover:text-foreground')}>
            <ThemeToggle />
          </div>

          {/* Carrito de compras (se muestra si la organización vende productos) */}
          {hydrated && <div className="hidden sm:block"><PublicCartButton /></div>}

          {/* ── SELECTOR DE PERFIL INTERACTIVO ── */}
          {hydrated && (
            <div className="hidden sm:flex">
              {signedIn ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-2 rounded-full border pl-1.5 pr-2.5 py-1 text-xs font-semibold transition cursor-pointer select-none shadow-2xs',
                        isAccent
                          ? 'border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20'
                          : 'border-border/80 bg-muted/40 text-foreground hover:border-primary/50 dark:bg-zinc-900/80 dark:border-zinc-700/80'
                      )}
                      aria-label="Menú de perfil de usuario"
                    >
                      <Avatar className="h-6 w-6 ring-1 ring-primary/40">
                        <AvatarImage src={user?.profile?.avatar_url || ''} alt="" />
                        <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline-block max-w-[100px] truncate text-xs">
                        {firstName}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-2 shadow-2xl rounded-2xl border-border/80" align="end" sideOffset={8}>
                    <DropdownMenuLabel className="font-normal p-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 ring-1 ring-primary/40">
                          <AvatarImage src={user?.profile?.avatar_url || ''} alt="" />
                          <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm truncate text-foreground">{fullName || 'Cliente'}</span>
                          <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`${prefix}/perfil`} className="flex items-center gap-2.5 cursor-pointer font-medium py-2">
                        <User className="h-4 w-4 text-primary" />
                        <span>Ver Mi Perfil</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={bookingHref || `${prefix}/turnos`} className="flex items-center gap-2.5 cursor-pointer font-medium py-2">
                        <CalendarCheck2 className="h-4 w-4 text-primary" />
                        <span>Mis Turnos & Reservas</span>
                      </Link>
                    </DropdownMenuItem>
                    {catalogEnabled && (
                      <DropdownMenuItem asChild>
                        <Link href={`${prefix}/track`} className="flex items-center gap-2.5 cursor-pointer font-medium py-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span>Mis Compras / Pedidos</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canAccessDashboard && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard" className="flex items-center gap-2.5 cursor-pointer font-semibold text-primary py-2">
                            <LayoutDashboard className="h-4 w-4" />
                            <span>Panel de Control</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 cursor-pointer text-destructive focus:text-destructive py-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Cerrar Sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                    isAccent
                      ? 'border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20'
                      : 'border-border/80 bg-muted/40 text-foreground hover:border-primary/50 dark:bg-zinc-900/80 dark:border-zinc-700/80'
                  )}
                  aria-label="Ingresar a mi cuenta"
                >
                  <User className={cn('h-4 w-4', isAccent ? 'text-primary-foreground' : 'text-primary')} />
                  <span className="hidden sm:inline-block">Ingresar</span>
                </button>
              )}
            </div>
          )}

          {/* CTA Principal de Reserva */}
          <Link
            href={primaryReservationHref}
            onClick={(e) => handleNavClick(e, primaryReservationHref)}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full px-3 sm:px-5 py-2 text-xs font-bold uppercase tracking-wider transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isAccent
                ? 'bg-white text-primary hover:bg-white/90 shadow-md shadow-black/10'
                : 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
            )}
          >
            <CalendarCheck2 className="h-4 w-4" />
            <span>Reservar</span>
          </Link>

          {/* Botón de Menú Móvil */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileMenuOpen}
            className={cn(
              'flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border transition',
              isAccent
                ? 'border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20'
                : 'border-border bg-card text-foreground hover:border-primary/50 dark:bg-zinc-900 dark:border-zinc-800'
            )}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ── 3. Menú Móvil Desplegable con Secciones de Productos, Reservas y Perfil ── */}
      {mobileMenuOpen && (
        <div
          className={cn(
            'lg:hidden max-h-[calc(100dvh-5rem)] overflow-y-auto border-t px-4 py-6 shadow-2xl animate-in slide-in-from-top duration-200',
            isAccent
              ? 'bg-primary border-white/20 text-primary-foreground'
              : 'bg-background border-border text-foreground dark:bg-zinc-950 dark:border-zinc-800'
          )}
        >
          {/* Tarjeta de Perfil en Móvil */}
          {hydrated && (
            <div className={cn('mb-5 p-3 rounded-2xl border', isAccent ? 'bg-white/10 border-white/20' : 'bg-muted/40 border-border dark:bg-zinc-900')}>
              {signedIn ? (
                <div className="flex items-center justify-between">
                  <Link
                    href={`${prefix}/perfil`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <Avatar className="h-10 w-10 ring-1 ring-primary/40">
                      <AvatarImage src={user?.profile?.avatar_url || ''} alt="" />
                      <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm truncate">{fullName || 'Mi Perfil'}</span>
                      <span className="text-xs opacity-75 truncate">{user?.email}</span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-2 text-destructive hover:opacity-80 transition"
                    title="Cerrar sesión"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setAuthOpen(true)
                  }}
                  className="flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-primary dark:text-white"
                >
                  <User className="h-4 w-4" />
                  <span>Ingresar o Crear Cuenta</span>
                </button>
              )}
            </div>
          )}

          {/* Enlaces de Navegación Móvil */}
          <div className="space-y-1">
            {navLinks.map((item) => {
              const active = isLinkActive(item)
              const Icon = (item as any).icon
              const badge = (item as any).badge
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition-colors',
                    isAccent
                      ? active
                        ? 'bg-white/20 text-white font-bold'
                        : 'text-primary-foreground/90 hover:bg-white/10'
                      : active
                        ? 'bg-primary/15 text-primary font-bold'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground dark:hover:bg-zinc-900'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {Icon && <Icon className="h-4 w-4 opacity-75" />}
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {badge && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                          item.sectionId === 'reservar'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-primary/10 text-primary border border-primary/20'
                        )}
                      >
                        {item.sectionId === 'reservar' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                        <span>{badge}</span>
                      </span>
                    )}
                    {active && <span className={cn('h-1.5 w-1.5 rounded-full', isAccent ? 'bg-white' : 'bg-primary')} />}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Botones de Acción Móvil */}
          <div className={cn('mt-6 pt-6 border-t space-y-3', isAccent ? 'border-white/20' : 'border-border dark:border-zinc-800')}>
            <Link
              href={primaryReservationHref}
              onClick={(e) => handleNavClick(e, primaryReservationHref)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-center text-sm font-bold uppercase tracking-wider shadow-md active:scale-95',
                isAccent
                  ? 'bg-white text-primary hover:bg-white/90'
                  : 'bg-primary text-primary-foreground shadow-primary/20'
              )}
            >
              <CalendarCheck2 className="h-4 w-4" />
              <span>Reservar Turno Online</span>
            </Link>

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              >
                <WhatsAppIcon className="h-4 w-4" />
                <span>Contactar por WhatsApp</span>
              </a>
            )}

            {phone && (
              <a
                href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-center text-xs font-semibold',
                  isAccent
                    ? 'border-white/20 bg-white/10 text-primary-foreground hover:bg-white/20'
                    : 'border-border bg-muted/30 text-foreground hover:bg-muted dark:border-zinc-800 dark:bg-zinc-900'
                )}
              >
                <Phone className={cn('h-3.5 w-3.5', isAccent ? 'text-white' : 'text-primary')} />
                <span>Llamar: {phone}</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Modal de Autenticación / Registro Interactivo */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        loginHref={customerLoginHref}
        registerHref={customerRegisterHref}
      />
    </header>
  )
}
