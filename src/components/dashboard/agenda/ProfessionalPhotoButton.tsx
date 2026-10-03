'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, Loader2 } from 'lucide-react'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'

/**
 * Foto del profesional para la tienda. Se sube como imagen del sitio (cuenta
 * para el límite de 20) y se guarda en el profesional.
 */
export function ProfessionalPhotoButton({
  professional,
  onUploaded,
}: {
  professional: AgendaProfessional
  onUploaded: (url: string) => Promise<void> | void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('slideId', `equipo-${professional.id.slice(0, 8)}`)
      const response = await fetch('/api/admin/website/promotion-image', { method: 'POST', body })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success || !payload.url) {
        toast.error(payload?.error || 'No se pudo subir la foto')
        return
      }
      await onUploaded(String(payload.url))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={professional.photo_url ? `Cambiar la foto de ${professional.name}` : `Subir foto de ${professional.name}`}
        title="Foto para la tienda"
        className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-white"
        style={{ backgroundColor: professional.color }}
      >
        {professional.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={professional.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} aria-label={`Foto de ${professional.name}`} />
    </>
  )
}
