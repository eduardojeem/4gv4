/**
 * Paleta de marca de la tienda publica.
 *
 * Vivia solo dentro de `CompanyInfoForm`, y el onboarding —que escribe el mismo
 * campo— no tenia forma de ofrecerla: le fijaba `'blue'` a mano en cada
 * guardado. Compartirla es lo que permite que las dos pantallas hablen del
 * mismo conjunto de opciones.
 */
export interface BrandColorOption {
  key: string
  name: string
  /** Clase de fondo para la muestra de color. */
  swatch: string
}

export const BRAND_COLORS: BrandColorOption[] = [
  { key: 'blue', name: 'Azul', swatch: 'bg-blue-500' },
  { key: 'green', name: 'Verde', swatch: 'bg-green-500' },
  { key: 'purple', name: 'Morado', swatch: 'bg-purple-500' },
  { key: 'orange', name: 'Naranja', swatch: 'bg-orange-500' },
  { key: 'red', name: 'Rojo', swatch: 'bg-red-500' },
  { key: 'indigo', name: 'Índigo', swatch: 'bg-indigo-500' },
  { key: 'teal', name: 'Teal', swatch: 'bg-teal-500' },
  { key: 'rose', name: 'Rosa', swatch: 'bg-rose-500' },
  { key: 'amber', name: 'Ámbar', swatch: 'bg-amber-500' },
  { key: 'emerald', name: 'Esmeralda', swatch: 'bg-emerald-500' },
  { key: 'cyan', name: 'Cian', swatch: 'bg-cyan-500' },
  { key: 'sky', name: 'Cielo', swatch: 'bg-sky-500' },
]

export const DEFAULT_BRAND_COLOR = 'blue'

export interface ExtraBrandColor {
  hex: string
  name: string
}

/**
 * Más tonos para la marca. No son claves nuevas: se guardan como color
 * personalizado (`brandColor: 'custom'` + `customBrandColor`), que ya funciona
 * en toda la tienda, el panel, los correos y la app. Todos tienen contraste de
 * al menos 4.5:1 con el texto blanco de los botones.
 */
export const EXTRA_BRAND_COLORS: ExtraBrandColor[] = [
  { hex: '#8B1E3F', name: 'Bordó' },
  { hex: '#6B1D2F', name: 'Vino' },
  { hex: '#C8473D', name: 'Coral' },
  { hex: '#B4532A', name: 'Terracota' },
  { hex: '#9A6A0B', name: 'Mostaza' },
  { hex: '#8A6D1E', name: 'Dorado' },
  { hex: '#556B2F', name: 'Oliva' },
  { hex: '#166534', name: 'Verde bosque' },
  { hex: '#047857', name: 'Jade' },
  { hex: '#0F5E6E', name: 'Petróleo' },
  { hex: '#3B5B85', name: 'Azul acero' },
  { hex: '#1E3A8A', name: 'Azul marino' },
  { hex: '#7457B8', name: 'Lavanda' },
  { hex: '#6D28D9', name: 'Violeta' },
  { hex: '#7E2A6E', name: 'Ciruela' },
  { hex: '#B21FB8', name: 'Fucsia' },
  { hex: '#6B3E26', name: 'Chocolate' },
  { hex: '#475569', name: 'Pizarra' },
  { hex: '#374151', name: 'Grafito' },
  { hex: '#111827', name: 'Negro' },
]

/** El tono extra que corresponde a un color personalizado, si es uno de la paleta. */
export function findExtraBrandColor(hex?: string | null): ExtraBrandColor | null {
  if (!hex) return null
  const normalized = hex.trim().toUpperCase()
  return EXTRA_BRAND_COLORS.find((color) => color.hex === normalized) ?? null
}

/** `custom` es valido: significa que el color real esta en `customBrandColor`. */
export function isKnownBrandColor(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return value === 'custom' || BRAND_COLORS.some((color) => color.key === value)
}
