'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  announcementCtaKind,
  announcementDayStamp,
  announcementStorageKey,
  shouldShowAnnouncement,
  type Announcement,
} from '@/lib/announcements/announcement'

/**
 * El cartel que aparece al entrar. Lo usan el marketplace y las tiendas con el
 * mismo comportamiento: se muestra una vez por dia y, si el dueño lo edita,
 * vuelve a aparecer.
 *
 * El servidor decide el contenido; aca solo se decide si mostrarlo, porque eso
 * depende de lo que cada visitante ya vio.
 */
export function AnnouncementModal({
  announcement,
  scope,
}: {
  announcement: Announcement | null
  scope: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!announcement) return
    let lastSeen: string | null = null
    try {
      lastSeen = window.localStorage.getItem(announcementStorageKey(scope, announcement))
    } catch {
      // Navegador sin almacenamiento: se muestra igual, es preferible a no mostrarlo.
      lastSeen = null
    }
    if (shouldShowAnnouncement(announcement, new Date(), lastSeen)) setOpen(true)
  }, [announcement, scope])

  if (!announcement) return null

  const close = () => {
    setOpen(false)
    try {
      window.localStorage.setItem(announcementStorageKey(scope, announcement), announcementDayStamp(new Date()))
    } catch {
      // Sin almacenamiento volvera a aparecer; no es motivo para fallar.
    }
  }

  const ctaKind = announcement.ctaLabel.trim() ? announcementCtaKind(announcement.ctaHref) : 'none'

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent className="w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md" showCloseButton>
        {announcement.imageUrl && (
          // Las imagenes las carga el dueño desde cualquier origen; sin next/image
          // no hace falta declarar dominios para que se vean.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={announcement.imageUrl}
            alt=""
            className="max-h-56 w-full object-cover"
          />
        )}

        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <DialogTitle className="text-lg font-semibold text-foreground sm:text-xl">
            {announcement.title}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {announcement.message}
          </DialogDescription>

          <div className="mt-1 flex flex-col gap-2 sm:flex-row-reverse">
            {ctaKind === 'internal' && (
              <Button asChild className="gap-2 sm:flex-1">
                <Link href={announcement.ctaHref} onClick={close}>
                  {announcement.ctaLabel}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
            )}
            {ctaKind === 'external' && (
              <Button asChild className="gap-2 sm:flex-1">
                <a href={announcement.ctaHref} target="_blank" rel="noopener noreferrer" onClick={close}>
                  {announcement.ctaLabel}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={close} className="sm:flex-1">
              Seguir mirando
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
