'use client'

import { Wrench, CheckCircle, Tag, Clock, ExternalLink, MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { iconMap } from '@/lib/constants/brand-theme'
import type { Service } from '@/types/website-settings'
import { cn } from '@/lib/utils'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { formatWhatsAppPhone, getWhatsAppLink, getBusinessWhatsApp } from '@/lib/whatsapp'

interface ServicesGridProps {
  services: Service[]
}

// Subtle bg class per color for the card header
const CARD_BG: Record<string, string> = {
  blue:    'from-blue-500 to-indigo-600',
  green:   'from-green-500 to-emerald-600',
  purple:  'from-purple-500 to-fuchsia-600',
  orange:  'from-orange-500 to-amber-500',
  red:     'from-red-500 to-rose-600',
  indigo:  'from-indigo-500 to-blue-700',
  teal:    'from-teal-500 to-emerald-600',
  yellow:  'from-yellow-400 to-amber-500',
  pink:    'from-pink-500 to-rose-600',
  rose:    'from-rose-500 to-pink-600',
  amber:   'from-amber-400 to-orange-500',
  emerald: 'from-emerald-500 to-teal-600',
  cyan:    'from-cyan-500 to-sky-600',
  sky:     'from-sky-500 to-blue-600',
}

export function ServicesGrid({ services }: ServicesGridProps) {
  const { settings } = useWebsiteSettings()
  
  if (services.length === 0) return null

  const orgPhone = settings?.company_info?.whatsapp || settings?.company_info?.phone || ''

  return (
    <section className="border-t bg-background py-16 md:py-24">
      <div className="container">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <Wrench className="h-3.5 w-3.5" />
            Lo que hacemos
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Nuestros servicios
          </h2>
          <p className="mt-3 text-muted-foreground">
            Servicios publicados por la empresa para consultas y atención directa.
          </p>
        </div>

        {/* Grid */}
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => {
            const IconComponent = iconMap[service.icon] || Wrench
            const cardGradient = CARD_BG[service.color] || CARD_BG.blue
            const rawCtaHref   = service.ctaUrl?.trim()
            
            // Si ctaUrl es personalizado y no el default anterior, lo respetamos
            const hasCustomCta = rawCtaHref && 
              rawCtaHref !== '/inicio#contacto' && 
              rawCtaHref !== '#contacto' && 
              (rawCtaHref.startsWith('/') || /^https?:\/\//i.test(rawCtaHref))

            let ctaHref = ''
            let isExternalCta = true

            if (hasCustomCta) {
              ctaHref = rawCtaHref
              isExternalCta = /^https?:\/\//i.test(ctaHref)
            } else {
              // Si está vacío o tiene el enlace por defecto roto, abre WhatsApp directamente
              const phoneToUse = orgPhone || getBusinessWhatsApp()
              const message = `¡Hola! Me gustaría hacer una consulta sobre el servicio de *${service.title}*`
              ctaHref = getWhatsAppLink({
                phone: formatWhatsAppPhone(phoneToUse),
                message
              })
              isExternalCta = true
            }

            const isFeatured = service.featured

            return (
              <div
                key={service.id}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
                  isFeatured && 'ring-2 ring-primary/30'
                )}
              >
                {isFeatured && (
                  <div className="absolute right-3 top-3 z-10 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow">
                    Más popular
                  </div>
                )}

                {/* Coloured header */}
                <div className={cn('flex items-center gap-3 bg-gradient-to-br p-5 text-white', cardGradient)}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner backdrop-blur-sm">
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold leading-tight">{service.title}</h3>
                    {service.category && (
                      <p className="mt-0.5 text-xs text-white/70">{service.category}</p>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    {service.description}
                  </p>

                  {/* Price & Duration */}
                  {(service.price || service.duration) && (
                    <div className="flex flex-wrap gap-2">
                      {service.price && (
                        <Badge variant="secondary" className="gap-1 text-xs font-semibold">
                          <Tag className="h-3 w-3" />
                          {service.price}
                        </Badge>
                      )}
                      {service.duration && (
                        <Badge variant="outline" className="gap-1 text-xs font-medium">
                          <Clock className="h-3 w-3" />
                          {service.duration}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Benefits */}
                  {service.benefits.length > 0 && (
                    <ul className="space-y-1.5">
                      {service.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="text-muted-foreground">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* CTA */}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className={cn(
                      'mt-auto w-full gap-2 rounded-xl transition-all duration-300',
                      `group-hover:border-transparent group-hover:bg-gradient-to-br ${cardGradient} group-hover:text-white`
                    )}
                  >
                    <a
                      href={ctaHref}
                      target={isExternalCta ? '_blank' : undefined}
                      rel={isExternalCta ? 'noopener noreferrer' : undefined}
                    >
                      Consultar
                      {hasCustomCta ? (
                        <ExternalLink className="h-3.5 w-3.5" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5 text-green-500 group-hover:text-white transition-colors duration-300" />
                      )}
                    </a>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
