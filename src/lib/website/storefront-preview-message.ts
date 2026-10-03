import { isKnownBrandColor } from '@/lib/website/brand-colors'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import { STOREFRONT_STYLE_PREFERENCES, type StorefrontHeaderStyle, type StorefrontStyle } from '@/lib/website/storefront-style'

/**
 * Protocolo entre el editor de /admin/website y la tienda embebida en su
 * vista previa. La tienda avisa que está lista y el editor le manda el
 * borrador (sin guardar) para pintarlo encima de lo publicado.
 */
export const STOREFRONT_PREVIEW_READY = 'STOREFRONT_PREVIEW_READY'
export const STOREFRONT_PREVIEW_UPDATE = 'STOREFRONT_PREVIEW_UPDATE'

export interface StorefrontPreviewDraft {
  style: StorefrontStyle
  brandColor: string
  customBrandColor?: string
  headerStyle: StorefrontHeaderStyle
  showTopBar: boolean
}

const HEADER_STYLES: readonly StorefrontHeaderStyle[] = ['glass', 'solid', 'accent', 'dark']

/** Devuelve el borrador solo si el mensaje es válido de punta a punta. */
export function parseStorefrontPreviewDraft(data: unknown): StorefrontPreviewDraft | null {
  if (!data || typeof data !== 'object') return null
  const message = data as Record<string, unknown>
  if (message.type !== STOREFRONT_PREVIEW_UPDATE) return null

  const { style, brandColor, customBrandColor, headerStyle, showTopBar } = message
  if (typeof style !== 'string' || style === 'auto' || !(STOREFRONT_STYLE_PREFERENCES as readonly string[]).includes(style)) return null
  if (!isKnownBrandColor(brandColor)) return null
  if (!HEADER_STYLES.includes(headerStyle as StorefrontHeaderStyle)) return null
  if (typeof showTopBar !== 'boolean') return null

  return {
    style: style as StorefrontStyle,
    brandColor: brandColor as string,
    customBrandColor: brandColor === 'custom' && typeof customBrandColor === 'string' && isValidBrandHexColor(customBrandColor)
      ? customBrandColor
      : undefined,
    headerStyle: headerStyle as StorefrontHeaderStyle,
    showTopBar,
  }
}
