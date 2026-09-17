import { BUSINESS_VERTICALS, OPERATING_MODELS } from '@/lib/organization/business-profile'
import { getWebsiteDefaultsForVertical, getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

/**
 * Los títulos de portada que vienen de la plantilla.
 *
 * Cada rubro tiene el suyo, y hay tiendas con textos de versiones anteriores.
 * La guía de configuración comparaba contra uno solo que ya no es el
 * predeterminado, y daba por hecha la portada de cualquier tienda nueva.
 */
const LEGACY_TEMPLATE_TITLES = ['Reparación profesional para tu equipo']

export function normalizeHeroTitle(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : ''
}

let cached: Set<string> | null = null

export function templateHeroTitles(): Set<string> {
  if (cached) return cached
  const titles = new Set<string>(LEGACY_TEMPLATE_TITLES.map(normalizeHeroTitle))
  titles.add(normalizeHeroTitle(getWebsiteSettingsDefaults().hero_content.title))
  for (const vertical of BUSINESS_VERTICALS) {
    for (const model of OPERATING_MODELS) {
      const title = getWebsiteDefaultsForVertical(vertical, model).hero_content?.title
      if (title) titles.add(normalizeHeroTitle(title))
    }
  }
  cached = titles
  return titles
}

/** Si el título es propio de la tienda y no de la plantilla. */
export function isCustomHeroTitle(value: unknown): boolean {
  const title = normalizeHeroTitle(value)
  return Boolean(title) && !templateHeroTitles().has(title)
}
