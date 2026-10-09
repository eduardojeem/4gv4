'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, CalendarCheck2, Clock, MapPin, Menu, MessageCircle, Moon, Phone, Sun, User, X } from 'lucide-react'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePublicAgenda } from '@/components/public/inicio/ServicesHome'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useHydrated } from '@/hooks/use-hydrated'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { headerOptionFor } from '@/lib/website/storefront-style'
import { openStatus, openStatusLabel } from '@/lib/website/opening-hours'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'

const HEADER_TONE = {
  solid: {
    bar: 'bg-background/90 text-foreground border-border/80 supports-[backdrop-filter]:backdrop-blur-md',
    muted: 'text-muted-foreground',
    link: 'hover:bg-muted hover:text-foreground',
    active: 'text-primary',
    indicator: 'bg-primary',
    logo: 'bg-primary text-primary-foreground',
    topBar: 'bg-muted/60 text-muted-foreground',
    panel: 'bg-background text-foreground border-border',
  },
  accent: {
    bar: 'bg-primary text-primary-foreground border-primary/30',
    muted: 'text-primary-foreground/75',
    link: 'hover:bg-white/10',
    active: 'text-primary-foreground',
    indicator: 'bg-primary-foreground',
    logo: 'bg-white text-primary',
    topBar: 'bg-black/15 text-primary-foreground/85',
    panel: 'bg-primary text-primary-foreground border-primary/30',
  },
  dark: {
    bar: 'bg-slate-950 text-white border-slate-900',
    muted: 'text-slate-400',
    link: 'hover:bg-white/10',
    active: 'text-white',
    indicator: 'bg-primary',
    logo: 'bg-primary text-primary-foreground',
    topBar: 'bg-slate-900 text-slate-400',
    panel: 'bg-slate-950 text-white border-slate-900',
  },
} as const

/** Enlaces del sitio de servicios. Los anclajes viven en el inicio. */
export function servicesSiteLinks(prefix: string, catalogEnabled: boolean, bookingHref: string | null = null) {
  return [
    { href: `${prefix}/inicio#servicios`, label: 'Servicios' },
    // Sin reservas online no hay a dónde ir: «Reservar» pasa a WhatsApp en el botón.
    ...(bookingHref ? [{ href: bookingHref, label: 'Turnos' }] : []),
    { href: `${prefix}/inicio#resenas`, label: 'Opiniones' },
    { href: `${prefix}/inicio#contacto`, label: 'Contacto' },
    ...(catalogEnabled ? [{ href: `${prefix}/productos`, label: 'Tienda' }] : []),
  ]
}

/** La sección del inicio que se está viendo, para marcarla en el menú. */
function useActiveSection(ids: string[], enabled: boolean) {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(',')
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return
    const elements = key.split(',').map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el))
    if (elements.length === 0) return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        const best = [...visible.entries()].filter(([, ratio]) => ratio > 0).sort((a, b) => b[1] - a[1])[0]
        setActive(best ? best[0] : null)
      },
      // Cuenta la franja central de la pantalla, debajo del encabezado.
      { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [key, enabled])
  return enabled ? active : null
}

/**
 * El encabezado de la plantilla «Servicios»: un sitio de peluquería o
 * barbería, no una tienda. Sin buscador ni franja de marketplace, con los
 * accesos del negocio, si está abierto ahora y «Reservar» siempre a mano.
 */
