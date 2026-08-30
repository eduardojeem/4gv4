'use client'

import { useState, useMemo } from 'react'
import {
  CheckCircle2,
  Clock3,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wrench,
  Search,
  Tag,
  ExternalLink,
  PhoneCall,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { iconMap } from '@/lib/constants/brand-theme'
import { usePublicTenantPrefix } from '@/lib/public/tenant-client'
import { prefixPublicTenantPath } from '@/lib/public/tenant-path-shared'
import { cn } from '@/lib/utils'
import { formatWhatsAppPhone, openWhatsApp, getWhatsAppLink, getBusinessWhatsApp } from '@/lib/whatsapp'
import type { Service, ServicesSectionSettings } from '@/types/website-settings'

interface ServicesPageClientProps {
  services: Service[]
  companyName: string
  whatsapp: string
  sectionText?: ServicesSectionSettings
}

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
  amber:   'from-amber-400 to-orange-600',
  emerald: 'from-emerald-600 to-teal-700',
  cyan:    'from-cyan-600 to-sky-700',
  sky:     'from-sky-600 to-blue-700',
}

export function ServicesPageClient({ services, companyName, whatsapp, sectionText }: ServicesPageClientProps) {
  const { tenantPrefix } = usePublicTenantPrefix()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [originFilter, setOriginFilter] = useState<'all' | 'catalog' | 'inventory'>('all')

  const activeServices = useMemo(
    () => services.filter((service) => service.active !== false),
    [services]
  )

  const catalogCount = useMemo(
    () => activeServices.filter(s => s.source !== 'inventory').length,
    [activeServices]
  )

  const inventoryCount = useMemo(
    () => activeServices.filter(s => s.source === 'inventory').length,
    [activeServices]
  )

  const categories = useMemo(() => {
    const set = new Set<string>()
    activeServices.forEach((s) => {
      if (s.category?.trim()) set.add(s.category.trim())
    })
    return Array.from(set)
  }, [activeServices])

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return activeServices.filter((service) => {
      const matchOrigin =
        originFilter === 'all' ||
        (originFilter === 'inventory' && service.source === 'inventory') ||
        (originFilter === 'catalog' && service.source !== 'inventory')
      const matchCategory = selectedCategory === 'all' || (service.category || 'General') === selectedCategory
      const matchSearch =
        !q ||
        service.title.toLowerCase().includes(q) ||
        service.description.toLowerCase().includes(q) ||
        (service.category || '').toLowerCase().includes(q)
      return matchOrigin && matchCategory && matchSearch
    })
  }, [activeServices, originFilter, selectedCategory, searchQuery])

  const canContact = whatsapp.replace(/\D/g, '').length >= 6

  const handleContactService = (serviceName: string) => {
    const phoneToUse = whatsapp || getBusinessWhatsApp()
    openWhatsApp({
      phone: formatWhatsAppPhone(phoneToUse),
      message: `¡Hola! Me gustaría hacer una consulta sobre el servicio: *${serviceName}*.`,
    })
  }

  if (activeServices.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center px-4 py-20 text-center">
        <div className="w-full rounded-3xl border border-primary/15 bg-primary/5 px-6 py-16">
          <Sparkles className="mx-auto h-12 w-12 text-primary/50" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">Catálogo de Servicios</h1>
          <p className="mt-2 text-muted-foreground">Estamos preparando nuestro catálogo de servicios disponibles. ¡Consultanos pronto!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      {/* ── HERO BANNER ── */}
      <section className="relative isolate overflow-hidden border-b border-primary/10 bg-primary/[0.04]">
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8">
          <div>
            <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10 px-3 py-1 font-bold">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {sectionText?.badge || 'Servicios Profesionales'}
            </Badge>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-foreground sm:text-5xl leading-tight">
              {sectionText?.title || 'Soluciones y servicios para tu día a día'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {sectionText?.subtitle || `Conocé los servicios de ${companyName}, compará opciones y coordiná directamente con nuestro equipo de atención.`}
            </p>

            {/* Barra de Búsqueda Integrada */}
            <div className="mt-6 max-w-md relative">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar servicio (ej. batería, pantalla, dobladillo)..."
                className="h-11 rounded-2xl pl-10 pr-4 text-sm bg-background/90 shadow-sm border-border/80"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Tarjetas de Beneficios del Negocio */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: ShieldCheck, title: 'Atención Confiable', text: 'Garantía y asesoramiento técnico profesional.' },
              { icon: Clock3, title: 'Presupuestos Transparentes', text: 'Precios claros, sin costos ocultos.' },
              { icon: MessageCircle, title: 'Consulta Directa', text: 'Respuesta inmediata por WhatsApp.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3.5 rounded-2xl border border-border/60 bg-card p-4 shadow-xs backdrop-blur">
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

      {/* ── CUERPO PRINCIPAL & CATÁLOGO ── */}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">

        {/* Selector de Origen: Catálogo vs Inventario de Productos */}
        {(catalogCount > 0 && inventoryCount > 0) && (
          <div className="mb-6 flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-muted/60 border border-border/70 max-w-fit shadow-2xs">
            <button
              type="button"
              onClick={() => setOriginFilter('all')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer',
                originFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Todos ({activeServices.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setOriginFilter('catalog')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer',
                originFilter === 'catalog'
                  ? 'bg-background text-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Tag className="h-3.5 w-3.5 text-primary" />
              <span>Catálogo Web & Plantillas ({catalogCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setOriginFilter('inventory')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer',
                originFilter === 'inventory'
                  ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Wrench className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Servicios de Inventario / Taller ({inventoryCount})</span>
            </button>
          </div>
        )}

        {/* Filtro por Categorías */}
        {categories.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-border/60 pb-5">
            <span className="text-xs font-bold text-muted-foreground mr-1">Categorías:</span>
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
              Todas ({activeServices.length})
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs',
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {/* Grid de Servicios */}
        {filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Wrench className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-bold">No se encontraron servicios</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              Probá buscando con otro término o seleccioná otra categoría.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-xl text-xs"
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setOriginFilter('all') }}
            >
              Mostrar todos los servicios
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service, index) => {
              const Icon = iconMap[service.icon] || Wrench
              const cardGradient = CARD_BG[service.color] || CARD_BG.blue
              const benefits = Array.isArray(service.benefits) ? service.benefits.filter(Boolean) : []
              const rawCtaHref = service.ctaUrl?.trim()
              const isExternalCta = /^https?:\/\//i.test(rawCtaHref || '')
              const hasCustomCta = rawCtaHref && rawCtaHref !== '/inicio#contacto' && rawCtaHref !== '#contacto'
              const ctaHref = hasCustomCta
                ? (isExternalCta ? rawCtaHref : prefixPublicTenantPath(tenantPrefix, rawCtaHref))
                : ''

              return (
                <article
                  key={service.id || index}
                  className={cn(
                    'group relative flex min-h-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40',
                    service.featured && 'ring-2 ring-primary/30'
                  )}
                >
                  {service.featured && (
                    <div className="absolute right-3 top-3 z-10 rounded-full bg-amber-500 text-slate-950 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide shadow-md">
                      ★ Destacado
                    </div>
                  )}

                  {/* Encabezado con Icono y Badge de Origen */}
                  <div className={cn('flex items-center gap-3.5 bg-gradient-to-br p-5 text-white', cardGradient)}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 pr-12">
                      <div className="flex items-center gap-1.5 mb-1">
                        {service.source === 'inventory' ? (
                          <span className="rounded-full bg-emerald-950/50 border border-emerald-300/40 text-emerald-100 text-[9px] font-bold px-2 py-0.2 backdrop-blur-md">
                            📦 Inventario
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/20 text-white text-[9px] font-bold px-2 py-0.2 backdrop-blur-md">
                            📋 Catálogo
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold leading-tight truncate">{service.title}</h3>
                      {service.category && (
                        <p className="mt-0.5 text-xs text-white/80 font-medium truncate">{service.category}</p>
                      )}
                    </div>
                  </div>

                  {/* Cuerpo */}
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    {service.description && (
                      <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground flex-1">{service.description}</p>
                    )}

                    {/* Precios y Duración */}
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
                            <Clock3 className="h-3.5 w-3.5 text-primary" />
                            <span>{service.duration}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Beneficios */}
                    {benefits.length > 0 && (
                      <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                        {benefits.slice(0, 4).map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Botón de Consulta */}
                    <div className="mt-auto pt-2">
                      {ctaHref ? (
                        <Button asChild variant="outline" className="h-11 w-full gap-2 rounded-xl font-bold transition-all border-primary/30 hover:border-primary hover:bg-primary hover:text-primary-foreground shadow-xs cursor-pointer">
                          <a
                            href={ctaHref}
                            target={isExternalCta ? '_blank' : undefined}
                            rel={isExternalCta ? 'noopener noreferrer' : undefined}
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span>Consultar</span>
                          </a>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="h-11 w-full gap-2 rounded-xl font-bold transition-all border-primary/30 hover:border-primary hover:bg-primary hover:text-primary-foreground shadow-xs cursor-pointer"
                          onClick={() => handleContactService(service.title)}
                        >
                          <MessageCircle className="h-4 w-4 text-emerald-600 group-hover:text-primary-foreground transition-colors" />
                          <span>Consultar por WhatsApp</span>
                        </Button>
                      )}
                      <p className="mt-2 text-center text-[10px] text-muted-foreground">
                        Atención directa de {companyName}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
