'use client'

import { WhatsAppIcon } from '@/components/public/SocialIcons'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Wrench, CheckCircle, Tag, Clock, ExternalLink, ArrowRight, Sparkles, CalendarCheck2, Scissors } from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { Button } from '@/components/ui/button'
import { iconMap } from '@/lib/constants/brand-theme'
import type { Service } from '@/types/website-settings'
import { cn } from '@/lib/utils'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { formatWhatsAppPhone, getWhatsAppLink, getBusinessWhatsApp } from '@/lib/whatsapp'
import { resolveProductImageUrl, shouldBypassImageOptimization } from '@/lib/images'
import { usePublicTenantPrefix } from '@/lib/public/tenant-client'

interface ServicesGridProps {
  services: Service[]
  variant?: 'default' | 'barbero'
  bookingEnabled?: boolean
  onBookService?: (serviceId: string) => void
}

// Subtle gradient per color for card header
const CARD_BG: Record<string, string> = {
  blue:    'from-blue-600 to-indigo-700',
  green:   'from-emerald-600 to-teal-700',
  purple:  'from-purple-600 to-indigo-700',
  orange:  'from-orange-500 to-amber-600',
  red:     'from-red-600 to-rose-700',
  indigo:  'from-indigo-600 to-blue-800',
  teal:    'from-teal-600 to-emerald-700',
  yellow:  'from-amber-500 to-orange-600',
  pink:    'from-pink-600 to-rose-700',
  rose:    'from-rose-600 to-pink-700',
  amber:   'from-amber-500 to-orange-600',
  emerald: 'from-emerald-600 to-teal-700',
  cyan:    'from-cyan-600 to-sky-700',
  sky:     'from-sky-600 to-blue-700',
}

