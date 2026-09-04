'use client'

import { useEffect, useRef, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionCard } from '@/components/admin/website/SectionCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Loader2,
  Save,
  Sparkles,
  TrendingUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Plus,
  RefreshCw,
  Store,
  Tag,
  Wrench,
  Smartphone,
  ShoppingBag,
  Monitor,
  ShieldCheck,
  Truck,
  CreditCard,
  MessageCircle,
  ExternalLink,
  Zap,
  Award,
  ThumbsUp,
  Clock,
  ArrowRight,
  Package,
  Search,
  MapPin,
} from 'lucide-react'
import Image from 'next/image'
import { HeroContent, HeroStats } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import { PublicVisibilityCard } from '@/components/admin/website/PublicVisibilityCard'
import { cn } from '@/lib/utils'

export interface HeroPreset {
  id: string
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

export const HERO_PRESETS: HeroPreset[] = [
  {
    id: 'tech',
    label: 'Tecnología & Celulares',
    icon: '📱',
    badge: '✨ Especialistas en Tecnología & Celulares',
    title: 'Lo último en tecnología y servicio técnico garantizado',
    subtitle: 'Equipos nuevos, accesorios originales y reparación profesional con garantía escrita.',
    ctaPrimaryText: 'Ver productos',
    ctaSecondaryText: 'Escribinos por WhatsApp',
    trustBadges: ['Garantía escrita', 'Repuestos originales', 'Envíos a todo el país'],
    stats: { repairs: '10K+', satisfaction: '99%', avgTime: '24-48h' },
  },
  {
    id: 'fashion',
    label: 'Moda, Calzado & Accesorios',
    icon: '👗',
    badge: '🔥 Nueva Temporada & Tendencias',
    title: 'Estilo, calidad y las mejores marcas para vos',
    subtitle: 'Encontrá las últimas novedades, ofertas exclusivas y envíos rápidos a tu puerta.',
    ctaPrimaryText: 'Ver colección',
    ctaSecondaryText: 'Consultar talles',
    trustBadges: ['100% Calidad', 'Cambio fácil', 'Cuotas y Envíos'],
    stats: { repairs: '5K+', satisfaction: '99%', avgTime: '24h' },
  },
  {
    id: 'electro',
    label: 'Electro, Hogar & Bazar',
    icon: '🏠',
    badge: '🏆 Ofertas Directas para tu Hogar',
    title: 'Todo lo que tu hogar necesita al mejor precio',
    subtitle: 'Grandes descuentos en electrodomésticos, bazar y equipamiento con despacho inmediato.',
    ctaPrimaryText: 'Ver catálogo',
    ctaSecondaryText: 'Pedir cotización',
    trustBadges: ['Stock inmediato', 'Garantía oficial', 'Precios especiales'],
    stats: { repairs: '8K+', satisfaction: '98%', avgTime: '24h' },
  },
  {
    id: 'repairs',
    label: 'Servicio Técnico & Reparaciones',
    icon: '🔧',
    badge: '🔧 Laboratorio Técnico Especializado',
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
    badge: '⭐ Tienda Oficial & Stock Garantizado',
    title: 'Los mejores productos con atención personalizada',
    subtitle: 'Explorá nuestro catálogo online con stock actualizado, promociones exclusivas y envíos rápidos.',
    ctaPrimaryText: 'Explorar tienda',
    ctaSecondaryText: 'Contactar',
    trustBadges: ['Atención directa', 'Stock permanente', 'Envíos a todo el país'],
    stats: { repairs: '100%', satisfaction: '4.9★', avgTime: 'Despacho 24h' },
  },
]

const BADGE_SUGGESTIONS = [
  '✨ Tienda Oficial',
  '🔥 Ofertas de Temporada',
  '🚚 Envíos a todo el país',
  '⭐ Calidad Garantizada',
  '⚡ Stock Inmediato',
  '🏆 Más de 10 años de experiencia',
  '💎 Productos 100% Originales',
]

const TITLE_SUGGESTIONS = [
  'Lo último en tecnología y servicio técnico garantizado',
  'Los mejores productos con atención personalizada y garantía',
  'Tu tienda de confianza con precios imbatibles y envíos rápidos',
  'Ofertas exclusivas y lanzamientos de temporada al mejor precio',
  'Todo lo que buscás en un solo lugar con despacho inmediato',
]

const SUBTITLE_SUGGESTIONS = [
  'Stock 100% actualizado • Envíos a todo el país • Atención directa por WhatsApp',
  'Garantía escrita • Repuestos originales • Técnicos certificados',
  'Precios mayoristas y minoristas • Pagos en efectivo, transferencias y tarjetas',
  'Comprá fácil y seguro desde tu celular con entrega rápida a domicilio',
]

const CTA_PRIMARY_SUGGESTIONS = [
  'Ver productos',
  'Explorar catálogo',
  'Ver ofertas activas',
  'Comprar ahora',
  'Ver colección',
  'Explorar tienda',
]

const CTA_SECONDARY_SUGGESTIONS = [
  'Escribinos por WhatsApp',
  'Consultar stock',
  'Pedir cotización',
  'Asesoramiento gratis',
  'Contactar vendedor',
  'Consultar falla',
]

const TRACK_REPAIR_SUGGESTIONS = [
  '¿Tenés una reparación? Rastreá tu equipo',
  '¿Hiciste un pedido? Rastreá tu compra',
  'Consultar estado de orden en vivo',
  'Rastrear equipo con número de orden',
]

const TRUST_BADGE_CATEGORIES = [
  {
    category: 'Garantía & Calidad',
    icon: '🛡️',
    items: ['Garantía escrita', 'Repuestos originales', '100% Calidad', 'Técnicos certificados', 'Productos oficiales'],
  },
  {
    category: 'Envíos & Stock',
    icon: '🚚',
    items: ['Envíos a todo el país', 'Entrega en el día', 'Stock inmediato', 'Despacho en 24h', 'Retiro en local'],
  },
  {
    category: 'Atención & Beneficios',
    icon: '💳',
    items: ['Atención directa', 'Pago 100% seguro', 'Cuotas sin interés', 'Precios de fábrica', 'Cambio fácil'],
  },
]

const STAT_REPAIRS_SUGGESTIONS = ['10K+', '5.000+', '15K+', '50K+', '100%', '10+ Años', '1.000+']
const STAT_SATISFACTION_SUGGESTIONS = ['99%', '98%', '100%', '4.9★', '⭐ 5 Estrellas', '99.5%']
const STAT_AVG_TIME_SUGGESTIONS = ['24-48h', '1-3 horas', 'En el día', 'Despacho 24h', 'Inmediato', '6 Meses']

interface HeroEditorProps {
  initialContent?: HeroContent
  initialStats?: HeroStats
}

export function HeroEditor({ initialContent, initialStats }: HeroEditorProps = {}) {
  const { settings, isLoading, error, isSaving, updateSettings } = useAdminWebsiteSettings()
  const defaults = getWebsiteSettingsDefaults()
  const [heroContentDraft, setHeroContentDraft] = useState<HeroContent | null>(null)
  const [heroStatsDraft, setHeroStatsDraft] = useState<HeroStats | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const heroContent = heroContentDraft ?? settings?.hero_content ?? defaults.hero_content
  const heroStats = heroStatsDraft ?? settings?.hero_stats ?? defaults.hero_stats
  const hasChanges = heroContentDraft !== null || heroStatsDraft !== null

  const brand = getBrandTheme(settings?.company_info?.brandColor)
  const customBrandColor = settings?.company_info?.customBrandColor
  const hasValidCustomBrand =
    settings?.company_info?.brandColor === 'custom' && isValidBrandHexColor(customBrandColor)
  const customBrandStyle =
    hasValidCustomBrand
      ? { '--brand-primary': customBrandColor } as React.CSSProperties
      : undefined

  // Report unsaved changes so the tabs page can warn before switching away.
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

  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [activeSection, setActiveSection] = useState('texts')
  const [previewOpen, setPreviewOpen] = useState(false)
  const focusValidationError = useRef(false)
  useEffect(() => {
    const firstError = Object.keys(errors)[0]
    if (focusValidationError.current && activeSection === 'texts' && firstError) {
      focusValidationError.current = false
      document.getElementById(firstError)?.focus()
    }
  }, [activeSection, errors])
  const [showHeroGuide, setShowHeroGuide] = useState(false)
  const [showButtonsGuide, setShowButtonsGuide] = useState(false)
  const [showBadgesGuide, setShowBadgesGuide] = useState(false)
  const [showStatsGuide, setShowStatsGuide] = useState(false)

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
    setHeroStatsDraft((s) => ({
      ...(s ?? heroStats),
      repairs: preset.stats.repairs,
      satisfaction: preset.stats.satisfaction,
      avgTime: preset.stats.avgTime,
    }))
    setErrors({})
    toast.success(`Plantilla "${preset.label}" aplicada`, {
      icon: <Check className="h-4 w-4 text-emerald-500" />,
      description: 'Podés personalizar cualquier campo antes de guardar.',
    })
  }

