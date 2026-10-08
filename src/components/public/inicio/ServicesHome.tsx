'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, CalendarCheck2, Clock, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn, formatPrice } from '@/lib/utils'
import type { BookingSectionSettings, CompanyInfo, GallerySectionSettings, HeroContent, Service } from '@/types/website-settings'
import { PublicBooking } from '@/components/public/agenda/PublicBooking'
import { useStorefrontStyle } from '@/components/public/storefront-style-context'
import { STOREFRONT_EYEBROW_CLASS, STOREFRONT_HEADING_CLASS } from '@/lib/website/storefront-style'

/** Lo que publica la agenda (GET /api/public/agenda/[slug]); `null` si la tienda no toma turnos online. */
export interface PublicAgendaInfo {
  currency: string
  services: Array<{ id: string; name: string; duration: number; price: number | null; professionalIds?: string[] }>
  professionals: Array<{ id: string; name: string; color: string; photoUrl?: string | null; specialty?: string | null }>
}

type TeamMember = PublicAgendaInfo['professionals'][number]

/** Foto del profesional o, sin foto, su inicial sobre su color. */
function TeamAvatar({ person, className }: { person: TeamMember; className: string }) {
  if (person.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.photoUrl} alt="" className={cn('rounded-full object-cover shadow-sm', className)} />
  }
  return (
    <span
      aria-hidden="true"
      className={cn('flex items-center justify-center rounded-full font-serif text-white shadow-sm', className)}
      style={{ backgroundColor: person.color || 'var(--primary)' }}
    >
      {person.name.trim().slice(0, 1).toUpperCase()}
    </span>
  )
}

/** El primer turno libre (GET /api/public/agenda/[slug]?next=1). */
export interface NextFreeSlot {
  date: string
  time: string
  isToday: boolean
  isTomorrow: boolean
  serviceId: string
  serviceName: string
  professionalName: string | null
}

