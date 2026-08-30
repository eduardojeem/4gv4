'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Wrench, CheckCircle, Tag, Clock, ExternalLink, MessageCircle, ArrowRight, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { iconMap } from '@/lib/constants/brand-theme'
import type { Service } from '@/types/website-settings'
import { cn } from '@/lib/utils'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { formatWhatsAppPhone, getWhatsAppLink, getBusinessWhatsApp } from '@/lib/whatsapp'
import { usePublicTenantPrefix } from '@/lib/public/tenant-client'

interface ServicesGridProps {
  services: Service[]
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

export function ServicesGrid({ services }: ServicesGridProps) {
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

                {/* Encabezado con Icono y Categoría */}
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

                {/* Contenido de la Tarjeta */}
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-1">
                    {service.description}
                  </p>

                  {/* Precio y Duración */}
                  {(service.price || service.duration) && (
                    <div className="flex flex-wrap items-center gap-2 border-y border-border/50 py-2.5">
                      {service.price && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <Tag className="h-3.5 w-3.5 text-primary" />
                          <span>
                            {typeof service.price === 'number'
                              ? `Gs. ${service.price.toLocaleString('es-PY')}`
                              : service.price}
                          </span>
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
                  {service.benefits.length > 0 && (
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
                          <MessageCircle className="h-4 w-4 text-emerald-600 group-hover:text-primary-foreground transition-colors" />
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
