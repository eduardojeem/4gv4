'use client'

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
    <details className="basis-full min-w-0 rounded-xl border bg-card p-3">
      <summary className="cursor-pointer py-1 text-sm font-medium">
        Foto y página web
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {savedVisible ? 'Visible en la web' : 'Oculto en la web'} · {service.image_url ? 'Con portada' : 'Sin portada'}
        </span>
      </summary>
      <fieldset disabled={busy} className="mt-3 space-y-4">
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

        <label className="flex items-start justify-between gap-3 rounded-xl bg-muted/30 p-3 text-sm">
          <span>
            <span className="block font-medium">Mostrar en la página web</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Aparece en tu página con su portada y precio. Para que también se pueda reservar, activá «Reservar online». Si lo ocultás, deja de poder reservarse online.
            </span>
          </span>
          <Switch checked={visible} onCheckedChange={setVisibility} aria-label={`Mostrar ${service.name} en la página web`} />
        </label>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? 'Guardando…' : 'Guardar foto y página web'}
          </Button>
          {dirty && <Button type="button" size="sm" variant="ghost" onClick={reset}>Descartar</Button>}
          <span className="text-xs text-muted-foreground">Se guarda con este botón, aparte de «Guardar cambios».</span>
        </div>
      </fieldset>
    </details>
  )
}
