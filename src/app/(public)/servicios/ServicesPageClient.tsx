'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownUp,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Scissors,
  Search,
  Sparkles,
  Tag,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { useStorefrontStyle } from '@/components/public/storefront-style-context'
import { AppImage } from '@/components/ui/app-image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { iconMap } from '@/lib/constants/brand-theme'
import { formatCurrency } from '@/lib/currency'
import { resolveProductImageUrl, shouldBypassImageOptimization } from '@/lib/images'
import { usePublicTenantPrefix } from '@/lib/public/tenant-client'
import { prefixPublicTenantPath } from '@/lib/public/tenant-path-shared'
import { cn } from '@/lib/utils'
import { formatWhatsAppPhone, getBusinessWhatsApp, openWhatsApp } from '@/lib/whatsapp'
import type { Service, ServicesSectionSettings } from '@/types/website-settings'

export interface ServicesPageAgendaService {
  productId: string
  name: string
  price: number
  hidePrice: boolean
  durationMinutes: number
  online: boolean
  catalogVisible: boolean
  imageUrl?: string | null
}

export interface ServicesPageProfessional {
  id: string
  name: string
  specialty?: string | null
  photoUrl?: string | null
  color: string
  serviceIds: string[]
}

interface ServicesPageClientProps {
  services: Service[]
  companyName: string
  whatsapp: string
  sectionText?: ServicesSectionSettings
  businessVertical?: string | null
  onlineBookingEnabled?: boolean
  bookingHref?: string
  agendaServices?: ServicesPageAgendaService[]
  professionals?: ServicesPageProfessional[]
  currency?: string
}

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'duration-asc'

