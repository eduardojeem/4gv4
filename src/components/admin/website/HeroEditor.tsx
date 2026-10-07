'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionCard } from '@/components/admin/website/SectionCard'
import { PublicVisibilityCard } from '@/components/admin/website/PublicVisibilityCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Eye,
  Images,
  Loader2,
  MessageCircle,
  MousePointerClick,
  RotateCcw,
  Save,
  Search,
  ShoppingBag,
  Sparkles,
  Type,
  Wrench,
} from 'lucide-react'
import type { HeroContent, HeroStats } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import { cn } from '@/lib/utils'
import {
  getCompatibleHeroPresetIds,
  resolveStorefrontCapabilities,
  type HeroPresetId,
  type StorefrontCapabilities,
} from '@/lib/website/storefront-capabilities'
import {
  STOREFRONT_EYEBROW_CLASS,
  STOREFRONT_HEADING_CLASS,
  STOREFRONT_STYLE_LABELS,
  type StorefrontStyle,
} from '@/lib/website/storefront-style'
import { heroFieldsForStyle } from '@/lib/website/vertical-guidance'

export interface HeroPreset {
  id: HeroPresetId
  label: string
  icon: string
  badge: string
  title: string
  subtitle: string
  ctaPrimaryText: string
  ctaSecondaryText: string
  trustBadges: [string, string, string]
  stats: { repairs: string; satisfaction: string; avgTime: string }
}

/** Textos de partida por rubro. Las cifras son ejemplos: el dueño pone las suyas. */
export const HERO_PRESETS: HeroPreset[] = [
  {
    id: 'tech',
    label: 'Tecnología & Celulares',
    icon: '📱',
    badge: 'Tecnología & celulares',
    title: 'Lo último en tecnología con atención personalizada',
    subtitle: 'Equipos, accesorios y productos originales con garantía y entrega rápida.',
    ctaPrimaryText: 'Ver productos',
    ctaSecondaryText: 'Escribinos por WhatsApp',
    trustBadges: ['Garantía oficial', 'Productos originales', 'Envíos a todo el país'],
    stats: { repairs: '10K+', satisfaction: '99%', avgTime: '24-48h' },
  },
  {
    id: 'fashion',
    label: 'Moda, Calzado & Accesorios',
    icon: '👗',
    badge: 'Nueva temporada',
    title: 'Estilo, calidad y las mejores marcas para vos',
    subtitle: 'Encontrá las últimas novedades, ofertas exclusivas y envíos rápidos a tu puerta.',
    ctaPrimaryText: 'Ver colección',
    ctaSecondaryText: 'Consultar talles',
    trustBadges: ['100% Calidad', 'Cambio fácil', 'Cuotas y Envíos'],
    stats: { repairs: '5K+', satisfaction: '99%', avgTime: '24h' },
  },
  {
    id: 'cosmetics',
    label: 'Cosmética & Belleza',
    icon: '✨',
    badge: 'Cuidado & belleza',
    title: 'Realzá tu belleza con productos de confianza',
    subtitle: 'Cosmética y cuidado personal originales, con asesoramiento y entregas rápidas.',
    ctaPrimaryText: 'Ver catálogo',
    ctaSecondaryText: 'Pedir asesoramiento',
    trustBadges: ['Productos originales', 'Asesoría personalizada', 'Envíos disponibles'],
    stats: { repairs: '2.000+', satisfaction: '4.9★', avgTime: '24h' },
  },
  {
    id: 'barbershop',
    label: 'Barbería & Peluquería',
    icon: '💈',
    badge: 'Reservá tu turno',
    title: 'Tu estilo, en buenas manos',
    subtitle: 'Cortes, barba y color con profesionales. Elegí el servicio y reservá en un minuto.',
    ctaPrimaryText: 'Reservar turno',
    ctaSecondaryText: 'Escribinos',
    trustBadges: ['Turnos online', 'Profesionales', 'Higiene garantizada'],
    stats: { repairs: '3.000+', satisfaction: '4.9★', avgTime: 'Sin espera' },
  },
  {
    id: 'food',
    label: 'Alimentos & Gastronomía',
    icon: '🥖',
    badge: 'Fresco todos los días',
    title: 'Lo rico de siempre, directo a tu mesa',
    subtitle: 'Hacé tu pedido online y recibilo en tu casa o pasá a retirarlo listo.',
    ctaPrimaryText: 'Hacer mi pedido',
    ctaSecondaryText: 'Escribinos',
    trustBadges: ['Productos frescos', 'Delivery en el día', 'Retiro en el local'],
    stats: { repairs: '5.000+', satisfaction: '4.8★', avgTime: 'En el día' },
  },
  {
    id: 'electro',
    label: 'Ferretería, Hogar & Bazar',
    icon: '🏠',
    badge: 'Todo para tu hogar',
    title: 'Todo lo que tu hogar necesita al mejor precio',
    subtitle: 'Herramientas, materiales y equipamiento con stock disponible y envíos a domicilio u obra.',
    ctaPrimaryText: 'Ver catálogo',
    ctaSecondaryText: 'Pedir cotización',
    trustBadges: ['Stock inmediato', 'Garantía oficial', 'Precios especiales'],
    stats: { repairs: '8K+', satisfaction: '98%', avgTime: '24h' },
  },
  {
    id: 'services',
    label: 'Servicios Profesionales',
    icon: '🧰',
    badge: 'Atención profesional',
    title: 'Soluciones profesionales a tu medida',
    subtitle: 'Servicios claros, atención personalizada y presupuestos sin sorpresas.',
    ctaPrimaryText: 'Ver servicios',
    ctaSecondaryText: 'Solicitar presupuesto',
    trustBadges: ['Atención directa', 'Presupuestos claros', 'Trabajo garantizado'],
    stats: { repairs: '500+', satisfaction: '98%', avgTime: '24h' },
  },
  {
    id: 'repairs',
    label: 'Servicio Técnico & Reparaciones',
    icon: '🔧',
    badge: 'Servicio técnico',
    title: 'Reparamos tu equipo en tiempo récord con total confianza',
    subtitle: 'Diagnóstico sin costo, repuestos certificados y seguimiento online de tu reparación.',
    ctaPrimaryText: 'Ver servicios',
    ctaSecondaryText: 'Consultar falla',
    trustBadges: ['Diagnóstico sin costo', 'Garantía escrita', 'Técnicos certificados'],
    stats: { repairs: '15K+', satisfaction: '99%', avgTime: '1-3 horas' },
  },
  {
    id: 'general',
    label: 'Comercio General / Multi-rubro',
    icon: '🏪',
    badge: 'Tienda oficial',
    title: 'Los mejores productos con atención personalizada',
    subtitle: 'Explorá nuestro catálogo online con stock actualizado, promociones exclusivas y envíos rápidos.',
    ctaPrimaryText: 'Explorar tienda',
    ctaSecondaryText: 'Contactar',
    trustBadges: ['Atención directa', 'Stock permanente', 'Envíos a todo el país'],
    stats: { repairs: '100%', satisfaction: '4.9★', avgTime: 'Despacho 24h' },
  },
]

