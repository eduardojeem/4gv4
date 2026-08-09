'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight,
  ArrowDown, ArrowUp, Check, Eye, EyeOff,
  GalleryHorizontalEnd, ImagePlus, Link2, Loader2,
  Monitor, MoonStar, Pencil, Plus, Save, SunMedium,
  Trash2, Type, Upload, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionCard } from '@/components/admin/website/SectionCard'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { PromotionalCarouselSettings, PromotionalCarouselSlide } from '@/types/website-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const MAX_SLIDES = 6
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

function CharCount({ value, max }: { value: string; max: number }) {
  const nearLimit = value.length >= max * 0.9
  return (
    <span className={cn('text-[11px] tabular-nums', nearLimit ? 'text-amber-600' : 'text-muted-foreground')}>
      {value.length}/{max}
    </span>
  )
}

const CAROUSEL_EXAMPLES: Array<{
  name: string
  slide: Omit<PromotionalCarouselSlide, 'id' | 'active'>
}> = [
  {
    name: 'Accesorios',
    slide: {
      title: 'Todo para acompañar tu celular',
      message: 'Descubrí cargadores, cables, auriculares y fundas seleccionadas.',
      imageUrl: '/images/promotional-carousel/accesorios.webp',
      imageAlt: 'Cargadores, cables, auriculares y fundas para celulares',
      ctaText: 'Ver accesorios',
      ctaHref: '/productos',
      textTone: 'dark',
      contentAlign: 'left',
    },
  },
  {
    name: 'Renovación',
    slide: {
      title: 'Encontrá tu próximo celular',
      message: 'Conocé los equipos disponibles y elegí el que mejor se adapta a vos.',
      imageUrl: '/images/promotional-carousel/renovacion.webp',
      imageAlt: 'Tres celulares modernos exhibidos en una tienda',
      ctaText: 'Ver celulares',
      ctaHref: '/productos',
      textTone: 'dark',
      contentAlign: 'right',
    },
  },
  {
    name: 'Servicio técnico',
    slide: {
      title: 'Tu equipo en manos expertas',
      message: 'Diagnóstico claro y reparación profesional para tu celular.',
      imageUrl: '/images/promotional-carousel/reparacion.webp',
      imageAlt: 'Técnico revisando un celular en una mesa de reparación',
      ctaText: 'Ver servicios',
      ctaHref: '/servicios',
      textTone: 'dark',
      contentAlign: 'left',
    },
  },
]

function newSlide(): PromotionalCarouselSlide {
  return {
    id: crypto.randomUUID(),
    title: '',
    message: '',
    imageUrl: '',
    imageAlt: '',
    ctaText: 'Ver productos',
    ctaHref: '/productos',
    active: true,
    textTone: 'light',
    contentAlign: 'left',
  }
}

// ── Slide Preview ────────────────────────────────────────────────────────────