const SHORT_WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** «Hoy 15:30», «Mañana 10:00» o «jue 9 · 10:00». */
export function formatNextSlot(slot: Pick<NextFreeSlot, 'date' | 'time' | 'isToday' | 'isTomorrow'>): string {
  if (slot.isToday) return `Hoy ${slot.time}`
  if (slot.isTomorrow) return `Mañana ${slot.time}`
  const [year, month, day] = slot.date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${SHORT_WEEKDAYS[weekday]} ${day} · ${slot.time}`
}

async function fetchAgenda(url: string): Promise<PublicAgendaInfo | null> {
  const response = await fetch(url)
  if (!response.ok) return null
  return (await response.json().catch(() => null)) as PublicAgendaInfo | null
}

/**
 * La agenda pública de la tienda. Por /<tienda>/… el slug sale de la ruta; en
 * el subdominio propio la ruta no lo trae y se usa el de la empresa.
 */
export function usePublicAgenda(enabled = true, fallbackSlug?: string | null) {
  const pathSlug = getTenantSlugFromPathname(usePathname())
  const tenantSlug = pathSlug || fallbackSlug || ''
  const { data, isLoading } = useSWR(
    enabled && tenantSlug ? `/api/public/agenda/${encodeURIComponent(tenantSlug)}` : null,
    fetchAgenda,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )
  // En el subdominio los enlaces van sin prefijo (/turnos).
  const tenantPrefix = pathSlug ? `/${pathSlug}` : ''
  return {
    agenda: data ?? null,
    isLoading,
    tenantSlug,
    tenantPrefix,
    bookingHref: data ? `${tenantPrefix}/turnos` : null,
  }
}

export interface ServiceMenuItem {
  id: string
  name: string
  detail?: string
  duration?: string
  price?: string
  bookingHref?: string
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/**
 * La carta sale de la agenda si toma turnos online (cada ítem se reserva
 * directo); si no, de los servicios cargados en el sitio web.
 */
export function buildServiceMenu(agenda: PublicAgendaInfo | null, websiteServices: Service[], tenantPrefix: string): ServiceMenuItem[] {
  if (agenda && agenda.services.length > 0) {
    return agenda.services.map((service) => ({
      id: service.id,
      name: service.name,
      duration: formatDuration(service.duration),
      price: service.price && service.price > 0 ? formatCurrency(service.price, { currency: agenda.currency }) : undefined,
      bookingHref: `${tenantPrefix}/turnos?servicio=${encodeURIComponent(service.id)}`,
    }))
  }
  return websiteServices
    .filter((service) => service.active !== false)
    .map((service) => ({
      id: service.id,
      name: service.title,
      detail: service.description || undefined,
      duration: service.duration || undefined,
      price:
        typeof service.price === 'number' && service.price > 0
          ? formatPrice(service.price)
          : typeof service.price === 'string' && service.price.trim()
            ? service.price.trim()
            : undefined,
    }))
}

/** «Próximo turno libre» para la portada; null si no hay en la próxima semana. */
export function useNextFreeSlot(slug: string | null | undefined, enabled: boolean) {
  const { data } = useSWR(
    enabled && slug ? `/api/public/agenda/${encodeURIComponent(slug)}?next=1` : null,
    async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) return null
      const body = (await response.json().catch(() => null)) as { next?: NextFreeSlot | null } | null
      return body?.next ?? null
    },
    // Un horario se ocupa rápido: se refresca cada minuto mientras la portada está abierta.
    { revalidateOnFocus: true, refreshInterval: 60000, dedupingInterval: 30000 }
  )
  return data ?? null
}

interface ServicesHeroProps {
  companyInfo: CompanyInfo
  heroContent: HeroContent
  bookingHref: string | null
  contactHref: string
  phoneClean: string
  menu: ServiceMenuItem[]
  nextSlot?: NextFreeSlot | null
  /** Con la reserva en la página: elige el servicio del próximo turno y baja a reservar. */
  onBookNext?: (serviceId: string) => void
}

/** Portada de Servicios: lo primero es reservar; al lado, una muestra de la carta. */
export function ServicesHero({ companyInfo, heroContent, bookingHref, contactHref, phoneClean, menu, nextSlot, onBookNext }: ServicesHeroProps) {
  const hours = companyInfo.hours?.weekdays?.trim()
  const preview = menu.slice(0, 4)

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-muted/60 text-foreground dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-white" data-storefront-hero="services">
      {/* Sigue al tema elegido: clara con el color de la marca, u oscura. */}
      <div aria-hidden="true" className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl dark:bg-primary/30" />
      <div className="container relative mx-auto grid gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:items-center lg:px-8 lg:py-20">
        <div className="lg:col-span-7">
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
            {heroContent.badge || companyInfo.slogan || 'Reservá tu lugar'}
          </span>
          <h1 className="mt-4 text-balance font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {heroContent.title || companyInfo.name || 'Tu mejor versión empieza acá'}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg dark:text-slate-300">
            {heroContent.subtitle || 'Elegí el servicio, el día y el horario que te quede cómodo.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {bookingHref ? (
              <Link
                href={bookingHref}
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white dark:focus-visible:ring-offset-slate-950"
              >
                <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
                {heroContent.ctaPrimaryText || 'Reservar turno'}
              </Link>
            ) : null}
            <a
              href={contactHref}
              target={phoneClean ? '_blank' : undefined}
              rel={phoneClean ? 'noopener noreferrer' : undefined}
              className={
                bookingHref
                  ? 'inline-flex h-12 items-center gap-2 rounded-full border border-foreground/20 px-6 text-sm font-semibold text-foreground transition hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/30 dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-white'
                  : 'inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-white'
              }
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              {bookingHref ? heroContent.ctaSecondaryText || 'Consultar' : 'Pedir turno por WhatsApp'}
            </a>
          </div>
          {nextSlot && bookingHref && <NextSlotBadge slot={nextSlot} bookingHref={bookingHref} onBook={onBookNext} tone="auto" />}
          {(hours || companyInfo.address) && (
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground dark:text-slate-300">
              {hours && (
                <li className="flex items-center gap-2">
                  <Clock aria-hidden="true" className="h-4 w-4 text-primary" />
                  {hours}
                </li>
              )}
              {companyInfo.address && (
                <li className="flex items-center gap-2">
                  <MapPin aria-hidden="true" className="h-4 w-4 text-primary" />
                  {companyInfo.address}
                </li>
              )}
            </ul>
          )}
        </div>

        {preview.length > 0 && (
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <p className="font-serif text-xl">Nuestros servicios</p>
              <ul className="mt-4 divide-y divide-border dark:divide-white/10">
                {preview.map((item) => (
                  <li key={item.id} className="flex items-baseline gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{item.name}</span>
                      {item.duration && <span className="text-xs text-muted-foreground dark:text-slate-400">{item.duration}</span>}
                    </span>
                    {item.price && <span className="shrink-0 font-semibold text-primary">{item.price}</span>}
                  </li>
                ))}
              </ul>
              <a href="#servicios" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground/80 hover:text-foreground dark:text-white/80 dark:hover:text-white">
                Ver la carta completa <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const RESERVE_BUTTON_CLASS =
  'shrink-0 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

/** Carta de servicios estilo menú: nombre, puntos guía, precio y reserva directa. */
export function ServiceMenu({
  menu,
  bookingHref,
  onBook,
}: {
  menu: ServiceMenuItem[]
  bookingHref: string | null
  /** Con la reserva en la misma página, «Reservar» elige el servicio ahí en vez de navegar. */
  onBook?: (serviceId: string) => void
}) {
  if (menu.length === 0) return null
  return (
    <section id="servicios" aria-labelledby="service-menu" className="scroll-mt-24 bg-background py-14 sm:py-20">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Carta</span>
          <h2 id="service-menu" className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">Servicios y precios</h2>
        </div>
        <ul className="mt-10 grid gap-x-12 gap-y-1 md:grid-cols-2">
          {menu.map((item) => (
            <li key={item.id} className="group border-b border-border/70 py-4">
              <div className="flex items-baseline gap-2">
                <h3 className="font-semibold">{item.name}</h3>
                <span aria-hidden="true" className="flex-1 translate-y-[-3px] border-b border-dotted border-foreground/25" />
                <span className="shrink-0 font-semibold">{item.price ?? 'Consultar'}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span className="line-clamp-1">{[item.duration, item.detail].filter(Boolean).join(' · ')}</span>
                {item.bookingHref && (onBook ? (
                  <button
                    type="button"
                    onClick={() => onBook(item.id)}
                    aria-label={'Reservar ' + item.name}
                    className={RESERVE_BUTTON_CLASS}
                  >
                    Reservar
                  </button>
                ) : (
                  <Link href={item.bookingHref} aria-label={'Reservar ' + item.name} className={RESERVE_BUTTON_CLASS}>
                    Reservar
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {bookingHref && (
          <div className="mt-10 text-center">
            <Link
              href={bookingHref}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
              Reservar turno
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

/** El equipo que atiende: solo nombres e iniciales, los datos que publica la agenda. */
export function ServiceTeam({ agenda }: { agenda: PublicAgendaInfo | null }) {
  const team = agenda?.professionals ?? []
  if (team.length < 2) return null
  return (
    <section id="equipo" aria-labelledby="service-team" className="scroll-mt-20 border-y bg-muted/30 py-12 sm:py-16">
      <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
        <h2 id="service-team" className="font-serif text-2xl tracking-tight sm:text-3xl">Nuestro equipo</h2>
        <ul className="mt-8 flex flex-wrap justify-center gap-6 sm:gap-10">
          {team.map((person) => (
            <li key={person.id} className="flex w-32 flex-col items-center gap-2 text-center">
              <TeamAvatar person={person} className="h-24 w-24 text-3xl" />
              <span className="text-sm font-semibold">{person.name}</span>
              {person.specialty && <span className="-mt-1.5 text-xs text-muted-foreground">{person.specialty}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * «Reservá tu turno» en el inicio: la misma reserva de /turnos, sin salir de la
 * portada. Solo se arma si la agenda acepta reservas online.
 */
export function BookingSection({
  settings,
  agenda,
  slug,
  serviceId,
  nextSlot,
  onBookNext,
}: {
  settings: BookingSectionSettings
  agenda: PublicAgendaInfo
  slug: string
  /** Servicio elegido desde la carta; cambia y la reserva arranca con él. */
  serviceId?: string
  nextSlot?: NextFreeSlot | null
  onBookNext?: (serviceId: string) => void
}) {
  const style = useStorefrontStyle()
  const team = settings.showTeam ? agenda.professionals : []
  return (
    <section id="reservar" aria-labelledby="booking-title" className="scroll-mt-24 border-y bg-muted/30 py-14 sm:py-20">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className={STOREFRONT_EYEBROW_CLASS[style]}>Turnos online</span>
          <h2 id="booking-title" className={cn('mt-2 text-3xl sm:text-4xl', STOREFRONT_HEADING_CLASS[style])}>
            {settings.title || 'Reservá tu turno'}
          </h2>
          {settings.subtitle && <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{settings.subtitle}</p>}
          {nextSlot && !serviceId && <NextSlotBadge slot={nextSlot} bookingHref="#reservar" onBook={onBookNext} tone="light" />}
        </div>
        {team.length > 1 && (
          <ul aria-label="Nuestro equipo" className="mt-8 flex flex-wrap justify-center gap-5">
            {team.map((person) => (
              <li key={person.id} className="flex w-20 flex-col items-center gap-1.5 text-center">
                <TeamAvatar person={person} className="h-14 w-14 text-lg" />
                <span className="line-clamp-1 text-xs font-semibold">{person.name}</span>
                {person.specialty && <span className="-mt-1 line-clamp-1 text-[11px] text-muted-foreground">{person.specialty}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 text-left">
          <PublicBooking key={serviceId ?? 'sin-servicio'} slug={slug} initialServiceId={serviceId} />
        </div>
      </div>
    </section>
  )
}

/** «Próximo turno libre: Hoy 15:30 con Lucas», con acceso directo a reservarlo. */
export function NextSlotBadge({
  slot,
  bookingHref,
  onBook,
  tone = 'dark',
}: {
  slot: NextFreeSlot
  bookingHref: string
  onBook?: (serviceId: string) => void
  /** «auto»: sigue al tema de la página (la portada de Servicios). */
  tone?: 'dark' | 'light' | 'auto'
}) {
  const label = `${formatNextSlot(slot)}${slot.professionalName ? ` con ${slot.professionalName}` : ''}`
  const className = cn(
    'mt-6 inline-flex max-w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    tone === 'dark'
      ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
      : tone === 'auto'
        ? 'border-primary/25 bg-primary/5 hover:bg-primary/10 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
        : 'border-primary/25 bg-primary/5 hover:bg-primary/10'
  )
  const content = (
    <>
      <span aria-hidden="true" className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>
      <span className="min-w-0">
        <span className={cn('block text-xs', tone === 'dark' ? 'text-slate-300' : tone === 'auto' ? 'text-muted-foreground dark:text-slate-300' : 'text-muted-foreground')}>Próximo turno libre · {slot.serviceName}</span>
        <span className="block truncate font-semibold">{label}</span>
      </span>
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
    </>
  )
  return onBook ? (
    <button type="button" onClick={() => onBook(slot.serviceId)} className={className}>
      {content}
    </button>
  ) : (
    <Link href={`${bookingHref.split('?')[0]}?servicio=${encodeURIComponent(slot.serviceId)}`} className={className}>
      {content}
    </Link>
  )
}

/** Galería de trabajos: grilla de fotos que se amplía al tocarla. */
export function ServiceGallery({ settings }: { settings: GallerySectionSettings | undefined }) {
  const style = useStorefrontStyle()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const images = settings?.enabled ? settings.images : []
  if (images.length === 0) return null
  const open = openIndex !== null ? images[openIndex] : null

  return (
    <section id="galeria" aria-labelledby="gallery-title" className="scroll-mt-20 bg-background py-14 sm:py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className={STOREFRONT_EYEBROW_CLASS[style]}>Galería</span>
          <h2 id="gallery-title" className={cn('mt-2 text-3xl sm:text-4xl', STOREFRONT_HEADING_CLASS[style])}>
            {settings?.title || 'Nuestros trabajos'}
          </h2>
          {settings?.subtitle && <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{settings.subtitle}</p>}
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className={cn(index === 0 && images.length > 4 && 'md:col-span-2 md:row-span-2')}>
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                aria-label={image.caption ? `Ver foto: ${image.caption}` : `Ver foto ${index + 1}`}
                className="group relative block aspect-[4/5] h-full w-full overflow-hidden rounded-2xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.caption || ''} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                {image.caption && (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-left text-xs font-semibold text-white">
                    {image.caption}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => { if (!next) setOpenIndex(null) }}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">{open?.caption || 'Foto de la galería'}</DialogTitle>
          <DialogDescription className="sr-only">Foto ampliada de la galería de trabajos.</DialogDescription>
          {open && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={open.url} alt={open.caption || ''} className="max-h-[80vh] w-full bg-black object-contain" />
              {open.caption && <p className="p-4 text-sm">{open.caption}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

/**
 * «Cómo llegar»: dirección, horarios y accesos directos (mapa, WhatsApp,
 * llamada). Reemplaza al bloque de contacto genérico en la plantilla.
 */
export function ServicesLocation({ companyInfo, bookingHref }: { companyInfo: CompanyInfo; bookingHref: string | null }) {
  const style = useStorefrontStyle()
  const address = companyInfo.address?.trim()
  const mapsHref = companyInfo.mapsUrl?.trim()
    || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null)
  const whatsapp = (companyInfo.whatsapp || companyInfo.phone || '').replace(/\D/g, '')
  const phone = (companyInfo.phone || '').replace(/\D/g, '')
  const hours = [
    { day: 'Lunes a viernes', value: companyInfo.hours?.weekdays?.trim() },
    { day: 'Sábados', value: companyInfo.hours?.saturday?.trim() },
    { day: 'Domingos', value: companyInfo.hours?.sunday?.trim() },
  ].filter((row) => row.value)

  return (
    <section id="contacto" aria-labelledby="location-title" className="scroll-mt-20 border-t bg-muted/30 py-14 sm:py-20">
      <div className="container mx-auto grid gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <span className={STOREFRONT_EYEBROW_CLASS[style]}>Visitanos</span>
          <h2 id="location-title" className={cn('mt-2 text-3xl sm:text-4xl', STOREFRONT_HEADING_CLASS[style])}>Cómo llegar</h2>
          {address && (
            <p className="mt-4 flex items-start gap-2 text-lg">
              <MapPin aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
              {address}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {mapsHref && (
              <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110">
                <Navigation aria-hidden="true" className="h-4 w-4" />
                Abrir en Google Maps
              </a>
            )}
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition hover:bg-muted">
                <MessageCircle aria-hidden="true" className="h-4 w-4 text-[#25D366]" />
                WhatsApp
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`} className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition hover:bg-muted">
                <Phone aria-hidden="true" className="h-4 w-4" />
                Llamar
              </a>
            )}
          </div>
        </div>

        <div className="rounded-3xl border bg-background p-6 shadow-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Clock aria-hidden="true" className="h-4 w-4 text-primary" />
            Horarios
          </p>
          {hours.length > 0 ? (
            <dl className="mt-4 divide-y">
              {hours.map((row) => (
                <div key={row.day} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <dt className="text-muted-foreground">{row.day}</dt>
                  <dd className="font-semibold">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Consultá nuestros horarios por WhatsApp.</p>
          )}
          {bookingHref && (
            <Link href={bookingHref} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110">
              <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
              Reservar turno
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