function parseNumericDuration(durationText?: string): number | null {
  if (!durationText) return null
  const match = durationText.match(/\d+/)
  if (!match) return null
  const value = Number(match[0])
  return Number.isFinite(value) && value > 0 ? value : null
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'P'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function ServicesPageClient({
  services,
  companyName,
  whatsapp,
  sectionText,
  businessVertical,
  onlineBookingEnabled = false,
  bookingHref,
  agendaServices = [],
  professionals = [],
  currency = 'PYG',
}: ServicesPageClientProps) {
  const { tenantPrefix } = usePublicTenantPrefix()
  const storefrontStyle = useStorefrontStyle()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [originFilter, setOriginFilter] = useState<'all' | 'catalog' | 'inventory'>('all')
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('featured')

  const isBarberStyle = storefrontStyle === 'especial-para-barbero' || storefrontStyle === 'barber'
  const isBarbershopVertical = businessVertical === 'barbershop' || isBarberStyle
  const isPersonalCare = isBarbershopVertical || businessVertical === 'beauty_services' || businessVertical === 'cosmetics'
  const resolvedBookingHref = bookingHref || (tenantPrefix ? `${tenantPrefix}/turnos` : '/turnos')

  const activeServices = useMemo(
    () => services.filter((service) => service.active !== false),
    [services],
  )

  const agendaLookup = useMemo(() => {
    const byId = new Map<string, ServicesPageAgendaService>()
    const byName = new Map<string, ServicesPageAgendaService>()
    for (const item of agendaServices) {
      byId.set(item.productId, item)
      byName.set(item.name.trim().toLowerCase(), item)
    }
    return { byId, byName }
  }, [agendaServices])

  const enrichedServices = useMemo(() => {
    return activeServices.map((service) => {
      const matchedAgenda =
        agendaLookup.byId.get(service.id) ||
        agendaLookup.byName.get(service.title.trim().toLowerCase())

      const durationMinutes =
        parseNumericDuration(service.duration) ??
        (matchedAgenda && matchedAgenda.durationMinutes > 0 ? matchedAgenda.durationMinutes : null)

      const durationLabel =
        service.duration?.trim() ||
        (matchedAgenda && matchedAgenda.durationMinutes > 0 ? `${matchedAgenda.durationMinutes} min` : '')

      const hidePrice = service.price === null || Boolean(matchedAgenda?.hidePrice)
      const numericPrice =
        hidePrice
          ? null
          : typeof service.price === 'number'
            ? service.price
            : matchedAgenda && !matchedAgenda.hidePrice
              ? matchedAgenda.price
              : null

      const priceLabel = hidePrice
        ? 'Precio a consultar'
        : numericPrice === 0
          ? 'Gratuito'
          : numericPrice !== null
            ? formatCurrency(numericPrice, { currency })
            : typeof service.price === 'string' && service.price.trim()
              ? service.price.trim()
              : null

      const canBookOnline = Boolean(
        onlineBookingEnabled &&
        matchedAgenda &&
        matchedAgenda.online !== false &&
        matchedAgenda.catalogVisible !== false,
      )

      const bookingLink = canBookOnline && matchedAgenda
        ? `${resolvedBookingHref}?servicio=${encodeURIComponent(matchedAgenda.productId)}`
        : null

      const matchedProfessionals = matchedAgenda
        ? professionals.filter((pro) => !pro.serviceIds.length || pro.serviceIds.includes(matchedAgenda.productId))
        : []

      const coverImage = service.imageUrl || matchedAgenda?.imageUrl || undefined

      return {
        service,
        coverImage,
        durationMinutes,
        durationLabel,
        numericPrice,
        priceLabel,
        canBookOnline,
        bookingLink,
        matchedProfessionals,
      }
    })
  }, [activeServices, agendaLookup, currency, onlineBookingEnabled, professionals, resolvedBookingHref])

  const catalogCount = useMemo(
    () => activeServices.filter((s) => s.source !== 'inventory').length,
    [activeServices],
  )
  const inventoryCount = useMemo(
    () => activeServices.filter((s) => s.source === 'inventory').length,
    [activeServices],
  )
  const onlineBookableCount = useMemo(
    () => enrichedServices.filter((entry) => entry.canBookOnline).length,
    [enrichedServices],
  )

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    activeServices.forEach((s) => {
      const cat = s.category?.trim()
      if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1)
    })
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
  }, [activeServices])

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const filtered = enrichedServices.filter(({ service, canBookOnline }) => {
      const matchOrigin =
        originFilter === 'all' ||
        (originFilter === 'inventory' && service.source === 'inventory') ||
        (originFilter === 'catalog' && service.source !== 'inventory')
      const matchCategory = selectedCategory === 'all' || (service.category || 'General') === selectedCategory
      const matchOnline = !onlyOnline || canBookOnline
      const matchSearch =
        !q ||
        service.title.toLowerCase().includes(q) ||
        service.description.toLowerCase().includes(q) ||
        (service.category || '').toLowerCase().includes(q)
      return matchOrigin && matchCategory && matchOnline && matchSearch
    })

    if (sortBy === 'price-asc') {
      return [...filtered].sort((a, b) => (a.numericPrice ?? Number.MAX_SAFE_INTEGER) - (b.numericPrice ?? Number.MAX_SAFE_INTEGER))
    }
    if (sortBy === 'price-desc') {
      return [...filtered].sort((a, b) => (b.numericPrice ?? -1) - (a.numericPrice ?? -1))
    }
    if (sortBy === 'duration-asc') {
      return [...filtered].sort((a, b) => (a.durationMinutes ?? Number.MAX_SAFE_INTEGER) - (b.durationMinutes ?? Number.MAX_SAFE_INTEGER))
    }
    return [...filtered].sort((a, b) => Number(Boolean(b.service.featured)) - Number(Boolean(a.service.featured)))
  }, [enrichedServices, originFilter, selectedCategory, onlyOnline, searchQuery, sortBy])

  const handleContactService = (serviceName: string, priceLabel?: string | null) => {
    const phoneToUse = whatsapp || getBusinessWhatsApp()
    const priceSnippet = priceLabel && priceLabel !== 'Precio a consultar' ? ` (${priceLabel})` : ''
    openWhatsApp({
      phone: formatWhatsAppPhone(phoneToUse),
      message: `¡Hola ${companyName}! Me gustaría consultar o agendar el servicio: *${serviceName}*${priceSnippet}.`,
    })
  }

  const searchPlaceholder = isBarbershopVertical
    ? 'Buscar servicio (ej. corte, barba, combo, color)...'
    : isPersonalCare
      ? 'Buscar servicio o tratamiento...'
      : 'Buscar servicio por nombre o categoría...'

  const defaultHeroTitle = isBarbershopVertical
    ? 'Carta de Servicios y Rituales'
    : 'Nuestros Servicios'
  const defaultHeroSubtitle = isBarbershopVertical
    ? `Elegí tu corte, ritual de barba o tratamiento capilar en ${companyName}. Consultá precios al instante o reservá tu turno online.`
    : `Conocé los servicios de ${companyName}, compará opciones y coordiná directamente con nuestro equipo.`

  if (activeServices.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center px-4 py-20 text-center">
        <div className={cn(
          'w-full rounded-3xl border px-6 py-16',
          isBarberStyle
            ? 'border-white/10 bg-[#111116] text-white'
            : 'border-primary/15 bg-primary/5',
        )}>
          {isBarbershopVertical ? (
            <Scissors className="mx-auto h-12 w-12 text-primary" />
          ) : (
            <Sparkles className="mx-auto h-12 w-12 text-primary/60" />
          )}
          <h1 className="mt-4 text-2xl font-bold">Catálogo de Servicios</h1>
          <p className={cn('mt-2 text-sm', isBarberStyle ? 'text-zinc-400' : 'text-muted-foreground')}>
            Estamos preparando nuestra carta de servicios disponibles. ¡Consultanos pronto!
          </p>
          {onlineBookingEnabled && (
            <Button asChild className="mt-6 rounded-full px-6">
              <Link href={resolvedBookingHref}>
                <CalendarCheck2 className="mr-2 h-4 w-4" />
                Ir a reservar turno
              </Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── HERO BANNER ── */}
      <section
        className={cn(
          'relative isolate overflow-hidden border-b',
          isBarberStyle
            ? 'border-white/10 bg-[#0B0B0F] text-white'
            : 'border-primary/10 bg-primary/[0.04]',
        )}
      >
        {isBarberStyle ? (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-[3px]"
              style={{
                background:
                  'linear-gradient(90deg, var(--primary), color-mix(in oklch, var(--primary) 80%, #f97316 20%))',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-28 -top-28 -z-10 h-80 w-80 rounded-full opacity-25 blur-3xl"
              style={{ background: 'var(--primary)' }}
            />
          </>
        ) : (
          <>
            <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          </>
        )}

        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8">
          <div>
            <Badge
              className={cn(
                'px-3 py-1 font-bold uppercase tracking-wider text-[11px]',
                isBarberStyle
                  ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/20'
                  : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/10',
              )}
            >
              {isBarbershopVertical ? (
                <Scissors className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {sectionText?.badge || (isBarbershopVertical ? 'Servicios de Salón' : 'Servicios Profesionales')}
            </Badge>

            <h1
              className={cn(
                'mt-4 max-w-3xl text-3xl leading-tight sm:text-5xl',
                isBarberStyle
                  ? 'font-black uppercase tracking-tight text-white'
                  : 'font-black tracking-tight text-foreground',
              )}
            >
              {sectionText?.title || defaultHeroTitle}
            </h1>

            <p className={cn('mt-3.5 max-w-2xl text-sm leading-relaxed sm:text-base', isBarberStyle ? 'text-zinc-300' : 'text-muted-foreground')}>
              {sectionText?.subtitle || defaultHeroSubtitle}
            </p>

            {/* Barra de búsqueda en Hero */}
            <div className="relative mt-6 max-w-md">
              <Search className={cn('pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2', isBarberStyle ? 'text-zinc-400' : 'text-muted-foreground')} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Buscar servicio"
                className={cn(
                  'h-11 rounded-full pl-10 pr-10 text-sm shadow-sm',
                  isBarberStyle
                    ? 'border-white/15 bg-white/10 text-white placeholder:text-zinc-400 focus-visible:border-primary'
                    : 'border-border/80 bg-background/90',
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors',
                    isBarberStyle ? 'text-zinc-400 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tarjeta lateral: Estado de turnos y acceso directo */}
          <div
            className={cn(
              'rounded-3xl border p-5 sm:p-6 shadow-lg',
              isBarberStyle
                ? 'border-white/15 bg-[#14141B]/95 text-white'
                : 'border-border/70 bg-card text-card-foreground',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                  {onlineBookingEnabled ? 'Turnos en línea activos' : 'Atención personalizada'}
                </p>
                <h2 className="mt-1 text-lg font-black tracking-tight">
                  {onlineBookingEnabled ? 'Reservá tu lugar en segundos' : 'Consultá precios y horarios'}
                </h2>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                {onlineBookingEnabled ? <CalendarCheck2 className="h-5 w-5" /> : <WhatsAppIcon className="h-5 w-5" />}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className={cn('rounded-2xl border px-2 py-2.5', isBarberStyle ? 'border-white/10 bg-white/[0.03]' : 'border-border/60 bg-muted/40')}>
                <p className="text-lg font-black tabular-nums">{activeServices.length}</p>
                <p className={cn('text-[10px] font-medium', isBarberStyle ? 'text-zinc-400' : 'text-muted-foreground')}>Servicios</p>
              </div>
              <div className={cn('rounded-2xl border px-2 py-2.5', isBarberStyle ? 'border-white/10 bg-white/[0.03]' : 'border-border/60 bg-muted/40')}>
                <p className="text-lg font-black tabular-nums text-primary">
                  {onlineBookingEnabled ? onlineBookableCount : 'Directo'}
                </p>
                <p className={cn('text-[10px] font-medium', isBarberStyle ? 'text-zinc-400' : 'text-muted-foreground')}>
                  {onlineBookingEnabled ? 'Online' : 'WhatsApp'}
                </p>
              </div>
              <div className={cn('rounded-2xl border px-2 py-2.5', isBarberStyle ? 'border-white/10 bg-white/[0.03]' : 'border-border/60 bg-muted/40')}>
                <p className="text-lg font-black tabular-nums">
                  {professionals.length > 0 ? professionals.length : '100%'}
                </p>
                <p className={cn('text-[10px] font-medium', isBarberStyle ? 'text-zinc-400' : 'text-muted-foreground')}>
                  {professionals.length > 0 ? (professionals.length === 1 ? 'Profesional' : 'Profesionales') : 'Dedicado'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              {onlineBookingEnabled ? (
                <Button asChild className="h-11 flex-1 rounded-full font-extrabold uppercase tracking-wider text-xs shadow-md">
                  <Link href={resolvedBookingHref}>
                    <CalendarCheck2 className="mr-2 h-4 w-4" />
                    Reservar turno ahora
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => handleContactService('consulta general de servicios')}
                  className="h-11 flex-1 rounded-full font-extrabold uppercase tracking-wider text-xs shadow-md"
                >
                  <WhatsAppIcon className="mr-2 h-4 w-4" />
                  Consultar por WhatsApp
                </Button>
              )}

              {onlineBookingEnabled && whatsapp && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleContactService('turnos y disponibilidad')}
                  className={cn(
                    'h-11 rounded-full px-4 text-xs font-bold',
                    isBarberStyle && 'border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white',
                  )}
                >
                  <WhatsAppIcon className="mr-1.5 h-4 w-4 text-emerald-500" />
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CUERPO PRINCIPAL & CATÁLOGO ── */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        {/* Barra de Filtros, Categorías y Ordenamiento */}
        <div className="mb-8 space-y-4">
          {catalogCount > 0 && inventoryCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/70 bg-muted/50 p-1.5 max-w-fit">
              <button
                type="button"
                onClick={() => setOriginFilter('all')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  originFilter === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Todos ({activeServices.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setOriginFilter('catalog')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  originFilter === 'catalog' ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Tag className="h-3.5 w-3.5 text-primary" />
                <span>Carta Web ({catalogCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setOriginFilter('inventory')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  originFilter === 'inventory' ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Scissors className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Catálogo / Agenda ({inventoryCount})</span>
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Categorías y filtro online */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                      selectedCategory === 'all'
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    Todas ({activeServices.length})
                  </button>
                  {categories.map(({ name, count }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedCategory(name)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                        selectedCategory === name
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      {name} ({count})
                    </button>
                  ))}
                </>
              )}

              {onlineBookingEnabled && onlineBookableCount > 0 && onlineBookableCount < activeServices.length && (
                <button
                  type="button"
                  aria-pressed={onlyOnline}
                  onClick={() => setOnlyOnline((prev) => !prev)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                    onlyOnline
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'border-border bg-card text-muted-foreground hover:border-emerald-500/40 hover:text-foreground',
                  )}
                >
                  <CalendarCheck2 className="h-3.5 w-3.5" />
                  <span>Reserva online ({onlineBookableCount})</span>
                </button>
              )}
            </div>

            {/* Selector de orden */}
            <label className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-border bg-card px-3 py-1.5 text-xs sm:self-auto">
              <ArrowDownUp aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">Ordenar:</span>
              <select
                aria-label="Ordenar servicios"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent font-bold text-foreground outline-none cursor-pointer"
              >
                <option value="featured">Destacados</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
                <option value="duration-asc">Menor duración</option>
              </select>
            </label>
          </div>
        </div>

        {/* Grid de Servicios */}
        {filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              {isBarbershopVertical ? <Scissors className="h-7 w-7 text-muted-foreground" /> : <Wrench className="h-7 w-7 text-muted-foreground" />}
            </div>
            <h3 className="mt-4 text-base font-bold">No se encontraron servicios</h3>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Probá buscando con otro término o limpiando los filtros activos.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full text-xs"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('all')
                setOriginFilter('all')
                setOnlyOnline(false)
              }}
            >
              Mostrar todos los servicios
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map(({
              service,
              coverImage,
              durationLabel,
              priceLabel,
              canBookOnline,
              bookingLink,
              matchedProfessionals,
            }, index) => {
              const Icon = iconMap[service.icon] || (isBarbershopVertical ? Scissors : Wrench)
              const resolvedCover = coverImage ? resolveProductImageUrl(coverImage) : ''
              const hasCover = Boolean(resolvedCover && resolvedCover !== '/placeholder-product.svg')
              const benefits = Array.isArray(service.benefits) ? service.benefits.filter(Boolean) : []
              const rawCtaHref = service.ctaUrl?.trim()
              const isExternalCta = /^https?:\/\//i.test(rawCtaHref || '')
              const hasCustomCta = Boolean(rawCtaHref && rawCtaHref !== '/inicio#contacto' && rawCtaHref !== '#contacto')
              const ctaHref = hasCustomCta && rawCtaHref
                ? (isExternalCta ? rawCtaHref : prefixPublicTenantPath(tenantPrefix, rawCtaHref))
                : ''

              return (
                <article
                  key={service.id || index}
                  className={cn(
                    'group relative flex min-h-full flex-col overflow-hidden rounded-[22px] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
                    isBarberStyle
                      ? 'border-zinc-200/90 bg-white dark:border-white/10 dark:bg-[#111116] hover:border-primary/50'
                      : 'border-border/80 bg-card shadow-xs hover:border-primary/40',
                    service.featured && 'ring-1 ring-primary/35',
                  )}
                >
                  {/* Portada 16:9 */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#14141B]">
                    {hasCover ? (
                      <AppImage
                        src={resolvedCover}
                        alt={`Portada de ${service.title}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        unoptimized={shouldBypassImageOptimization(resolvedCover)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_28%,transparent),#111116)]">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/35 bg-primary/15 text-primary">
                          <Icon className="h-7 w-7" />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090D]/85 via-[#09090D]/20 to-black/25" />

                    {/* Etiquetas superiores */}
                    <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                      {service.category ? (
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-black/60 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur-xs">
                          {service.category}
                        </span>
                      ) : <span />}

                      <div className="flex items-center gap-1.5">
                        {durationLabel && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/65 px-2.5 py-0.5 text-[10px] font-bold text-zinc-100 backdrop-blur-xs">
                            <Clock3 className="h-3 w-3 text-primary" />
                            {durationLabel}
                          </span>
                        )}
                        {service.featured && (
                          <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-foreground shadow-sm">
                            ★ Destacado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Precio flotante en la portada */}
                    {priceLabel && (
                      <div className="absolute bottom-3 left-3 inline-flex items-baseline gap-1.5 rounded-xl border border-white/15 bg-[#09090D]/85 px-3 py-1 backdrop-blur-sm">
                        <span className="text-sm font-black tracking-tight text-primary tabular-nums">
                          {priceLabel}
                        </span>
                        {service.priceNote && (
                          <span className="text-[10px] font-medium text-zinc-300">
                            {service.priceNote}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Cuerpo de tarjeta */}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-black leading-snug tracking-tight text-foreground sm:text-lg">
                        {service.title}
                      </h3>
                      {canBookOnline && (
                        <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Online
                        </span>
                      )}
                    </div>

                    {service.description && (
                      <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {service.description}
                      </p>
                    )}

                    {/* Beneficios */}
                    {benefits.length > 0 && (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {benefits.slice(0, 3).map((benefit) => (
                          <li key={benefit} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Profesionales asignados */}
                    {onlineBookingEnabled && matchedProfessionals.length > 0 && (
                      <div className="flex items-center gap-2 border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
                        <div className="flex -space-x-1.5">
                          {matchedProfessionals.slice(0, 3).map((pro) => (
                            pro.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- avatar de profesional en servicio
                              <img
                                key={pro.id}
                                src={pro.photoUrl}
                                alt={pro.name}
                                className="h-6 w-6 rounded-full border border-background object-cover"
                              />
                            ) : (
                              <span
                                key={pro.id}
                                className="flex h-6 w-6 items-center justify-center rounded-full border border-background text-[9px] font-bold text-white"
                                style={{ backgroundColor: pro.color || '#18181b' }}
                              >
                                {initialsOf(pro.name)}
                              </span>
                            )
                          ))}
                        </div>
                        <span className="truncate">
                          {matchedProfessionals.length === 1
                            ? `Con ${matchedProfessionals[0].name}`
                            : `${matchedProfessionals.slice(0, 2).map((p) => p.name.split(' ')[0]).join(', ')}${matchedProfessionals.length > 2 ? ` +${matchedProfessionals.length - 2}` : ''}`}
                        </span>
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="mt-auto flex items-center gap-2 pt-2">
                      {ctaHref ? (
                        <Button asChild className="h-10 flex-1 gap-2 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-xs">
                          <a
                            href={ctaHref}
                            target={isExternalCta ? '_blank' : undefined}
                            rel={isExternalCta ? 'noopener noreferrer' : undefined}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Consultar</span>
                          </a>
                        </Button>
                      ) : bookingLink ? (
                        <>
                          <Button asChild className="h-10 flex-1 gap-2 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-xs">
                            <Link href={bookingLink}>
                              <CalendarCheck2 className="h-3.5 w-3.5" />
                              <span>Reservar turno</span>
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`Consultar ${service.title} por WhatsApp`}
                            title="Consultar por WhatsApp"
                            onClick={() => handleContactService(service.title, priceLabel)}
                            className="h-10 w-10 shrink-0 rounded-full border-border/80 hover:border-emerald-500/60"
                          >
                            <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant={isBarberStyle ? 'default' : 'outline'}
                          className={cn(
                            'h-10 flex-1 gap-2 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-xs cursor-pointer',
                            !isBarberStyle && 'border-primary/30 hover:border-primary hover:bg-primary hover:text-primary-foreground',
                          )}
                          onClick={() => handleContactService(service.title, priceLabel)}
                        >
                          <WhatsAppIcon className={cn('h-4 w-4', isBarberStyle ? 'text-primary-foreground' : 'text-emerald-600')} />
                          <span>Consultar por WhatsApp</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Equipo de Profesionales en la misma vista */}
        {onlineBookingEnabled && professionals.length > 0 && (
          <section aria-labelledby="services-team-heading" className="mt-14 border-t border-border/60 pt-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                  <Users className="h-3.5 w-3.5" />
                  Profesionales habilitados
                </p>
                <h2 id="services-team-heading" className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">
                  Nuestro equipo de atención
                </h2>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-full text-xs font-bold">
                <Link href={resolvedBookingHref}>
                  <span>Ver horarios disponibles</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {professionals.map((pro) => (
                <Link
                  key={pro.id}
                  href={resolvedBookingHref}
                  className={cn(
                    'group flex items-center gap-3.5 rounded-2xl border p-3.5 transition-all hover:border-primary/50 hover:shadow-md',
                    isBarberStyle ? 'border-zinc-200/90 bg-white dark:border-white/10 dark:bg-[#111116]' : 'border-border/70 bg-card',
                  )}
                >
                  {pro.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto pública de profesional
                    <img src={pro.photoUrl} alt={pro.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                      style={{ backgroundColor: pro.color || '#18181b' }}
                    >
                      {initialsOf(pro.name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">{pro.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{pro.specialty || 'Atención general'}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
