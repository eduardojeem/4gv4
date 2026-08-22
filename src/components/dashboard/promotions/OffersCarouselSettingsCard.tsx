'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, GalleryHorizontalEnd, Loader2, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { OffersCarouselSettings } from '@/types/website-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const INTERVAL_MIN = 2
const INTERVAL_MAX = 30
const MAX_ITEMS_MIN = 3
const MAX_ITEMS_MAX = 20

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * Administra el carrusel de la página pública de ofertas desde el dashboard de
 * promociones. Persiste en website_settings/offers_section, la misma clave que
 * usa el editor de /admin/website — por eso guarda la sección completa y sólo
 * reemplaza la rama `carousel`.
 */
export function OffersCarouselSettingsCard() {
  const { settings, isLoading, error, isSaving, updateSetting, refetch } = useAdminWebsiteSettings()
  const defaults = getWebsiteSettingsDefaults().offers_section.carousel
  const [draft, setDraft] = useState<OffersCarouselSettings | null>(null)

  // Sin draft el formulario lee directamente lo guardado, así que una
  // revalidación del servidor se refleja sola sin pisar una edición en curso.
  const saved = settings?.offers_section?.carousel ?? defaults
  const current = draft ?? saved
  const hasChanges = draft !== null

  const patch = <K extends keyof OffersCarouselSettings>(key: K, value: OffersCarouselSettings[K]) => {
    setDraft((previous) => ({ ...(previous ?? current), [key]: value }))
  }

  const persist = async (value: OffersCarouselSettings, successMessage: string) => {
    if (!settings) return false

    const normalized: OffersCarouselSettings = {
      ...value,
      title: value.title.trim() || defaults.title,
      subtitle: value.subtitle.trim(),
      intervalSeconds: clamp(value.intervalSeconds, INTERVAL_MIN, INTERVAL_MAX, defaults.intervalSeconds),
      maxItems: clamp(value.maxItems, MAX_ITEMS_MIN, MAX_ITEMS_MAX, defaults.maxItems),
    }

    const result = await updateSetting('offers_section', {
      ...settings.offers_section,
      carousel: normalized,
    })

    if (!result.success) {
      toast.error(result.error || 'No se pudo guardar el carrusel de ofertas')
      return false
    }

    toast.success(successMessage, { icon: <Check className="h-4 w-4" /> })
    setDraft(null)
    return true
  }

  const handleSave = async () => {
    if (!draft) return
    await persist(draft, 'Carrusel de ofertas actualizado')
  }

  /**
   * El switch del encabezado guarda solo, porque prender o apagar el carrusel
   * es una acción de un clic. Si hay una edición sin guardar en el panel, en
   * cambio, sólo actualiza el borrador: guardar a medias sería peor.
   */
  const handleToggleEnabled = async (value: boolean) => {
    if (hasChanges) {
      patch('enabled', value)
      return
    }
    await persist(
      { ...saved, enabled: value },
      value ? 'Carrusel activado' : 'Carrusel desactivado'
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando configuración del carrusel...</p>
        </CardContent>
      </Card>
    )
  }

  // El endpoint exige rol admin/owner. Un usuario con permisos de promociones
  // pero sin ese rol no puede editar esto: se lo decimos en vez de mostrar un error.
  if (error) {
    const isForbidden = /403|forbidden|permiso|unauthorized|401/i.test(error)
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <GalleryHorizontalEnd className="mt-0.5 h-4.5 w-4.5 shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Carrusel de la página de ofertas
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isForbidden
                  ? 'Necesitás rol de administrador para editar la configuración del sitio público.'
                  : error}
              </p>
            </div>
          </div>
          {!isForbidden && (
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden transition-opacity', !current.enabled && 'opacity-75')}>
      {/* Encabezado siempre visible: el on/off no queda escondido tras el colapsable. */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-2.5">
          <GalleryHorizontalEnd className="mt-0.5 h-4.5 w-4.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-md font-bold text-slate-900 dark:text-slate-100">
                Carrusel de la página de ofertas
              </span>
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px]',
                  current.enabled
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {current.enabled ? 'Visible' : 'Oculto'}
              </Badge>
              {hasChanges && (
                <Badge variant="secondary" className="bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  Sin guardar
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {current.enabled
                ? `Hasta ${current.maxItems} ofertas · ${current.autoplay ? `rota cada ${current.intervalSeconds}s` : 'sin rotación automática'}`
                : 'La banda destacada no se muestra en /ofertas'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor="carousel-enabled" className="hidden text-xs font-medium text-muted-foreground sm:inline">
            {current.enabled ? 'Activado' : 'Desactivado'}
          </Label>
          {isSaving && !hasChanges && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Switch
            id="carousel-enabled"
            checked={current.enabled}
            disabled={isSaving}
            onCheckedChange={handleToggleEnabled}
            aria-label="Activar o desactivar el carrusel de ofertas"
          />
        </div>
      </div>

      <details className="group border-t" open={hasChanges}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-xs font-semibold text-indigo-600 [&::-webkit-details-marker]:hidden dark:text-indigo-400">
          <span>Opciones del carrusel</span>
          <span>
            <span className="group-open:hidden">Configurar ↓</span>
            <span className="hidden group-open:inline">Ocultar ↑</span>
          </span>
        </summary>

        <CardContent className="space-y-5 border-t pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="carousel-title" className="text-xs font-medium">Título de la banda</Label>
              <Input
                id="carousel-title"
                value={current.title}
                maxLength={120}
                onChange={(event) => patch('title', event.target.value)}
                placeholder={defaults.title}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="carousel-subtitle" className="text-xs font-medium">
                Bajada <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="carousel-subtitle"
                value={current.subtitle}
                maxLength={240}
                rows={2}
                onChange={(event) => patch('subtitle', event.target.value)}
                placeholder={defaults.subtitle}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="carousel-max-items" className="text-xs font-medium">
                Ofertas en el carrusel
              </Label>
              <Input
                id="carousel-max-items"
                type="number"
                inputMode="numeric"
                min={MAX_ITEMS_MIN}
                max={MAX_ITEMS_MAX}
                value={current.maxItems}
                onChange={(event) => patch('maxItems', Number(event.target.value))}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">Entre {MAX_ITEMS_MIN} y {MAX_ITEMS_MAX}.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="carousel-interval" className="text-xs font-medium">
                Segundos por slide
              </Label>
              <Input
                id="carousel-interval"
                type="number"
                inputMode="numeric"
                min={INTERVAL_MIN}
                max={INTERVAL_MAX}
                disabled={!current.autoplay}
                value={current.intervalSeconds}
                onChange={(event) => patch('intervalSeconds', Number(event.target.value))}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                {current.autoplay ? `Entre ${INTERVAL_MIN} y ${INTERVAL_MAX}.` : 'Requiere rotación automática.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3">
            <div>
              <Label htmlFor="carousel-autoplay" className="text-sm font-semibold">Rotación automática</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Se pausa sola al pasar el mouse y si el visitante prefiere menos movimiento.
              </p>
            </div>
            <Switch
              id="carousel-autoplay"
              checked={current.autoplay}
              onCheckedChange={(value) => patch('autoplay', value)}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            La cantidad de slides y el ritmo también aplican al carrusel del inicio público. Los textos
            de la sección y el color de acento se editan en{' '}
            <Link href="/admin/website" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Sitio web <ExternalLink className="h-3 w-3" />
            </Link>
            .
          </p>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraft(null)}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </details>
    </Card>
  )
}