export function ServicesGrid({
  services,
  variant = 'default',
  bookingEnabled = false,
  onBookService,
}: ServicesGridProps) {
  const { settings } = useWebsiteSettings()
  const { tenantPrefix } = usePublicTenantPrefix()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const activeServices = useMemo(
    () => services.filter((s) => s.active !== false),
    [services]
  )

  const categories = useMemo(() => {
    const set = new Set<string>()
    activeServices.forEach((s) => {
      if (s.category?.trim()) set.add(s.category.trim())
    })
    return Array.from(set)
  }, [activeServices])

  const filteredServices = useMemo(() => {
    if (selectedCategory === 'all') return activeServices
    return activeServices.filter((s) => (s.category || 'General') === selectedCategory)
  }, [activeServices, selectedCategory])

  if (activeServices.length === 0) return null

  const orgPhone = settings?.company_info?.whatsapp || settings?.company_info?.phone || ''
  const isBarbero = variant === 'barbero'
  const servicesHref = tenantPrefix ? `${tenantPrefix}/servicios` : '/servicios'
  const turnosHref = tenantPrefix ? `${tenantPrefix}/turnos` : '/turnos'

  const formatServicePrice = (price: Service['price']) => {
    if (typeof price === 'number' && price > 0) {
      return `Gs. ${price.toLocaleString('es-PY')}`
    }
    if (typeof price === 'string' && price.trim()) return price.trim()
    return null
  }

  if (isBarbero) {
    return (
      <section
        id="servicios"
        aria-labelledby="ebs-services-title"
        className="py-10 sm:py-14 scroll-mt-20"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Cabecera oscura editorial coherente con EspecialBarberoHome */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-[#111116] px-4 py-3.5 text-white shadow-sm sm:px-6">
            <div className="flex items-center gap-3.5 min-w-0">
              <span
                aria-hidden="true"
                className="h-9 w-1 shrink-0 rounded-full"
                style={{
                  background:
                    'linear-gradient(180deg, var(--primary), color-mix(in oklch, var(--primary) 82%, #f97316 18%))',
                }}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  {settings?.services_section?.badge || 'Servicios de Salón'}
                </p>
                <div className="flex items-center gap-2.5">
                  <h2 id="ebs-services-title" className="truncate text-lg font-black uppercase tracking-tight text-white sm:text-xl">
                    {settings?.services_section?.title || 'Nuestros Servicios'}
                  </h2>
                  <span className="hidden sm:inline-flex rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-zinc-300">
                    {activeServices.length} {activeServices.length === 1 ? 'servicio' : 'servicios'}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href={servicesHref}
              className="group/cta inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              <span>Ver todos</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5" />
            </Link>
          </div>

          {/* Subtítulo + Filtros por Categoría */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              {settings?.services_section?.subtitle ||
                'Cortes de autor, ritual de barba a navaja y cuidado capilar con atención profesional.'}
            </p>

            {categories.length > 1 && (
              <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Categorías de servicios">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer border',
                    selectedCategory === 'all'
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-zinc-200 dark:border-white/15 bg-white dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:border-primary/60'
                  )}
                >
                  Todos ({activeServices.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer border',
                      selectedCategory === cat
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-zinc-200 dark:border-white/15 bg-white dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:border-primary/60'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grilla editorial de Servicios */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => {
              const IconComponent = iconMap[service.icon] || Scissors
              const coverSrc = service.imageUrl ? resolveProductImageUrl(service.imageUrl) : ''
              const hasCover = Boolean(coverSrc && coverSrc !== '/placeholder-product.svg')
              const priceLabel = formatServicePrice(service.price)
              const phoneToUse = orgPhone || getBusinessWhatsApp()
              const whatsappHref = getWhatsAppLink({
                phone: formatWhatsAppPhone(phoneToUse),
                message: `¡Hola! Me gustaría reservar o consultar sobre el servicio: *${service.title}*`,
              })
              const rawCtaHref = service.ctaUrl?.trim()
              const hasCustomCta = Boolean(
                rawCtaHref &&
                rawCtaHref !== '/inicio#contacto' &&
                rawCtaHref !== '#contacto' &&
                (rawCtaHref.startsWith('/') || /^https?:\/\//i.test(rawCtaHref))
              )
              const serviceBookHref = `${turnosHref}?servicio=${encodeURIComponent(service.id)}`

              return (
                <article
                  key={service.id}
                  className={cn(
                    'group relative flex flex-col overflow-hidden rounded-[20px] border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#111116] shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl',
                    service.featured && 'ring-1 ring-primary/35'
                  )}
                >
                  {/* Portada visual 16:9 */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#14141B]">
                    {hasCover ? (
                      <AppImage
                        src={coverSrc}
                        alt={service.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        unoptimized={shouldBypassImageOptimization(coverSrc)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_25%,transparent),#111116)]">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary">
                          <IconComponent className="h-7 w-7" />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090D]/80 via-[#09090D]/15 to-black/25" />

                    {/* Etiquetas superiores */}
                    <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                      {service.category ? (
                        <span className="inline-flex items-center rounded-full border border-white/15 bg-black/60 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur-xs">
                          {service.category}
                        </span>
                      ) : <span />}

                      <div className="flex items-center gap-1.5">
                        {service.duration && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-zinc-100 backdrop-blur-xs">
                            <Clock className="h-3 w-3 text-primary" />
                            {service.duration}
                          </span>
                        )}
                        {service.featured && (
                          <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-foreground shadow-sm">
                            ★ Destacado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Precio flotante inferior en la foto */}
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

                  {/* Cuerpo de la tarjeta */}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white leading-snug">
                      {service.title}
                    </h3>

                    {service.description && (
                      <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2 flex-1">
                        {service.description}
                      </p>
                    )}

                    {/* Beneficios compactos */}
                    {Array.isArray(service.benefits) && service.benefits.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {service.benefits.slice(0, 3).map((benefit, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/80 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"
                          >
                            <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500" />
                            <span>{benefit}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Acciones: Reservar turno + WhatsApp */}
                    <div className="mt-auto flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-white/10">
                      {bookingEnabled ? (
                        <>
                          {onBookService ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onBookService(service.id)}
                              className="h-10 flex-1 gap-2 rounded-xl bg-primary font-black uppercase tracking-wider text-[11px] text-primary-foreground hover:brightness-110 cursor-pointer"
                            >
                              <CalendarCheck2 className="h-3.5 w-3.5" />
                              <span>Reservar turno</span>
                            </Button>
                          ) : (
                            <Button
                              asChild
                              size="sm"
                              className="h-10 flex-1 gap-2 rounded-xl bg-primary font-black uppercase tracking-wider text-[11px] text-primary-foreground hover:brightness-110"
                            >
                              <Link href={serviceBookHref}>
                                <CalendarCheck2 className="h-3.5 w-3.5" />
                                <span>Reservar turno</span>
                              </Link>
                            </Button>
                          )}
                          <Button
                            asChild
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0 rounded-xl border-zinc-200 dark:border-white/15 bg-transparent hover:border-emerald-500 hover:bg-emerald-500/10"
                          >
                            <a
                              href={whatsappHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Consultar por WhatsApp sobre ${service.title}`}
                              title="Consultar por WhatsApp"
                            >
                              <WhatsAppIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </a>
                          </Button>
                        </>
                      ) : hasCustomCta && rawCtaHref ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-10 w-full gap-2 rounded-xl font-bold border-primary/30 hover:border-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          <a
                            href={rawCtaHref}
                            target={/^https?:\/\//i.test(rawCtaHref) ? '_blank' : undefined}
                            rel={/^https?:\/\//i.test(rawCtaHref) ? 'noopener noreferrer' : undefined}
                          >
                            <span>Consultar</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-10 w-full gap-2 rounded-xl font-bold border-primary/30 hover:border-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                            <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
                            <span>Consultar por WhatsApp</span>
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="servicios" className="border-t bg-background py-16 md:py-24 scroll-mt-20">
      <div className="container px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {settings?.services_section?.badge || 'Servicios Profesionales'}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            {settings?.services_section?.title || 'Nuestros Servicios y Soluciones'}
          </h2>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
            {settings?.services_section?.subtitle ||
              'Calidad garantizada, atención personalizada y presupuesto sin compromiso.'}
          </p>

          {/* Filtros por Categoría */}
          {categories.length > 1 && (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs',
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                Todos los servicios ({activeServices.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs',
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid de Servicios */}
        <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => {
            const IconComponent = iconMap[service.icon] || Wrench
            const cardGradient = CARD_BG[service.color] || CARD_BG.blue
            const coverSrc = service.imageUrl ? resolveProductImageUrl(service.imageUrl) : ''
            const hasCover = Boolean(coverSrc && coverSrc !== '/placeholder-product.svg')
            const priceLabel = formatServicePrice(service.price)
            const rawCtaHref = service.ctaUrl?.trim()

            const hasCustomCta =
              rawCtaHref &&
              rawCtaHref !== '/inicio#contacto' &&
              rawCtaHref !== '#contacto' &&
              (rawCtaHref.startsWith('/') || /^https?:\/\//i.test(rawCtaHref))

            let ctaHref = ''
            let isExternalCta = true

            if (hasCustomCta) {
              ctaHref = rawCtaHref
              isExternalCta = /^https?:\/\//i.test(ctaHref)
            } else {
              const phoneToUse = orgPhone || getBusinessWhatsApp()
              const message = `¡Hola! Me gustaría consultar sobre el servicio de: *${service.title}*`
              ctaHref = getWhatsAppLink({
                phone: formatWhatsAppPhone(phoneToUse),
                message,
              })
              isExternalCta = true
            }

            const isFeatured = service.featured

            return (
              <div
                key={service.id}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40',
                  isFeatured && 'ring-2 ring-primary/30'
                )}
              >
                {isFeatured && (
                  <div className="absolute right-3 top-3 z-10 rounded-full bg-amber-500 text-slate-950 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide shadow-md">
                    ★ Destacado
                  </div>
                )}

                {/* Encabezado visual: imagen 16:9 si existe o gradiente con icono */}
                {hasCover ? (
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                    <AppImage
                      src={coverSrc}
                      alt={service.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized={shouldBypassImageOptimization(coverSrc)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2 text-white">
                      <div className="min-w-0">
                        {service.category && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/80 truncate">
                            {service.category}
                          </p>
                        )}
                        <h3 className="font-bold text-base leading-tight truncate">{service.title}</h3>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={cn('flex items-center gap-3.5 bg-gradient-to-br p-5 text-white', cardGradient)}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md">
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 pr-12">
                      <h3 className="font-bold text-base leading-tight truncate">{service.title}</h3>
                      {service.category && (
                        <p className="mt-0.5 text-xs text-white/80 font-medium truncate">{service.category}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Contenido de la Tarjeta */}
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-1">
                    {service.description}
                  </p>

                  {/* Precio y Duración */}
                  {(priceLabel || service.duration) && (
                    <div className="flex flex-wrap items-center gap-2 border-y border-border/50 py-2.5">
                      {priceLabel && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <Tag className="h-3.5 w-3.5 text-primary" />
                          <span>{priceLabel}</span>
                          {service.priceNote && (
                            <span className="text-[11px] font-normal text-muted-foreground">
                              ({service.priceNote})
                            </span>
                          )}
                        </div>
                      )}
                      {service.duration && (
                        <div className="ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{service.duration}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Beneficios */}
                  {Array.isArray(service.benefits) && service.benefits.length > 0 && (
                    <ul className="space-y-1.5">
                      {service.benefits.slice(0, 4).map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                          <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Botón de Acción WhatsApp / CTA */}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-auto h-11 w-full gap-2 rounded-xl font-bold transition-all duration-200 border-primary/30 hover:border-primary hover:bg-primary hover:text-primary-foreground shadow-xs cursor-pointer"
                  >
                    <a
                      href={ctaHref}
                      target={isExternalCta ? '_blank' : undefined}
                      rel={isExternalCta ? 'noopener noreferrer' : undefined}
                    >
                      {hasCustomCta ? (
                        <>
                          <span>Consultar</span>
                          <ExternalLink className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          <WhatsAppIcon className="h-4 w-4 text-emerald-600 group-hover:text-primary-foreground transition-colors" />
                          <span>Consultar por WhatsApp</span>
                        </>
                      )}
                    </a>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Ver catálogo completo */}
        <div className="mt-12 text-center">
          <Button
            asChild
            variant="ghost"
            className="font-bold text-primary gap-2 hover:bg-primary/10 rounded-xl"
          >
            <Link href={tenantPrefix ? `${tenantPrefix}/servicios` : '/servicios'}>
              <span>Ver catálogo completo de servicios</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
