'use client'

import {
  CalendarCheck2,
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
  Megaphone,
  Images,
  LayoutDashboard,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { WebsiteSettings } from '@/types/website-settings'
import { useWebsiteMediaQuota } from '@/hooks/useWebsiteMediaQuota'
import { isSectionRecommended, type WebsiteFocus, type WebsiteSectionId } from '@/lib/website/setup-checklist'
import { isSectionAvailable, type SectionAvailability } from '@/lib/website/section-availability'

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
    title: 'Datos y venta',
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
      {
        id: 'brands',
        label: 'Marcas destacadas',
        short: 'Marcas',
        description: 'Marcas oficiales y fabricantes',
        icon: Award,
      },
      {
        id: 'announcement',
        label: 'Aviso emergente',
        short: 'Aviso',
        description: 'Cartel al entrar a tu tienda',
        icon: Megaphone,
      },
    ],
  },
  {
    title: 'Servicios y turnos',
    items: [
      {
        id: 'booking',
        label: 'Reservas online',
        short: 'Reservas',
        description: 'Turnos desde el inicio de tu tienda',
        icon: CalendarCheck2,
      },
      {
        id: 'services',
        label: 'Catálogo de servicios',
        short: 'Servicios',
        description: 'Qué ofrecés, precio y duración',
        icon: Briefcase,
      },
      {
        id: 'gallery',
        label: 'Galería de trabajos',
        short: 'Galería',
        description: 'Fotos de tus mejores trabajos',
        icon: Images,
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

const OVERVIEW_ITEM: NavigationItem = {
  id: 'overview',
  label: 'Resumen y guía',
  short: 'Resumen',
  description: 'Qué falta y qué sigue',
  icon: LayoutDashboard,
}

const ALL_ITEMS = GROUPS.flatMap((group) => group.items)

/**
 * Las secciones que la cuenta no puede usar no se listan. Con un foco, las que
 * no aplican al rubro pasan a "Más secciones".
 */
function splitByFocus(focus?: WebsiteFocus, availability?: Partial<Record<string, SectionAvailability>>) {
  const usable = (item: NavigationItem) => isSectionAvailable(availability, item.id)
  const recommended = (item: NavigationItem) => !focus || isSectionRecommended(item.id as WebsiteSectionId, focus)
  return {
    groups: GROUPS
      .map((group) => ({ ...group, items: group.items.filter((item) => usable(item) && recommended(item)) }))
      .filter((group) => group.items.length > 0),
    extra: ALL_ITEMS.filter((item) => usable(item) && !recommended(item)),
  }
}

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
      const enabled = Boolean(settings.brands_section?.enabled)
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
    case 'gallery': {
      const count = settings.gallery_section?.images?.length || 0
      if (!settings.gallery_section?.enabled) return { label: 'Oculta', tone: 'muted' }
      return count > 0 ? { label: `${count}`, tone: 'emerald' } : { label: '0', tone: 'muted' }
    }
    case 'booking': {
      return settings.booking_section?.enabled
        ? { label: 'Activa', tone: 'emerald' }
        : { label: 'Oculta', tone: 'muted' }
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
  onOpenMediaHistory,
  focus,
  progress,
  availability,
}: {
  value: string
  onChange: (value: string) => void
  settings?: WebsiteSettings | null
  servicesModuleEnabled?: boolean
  onOpenMediaHistory?: () => void
  /** Cómo trabaja el negocio; sin foco se listan todas las secciones juntas. */
  focus?: WebsiteFocus
  /** Pasos completos del resumen guiado. */
  progress?: { done: number; total: number }
  /** Qué secciones permite la cuenta según sus módulos; sin dato se listan todas. */
  availability?: Partial<Record<string, SectionAvailability>>
}) {
  const { count: mediaCount, limit: mediaLimit, isAtLimit: isMediaAtLimit, isNearLimit: isMediaNearLimit } = useWebsiteMediaQuota()
  const { groups, extra } = splitByFocus(focus, availability)
  const [showExtra, setShowExtra] = useState(false)
  const extraOpen = showExtra || extra.some((item) => item.id === value)
  const sectionCount = groups.reduce((total, group) => total + group.items.length, 0) + extra.length
  const overviewBadge = progress
    ? { label: `${progress.done}/${progress.total}`, tone: progress.done >= progress.total ? 'emerald' as const : 'blue' as const }
    : null
  const chipItems = [OVERVIEW_ITEM, ...groups.flatMap((group) => group.items)]

  const renderItem = (item: NavigationItem) => {
    const Icon = item.icon
    const isSelected = value === item.id
    const badge = item.id === 'overview' ? overviewBadge : getSectionBadge(item.id, settings, servicesModuleEnabled)
    const description =
      item.id === 'services' && !servicesModuleEnabled
        ? 'Módulo inactivo en tu plan'
        : item.description

    return (
      <button
        key={item.id}
        type="button"
        aria-label={item.label}
        aria-current={isSelected ? 'page' : undefined}
        onClick={() => onChange(item.id)}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
          isSelected
            ? 'bg-primary/10 text-primary shadow-2xs border border-primary/25'
            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-transparent'
        )}
      >
        {isSelected && (
          <span className="absolute -left-1 top-2.5 bottom-2.5 w-1 rounded-r-full bg-primary" aria-hidden="true" />
        )}
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className={cn('truncate text-xs leading-tight', isSelected ? 'font-semibold text-primary' : 'text-foreground')}>
              {item.label}
            </span>
            {badge && (
              <span
                aria-hidden="true"
                className={cn(
                  'ml-1 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] leading-none border',
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
        {isSelected && (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary opacity-80" aria-hidden="true" />
        )}
      </button>
    )
  }

  return (
    <nav
      aria-label="Secciones del sitio web"
      className="min-w-0 rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-sm backdrop-blur-xs lg:sticky lg:top-4"
    >
      {/* Móvil: selector nativo (accesible) + chips de las secciones del rubro */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="website-section" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Editar sección
          </label>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {sectionCount} secciones
          </span>
        </div>

        <select
          id="website-section"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value={OVERVIEW_ITEM.id}>{OVERVIEW_ITEM.label}</option>
          {groups.map((group) => (
            <optgroup key={group.title} label={group.title}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
          {extra.length > 0 && (
            <optgroup label="Más secciones">
              {extra.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          {chipItems.map((item) => {
            const Icon = item.icon
            const isSelected = value === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  'flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-xs transition-all border',
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

      {/* Escritorio: resumen arriba, grupos del rubro y el resto plegado */}
      <div className="hidden lg:flex lg:flex-col lg:max-h-[calc(100vh-5.5rem)]">
        <div className="shrink-0 border-b border-border/60 pb-2.5">
          {renderItem(OVERVIEW_ITEM)}
        </div>

        <div className="space-y-3 overflow-y-auto pr-1.5 pt-3 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          {groups.map((group, groupIdx) => (
            <div key={group.title} className={cn(groupIdx > 0 && 'border-t border-border/40 pt-3')}>
              <p className="mb-1.5 px-2 text-[11px] uppercase tracking-wider text-muted-foreground/80">
                {group.title}
              </p>
              <div className="space-y-0.5">{group.items.map(renderItem)}</div>
            </div>
          ))}

          {extra.length > 0 && (
            <div className="border-t border-border/40 pt-3">
              <button
                type="button"
                onClick={() => setShowExtra((current) => !current)}
                aria-expanded={extraOpen}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground/80 hover:text-foreground"
              >
                <span>Más secciones ({extra.length})</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', extraOpen && 'rotate-180')} />
              </button>
              {extraOpen && <div className="mt-1.5 space-y-0.5">{extra.map(renderItem)}</div>}
            </div>
          )}
        </div>

        {/* Cuota de imágenes del sitio */}
        <div className="mt-4 pt-3.5 border-t border-border/70 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Images className="h-3.5 w-3.5 text-primary" />
              <span>Imágenes ({mediaCount}/{mediaLimit})</span>
            </span>
            {isMediaAtLimit ? (
              <span className="rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                Lleno
              </span>
            ) : isMediaNearLimit ? (
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                Alerta
              </span>
            ) : null}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isMediaAtLimit ? "bg-destructive" : isMediaNearLimit ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, (mediaCount / mediaLimit) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{isMediaAtLimit ? '0 disponibles' : `${mediaLimit - mediaCount} disponibles`}</span>
            {onOpenMediaHistory && (
              <button
                type="button"
                onClick={onOpenMediaHistory}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                Ver historial
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
