'use client'

import { AnnouncementsManager } from '@/components/announcements/AnnouncementsManager'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import {
  MAX_STORE_ANNOUNCEMENTS,
  normalizeAnnouncementList,
  type Announcement,
} from '@/lib/announcements/announcement'

/**
 * Los carteles que ve el cliente al entrar a la tienda. Misma lista y mismo
 * formulario que usa el superadmin para el marketplace; aca el tope es mas bajo
 * y se guarda como una opcion mas del sitio.
 */
export function AnnouncementEditor() {
  const { settings, isLoading, updateSetting } = useAdminWebsiteSettings()

  // Se sube al mismo lugar que los banners promocionales, bajo la carpeta de
  // esta organizacion.
  const upload = async (file: File) => {
    const body = new FormData()
    body.append('file', file)
    body.append('slideId', 'aviso')
    const res = await fetch('/api/admin/website/promotion-image', { method: 'POST', body })
    const payload = await res.json().catch(() => null)
    if (!res.ok || !payload?.success || !payload.url) {
      throw new Error(payload?.error || 'No se pudo subir la imagen.')
    }
    return String(payload.url)
  }

  const save = async (announcements: Announcement[]) => {
    const res = await updateSetting('announcements', announcements)
    if (res?.success === false) {
      throw new Error(res.error || 'No se pudo guardar el aviso.')
    }
  }

  if (isLoading) {
    return <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-muted" />
  }

  // Los avisos guardados cuando habia uno solo se leen como el primero de la lista.
  const initial = normalizeAnnouncementList(
    settings?.announcements ?? settings?.announcement,
    MAX_STORE_ANNOUNCEMENTS,
  )

  return (
    <AnnouncementsManager
      initial={initial}
      max={MAX_STORE_ANNOUNCEMENTS}
      audience="tu tienda"
      previewScope="tienda"
      upload={upload}
      onSave={save}
    />
  )
}
