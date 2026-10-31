'use client'

import {
  CalendarCheck2,
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
  Palette,
  Eye,
  Image,
  Store,
  Navigation,
  Search,
  Globe,
} from 'lucide-react'
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

const OVERVIEW_ITEM: NavigationItem = {
  id: 'overview',
  label: 'Resumen',
  short: 'Resumen',
  description: 'Estado y próximos pasos',
  icon: LayoutDashboard,
}

const GROUPS: NavigationGroup[] = [
  {
    title: 'Diseño',
    items: [
      { id: 'design-template', label: 'Plantilla', short: 'Plantilla', description: 'Estructura y estilo general', icon: Store },
      { id: 'design-brand', label: 'Marca', short: 'Marca', description: 'Logo, color y encabezado', icon: Palette },
      { id: 'design-preview', label: 'Vista previa', short: 'Vista previa', description: 'Revisá la tienda en cada dispositivo', icon: Eye },
    ],
  },
  {
    title: 'Inicio',
    items: [
      { id: 'hero', label: 'Portada', short: 'Portada', description: 'Título, imágenes y acción principal', icon: Sparkles },
      { id: 'carousel', label: 'Banners del inicio', short: 'Banners', description: 'Campañas visuales de la portada', icon: GalleryHorizontalEnd },
      { id: 'offers', label: 'Ofertas', short: 'Ofertas', description: 'Promociones del catálogo', icon: Tag },
      { id: 'trust_bar', label: 'Beneficios', short: 'Beneficios', description: 'Ventajas que configuraste', icon: ShieldCheck },
      { id: 'brands', label: 'Marcas', short: 'Marcas', description: 'Marcas destacadas', icon: Award },
      { id: 'announcement', label: 'Aviso emergente', short: 'Aviso', description: 'Mensaje al entrar a tu tienda', icon: Megaphone },
    ],
  },
  {
    title: 'Navegación y pie',
    items: [{ id: 'navigation-footer', label: 'Menú y pie de página', short: 'Menú y pie', description: 'Composición automática; sin editor manual disponible', icon: Navigation }],
  },
  {
    title: 'Información pública',
    items: [{ id: 'public-info', label: 'Datos públicos', short: 'Datos', description: 'Descripción, contacto, redes y horarios', icon: Image }],
  },
  {
    title: 'Ventas',
    items: [{ id: 'checkout', label: 'Pagos, entrega y retiro', short: 'Ventas', description: 'Opciones de compra existentes', icon: CreditCard }],
  },
  {
    title: 'Servicios',
    items: [
      { id: 'services', label: 'Catálogo de servicios', short: 'Servicios', description: 'Qué ofrecés, precio y duración', icon: Briefcase },
      { id: 'booking', label: 'Reservas', short: 'Reservas', description: 'Turnos desde tu tienda', icon: CalendarCheck2 },
      { id: 'gallery', label: 'Galería', short: 'Galería', description: 'Fotos de tus trabajos', icon: Images },
      { id: 'process', label: 'Proceso', short: 'Proceso', description: 'Etapas de atención', icon: Footprints },
    ],
  },
  {
    title: 'SEO y compartir',
    items: [{ id: 'seo-share', label: 'SEO y compartir', short: 'SEO', description: 'Herramientas reales y estado de SEO', icon: Search }],
  },
  {
    title: 'Publicación',
    items: [{ id: 'publication', label: 'Publicar tienda', short: 'Publicación', description: 'Visibilidad, enlace y requisitos', icon: Globe }],
  },
]

const ALL_ITEMS = GROUPS.flatMap((group) => group.items)
const SYNTHETIC_SECTIONS = new Set(['design-template', 'design-brand', 'design-preview', 'navigation-footer', 'public-info', 'seo-share', 'publication'])

function splitByFocus(focus?: WebsiteFocus, availability?: Partial<Record<string, SectionAvailability>>) {
  const usable = (item: NavigationItem) => isSectionAvailable(availability, item.id)
  const recommended = (item: NavigationItem) => !focus || SYNTHETIC_SECTIONS.has(item.id) || isSectionRecommended(item.id as WebsiteSectionId, focus)
  return {
    groups: GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => usable(item) && recommended(item)) }))
      .filter((group) => group.items.length > 0),
    extra: ALL_ITEMS.filter((item) => usable(item) && !recommended(item)),
  }
}