const TRACK_REPAIR_SUGGESTIONS = [
  '¿Tenés una reparación? Rastreá tu equipo',
  'Consultá el estado de tu reparación',
]

interface HeroEditorProps {
  capabilities?: StorefrontCapabilities
  /** Plantilla de la tienda: el editor pide solo lo que esa portada muestra. */
  storefrontStyle?: StorefrontStyle
}

const DEFAULT_CAPABILITIES = resolveStorefrontCapabilities({
  businessVertical: 'general',
  operatingModel: 'retail',
  effectiveModules: ['inventory', 'ecommerce', 'orders'],
})

/** Ejemplos tocables debajo de un campo. */
function Ideas({ items, current, onPick }: { items: string[]; current?: string; onPick: (value: string) => void }) {
  const unique = Array.from(new Set(items.filter(Boolean)))
  if (unique.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Ideas:</span>
      {unique.map((idea) => (
        <button
          key={idea}
          type="button"
          onClick={() => onPick(idea)}
          title={idea}
          className={cn(
            'max-w-full truncate rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
            current === idea
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
          )}
        >
          {idea}
        </button>
      ))}
    </div>
  )
}

export function HeroEditor({ capabilities = DEFAULT_CAPABILITIES, storefrontStyle = 'classic' }: HeroEditorProps = {}) {
  const { settings, isLoading, error, isSaving, updateSettings } = useAdminWebsiteSettings()
  const defaults = getWebsiteSettingsDefaults()
  const [heroContentDraft, setHeroContentDraft] = useState<HeroContent | null>(null)
  const [heroStatsDraft, setHeroStatsDraft] = useState<HeroStats | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [previewOpen, setPreviewOpen] = useState(false)

  const heroContent = heroContentDraft ?? settings?.hero_content ?? defaults.hero_content
  const heroStats = heroStatsDraft ?? settings?.hero_stats ?? defaults.hero_stats
  const hasChanges = heroContentDraft !== null || heroStatsDraft !== null
  const fields = heroFieldsForStyle(storefrontStyle, capabilities)
  const compatiblePresetIds = getCompatibleHeroPresetIds(capabilities)
  const compatiblePresets = compatiblePresetIds
    .map((id) => HERO_PRESETS.find((preset) => preset.id === id))
    .filter((preset): preset is HeroPreset => Boolean(preset))
  const recommendedPreset = compatiblePresets[0] ?? HERO_PRESETS[HERO_PRESETS.length - 1]

  // En las plantillas que no son Clásica, los banners activos ocupan el lugar de la portada.
  const bannersReplaceHero = storefrontStyle !== 'classic' &&
    Boolean(settings?.promotional_carousel?.slides?.some((slide) => slide.active))

  const currentHeroCopy = [
    heroContent.badge,
    heroContent.title,
    heroContent.subtitle,
    heroContent.ctaPrimaryText,
    heroContent.ctaSecondaryText,
    heroContent.trackRepairText,
  ].filter(Boolean).join(' ')
  const hasIncompatibleRepairCopy = !capabilities.hasRepairs &&
    /reparaci|servicio técnico|soporte técnico|diagnóstico|repuestos?|técnicos?/i.test(currentHeroCopy)

  const brandColor = settings?.company_info?.brandColor
  const customBrandColor = settings?.company_info?.customBrandColor
  const hasValidCustomBrand = brandColor === 'custom' && isValidBrandHexColor(customBrandColor)

  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  const updateContent = <K extends keyof HeroContent>(field: K, value: HeroContent[K]) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    setHeroContentDraft((c) => ({ ...(c ?? heroContent), [field]: value }))
  }

  const updateStat = <K extends keyof HeroStats>(field: K, value: HeroStats[K]) => {
    setHeroStatsDraft((s) => ({ ...(s ?? heroStats), [field]: value }))
  }

  const applyHeroPreset = (preset: HeroPreset) => {
    setHeroContentDraft((c) => ({
      ...(c ?? heroContent),
      badge: preset.badge,
      title: preset.title,
      subtitle: preset.subtitle,
      ctaPrimaryText: preset.ctaPrimaryText,
      ctaSecondaryText: preset.ctaSecondaryText,
      trustBadges: [...preset.trustBadges],
    }))
    // Las cifras solo se tocan donde se muestran (Clásica).
    if (fields.stats) {
      setHeroStatsDraft((s) => ({
        ...(s ?? heroStats),
        repairs: preset.stats.repairs,
        satisfaction: preset.stats.satisfaction,
        avgTime: preset.stats.avgTime,
      }))
    }
    setErrors({})
    toast.success(`Textos de «${preset.label}» aplicados`, {
      description: 'Ajustalos a tu negocio antes de guardar.',
    })
  }

  const discard = () => {
    setHeroContentDraft(null)
    setHeroStatsDraft(null)
    setErrors({})
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasChanges) return

    const nextErrors: Record<string, string> = {}
    // Con la portada apagada no se exigen los textos, igual que en el servidor.
    const heroActive = heroContent.enabled !== false
    if (heroActive && (!heroContent.badge || heroContent.badge.trim().length < 3)) {
      nextErrors.badge = 'La etiqueta debe tener al menos 3 caracteres.'
    }
    if (heroActive && (!heroContent.title || heroContent.title.trim().length < 10)) {
      nextErrors.title = 'El título debe tener al menos 10 caracteres.'
    }
    if (heroActive && (!heroContent.subtitle || heroContent.subtitle.trim().length < 10)) {
      nextErrors.subtitle = 'La descripción debe tener al menos 10 caracteres.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      document.getElementById(Object.keys(nextErrors)[0])?.focus()
      toast.error('Revisá los campos marcados')
      return
    }
    setErrors({})

    const result = await updateSettings({
      ...(heroContentDraft !== null ? { hero_content: heroContent } : {}),
      ...(heroStatsDraft !== null ? { hero_stats: heroStats } : {}),
    })

    if (!result.success) {
      toast.error(result.error || 'Error al guardar')
      return
    }

    toast.success('Portada guardada', { icon: <Check className="h-4 w-4" /> })
    setHeroContentDraft(null)
    setHeroStatsDraft(null)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Cargando contenido...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-destructive">
        Error al cargar contenido: {error}
      </div>
    )
  }

  const visible = heroContent.enabled !== false
  const primaryText = heroContent.ctaPrimaryText || recommendedPreset.ctaPrimaryText
  const secondaryText = heroContent.ctaSecondaryText || recommendedPreset.ctaSecondaryText

  return (
    <form onSubmit={handleSave} className="space-y-4 pb-6">
      <PublicVisibilityCard
        compact
        title="Portada principal"
        description="Lo primero que ven tus clientes al entrar a tu tienda."
        enabled={visible}
        onToggle={(checked) => updateContent('enabled', checked)}
      />

      <p className="text-xs text-muted-foreground">
        Tu plantilla <strong className="text-foreground">{STOREFRONT_STYLE_LABELS[storefrontStyle]}</strong> · {capabilities.businessLabel}.
        {' '}Te pedimos solo lo que esa portada muestra.
      </p>

      {bannersReplaceHero && (
        <div role="note" className="flex items-start gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs">
          <Images className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
          <p className="text-foreground">
            Tenés <strong>banners activos</strong>: en tu plantilla se muestran en lugar de esta portada. Si querés ver la portada, desactivá los banners.
          </p>
        </div>
      )}

      {hasIncompatibleRepairCopy && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-foreground">El contenido actual menciona reparaciones o servicio técnico.</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Ese módulo no está activo. Cambiá los textos para no ofrecer algo que tu tienda no tiene.</p>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => applyHeroPreset(recommendedPreset)}>
            Aplicar contenido recomendado
          </Button>
        </div>
      )}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ── Vista previa ── */}
        <aside aria-label="Vista previa de la portada" className="min-w-0 xl:sticky xl:top-4 xl:col-start-2 xl:row-start-1">
          <Button type="button" variant="outline" className="w-full justify-between xl:hidden" aria-expanded={previewOpen} aria-controls="hero-preview" onClick={() => setPreviewOpen((open) => !open)}>
            <span className="flex items-center gap-2"><Eye className="h-4 w-4" />{previewOpen ? 'Ocultar vista previa' : 'Ver vista previa'}</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', previewOpen && 'rotate-180')} />
          </Button>
          <div id="hero-preview" className={cn('mt-3 xl:mt-0 xl:block', !previewOpen && 'hidden')}>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  Así se ve
                </span>
                <span className={cn('flex items-center gap-1.5 text-xs font-semibold', visible ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                  <span className={cn('h-2 w-2 rounded-full', visible ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                  {visible ? 'Visible' : 'Oculta'}
                </span>
              </div>

              <div
                data-color-scheme={brandColor && brandColor !== 'custom' ? brandColor : undefined}
                data-custom-brand={hasValidCustomBrand ? '' : undefined}
                style={hasValidCustomBrand ? ({ '--brand-primary': customBrandColor } as React.CSSProperties) : undefined}
                className={cn('transition-opacity', !visible && 'opacity-40')}
              >
                {storefrontStyle === 'market' ? (
                  <div className="bg-primary p-5 text-primary-foreground">
                    <p className="text-xs font-semibold opacity-80">{heroContent.badge || settings?.company_info?.name || 'Tu súper'}</p>
                    <p className="mt-1 text-xl font-black leading-tight">{heroContent.title || '¿Qué necesitás hoy?'}</p>
                    {heroContent.subtitle && <p className="mt-1 text-xs opacity-85">{heroContent.subtitle}</p>}
                    <div className="mt-3 flex items-center gap-2 rounded-full bg-white p-1 pl-3 text-xs text-slate-400">
                      <Search className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="flex-1">Buscá leche, arroz, detergente…</span>
                      <span className="rounded-full bg-primary px-3 py-1 font-bold text-primary-foreground">Buscar</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-b from-primary/[0.07] to-background p-5">
                    <span className={cn(STOREFRONT_EYEBROW_CLASS[storefrontStyle], 'text-[10px]')}>
                      {heroContent.badge || recommendedPreset.badge}
                    </span>
                    <p className={cn('mt-2 text-xl leading-tight text-foreground', STOREFRONT_HEADING_CLASS[storefrontStyle])}>
                      {heroContent.title || recommendedPreset.title}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {heroContent.subtitle || recommendedPreset.subtitle}
                    </p>
                    {fields.buttons && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                          <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                          {primaryText}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold text-foreground">
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                          {secondaryText}
                        </span>
                      </div>
                    )}
                    {fields.tracking && (
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Wrench className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span className="underline underline-offset-2">{heroContent.trackRepairText || TRACK_REPAIR_SUGGESTIONS[0]}</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </p>
                    )}
                    {fields.stats && heroStats.enabled !== false && (
                      <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl border bg-muted/40 p-2.5 text-center">
                        {[heroStats.repairs, heroStats.satisfaction, heroStats.avgTime].map((value, index) => (
                          <div key={capabilities.metricLabels[index]}>
                            <div className="text-sm font-extrabold text-foreground">{value || '—'}</div>
                            <div className="text-[9px] text-muted-foreground">{capabilities.metricLabels[index]}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Vista aproximada. Se publica al guardar.</p>
          </div>
        </aside>

        {/* ── Edición ── */}
        <div className="min-w-0 space-y-4 xl:col-start-1 xl:row-start-1">
          <section aria-labelledby="hero-presets" className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
            <h3 id="hero-presets" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              Empezá con un texto de tu rubro
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Completa todo de una vez. Después cambiá lo que quieras.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {compatiblePresets.map((preset, index) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={preset.label}
                  onClick={() => applyHeroPreset(preset)}
                  className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span aria-hidden="true" className="text-base">{preset.icon}</span>
                  <span className="font-semibold text-foreground">{preset.label}</span>
                  {index === 0 && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Recomendado</span>}
                </button>
              ))}
            </div>
          </section>

          <SectionCard icon={Type} title="Textos" description="Una etiqueta corta, un título claro y una línea que diga qué ofrecés.">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="badge" className="text-sm font-semibold">Etiqueta</Label>
                  <span className="text-xs text-muted-foreground">{heroContent.badge.length}/100</span>
                </div>
                <Input
                  id="badge"
                  value={heroContent.badge}
                  onChange={(e) => updateContent('badge', e.target.value)}
                  placeholder={recommendedPreset.badge}
                  maxLength={100}
                  aria-invalid={!!errors.badge}
                  aria-describedby={errors.badge ? 'badge-error' : undefined}
                  className="h-10"
                />
                {errors.badge && <p id="badge-error" role="alert" className="text-xs text-destructive">{errors.badge}</p>}
                <Ideas items={compatiblePresets.map((preset) => preset.badge)} current={heroContent.badge} onPick={(value) => updateContent('badge', value)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title" className="text-sm font-semibold">Título principal</Label>
                  <span className="text-xs text-muted-foreground">{heroContent.title.length}/150</span>
                </div>
                <Input
                  id="title"
                  value={heroContent.title}
                  onChange={(e) => updateContent('title', e.target.value)}
                  placeholder={recommendedPreset.title}
                  maxLength={150}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? 'title-error' : undefined}
                  className="h-10"
                />
                {errors.title && <p id="title-error" role="alert" className="text-xs text-destructive">{errors.title}</p>}
                <Ideas items={compatiblePresets.map((preset) => preset.title)} current={heroContent.title} onPick={(value) => updateContent('title', value)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="subtitle" className="text-sm font-semibold">Descripción</Label>
                  <span className="text-xs text-muted-foreground">{heroContent.subtitle.length}/300</span>
                </div>
                <Textarea
                  id="subtitle"
                  value={heroContent.subtitle}
                  onChange={(e) => updateContent('subtitle', e.target.value)}
                  placeholder={recommendedPreset.subtitle}
                  rows={2}
                  maxLength={300}
                  aria-invalid={!!errors.subtitle}
                  aria-describedby={errors.subtitle ? 'subtitle-error' : undefined}
                  className="text-sm"
                />
                {errors.subtitle && <p id="subtitle-error" role="alert" className="text-xs text-destructive">{errors.subtitle}</p>}
              </div>
            </div>
          </SectionCard>

          {fields.buttons ? (
            <SectionCard icon={MousePointerClick} title="Botones" description="Qué puede hacer el cliente: ver tus productos o escribirte.">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ctaPrimaryText" className="text-sm font-semibold">
                    Botón principal <span className="text-muted-foreground">({capabilities.primaryAction.kind === 'services' ? 'lleva a tus servicios' : 'lleva a tus productos'})</span>
                  </Label>
                  <Input
                    id="ctaPrimaryText"
                    value={heroContent.ctaPrimaryText ?? ''}
                    onChange={(e) => updateContent('ctaPrimaryText', e.target.value)}
                    placeholder={recommendedPreset.ctaPrimaryText}
                    maxLength={40}
                    className="h-10"
                  />
                  <Ideas items={compatiblePresets.map((preset) => preset.ctaPrimaryText)} current={heroContent.ctaPrimaryText} onPick={(value) => updateContent('ctaPrimaryText', value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ctaSecondaryText" className="text-sm font-semibold">
                    Botón de contacto <span className="text-muted-foreground">(abre WhatsApp)</span>
                  </Label>
                  <Input
                    id="ctaSecondaryText"
                    value={heroContent.ctaSecondaryText ?? ''}
                    onChange={(e) => updateContent('ctaSecondaryText', e.target.value)}
                    placeholder={recommendedPreset.ctaSecondaryText}
                    maxLength={40}
                    className="h-10"
                  />
                  <Ideas items={compatiblePresets.map((preset) => preset.ctaSecondaryText)} current={heroContent.ctaSecondaryText} onPick={(value) => updateContent('ctaSecondaryText', value)} />
                </div>
                {fields.tracking && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="trackRepairText" className="text-sm font-semibold">Texto del enlace inferior (seguimiento de reparaciones)</Label>
                    <Input
                      id="trackRepairText"
                      value={heroContent.trackRepairText ?? ''}
                      onChange={(e) => updateContent('trackRepairText', e.target.value)}
                      placeholder={TRACK_REPAIR_SUGGESTIONS[0]}
                      maxLength={100}
                      className="h-10"
                    />
                    <Ideas items={TRACK_REPAIR_SUGGESTIONS} current={heroContent.trackRepairText} onPick={(value) => updateContent('trackRepairText', value)} />
                  </div>
                )}
              </div>
            </SectionCard>
          ) : (
            <p className="rounded-xl border border-dashed px-3.5 py-2.5 text-xs text-muted-foreground">
              En tu plantilla la portada lleva un buscador y el acceso a ofertas en lugar de botones.
            </p>
          )}

          {fields.stats && (
            <SectionCard icon={BarChart3} title="Números de confianza" description="Tres cifras reales de tu negocio debajo de la portada.">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 p-3">
                  <Label htmlFor="hero-stats-enabled" className="cursor-pointer text-sm">Mostrar los números</Label>
                  <Switch
                    id="hero-stats-enabled"
                    checked={heroStats.enabled !== false}
                    onCheckedChange={(checked) => updateStat('enabled', checked)}
                  />
                </div>
                {heroStats.enabled !== false && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(['repairs', 'satisfaction', 'avgTime'] as const).map((key, index) => (
                      <div key={key} className="space-y-1.5">
                        <Label htmlFor={key} className="text-xs font-semibold">
                          Métrica {index + 1} ({capabilities.metricLabels[index]})
                        </Label>
                        <Input
                          id={key}
                          value={heroStats[key] ?? ''}
                          onChange={(e) => updateStat(key, e.target.value)}
                          maxLength={20}
                          className="h-10"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">Usá cifras reales: los ejemplos de los textos de rubro no son datos de tu negocio.</p>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      <div className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', hasChanges ? 'bg-amber-500' : 'bg-emerald-500')} aria-hidden="true" />
          <span className="font-semibold text-foreground">{hasChanges ? 'Hay cambios sin guardar' : 'Portada guardada'}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          {hasChanges && (
            <Button type="button" variant="outline" onClick={discard} className="h-10 flex-1 rounded-xl px-4 text-xs sm:flex-none">
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Descartar
            </Button>
          )}
          <Button type="submit" disabled={isSaving || !hasChanges} className="h-10 flex-1 gap-2 rounded-xl px-5 text-xs font-bold sm:flex-none">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {isSaving ? 'Guardando...' : 'Guardar portada'}
          </Button>
        </div>
      </div>
    </form>
  )
}
