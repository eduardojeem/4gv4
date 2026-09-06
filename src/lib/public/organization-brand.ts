import { isValidBrandHexColor } from '@/lib/website/brand-color'

/**
 * El color de marca de una tienda, como valor de color.
 *
 * Es el mismo que la tienda eligió para su página pública en
 * /admin/website, así que la tarjeta del directorio se parece a lo que el
 * visitante va a encontrar si entra. Antes todas las tarjetas eran cian.
 *
 * `getBrandTheme` no sirve acá: devuelve clases de Tailwind —`from-blue-600`,
 * `bg-blue-100`— pensadas para el maquetado de la tienda, y no se pueden
 * componer con un color elegido a mano. Este mapa da un hex, que sirve tanto
 * para los doce colores del catálogo como para el `custom`.
 */

const BRAND_HEX: Record<string, string> = {
  blue: '#2563eb',
  green: '#16a34a',
  purple: '#9333ea',
  orange: '#ea580c',
  red: '#dc2626',
  indigo: '#4f46e5',
  teal: '#0d9488',
  rose: '#e11d48',
  amber: '#d97706',
  emerald: '#059669',
  cyan: '#0891b2',
  sky: '#0284c7',
}

export type OrganizationBrandInput = {
  brand_color?: string | null
  custom_brand_color?: string | null
}

/**
 * Devuelve null cuando la tienda no configuró nada: sin color propio es mejor
 * que la tarjeta use el del sitio que inventarle uno por el nombre.
 */
export function organizationAccentColor(org: OrganizationBrandInput): string | null {
  const elegido = (org.brand_color || '').toLowerCase().trim()

  if (elegido === 'custom') {
    return isValidBrandHexColor(org.custom_brand_color || undefined)
      ? (org.custom_brand_color as string)
      : null
  }

  // Una tienda puede tener guardado un hex directo en `brand_color`.
  if (isValidBrandHexColor(elegido)) return elegido

  return BRAND_HEX[elegido] ?? null
}

/**
 * Un fondo tenue del mismo color, para el chip o el avatar. Se arma con
 * transparencia sobre el color propio en vez de una segunda paleta: así
 * funciona igual con los doce del catálogo y con un hex cualquiera, y no hay
 * dos listas que puedan quedar desalineadas.
 */
export function organizationAccentSoft(color: string | null, alpha = 0.12): string | undefined {
  if (!color) return undefined
  const hex = color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color

  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return undefined

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
