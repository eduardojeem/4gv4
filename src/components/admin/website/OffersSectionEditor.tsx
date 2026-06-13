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
import { cn } from '@/lib/utils'

const ACCENTS: Array<{
  value: OffersSectionSettings['accentColor']
  label: string
  swatch: string
  preview: string
}> = [
  { value: 'rose', label: 'Rosa', swatch: 'bg-rose-500', preview: 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20' },
  { value: 'amber', label: 'Ambar', swatch: 'bg-amber-500', preview: 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20' },
  { value: 'orange', label: 'Naranja', swatch: 'bg-orange-500', preview: 'border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20' },
  { value: 'emerald', label: 'Esmeralda', swatch: 'bg-emerald-500', preview: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20' },
]

export function OffersSectionEditor() {
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
    <div className="max-w-4xl space-y-6 pb-24 md:pb-6">
      <Card className={cn('overflow-hidden border-2', selectedAccent.preview, !current.enabled && 'opacity-60')}>
        <div className="flex items-center justify-between border-b border-current/10 px-5 py-3">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <Eye className="h-3.5 w-3.5" />
            Vista previa
          </span>
          <span className="text-xs font-medium">{current.enabled ? 'Visible en la tienda' : 'Oculta'}</span>
        </div>
        <div className="p-6">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]">
            <Tag className="h-3.5 w-3.5" />
            {current.eyebrow}
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">{current.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{current.subtitle}</p>
        </div>
      </Card>

      <SectionCard
        icon={ShoppingBag}
        title="Visibilidad y contenido"
        description="Controla como aparece la seccion de ofertas en la portada publica"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              {current.enabled ? <Eye className="h-5 w-5 text-emerald-600" /> : <EyeOff className="h-5 w-5 text-muted-foreground" />}
              <div>
                <p className="text-sm font-semibold">Mostrar seccion de ofertas</p>
                <p className="text-xs text-muted-foreground">Al desactivarla, desaparece de la portada publica.</p>
              </div>
            </div>
            <Switch checked={current.enabled} onCheckedChange={(value) => patch('enabled', value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <Label>Color diferenciado</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ACCENTS.map((accent) => (
                <button
                  key={accent.value}
                  type="button"
                  onClick={() => patch('accentColor', accent.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-colors',
                    current.accentColor === accent.value ? 'border-foreground bg-muted' : 'hover:bg-muted/50'
                  )}
                >
                  <span className={cn('h-4 w-4 rounded-full', accent.swatch)} />
                  {accent.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Productos que aparecen como ofertas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            La seccion se completa automaticamente con productos que tengan precio de oferta activo.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/dashboard/products">Administrar productos</Link>
        </Button>
      </div>

      <div className="fixed bottom-6 right-6 z-50 md:sticky md:bottom-6 md:flex md:justify-end">
        <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="lg" className="h-14 rounded-full px-8 shadow-2xl md:h-12 md:rounded-xl">
          {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Guardar ofertas
        </Button>
      </div>
    </div>
  )
}
