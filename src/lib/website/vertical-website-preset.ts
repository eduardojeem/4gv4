import type { CheckoutSettings, CompanyInfo, ProcessFlow, TrustBarSettings, WebsiteSettings } from '@/types/website-settings'
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
}

const MODE_LABEL: Record<CheckoutSettings['commerceMode'], string> = {
  cart: 'carrito y pedidos en línea',
  whatsapp: 'consultas por WhatsApp',
  catalog: 'solo catálogo',
}

export function buildVerticalWebsitePreset(input: VerticalWebsitePresetInput): VerticalWebsitePreset {
  const { capabilities, effectiveModules } = input
  const family = guidanceFamily(capabilities)
  const defaults = getWebsiteDefaultsForVertical(input.vertical, input.model)
  const current = applyWebsiteSettingsDefaults(input.current)
  const summary: string[] = []

  // Plantilla en «Automático»: sigue al rubro. Las secciones de servicios y
  // reparaciones se ofrecen solo con su módulo.
  const companyInfo: CompanyInfo = {
    ...current.company_info,
    storefrontStyle: 'auto',
    servicesPageEnabled: capabilities.hasServices && Boolean(defaults.company_info?.servicesPageEnabled ?? input.model === 'service'),
    repairTrackingEnabled: capabilities.hasRepairs,
    processSectionEnabled: true,
  }
  summary.push('Plantilla en «Automático», según el rubro')

  // Portada: los textos del rubro que respetan los módulos (sin hablar de
  // reparaciones a quien no las tiene).
  const preset = HERO_PRESETS.find((item) => item.id === getCompatibleHeroPresetIds(capabilities)[0]) ?? HERO_PRESETS[HERO_PRESETS.length - 1]
  const heroContent = {
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

  // Los números de ejemplo quedan apagados: no son datos del negocio.
  const heroStats = { ...current.hero_stats, ...(defaults.hero_stats ?? {}), enabled: false }

  const trustBar: TrustBarSettings = {
    enabled: true,
    position: current.trust_bar?.position ?? 'above_carousel',
    items: TRUST_BAR_IDEAS[family].map((idea, index) => ({ ...idea, id: `vertical-${index + 1}`, active: true })),
  }
  summary.push('Beneficios de comprar en tu tienda')

  const templateId = PROCESS_TEMPLATES_BY_FAMILY[family][0]
  const template = PROCESS_STEP_TEMPLATES.find((item) => item.id === templateId)
  const processFlows: ProcessFlow[] = template
    ? [{ id: `vertical-${template.id}`, title: template.label, description: template.description, active: true, steps: createProcessStepsFromTemplate(template.id) }]
    : current.process_flows
  if (template) summary.push(`«Cómo atendés»: recorrido de ${template.label.toLowerCase()}`)

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
