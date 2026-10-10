'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, Loader2 } from 'lucide-react'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'
import { cn } from '@/lib/utils'

/** Iniciales para cuando todavía no hay foto. */
export function professionalInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'
}

export const PROFESSIONAL_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PROFESSIONAL_PHOTO_MAX_BYTES = 5 * 1024 * 1024

/** Antes de subir: el mismo límite que pone el servidor, dicho en palabras. */
export function professionalPhotoProblem(file: File): string | null {
  if (!PROFESSIONAL_PHOTO_TYPES.includes(file.type)) return 'La foto tiene que ser JPG, PNG o WebP.'
  if (file.size > PROFESSIONAL_PHOTO_MAX_BYTES) return 'La foto pesa más de 5 MB.'
  return null
}

/** Sube la foto como imagen del sitio y devuelve su dirección. */
export async function uploadProfessionalPhoto(file: File, professionalId: string): Promise<{ url: string } | { error: string }> {
  const problem = professionalPhotoProblem(file)
  if (problem) return { error: problem }
  const body = new FormData()
  body.append('file', file)
  body.append('slideId', `equipo-${professionalId.slice(0, 8)}`)
  try {
    const response = await fetch('/api/admin/website/promotion-image', { method: 'POST', body })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success || !payload.url) return { error: payload?.error || 'No se pudo subir la foto' }
    return { url: String(payload.url) }
  } catch {
    return { error: 'No se pudo subir la foto. Revisá tu conexión.' }
  }
}

/**
 * Foto del profesional para la tienda. Se sube como imagen del sitio (cuenta
 * para el límite de 20) y se guarda en el profesional.
 */
export function ProfessionalPhotoButton({
  professional,
  onUploaded,
  className,
}: {
  professional: AgendaProfessional
  onUploaded: (url: string) => Promise<void> | void
  /** Tamaño del círculo (por defecto 32px). */
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadProfessionalPhoto(file, professional.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      await onUploaded(result.url)
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
        className={cn('group relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-bold text-white', className)}
        style={{ backgroundColor: professional.color }}
      >
        {professional.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={professional.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">{professionalInitials(professional.name)}</span>
        )}
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="h-3.5 w-3.5" />
        </span>
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
