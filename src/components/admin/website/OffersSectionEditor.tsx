'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Check, Eye, EyeOff, Loader2, Save, ShoppingBag, Sparkles, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionCard } from '@/components/admin/website/SectionCard'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { OffersSectionSettings } from '@/types/website-settings'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PublicVisibilityCard } from '@/components/admin/website/PublicVisibilityCard'
import { cn } from '@/lib/utils'

const ACCENTS: Array<{
  value: OffersSectionSettings['accentColor']
  label: string
  swatch: string
  preview: string
}> = [
  { value: 'brand', label: 'Color de marca', swatch: 'bg-primary', preview: 'bg-gradient-to-br from-primary/15 via-background to-background border-primary/30' },
  { value: 'rose', label: 'Rosa', swatch: 'bg-gradient-to-br from-rose-400 to-rose-600', preview: 'bg-gradient-to-br from-rose-500/15 via-background to-background border-rose-200/50 dark:border-rose-900/30' },
  { value: 'amber', label: 'Ámbar', swatch: 'bg-gradient-to-br from-amber-400 to-amber-600', preview: 'bg-gradient-to-br from-amber-500/15 via-background to-background border-amber-200/50 dark:border-amber-900/30' },
  { value: 'orange', label: 'Naranja', swatch: 'bg-gradient-to-br from-orange-400 to-orange-600', preview: 'bg-gradient-to-br from-orange-500/15 via-background to-background border-orange-200/50 dark:border-orange-900/30' },
  { value: 'emerald', label: 'Esmeralda', swatch: 'bg-gradient-to-br from-emerald-400 to-emerald-600', preview: 'bg-gradient-to-br from-emerald-500/15 via-background to-background border-emerald-200/50 dark:border-emerald-900/30' },
  { value: 'blue', label: 'Azul', swatch: 'bg-gradient-to-br from-blue-400 to-blue-600', preview: 'bg-gradient-to-br from-blue-500/15 via-background to-background border-blue-200/50 dark:border-blue-900/30' },
  { value: 'sky', label: 'Celeste', swatch: 'bg-gradient-to-br from-sky-400 to-sky-600', preview: 'bg-gradient-to-br from-sky-500/15 via-background to-background border-sky-200/50 dark:border-sky-900/30' },
  { value: 'violet', label: 'Violeta', swatch: 'bg-gradient-to-br from-violet-400 to-violet-600', preview: 'bg-gradient-to-br from-violet-500/15 via-background to-background border-violet-200/50 dark:border-violet-900/30' },
  { value: 'fuchsia', label: 'Fucsia', swatch: 'bg-gradient-to-br from-fuchsia-400 to-fuchsia-600', preview: 'bg-gradient-to-br from-fuchsia-500/15 via-background to-background border-fuchsia-200/50 dark:border-fuchsia-900/30' },
  { value: 'red', label: 'Rojo', swatch: 'bg-gradient-to-br from-red-400 to-red-600', preview: 'bg-gradient-to-br from-red-500/15 via-background to-background border-red-200/50 dark:border-red-900/30' },
  { value: 'teal', label: 'Turquesa', swatch: 'bg-gradient-to-br from-teal-400 to-teal-600', preview: 'bg-gradient-to-br from-teal-500/15 via-background to-background border-teal-200/50 dark:border-teal-900/30' },
]

interface OffersSectionEditorProps {
  /**
   * Reemplaza el ancho y el padding de pagina del contenedor. En
   * /admin/website este editor ocupa la pagina entera; embebido en
   * Promociones tiene que seguir el ancho de las demas tarjetas.
   */
  className?: string
}

