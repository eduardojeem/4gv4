import type { PlatformBranding } from './branding'

export type LogoHeightPreset = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Tamanos del logo en las barras de navegacion.
 *
 * Vivia duplicado en cada nav y ya habia derivado: el marketplace usaba
 * `h-10 sm:h-11` para 'md' y la landing `h-10 sm:h-12`, asi que el mismo ajuste
 * daba logos de distinto alto segun la pantalla. Una sola definicion evita eso.
 */
export const LOGO_HEIGHT_PRESETS: Record<LogoHeightPreset, { className: string; label: string; px: number }> = {
  sm: { className: 'h-8 sm:h-9 max-w-[160px]', label: 'Compacto', px: 36 },
  md: { className: 'h-10 sm:h-12 max-w-[220px]', label: 'Estándar', px: 48 },
  lg: { className: 'h-12 sm:h-14 max-w-[270px]', label: 'Grande', px: 56 },
  xl: { className: 'h-14 sm:h-16 max-w-[320px]', label: 'Extra grande', px: 64 },
}

export const MIN_LOGO_HEIGHT_PX = 24
export const MAX_LOGO_HEIGHT_PX = 96

export function clampLogoHeightPx(value: number): number {
  return Math.min(MAX_LOGO_HEIGHT_PX, Math.max(MIN_LOGO_HEIGHT_PX, Math.round(value)))
}

type LogoSize = { className: string; style?: React.CSSProperties }

/**
 * Clases y estilo para renderizar el logo.
 *
 * Un alto personalizado gana sobre el preset. Se aplica por `style` y no por
 * clase de Tailwind porque el valor es arbitrario y las clases se generan en
 * build: `h-[53px]` armado en runtime no existiria en el CSS final.
 */
export function resolveLogoSize(branding: Pick<PlatformBranding, 'logoHeight' | 'logoHeightPx'>): LogoSize {
  const custom = branding.logoHeightPx

  if (custom && custom > 0) {
    const height = clampLogoHeightPx(custom)
    return {
      className: 'w-auto object-contain',
      // El ancho maximo acompaña al alto para que un logo muy apaisado no
      // empuje al resto de la barra.
      style: { height: `${height}px`, maxWidth: `${Math.round(height * 5)}px` },
    }
  }

  const preset = LOGO_HEIGHT_PRESETS[branding.logoHeight ?? 'md'] ?? LOGO_HEIGHT_PRESETS.md
  return { className: `${preset.className} w-auto object-contain` }
}