export function ServicesSiteHeader({
  initialSettings = null,
  catalogEnabled = false,
}: {
  initialSettings?: WebsiteSettings | null
  /** Si la tienda vende productos: suma «Tienda» y el carrito. */
  catalogEnabled?: boolean
}) {
  const pathname = usePathname()
  const { user } = useAuth()
  const { settings } = useWebsiteSettings()
  const effectiveSettings = settings ?? initialSettings
  const companyInfo = useStorefrontCompanyInfo(effectiveSettings?.company_info)
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { isDark, setTheme } = useTheme()
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')

  const pathSlug = getTenantSlugFromPathname(pathname)
  const prefix = pathSlug ? `/${pathSlug}` : ''
  const { agenda } = usePublicAgenda(true, companyInfo?.slug)
  // La agenda y la hora se conocen en el navegador: hasta terminar de hidratar
  // se dibuja lo mismo que en el servidor (si no, «Turnos» desfasaba el resto).
  const hydrated = useHydrated()
  const bookingEnabled = Boolean(effectiveSettings?.booking_section?.enabled)
  const bookingHref = hydrated && agenda ? (bookingEnabled ? `${prefix}/inicio#reservar` : `${prefix}/turnos`) : null

  const tone = HEADER_TONE[headerOptionFor(companyInfo?.headerStyle)]
  const name = companyInfo?.name?.trim() || 'Inicio'
  const logo = companyInfo?.logoUrl?.trim()
  const whatsapp = (companyInfo?.whatsapp || companyInfo?.phone || '').replace(/\D/g, '')
  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp}` : null
  const phone = companyInfo?.phone?.trim()
  const hours = companyInfo?.hours?.weekdays?.trim()
  const address = companyInfo?.address?.trim()
  const mapsHref = companyInfo?.mapsUrl?.trim() || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null)
  const status = hydrated ? openStatus(companyInfo?.hours) : { state: 'unknown' as const }
  const statusLabel = openStatusLabel(status)
  const links = servicesSiteLinks(prefix, catalogEnabled, bookingHref)
  // La sesión se conoce en el navegador: hasta hidratar se dibuja «Ingresar», igual que el servidor.
  const signedIn = hydrated && Boolean(user)
  const accountHref = signedIn ? `${prefix}/perfil` : prefix ? `${prefix}/cliente/login` : '/login'
  const fullName = user?.profile?.name?.trim() || user?.email?.split('@')[0] || ''
  const firstName = fullName.split(/\s+/)[0] || 'Mi perfil'
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'
  const avatar = (size: string) => (
    <Avatar className={cn(size, 'ring-2 ring-primary/30')}>
      <AvatarImage src={user?.profile?.avatar_url || ''} alt="" />
      <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">{initials}</AvatarFallback>
    </Avatar>
  )

  const onHome = pathname === `${prefix}/inicio` || pathname === prefix || pathname === '/'
  const activeSection = useActiveSection(['servicios', 'reservar', 'resenas', 'contacto'], onHome)
  const isActive = (href: string) => {
    const [path, hash] = href.split('#')
    if (hash) return onHome && activeSection === hash
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  useEffect(() => {
    // Con margen entre encoger y volver a crecer: al encogerse la página sube
    // unos píxeles, y con un solo umbral el encabezado parpadeaba.
    const onScroll = () => setScrolled((was) => (was ? window.scrollY > 8 : window.scrollY > 64))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const statusPill = statusLabel ? (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', status.state === 'open' ? 'bg-emerald-500' : 'bg-slate-400')} />
      {statusLabel}
    </span>
  ) : null

  return (
    <header
      className={cn('sticky top-0 z-50 w-full border-b transition-shadow duration-200', tone.bar, scrolled && 'shadow-md shadow-black/5')}
      data-services-header
    >
      {companyInfo?.showTopBar !== false && (hours || address || phone) && (
        <div className={cn('hidden overflow-hidden text-xs transition-[max-height] duration-200 md:block', tone.topBar, scrolled ? 'max-h-0' : 'max-h-10')}>
          <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-1.5 sm:px-6 lg:px-8">
            <span className="flex min-w-0 items-center gap-3">
              {statusPill}
              {hours && (
                <span className="flex items-center gap-1.5">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  {hours}
                </span>
              )}
            </span>
            <span className="flex min-w-0 items-center gap-4">
              {address && (mapsHref ? (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 truncate hover:underline">
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{address}
                </a>
              ) : (
                <span className="flex min-w-0 items-center gap-1.5 truncate"><MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{address}</span>
              ))}
              {phone && (
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="flex shrink-0 items-center gap-1.5 hover:underline">
                  <Phone aria-hidden="true" className="h-3.5 w-3.5" />{phone}
                </a>
              )}
            </span>
          </div>
        </div>
      )}

      <div className={cn('container mx-auto flex items-center justify-between gap-4 px-4 transition-[height] duration-200 sm:px-6 lg:px-8', scrolled ? 'h-14' : 'h-16')}>
        <Link href={`${prefix}/inicio`} className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain ring-1 ring-border/60" />
          ) : (
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-serif text-lg shadow-sm', tone.logo)}>
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-serif text-lg tracking-tight">{name}</span>
            {companyInfo?.slogan && <span className={cn('block truncate text-xs', tone.muted)}>{companyInfo.slogan}</span>}
          </span>
        </Link>

        <nav aria-label="Secciones del sitio" className="hidden items-center gap-0.5 lg:flex">
          {links.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'location' : undefined}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  tone.link,
                  active ? tone.active : tone.muted,
                )}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={cn('absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-opacity', tone.indicator, active ? 'opacity-100' : 'opacity-0')}
                />
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {catalogEnabled && <PublicCartButton />}
          {/* El ícono lo decide la clase «dark» (CSS): el servidor no sabe el tema elegido. */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Cambiar entre modo claro y oscuro"
            title="Modo claro u oscuro"
            className={cn('relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', tone.link)}
          >
            <Sun aria-hidden="true" className="h-4.5 w-4.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon aria-hidden="true" className="absolute h-4.5 w-4.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </button>
          {signedIn ? (
            <Link
              href={accountHref}
              aria-label={`Mi perfil (${fullName || 'cuenta'})`}
              title="Mi perfil"
              className={cn('flex h-10 items-center gap-2 rounded-full pl-1 pr-1 transition-colors md:pr-3', tone.link)}
            >
              {avatar('h-8 w-8')}
              <span className="hidden max-w-28 truncate text-sm font-semibold md:inline">{firstName}</span>
            </Link>
          ) : (
            <Link
              href={accountHref}
              className={cn('hidden h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors sm:inline-flex', tone.link)}
            >
              <User aria-hidden="true" className="h-4 w-4" />
              Ingresar
            </Link>
          )}
          {bookingHref ? (
            <Link
              href={bookingHref}
              className="group ml-1 hidden h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition hover:shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:inline-flex"
            >
              <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
              Reservar turno
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 hidden h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition hover:shadow-md hover:brightness-110 sm:inline-flex"
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              Pedir turno
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="services-site-menu"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            className={cn('flex h-10 w-10 items-center justify-center rounded-lg transition-colors lg:hidden', tone.link)}
          >
            {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="services-site-menu" aria-label="Menú" className={cn('border-t shadow-lg lg:hidden', tone.panel)}>
          <div className="container mx-auto px-4 py-4">
            {(statusPill || hours) && (
              <p className={cn('mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs', tone.muted)}>
                {statusPill}
                {!statusLabel && hours && <span className="flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{hours}</span>}
              </p>
            )}
            <ul className="grid gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(link.href) ? 'location' : undefined}
                    className={cn('flex items-center justify-between rounded-xl px-3 py-3 text-base font-semibold', tone.link, isActive(link.href) && tone.active)}
                  >
                    {link.label}
                    <ArrowRight aria-hidden="true" className="h-4 w-4 opacity-40" />
                  </Link>
                </li>
              ))}
              <li>
                {signedIn ? (
                  <Link href={accountHref} onClick={() => setOpen(false)} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5', tone.link)}>
                    {avatar('h-9 w-9')}
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-base font-semibold">{fullName || 'Mi cuenta'}</span>
                      <span className={cn('block text-xs', tone.muted)}>Ver mi perfil</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 opacity-40" />
                  </Link>
                ) : (
                  <Link href={accountHref} onClick={() => setOpen(false)} className={cn('flex items-center gap-2 rounded-xl px-3 py-3 text-base font-semibold', tone.link)}>
                    <User aria-hidden="true" className="h-4 w-4" />
                    Ingresar
                  </Link>
                )}
              </li>
            </ul>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {bookingHref && (
                <Link
                  href={bookingHref}
                  onClick={() => setOpen(false)}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
                >
                  <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
                  Reservar turno
                </Link>
              )}
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold',
                    bookingHref ? 'border border-current/20' : 'bg-primary text-primary-foreground shadow-sm',
                  )}
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  {bookingHref ? 'Escribir por WhatsApp' : 'Pedir turno por WhatsApp'}
                </a>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