function SlidePreview({ slide, uploading }: { slide: PromotionalCarouselSlide; uploading: boolean }) {
  const alignClass = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  }[slide.contentAlign]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Vista previa</span>
      </div>
      <div className="relative aspect-[16/8] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm">
        {slide.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageUrl} alt={slide.imageAlt || ''} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {uploading
              ? <Loader2 className="h-7 w-7 animate-spin" />
              : <Upload className="h-7 w-7 opacity-40" />}
            <span className="text-xs opacity-60">
              {uploading ? 'Subiendo imagen…' : 'Seleccioná o subí una imagen'}
            </span>
          </div>
        )}
        <div className={cn('absolute inset-0', slide.textTone === 'light' ? 'bg-black/45' : 'bg-white/55')} />
        <div className={cn('relative flex h-full flex-col justify-center px-8 py-6', alignClass, slide.textTone === 'light' ? 'text-white' : 'text-zinc-950')}>
          <p className="text-lg font-black leading-tight drop-shadow-sm sm:text-2xl">
            {slide.title || <span className="opacity-40 font-normal text-base">Título de la promoción</span>}
          </p>
          <p className="mt-2.5 text-xs font-medium opacity-90 sm:text-sm">
            {slide.message || <span className="opacity-40 font-normal">El mensaje se mostrará sobre la imagen.</span>}
          </p>
          {slide.ctaText && (
            <span className={cn('mt-4 w-fit rounded-lg px-3 py-1.5 text-[10px] font-bold shadow-sm sm:text-xs', slide.textTone === 'light' ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white')}>
              {slide.ctaText}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Form section wrapper ─────────────────────────────────────────────────────

function FormSection({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      {children}
    </div>
  )
}

// ── Image upload zone ────────────────────────────────────────────────────────

function ImageUploadZone({
  imageUrl,
  uploading,
  onFileSelect,
  onClear,
}: {
  imageUrl: string
  uploading: boolean
  onFileSelect: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFileSelect(file)
  }

  return (
    <div className="space-y-2">
      {imageUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="aspect-[16/7] w-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
            aria-label="Quitar imagen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/80 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? 'Subiendo…' : 'Cambiar imagen'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 text-center transition-colors',
            dragging
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border/70 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-primary/5',
            uploading && 'pointer-events-none opacity-60',
          )}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Upload className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{uploading ? 'Subiendo imagen…' : 'Subir imagen'}</p>
            <p className="text-xs text-muted-foreground">Arrastrá o hacé click · JPG, PNG, WebP — máx. 5 MB</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Recomendado: 1200 × 500 px o mayor</p>
          </div>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        disabled={uploading}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelect(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Segmented control ────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ElementType }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border/70 bg-muted/40 p-0.5">
      {options.map((opt) => {
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              value === opt.value
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function PromotionalCarouselEditor() {
  const { settings, isLoading, error, isSaving, updateSetting, refetch } = useAdminWebsiteSettings()
  const defaults = getWebsiteSettingsDefaults().promotional_carousel!
  const [draft, setDraft] = useState<PromotionalCarouselSettings | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSlide, setEditingSlide] = useState<PromotionalCarouselSlide | null>(null)
  const [uploading, setUploading] = useState(false)
  const current = draft ?? settings?.promotional_carousel ?? defaults
  const hasChanges = draft !== null
  const dirtyContext = useWebsiteEditorDirty()
  // Snapshot del slide tal como estaba al abrir el modal, para poder avisar
  // si se cierra (X, Cancelar, Escape o click afuera) con cambios sin
  // guardar — antes se perdían en silencio.
  const originalSlideRef = useRef<PromotionalCarouselSlide | null>(null)

  useEffect(() => {
    dirtyContext?.setDirty(hasChanges)
    return () => dirtyContext?.setDirty(false)
  }, [dirtyContext, hasChanges])

  const patch = <K extends keyof PromotionalCarouselSettings>(key: K, value: PromotionalCarouselSettings[K]) => {
    setDraft((previous) => ({ ...(previous ?? current), [key]: value }))
  }

  const openNewSlide = () => {
    if (current.slides.length >= MAX_SLIDES) {
      toast.error(`Podés publicar hasta ${MAX_SLIDES} diapositivas`)
      return
    }
    const slide = newSlide()
    originalSlideRef.current = slide
    setEditingSlide(slide)
    setDialogOpen(true)
  }

  const openSlide = (slide: PromotionalCarouselSlide) => {
    originalSlideRef.current = slide
    setEditingSlide({ ...slide })
    setDialogOpen(true)
  }

  const updateSlideField = <K extends keyof PromotionalCarouselSlide>(key: K, value: PromotionalCarouselSlide[K]) => {
    setEditingSlide((previous) => previous ? { ...previous, [key]: value } : previous)
  }

  const hasUnsavedSlideChanges = () => {
    if (!editingSlide || !originalSlideRef.current) return false
    return JSON.stringify(editingSlide) !== JSON.stringify(originalSlideRef.current)
  }

  // Punto único de cierre: X, "Cancelar", Escape y click afuera pasan todos
  // por acá, así ninguno queda sin el aviso de cambios sin guardar.
  const requestCloseDialog = () => {
    if (hasUnsavedSlideChanges() && !window.confirm('Tenés cambios sin guardar en esta diapositiva. ¿Descartarlos?')) {
      return
    }
    setDialogOpen(false)
    setEditingSlide(null)
    originalSlideRef.current = null
  }

  const applyTemplate = (example: (typeof CAROUSEL_EXAMPLES)[number]) => {
    const hasContent = Boolean(
      editingSlide?.title.trim() || editingSlide?.message.trim() || editingSlide?.imageUrl.trim()
    )
    if (hasContent && !window.confirm('Esto reemplaza el título, mensaje, imagen y demás campos por los de la plantilla. ¿Continuar?')) {
      return
    }
    setEditingSlide((previous) => previous ? { ...previous, ...example.slide } : previous)
  }

  const uploadImage = async (file: File) => {
    if (!editingSlide) return
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      toast.error('Usá una imagen JPG, PNG, WebP o AVIF')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('La imagen no puede superar 5 MB')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('slideId', editingSlide.id)
    setUploading(true)
    try {
      const response = await fetch('/api/admin/website/promotion-image', { method: 'POST', body: formData })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.url) throw new Error(body?.error || 'No se pudo subir la imagen')
      setEditingSlide((previous) => previous ? {
        ...previous,
        imageUrl: body.url,
        imageAlt: previous.imageAlt || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      } : previous)
      toast.success('Imagen cargada')
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  const saveSlide = () => {
    if (!editingSlide) return
    if (editingSlide.title.trim().length < 3 || editingSlide.message.trim().length < 3) {
      toast.error('Completá el título y el mensaje')
      return
    }
    if (!editingSlide.imageUrl || editingSlide.imageAlt.trim().length < 3) {
      toast.error('Subí una imagen y describila')
      return
    }
    if (Boolean(editingSlide.ctaText?.trim()) !== Boolean(editingSlide.ctaHref?.trim())) {
      toast.error('Completá el texto y el enlace del botón, o dejá ambos vacíos')
      return
    }
    const exists = current.slides.some((slide) => slide.id === editingSlide.id)
    patch('slides', exists
      ? current.slides.map((slide) => slide.id === editingSlide.id ? editingSlide : slide)
      : [...current.slides, editingSlide])
    setDialogOpen(false)
    setEditingSlide(null)
    originalSlideRef.current = null
  }

  const removeSlide = (id: string) => {
    if (!window.confirm('¿Eliminar esta diapositiva del carrusel?')) return
    patch('slides', current.slides.filter((slide) => slide.id !== id))
  }

  const moveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= current.slides.length) return
    const reordered = [...current.slides]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    patch('slides', reordered)
  }

  const toggleSlide = (id: string, active: boolean) => {
    patch('slides', current.slides.map((slide) => slide.id === id ? { ...slide, active } : slide))
  }

  const handleSave = async () => {
    if (!draft) return
    const result = await updateSetting('promotional_carousel', draft)
    if (!result.success) {
      toast.error(result.error || 'No se pudo guardar el carrusel')
      return
    }
    toast.success('Carrusel promocional actualizado', { icon: <Check className="h-4 w-4" /> })
    setDraft(null)
  }

  const isEditing = current.slides.some((slide) => slide.id === editingSlide?.id)

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-semibold text-destructive">No se pudo cargar el carrusel promocional</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void refetch()}>Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6 pb-24 md:pb-8">
      <SectionCard
        icon={GalleryHorizontalEnd}
        title="Carrusel de promociones"
        description="Publicá campañas con imágenes y mensajes propios en la página de inicio"
      >
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-3">
              <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md', current.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                {current.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-sm font-semibold">Mostrar carrusel en el inicio</p>
                <p className="mt-1 text-xs text-muted-foreground">Solo se publica cuando tiene al menos una diapositiva activa.</p>
              </div>
              <Switch className="ml-auto lg:ml-3" checked={current.enabled} onCheckedChange={(value) => patch('enabled', value)} aria-label="Mostrar carrusel" />
            </div>
            <Button type="button" onClick={openNewSlide} disabled={current.slides.length >= MAX_SLIDES}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva diapositiva
            </Button>
          </div>

          <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Reproducción automática</p>
                <p className="text-xs text-muted-foreground">Se pausa al interactuar y respeta movimiento reducido.</p>
              </div>
              <Switch checked={current.autoplay} onCheckedChange={(value) => patch('autoplay', value)} aria-label="Reproducción automática" />
            </div>
            <div className="space-y-2 rounded-lg border p-4">
              <Label htmlFor="carousel-interval">Tiempo por diapositiva</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="carousel-interval"
                  type="number"
                  min={5}
                  max={15}
                  value={current.intervalSeconds}
                  onChange={(event) => patch('intervalSeconds', Math.min(15, Math.max(5, Number(event.target.value) || 5)))}
                  className="w-24"
                  disabled={!current.autoplay}
                />
                <span className="text-sm text-muted-foreground">segundos</span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Slides list */}
      <section aria-labelledby="carousel-slides-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="carousel-slides-title" className="text-base font-semibold">Diapositivas</h2>
            <p className="text-xs text-muted-foreground">{current.slides.length} de {MAX_SLIDES} configuradas</p>
          </div>
        </div>

        {current.slides.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ImagePlus className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-semibold">Todavía no hay promociones visuales</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">Agregá una imagen horizontal, el mensaje y el enlace al producto o sección correspondiente.</p>
            <Button type="button" variant="outline" className="mt-5" onClick={openNewSlide}>
              <Plus className="mr-2 h-4 w-4" />Agregar primera diapositiva
            </Button>
          </div>
        ) : (
          <div className="divide-y rounded-xl border">
            {current.slides.map((slide, index) => (
              <div key={slide.id} className="grid gap-4 p-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center">
                <div className="relative aspect-[16/7] overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.imageUrl} alt={slide.imageAlt} className="h-full w-full object-cover" />
                  {!slide.active && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-semibold text-white">Oculta</span>}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{slide.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{slide.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{slide.ctaText || 'Sin botón'} · {slide.contentAlign === 'left' ? 'Izquierda' : slide.contentAlign === 'center' ? 'Centro' : 'Derecha'}</p>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Switch checked={slide.active} onCheckedChange={(value) => toggleSlide(slide.id, value)} aria-label={`Mostrar ${slide.title}`} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => moveSlide(index, -1)} disabled={index === 0} title="Subir"><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => moveSlide(index, 1)} disabled={index === current.slides.length - 1} title="Bajar"><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => openSlide(slide)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSlide(slide.id)} className="text-destructive hover:text-destructive" title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Save bar */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 md:sticky md:bottom-6 md:justify-end">
        {hasChanges && <Button type="button" variant="outline" onClick={() => setDraft(null)}>Descartar</Button>}
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !hasChanges} size="lg">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar carrusel
        </Button>
      </div>

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (open) setDialogOpen(true); else requestCloseDialog() }}>
        <DialogContent className="flex h-[96vh] w-[95vw] max-w-[1400px] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl">

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-muted/30 px-8 py-5">
            <div>
              <DialogTitle className="text-lg font-bold">
                {isEditing ? 'Editar diapositiva' : 'Nueva diapositiva'}
              </DialogTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Usá una imagen horizontal de al menos 1200 × 500 px para mantener buena calidad.
              </p>
            </div>
            <button
              type="button"
              onClick={requestCloseDialog}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {editingSlide && (
            <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_420px]">

              {/* Left: form */}
              <div className="h-full space-y-0 overflow-y-auto px-8 py-6">

                {/* Templates */}
                <FormSection icon={ImagePlus} label="Plantillas de ejemplo">
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {CAROUSEL_EXAMPLES.map((example) => (
                      <button
                        key={example.name}
                        type="button"
                        onClick={() => applyTemplate(example)}
                        aria-pressed={editingSlide.imageUrl === example.slide.imageUrl}
                        className={cn(
                          'group overflow-hidden rounded-xl border bg-background text-left transition-all hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          editingSlide.imageUrl === example.slide.imageUrl
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-border/70 hover:shadow-sm',
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={example.slide.imageUrl} alt="" className="aspect-[16/6] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-xs font-semibold">{example.name}</span>
                          {editingSlide.imageUrl === example.slide.imageUrl && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Elegí una plantilla y después personalizá el texto, enlace o imagen.</p>
                </FormSection>

                {/* Image */}
                <div className="border-t border-border/50 pt-7">
                <FormSection icon={Upload} label="Imagen promocional">
                  <ImageUploadZone
                    imageUrl={editingSlide.imageUrl}
                    uploading={uploading}
                    onFileSelect={(file) => void uploadImage(file)}
                    onClear={() => updateSlideField('imageUrl', '')}
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="promotion-alt" className="text-xs">Descripción de la imagen <span className="text-destructive">*</span></Label>
                      <CharCount value={editingSlide.imageAlt} max={160} />
                    </div>
                    <Input id="promotion-alt" value={editingSlide.imageAlt} onChange={(e) => updateSlideField('imageAlt', e.target.value)} maxLength={160} placeholder="Cargadores y cables incluidos en la promoción" className="text-sm" />
                    <p className="text-[11px] text-muted-foreground">Usada por lectores de pantalla y SEO.</p>
                  </div>
                </FormSection>
                </div>

                {/* Text */}
                <div className="border-t border-border/50 pt-7">
                <FormSection icon={Type} label="Contenido del texto">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="promotion-title" className="text-xs">Título <span className="text-destructive">*</span></Label>
                        <CharCount value={editingSlide.title} max={100} />
                      </div>
                      <Input id="promotion-title" value={editingSlide.title} onChange={(e) => updateSlideField('title', e.target.value)} maxLength={100} placeholder="Semana de accesorios" className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="promotion-message" className="text-xs">Mensaje <span className="text-destructive">*</span></Label>
                        <CharCount value={editingSlide.message} max={240} />
                      </div>
                      <Textarea id="promotion-message" value={editingSlide.message} onChange={(e) => updateSlideField('message', e.target.value)} maxLength={240} rows={4} placeholder="Aprovechá precios especiales por tiempo limitado." className="text-sm resize-none" />
                    </div>
                  </div>
                </FormSection>
                </div>

                {/* CTA */}
                <div className="border-t border-border/50 pt-7">
                <FormSection icon={Link2} label="Botón de acción (opcional)">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="promotion-cta" className="text-xs">Texto del botón</Label>
                        <CharCount value={editingSlide.ctaText || ''} max={50} />
                      </div>
                      <Input id="promotion-cta" value={editingSlide.ctaText || ''} onChange={(e) => updateSlideField('ctaText', e.target.value)} maxLength={50} placeholder="Ver productos" className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="promotion-href" className="text-xs">Enlace del botón</Label>
                        <CharCount value={editingSlide.ctaHref || ''} max={500} />
                      </div>
                      <Input id="promotion-href" value={editingSlide.ctaHref || ''} onChange={(e) => updateSlideField('ctaHref', e.target.value)} maxLength={500} placeholder="/productos" className="text-sm" />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Dejá ambos vacíos para no mostrar el botón.</p>
                </FormSection>
                </div>

                {/* Appearance */}
                <div className="border-t border-border/50 pt-7 pb-4">
                <FormSection icon={Monitor} label="Apariencia">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Alineación del texto</p>
                      <SegmentedControl
                        value={editingSlide.contentAlign}
                        onChange={(v) => updateSlideField('contentAlign', v)}
                        options={[
                          { value: 'left' as const, label: 'Izq.', icon: AlignLeft },
                          { value: 'center' as const, label: 'Centro', icon: AlignCenter },
                          { value: 'right' as const, label: 'Der.', icon: AlignRight },
                        ]}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Tono del texto</p>
                      <SegmentedControl
                        value={editingSlide.textTone}
                        onChange={(v) => updateSlideField('textTone', v)}
                        options={[
                          { value: 'light' as const, label: 'Claro', icon: SunMedium },
                          { value: 'dark' as const, label: 'Oscuro', icon: MoonStar },
                        ]}
                      />
                    </div>
                  </div>
                </FormSection>
                </div>
              </div>

              {/* Right: preview + publish */}
              <div className="flex h-full flex-col overflow-y-auto border-l border-border/60 bg-muted/20 px-6 py-6">
                <SlidePreview slide={editingSlide} uploading={uploading} />

                <div className="mt-5 space-y-3">

                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold">Publicar diapositiva</p>
                    <p className="text-xs text-muted-foreground">Visible en la tienda cuando está activa.</p>
                  </div>
                  <Switch id="promotion-active" checked={editingSlide.active} onCheckedChange={(value) => updateSlideField('active', value)} />
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-4 py-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consejos</p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-1.5"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Usá imágenes horizontales de al menos 1200 × 500 px.</li>
                    <li className="flex items-start gap-1.5"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Textos cortos y directos generan más clics.</li>
                    <li className="flex items-start gap-1.5"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Elegí tono claro para imágenes oscuras y viceversa.</li>
                  </ul>
                </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-border/70 bg-muted/20 px-8 py-5">
            <Button type="button" variant="ghost" size="lg" onClick={requestCloseDialog}>Cancelar</Button>
            <Button type="button" onClick={saveSlide} disabled={uploading} size="lg" className="gap-2 px-8">
              {uploading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Subiendo imagen…</>
                : <><Check className="h-4 w-4" />{isEditing ? 'Guardar cambios' : 'Agregar diapositiva'}</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
