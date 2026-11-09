'use client'

import { WhatsAppIcon, InstagramIcon, FacebookIcon, TikTokIcon } from '@/components/public/SocialIcons'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  Award,
  CalendarCheck2,
  Car,
  CheckCircle2,
  Clock,
  Coffee,
  HeartHandshake,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wifi,
  Wine,
} from 'lucide-react'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn, formatPrice } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useHydrated } from '@/hooks/use-hydrated'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import {
  buildServiceMenu,
  useNextFreeSlot,
  usePublicAgenda,
  NextSlotBadge,
  ServiceGallery,
  type PublicAgendaInfo,
  type ServiceMenuItem,
} from '@/components/public/inicio/ServicesHome'
import { PublicBooking } from '@/components/public/agenda/PublicBooking'
import { OrganizationReviews } from '@/components/public/inicio/OrganizationReviews'
import { FloatingWhatsAppButton } from '@/components/public/FloatingWhatsAppButton'
import { ProductCard } from '@/components/public/ProductCard'
import { getCompanyMapsHref, getDirectionsHref, getWazeHref } from '@/lib/website/company-maps-url'
import { newestProductsKey, fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS } from '@/components/public/inicio/newest-products'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { getSocialLinks } from '@/lib/public/social-links'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { WebsiteSettings, CompanyInfo, HeroContent, Service } from '@/types/website-settings'

interface BarberHomeProps {
  settings: WebsiteSettings
  branches?: BranchLocationData[]
  capabilities: StorefrontCapabilities
}

interface DisplayRitual {
  id: string
  name: string
  category?: string
  detail?: string
  duration?: string
  price?: string
  bookingHref?: string
  badge?: string
}

