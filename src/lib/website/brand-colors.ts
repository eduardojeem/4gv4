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

/** `custom` es valido: significa que el color real esta en `customBrandColor`. */
export function isKnownBrandColor(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return value === 'custom' || BRAND_COLORS.some((color) => color.key === value)
}
