'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Eye, EyeOff, Loader2, Save, ShoppingBag, Tag } from 'lucide-react'
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
      <details className="rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-medium">Ver vista previa de ofertas</summary>
      <Card className={cn('relative mt-3 overflow-hidden border shadow-sm transition-all', selectedAccent.preview, !current.enabled && 'opacity-60 grayscale')}>
        {/* Decorative elements to match public site */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-foreground/5 blur-3xl" />

        <div className="relative flex items-center justify-between border-b border-foreground/5 px-5 py-3 backdrop-blur-sm">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            Vista previa pública
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {current.enabled ? 'Visible' : 'Oculta'}
          </span>
        </div>
        <div className="relative p-6 sm:p-10">
          <span className="mb-4 flex w-max items-center gap-2 rounded-full border border-foreground/10 bg-background/50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur-md">
            <Tag className="h-3.5 w-3.5" />
            {current.eyebrow}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{current.title}</h2>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">{current.subtitle}</p>
        </div>
      </Card>
      </details>

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

          <div className="space-y-3">
            <Label className="font-semibold">Color del Acento</Label>
            <p className="text-xs text-muted-foreground">Define el matiz de los bordes y brillos de esta sección especial.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {ACCENTS.map((accent) => {
                const isSelected = current.accentColor === accent.value
                return (
                  <button
                    key={accent.value}
                    type="button"
                    onClick={() => patch('accentColor', accent.value)}
                    className={cn(
                      'group relative flex flex-col items-center justify-center rounded-2xl border p-4 transition-all hover:scale-105 active:scale-95',
                      isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm' : 'border-border/50 hover:border-foreground/30 bg-background'
                    )}
                  >
                    <span className={cn('h-8 w-8 rounded-full shadow-inner transition-transform group-hover:scale-110', accent.swatch)} />
                    <span className={cn('mt-3 text-[11px] font-bold uppercase tracking-wider', isSelected ? 'text-primary' : 'text-muted-foreground')}>
                      {accent.label}
                    </span>
                    {isSelected && (
                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-6 sm:p-8 sm:flex-row sm:items-center sm:justify-between transition-all hover:border-primary/40 hover:shadow-md">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-all group-hover:bg-primary/20" />
        <div className="relative">
          <p className="text-base font-bold">Productos en oferta activa</p>
          <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
            El sistema recopila automáticamente cualquier producto de tu catálogo que tenga configurado un &quot;precio de oferta&quot;. No necesitás añadirlos manualmente aquí.
          </p>
        </div>
        <Button asChild variant="default" className="relative shrink-0 rounded-full shadow-lg">
          <Link href="/dashboard/products">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Gestionar productos
          </Link>
        </Button>
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 md:sticky md:bottom-6 md:justify-end">
        {hasChanges && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDraft(null)}
            className="h-14 rounded-full px-6 shadow-2xl bg-background/80 backdrop-blur border md:h-12 md:rounded-xl md:px-4"
          >
            Descartar
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="lg" className="h-14 rounded-full px-8 shadow-2xl md:h-12 md:rounded-xl">
          {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Guardar ofertas
        </Button>
      </div>
    </div>
  )
}
