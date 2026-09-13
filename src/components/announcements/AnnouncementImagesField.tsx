'use client'

import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_ANNOUNCEMENT_IMAGES, type AnnouncementImage } from '@/lib/announcements/announcement'

/**
 * Las imagenes del aviso: se suben desde la computadora o se pega su direccion.
 * El mismo campo lo usan el superadmin y cada tienda; lo unico que cambia es a
 * donde se sube el archivo, que llega por `upload`.
 */
export function AnnouncementImagesField({
  value,
  onChange,
  upload,
}: {
  value: AnnouncementImage[]
  onChange: (images: AnnouncementImage[]) => void
  upload: (file: File) => Promise<string>
}) {
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const full = value.length >= MAX_ANNOUNCEMENT_IMAGES

  const update = (index: number, patch: Partial<AnnouncementImage>) =>
    onChange(value.map((image, position) => (position === index ? { ...image, ...patch } : image)))

  const remove = (index: number) => onChange(value.filter((_, position) => position !== index))

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
  }

  const addFile = async (file: File) => {
    if (full) {
      toast.error(`Hasta ${MAX_ANNOUNCEMENT_IMAGES} imágenes`)
      return
    }
    setUploading(true)
    try {
      const url = await upload(file)
      onChange([...value, { url, alt: '', href: '' }])
      toast.success('Imagen agregada')
    } catch (error) {
      toast.error('No se pudo subir la imagen', {
        description: error instanceof Error ? error.message : 'Intentá nuevamente.',
      })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>Imágenes del cartel</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Se muestran arriba del título. Con más de una van pasando solas cada 5 segundos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void addFile(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={uploading || full}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ImagePlus aria-hidden="true" className="h-4 w-4" />}
            Subir imagen
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={full}
            onClick={() => onChange([...value, { url: '', alt: '', href: '' }])}
          >
            Pegar dirección
          </Button>
        </div>
      </div>

      {value.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Sin imágenes: el cartel se muestra solo con el título y el mensaje.
        </p>
      )}

      <ul className="space-y-3">
        {value.map((image, index) => (
          <li key={`${image.url}-${index}`} className="rounded-xl border border-border/70 p-3">
            <div className="flex gap-3">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {image.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                )}
              </div>

              <div className="grid min-w-0 flex-1 gap-2">
                <Input
                  value={image.url}
                  maxLength={500}
                  placeholder="https://…/banner.jpg"
                  aria-label={`Dirección de la imagen ${index + 1}`}
                  onChange={(event) => update(index, { url: event.target.value })}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={image.alt}
                    maxLength={120}
                    placeholder="Descripción para lectores de pantalla"
                    aria-label={`Descripción de la imagen ${index + 1}`}
                    onChange={(event) => update(index, { alt: event.target.value })}
                  />
                  <Input
                    value={image.href}
                    maxLength={500}
                    placeholder="Enlace al tocarla (opcional)"
                    aria-label={`Enlace de la imagen ${index + 1}`}
                    onChange={(event) => update(index, { href: event.target.value })}
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === 0}
                  aria-label={`Subir la imagen ${index + 1} de posición`}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === value.length - 1}
                  aria-label={`Bajar la imagen ${index + 1} de posición`}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  aria-label={`Quitar la imagen ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