export function OffersSectionEditor({ className }: OffersSectionEditorProps = {}) {
  const pathname = usePathname()
  const isInsidePromotions = Boolean(pathname?.includes('/dashboard/promotions'))
  const { settings, isLoading, error, isSaving, updateSetting, refetch } = useAdminWebsiteSettings()
  const defaults = getWebsiteSettingsDefaults().offers_section
  const [draft, setDraft] = useState<OffersSectionSettings | null>(null)
  const current = draft ?? settings?.offers_section ?? defaults
  const hasChanges = draft !== null
  const dirtyCtx = useWebsiteEditorDirty()

  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  const patch = <K extends keyof OffersSectionSettings>(key: K, value: OffersSectionSettings[K]) => {
    setDraft((previous) => ({ ...(previous ?? current), [key]: value }))
  }

  const handleSave = async () => {
    if (!draft) return
    const result = await updateSetting('offers_section', draft)
    if (!result.success) {
      toast.error(result.error || 'No se pudo guardar la seccion de ofertas')
      return
    }
    toast.success('Seccion de ofertas actualizada', { icon: <Check className="h-4 w-4" /> })
    setDraft(null)
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-semibold text-destructive">No se pudo cargar la configuración de ofertas</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const selectedAccent = ACCENTS.find((accent) => accent.value === current.accentColor) ?? ACCENTS[0]

  return (
    <div className={cn('space-y-8 md:space-y-10', className ?? 'max-w-4xl pb-24 md:pb-8')}>
      {/* Aviso destacado para ir a la personalización completa en Promociones */}
      {!isInsidePromotions && (
        <div className="group relative overflow-hidden rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5 sm:p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/15 blur-3xl transition-all group-hover:bg-primary/20" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Personalización Avanzada de Ofertas</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                ¿Querés diseñar banners y carruseles publicitarios para tus ofertas?
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Podés crear diapositivas con imágenes, mensajes y botones exclusivos para <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono text-xs">/ofertas</code>, activar carrusel automático de rebajados y configurar cupones desde la sección de <strong>Promociones</strong>.
              </p>
            </div>
            <div className="shrink-0 flex flex-col gap-2">
              <Button asChild size="default" className="rounded-xl font-bold gap-2 shadow-md hover:scale-[1.02] transition-transform">
                <Link href="/dashboard/promotions?tab=publica">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Ir a Promociones</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3.5 w-3.5 text-primary" />
            Vista previa del encabezado en vivo
          </span>
          <span className={cn(
            "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full",
            current.enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-muted text-muted-foreground border"
          )}>
            {current.enabled ? 'Visible' : 'Oculta'}
          </span>
        </div>
        <Card className={cn('relative overflow-hidden border shadow-sm transition-all', selectedAccent.preview, !current.enabled && 'opacity-60 grayscale')}>
          {/* Decorative elements to match public site */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-foreground/5 blur-3xl" />

          <div className="relative p-6 sm:p-8">
            <span className="mb-3 flex w-max items-center gap-2 rounded-full border border-foreground/10 bg-background/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur-md">
              <Tag className="h-3 w-3" />
              {current.eyebrow || 'Ofertas'}
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
              {current.title || 'Precios especiales'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base leading-relaxed">
              {current.subtitle || 'Descubrí todos los productos en promoción y ahorrá en tu compra.'}
            </p>
          </div>
        </Card>
      </div>

      <SectionCard
        icon={ShoppingBag}
        title="Visibilidad y contenido"
        description="Controla como aparece la seccion de ofertas en la portada y en su pagina publica"
      >
        <div className="space-y-8">
          <PublicVisibilityCard
            compact
            title="Visualización de Sección de Ofertas"
            badgeLabel="Rebajas del Catálogo"
            description="Controla si este bloque de productos en oferta se muestra en la página de inicio y en la ruta /ofertas."
            enabled={current.enabled}
            onToggle={(value) => patch('enabled', value)}
          />

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offers-eyebrow">Etiqueta superior</Label>
              <Input id="offers-eyebrow" value={current.eyebrow} onChange={(event) => patch('eyebrow', event.target.value)} maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offers-title">Titulo</Label>
              <Input id="offers-title" value={current.title} onChange={(event) => patch('title', event.target.value)} maxLength={120} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offers-subtitle">Descripcion</Label>
            <Textarea id="offers-subtitle" value={current.subtitle} onChange={(event) => patch('subtitle', event.target.value)} rows={3} maxLength={240} />
          </div>

          {/* Selector de color compacto y elegante */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className="text-xs sm:text-sm font-semibold">Color del Acento</Label>
                <p className="text-xs text-muted-foreground">Define el matiz de los bordes, brillos y destaques en /ofertas.</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-xs">
                <span className={cn('h-3.5 w-3.5 rounded-full shadow-xs', (ACCENTS.find(a => a.value === current.accentColor) ?? ACCENTS[0]).swatch)} />
                <span className="font-semibold text-foreground capitalize">{(ACCENTS.find(a => a.value === current.accentColor) ?? ACCENTS[0]).label}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
              {ACCENTS.map((accent) => {
                const isSelected = current.accentColor === accent.value
                return (
                  <button
                    key={accent.value}
                    type="button"
                    title={accent.label}
                    onClick={() => patch('accentColor', accent.value)}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all active:scale-95',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/20 shadow-2xs'
                        : 'border-border/60 bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className={cn('h-3.5 w-3.5 rounded-full shadow-inner transition-transform group-hover:scale-110 shrink-0', accent.swatch)} />
                    <span className="capitalize">{accent.label}</span>
                    {isSelected && <span className="text-[11px] font-bold ml-0.5">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Explicación de cómo se nutre la sección de ofertas */}
      {isInsidePromotions ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">
                ¿Cómo aparecen los productos con precios de rebaja?
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tu tienda recopila automáticamente cualquier producto de tu inventario que tenga un precio de oferta activo o que califique para tus reglas de descuento.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="w-fit shrink-0 rounded-xl text-xs font-semibold h-8">
            <Link href="/dashboard/products">
              <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
              <span>Ver productos</span>
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Tarjeta 1: Productos con precio de oferta */}
          <div className="group relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs transition-all hover:border-border hover:shadow-sm">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span>Precios de rebaja</span>
              </div>
              <p className="text-sm font-bold text-foreground">Productos en oferta activa</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                El catálogo recopila automáticamente cualquier producto que tenga configurado un &quot;precio de oferta&quot;.
              </p>
            </div>
            <Button asChild variant="outline" className="w-fit rounded-xl text-xs font-semibold">
              <Link href="/dashboard/products">
                <ShoppingBag className="mr-2 h-3.5 w-3.5" />
                Gestionar productos
              </Link>
            </Button>
          </div>

          {/* Tarjeta 2: Campañas y promociones avanzadas (solo fuera de Promociones) */}
          <div className="group relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-background to-background p-5 sm:p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Campañas & Banners</span>
              </div>
              <p className="text-sm font-bold text-foreground">Personalización en Promociones</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Diseñá banners con imágenes propias, activá el carrusel de productos rebajados y creá cupones de descuento.
              </p>
            </div>
            <Button asChild className="w-fit rounded-xl text-xs font-bold gap-1.5 shadow-sm">
              <Link href="/dashboard/promotions?tab=publica">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Ir a sección de Promociones</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div className="sticky bottom-4 z-30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border bg-background/95 p-3 sm:p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full shrink-0',
              hasChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            )}
            aria-hidden="true"
          />
          <span className="font-semibold text-foreground">
            {hasChanges ? 'Hay cambios en ofertas sin guardar' : 'Configuración de ofertas al día'}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(null)}
              className="h-10 px-4 rounded-xl text-xs font-semibold flex-1 sm:flex-none"
            >
              Descartar
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="h-10 px-5 rounded-xl text-xs font-bold gap-2 flex-1 sm:flex-none"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Guardar ofertas</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
