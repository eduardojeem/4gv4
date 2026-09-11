import type { BusinessVertical } from '@/lib/organization/business-profile'

/**
 * Aspecto de la tienda online.
 *
 * Una tienda de ropa se veia igual que una de celulares: tarjetas apaisadas con
 * la foto achicada, categorias con iconos de electrodomesticos y una portada
 * con estadisticas de garantia y despacho. El aspecto cambia solo la
 * presentacion; no oculta secciones que el dueño configuro.
 *
 * `classic` es el aspecto de siempre y el valor por defecto donde no hay una
 * tienda resuelta (dashboard, marketplace), asi que ahi nada cambia.
 */
export const STOREFRONT_STYLE_PREFERENCES = ['auto', 'classic', 'fashion', 'sport'] as const

export type StorefrontStylePreference = (typeof STOREFRONT_STYLE_PREFERENCES)[number]
export type StorefrontStyle = Exclude<StorefrontStylePreference, 'auto'>

export const DEFAULT_STOREFRONT_STYLE: StorefrontStyle = 'classic'

/** Rubros que en «Automático» toman un aspecto propio; el resto queda clásico. */
const STYLE_BY_VERTICAL = new Map<BusinessVertical, StorefrontStyle>([['clothing', 'fashion']])

export function resolveStorefrontStyle(preference: unknown, businessVertical: unknown): StorefrontStyle {
  if (preference === 'classic' || preference === 'fashion' || preference === 'sport') return preference
  return STYLE_BY_VERTICAL.get(businessVertical as BusinessVertical) ?? DEFAULT_STOREFRONT_STYLE
}

export const STOREFRONT_STYLE_LABELS: Record<StorefrontStyle, string> = {
  classic: 'Clásico',
  fashion: 'Moda',
  sport: 'Deportivo',
}

export const STOREFRONT_STYLE_OPTIONS: ReadonlyArray<{
  value: StorefrontStylePreference
  label: string
  description: string
}> = [
  { value: 'auto', label: 'Automático', description: 'Se elige según el rubro de tu negocio.' },
  { value: 'classic', label: 'Clásico', description: 'Foto completa en tarjetas apaisadas. Para tecnología, ferretería o almacén.' },
  { value: 'fashion', label: 'Moda', description: 'Fotos verticales a sangre, títulos elegantes y categorías con foto.' },
  { value: 'sport', label: 'Deportivo', description: 'Fotos verticales, títulos grandes en mayúsculas y más contraste.' },
]

/** Fuera del aspecto clásico las fotos de producto van verticales y recortadas. */
export function usesPortraitMedia(style: StorefrontStyle) {
  return style !== 'classic'
}

// Las clases son literales para que Tailwind las detecte al compilar.

/** Titulos de seccion. */
export const STOREFRONT_HEADING_CLASS: Record<StorefrontStyle, string> = {
  classic: 'font-extrabold tracking-tight',
  fashion: 'font-serif font-normal tracking-tight',
  sport: 'font-black uppercase italic tracking-tighter',
}

/** Etiqueta chica sobre los titulos. */
export const STOREFRONT_EYEBROW_CLASS: Record<StorefrontStyle, string> = {
  classic: 'text-xs font-bold uppercase tracking-wider text-primary',
  fashion: 'text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground',
  sport: 'inline-block -skew-x-6 bg-primary px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-primary-foreground',
}

/** Esquinas de fotos y botones: moda va recto, deportivo apenas redondeado. */
export const STOREFRONT_RADIUS_CLASS: Record<StorefrontStyle, string> = {
  classic: 'rounded-xl',
  fashion: 'rounded-none',
  sport: 'rounded-md',
}