function getSectionBadge(id: string, settings?: WebsiteSettings | null, servicesModuleEnabled = true) {
  if (id === 'services' && !servicesModuleEnabled) return { label: 'Sin módulo', tone: 'amber' as const }
  if (!settings) return null
  if (id === 'publication') return settings.company_info?.storefrontPublic
    ? { label: 'Online', tone: 'emerald' as const }
    : { label: 'Borrador', tone: 'amber' as const }
  if (id === 'services') {
    const activeCount = (settings.services || []).filter((service) => service.active !== false).length
    return settings.company_info?.servicesPageEnabled === false
      ? { label: 'Oculto', tone: 'muted' as const }
      : { label: `${activeCount}`, tone: activeCount ? 'emerald' as const : 'muted' as const }
  }
  if (id === 'checkout') return { label: settings.checkout?.commerceMode === 'whatsapp' ? 'WhatsApp' : 'Checkout', tone: 'blue' as const }
  if (id === 'hero') return settings.hero_content?.title
    ? { label: 'Activo', tone: 'emerald' as const }
    : { label: 'Pendiente', tone: 'muted' as const }
  return null
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
  focus?: WebsiteFocus
  progress?: { done: number; total: number }
  availability?: Partial<Record<string, SectionAvailability>>
}) {
  const { count: mediaCount, limit: mediaLimit, isAtLimit: isMediaAtLimit, isNearLimit: isMediaNearLimit } = useWebsiteMediaQuota()
  const { groups, extra } = splitByFocus(focus, availability)
  const items = [OVERVIEW_ITEM, ...groups.flatMap((group) => group.items), ...extra]
  const sectionCount = items.length - 1

  const renderItem = (item: NavigationItem) => {
    const Icon = item.icon
    const isSelected = value === item.id
    const badge = item.id === 'overview' && progress
      ? { label: `${progress.done}/${progress.total}`, tone: progress.done >= progress.total ? 'emerald' as const : 'blue' as const }
      : getSectionBadge(item.id, settings, servicesModuleEnabled)
    const description = item.id === 'services' && !servicesModuleEnabled ? 'Módulo inactivo en tu plan' : item.description

    return (
      <button
        key={item.id}
        type="button"
        aria-label={item.label}
        aria-current={isSelected ? 'page' : undefined}
        onClick={() => onChange(item.id)}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isSelected ? 'border-primary/25 bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground',
        )}
      >
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted/80 text-muted-foreground')} aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-1">
            <span className="truncate text-xs font-medium">{item.label}</span>
            {badge && <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[10px]', badge.tone === 'emerald' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700', badge.tone === 'amber' && 'border-amber-500/30 bg-amber-500/10 text-amber-700', badge.tone === 'blue' && 'border-blue-500/30 bg-blue-500/10 text-blue-700', badge.tone === 'muted' && 'border-border bg-muted text-muted-foreground')}>{badge.label}</span>}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{description}</span>
        </span>
        {isSelected && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      </button>
    )
  }

  return (
    <nav aria-label="Secciones del sitio web" className="min-w-0 rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-sm backdrop-blur-xs lg:sticky lg:top-4">
      <div className="mb-3 flex items-center justify-between lg:hidden">
        <label htmlFor="website-section" className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5 text-primary" /> Ir a
        </label>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{sectionCount} secciones</span>
      </div>
      <select id="website-section" aria-label="Ir a sección" value={value} onChange={(event) => onChange(event.target.value)} className="mb-3 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm lg:hidden">
        <option value="overview">Resumen</option>
        {groups.map((group) => <optgroup key={group.title} label={group.title}>{group.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}
        {extra.length > 0 && <optgroup label="Más secciones">{extra.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>}
      </select>

      <div className="hidden lg:flex lg:max-h-[calc(100vh-5.5rem)] lg:flex-col">
        <div className="shrink-0 border-b border-border/60 pb-2.5">{renderItem(OVERVIEW_ITEM)}</div>
        <div className="space-y-3 overflow-y-auto pr-1.5 pt-3 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          {groups.map((group, index) => <div key={group.title} className={cn(index > 0 && 'border-t border-border/40 pt-3')}>
            <p className="mb-1.5 px-2 text-[11px] uppercase tracking-wider text-muted-foreground/80">{group.title}</p>
            <div className="space-y-0.5">{group.items.map(renderItem)}</div>
          </div>)}
          {extra.length > 0 && <div className="border-t border-border/40 pt-3">
            <p className="mb-1.5 px-2 text-[11px] uppercase tracking-wider text-muted-foreground/80">Más secciones</p>
            <div className="space-y-0.5">{extra.map(renderItem)}</div>
          </div>}
        </div>
        <div className="mt-4 space-y-2 border-t border-border/70 pt-3.5">
          <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-semibold"><Images className="h-3.5 w-3.5 text-primary" />Imágenes ({mediaCount}/{mediaLimit})</span>
            {isMediaAtLimit ? <span className="text-[10px] font-bold text-destructive">Lleno</span> : isMediaNearLimit ? <span className="text-[10px] font-bold text-amber-600">Alerta</span> : null}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={cn('h-full transition-all', isMediaAtLimit ? 'bg-destructive' : isMediaNearLimit ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${Math.min(100, (mediaCount / mediaLimit) * 100)}%` }} /></div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{isMediaAtLimit ? '0 disponibles' : `${mediaLimit - mediaCount} disponibles`}</span>{onOpenMediaHistory && <button type="button" onClick={onOpenMediaHistory} className="font-semibold text-primary hover:underline">Ver historial</button>}</div>
        </div>
      </div>
    </nav>
  )
}
