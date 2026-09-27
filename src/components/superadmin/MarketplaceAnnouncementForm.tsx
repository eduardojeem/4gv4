'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays, Eye, Info,
  Link2,
  Loader2,
  Megaphone,
  Maximize2,
  RotateCcw,
  Save,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import { AnnouncementImagesField } from '@/components/announcements/AnnouncementImagesField'
import {
  isAnnouncementLive,
  announcementCtaKind,
  announcementDayStamp,
  announcementImages,
  type Announcement,
} from '@/lib/announcements/announcement'
import { cn } from '@/lib/utils'

interface MarketplaceAnnouncementFormProps {
  initial: Announcement
}

export function MarketplaceAnnouncementForm({ initial }: MarketplaceAnnouncementFormProps) {
  const [form, setForm] = useState<Announcement>(initial)
  const [savedBaseline, setSavedBaseline] = useState<Announcement>(initial)
  const [saving, setSaving] = useState(false)
  const [previewModalKey, setPreviewModalKey] = useState(0)

  const set = <K extends keyof Announcement>(field: K, value: Announcement[K]) =>
    setForm((current) => ({ ...current, [field]: value }))

  // Las imagenes se suben al mismo bucket que los assets de marca, que ya tiene
  // su listado y su borrado en el panel.
  const uploadAnnouncementImage = async (file: File) => {
    const body = new FormData()
    body.append('file', file)
    body.append('assetType', 'announcement')
    const res = await fetch('/api/superadmin/platform-branding/logo', { method: 'POST', body })
    const payload = await res.json().catch(() => null)
    if (!res.ok || !payload?.success || !payload.url) {
      throw new Error(payload?.error || 'No se pudo subir la imagen.')
    }
    return String(payload.url)
  }

  const previewImage = announcementImages(form)[0]?.url ?? ''

  // Comprobar si hay cambios sin guardar
  const isDirty = useMemo(() => {
    return (
      form.enabled !== savedBaseline.enabled ||
      form.title !== savedBaseline.title ||
      form.message !== savedBaseline.message ||
      form.imageUrl !== savedBaseline.imageUrl ||
      JSON.stringify(form.images) !== JSON.stringify(savedBaseline.images) ||
      form.ctaLabel !== savedBaseline.ctaLabel ||
      form.ctaHref !== savedBaseline.ctaHref ||
      form.startsAt !== savedBaseline.startsAt ||
      form.endsAt !== savedBaseline.endsAt
    )
  }, [form, savedBaseline])

  // Descartar cambios
  const handleDiscard = () => {
    setForm(savedBaseline)
    toast.info('Cambios descartados', {
      description: 'Se restauraron los valores guardados actualmente.',
    })
  }

  // Estado del aviso en tiempo real
  const now = useMemo(() => new Date(), [])
  const todayStamp = useMemo(() => announcementDayStamp(now), [now])
  void (isAnnouncementLive(form, now));

  const statusInfo = useMemo(() => {
    if (!form.enabled) {
      return {
        badgeVariant: 'secondary' as const,
        badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
        text: 'Desactivado',
        description: 'Nadie ve el aviso en el marketplace.',
        indicatorClass: 'bg-slate-500',
      }
    }
    if (!form.title.trim() || !form.message.trim()) {
      return {
        badgeVariant: 'outline' as const,
        badgeClass: 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30',
        text: 'Incompleto',
        description: 'Está activado pero falta título o mensaje.',
        indicatorClass: 'bg-amber-500 animate-pulse',
      }
    }
    if (form.startsAt && todayStamp < form.startsAt) {
      return {
        badgeVariant: 'outline' as const,
        badgeClass: 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/30',
        text: 'Programado',
        description: `Se activará el ${form.startsAt}.`,
        indicatorClass: 'bg-blue-500',
      }
    }
    if (form.endsAt && todayStamp > form.endsAt) {
      return {
        badgeVariant: 'outline' as const,
        badgeClass: 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30',
        text: 'Vencido',
        description: `Finalizó el ${form.endsAt}.`,
        indicatorClass: 'bg-rose-500',
      }
    }
    return {
      badgeVariant: 'default' as const,
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium',
      text: 'Activo y en vivo',
      description: 'Los visitantes lo ven actualmente al ingresar a /marketplace.',
      indicatorClass: 'bg-emerald-500 animate-ping',
    }
  }, [form.enabled, form.title, form.message, form.startsAt, form.endsAt, todayStamp])

  const ctaKind = form.ctaLabel.trim() ? announcementCtaKind(form.ctaHref) : 'none'

  // Presets rápidos para CTA
  const ctaPresets = [
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'Empresas', href: '/marketplace/empresas' },
    { label: 'Ofertas especiales', href: '/marketplace/ofertas' },
    { label: 'Precios SaaS', href: '/precios' },
  ]

  const save = async () => {
    // Validaciones preventivas de cliente
    if (form.enabled && (!form.title.trim() || !form.message.trim())) {
      toast.error('Faltan campos obligatorios', {
        description: 'Para activar el aviso necesitás definir al menos un título y un mensaje.',
      })
      return
    }

    if (form.ctaLabel.trim() && !form.ctaHref.trim()) {
      toast.error('Falta el enlace del botón', {
        description: 'Si agregás un texto de botón, debés indicar su enlace destino.',
      })
      return
    }

    if (form.ctaHref.trim() && ctaKind === 'none') {
      toast.error('Enlace no válido', {
        description: 'Usá una ruta interna que empiece con / o una URL http:// o https://.',
      })
      return
    }

    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) {
      toast.error('Rango de fechas inválido', {
        description: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/superadmin/marketplace-announcement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: form }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo guardar el aviso.')
      }
      const updated = payload.announcement as Announcement
      setForm(updated)
      setSavedBaseline(updated)
      toast.success('Aviso actualizado correctamente', {
        description: updated.enabled
          ? 'El aviso ya está listo y sincronizado en el marketplace.'
          : 'Se guardó correctamente (actualmente apagado).',
      })
    } catch (error) {
      toast.error('No se pudo guardar', {
        description: error instanceof Error ? error.message : 'Ocurrió un error. Intentá nuevamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header principal con navegación y acciones */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-5">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2.5 h-8 gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Link href="/superadmin/web-content">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span>Volver a Contenido Web</span>
            </Link>
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Megaphone className="h-5 w-5" />
              </div>
              Aviso del Marketplace
            </h1>
            <Badge
              variant={statusInfo.badgeVariant}
              className={cn('flex items-center gap-1.5 py-1 px-2.5 text-xs font-medium', statusInfo.badgeClass)}
            >
              <span className="relative flex h-2 w-2">
                {statusInfo.text === 'Activo y en vivo' && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', statusInfo.indicatorClass)} />
              </span>
              {statusInfo.text}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Configurá el cartel emergente que se muestra a los visitantes al ingresar a{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground font-semibold">/marketplace</code>.
            Cada usuario lo ve una vez al día; si lo editás, el identificador se renueva automáticamente.
          </p>
        </div>

        {/* Barra de estado y acciones fijas */}
        <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={saving}
              className="gap-1.5 text-muted-foreground hover:text-foreground border-border/70"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Descartar</span>
            </Button>
          )}

          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className={cn(
              "gap-2 px-4 shadow-sm transition-all",
              isDirty ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""
            )}
          >
            {saving ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="h-4 w-4" />
            )}
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* 2. Banner de aviso si hay cambios pendientes */}
      {isDirty && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-300 text-sm shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Tenés modificaciones sin guardar. Hacé clic en Guardar para aplicarlas a los visitantes.</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={save}
            disabled={saving}
            className="h-7 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-500/20"
          >
            Guardar ahora
          </Button>
        </div>
      )}

      {/* 3. Grid principal con Formulario y Mockup Preview Sticky */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Columna Izquierda: Formulario de Configuración (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Card 1: Visibilidad y Programación */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Estado y Visibilidad</CardTitle>
                    <CardDescription className="text-xs">
                      Activá o desactivá el aviso y definí el período de vigencia.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(checked) => set('enabled', checked)}
                    aria-label="Mostrar el aviso en el marketplace"
                    className="data-[state=checked]:bg-emerald-600"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">
                    {form.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 flex items-start gap-3">
                <div className={cn("mt-0.5 h-2.5 w-2.5 rounded-full shrink-0", statusInfo.indicatorClass)} />
                <div className="space-y-0.5 text-xs leading-relaxed">
                  <span className="font-semibold text-foreground">{statusInfo.text}:</span>{' '}
                  <span className="text-muted-foreground">{statusInfo.description}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Período de exhibición (Opcional)
                  </Label>
                  {(form.startsAt || form.endsAt) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        set('startsAt', '')
                        set('endsAt', '')
                      }}
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Limpiar fechas
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="announcement-starts" className="text-xs font-medium">
                      Mostrar desde
                    </Label>
                    <div className="relative">
                      <Input
                        id="announcement-starts"
                        type="date"
                        value={form.startsAt}
                        onChange={(event) => set('startsAt', event.target.value)}
                        className="text-xs bg-background/50"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Inicio del aviso (inclusive)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="announcement-ends" className="text-xs font-medium">
                      Mostrar hasta
                    </Label>
                    <div className="relative">
                      <Input
                        id="announcement-ends"
                        type="date"
                        value={form.endsAt}
                        min={form.startsAt || undefined}
                        onChange={(event) => set('endsAt', event.target.value)}
                        className="text-xs bg-background/50"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Último día que se exhibirá</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Contenido Principal */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Contenido del Cartel</CardTitle>
                  <CardDescription className="text-xs">
                    El texto principal que verán los usuarios al ingresar a la tienda global.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="announcement-title" className="text-xs font-medium">
                    Título principal <span className="text-rose-500">*</span>
                  </Label>
                  <span className={cn("text-[11px] font-mono", form.title.length > 100 ? "text-amber-500" : "text-muted-foreground")}>
                    {form.title.length}/120
                  </span>
                </div>
                <Input
                  id="announcement-title"
                  value={form.title}
                  maxLength={120}
                  onChange={(event) => set('title', event.target.value)}
                  placeholder="Ej: ¡Semana Cyber Deals en el Marketplace!"
                  className="bg-background/50 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="announcement-message" className="text-xs font-medium">
                    Mensaje o descripción <span className="text-rose-500">*</span>
                  </Label>
                  <span className={cn("text-[11px] font-mono", form.message.length > 500 ? "text-amber-500" : "text-muted-foreground")}>
                    {form.message.length}/600
                  </span>
                </div>
                <Textarea
                  id="announcement-message"
                  value={form.message}
                  maxLength={600}
                  rows={4}
                  onChange={(event) => set('message', event.target.value)}
                  placeholder="Explicá la promoción, el evento o la novedad importante para compradores y empresas..."
                  className="bg-background/50 leading-relaxed resize-y min-h-[96px]"
                />
                <p className="text-[11px] text-muted-foreground">
                  Podés usar saltos de línea para estructurar los párrafos de forma clara.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <AnnouncementImagesField
                  value={form.images}
                  onChange={(images) => set('images', images)}
                  upload={uploadAnnouncementImage}
                />
                <p className="text-[11px] text-muted-foreground">
                  Recomendamos aspecto panorámico (16:9 o 2:1) y buena resolución.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Botón de Acción (Call to Action) */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Link2 className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Botón de Acción (CTA)</CardTitle>
                  <CardDescription className="text-xs">
                    Dirigí el tráfico hacia una sección del marketplace o a un enlace externo.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="announcement-cta-label" className="text-xs font-medium">
                      Texto del botón
                    </Label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {form.ctaLabel.length}/60
                    </span>
                  </div>
                  <Input
                    id="announcement-cta-label"
                    value={form.ctaLabel}
                    maxLength={60}
                    onChange={(event) => set('ctaLabel', event.target.value)}
                    placeholder="Ej: Ver ofertas exclusivas"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="announcement-cta-href" className="text-xs font-medium flex items-center gap-1.5">
                      Enlace de destino
                      {ctaKind === 'internal' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          Interno
                        </Badge>
                      )}
                      {ctaKind === 'external' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 border-blue-500/20">
                          Externo
                        </Badge>
                      )}
                    </Label>
                  </div>
                  <Input
                    id="announcement-cta-href"
                    value={form.ctaHref}
                    maxLength={500}
                    onChange={(event) => set('ctaHref', event.target.value)}
                    placeholder="/marketplace/ofertas"
                    className="bg-background/50 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Accesos directos a rutas usuales */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-muted-foreground">Sugerencias rápidas de destino:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ctaPresets.map((preset) => (
                    <button
                      key={preset.href}
                      type="button"
                      onClick={() => {
                        set('ctaHref', preset.href)
                        if (!form.ctaLabel.trim()) {
                          set('ctaLabel', preset.label)
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                        form.ctaHref === preset.href
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <span>{preset.label}</span>
                      <code className="text-[10px] opacity-70">({preset.href})</code>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Sticky Live Interactive Preview (5 cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
          <Card className="border-border/60 shadow-md overflow-hidden bg-gradient-to-b from-card to-muted/20">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Previsualización en vivo</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewModalKey((k) => k + 1)}
                  disabled={!form.title.trim()}
                  className="h-7 text-xs gap-1.5 border-border/70"
                >
                  <Maximize2 className="h-3 w-3" />
                  Modal real
                </Button>
              </div>
              <CardDescription className="text-xs">
                Renderizado exacto de cómo verán el cartel los visitantes en pantalla.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              {/* Contenedor Mockup de la pantalla del Marketplace */}
              <div className="relative rounded-xl border border-border/80 bg-slate-950/80 p-3 sm:p-4 shadow-inner overflow-hidden">
                {/* Fondo simulado de tienda */}
                <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

                {/* Diálogo emergente simulado */}
                <div className="relative z-10 mx-auto w-full max-w-sm rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl overflow-hidden transition-all duration-300">
                  {/* Imagen de cabecera */}
                  {previewImage ? (
                    <div className="relative w-full h-36 bg-muted overflow-hidden border-b border-border/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewImage}
                        alt="Previsualización de cabecera"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // Fallback si la imagen no carga
                          (e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-2 bg-gradient-to-r from-primary/80 via-primary to-primary/60" />
                  )}

                  {/* Cuerpo del cartel */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-foreground leading-snug">
                        {form.title.trim() || (
                          <span className="text-muted-foreground/50 italic">Título del aviso...</span>
                        )}
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                        {form.message.trim() || (
                          <span className="text-muted-foreground/50 italic">El mensaje del anuncio aparecerá en este bloque de texto...</span>
                        )}
                      </p>
                    </div>

                    {/* Botones de acción */}
                    <div className="pt-2 flex flex-col gap-2">
                      {form.ctaLabel.trim() && (
                        <div className="w-full">
                          <Button
                            size="sm"
                            className="w-full gap-1.5 text-xs font-semibold shadow-sm pointer-events-none"
                          >
                            <span>{form.ctaLabel}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground pointer-events-none h-8"
                      >
                        Seguir mirando
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips y guía de ayuda contextual */}
              <div className="mt-4 rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  Comportamiento del aviso:
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Se almacena en el navegador de cada usuario con control diario.</li>
                  <li>Al hacer clic en <strong>Guardar cambios</strong> se genera una clave única que hace que todos los visitantes vuelvan a verlo.</li>
                  <li>Si desactivás el switch, el cartel deja de mostrarse de inmediato.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal real interactivo de prueba */}
      {previewModalKey > 0 && (
        <AnnouncementModal
          key={previewModalKey}
          scope={`preview-interactive-${previewModalKey}`}
          announcement={{
            ...form,
            enabled: true,
            startsAt: '',
            endsAt: '',
            updatedAt: `preview-${Date.now()}`,
          }}
        />
      )}
    </div>
  )
}
