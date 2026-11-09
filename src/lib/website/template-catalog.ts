/**
 * Catálogo de plantillas para el panel: todas las plantillas, agrupadas por
 * rubro, con el estado de cada una para esta tienda.
 *
 * - `available`: se puede elegir.
 * - `locked_plan`: el plan no la trae (se indica desde qué plan está).
 * - `unavailable`: no aplica al negocio (rubro, agenda o forma de venta), con el motivo.
 *
 * Lo comparten la grilla de /admin/website y el modal «Diseñá tu tienda».
 */
import {
  STOREFRONT_STYLE_LABELS,
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATE_GROUPS,
  STOREFRONT_TEMPLATES_METADATA,
  isStorefrontStyleAvailable,
  resolveStorefrontStyle,
  type StorefrontStyle,
  type StorefrontStyleContext,
  type StorefrontStylePreference,
  type StorefrontTemplateGroup,
  type StorefrontTemplateGroupId,
} from '@/lib/website/storefront-style'
import {
  STOREFRONT_TEMPLATE_TIER,
  cheapestPlanWithTemplate,
  isTemplateInPlan,
  type PlanTemplateSummary,
  type TemplateTier,
} from '@/lib/website/template-plan-access'

export type TemplateStatus = 'available' | 'locked_plan' | 'unavailable'

export interface TemplatePlanAccess {
  planName: string
  allowed: readonly StorefrontStylePreference[]
  plans: readonly PlanTemplateSummary[]
}

export interface TemplateCatalogOption {
  value: StorefrontStylePreference
  label: string
  /** Para «Automático», la plantilla que elige hoy; si no, el badge del tema. */
  subtitle: string
  description: string
  resolvedStyle: StorefrontStyle
  tier: TemplateTier
  status: TemplateStatus
  /** Por qué no se puede elegir. */
  reason?: string
  /** Plan más barato que la trae (solo si está bloqueada por plan). */
  upgradePlanName?: string
  isSuggested: boolean
  isRecommended: boolean
}

export interface TemplateCatalogGroup extends StorefrontTemplateGroup {
  options: TemplateCatalogOption[]
  availableCount: number
}

/** Grupo del rubro de la cuenta: se muestra primero, después de «Automático». */
const GROUP_BY_VERTICAL: Record<string, StorefrontTemplateGroupId> = {
  electronics: 'tech',
  clothing: 'fashion',
  cosmetics: 'beauty',
  barbershop: 'beauty',
  beauty_services: 'beauty',
  food: 'food',
  hardware: 'general',
  general: 'general',
  other: 'general',
}

const TIER_ORDER: Record<TemplateTier, number> = { base: 0, rubro: 1, premium: 2 }
const STATUS_ORDER: Record<TemplateStatus, number> = { available: 0, locked_plan: 1, unavailable: 2 }

function unavailableReason(style: StorefrontStylePreference, context: StorefrontStyleContext): string {
  if (style === 'catalog-basic') return 'Solo con la forma de venta «Catálogo» (sin carrito ni pedidos).'
  if (style === 'services' || style === 'barber') {
    return context.servicesAvailable === false
      ? 'Necesita la agenda de turnos (módulo Servicios).'
      : 'Pensada para negocios de turnos, no para tu rubro.'
  }
  if (context.catalogAvailable === false) return 'Tu negocio no vende productos.'
  return 'No encaja con el rubro de tu negocio.'
}

export function buildTemplateCatalog(input: {
  businessVertical?: string | null
  context: StorefrontStyleContext
  /** Plantilla guardada hoy: se puede conservar aunque el plan ya no la incluya. */
  savedValue?: StorefrontStylePreference
  suggestedStyle?: StorefrontStylePreference
  /** Sin datos del plan (cargando o error) no se bloquea nada: el servidor valida igual. */
  access?: TemplatePlanAccess | null
}): TemplateCatalogGroup[] {
  const { businessVertical, savedValue, suggestedStyle, access } = input
  const context = { businessVertical, ...input.context }
  const ownGroup = GROUP_BY_VERTICAL[String(businessVertical ?? '')] ?? 'general'

  const groups = STOREFRONT_TEMPLATE_GROUPS.map((group) => {
    const options = group.templateKeys.flatMap((key): TemplateCatalogOption[] => {
      const option = STOREFRONT_STYLE_OPTIONS.find((item) => item.value === key)
      if (!option) return []
      const resolvedStyle = resolveStorefrontStyle(key, businessVertical, context)
      const fitsBusiness = isStorefrontStyleAvailable(key, context)
      const inPlan = !access || key === savedValue || isTemplateInPlan(key, access.allowed, businessVertical, context)
      const status: TemplateStatus = !fitsBusiness ? 'unavailable' : inPlan ? 'available' : 'locked_plan'
      const upgradePlan = status === 'locked_plan' && access
        ? cheapestPlanWithTemplate(key, access.plans, businessVertical, context)
        : null
      return [{
        value: key,
        label: key === 'auto' ? 'Automático' : option.label,
        subtitle: key === 'auto'
          ? `Según tu rubro: ${STOREFRONT_STYLE_LABELS[resolvedStyle]}`
          : STOREFRONT_TEMPLATES_METADATA[resolvedStyle].badge,
        description: option.description,
        resolvedStyle,
        tier: STOREFRONT_TEMPLATE_TIER[key],
        status,
        reason: status === 'unavailable'
          ? unavailableReason(key, context)
          : status === 'locked_plan'
            ? upgradePlan
              ? `Disponible en el plan ${upgradePlan.name}.`
              : `No está incluida en tu plan ${access?.planName ?? ''}.`.replace(' .', '.')
            : undefined,
        upgradePlanName: upgradePlan?.name,
        isSuggested: key === suggestedStyle,
        isRecommended: context.commerceMode === 'catalog' && key === 'catalog-basic',
      }]
    })

    options.sort((a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      Number(b.isSuggested || b.isRecommended) - Number(a.isSuggested || a.isRecommended) ||
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
    )

    return { ...group, options, availableCount: options.filter((option) => option.status === 'available').length }
  })

  // «Automático» primero, después el grupo del rubro y el resto en su orden.
  return groups.sort((a, b) => {
    const rank = (group: TemplateCatalogGroup) => (group.id === 'auto' ? 0 : group.id === ownGroup ? 1 : 2)
    return rank(a) - rank(b)
  })
}
