import type { PromotionalCarouselSlide } from '@/types/website-settings'

export type SlideOverlayIntensity = 'none' | 'subtle' | 'medium' | 'strong'
export type SlideOverlayColor = 'black' | 'white' | 'brand'
export type SlideAlign = 'left' | 'center' | 'right'
export type SlideTextTone = 'light' | 'dark'
export type SlideTitleSize = 'compact' | 'normal' | 'large'
export type SlideFontFamily = 'sans' | 'display' | 'serif' | 'mono'

export const SLIDE_ALIGNMENT_FLEX: Record<SlideAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
}

export const SLIDE_RESPONSIVE_ALIGNMENT: Record<SlideAlign, string> = {
  left: 'sm:items-start sm:text-left',
  center: 'sm:items-center sm:text-center',
  right: 'sm:items-end sm:text-right',
}

export const SLIDE_FONT_CLASS: Record<SlideFontFamily, string> = {
  sans: 'font-sans',
  display: 'font-black tracking-tight uppercase',
  serif: 'font-serif font-bold tracking-normal',
  mono: 'font-mono font-bold tracking-tighter',
}

export const SLIDE_TITLE_SIZE_STOREFRONT: Record<SlideTitleSize, string> = {
  compact: 'text-lg sm:text-2xl md:text-3xl font-bold',
  normal: 'text-xl sm:text-4xl md:text-5xl font-black',
  large: 'text-2xl sm:text-5xl md:text-6xl font-black tracking-tight',
}

export const SLIDE_TITLE_SIZE_PREVIEW: Record<SlideTitleSize, string> = {
  compact: 'text-sm sm:text-base font-bold',
  normal: 'text-base sm:text-xl font-black',
  large: 'text-lg sm:text-2xl font-black tracking-tight',
}

export const SLIDE_TITLE_SIZE_PREVIEW_MOBILE: Record<SlideTitleSize, string> = {
  compact: 'text-xs font-bold',
  normal: 'text-sm font-black',
  large: 'text-base font-black tracking-tight',
}

export function isLightColor(color?: string): boolean {
  if (!color) return false
  const clean = color.trim().toLowerCase()
  if (clean === '#ffffff' || clean === '#fff' || clean === 'white') return true
  if (clean === '#000000' || clean === '#000' || clean === 'black' || clean === '#09090b') return false
  const hex = clean.replace('#', '')
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return !isNaN(r) && (r * 299 + g * 587 + b * 114) / 1000 > 160
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return !isNaN(r) && (r * 299 + g * 587 + b * 114) / 1000 > 160
  }
  return false
}

export function isSlideTextHidden(
  slide: Pick<PromotionalCarouselSlide, 'hideText' | 'title' | 'message' | 'badge'>
): boolean {
  return Boolean(
    slide.hideText ||
    (!slide.title?.trim() && !slide.message?.trim() && !slide.badge?.trim())
  )
}

/**
 * Devuelve las clases del degradado direccional del banner.
 * - `'responsive'`: usa gradiente inferior en mobile y direccional en `sm:+`.
 * - `'desktop'`: fuerza el gradiente direccional (útil para vista previa compacta en modal).
 * - `'mobile'`: fuerza el gradiente vertical mobile.
 */
