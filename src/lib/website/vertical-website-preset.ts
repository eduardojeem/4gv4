import type { CheckoutSettings, CompanyInfo, WebsiteSettings } from '@/types/website-settings'
import type { BusinessVertical, OperatingModel } from '@/lib/organization/business-profile'
import { applyWebsiteSettingsDefaults, getWebsiteDefaultsForVertical } from '@/lib/website/default-settings'
import { getCompatibleHeroPresetIds, type StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { HERO_PRESETS } from '@/lib/website/hero-presets'
import { PROCESS_STEP_TEMPLATES, createProcessStepsFromTemplate } from '@/lib/website/process-steps'
import {
  CHECKOUT_RECOMMENDATIONS,
  PROCESS_TEMPLATES_BY_FAMILY,
  TRUST_BAR_IDEAS,
  guidanceFamily,
} from '@/lib/website/vertical-guidance'
import { isTransferAccountComplete, transferAccounts } from '@/lib/checkout/cart-setup'
import { hasStoreWhatsapp } from '@/lib/whatsapp-number'
import { detectStorefrontContentAudit } from '@/lib/website/content-protection'
import { STOREFRONT_STYLE_LABELS } from '@/lib/website/storefront-style'

/**
 * La página pública lista para un rubro, como cuando se termina el alta, pero
 * sobre una tienda que ya existe: plantilla, portada, beneficios, «Cómo
 * atendés», reservas y cómo se vende. No toca nombre, logo, contacto,
 * productos ni cuentas: solo textos y opciones que dependen del rubro.
 */

export type PresetKey = 'company_info' | 'hero_content' | 'hero_stats' | 'trust_bar' | 'process_flows' | 'booking_section' | 'checkout'

export interface VerticalWebsitePreset {
  values: Partial<Pick<WebsiteSettings, PresetKey>>
  /** Qué se preparó, en palabras, para avisarle al dueño. */
  summary: string[]
}

export interface VerticalWebsitePresetInput {
  vertical: BusinessVertical
  model: OperatingModel
  capabilities: StorefrontCapabilities
  /** Módulos activos de la cuenta, para no ofrecer delivery o carrito sin ellos. */
  effectiveModules: readonly string[]
  current: Partial<WebsiteSettings>
  /**
   * Si es true, sobrescribe portadas o beneficios que hayan sido personalizados.
   * Por defecto es false: protege el contenido personalizado del usuario.
   */
  overwriteCustomContent?: boolean
  /**
   * Si es true, fuerza la plantilla a 'auto'.
   * Por defecto es false: preserva la plantilla si fue elegida manualmente.
   */
  resetStorefrontStyleToAuto?: boolean
}

const MODE_LABEL: Record<CheckoutSettings['commerceMode'], string> = {
  cart: 'carrito y pedidos en línea',
  whatsapp: 'consultas por WhatsApp',
  catalog: 'solo catálogo',
}

export function buildVerticalWebsitePreset(input: VerticalWebsitePresetInput): VerticalWebsitePreset {
  const { capabilities, effectiveModules, overwriteCustomContent = false, resetStorefrontStyleToAuto = false } = input
  const family = guidanceFamily(capabilities)
  const defaults = getWebsiteDefaultsForVertical(input.vertical, input.model)
  const current = applyWebsiteSettingsDefaults(input.current)
  const audit = detectStorefrontContentAudit(input.current)
  const summary: string[] = []

  // Preservación de plantilla manual:
  // Si el usuario eligió una plantilla manual (modern, tech, etc.), se preserva.
  // Solo se pasa a 'auto' si ya estaba en 'auto' (o vacía) o si se pidió explícitamente.
  const currentStyle = current.company_info?.storefrontStyle
  const isExplicitManualStyle = currentStyle && currentStyle !== 'auto'
  const targetStyle = !resetStorefrontStyleToAuto && isExplicitManualStyle ? currentStyle : 'auto'

  const companyInfo: CompanyInfo = {
    ...current.company_info,
    storefrontStyle: targetStyle,
    servicesPageEnabled: capabilities.hasServices && Boolean(defaults.company_info?.servicesPageEnabled ?? input.model === 'service'),
    repairTrackingEnabled: capabilities.hasRepairs,
    processSectionEnabled: true,
  }

  if (targetStyle !== 'auto') {
    summary.push(`Plantilla conservada: ${STOREFRONT_STYLE_LABELS[targetStyle] || targetStyle}`)
  } else {
    summary.push('Plantilla en «Automático», según el rubro')
  }

  // Portada: si tiene contenido personalizado y no se autorizó el reemplazo, se conserva.
  let heroContent = current.hero_content
  if (overwriteCustomContent || audit.sections.hero_content !== 'customized') {
    const preset = HERO_PRESETS.find((item) => item.id === getCompatibleHeroPresetIds(capabilities)[0]) ?? HERO_PRESETS[HERO_PRESETS.length - 1]
    heroContent = {
      ...current.hero_content,
      enabled: true,
      badge: preset.badge,
      title: preset.title,
      subtitle: preset.subtitle,
      ctaPrimaryText: preset.ctaPrimaryText,
      ctaSecondaryText: preset.ctaSecondaryText,
      trustBadges: [...preset.trustBadges],
    }
    summary.push('Textos de la portada')
  } else {
    summary.push('Portada personalizada conservada')
  }

  // Estadísticas: se mantienen apagadas y sin métricas ficticias de muestra.
  let heroStats = current.hero_stats
  if (overwriteCustomContent || audit.sections.hero_stats !== 'customized') {
    heroStats = {
      ...current.hero_stats,
      ...(defaults.hero_stats ?? {}),
      repairs: '',
      satisfaction: '',
      avgTime: '',
      enabled: false,
    }
  }

  // Beneficios / Trust Bar: protege contenido personalizado si existe
  let trustBar = current.trust_bar
  if (overwriteCustomContent || audit.sections.trust_bar !== 'customized') {
    trustBar = {
      enabled: true,
      position: current.trust_bar?.position ?? 'above_carousel',
      items: TRUST_BAR_IDEAS[family].map((idea, index) => ({ ...idea, id: `vertical-${index + 1}`, active: true })),
    }
    summary.push('Beneficios de comprar en tu tienda')
  } else {
    summary.push('Beneficios personalizados conservados')
  }

  // «Cómo atendés» / Process Flows: protege flujos personalizados si existen
  let processFlows = current.process_flows
  if (overwriteCustomContent || audit.sections.process_flows !== 'customized') {
    const templateId = PROCESS_TEMPLATES_BY_FAMILY[family][0]
    const template = PROCESS_STEP_TEMPLATES.find((item) => item.id === templateId)
    processFlows = template
      ? [{ id: `vertical-${template.id}`, title: template.label, description: template.description, active: true, steps: createProcessStepsFromTemplate(template.id) }]
      : current.process_flows
    if (template) summary.push(`«Cómo atendés»: recorrido de ${template.label.toLowerCase()}`)
  } else {
    summary.push('Recorrido de atención personalizado conservado')
  }

  const values: VerticalWebsitePreset['values'] = {
    company_info: companyInfo,
    hero_content: heroContent,
    hero_stats: heroStats,
    trust_bar: trustBar,
    process_flows: processFlows,
  }

  // Reservas en el inicio: los rubros de turnos, solo con la agenda activa.
  if (defaults.booking_section && capabilities.hasServices) {
    values.booking_section = { ...current.booking_section, ...defaults.booking_section }
    summary.push('Reservas online en el inicio')
  }

  values.checkout = recommendedCheckout(current.checkout!, current.company_info, family, effectiveModules)
  summary.push(`Venta por ${MODE_LABEL[values.checkout.commerceMode]}`)

  return { values, summary }
}

/**
 * La recomendación de cobro del rubro, posible con el plan y los datos que
 * hay: sin pedidos no hay carrito, sin WhatsApp no hay consultas, sin el
 * módulo de entregas no hay delivery. Transferencia y billetera se dejan como
 * estaban, salvo que estén activas sin cuentas o alias (no se podrían usar).
 */
function recommendedCheckout(
  checkout: CheckoutSettings,
  company: Partial<CompanyInfo>,
  family: ReturnType<typeof guidanceFamily>,
  modules: readonly string[],
): CheckoutSettings {
  const recommendation = CHECKOUT_RECOMMENDATIONS[family]
  const hasOrders = modules.includes('orders')
  const hasDelivery = modules.includes('delivery')
  const whatsapp = hasStoreWhatsapp(company)

  let mode = recommendation.mode
  if (mode === 'cart' && !hasOrders) mode = whatsapp ? 'whatsapp' : 'catalog'
  if (mode === 'whatsapp' && !whatsapp) mode = hasOrders ? 'cart' : 'catalog'

  const transfer = checkout.payment.transfer
  const transferUsable = transferAccounts(transfer).some(isTransferAccountComplete)
  const wallet = checkout.payment.digital_wallet
  const walletUsable = Boolean(wallet.walletAlias?.trim() || wallet.qrImageUrl?.trim())

  const next: CheckoutSettings = {
    ...checkout,
    commerceMode: mode,
    pickup: { ...checkout.pickup, enabled: recommendation.pickup, estimatedTime: checkout.pickup.estimatedTime || '20–30 min' },
    delivery: { ...checkout.delivery, enabled: recommendation.delivery && hasDelivery, estimatedTime: checkout.delivery.estimatedTime || '30–60 min' },
    payment: {
      ...checkout.payment,
      cash: { ...checkout.payment.cash, enabled: recommendation.cash },
      card: { ...checkout.payment.card, enabled: recommendation.card },
      transfer: { ...transfer, enabled: transfer.enabled && transferUsable },
      digital_wallet: { ...wallet, enabled: wallet.enabled && walletUsable },
    },
  }
  // El carrito siempre necesita una forma de pago y una de entrega.
  if (!next.pickup.enabled && !next.delivery.enabled) next.pickup = { ...next.pickup, enabled: true }
  const anyPayment = Object.values(next.payment).some((method) => method.enabled)
  if (!anyPayment) next.payment = { ...next.payment, cash: { ...next.payment.cash, enabled: true } }
  return next
}
