import { isValidBrandHexColor } from './brand-color'
import type { CSSProperties } from 'react'

export interface StorefrontBrandPalette {
  primary: string
  accent: string
  background: string
  text: string
}
export interface RecommendedBrandPalette extends StorefrontBrandPalette {
  id: string
  name: string
  style: 'elegante' | 'natural' | 'moderno' | 'calido' | 'llamativo'
  verticals: readonly string[]
  description: string
}
export const BRAND_PALETTES: readonly RecommendedBrandPalette[] = [
  { id: 'fuchsia', name: 'Fucsia elegante', style: 'elegante', primary: '#B21FB8', accent: '#7E2A6E', background: '#FFF8FD', text: '#29202A', verticals: ['cosmetics', 'beauty_services'], description: 'Una marca expresiva con fondos delicados para destacar tus productos.' },
  { id: 'rose-soft', name: 'Rosa suave', style: 'elegante', primary: '#DB2777', accent: '#7E3E5B', background: '#FFF1F5', text: '#3F2330', verticals: ['cosmetics', 'beauty_services'], description: 'Rosa y malva con fondos delicados para belleza y cuidado personal.' },
  { id: 'natural', name: 'Natural', style: 'natural', primary: '#476348', accent: '#A76A3D', background: '#FAF8F1', text: '#262E25', verticals: ['cosmetics', 'beauty_services', 'grocery', 'food'], description: 'Verdes y tierra para transmitir cuidado y cercanía.' },
  { id: 'lavender', name: 'Lavanda', style: 'moderno', primary: '#7457B8', accent: '#9B365D', background: '#FAF8FF', text: '#29243A', verticals: ['cosmetics', 'beauty_services'], description: 'Tonos suaves para belleza, bienestar y cuidado personal.' },
  { id: 'minimal', name: 'Minimalista', style: 'elegante', primary: '#374151', accent: '#7457B8', background: '#FAFAFC', text: '#202633', verticals: [], description: 'Superficies limpias que dejan el protagonismo a tus fotos.' },
  { id: 'barber', name: 'Barbería clásica', style: 'elegante', primary: '#6B3E26', accent: '#9A6A0B', background: '#FCF8F2', text: '#30251F', verticals: ['barber', 'barbershop', 'beauty_services'], description: 'Chocolate y dorado para servicios y atención personalizada.' },
  { id: 'studio', name: 'Estudio moderno', style: 'moderno', primary: '#0F5E6E', accent: '#6D28D9', background: '#F5FAFC', text: '#17343B', verticals: ['services', 'professional_services', 'barber', 'barbershop', 'hardware'], description: 'Petróleo y violeta para una imagen moderna y profesional.' },
  { id: 'tech', name: 'Tecnología', style: 'moderno', primary: '#1E3A8A', accent: '#047857', background: '#F5F8FE', text: '#202C45', verticals: ['electronics', 'technology', 'cellphone_repair', 'computer_repair'], description: 'Azul profundo y esmeralda para catálogo y soporte técnico.' },
  { id: 'warm', name: 'Cálido y cercano', style: 'calido', primary: '#B4532A', accent: '#556B2F', background: '#FFF9F1', text: '#38281F', verticals: ['food', 'restaurant', 'bakery', 'grocery'], description: 'Terracota y oliva para gastronomía y comercios de barrio.' },
  { id: 'bold', name: 'Impacto', style: 'llamativo', primary: '#BE123C', accent: '#1E40AF', background: '#FFF8FA', text: '#34212A', verticals: ['fashion', 'clothing', 'sport', 'general'], description: 'Rojo y azul para destacar novedades y colecciones.' },
]
const hex6 = (hex: string) => hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex
export function colorContrast(a: string, b: string): number {
  if (!isValidBrandHexColor(a) || !isValidBrandHexColor(b)) return 0
  const luminance = (hex: string) => {
    const rgb = hex6(hex).slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export function readableText(background: string): string {
  return colorContrast(background, '#FFFFFF') >= colorContrast(background, '#111827') ? '#FFFFFF' : '#111827'
}
/** Keep compatibility with existing templates whose hero/action labels are white. */
export function readableBrandAction(color: string): string {
  if (!isValidBrandHexColor(color)) return '#2563EB'
  let rgb = hex6(color).slice(1).match(/../g)!.map(c => parseInt(c, 16))
  let result = hex6(color)
  while (colorContrast(result, '#FFFFFF') < 4.5) {
    rgb = rgb.map(c => Math.floor(c * 0.94))
    result = '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('')
  }
  return result
}
export function isBrandPalette(value: unknown): value is StorefrontBrandPalette {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const palette = value as Record<string, unknown>
  return ['primary', 'accent', 'background', 'text'].every(key => typeof palette[key] === 'string' && isValidBrandHexColor(palette[key] as string))
    && colorContrast(palette.background as string, palette.text as string) >= 4.5
}
export function paletteColors(palette: StorefrontBrandPalette): StorefrontBrandPalette {
  return { primary: palette.primary, accent: palette.accent, background: palette.background, text: palette.text }
}
export function recommendedPalettes(vertical?: string | null): readonly RecommendedBrandPalette[] {
  const score = (palette: RecommendedBrandPalette) => palette.verticals.includes(vertical || '') ? 2 : palette.verticals.length === 0 ? 1 : 0
  return [...BRAND_PALETTES].sort((a, b) => score(b) - score(a))
}
export const PALETTE_VARIABLES = ['--store-palette-primary', '--store-palette-accent', '--store-palette-background', '--store-palette-text', '--store-palette-accent-text'] as const
export function brandPaletteStyle(palette: unknown): CSSProperties | undefined {
  if (!isBrandPalette(palette)) return undefined
  return {
    '--store-palette-primary': readableBrandAction(palette.primary),
    '--store-palette-accent': palette.accent,
    '--store-palette-background': palette.background,
    '--store-palette-text': palette.text,
    '--store-palette-accent-text': readableText(palette.accent),
  } as CSSProperties
}
/** Deterministic, local suggestion from decoded logo pixels; no image is uploaded. */
export function paletteFromPixels(pixels: ArrayLike<number>): StorefrontBrandPalette {
  const buckets = new Map<string, number>()
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 160) continue
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]]
    if (Math.max(...rgb) - Math.min(...rgb) < 18) continue
    const hex = '#' + rgb.map(c => Math.min(255, Math.round(c / 24) * 24).toString(16).padStart(2, '0')).join('')
    buckets.set(hex, (buckets.get(hex) || 0) + 1)
  }
  const colors = [...buckets].sort((a, b) => b[1] - a[1]).map(([hex]) => hex)
  const primary = colors[0] || '#374151'
  const accent = colors.find(hex => colorContrast(primary, hex) > 1.5) || '#7457B8'
  return { primary, accent, background: '#FAFAFC', text: '#202633' }
}
