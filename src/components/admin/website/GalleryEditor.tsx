'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { WebsiteMediaQuotaBanner } from '@/components/admin/website/WebsiteMediaQuotaBanner'
import { WebsiteMediaLibraryDialog } from '@/components/admin/website/WebsiteMediaLibraryDialog'
import { useWebsiteMediaQuota } from '@/hooks/useWebsiteMediaQuota'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { MAX_GALLERY_IMAGES } from '@/lib/validation/website-settings'
import type { GallerySectionSettings } from '@/types/website-settings'

const newId = () => `foto-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * Galería de trabajos: fotos de cortes, color o peinados que se muestran en
 * el inicio de la plantilla «Servicios». Las fotos cuentan para el límite de
 * imágenes del sitio.
 */
export function GalleryEditor() {
  const { settings, isLoading, updateSetting } = useAdminWebsiteSettings()
  const { isAtLimit } = useWebsiteMediaQuota()
  const saved = settings?.gallery_section ?? getWebsiteSettingsDefaults().gallery_section!
  const [draft, setDraft] = useState<GallerySectionSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const value = draft ?? saved

  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(draft !== null)
    return () => dirtyCtx?.setDirty(false)
  }, [draft, dirtyCtx])

  const change = (patch: Partial<GallerySectionSettings>) => setDraft((current) => ({ ...(current ?? saved), ...patch }))
  const setImages = (update: (images: GallerySectionSettings['images']) => GallerySectionSettings['images']) =>
    setDraft((current) => {
      const base = current ?? saved
      return { ...base, images: update(base.images) }
    })

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_GALLERY_IMAGES - value.images.length
    const list = Array.from(files).slice(0, room)
    if (files.length > room) toast.warning(`La galería admite ${MAX_GALLERY_IMAGES} fotos: se suben ${room}.`)
    if (isAtLimit) {
      toast.error('Llegaste al límite de imágenes del sitio. Liberá espacio desde el historial.')
      setLibraryOpen(true)
      return
    }
    setUploading(list.length)
    try {
      for (const file of list) {
        const body = new FormData()
        body.append('file', file)
        body.append('slideId', `galeria-${Date.now().toString(36)}`)
        const response = await fetch('/api/admin/website/promotion-image', { method: 'POST', body })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success || !payload.url) {
          toast.error(payload?.error || `No se pudo subir ${file.name}`)
          break
        }
        setImages((images) => [...images, { id: newId(), url: String(payload.url), path: payload.path ? String(payload.path) : undefined, caption: '' }])
        setUploading((count) => count - 1)
      }
    } finally {
      setUploading(0)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const move = (index: number, delta: number) =>
    setImages((images) => {
      const next = [...images]
      const target = index + delta
      if (target < 0 || target >= next.length) return images
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const save = async () => {
    setSaving(true)
    try {
      const result = await updateSetting('gallery_section', value)
      if (result?.success === false) {
        toast.error(result.error || 'No se pudo guardar')
        return
      }
      setDraft(null)
      toast.success('Galería guardada')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-muted" />

  return (
    <div className="space-y-6">
      <WebsiteMediaQuotaBanner onOpenHistory={() => setLibraryOpen(true)} />

      <div className="space-y-5 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="galleryEnabled" className="text-sm font-semibold">Mostrar la galería en el inicio</Label>
            <p className="text-xs text-muted-foreground">Se ve en la plantilla «Servicios», entre la carta y las opiniones.</p>
          </div>
          <Switch id="galleryEnabled" checked={value.enabled} onCheckedChange={(enabled) => change({ enabled })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="galleryTitle">Título</Label>
            <Input id="galleryTitle" maxLength={80} value={value.title} onChange={(event) => change({ title: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gallerySubtitle">Texto de apoyo</Label>
            <Textarea id="gallerySubtitle" rows={2} maxLength={200} value={value.subtitle} onChange={(event) => change({ subtitle: event.target.value })} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Fotos ({value.images.length} de {MAX_GALLERY_IMAGES})</p>
            <p className="text-xs text-muted-foreground">Fotos verticales o cuadradas se ven mejor. Podés ordenarlas y ponerles un texto corto.</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={value.images.length >= MAX_GALLERY_IMAGES || uploading > 0} onClick={() => fileRef.current?.click()}>
            {uploading > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading > 0 ? `Subiendo ${uploading}…` : 'Agregar fotos'}
          </Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => void upload(event.target.files)} aria-label="Elegir fotos para la galería" />
        </div>

        {value.images.length === 0 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-sm text-muted-foreground hover:bg-muted/40"
          >
            <ImagePlus aria-hidden="true" className="h-6 w-6" />
            Subí fotos de tus trabajos: cortes, barbas, color…
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {value.images.map((image, index) => (
              <li key={image.id} className="overflow-hidden rounded-xl border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.caption || `Foto ${index + 1}`} className="aspect-[4/5] w-full object-cover" />
                <div className="space-y-2 p-2">
                  <Input
                    value={image.caption ?? ''}
                    maxLength={80}
                    placeholder="Texto (opcional)"
                    aria-label={`Texto de la foto ${index + 1}`}
                    className="h-8 text-xs"
                    onChange={(event) => setImages((images) => images.map((item) => (item.id === image.id ? { ...item, caption: event.target.value } : item)))}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Subir la foto ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Bajar la foto ${index + 1}`} disabled={index === value.images.length - 1} onClick={() => move(index, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Quitar la foto ${index + 1}`} onClick={() => setImages((images) => images.filter((item) => item.id !== image.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Quitar una foto de la galería no la borra del historial de imágenes: podés eliminarla ahí para liberar espacio.</p>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <p className="text-xs font-medium">
          {value.enabled ? (value.images.length ? 'Visible en tu inicio' : 'Activada, sin fotos todavía') : 'Oculta'}
          {draft && <span className="ml-2 text-amber-600">· Cambios sin guardar</span>}
        </p>
        <div className="flex gap-2">
          {draft && <Button variant="outline" size="sm" onClick={() => setDraft(null)}>Descartar</Button>}
          <Button size="sm" onClick={() => void save()} disabled={!draft || saving || uploading > 0} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>

      <WebsiteMediaLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        filterSection="gallery"
        title="Historial de imágenes"
        description="Elegí una foto ya subida o eliminá archivos para liberar espacio (máx. 20)."
        onSelect={(url) => {
          if (value.images.length >= MAX_GALLERY_IMAGES) return
          setImages((images) => [...images, { id: newId(), url, caption: '' }])
        }}
      />
    </div>
  )
}
