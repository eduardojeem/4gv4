'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  SERVICE_COVER_TYPES,
  imagesWithCover,
  imagesWithoutCover,
  serviceCoverProblem,
  serviceWebsitePayload,
  uploadServiceCover,
} from '@/lib/agenda/service-cover'
import type { AgendaService } from '@/lib/agenda/agenda-server'

/**
 * «Foto y página web» de un servicio: la portada y si se muestra en la web.
 * Se guarda aparte de «Guardar cambios» porque escribe el producto del
 * catálogo, no la configuración de la agenda.
 */
export function ServiceWebsiteEditor({ service, onSaved }: { service: AgendaService; onSaved: () => Promise<void> }) {
  const savedVisible = service.catalog_visible !== false
  const [file, setFile] = useState<File | null>(null)
  const [removeCover, setRemoveCover] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Si la subida salió bien y falló el guardado, el reintento no vuelve a subirla.
  const uploaded = useRef<string | null>(null)
  const locked = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const visible = visibility ?? savedVisible
  const dirty = Boolean(file) || removeCover || visible !== savedVisible
  const image = preview ?? (removeCover ? null : service.image_url ?? null)

  const reset = () => {
    setFile(null)
    setRemoveCover(false)
    setVisibility(null)
    setError(null)
    uploaded.current = null
    if (input.current) input.current.value = ''
  }

  const save = async () => {
    if (locked.current || !dirty) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      let images: string[] | undefined
      if (file) {
        if (!uploaded.current) uploaded.current = await uploadServiceCover(file)
        images = imagesWithCover(service.images, uploaded.current)
      } else if (removeCover) {
        images = imagesWithoutCover(service.images, service.image_url)
      }
      const response = await fetch(`/api/products/${encodeURIComponent(service.product_id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceWebsitePayload({ visible, images })),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'No se pudo guardar. Tus cambios siguen aquí.')
      reset()
      toast.success('Foto y página web guardadas')
      await onSaved().catch(() => toast.error('Se guardó, pero no se pudo refrescar la lista. Recargá la página.'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar. Probá de nuevo.')
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  const inputId = `service-cover-${service.product_id}`
  return (
    <details className={cn('group min-w-0 overflow-hidden rounded-xl border bg-muted/15 transition-colors', dirty && 'border-primary/40 bg-primary/5')}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Camera aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>Foto y página web</span>
          <span className="text-xs font-normal text-muted-foreground">
            {savedVisible ? 'Visible en la web' : 'Oculto en la web'} · {service.image_url ? 'Con portada' : 'Sin portada'}
          </span>
          {dirty && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Sin guardar
            </span>
          )}
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <fieldset disabled={busy} className="space-y-4 border-t bg-card p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex aspect-video w-44 max-w-full items-center justify-center overflow-hidden rounded-xl border bg-muted text-xs text-muted-foreground">
            {image
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) o URL ya guardada
              ? <img src={image} alt={`Portada de ${service.name}`} className="h-full w-full object-cover" />
              : 'Sin foto de portada'}
          </div>
          <div className="min-w-0 flex-1 basis-44 space-y-2">
            <Label htmlFor={inputId}>Foto de portada</Label>
            <input
              ref={input}
              id={inputId}
              type="file"
              accept={SERVICE_COVER_TYPES.join(',')}
              className="sr-only"
              onChange={(event) => {
                const next = event.target.files?.[0]
                if (!next) return
                const problem = serviceCoverProblem(next)
                if (problem) { setError(problem); event.target.value = ''; return }
                setError(null)
                setRemoveCover(false)
                setFile(next)
                uploaded.current = null
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
                <ImagePlus className="h-4 w-4" /> {service.image_url || file ? 'Cambiar foto' : 'Subir foto'}
              </Button>
              {(service.image_url || file) && !removeCover && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (file) { setFile(null); uploaded.current = null; if (input.current) input.current.value = ''; return }
                    setRemoveCover(true)
                  }}
                >
                  <Trash2 className="h-4 w-4" /> {file ? 'Descartar foto nueva' : 'Quitar portada'}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP o AVIF, hasta 5 MB. Es la misma foto del servicio en Productos.</p>
          </div>
        </div>

        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border bg-muted/25 p-3 text-sm">
          <span>
            <span className="block font-medium">Mostrar en la página web</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Aparece en tu página con su portada y precio. Para que también se pueda reservar, activá «Reservar online». Si lo ocultás, deja de poder reservarse online.
            </span>
          </span>
          <Switch checked={visible} onCheckedChange={setVisibility} aria-label={`Mostrar ${service.name} en la página web`} />
        </label>

        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button type="button" size="sm" disabled={!dirty || busy} onClick={() => void save()}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'Guardando…' : 'Guardar foto y página web'}
          </Button>
          {dirty && <Button type="button" size="sm" variant="ghost" onClick={reset}>Descartar</Button>}
          <span className="text-xs text-muted-foreground">Se guarda con este botón, aparte de «Guardar cambios».</span>
        </div>
      </fieldset>
    </details>
  )
}
