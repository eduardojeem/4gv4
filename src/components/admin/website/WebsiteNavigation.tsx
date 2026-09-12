'use client'

import {
  Building2,
  CreditCard,
  Sparkles,
  ShieldCheck,
  GalleryHorizontalEnd,
  Tag,
  Briefcase,
  Footprints,
  Award,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'

interface NavigationItem {
  id: string
  label: string
  short: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavigationGroup {
  title: string
  items: NavigationItem[]
}

const GROUPS: NavigationGroup[] = [
  {
    title: 'Configuración',
    items: [
      {
        id: 'company',
        label: 'Empresa y publicación',
        short: 'Empresa',
        description: 'Identidad, visibilidad y dominio',
        icon: Building2,
      },
      {
        id: 'checkout',
        label: 'Pagos y entregas',
        short: 'Checkout',
        description: 'Medios de pago, envíos y retiro',
        icon: CreditCard,
      },
    ],
  },
  {
    title: 'Diseño de la tienda',
    items: [
      {
        id: 'hero',
        label: 'Portada',
        short: 'Portada',
        description: 'Titular, fondo y llamado a la acción',
        icon: Sparkles,
      },
      {
        id: 'trust_bar',
        label: 'Beneficios',
        short: 'Beneficios',
        description: 'Barra de confianza y garantías',
        icon: ShieldCheck,
      },
      {
        id: 'brands',
        label: 'Marcas destacadas',
        short: 'Marcas',
        description: 'Marcas oficiales y fabricantes',
        icon: Award,
      },
      {
        id: 'carousel',
        label: 'Banners promocionales',
        short: 'Banners',
        description: 'Campañas visuales rotativas',
        icon: GalleryHorizontalEnd,
      },
      {
        id: 'offers',
        label: 'Ofertas',
        short: 'Ofertas',
        description: 'Promociones y descuentos clave',
        icon: Tag,
      },
    ],
  },
  {
    title: 'Servicios y atención',
    items: [
      {
        id: 'services',
        label: 'Catálogo de servicios',
        short: 'Servicios',
        description: 'Reparaciones y atención especializada',
        icon: Briefcase,
      },
      {
        id: 'process',
        label: 'Cómo atendemos',
        short: 'Proceso',
        description: 'Etapas de atención paso a paso',
        icon: Footprints,
      },
    ],
  },
]

function getSectionBadge(
  id: string,
  settings?: WebsiteSettings | null,
  servicesModuleEnabled: boolean = true
): { label: string; tone: 'emerald' | 'amber' | 'blue' | 'muted' } | null {
  if (id === 'services' && !servicesModuleEnabled) {
    return { label: 'Sin módulo', tone: 'amber' }
  }

  if (!settings) return null

  switch (id) {
    case 'company': {
      const isPublic = settings.company_info?.storefrontPublic
      return isPublic
        ? { label: 'Online', tone: 'emerald' }
        : { label: 'Borrador', tone: 'amber' }
    }
    case 'checkout': {
      const mode = settings.checkout?.commerceMode
      return mode === 'whatsapp'
        ? { label: 'WhatsApp', tone: 'blue' }
        : { label: 'Checkout', tone: 'blue' }
    }
    case 'hero': {
      const hasHero = Boolean(settings.hero_content?.title)
      return hasHero
        ? { label: 'Activo', tone: 'emerald' }
        : { label: 'Borrador', tone: 'muted' }
    }
    case 'trust_bar': {
      const enabled = settings.trust_bar?.enabled !== false
      return enabled
        ? { label: 'Visible', tone: 'emerald' }
        : { label: 'Oculto', tone: 'muted' }
    }
    case 'brands': {
      const enabled = settings.brands_section?.enabled !== false
      const count = settings.brands_section?.items?.length || 0
      if (!enabled) return { label: 'Oculto', tone: 'muted' }
      return count > 0 ? { label: `${count}`, tone: 'emerald' } : { label: '0', tone: 'muted' }
    }
    case 'carousel': {
      const enabled = settings.promotional_carousel?.enabled !== false
      const count = settings.promotional_carousel?.slides?.length || 0
      if (!enabled) return { label: 'Oculto', tone: 'muted' }
      return count > 0 ? { label: `${count}`, tone: 'emerald' } : { label: '0', tone: 'muted' }
    }
    case 'offers': {
      const enabled = settings.offers_section?.enabled !== false
      return enabled
        ? { label: 'Activo', tone: 'emerald' }
        : { label: 'Oculto', tone: 'muted' }
    }
    case 'services': {
      const enabled = settings.company_info?.servicesPageEnabled !== false
      const activeCount = (settings.services || []).filter((s) => s.active !== false).length
      if (!enabled) return { label: 'Oculto', tone: 'muted' }
      return activeCount > 0 ? { label: `${activeCount}`, tone: 'emerald' } : { label: '0', tone: 'muted' }
    }
    case 'process': {
      const enabled = settings.company_info?.processSectionEnabled !== false
      const count = (settings.process_steps || []).length
      if (!enabled) return { label: 'Oculto', tone: 'muted' }
      return count > 0 ? { label: `${count}`, tone: 'emerald' } : { label: '0', tone: 'muted' }
    }
    default:
      return null
  }
}

export function WebsiteNavigation({
  value,
  onChange,
  settings,
  servicesModuleEnabled = true,
}: {
  value: string
  onChange: (value: string) => void
  settings?: WebsiteSettings | null
  servicesModuleEnabled?: boolean
}) {
  return (
    <nav
      aria-label="Secciones del sitio web"
      className="min-w-0 rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-sm backdrop-blur-xs lg:sticky lg:top-4"
    >
      {/* Selector móvil nativo (accesible para tests y lectores de pantalla) + carrusel rápido de chips */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="website-section" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Editar sección
          </label>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            9 secciones
          </span>
        </div>

        <select
          id="website-section"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {GROUPS.map((group) => (
            <optgroup key={group.title} label={group.title}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Chips horizontales de acceso rápido en móvil */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          {GROUPS.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon
            const isSelected = value === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  'flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all border',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.short}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navegación vertical de escritorio (lg:block con scrollbar cómodo) */}
      <div className="hidden lg:flex lg:flex-col lg:max-h-[calc(100vh-5.5rem)]">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5 px-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Secciones
            </span>
          </div>
          <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            9 secciones
          </span>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1.5 pt-3 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          {GROUPS.map((group, groupIdx) => (
            <div key={group.title} className={cn(groupIdx > 0 && 'border-t border-border/40 pt-3')}>
              <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isSelected = value === item.id
                  const badge = getSectionBadge(item.id, settings, servicesModuleEnabled)
                  const description =
                    item.id === 'services' && !servicesModuleEnabled
                      ? 'Módulo inactivo en tu plan'
                      : item.description

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="button"
                      aria-label={item.label}
                      aria-current={isSelected ? 'page' : undefined}
                      onClick={() => onChange(item.id)}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
                        isSelected
                          ? 'bg-primary/10 text-primary font-medium shadow-2xs border border-primary/25'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-transparent'
                      )}
                    >
                      {/* Barra indicadora activa lateral */}
                      {isSelected && (
                        <span
                          className="absolute -left-1 top-2.5 bottom-2.5 w-1 rounded-r-full bg-primary"
                          aria-hidden="true"
                        />
                      )}

                      {/* Icon container */}
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-2xs'
                            : 'bg-muted/80 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Texto del item (Título + Subtítulo) */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('truncate text-xs leading-tight', isSelected ? 'font-semibold text-primary' : 'text-foreground')}>
                            {item.label}
                          </span>

                          {/* Badge de estado si está disponible */}
                          {badge && (
                            <span
                              aria-hidden="true"
                              className={cn(
                                'ml-1 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none border',
                                badge.tone === 'emerald' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                                badge.tone === 'amber' && 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                badge.tone === 'blue' && 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
                                badge.tone === 'muted' && 'border-border/60 bg-muted text-muted-foreground'
                              )}
                            >
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground mt-0.5" aria-hidden="true">
                          {description}
                        </p>
                      </div>

                      {/* Indicador flecha sutil en activo */}
                      {isSelected && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary opacity-80" aria-hidden="true" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </nav>
  )
}