  const updateStat = <K extends keyof HeroStats>(field: K, value: HeroStats[K]) => {
    setHeroStatsDraft((s) => ({ ...(s ?? heroStats), [field]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasChanges) return

    const nextErrors: Record<string, string> = {}
    if (!heroContent.badge || heroContent.badge.trim().length < 3) {
      nextErrors.badge = 'La etiqueta debe tener al menos 3 caracteres.'
    }
    if (!heroContent.title || heroContent.title.trim().length < 10) {
      nextErrors.title = 'El título debe tener al menos 10 caracteres.'
    }
    if (!heroContent.subtitle || heroContent.subtitle.trim().length < 10) {
      nextErrors.subtitle = 'El subtítulo debe tener al menos 10 caracteres.'
    }
    if (Object.keys(nextErrors).length > 0) {
      focusValidationError.current = true
      setErrors(nextErrors)
      setActiveSection('texts')
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

    toast.success('Hero actualizado', { icon: <Check className="h-4 w-4" /> })
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

  return (
    <form onSubmit={handleSave} className="space-y-4 pb-6">
      <PublicVisibilityCard
        compact
        title="Portada principal"
        description="Es lo primero que ven tus clientes. Editá el contenido, revisá la vista previa y guardá para publicarlo."
        enabled={heroContent.enabled !== false}
        onToggle={(checked) => updateContent('enabled', checked)}
      />

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside aria-label="Vista previa de la portada" className="min-w-0 xl:sticky xl:top-4 xl:col-start-2 xl:row-start-1">
        <Button type="button" variant="outline" className="w-full justify-between xl:hidden" aria-expanded={previewOpen} aria-controls="hero-preview" onClick={() => setPreviewOpen((open) => !open)}>
          <span className="flex items-center gap-2"><Eye className="h-4 w-4" />{previewOpen ? 'Ocultar vista previa' : 'Ver vista previa'}</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', previewOpen && 'rotate-180')} />
        </Button>
      <div id="hero-preview" className={cn('mt-3 xl:mt-0 xl:block', !previewOpen && 'hidden')}>
      <Card className="relative gap-0 overflow-hidden py-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Eye className="h-3.5 w-3.5 text-primary" />
              Vista previa en vivo
            </span>

            {/* Selector de Dispositivo */}
            <div className="flex items-center rounded-lg border border-border/80 bg-background p-0.5 shadow-2xs">
              <button
                type="button"
                aria-pressed={previewDevice === 'desktop'}
                onClick={() => setPreviewDevice('desktop')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer',
                  previewDevice === 'desktop'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Escritorio</span>
              </button>
              <button
                type="button"
                aria-pressed={previewDevice === 'mobile'}
                onClick={() => setPreviewDevice('mobile')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer',
                  previewDevice === 'mobile'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Celular</span>
              </button>
            </div>
          </div>

          <span className={`text-xs font-bold flex items-center gap-1.5 ${heroContent.enabled !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            <span className={cn('h-2 w-2 rounded-full', heroContent.enabled !== false ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground')} />
            {heroContent.enabled !== false ? 'Visible en tu web' : 'Oculto al público'}
          </span>
        </div>

        {/* Contenedor del Preview */}
        <div className={cn(
          'transition-all duration-300',
          previewDevice === 'mobile' ? 'bg-muted/30 p-4 sm:p-6 flex justify-center' : ''
        )}>
          <div
            className={cn(
              'relative overflow-hidden transition-opacity',
              'border-b border-border/80 bg-gradient-to-b from-primary/[0.06] via-background to-background',
              heroContent.enabled !== false ? '' : 'opacity-45',
              previewDevice === 'mobile'
                ? 'w-full max-w-[390px] rounded-3xl border-4 border-slate-800 shadow-2xl p-5 text-center'
                : 'px-4 py-6'
            )}
            data-custom-brand={hasValidCustomBrand ? '' : undefined}
            style={customBrandStyle}
          >
            {/* Luces de ambiente sutiles */}
            <div className="pointer-events-none absolute -left-10 -top-10 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-1/4 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />

            <div className="mx-auto max-w-5xl relative">
              <div className={cn(
                'grid items-center gap-8',
                previewDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 gap-5'
              )}>
                {/* ── Columna Izquierda: Mensaje Comercial ── */}
                <div className={cn(
                  'flex flex-col',
                  previewDevice === 'mobile' ? 'items-center text-center' : 'items-start text-left'
                )}>
                  {/* Badges superiores */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary shadow-xs">
                      <Sparkles className="h-3.5 w-3.5" />
                      {heroContent.badge || 'Catálogo Oficial'}
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Abierto hoy
                    </span>
                  </div>

                  {/* Título Principal */}
                  <h2 className={cn(
                    'font-extrabold tracking-tight text-foreground',
                    previewDevice === 'mobile' ? 'text-xl leading-snug' : 'text-2xl leading-tight'
                  )}>
                    {heroContent.title || 'Los mejores productos al mejor precio'}
                  </h2>

                  {/* Subtítulo */}
                  <p className={cn(
                    'mt-3 text-muted-foreground leading-relaxed',
                    previewDevice === 'mobile' ? 'text-xs max-w-xs' : 'text-sm sm:text-base max-w-xl'
                  )}>
                    {heroContent.subtitle || 'Explorá nuestro catálogo con stock actualizado, promociones exclusivas y atención personalizada.'}
                  </p>

                  {/* Insignias de Confianza (Pills) */}
                  <div className={cn(
                    'mt-3.5 flex flex-wrap gap-1.5',
                    previewDevice === 'mobile' ? 'justify-center' : ''
                  )}>
                    {(heroContent.trustBadges || ['Garantía escrita', 'Repuestos originales', 'Técnicos certificados']).map((label, i) => (
                      <div key={i} className="rounded-full bg-muted border border-border/70 px-2.5 py-0.5 text-[11px] font-semibold text-foreground shadow-2xs">
                        ✓ {label}
                      </div>
                    ))}
                  </div>

                  {/* ── Buscador Simulado ── */}
                  <div className="mt-5 flex w-full max-w-md items-center gap-2 rounded-2xl border border-border/80 bg-card p-1.5 shadow-md">
                    <div className="relative flex-1 flex items-center pl-3">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="ml-2 text-xs text-muted-foreground truncate">
                        ¿Qué estás buscando hoy?...
                      </span>
                    </div>
                    <div className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs flex items-center gap-1">
                      <span>Buscar</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>

                  {/* CTAs Principales */}
                  <div className={cn(
                    'mt-4 flex flex-wrap items-center gap-2.5',
                    previewDevice === 'mobile' ? 'w-full flex-col items-stretch' : ''
                  )}>
                    <div className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-primary/90">
                      <ShoppingBag className="h-4 w-4" />
                      <span>{heroContent.ctaPrimaryText || 'Ver productos'}</span>
                    </div>

                    <div className="rounded-xl border border-border bg-card text-foreground px-4 py-2.5 text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-muted">
                      <MessageCircle className="h-4 w-4 text-emerald-600" />
                      <span>{heroContent.ctaSecondaryText || 'Escribinos'}</span>
                    </div>
                  </div>

                  {/* Track Repair */}
                  <div className="mt-3.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <Wrench className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="underline underline-offset-2">
                      {heroContent.trackRepairText || '¿Tenés una reparación? Rastreá tu equipo'}
                    </span>
                    <ArrowRight className="h-3 w-3 opacity-60" />
                  </div>
                </div>

                {/* ── Columna Derecha: Tarjeta Comercial Destacada ── */}
                <div className={cn(
                  'flex',
                  previewDevice === 'mobile' ? 'justify-center w-full mt-3' : 'justify-center w-full'
                )}>
                  <div className="w-full max-w-sm rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-xl space-y-4 text-left">

                    {/* Header: Logo + Nombre de la Tienda */}
                    <div className="flex items-center gap-3 pb-3 border-b border-border/60">
                      {settings?.company_info?.logoUrl ? (
                        <div className="relative h-11 max-w-[140px] shrink-0 overflow-hidden flex items-center justify-start">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={settings.company_info.logoUrl}
                            alt="Logo"
                            className="h-11 w-auto max-h-11 max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold text-xs shadow-xs">
                          {settings?.company_info?.name?.slice(0, 2).toUpperCase() || '4G'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold text-sm text-foreground">
                          {settings?.company_info?.name || 'Tienda Oficial'}
                        </h3>
                        <p className="truncate text-xs text-muted-foreground">
                          {settings?.company_info?.address || 'Ubicación y atención personalizada'}
                        </p>
                      </div>
                    </div>

                    {/* Estadísticas */}
                    {heroStats.enabled !== false && (
                      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/40 p-3 text-center border border-border/40">
                        <div>
                          <div className="text-sm sm:text-base font-extrabold text-foreground">{heroStats.repairs || '100%'}</div>
                          <div className="text-[9px] font-semibold text-muted-foreground mt-0.5">Reparaciones</div>
                        </div>
                        <div>
                          <div className="text-sm sm:text-base font-extrabold text-foreground">{heroStats.satisfaction || '4.9★'}</div>
                          <div className="text-[9px] font-semibold text-muted-foreground mt-0.5">Satisfacción</div>
                        </div>
                        <div>
                          <div className="text-sm sm:text-base font-extrabold text-foreground">{heroStats.avgTime || '24h'}</div>
                          <div className="text-[9px] font-semibold text-muted-foreground mt-0.5">Tiempo prom.</div>
                        </div>
                      </div>
                    )}

                    {/* Accesos Rápidos */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background p-2.5 text-xs font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Package className="h-3.5 w-3.5" />
                          </div>
                          <span>Ver catálogo completo</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/50 p-2.5 text-xs font-bold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-200 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <span>Ofertas y promociones</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-rose-500" />
                      </div>
                    </div>

                    {/* Horarios */}
                    <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground border-t border-border/60">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Horario:
                      </span>
                      <span className="font-semibold text-foreground">
                        {settings?.company_info?.hours?.weekdays || 'Lunes a Sábados'}
                      </span>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {heroContent.enabled === false && (
          <div className="absolute inset-x-0 bottom-0 top-12 z-20 flex items-center justify-center bg-background/50 p-6 backdrop-blur-[2px]">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 shadow-xl">
              <EyeOff className="h-6 w-6 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">Hero actualmente oculto</p>
                <p className="text-xs text-muted-foreground">La página principal comenzará con la siguiente sección activa.</p>
              </div>
            </div>
          </div>
        )}
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">Vista orientativa. Los cambios se publican únicamente al guardar.</p>
      </div>
      </aside>

      <Tabs value={activeSection} onValueChange={setActiveSection} className="min-w-0 xl:col-start-1 xl:row-start-1 [&_[data-slot=card]]:gap-0 [&_[data-slot=card]]:py-0 [&_[data-slot=card-header]]:p-4 [&_[data-slot=card-content]]:p-4">
        <TabsList aria-label="Editar portada" className="grid h-11 w-full grid-cols-3">
          <TabsTrigger value="texts">Textos</TabsTrigger>
          <TabsTrigger value="buttons">Botones</TabsTrigger>
          <TabsTrigger value="trust">Confianza</TabsTrigger>
        </TabsList>
      <TabsContent value="texts">
      <SectionCard icon={Sparkles} title="Presentá tu negocio" description="Una etiqueta breve, un título claro y una descripción de lo que ofrecés.">
        <div className="space-y-6">

          {/* ── Plantillas por Rubro ── */}
          <details className="rounded-xl border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Usar una plantilla</summary>
            <p className="my-3 text-xs text-muted-foreground">Elegí tu rubro para reemplazar los textos, botones, insignias y cifras del borrador. Revisá las cifras antes de guardar: son ejemplos, no datos reales de tu negocio.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {HERO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyHeroPreset(preset)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-border/80 bg-background/80 hover:bg-primary/10 hover:border-primary/40 transition-all text-center group cursor-pointer shadow-2xs"
                >
                  <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{preset.icon}</span>
                  <span className="text-xs font-bold text-foreground group-hover:text-primary leading-tight line-clamp-2">
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </details>

          {/* ── Guía Visual Desplegable ── */}
          <div className="border-b border-border/60 pb-4">
            <button
              type="button"
              onClick={() => setShowHeroGuide((prev) => !prev)}
              aria-expanded={showHeroGuide}
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
              <span>{showHeroGuide ? 'Ocultar guía de redacción' : '¿Cómo redactar un Hero que aumente tus ventas? (Guía y Tips)'}</span>
              {showHeroGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showHeroGuide && (
              <div className="mt-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs space-y-3 animate-in fade-in-50 duration-200">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      1. Badge Superior
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Debe ser breve (2 a 5 palabras). Resalta tu autoridad, temporada o beneficio principal (ej: <em>&quot;✨ Tienda Oficial&quot;</em> o <em>&quot;🚚 Envíos a todo el país&quot;</em>).
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-foreground flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-primary" />
                      2. Título Principal
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      La promesa central de tu negocio. Explicá qué vendés y por qué deben elegirte de forma clara y atractiva.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      3. Subtítulo & Garantías
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Detalla beneficios clave: medios de pago, tiempos de entrega, garantía escrita y atención directa.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Campo 1: Badge Superior ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="badge" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Etiqueta superior
              </Label>
              <span className="text-xs text-muted-foreground">{heroContent.badge.length}/100</span>
            </div>

            <Input
              id="badge"
              value={heroContent.badge}
              onChange={(e) => updateContent('badge', e.target.value)}
              placeholder="✨ Más de 10 años de experiencia"
              maxLength={100}
              aria-invalid={!!errors.badge}
              aria-describedby={errors.badge ? 'badge-error' : undefined}
              className="h-11"
            />
            {errors.badge && <p id="badge-error" role="alert" className="text-xs text-destructive">{errors.badge}</p>}

            {/* Sugerencias rápidas Badge */}
            <details className="pt-1">
              <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Ver ejemplos para aplicar</summary>
              <div className="flex flex-wrap gap-1.5">
                {BADGE_SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => updateContent('badge', sug)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer',
                      heroContent.badge === sug
                        ? 'border-primary bg-primary/10 font-bold text-primary'
                        : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* ── Campo 2: Título Principal ── */}
          <div className="space-y-2.5 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <Label htmlFor="title" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-primary" />
                Título principal
              </Label>
              <span className="text-xs text-muted-foreground">{heroContent.title.length}/150</span>
            </div>

            <Input
              id="title"
              value={heroContent.title}
              onChange={(e) => updateContent('title', e.target.value)}
              placeholder="Reparación de celulares rápida y confiable"
              maxLength={150}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'title-error' : undefined}
              className="h-11"
            />
            {errors.title && <p id="title-error" role="alert" className="text-xs text-destructive">{errors.title}</p>}

            {/* Sugerencias rápidas Título */}
            <details className="pt-1">
              <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Ver ejemplos para aplicar</summary>
              <div className="flex flex-wrap gap-1.5">
                {TITLE_SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => updateContent('title', sug)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors text-left cursor-pointer',
                      heroContent.title === sug
                        ? 'border-primary bg-primary/10 font-bold text-primary'
                        : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* ── Campo 3: Subtítulo ── */}
          <div className="space-y-2.5 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <Label htmlFor="subtitle" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Subtítulo
              </Label>
              <span className="text-xs text-muted-foreground">{heroContent.subtitle.length}/300</span>
            </div>

            <Textarea
              id="subtitle"
              value={heroContent.subtitle}
              onChange={(e) => updateContent('subtitle', e.target.value)}
              placeholder="Diagnóstico gratuito • Garantía de 6 meses • Técnicos certificados"
              rows={2}
              maxLength={300}
              aria-invalid={!!errors.subtitle}
              aria-describedby={errors.subtitle ? 'subtitle-error' : undefined}
              className="text-sm"
            />
            {errors.subtitle && <p id="subtitle-error" role="alert" className="text-xs text-destructive">{errors.subtitle}</p>}

            {/* Sugerencias rápidas Subtítulo */}
            <details className="pt-1">
              <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Ver ejemplos para aplicar</summary>
              <div className="flex flex-wrap gap-1.5">
                {SUBTITLE_SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => updateContent('subtitle', sug)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors text-left cursor-pointer',
                      heroContent.subtitle === sug
                        ? 'border-primary bg-primary/10 font-bold text-primary'
                        : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>

        </div>
      </SectionCard>
      </TabsContent>

      {/* Action Buttons & Links */}
      <TabsContent value="buttons">
      <SectionCard icon={TrendingUp} title="Acciones del visitante" description="Elegí textos cortos que indiquen qué puede hacer el cliente, por ejemplo: Ver productos.">
        <div className="space-y-6">

          {/* Guía Desplegable Botones */}
          <div className="border-b border-border/60 pb-3">
            <button
              type="button"
              onClick={() => setShowButtonsGuide((prev) => !prev)}
              aria-expanded={showButtonsGuide}
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
              <span>{showButtonsGuide ? 'Ocultar consejos de botones' : '¿Cómo elegir botones que conviertan visitas en compras?'}</span>
              {showButtonsGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showButtonsGuide && (
              <div className="mt-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs space-y-2.5 animate-in fade-in-50 duration-200">
                <p className="font-bold text-foreground">💡 Consejos para tus llamados a la acción (CTAs):</p>
                <ul className="space-y-1.5 text-muted-foreground list-disc list-inside leading-relaxed">
                  <li><strong className="text-foreground">Botón Principal:</strong> Dirige al catálogo o tienda online. Usá verbos de acción claros (ej: <em>&quot;Ver productos&quot;</em> o <em>&quot;Explorar catálogo&quot;</em>).</li>
                  <li><strong className="text-foreground">Botón Secundario:</strong> Abre la comunicación directa (WhatsApp / Contacto). Ideal para consultas de stock, fallas o presupuestos personalizados.</li>
                  <li><strong className="text-foreground">Enlace de Rastreo:</strong> Permite a clientes con órdenes de servicio o envíos consultar su estado en tiempo real con su código.</li>
                </ul>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Botón Principal */}
            <div className="space-y-2.5">
              <Label htmlFor="ctaPrimaryText" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-primary" />
                Botón principal (Catálogo / Tienda)
              </Label>
              <Input
                id="ctaPrimaryText"
                value={heroContent.ctaPrimaryText ?? 'Ver productos'}
                onChange={(e) => updateContent('ctaPrimaryText', e.target.value)}
                placeholder="Ej: Ver catálogo, Productos"
                maxLength={40}
                className="h-11"
              />
              {/* Sugerencias Botón Principal */}
              <details className="pt-1">
                <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Ver ejemplos para aplicar</summary>
                <div className="flex flex-wrap gap-1.5">
                  {CTA_PRIMARY_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateContent('ctaPrimaryText', sug)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer',
                        heroContent.ctaPrimaryText === sug
                          ? 'border-primary bg-primary/10 font-bold text-primary'
                          : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>

            {/* Botón Secundario */}
            <div className="space-y-2.5">
              <Label htmlFor="ctaSecondaryText" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                Botón secundario (Contacto / WhatsApp)
              </Label>
              <Input
                id="ctaSecondaryText"
                value={heroContent.ctaSecondaryText ?? 'Escribinos'}
                onChange={(e) => updateContent('ctaSecondaryText', e.target.value)}
                placeholder="Ej: Contáctanos, Escribinos"
                maxLength={40}
                className="h-11"
              />
              {/* Sugerencias Botón Secundario */}
              <details className="pt-1">
                <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Ver ejemplos para aplicar</summary>
                <div className="flex flex-wrap gap-1.5">
                  {CTA_SECONDARY_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateContent('ctaSecondaryText', sug)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer',
                        heroContent.ctaSecondaryText === sug
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                          : 'border-border/60 bg-background text-muted-foreground hover:border-emerald-400 hover:text-foreground'
                      )}
                    >
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>

            {/* Enlace de Rastreo */}
            <div className="space-y-2.5 md:col-span-2 pt-2 border-t border-border/40">
              <Label htmlFor="trackRepairText" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <ArrowRight className="h-4 w-4 text-primary" />
                Texto del enlace inferior (Rastreo / Seguimiento)
              </Label>
              <Input
                id="trackRepairText"
                value={heroContent.trackRepairText ?? '¿Tenés una reparación? Rastreá tu equipo'}
                onChange={(e) => updateContent('trackRepairText', e.target.value)}
                placeholder="Ej: ¿Tenés una reparación? Rastreá tu equipo"
                maxLength={100}
                className="h-11"
              />
              {/* Sugerencias Enlace de Rastreo */}
              <details className="pt-1">
                <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Ver ejemplos para aplicar</summary>
                <div className="flex flex-wrap gap-1.5">
                  {TRACK_REPAIR_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateContent('trackRepairText', sug)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer',
                        heroContent.trackRepairText === sug
                          ? 'border-primary bg-primary/10 font-bold text-primary'
                          : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>

        </div>
      </SectionCard>
      </TabsContent>

      {/* Trust Badges */}
      <TabsContent value="trust" className="space-y-4">
      <SectionCard icon={ShieldCheck} title="Insignias de Confianza" description="Sellos de garantía y beneficios que disipan dudas de los clientes">
        <div className="space-y-6">

          {/* Guía Desplegable Insignias */}
          <div className="border-b border-border/60 pb-3">
            <button
              type="button"
              onClick={() => setShowBadgesGuide((prev) => !prev)}
              aria-expanded={showBadgesGuide}
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
              <span>{showBadgesGuide ? 'Ocultar guía de insignias' : '¿Por qué las insignias de confianza aumentan tus ventas?'}</span>
              {showBadgesGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showBadgesGuide && (
              <div className="mt-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs space-y-2.5 animate-in fade-in-50 duration-200">
                <p className="font-bold text-foreground">🛡️ Impacto de las insignias de confianza:</p>
                <p className="text-muted-foreground leading-relaxed">
                  Los nuevos visitantes tardan menos de 3 segundos en decidir si confían en una tienda. Mostrar sellos como <strong>Garantía escrita</strong>, <strong>Envíos a todo el país</strong> o <strong>Repuestos originales</strong> reduce la fricción y aumenta la conversión hasta un 25%.
                </p>
              </div>
            )}
          </div>

          {/* 3 Slots de Insignias */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-foreground">Tus 3 Insignias de Portada</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((idx) => {
                const badges = heroContent.trustBadges || ['Garantía escrita', 'Repuestos originales', 'Técnicos certificados']
                return (
                  <div key={idx} className="space-y-1.5">
                    <Label htmlFor={`hero-trust-badge-${idx}`} className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Insignia {idx + 1}
                    </Label>
                    <Input
                      id={`hero-trust-badge-${idx}`}
                      value={badges[idx] || ''}
                      onChange={(e) => {
                        const newBadges = [...badges]
                        newBadges[idx] = e.target.value
                        updateContent('trustBadges', newBadges)
                      }}
                      placeholder={`Ej: Insignia ${idx + 1}`}
                      maxLength={30}
                      className="h-11 text-sm font-semibold"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Banco Categorizado de Insignias */}
          <details className="rounded-xl border bg-muted/20 p-3 space-y-3">
            <summary className="cursor-pointer text-xs font-medium text-primary">Ver ejemplos de insignias</summary>
            <p className="text-xs text-muted-foreground">Se agrega al primer espacio vacío. Si los tres están completos, reemplaza la primera insignia.</p>

            <div className="grid gap-4 sm:grid-cols-3">
              {TRUST_BADGE_CATEGORIES.map((cat, catIdx) => (
                <div key={catIdx} className="space-y-2">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>{cat.icon}</span>
                    <span>{cat.category}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.items.map((badgeSug, i) => {
                      const currentBadges = heroContent.trustBadges || ['Garantía escrita', 'Repuestos originales', 'Técnicos certificados']
                      const isSelected = currentBadges.includes(badgeSug)

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const newBadges = [...currentBadges]
                            const emptyIndex = newBadges.findIndex((b) => !b?.trim())
                            if (emptyIndex !== -1) {
                              newBadges[emptyIndex] = badgeSug
                            } else {
                              newBadges[0] = badgeSug
                            }
                            updateContent('trustBadges', newBadges)
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer',
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                              : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          )}
                        >
                          <Plus className="h-3 w-3 opacity-60" />
                          <span>{badgeSug}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>

        </div>
      </SectionCard>

      {/* Stats */}
      <SectionCard icon={TrendingUp} title="Estadísticas de Confianza" description="Métricas numéricas de impacto mostradas en la portada">
        <div className="space-y-6">

          <PublicVisibilityCard
            title="Visualización de Estadísticas"
            badgeLabel="Métricas de Confianza"
            description="Muestra los 3 contadores numéricos (Reparaciones/Clientes, Satisfacción y Tiempo promedio) en la portada."
            enabled={heroStats.enabled !== false}
            onToggle={(checked) => updateStat('enabled', checked)}
            compact
          />

          {heroStats.enabled !== false && (
            <>
              {/* Guía Desplegable Estadísticas */}
              <div className="border-b border-border/60 pb-3">
                <button
                  type="button"
                  onClick={() => setShowStatsGuide((prev) => !prev)}
                  aria-expanded={showStatsGuide}
                  className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>{showStatsGuide ? 'Ocultar guía de métricas' : '¿Qué números generan mayor impacto y credibilidad?'}</span>
                  {showStatsGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showStatsGuide && (
                  <div className="mt-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs space-y-2.5 animate-in fade-in-50 duration-200">
                    <p className="font-bold text-foreground">📊 Consejos para tus contadores:</p>
                    <ul className="space-y-1.5 text-muted-foreground list-disc list-inside leading-relaxed">
                      <li><strong className="text-foreground">Métrica 1 (Volumen o Trayectoria):</strong> Muestra experiencia acumulada (ej: <em>&quot;10K+&quot;</em>, <em>&quot;5.000+&quot;</em> o <em>&quot;10+ Años&quot;</em>).</li>
                      <li><strong className="text-foreground">Métrica 2 (Satisfacción):</strong> Transmite calidad garantizada (ej: <em>&quot;99%&quot;</em> o <em>&quot;4.9★&quot;</em>).</li>
                      <li><strong className="text-foreground">Métrica 3 (Velocidad o Garantía):</strong> Da certeza de entrega o soporte (ej: <em>&quot;24-48h&quot;</em>, <em>&quot;En el día&quot;</em> o <em>&quot;6 Meses&quot;</em>).</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {/* Métrica 1 */}
                <div className="space-y-2.5">
                  <Label htmlFor="repairs" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-primary" />
                    Métrica 1 (Volumen / Casos)
                  </Label>
                  <Input
                    id="repairs"
                    value={heroStats.repairs}
                    onChange={(e) => updateStat('repairs', e.target.value)}
                    placeholder="10K+"
                    maxLength={20}
                    className="h-11 font-extrabold text-base"
                  />
                  {/* Sugerencias Métrica 1 */}
                  <details className="pt-1">
                    <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Ver ejemplos para aplicar</summary>
                    <div className="flex flex-wrap gap-1">
                      {STAT_REPAIRS_SUGGESTIONS.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => updateStat('repairs', sug)}
                          className={cn(
                            'rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer',
                            heroStats.repairs === sug
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40'
                          )}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>

                {/* Métrica 2 */}
                <div className="space-y-2.5">
                  <Label htmlFor="satisfaction" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <ThumbsUp className="h-4 w-4 text-emerald-500" />
                    Métrica 2 (Satisfacción / Score)
                  </Label>
                  <Input
                    id="satisfaction"
                    value={heroStats.satisfaction}
                    onChange={(e) => updateStat('satisfaction', e.target.value)}
                    placeholder="98%"
                    maxLength={20}
                    className="h-11 font-extrabold text-base"
                  />
                  {/* Sugerencias Métrica 2 */}
                  <details className="pt-1">
                    <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Ver ejemplos para aplicar</summary>
                    <div className="flex flex-wrap gap-1">
                      {STAT_SATISFACTION_SUGGESTIONS.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => updateStat('satisfaction', sug)}
                          className={cn(
                            'rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer',
                            heroStats.satisfaction === sug
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                              : 'border-border/60 bg-background text-muted-foreground hover:border-emerald-400'
                          )}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>

                {/* Métrica 3 */}
                <div className="space-y-2.5">
                  <Label htmlFor="avgTime" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Métrica 3 (Velocidad / Tiempo)
                  </Label>
                  <Input
                    id="avgTime"
                    value={heroStats.avgTime}
                    onChange={(e) => updateStat('avgTime', e.target.value)}
                    placeholder="24-48h"
                    maxLength={20}
                    className="h-11 font-extrabold text-base"
                  />
                  {/* Sugerencias Métrica 3 */}
                  <details className="pt-1">
                    <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Ver ejemplos para aplicar</summary>
                    <div className="flex flex-wrap gap-1">
                      {STAT_AVG_TIME_SUGGESTIONS.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => updateStat('avgTime', sug)}
                          className={cn(
                            'rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer',
                            heroStats.avgTime === sug
                              ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                              : 'border-border/60 bg-background text-muted-foreground hover:border-amber-400'
                          )}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            </>
          )}

        </div>
      </SectionCard>

      </TabsContent>
      </Tabs>
      </div>
      {/* Save bar */}
      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
        <div className="hidden min-w-0 md:block">
          <p className="text-sm font-medium">{hasChanges ? 'Cambios pendientes' : 'Hero actualizado'}</p>
          <p className="text-xs text-muted-foreground">{heroContent.enabled !== false ? 'La sección se mostrará al guardar.' : 'La sección se ocultará al guardar.'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
        {hasChanges && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setHeroContentDraft(null)
              setHeroStatsDraft(null)
              setErrors({})
            }}
          >
            Descartar
          </Button>
        )}
        <Button type="submit" disabled={isSaving || !hasChanges}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar Hero
            </>
          )}
        </Button>
        </div>
      </div>
    </form>
  )
}
