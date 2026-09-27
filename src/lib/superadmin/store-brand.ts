import type { CSSProperties } from 'react'

/**
 * Pinta un bloque con el color de marca de una tienda.
 *
 * Usa el mismo mecanismo que la página pública (`data-color-scheme` o
 * `data-custom-brand` con `--brand-primary`), así `bg-primary` y `text-primary`
 * adentro del bloque toman el color de esa tienda y no el del panel. En modo
 * oscuro, `globals.css` aclara los colores propios casi negros, que son comunes.
 */

/** Los esquemas con nombre que define `globals.css`. */
const NAMED_SCHEMES = new Set([
  'blue', 'green', 'purple', 'orange', 'red', 'indigo', 'teal', 'rose', 'amber', 'emerald', 'cyan', 'sky', 'pink', 'corporate',
])

/** Solo colores hexadecimales: el valor termina dentro de un `style`. */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export type StoreBrandScope = {
  'data-color-scheme'?: string
  'data-custom-brand'?: ''
  style?: CSSProperties
}

export function storeBrandScope(brandColor: string | null | undefined, customBrandColor: string | null | undefined): StoreBrandScope {
  const custom = customBrandColor?.trim()
  if (brandColor === 'custom' && custom && HEX_COLOR.test(custom)) {
    return { 'data-custom-brand': '', style: { '--brand-primary': custom } as CSSProperties }
  }
  const scheme = brandColor?.trim().toLowerCase()
  // Sin color elegido, la página pública usa azul: la tarjeta también.
  return { 'data-color-scheme': scheme && NAMED_SCHEMES.has(scheme) ? scheme : 'blue' }
}

/** El nombre del color para mostrarlo en el detalle. */
export function describeStoreBrand(brandColor: string | null | undefined, customBrandColor: string | null | undefined): string {
  const custom = customBrandColor?.trim()
  if (brandColor === 'custom' && custom && HEX_COLOR.test(custom)) return `Propio (${custom.toUpperCase()})`
  const names: Record<string, string> = {
    blue: 'Azul', green: 'Verde', purple: 'Violeta', orange: 'Naranja', red: 'Rojo', indigo: 'Índigo', teal: 'Verde azulado',
    rose: 'Rosa', amber: 'Ámbar', emerald: 'Esmeralda', cyan: 'Cian', sky: 'Celeste', pink: 'Fucsia', corporate: 'Corporativo',
  }
  const scheme = brandColor?.trim().toLowerCase()
  return (scheme && names[scheme]) || 'Azul (por defecto)'
}
