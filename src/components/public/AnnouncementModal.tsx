'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Columns2, Layers, Pause, Play, Sparkles, X } from 'lucide-react'
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
  type AnnouncementBadgeVariant,
  type AnnouncementCarouselAnimation,
  type AnnouncementImage,
  type AnnouncementImageBackdrop,
  type AnnouncementImageEffect,
  type AnnouncementImageFit,
} from '@/lib/announcements/announcement'

const BADGE_STYLES: Record<AnnouncementBadgeVariant, { badge: string; dot: string }> = {
  primary: {
    badge: 'bg-primary/10 text-primary border-primary/20',
    dot: 'bg-primary',
  },
  amber: {
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  emerald: {
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  purple: {
    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    dot: 'bg-purple-500',
  },
  rose: {
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  cyan: {
    badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
    dot: 'bg-cyan-500',
  },
  indigo: {
    badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    dot: 'bg-indigo-500',
  },
  orange: {
    badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    dot: 'bg-orange-500',
  },
  teal: {
    badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
    dot: 'bg-teal-500',
  },
  slate: {
    badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
    dot: 'bg-slate-500',
  },
}

const CTA_THEMES: Record<AnnouncementBadgeVariant, { button: string }> = {
  primary: {
    button: 'bg-primary text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30',
  },
  amber: {
    button: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/25 hover:shadow-lg hover:shadow-amber-600/30',
  },
  emerald: {
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 hover:shadow-lg hover:shadow-emerald-600/30',
  },
  purple: {
    button: 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/25 hover:shadow-lg hover:shadow-purple-600/30',
  },
  rose: {
    button: 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 hover:shadow-lg hover:shadow-rose-600/30',
  },
  cyan: {
    button: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-600/25 hover:shadow-lg hover:shadow-cyan-600/30',
  },
  indigo: {
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25 hover:shadow-lg hover:shadow-indigo-600/30',
  },
  orange: {
    button: 'bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/25 hover:shadow-lg hover:shadow-orange-600/30',
  },
  teal: {
    button: 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/25 hover:shadow-lg hover:shadow-teal-600/30',
  },
  slate: {
    button: 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white shadow-md shadow-slate-900/25 hover:shadow-lg',
  },
}

const CAROUSEL_ANIMATION_CLASSES: Record<AnnouncementCarouselAnimation, string> = {
  slide: 'animate-in fade-in-40 slide-in-from-right-8 duration-450 ease-out',
  fade: 'animate-in fade-in-0 duration-500 ease-in-out',
  zoom: 'animate-in fade-in-0 zoom-in-95 duration-450 ease-out',
}

const BACKDROP_CONTAINER_THEMES: Record<AnnouncementImageBackdrop, string> = {
  ambient: 'bg-slate-950/90',
  dark: 'bg-black',
  tinted: 'bg-slate-950/95',
  light: 'bg-slate-100 dark:bg-slate-900',
}

const TINTED_OVERLAYS: Record<AnnouncementBadgeVariant, string> = {
  primary: 'bg-primary/20',
  amber: 'bg-amber-500/20',
  emerald: 'bg-emerald-500/20',
  purple: 'bg-purple-500/20',
  rose: 'bg-rose-500/20',
  cyan: 'bg-cyan-500/20',
  indigo: 'bg-indigo-500/20',
  orange: 'bg-orange-500/20',
  teal: 'bg-teal-500/20',
  slate: 'bg-slate-400/20',
}

const IMAGE_EFFECT_CLASSES: Record<AnnouncementImageEffect, string> = {
  zoom: 'transition-transform duration-500 hover:scale-[1.03]',
  glow: 'transition-all duration-500 hover:brightness-105 hover:drop-shadow-[0_0_18px_rgba(255,255,255,0.4)]',
  none: 'transition-none',
}

/** Una imagen del aviso, con su enlace propio si lo tiene.
 * Personalizable con fondo difuminado/oscuro/tintado/claro,
 * encuadre sin cortes o panorámico, y efectos interactivos.
 */
function AnnouncementImageView({
  image,
  onNavigate,
  className,
  fit = 'contain',
  backdrop = 'ambient',
  effect = 'zoom',
  badgeVariant = 'primary',
}: {
  image: AnnouncementImage
  onNavigate: () => void
  className?: string
  fit?: AnnouncementImageFit
  backdrop?: AnnouncementImageBackdrop
  effect?: AnnouncementImageEffect
  badgeVariant?: AnnouncementBadgeVariant
}) {
  const containerBackdrop = BACKDROP_CONTAINER_THEMES[backdrop] ?? BACKDROP_CONTAINER_THEMES.ambient
  const effectClass = IMAGE_EFFECT_CLASSES[effect] ?? IMAGE_EFFECT_CLASSES.zoom

  const media = (
    <div className={cn('relative h-full w-full overflow-hidden flex items-center justify-center', containerBackdrop)}>
      {/* Fondo difuminado para rellenar los bordes con los mismos colores de la imagen */}
      {backdrop !== 'dark' && (
        <img
          src={image.url}
          alt=""
          aria-hidden="true"
          className={cn(
            'absolute inset-0 h-full w-full scale-110 object-cover pointer-events-none',
            backdrop === 'ambient' && 'opacity-35 blur-xl',
            backdrop === 'tinted' && 'opacity-25 blur-2xl',
            backdrop === 'light' && 'opacity-15 blur-lg dark:opacity-25'
          )}
        />
      )}

      {/* Tinte temático sutil si se selecciona tinted */}
      {backdrop === 'tinted' && (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 mix-blend-screen backdrop-blur-xs',
            TINTED_OVERLAYS[badgeVariant] ?? TINTED_OVERLAYS.primary
          )}
        />
      )}

      {/* Imagen principal: contain (sin cortes) o cover (panorámico completo) */}
      <img
        src={image.url}
        alt={image.alt || 'Imagen de anuncio'}
        className={cn(
          'relative z-10',
          fit === 'cover' ? 'h-full w-full object-cover' : 'max-h-full max-w-full object-contain',
          effectClass,
          className
        )}
      />
    </div>
  )
  const kind = announcementCtaKind(image.href)

  if (kind === 'internal') {
    return (
      <Link href={image.href} onClick={onNavigate} className="block h-full w-full overflow-hidden">
        {media}
      </Link>
    )
  }
  if (kind === 'external') {
    return (
      <a href={image.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className="block h-full w-full overflow-hidden">
        {media}
      </a>
    )
  }
  return <div className="h-full w-full overflow-hidden">{media}</div>
}

/**
 * El cartel emergente moderno que aparece al entrar al marketplace o tiendas.
 * Soporta carrusel automático con rotación cada 3 segundos, modo dual cuando hay 2 imágenes,
 * botón de cierre rápido visible y temporizador de auto-cierre con pausa inteligente.
 */
export function AnnouncementModal({
  announcement,
  scope,
  isOpen,
  onClose,
  isPreview = false,
}: {
  announcement: Announcement | null
  scope: string
  isOpen?: boolean
  onClose?: () => void
  isPreview?: boolean
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isOpen !== undefined ? isOpen : internalOpen
  const [imageIndex, setImageIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [viewMode, setViewMode] = useState<'carousel' | 'split'>('carousel')
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const autoCloseSeconds = isPreview ? 0 : (announcement?.autoCloseSeconds ?? 5)
  const carouselAnimation = announcement?.carouselAnimation ?? 'slide'
  const carouselIntervalSeconds = announcement?.carouselIntervalSeconds ?? 3
  const imageBackdrop = announcement?.imageBackdrop ?? 'ambient'
  const imageFit = announcement?.imageFit ?? 'contain'
  const imageEffect = announcement?.imageEffect ?? 'zoom'
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const images = announcementImages(announcement)

  // Navegación accesible con teclado (flechas izquierda / derecha)
  useEffect(() => {
    if (!open || images.length < 2) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setImageIndex((cur) => (cur - 1 + images.length) % images.length)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setImageIndex((cur) => (cur + 1) % images.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, images.length])

  useEffect(() => {
    if (!announcement) return
    if (isPreview) {
      setInternalOpen(true)
      setTimeLeft(null)
      return
    }

    const key = announcementStorageKey(scope, announcement)
    let lastSeen: string | null = null
    let sessionSeen = false

    try {
      lastSeen = window.localStorage.getItem(key)
    } catch {
      // Navegador sin almacenamiento: se muestra igual, es preferible a no mostrarlo.
      lastSeen = null
    }

    try {
      sessionSeen = window.sessionStorage.getItem(key) === 'seen'
    } catch {
      sessionSeen = false
    }

    if (shouldShowAnnouncement(announcement, new Date(), lastSeen, sessionSeen)) {
      setInternalOpen(true)
      if (autoCloseSeconds > 0) {
        setTimeLeft(autoCloseSeconds)
      } else {
        setTimeLeft(null)
      }
    }
  }, [announcement, scope, autoCloseSeconds, isPreview])

  // Rotación automática del carrusel cuando hay 2 o más imágenes
  useEffect(() => {
    if (!open || images.length < 2 || paused || userPaused || viewMode !== 'carousel' || carouselIntervalSeconds <= 0) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return
    const timer = window.setInterval(() => {
      setImageIndex((current) => (current + 1) % images.length)
    }, carouselIntervalSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [open, images.length, paused, userPaused, viewMode, carouselIntervalSeconds])

  const close = () => {
    setInternalOpen(false)
    setTimeLeft(null)
    onClose?.()
    if (!announcement || isPreview) return
    const frequency = announcement.frequency ?? 'once_per_day'
    const key = announcementStorageKey(scope, announcement)
    try {
      if (frequency === 'once_per_day') {
        window.localStorage.setItem(key, announcementDayStamp(new Date()))
      } else if (frequency === 'once_per_session') {
        window.sessionStorage.setItem(key, 'seen')
      }
    } catch {
      // Sin almacenamiento volvera a aparecer; no es motivo para fallar.
    }
  }

  // Temporizador de auto-cierre del cartel (pausado con el mouse)
  useEffect(() => {
    if (!open || timeLeft === null || timeLeft <= 0 || paused) return
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current === null) return null
        if (current <= 1) {
          close()
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [open, timeLeft, paused])

  if (!announcement) return null

  const ctaKind = announcement.ctaLabel.trim() ? announcementCtaKind(announcement.ctaHref) : 'none'
  const badgeVariant = announcement.badgeVariant ?? 'primary'
  const badgeStyle = BADGE_STYLES[badgeVariant] ?? BADGE_STYLES.primary
  const badgeLabel = announcement.badgeLabel?.trim() || 'Novedad destacada'
  const ctaTheme = CTA_THEMES[badgeVariant] ?? CTA_THEMES.primary

  const nextImage = () => setImageIndex((cur) => (cur + 1) % images.length)
  const prevImage = () => setImageIndex((cur) => (cur - 1 + images.length) % images.length)

  // Soporte de gestos táctiles (swipe) para deslizar imágenes en móviles
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
    setPaused(true)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartX - touchEndX
    // Deslizar mínimo 45px para cambiar de imagen
    if (diff > 45) {
      nextImage()
    } else if (diff < -45) {
      prevImage()
    }
    setTouchStartX(null)
    setPaused(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent
        className={cn(
          'w-[calc(100%-1.5rem)] max-h-[90vh] flex flex-col gap-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-border/70 p-0 shadow-2xl shadow-primary/10 transition-all duration-300',
          images.length === 2 && viewMode === 'split'
            ? 'sm:max-w-xl'
            : images.length > 0
              ? 'sm:max-w-lg'
              : 'sm:max-w-md'
        )}
        showCloseButton={false}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Barra superior delgada de auto-cierre */}
        {autoCloseSeconds > 0 && timeLeft !== null && (
          <div className="relative h-1 w-full shrink-0 overflow-hidden bg-muted">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-1000 ease-linear"
              style={{ width: `${Math.max(0, Math.min(100, (timeLeft / autoCloseSeconds) * 100))}%` }}
            />
          </div>
        )}

        {/* Sección de Imagen o Galería */}
        {images.length > 0 && (
          <div
            className="relative shrink-0 overflow-hidden bg-muted select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {images.length === 2 && viewMode === 'split' ? (
              /* Vista dual dividida lado a lado cuando hay 2 imágenes */
              <div className="grid h-[26vh] min-h-[140px] max-h-[250px] sm:h-[30vh] sm:max-h-[280px] w-full grid-cols-2 gap-1">
                {images.map((img, idx) => (
                  <div key={`${img.url}-${idx}`} className="relative h-full w-full">
                    <AnnouncementImageView
                      image={img}
                      onNavigate={close}
                      fit={imageFit}
                      backdrop={imageBackdrop}
                      effect={imageEffect}
                      badgeVariant={badgeVariant}
                    />
                    {img.alt && (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 text-left text-[10px] sm:text-[11px] font-medium text-white line-clamp-1">
                        {img.alt}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Vista carrusel con navegación fluida y animación */
              <div className="relative h-[28vh] min-h-[160px] max-h-[270px] sm:h-[34vh] sm:max-h-[320px] w-full overflow-hidden">
                <div
                  key={`slide-${imageIndex}`}
                  className={cn('h-full w-full', CAROUSEL_ANIMATION_CLASSES[carouselAnimation])}
                >
                  <AnnouncementImageView
                    image={images[imageIndex] ?? images[0]}
                    onNavigate={close}
                    fit={imageFit}
                    backdrop={imageBackdrop}
                    effect={imageEffect}
                    badgeVariant={badgeVariant}
                  />
                </div>

                {/* Sombra sutil inferior para legibilidad de controles */}
                {images.length > 1 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent z-10" />
                )}

                {/* Flechas de navegación prev/next */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prevImage}
                      aria-label="Ver imagen anterior"
                      className="group absolute left-2.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/50 text-white/90 shadow-md ring-1 ring-white/20 backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-black/80 hover:text-white active:scale-95 focus:outline-hidden"
                    >
                      <ChevronLeft aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                    </button>
                    <button
                      type="button"
                      onClick={nextImage}
                      aria-label="Ver imagen siguiente"
                      className="group absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/50 text-white/90 shadow-md ring-1 ring-white/20 backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-black/80 hover:text-white active:scale-95 focus:outline-hidden"
                    >
                      <ChevronRight aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  </>
                )}

                {/* Indicadores inferiores (pills expandibles con micro-interacción) */}
                {images.length > 1 && (
                  <div className="absolute inset-x-0 bottom-2.5 z-20 flex items-center justify-center gap-1.5">
                    {images.map((image, index) => {
                      const isActive = index === imageIndex
                      return (
                        <button
                          key={`${image.url}-${index}`}
                          type="button"
                          onClick={() => setImageIndex(index)}
                          aria-label={`Ver imagen ${index + 1} de ${images.length}`}
                          aria-current={isActive}
                          title={image.alt || `Foto ${index + 1}`}
                          className={cn(
                            'h-1.5 rounded-full transition-all duration-300 backdrop-blur-xs cursor-pointer',
                            isActive
                              ? 'w-7 bg-white shadow-sm ring-1 ring-white/60'
                              : 'w-2 bg-white/50 hover:bg-white/80 hover:w-3.5',
                          )}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Botón flotante para cerrar el modal inmediatamente */}
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar aviso"
              className="group absolute right-3 top-3 z-30 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/60 text-white/95 shadow-lg ring-1 ring-white/20 backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-black/85 hover:text-white active:scale-95 focus:outline-hidden"
            >
              <X aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
            </button>

            {/* Badges superiores flotantes: contador, play/pause y conmutador si hay 2 imágenes */}
            {images.length > 1 && (
              <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 z-20">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm ring-1 ring-white/10 backdrop-blur-md">
                  <Layers aria-hidden="true" className="h-3 w-3" />
                  {viewMode === 'split' ? '2 fotos' : `${imageIndex + 1} / ${images.length}`}
                </span>

                {viewMode === 'carousel' && carouselIntervalSeconds > 0 && (
                  <button
                    type="button"
                    onClick={() => setUserPaused((p) => !p)}
                    aria-label={userPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
                    title={userPaused ? 'Reanudar rotación automática' : 'Pausar rotación automática'}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white shadow-sm ring-1 ring-white/10 backdrop-blur-md transition-all hover:bg-black/80 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    {userPaused ? (
                      <Play aria-hidden="true" className="h-2.5 w-2.5 fill-current" />
                    ) : (
                      <Pause aria-hidden="true" className="h-2.5 w-2.5" />
                    )}
                  </button>
                )}

                {images.length === 2 && (
                  <button
                    type="button"
                    onClick={() => setViewMode((m) => (m === 'carousel' ? 'split' : 'carousel'))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm ring-1 ring-white/15 backdrop-blur-md transition-all duration-200 hover:bg-black/80 hover:scale-105 active:scale-95 cursor-pointer"
                    title={viewMode === 'carousel' ? 'Ver ambas imágenes lado a lado' : 'Ver en carrusel rotativo'}
                  >
                    <Columns2 aria-hidden="true" className="h-3 w-3" />
                    {viewMode === 'carousel' ? 'Ver ambas' : 'Carrusel'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Botón de cierre visible cuando no hay imagen */}
        {images.length === 0 && (
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar aviso"
            className="group absolute right-3.5 top-3.5 z-30 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground shadow-xs backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-muted hover:text-foreground active:scale-95 focus:outline-hidden"
          >
            <X aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
          </button>
        )}

        {/* Contenido textual del anuncio: se adapta dinámicamente según el contenido */}
        <div
          className={cn(
            'flex flex-1 min-h-0 flex-col overflow-hidden',
            images.length > 0 ? 'p-4 sm:p-5' : 'p-6 sm:p-7',
          )}
        >
          {/* Zona con scroll automático para el texto cuando sea largo */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-0.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold tracking-wide transition-colors',
                  badgeStyle.badge,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', badgeStyle.dot)} aria-hidden="true" />
                {badgeLabel}
              </span>
            </div>

            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
              {announcement.title.trim() || 'Aviso informativo'}
            </DialogTitle>

            <DialogDescription className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-muted-foreground">
              {announcement.message.trim() || 'Este aviso no tiene texto cargado todavía.'}
            </DialogDescription>
          </div>

          {/* Zona inferior fija para botones y pie: siempre visible y accesible */}
          <div className="shrink-0 pt-3 mt-2.5 border-t border-border/40 space-y-2">
            {/* Botones de acción adaptados para pulgar móvil y desktop */}
            <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
              {ctaKind === 'internal' && (
                <Button
                  asChild
                  className={cn(
                    'group relative w-full h-11 sm:h-12 rounded-xl px-5 text-sm sm:text-base font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] sm:flex-1 cursor-pointer',
                    ctaTheme.button,
                  )}
                >
                  <Link href={announcement.ctaHref} onClick={close} className="inline-flex items-center justify-center gap-2">
                    <span>{announcement.ctaLabel}</span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Button>
              )}
              {ctaKind === 'external' && (
                <Button
                  asChild
                  className={cn(
                    'group relative w-full h-11 sm:h-12 rounded-xl px-5 text-sm sm:text-base font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] sm:flex-1 cursor-pointer',
                    ctaTheme.button,
                  )}
                >
                  <a href={announcement.ctaHref} target="_blank" rel="noopener noreferrer" onClick={close} className="inline-flex items-center justify-center gap-2">
                    <span>{announcement.ctaLabel}</span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={close}
                className={cn(
                  'w-full h-11 sm:h-12 rounded-xl px-4 text-xs sm:text-sm font-medium transition-all duration-200 active:scale-[0.99] cursor-pointer',
                  ctaKind !== 'none'
                    ? 'sm:flex-1 border-border/70 bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
                    : 'w-full border-border/70 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                Seguir mirando
              </Button>
            </div>

            {/* Nota o texto fino al pie (highlightNote) */}
            {announcement.highlightNote?.trim() && (
              <p className="text-center text-[10px] sm:text-[11px] font-medium text-muted-foreground/80">
                {announcement.highlightNote.trim()}
              </p>
            )}

            {/* Estado del temporizador */}
            {autoCloseSeconds > 0 && timeLeft !== null && (
              <div className="flex items-center justify-center gap-1.5 pt-0.5 sm:pt-1 text-[10px] sm:text-[11px] text-muted-foreground">
                <Clock aria-hidden="true" className="h-3 w-3" />
                <span>{paused ? 'Pausado' : `Se cierra en ${timeLeft}s`}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
