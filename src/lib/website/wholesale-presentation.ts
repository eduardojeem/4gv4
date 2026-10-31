import {getWebsiteSettingsDefaults, getWebsiteDefaultsForVertical} from '@/lib/website/default-settings'
import type {WebsiteSettings} from '@/types/website-settings'
import type {StorefrontCapabilities} from '@/lib/website/storefront-capabilities'

/** Presets are not evidence of business promises. Preserve customized copy without mutating stored settings. */
export function wholesalePresentation(settings: WebsiteSettings, capabilities: StorefrontCapabilities) {
  const defaults = getWebsiteSettingsDefaults()
  const preset = getWebsiteDefaultsForVertical(capabilities.businessVertical, capabilities.operatingModel)
  const hero = settings.hero_content
  const inherited = (key: 'badge'|'title'|'subtitle') => hero?.[key] === defaults.hero_content[key] || hero?.[key] === preset.hero_content?.[key]
  const items = settings.trust_bar?.items ?? []
  const inheritedBenefits = [defaults.trust_bar?.items, preset.trust_bar?.items].some(defaultItems => JSON.stringify(defaultItems) === JSON.stringify(items))
  return {
    hero: {...hero, badge: inherited('badge') ? '' : hero?.badge, title: inherited('title') ? settings.company_info?.name || 'Catálogo' : hero?.title, subtitle: inherited('subtitle') ? '' : hero?.subtitle},
    benefits: inheritedBenefits ? undefined : settings.trust_bar,
  }
}