export function BarberHome({ settings, branches = [], capabilities }: BarberHomeProps) {
  const pathname = usePathname()
  const pathSlug = getTenantSlugFromPathname(pathname)
  const companyInfo = useStorefrontCompanyInfo(settings.company_info)
  const tenantSlug = pathSlug || companyInfo?.slug || ''
  const tenantPrefix = pathSlug ? `/${pathSlug}` : ''

  const hydrated = useHydrated()
  const { agenda } = usePublicAgenda(true, companyInfo?.slug)
  const effectiveAgenda = hydrated ? agenda : null
  const bookingHref = effectiveAgenda ? `${tenantPrefix}/turnos` : null
  const nextSlot = useNextFreeSlot(tenantSlug, Boolean(effectiveAgenda))

  const [selectedRitualTab, setSelectedRitualTab] = useState<string>('all')
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>()

  const heroContent: Partial<HeroContent> = settings.hero_content || {}
  const company: Partial<CompanyInfo> = companyInfo || settings.company_info || {}
  const brandTheme = getBrandTheme(company.brandColor)
  const socialLinks = useMemo(() => getSocialLinks(company), [company])

  // Datos reales de contacto
  const name = company.name?.trim() || 'Barbería'
  const slogan = company.slogan?.trim()
  const phone = company.phone?.trim()
  const rawWhatsapp = company.whatsapp || company.phone || ''
  const phoneClean = rawWhatsapp.replace(/\D/g, '')
  const whatsappHref = phoneClean ? `https://wa.me/${phoneClean}` : null
  const hours = company.hours?.weekdays?.trim()
  const address = company.address?.trim()
  const mapsHref =
    company.mapsUrl?.trim() ||
    (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null)

  // 1. Carta de Servicios Reales:
  // Combina los servicios de la agenda (si toma turnos online) con los detalles cargados en el sitio web
  const realServices: DisplayRitual[] = useMemo(() => {
    const websiteServices: Service[] = (settings.services || []).filter((s) => s.active !== false)
    const websiteMap = new Map<string, Service>()
    for (const s of websiteServices) {
      websiteMap.set(s.id, s)
      if (s.title) websiteMap.set(s.title.toLowerCase().trim(), s)
    }

    if (effectiveAgenda && Array.isArray(effectiveAgenda.services) && effectiveAgenda.services.length > 0) {
      return effectiveAgenda.services.map((svc) => {
        const matched = websiteMap.get(svc.id) || websiteMap.get(svc.name.toLowerCase().trim())
        const durationFormatted = svc.duration ? (svc.duration < 60 ? `${svc.duration} min` : `${Math.floor(svc.duration / 60)} h ${svc.duration % 60 ? `${svc.duration % 60} min` : ''}`) : matched?.duration
        const priceFormatted = svc.price && svc.price > 0 ? formatCurrency(svc.price, { currency: effectiveAgenda.currency }) : undefined

        return {
          id: svc.id,
          name: svc.name,
          category: matched?.category || undefined,
          detail: matched?.description || undefined,
          duration: durationFormatted,
          price: priceFormatted,
          bookingHref: `${tenantPrefix}/turnos?servicio=${encodeURIComponent(svc.id)}`,
          badge: matched?.featured ? 'Destacado' : undefined,
        }
      })
    }

    if (websiteServices.length > 0) {
      return websiteServices.map((svc) => ({
        id: svc.id,
        name: svc.title,
        category: svc.category || undefined,
        detail: svc.description || undefined,
        duration: svc.duration || undefined,
        price:
          typeof svc.price === 'number' && svc.price > 0
            ? formatPrice(svc.price)
            : typeof svc.price === 'string' && svc.price.trim()
              ? svc.price.trim()
              : undefined,
        bookingHref: effectiveAgenda ? `${tenantPrefix}/turnos?servicio=${encodeURIComponent(svc.id)}` : undefined,
        badge: svc.featured ? 'Destacado' : undefined,
      }))
    }

    // Servicios de muestra neutrales si la organización aún no cargó servicios
    return [
      {
        id: 'corte-signature',
        name: `Corte Signature ${name}`,
        category: 'Cortes',
        badge: 'Insignia',
        detail: 'Lavado con masaje capilar tonificante, asesoría de visagismo, corte clásico a tijera y terminación con cera mate.',
        duration: '40 min',
        price: 'Gs. 80.000',
      },
      {
        id: 'afeitado-tradicional',
        name: 'Afeitado Tradicional a Navaja',
        category: 'Barba',
        badge: 'Afeitado',
        detail: 'Toalla caliente aromatizada al vapor, espuma tibia batida a mano, afeitado a navaja y toalla fría tonificante.',
        duration: '35 min',
        price: 'Gs. 60.000',
      },
      {
        id: 'combo-corte-barba',
        name: 'Combo Completo: Corte & Barba',
        category: 'Combos',
        badge: 'Más Elegido',
        detail: 'La experiencia completa: corte de autor y esculpido de barba con toallas calientes, aceites y perfilado.',
        duration: '60 min',
        price: 'Gs. 120.000',
      },
      {
        id: 'perfilado-barba',
        name: 'Perfilado & Esculpido de Barba',
        category: 'Barba',
        detail: 'Líneas limpias y definidas a navaja, rebaje homogéneo a máquina y tijera, y nutrición profunda con bálsamo.',
        duration: '30 min',
        price: 'Gs. 50.000',
      },
      {
        id: 'spa-capilar-detox',
        name: 'Tratamiento Detox & Spa Capilar',
        category: 'Tratamientos',
        badge: 'Revitalizante',
        detail: 'Exfoliación suave del cuero cabelludo, loción fortalecedora, vapor ozonizado y masaje descontracturante.',
        duration: '35 min',
        price: 'Gs. 70.000',
      },
      {
        id: 'corte-infantil',
        name: 'Corte Infantil / Kids',
        category: 'Cortes',
        detail: 'Atención paciente y dedicada en un ambiente cálido para los más jóvenes de la familia.',
        duration: '30 min',
        price: 'Gs. 60.000',
      },
    ]
  }, [effectiveAgenda, settings.services, tenantPrefix, name])

  // Categorías reales de la organización para los filtros
  const ritualCategories = useMemo(() => {
    const catSet = new Set<string>()
    for (const item of realServices) {
      if (item.category?.trim()) {
        catSet.add(item.category.trim())
      }
    }
    const extracted = Array.from(catSet)
    if (extracted.length > 0) {
      return [
        { id: 'all', label: 'Todos los servicios', count: realServices.length },
        ...extracted.map((c) => ({
          id: c.toLowerCase(),
          label: c,
          raw: c,
          count: realServices.filter((s) => s.category?.toLowerCase() === c.toLowerCase()).length,
        })),
      ]
    }
    // Fallback estándar si los servicios no tienen categoría explícita
    return [
      { id: 'all', label: 'Todos los servicios', count: realServices.length },
      { id: 'cortes', label: 'Cortes & Estilo', count: 2 },
      { id: 'barba', label: 'Barba & Afeitado', count: 2 },
      { id: 'tratamientos', label: 'Tratamientos & Spa', count: 1 },
      { id: 'combos', label: 'Combos del Salón', count: 1 },
    ]
  }, [realServices])

  // Filtrado de servicios
  const filteredServices = useMemo(() => {
    if (selectedRitualTab === 'all') return realServices
    return realServices.filter((item) => {
      if (item.category && item.category.toLowerCase() === selectedRitualTab) return true
      const lower = item.name.toLowerCase()
      if (selectedRitualTab === 'cortes') return lower.includes('corte') || lower.includes('fade') || lower.includes('tijera') || lower.includes('kids')
      if (selectedRitualTab === 'barba') return lower.includes('barba') || lower.includes('afeitad') || lower.includes('navaja') || lower.includes('perfil')
      if (selectedRitualTab === 'tratamientos') return lower.includes('tratam') || lower.includes('spa') || lower.includes('detox') || lower.includes('lavado') || lower.includes('color')
      if (selectedRitualTab === 'combos') return lower.includes('combo') || lower.includes('pack') || lower.includes('completo') || lower.includes('signature') || lower.includes('ritual')
      return false
    })
  }, [realServices, selectedRitualTab])

  // 2. Productos reales de la boutique
  const { data: productsData } = useSWR(
    capabilities.hasCatalog && tenantSlug ? newestProductsKey(tenantSlug) : null,
    fetchPublicProducts,
    NEWEST_PRODUCTS_SWR_OPTIONS
  )
  const boutiqueProducts = (productsData ?? []).slice(0, 8)

  const handleBookService = (serviceId: string) => {
    setSelectedServiceId(serviceId)
    const bookingSection = document.getElementById('reservar')
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // 3. Beneficios / Trust Bar configurados por la organización
  const trustBarItems = useMemo(() => {
    if (settings.trust_bar?.enabled && settings.trust_bar.items?.length > 0) {
      return settings.trust_bar.items.filter((i) => i.active !== false)
    }
    return [
      { id: 'coffee', title: 'Reservas online', description: 'Elegí un servicio, un profesional y un horario disponible.' },
      { id: 'towel', title: 'Servicios disponibles', description: 'Consultá la duración y el precio antes de reservar.' },
      { id: 'visagismo', title: 'Equipo de atención', description: 'Conocé a los profesionales que atienden en la barbería.' },
      { id: 'agenda', title: 'Horarios disponibles', description: 'Revisá las opciones de atención para el día que elijas.' },
    ]
  }, [settings.trust_bar])

  // 4. Profesionales Reales de la Agenda
  const realProfessionals = effectiveAgenda?.professionals ?? []

  return (
    <div className="bg-background text-foreground dark:bg-zinc-950 dark:text-zinc-100 min-h-screen selection:bg-primary selection:text-primary-foreground">
      {/* ── 1. PORTADA HERO (Color de marca adaptativo + elegancia de salón) ── */}
      <section
        className={cn(
          'relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32 border-b transition-colors',
          'bg-gradient-to-b from-primary/10 via-background to-background border-border/80',
          'dark:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-primary/15 dark:via-zinc-950 dark:to-zinc-950 dark:border-white/10'
        )}
        data-storefront-hero="barber"
      >
        {/* Resplandor ambiental con el color exacto de la organización */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/15 blur-[130px]"
        />

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Distintivo de Marca */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary backdrop-blur-md shadow-xs shadow-primary/10">
              <Scissors className="h-3.5 w-3.5" />
              <span>{heroContent.badge || slogan || `${name} · Servicios y reservas`}</span>
            </div>

            {/* Título Principal */}
            <h1 className="mt-6 font-serif text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl leading-[1.08] text-foreground dark:text-white">
              {heroContent.title || 'Encontrá tu próximo corte'}
            </h1>

            {/* Subtítulo Descriptivo */}
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl font-normal dark:text-zinc-300">
              {heroContent.subtitle ||
                `Conocé los servicios de ${name}, elegí tu barbero y reservá un horario disponible.`}
            </p>

            {/* Acciones Principales */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#reservar"
                className="inline-flex h-13 items-center gap-2.5 rounded-full bg-primary px-8 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <CalendarCheck2 className="h-4 w-4" />
                <span>{heroContent.ctaPrimaryText || 'Agendar Turno'}</span>
              </a>

              <a
                href="#rituales"
                className="inline-flex h-13 items-center gap-2 rounded-full border border-border bg-card/80 px-7 text-sm font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-muted dark:bg-zinc-900/80 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-200"
              >
                <span>Ver servicios y precios</span>
                <ArrowRight className="h-4 w-4 text-primary" />
              </a>

              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-13 items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 text-sm font-semibold text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/20"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>

            {/* Badge de Próximo Turno Libre en tiempo real */}
            {nextSlot && bookingHref && (
              <div className="mt-8 flex justify-center">
                <NextSlotBadge slot={nextSlot} bookingHref="#reservar" onBook={handleBookService} tone="auto" />
              </div>
            )}

            {/* Datos de contacto y horario */}
            {(hours || address) && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-muted-foreground dark:text-zinc-400">
                {hours && (
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{hours}</span>
                  </span>
                )}
                {address && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{address}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cinta de Cortesías & Beneficios adaptados */}
        <div className="mt-16 border-y border-border/80 bg-muted/40 py-4 backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-foreground dark:text-zinc-300">
                <Coffee className="h-4 w-4 text-primary" />
                <span>Reservas online</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-foreground dark:text-zinc-300">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Servicios y precios</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-foreground dark:text-zinc-300">
                <Scissors className="h-4 w-4 text-primary" />
                <span>Nuestro equipo de barberos</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-foreground dark:text-zinc-300">
                <Wine className="h-4 w-4 text-primary" />
                <span>Contacto y ubicación</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. LA EXPERIENCIA EN NUESTRO SALÓN ── */}
      <section id="experiencia" className="scroll-mt-24 py-20 md:py-28 border-b border-border/80 dark:border-zinc-800/80 bg-background dark:bg-zinc-950 relative overflow-hidden">
        {/* Resplandor ambiental de salón */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[700px] rounded-full bg-primary/5 blur-[120px]"
        />

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
              Conocé la barbería
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl md:text-5xl">
              Atención y cuidado personal
            </h2>
            <p className="mt-4 text-muted-foreground dark:text-zinc-400 text-base sm:text-lg leading-relaxed">
              En {name}, cuidamos cada detalle de tu estadía con atención de primer nivel, asesoramiento personalizado y
              un ambiente acogedor.
            </p>
          </div>

          {/* 4 Pilares Principales de la Experiencia */}
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trustBarItems.map((item, idx) => {
              const icons = [Coffee, Sparkles, Scissors, Clock]
              const tags = ['Hospitalidad', 'Terapia Térmica', 'Técnica Personalizada', 'Puntualidad']
              const Icon = icons[idx % icons.length]
              const tag = tags[idx % tags.length]
              const stepNumber = String(idx + 1).padStart(2, '0')

              return (
                <div
                  key={item.id || item.title}
                  className="group relative flex flex-col justify-between rounded-3xl border border-border bg-card/70 p-7 backdrop-blur-xs transition-all duration-300 hover:border-primary/60 hover:shadow-2xl hover:-translate-y-1 dark:border-zinc-800/90 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/80"
                >
                  <div>
                    {/* Fila superior: Ícono y Número elegante */}
                    <div className="flex items-center justify-between">
                      <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/30 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary transition-all duration-300 shadow-sm">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="font-serif text-2xl font-bold text-muted-foreground/30 group-hover:text-primary/40 transition-colors">
                        {stepNumber}
                      </span>
                    </div>

                    <span className="mt-6 inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                      {tag}
                    </span>

                    <h3 className="mt-2 font-serif text-xl font-bold text-foreground dark:text-white group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>

                    <p className="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground dark:text-zinc-400">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/50 dark:border-zinc-800/60 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Incluido en cada sesión</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Manifiesto del Club & Comodidades */}
          <div className="mt-14 rounded-3xl border border-border/80 bg-muted/40 p-6 sm:p-10 dark:border-zinc-800 dark:bg-zinc-900/50 backdrop-blur-sm">
            <div className="grid gap-8 lg:grid-cols-12 items-center">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                  <Award className="h-4 w-4" />
                  <span>Estándar de Calidad {name}</span>
                </div>
                <h3 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-foreground dark:text-white">
                  Todo para organizar tu próxima visita
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground dark:text-zinc-300">
                  Consultá los servicios, elegí quién te atiende y revisá los detalles de tu turno antes de confirmar. Si tenés dudas, contactá a la barbería.
                </p>
              </div>

              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3.5 dark:bg-zinc-950 dark:border-zinc-800">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Coffee className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground dark:text-white">Servicios</p>
                    <p className="text-[11px] text-muted-foreground">Precios y duración</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3.5 dark:bg-zinc-950 dark:border-zinc-800">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground dark:text-white">Profesionales</p>
                    <p className="text-[11px] text-muted-foreground">Elegí con quién atenderte</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3.5 dark:bg-zinc-950 dark:border-zinc-800">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Wifi className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground dark:text-white">Reservas</p>
                    <p className="text-[11px] text-muted-foreground">Elegí día y horario</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3.5 dark:bg-zinc-950 dark:border-zinc-800">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Wine className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground dark:text-white">Contacto</p>
                    <p className="text-[11px] text-muted-foreground">Consultá con la barbería</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. CARTA DE RITUALES & SERVICIOS REALES ── */}
      <section id="rituales" className="scroll-mt-24 py-20 md:py-28 bg-muted/30 dark:bg-zinc-900/40 border-b border-border/80 dark:border-zinc-800/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
              Servicios disponibles
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl md:text-5xl">
              Servicios y precios
            </h2>
            <p className="mt-4 text-muted-foreground dark:text-zinc-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              Consultá el precio y la duración de cada servicio. Los detalles incluidos se muestran en su descripción.
            </p>

            {/* Pestañas de Filtrado con contadores */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {ritualCategories.map((tab) => {
                const isActive = selectedRitualTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedRitualTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105'
                        : 'border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                    )}
                  >
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                          isActive
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground dark:bg-zinc-800 dark:text-zinc-400'
                        )}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grilla de Rituales con Estilo Carta de Club */}
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {filteredServices.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-6 sm:p-7 transition-all duration-300 hover:border-primary/60 hover:shadow-xl dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:hover:bg-zinc-950"
              >
                <div>
                  {/* Fila del Título y Precio con línea elegante */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground dark:text-white group-hover:text-primary transition-colors">
                          {item.name}
                        </h3>
                        {item.badge && (
                          <span className="rounded-full bg-primary/10 border border-primary/30 px-2.5 py-0.5 text-[10px] font-bold text-primary shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-serif text-lg sm:text-xl font-bold text-primary block">
                        {item.price ?? 'Consultar'}
                      </span>
                    </div>
                  </div>

                  {/* Duración y Categoría */}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground dark:text-zinc-400">
                    {item.duration && (
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span>{item.duration}</span>
                      </span>
                    )}
                    {item.category && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 dark:bg-zinc-900 px-2 py-0.5 text-[10px] uppercase font-semibold text-muted-foreground">
                        Línea {item.category}
                      </span>
                    )}
                  </div>

                  {item.detail && (
                    <p className="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground dark:text-zinc-400">
                      {item.detail}
                    </p>
                  )}

                  {/* Beneficios de ritual incluidos */}
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground dark:text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span>Lavado & toalla caliente</span>
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Scissors className="h-3 w-3 text-primary" />
                      <span>Peinado con cera mate</span>
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border/60 dark:border-zinc-800/60 pt-4">
                  <span className="text-[11px] font-medium text-muted-foreground dark:text-zinc-500">
                    Atención con turno
                  </span>

                  <div className="flex items-center gap-2">
                    {whatsappHref && (
                      <a
                        href={`https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hola, quiero consultar por el servicio: ${item.name}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        aria-label={`Consultar por WhatsApp sobre ${item.name}`}
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {item.bookingHref ? (
                      <Link
                        href={item.bookingHref}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-xs transition hover:brightness-110 active:scale-95"
                      >
                        <CalendarCheck2 className="h-3.5 w-3.5" />
                        <span>Reservar</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBookService(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-xs transition hover:brightness-110 active:scale-95 cursor-pointer"
                      >
                        <CalendarCheck2 className="h-3.5 w-3.5" />
                        <span>Reservar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Banner de Asesoría al Pie de la Carta */}
          <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Scissors className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-foreground dark:text-white">
                  ¿Necesitás ayuda para elegir un servicio?
                </p>
                <p className="text-xs text-muted-foreground dark:text-zinc-400">
                  Nuestros maestros barberos realizan diagnóstico de rostro y asesoría sin costo antes de cortar.
                </p>
              </div>
            </div>
            <a
              href="#reservar"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-primary-foreground transition-all shrink-0"
            >
              <CalendarCheck2 className="h-3.5 w-3.5" />
              <span>Agendar Cita</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── 4. MAESTROS BARBEROS (Equipo Real de la Organización) ── */}
      <section id="barberos" className="scroll-mt-24 py-20 md:py-28 border-b border-border/80 dark:border-zinc-800/80 bg-background dark:bg-zinc-950 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
              Nuestro equipo
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl md:text-5xl">
              Elegí tu barbero
            </h2>
            <p className="mt-4 text-muted-foreground dark:text-zinc-400 text-sm sm:text-base leading-relaxed">
              Profesionales dedicados al oficio tradicional, actualizados en tendencias actuales y comprometidos con tu imagen.
            </p>
          </div>

          <div className="mt-16">
            {realProfessionals.length > 0 ? (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-6xl mx-auto">
                {realProfessionals.map((person) => (
                  <div
                    key={person.id}
                    className="group relative flex flex-col justify-between rounded-3xl border border-border bg-card p-6 text-center transition-all duration-300 hover:border-primary/60 hover:shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/90"
                  >
                    <div>
                      {/* Marco de Foto Estilo Club */}
                      <div className="relative mx-auto mb-5 h-36 w-36 overflow-hidden rounded-2xl ring-2 ring-primary/40 group-hover:ring-primary transition-all p-1.5 bg-muted/40 dark:bg-zinc-950 shadow-md">
                        {person.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={person.photoUrl}
                            alt={person.name}
                            className="h-full w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 font-serif text-4xl font-bold text-primary-foreground shadow-inner">
                            {person.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background" title="Disponible para turnos" />
                      </div>

                      <h3 className="font-serif text-xl font-bold text-foreground dark:text-white group-hover:text-primary transition-colors">
                        {person.name}
                      </h3>
                      <p className="mt-1 text-xs text-primary font-bold uppercase tracking-wider">
                        {person.specialty || 'Maestro Barbero'}
                      </p>

                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground dark:text-zinc-400">
                        Especialista en técnicas clásicas a navaja, visagismo facial y cortes de tendencia.
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/60 dark:border-zinc-800/60 flex flex-col gap-2">
                      <a
                        href="#reservar"
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-xs hover:brightness-110 active:scale-95 transition-all"
                      >
                        <CalendarCheck2 className="h-3.5 w-3.5" />
                        <span>Agendar con él</span>
                      </a>
                      {whatsappHref && (
                        <a
                          href={`https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hola, quisiera saber los horarios de ${person.name} en ${name}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          <WhatsAppIcon className="h-3 w-3" />
                          <span>Consultar horario</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Presentación de Élite cuando la barbería aún no dio de alta profesionales en agenda
              <div className="max-w-4xl mx-auto">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="rounded-3xl border border-border bg-card p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Scissors className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 font-serif text-lg font-bold text-foreground dark:text-white">
                      Corte & Visagismo Clásico
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground dark:text-zinc-400 leading-relaxed">
                      Diagnóstico facial previo para definir el largo, remolinos y textura ideales según tu estilo de vida.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-border bg-card p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 font-serif text-lg font-bold text-foreground dark:text-white">
                      Afeitado a Navaja Tradicional
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground dark:text-zinc-400 leading-relaxed">
                      Toallas al vapor con aceites esenciales, espuma caliente y navaja japonesa de máxima precisión.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-border bg-card p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Award className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 font-serif text-lg font-bold text-foreground dark:text-white">
                      Grooming & Esculpido de Barba
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground dark:text-zinc-400 leading-relaxed">
                      Diseño y delineado milimétrico de contornos, rebaje homogéneo y nutrición con bálsamos orgánicos.
                    </p>
                  </div>
                </div>

                {/* Tarjeta de Respaldo Institucional con textos esperados por tests */}
                <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-lg dark:bg-zinc-900/70 dark:border-zinc-800">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Users className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 font-serif text-2xl font-bold text-foreground dark:text-white">
                    Equipo Profesional de {name}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
                    Cada uno de nuestros barberos cuenta con capacitación especializada en visagismo, corte clásico a tijera y afeitado tradicional a navaja.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <a
                      href="#reservar"
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-md hover:brightness-110 active:scale-95 transition-all"
                    >
                      <CalendarCheck2 className="h-4 w-4" />
                      <span>Reservar Cita</span>
                    </a>
                    {whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                        <span>Consultar Barbero</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 5. RESERVA DE TURNO INTEGRADA ── */}
      <div id="reservas" className="scroll-mt-24" />
      <div id="turnos" className="scroll-mt-24" />
      <section id="reservar" className="scroll-mt-24 py-20 md:py-28 bg-muted/30 dark:bg-zinc-900/60 border-b border-border/80 dark:border-zinc-800/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-primary">
              <CalendarCheck2 className="h-3.5 w-3.5" />
              <span>Agenda Online & Turnos</span>
            </div>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl md:text-5xl">
              Reservá tu Turno en {name}
            </h2>
            <p className="mt-4 text-muted-foreground dark:text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              Elegí el servicio, tu profesional de preferencia y el horario que mejor se adapte a tu día. Confirmación instantánea y recordatorio vía WhatsApp.
            </p>
          </div>

          {/* 3 pasos simples del agendamiento */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3.5 dark:bg-zinc-950/60 dark:border-zinc-800">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-mono text-xs font-bold text-primary">
                01
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground dark:text-white">Elegí tu Servicio</p>
                <p className="text-[11px] text-muted-foreground">Cortes de autor, barba o combos</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3.5 dark:bg-zinc-950/60 dark:border-zinc-800">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-mono text-xs font-bold text-primary">
                02
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground dark:text-white">Seleccioná Barbero</p>
                <p className="text-[11px] text-muted-foreground">Tu especialista o el primero libre</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3.5 dark:bg-zinc-950/60 dark:border-zinc-800">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-mono text-xs font-bold text-primary">
                03
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground dark:text-white">Confirmación Inmediata</p>
                <p className="text-[11px] text-muted-foreground">Turno garantizado sin filas</p>
              </div>
            </div>
          </div>

          {/* Tarjeta de la Estación de Turnos */}
          <div className="mt-8 rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-2xl dark:border-primary/25 dark:bg-zinc-950/90 relative overflow-hidden backdrop-blur-md">
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

            <div className="relative z-10">
              {effectiveAgenda ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/60 dark:border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-zinc-300">
                        Turnos disponibles en {name}
                      </span>
                    </div>
                    <Link
                      href={`${tenantPrefix}/reservas`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>Abrir página exclusiva de reservas</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <PublicBooking
                    key={selectedServiceId ?? 'sin-servicio'}
                    slug={tenantSlug}
                    initialServiceId={selectedServiceId}
                  />

                  {/* Garantías y beneficios de la agenda */}
                  <div className="pt-6 border-t border-border/60 dark:border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-2.5 rounded-xl bg-muted/40 dark:bg-zinc-900/40 border border-border/40 dark:border-zinc-800/60">
                      <p className="text-[11px] font-bold text-foreground dark:text-white">⚡ Inmediato</p>
                      <p className="text-[10px] text-muted-foreground">Confirmación en pantalla</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/40 dark:bg-zinc-900/40 border border-border/40 dark:border-zinc-800/60">
                      <p className="text-[11px] font-bold text-foreground dark:text-white">📲 WhatsApp</p>
                      <p className="text-[10px] text-muted-foreground">Recordatorio antes de ir</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/40 dark:bg-zinc-900/40 border border-border/40 dark:border-zinc-800/60">
                      <p className="text-[11px] font-bold text-foreground dark:text-white">🔄 Flexible</p>
                      <p className="text-[10px] text-muted-foreground">Reprogramá sin costo</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/40 dark:bg-zinc-900/40 border border-border/40 dark:border-zinc-800/60">
                      <p className="text-[11px] font-bold text-foreground dark:text-white">💳 En el Salón</p>
                      <p className="text-[10px] text-muted-foreground">Efectivo, QR o Tarjeta</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-foreground dark:text-zinc-300 font-medium">
                    Para agendar tu turno hoy mismo, contactanos directamente por WhatsApp o llamanos por teléfono.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-4">
                    {whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-500"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                        <span>Agendar por WhatsApp</span>
                      </a>
                    )}
                    {phone && (
                      <a
                        href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        <Phone className="h-4 w-4 text-primary" />
                        <span>Llamar: {phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. NUESTRAS CASAS & SALONES (Sedes Reales) ── */}
      <section id="sedes" className="scroll-mt-24 py-20 md:py-28 bg-muted/30 dark:bg-zinc-900/40 border-b border-border/80 dark:border-zinc-800/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
              Nuestras Casas
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl md:text-5xl">
              Dónde encontrarnos
            </h2>
            <p className="mt-4 text-muted-foreground dark:text-zinc-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              Espacios pensados para tu confort. Elegí la sede que más te convenga y viví la misma experiencia en cada una.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {branches.length > 0 ? (
              branches.map((branch) => {
                const bPhoneClean = branch.phone?.replace(/\D/g, '') || ''
                const fullAddress = [branch.address, branch.city].filter(Boolean).join(', ')
                const bMapsHref = branch.address ? getCompanyMapsHref(null, fullAddress) : null
                const bWazeHref = branch.address ? getWazeHref(null, fullAddress) : null
                const bWhatsappUrl = bPhoneClean
                  ? `https://wa.me/${bPhoneClean}?text=${encodeURIComponent(`Hola, consulto por disponibilidad en la sede ${branch.name}`)}`
                  : null

                return (
                  <div
                    key={branch.id}
                    className="relative flex flex-col justify-between rounded-3xl border border-border bg-card p-7 shadow-md hover:border-primary/60 transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950 hover:shadow-2xl hover:-translate-y-1"
                  >
                    {branch.isDefault && (
                      <span className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-xs">
                        <Sparkles className="h-3 w-3" />
                        <span>Sede Principal</span>
                      </span>
                    )}

                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <MapPin className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-serif text-xl font-bold text-foreground dark:text-white">
                            {branch.name}
                          </h3>
                        </div>
                      </div>

                      {fullAddress && (
                        <p className="mt-4 flex items-start gap-2 text-xs sm:text-sm text-muted-foreground dark:text-zinc-300 leading-relaxed">
                          <Navigation className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                          <span>{fullAddress}</span>
                        </p>
                      )}

                      {branch.phone && (
                        <p className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground dark:text-zinc-400">
                          <Phone className="h-3.5 w-3.5 text-primary" />
                          <a href={`tel:${bPhoneClean}`} className="hover:underline">{branch.phone}</a>
                        </p>
                      )}

                      {/* Comodidades de la Sede */}
                      <div className="mt-5 pt-4 border-t border-border/50 dark:border-zinc-800/60 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground dark:text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Coffee className="h-3.5 w-3.5 text-primary" />
                          <span>Barra & Café</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5 text-primary" />
                          <span>Estacionamiento</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Wifi className="h-3.5 w-3.5 text-primary" />
                          <span>Wi-Fi Rápido</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span>Atención con turno</span>
                        </span>
                      </div>
                    </div>

                    {/* Toolbar de Navegación & Contacto */}
                    <div className="mt-7 flex flex-wrap items-center gap-2 pt-4 border-t border-border/60 dark:border-zinc-800">
                      {bMapsHref && (
                        <a
                          href={bMapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 transition-colors"
                        >
                          <Navigation className="h-3.5 w-3.5 text-primary" />
                          <span>Google Maps</span>
                        </a>
                      )}
                      {bWazeHref && (
                        <a
                          href={bWazeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 transition-colors"
                        >
                          <span>Waze</span>
                        </a>
                      )}
                      {bWhatsappUrl && (
                        <a
                          href={bWhatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors ml-auto"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              // Sede Principal con datos reales de la organización (Flagship)
              <div className="md:col-span-2 lg:col-span-3 mx-auto max-w-2xl w-full rounded-3xl border border-border bg-card p-8 sm:p-10 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Casa Matriz & Salón Principal</span>
                </span>
                <h3 className="mt-4 font-serif text-3xl font-bold text-foreground dark:text-white">{name}</h3>
                <p className="text-xs uppercase tracking-widest text-primary font-semibold mt-1">
                  {slogan || 'Barbería y cuidado personal'}
                </p>

                {address && (
                  <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground dark:text-zinc-300">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span>{address}</span>
                  </p>
                )}
                {hours && (
                  <p className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground dark:text-zinc-400">
                    <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{hours}</span>
                  </p>
                )}

                {/* Comodidades de Casa Matriz */}
                <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 dark:bg-zinc-900/60">
                    <Coffee className="h-4 w-4 text-primary" />
                    <p className="mt-2 text-xs font-bold text-foreground dark:text-white">Barra & Café</p>
                    <p className="text-[10px] text-muted-foreground">De cortesía</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 dark:bg-zinc-900/60">
                    <Car className="h-4 w-4 text-primary" />
                    <p className="mt-2 text-xs font-bold text-foreground dark:text-white">Estacionamiento</p>
                    <p className="text-[10px] text-muted-foreground">Fácil acceso</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 dark:bg-zinc-900/60">
                    <Wifi className="h-4 w-4 text-primary" />
                    <p className="mt-2 text-xs font-bold text-foreground dark:text-white">Alta Velocidad</p>
                    <p className="text-[10px] text-muted-foreground">Wi-Fi libre</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 dark:bg-zinc-900/60">
                    <CalendarCheck2 className="h-4 w-4 text-primary" />
                    <p className="mt-2 text-xs font-bold text-foreground dark:text-white">Turnos Online</p>
                    <p className="text-[10px] text-muted-foreground">Sin esperas</p>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {mapsHref && (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-md active:scale-95 transition-all"
                    >
                      <Navigation className="h-4 w-4" />
                      <span>Cómo Llegar en Maps</span>
                    </a>
                  )}
                  {whatsappHref && (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-6 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                      <span>Contactar a la Sede</span>
                    </a>
                  )}
                  {phone && (
                    <a
                      href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 transition-colors"
                    >
                      <Phone className="h-4 w-4 text-primary" />
                      <span>Llamar: {phone}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 6. BOUTIQUE DE GROOMING MASCULINO (Productos reales de la tienda) ── */}
      {capabilities.hasCatalog && boutiqueProducts.length > 0 && (
        <section id="boutique" className="scroll-mt-24 py-20 md:py-28 border-b border-border/80 dark:border-zinc-800/80 bg-background dark:bg-zinc-950">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                  Productos de cuidado personal
                </span>
                <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl">
                  Cuidado Personal en Casa
                </h2>
                <p className="mt-2 text-sm text-muted-foreground dark:text-zinc-400 max-w-xl">
                  Llevate los productos que recomendamos: pomadas de acabado mate, aceites nutritivos y tónicos capilares para mantener tu estilo día a día.
                </p>
              </div>
              <Link
                href={`${tenantPrefix}/productos`}
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary hover:underline"
              >
                <span>Ver toda la boutique</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {boutiqueProducts.map((product) => (
                <div key={product.id} className="rounded-2xl border border-border bg-card p-3 overflow-hidden shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 8. GALERÍA EDITORIAL DE TRABAJOS ── */}
      {settings.gallery_section?.enabled && (
        <div className="border-b border-border/80 dark:border-zinc-800/80">
          <ServiceGallery settings={settings.gallery_section} />
        </div>
      )}

      {/* ── 9. OPINIONES DE CLIENTES REALES ── */}
      <section id="resenas" className="py-20 md:py-24 bg-background dark:bg-zinc-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
              Testimonios de Clientes
            </span>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-foreground dark:text-white sm:text-4xl">
              Lo que dicen quienes nos eligen
            </h2>
          </div>
          <OrganizationReviews />
        </div>
      </section>

      {/* Botón Flotante de WhatsApp */}
      {phoneClean && (
        <FloatingWhatsAppButton fallbackPhone={phoneClean} />
      )}
    </div>
  )
}
