'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck2, Clock, MapPin, Menu, MessageCircle, User, X } from 'lucide-react'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { PublicCartButton } from '@/components/public/cart/PublicCartButton'
import { usePublicAgenda } from '@/components/public/inicio/ServicesHome'
import { useAuth } from '@/contexts/auth-context'
import { useHydrated } from '@/hooks/use-hydrated'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { headerOptionFor } from '@/lib/website/storefront-style'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'

const HEADER_TONE = {
  solid: { bar: 'bg-background text-foreground border-border/80', muted: 'text-muted-foreground', link: 'hover:bg-muted', logo: 'bg-primary text-primary-foreground', topBar: 'bg-muted/60 text-muted-foreground' },
  accent: { bar: 'bg-primary text-primary-foreground border-primary/30', muted: 'text-primary-foreground/75', link: 'hover:bg-white/10', logo: 'bg-white text-primary', topBar: 'bg-black/15 text-primary-foreground/85' },
  dark: { bar: 'bg-slate-950 text-white border-slate-900', muted: 'text-slate-400', link: 'hover:bg-white/10', logo: 'bg-primary text-primary-foreground', topBar: 'bg-slate-900 text-slate-400' },
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

/**
 * El encabezado de la plantilla «Servicios»: un sitio de peluquería o
 * barbería, no una tienda. Sin buscador ni franja de marketplace, con los
 * accesos del negocio y «Reservar» siempre a mano.
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

  const pathSlug = getTenantSlugFromPathname(pathname)
  const prefix = pathSlug ? `/${pathSlug}` : ''
  const { agenda } = usePublicAgenda(true, companyInfo?.slug)
  // La agenda se carga en el navegador: hasta terminar de hidratar, el menú es
  // el mismo que dibujó el servidor (si no, «Turnos» desfasaba el resto).
  const hydrated = useHydrated()
  const bookingEnabled = Boolean(effectiveSettings?.booking_section?.enabled)
  const bookingHref = hydrated && agenda ? (bookingEnabled ? `${prefix}/inicio#reservar` : `${prefix}/turnos`) : null

  const tone = HEADER_TONE[headerOptionFor(companyInfo?.headerStyle)]
  const name = companyInfo?.name?.trim() || 'Inicio'
  const logo = companyInfo?.logoUrl?.trim()
  const whatsapp = (companyInfo?.whatsapp || companyInfo?.phone || '').replace(/\D/g, '')
  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp}` : null
  const hours = companyInfo?.hours?.weekdays?.trim()
  const address = companyInfo?.address?.trim()
  const links = servicesSiteLinks(prefix, catalogEnabled, bookingHref)
  const accountHref = user ? `${prefix}/perfil` : prefix ? `${prefix}/cliente/login` : '/login'

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className={cn('sticky top-0 z-50 w-full border-b', tone.bar)} data-services-header>
      {companyInfo?.showTopBar !== false && (hours || address) && (
        <div className={cn('hidden text-xs md:block', tone.topBar)}>
          <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-1.5 sm:px-6 lg:px-8">
            {hours ? <span className="flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{hours}</span> : <span />}
            {address && <span className="flex items-center gap-1.5 truncate"><MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{address}</span>}
          </div>
        </div>
      )}

      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={`${prefix}/inicio`} className="flex min-w-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          ) : (
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-serif text-lg', tone.logo)}>
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-serif text-lg">{name}</span>
            {companyInfo?.slogan && <span className={cn('block truncate text-xs', tone.muted)}>{companyInfo.slogan}</span>}
          </span>
        </Link>

        <nav aria-label="Secciones del sitio" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={cn('rounded-lg px-3 py-2 text-sm transition-colors', tone.link)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {catalogEnabled && <PublicCartButton />}
          <Link href={accountHref} aria-label={user ? 'Mi perfil' : 'Ingresar'} className={cn('hidden h-10 w-10 items-center justify-center rounded-lg transition-colors sm:flex', tone.link)}>
            <User aria-hidden="true" className="h-4.5 w-4.5" />
          </Link>
          {bookingHref ? (
            <Link
              href={bookingHref}
              className="hidden h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:inline-flex"
            >
              <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
              Reservar turno
            </Link>
          ) : whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 sm:inline-flex"
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
        <nav id="services-site-menu" aria-label="Menú" className={cn('border-t lg:hidden', tone.bar)}>
          <ul className="container mx-auto space-y-1 px-4 py-3">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={() => setOpen(false)} className={cn('block rounded-lg px-3 py-3 text-base', tone.link)}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={accountHref} className={cn('block rounded-lg px-3 py-3 text-base', tone.link)}>
                {user ? 'Mi perfil' : 'Ingresar'}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
