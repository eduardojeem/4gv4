'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  announcementCtaKind,
  announcementDayStamp,
  announcementImages,
  announcementStorageKey,
  shouldShowAnnouncement,
  type Announcement,
  type AnnouncementImage,
} from '@/lib/announcements/announcement'

/** Una imagen del aviso, con su enlace propio si lo tiene. */
function AnnouncementImageView({ image, onNavigate }: { image: AnnouncementImage; onNavigate: () => void }) {
  // Las imagenes se suben al storage o se pegan de cualquier origen; sin
  // next/image no hace falta declarar dominios para que se vean.
  // eslint-disable-next-line @next/next/no-img-element
  const media = <img src={image.url} alt={image.alt} className="max-h-56 w-full object-cover" />
  const kind = announcementCtaKind(image.href)

  if (kind === 'internal') {
    return <Link href={image.href} onClick={onNavigate} className="block">{media}</Link>
  }
  if (kind === 'external') {
    return (
      <a href={image.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className="block">
        {media}
      </a>
    )
  }
  return media
}

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
  const [imageIndex, setImageIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const images = announcementImages(announcement)

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

  // Con mas de una imagen van pasando solas. Se frenan al pasar el mouse o al
  // enfocar algo adentro, y no se mueven si el visitante pidio menos animacion.
  useEffect(() => {
    if (!open || images.length < 2 || paused) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return
    const timer = window.setInterval(() => {
      setImageIndex((current) => (current + 1) % images.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [open, images.length, paused])

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
        {images.length > 0 && (
          <div
            className="relative bg-muted"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <AnnouncementImageView image={images[imageIndex] ?? images[0]} onNavigate={close} />

            {images.length > 1 && (
              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
                {images.map((image, index) => (
                  <button
                    key={`${image.url}-${index}`}
                    type="button"
                    onClick={() => setImageIndex(index)}
                    aria-label={`Ver imagen ${index + 1} de ${images.length}`}
                    aria-current={index === imageIndex}
                    className={cn(
                      'h-2 w-2 rounded-full border border-white/70 transition-colors',
                      index === imageIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/70',
                    )}
                  />
                ))}
              </div>
            )}
          </div>
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
