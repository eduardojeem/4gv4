'use client'

import Link from 'next/link'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnnouncementsManager } from '@/components/announcements/AnnouncementsManager'
import { MAX_PLATFORM_ANNOUNCEMENTS, type Announcement } from '@/lib/announcements/announcement'

/**
 * Los avisos del marketplace, que edita el superadmin. La lista y el formulario
 * son los mismos que usa cada tienda; cambia el tope, a donde se suben las
 * imagenes y que aca se guarda en la configuracion de la plataforma.
 */
export function MarketplaceAnnouncementsForm({ initial }: { initial: Announcement[] }) {
  // Las imagenes van al mismo bucket que los assets de marca, que ya tiene su
  // listado y su borrado en el panel.
  const upload = async (file: File) => {
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

  const save = async (announcements: Announcement[]) => {
    const res = await fetch('/api/superadmin/marketplace-announcement', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ announcements }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.error || 'No se pudo guardar el aviso.')
    }
    return payload.announcements as Announcement[]
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
          <Link href="/superadmin/web-content">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Contenido web
          </Link>
        </Button>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Megaphone aria-hidden="true" className="h-5 w-5 text-primary" />
          Avisos del marketplace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Carteles que aparecen al entrar a <span className="font-medium text-foreground">/marketplace</span>.
          Cada visitante ve uno por día; si editás el aviso, vuelve a aparecer.
        </p>
      </div>

      <AnnouncementsManager
        initial={initial}
        max={MAX_PLATFORM_ANNOUNCEMENTS}
        audience="el marketplace"
        previewScope="marketplace"
        upload={upload}
        onSave={save}
      />
    </div>
  )
}