export function getOverlayGradient(
  tone: SlideTextTone = 'light',
  align: SlideAlign = 'left',
  intensity: SlideOverlayIntensity = 'strong',
  color: SlideOverlayColor = 'black',
  viewport: 'responsive' | 'desktop' | 'mobile' = 'responsive'
): string {
  if (intensity === 'none') {
    return 'opacity-0 pointer-events-none'
  }

  const effectiveColor = color === 'brand' ? 'brand' : (color || (tone === 'light' ? 'black' : 'white'))

  const pick = (mobile: string, desktopByAlign: Record<SlideAlign, string>) => {
    const desktop = desktopByAlign[align]
    if (viewport === 'mobile') return mobile
    if (viewport === 'desktop') return desktop.replace(/\bsm:/g, '')
    return `${mobile} ${desktop}`
  }

  if (intensity === 'subtle') {
    if (effectiveColor === 'white') {
      return pick('bg-gradient-to-t from-white/70 via-white/40 to-transparent', {
        right: 'sm:bg-gradient-to-l sm:from-white/70 sm:via-white/35 sm:to-transparent',
        center: 'sm:bg-white/30 sm:bg-radial sm:from-white/60 sm:via-white/30 sm:to-transparent',
        left: 'sm:bg-gradient-to-r sm:from-white/70 sm:via-white/35 sm:to-transparent',
      })
    }
    if (effectiveColor === 'brand') {
      return pick('bg-gradient-to-t from-primary/60 via-primary/30 to-transparent', {
        right: 'sm:bg-gradient-to-l sm:from-primary/65 sm:via-primary/30 sm:to-transparent',
        center: 'sm:bg-primary/20 sm:bg-radial sm:from-primary/50 sm:via-primary/20 sm:to-transparent',
        left: 'sm:bg-gradient-to-r sm:from-primary/65 sm:via-primary/30 sm:to-transparent',
      })
    }
    return pick('bg-gradient-to-t from-black/65 via-black/40 to-transparent', {
      right: 'sm:bg-gradient-to-l sm:from-black/65 sm:via-black/35 sm:to-transparent',
      center: 'sm:bg-black/30 sm:bg-radial sm:from-black/55 sm:via-black/30 sm:to-transparent',
      left: 'sm:bg-gradient-to-r sm:from-black/65 sm:via-black/35 sm:to-transparent',
    })
  }

  if (intensity === 'medium') {
    if (effectiveColor === 'white') {
      return pick('bg-gradient-to-t from-white/90 via-white/75 to-white/20', {
        right: 'sm:bg-gradient-to-l sm:from-white/90 sm:via-white/65 sm:to-transparent',
        center: 'sm:bg-white/55 sm:bg-radial sm:from-white/85 sm:via-white/55 sm:to-white/20',
        left: 'sm:bg-gradient-to-r sm:from-white/90 sm:via-white/65 sm:to-transparent',
      })
    }
    if (effectiveColor === 'brand') {
      return pick('bg-gradient-to-t from-slate-950/85 via-primary/70 to-transparent', {
        right: 'sm:bg-gradient-to-l sm:from-slate-950/85 sm:via-primary/60 sm:to-transparent',
        center: 'sm:bg-primary/45 sm:bg-radial sm:from-slate-950/80 sm:via-primary/50 sm:to-transparent',
        left: 'sm:bg-gradient-to-r sm:from-slate-950/85 sm:via-primary/60 sm:to-transparent',
      })
    }
    return pick('bg-gradient-to-t from-black/85 via-black/65 to-black/20', {
      right: 'sm:bg-gradient-to-l sm:from-black/85 sm:via-black/55 sm:to-transparent',
      center: 'sm:bg-black/45 sm:bg-radial sm:from-black/75 sm:via-black/45 sm:to-black/20',
      left: 'sm:bg-gradient-to-r sm:from-black/85 sm:via-black/55 sm:to-transparent',
    })
  }

  // Strong (default / classic)
  if (effectiveColor === 'white') {
    return pick('bg-gradient-to-t from-white/98 via-white/92 to-white/50', {
      right: 'sm:bg-gradient-to-l sm:from-white/98 sm:via-white/88 sm:to-transparent',
      center: 'sm:bg-white/75 sm:bg-radial sm:from-white/98 sm:via-white/88 sm:to-white/45',
      left: 'sm:bg-gradient-to-r sm:from-white/98 sm:via-white/88 sm:to-transparent',
    })
  }
  if (effectiveColor === 'brand') {
    return pick('bg-gradient-to-t from-slate-950 via-primary/85 to-primary/40', {
      right: 'sm:bg-gradient-to-l sm:from-slate-950 sm:via-primary/80 sm:to-primary/20',
      center: 'sm:bg-primary/70 sm:bg-radial sm:from-slate-950 sm:via-primary/80 sm:to-primary/35',
      left: 'sm:bg-gradient-to-r sm:from-slate-950 sm:via-primary/80 sm:to-primary/20',
    })
  }
  return pick('bg-gradient-to-t from-black/95 via-black/85 to-black/45', {
    right: 'sm:bg-gradient-to-l sm:from-black/95 sm:via-black/80 sm:to-black/25',
    center: 'sm:bg-black/60 sm:bg-radial sm:from-black/90 sm:via-black/75 sm:to-black/45',
    left: 'sm:bg-gradient-to-r sm:from-black/95 sm:via-black/80 sm:to-black/25',
  })
}

export const BARBERO_DEFAULT_HERO_GRADIENT =
  'linear-gradient(105deg, rgba(9,9,13,0.92) 0%, rgba(9,9,13,0.68) 52%, color-mix(in oklch, var(--primary) 28%, rgba(9,9,13,0.35)) 100%)'

export function shouldUseBarberoSignatureGradient(slide: {
  textTone?: SlideTextTone
  contentAlign?: SlideAlign
  overlayIntensity?: SlideOverlayIntensity
  overlayColor?: SlideOverlayColor
}): boolean {
  const tone = slide.textTone || 'light'
  const align = slide.contentAlign || 'left'
  const intensity = slide.overlayIntensity || 'strong'
  const color = slide.overlayColor || (tone === 'light' ? 'black' : 'white')
  return tone === 'light' && align === 'left' && intensity === 'strong' && color === 'black'
}
