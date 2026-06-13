'use client'

import { useMemo } from 'react'
import {
  CheckCircle2,
  Clock3,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { colorMap, iconMap } from '@/lib/constants/brand-theme'
import { cn } from '@/lib/utils'
import { formatWhatsAppPhone, openWhatsApp } from '@/lib/whatsapp'
import type { Service } from '@/types/website-settings'

interface ServicesPageClientProps {
  services: Service[]
  companyName: string
  whatsapp: string
}

function categoryId(category: string) {
  return `servicios-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export function ServicesPageClient({ services, companyName, whatsapp }: ServicesPageClientProps) {
  const activeServices = useMemo(
    () => services.filter((service) => service.active !== false),
    [services]
  )

  const categories = useMemo(
    () => Array.from(new Set(activeServices.map((service) => service.category || 'General'))),
    [activeServices]
  )

  const canContact = whatsapp.replace(/\D/g, '').length >= 6

  const handleContactService = (serviceName: string) => {
    if (!canContact) return

    openWhatsApp({
      phone: formatWhatsAppPhone(whatsapp),
      message: `Hola! Me interesa el servicio: ${serviceName}. ¿Me pueden dar más información?`,
    })
  }

  if (activeServices.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center px-4 py-20 text-center">
        <div className="w-full rounded-3xl border border-primary/15 bg-primary/5 px-6 py-16">
          <Sparkles className="mx-auto h-12 w-12 text-primary/50" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">Próximamente</h1>
          <p className="mt-2 text-muted-foreground">Estamos preparando nuestro catálogo de servicios.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      <section className="relative isolate overflow-hidden border-b border-primary/10 bg-primary/[0.06]">
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1fr_0.72fr] lg:items-center lg:px-8">
          <div>
            <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Servicio técnico profesional
            </Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              Soluciones confiables para tus dispositivos
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Conocé los servicios de {companyName}, compará opciones y consultá directamente con nuestro equipo.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {categories.map((category) => (
                <a
                  key={category}
                  href={`#${categoryId(category)}`}
                  className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  {category}
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: ShieldCheck, title: 'Trabajo garantizado', text: 'Atención profesional y respaldo.' },
              { icon: Clock3, title: 'Tiempos claros', text: 'Duración informada en cada servicio.' },
              { icon: MessageCircle, title: 'Consulta directa', text: 'Coordiná rápidamente por WhatsApp.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-primary/10 bg-background/85 p-4 shadow-sm backdrop-blur">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="space-y-14">
          {categories.map((category) => {
            const categoryServices = activeServices.filter(
              (service) => (service.category || 'General') === category
            )

            return (
              <section key={category} id={categoryId(category)} className="scroll-mt-28">
                <div className="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Catálogo</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{category}</h2>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {categoryServices.length} {categoryServices.length === 1 ? 'servicio' : 'servicios'}
                  </span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryServices.map((service, index) => {
                    const Icon = iconMap[service.icon] || Wrench
                    const colors = colorMap[service.color] || colorMap.blue
                    const benefits = Array.isArray(service.benefits) ? service.benefits.filter(Boolean) : []

                    return (
                      <article
                        key={service.id || index}
                        className={cn(
                          'group relative flex min-h-full flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10',
                          service.featured && 'border-primary/35 ring-1 ring-primary/20'
                        )}
                      >
                        {service.featured && (
                          <div className="absolute right-0 top-0 rounded-bl-2xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              Destacado
                            </span>
                          </div>
                        )}

                        <div className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                          colors.bg,
                          colors.text,
                          colors.hover,
                          'group-hover:text-white'
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>

                        <h3 className="mt-5 pr-16 text-lg font-bold leading-snug text-card-foreground">
                          {service.title}
                        </h3>
                        {service.description && (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{service.description}</p>
                        )}

                        {(service.price || service.duration) && (
                          <div className="mt-5 flex flex-wrap gap-2 border-y border-border/70 py-3">
                            {service.price && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Precio</p>
                                <p className="text-base font-extrabold text-primary">
                                  {typeof service.price === 'number'
                                    ? `Gs. ${service.price.toLocaleString('es-PY')}`
                                    : service.price}
                                </p>
                                {service.priceNote && <p className="text-[11px] text-muted-foreground">{service.priceNote}</p>}
                              </div>
                            )}
                            {service.duration && (
                              <div className="ml-auto flex items-center gap-1.5 self-center rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                                <Clock3 className="h-3.5 w-3.5 text-primary" />
                                {service.duration}
                              </div>
                            )}
                          </div>
                        )}

                        {benefits.length > 0 && (
                          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                            {benefits.slice(0, 4).map((benefit) => (
                              <li key={benefit} className="flex gap-2">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <span>{benefit}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-auto pt-6">
                          <Button
                            className="w-full gap-2 font-bold shadow-sm shadow-primary/15"
                            onClick={() => handleContactService(service.title)}
                            disabled={!canContact}
                          >
                            <MessageCircle className="h-4 w-4" />
                            {canContact ? 'Consultar servicio' : 'Consulta no disponible'}
                          </Button>
                          <p className="mt-2 text-center text-[11px] text-muted-foreground">
                            Respuesta directa del equipo de {companyName}
                          </p>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
