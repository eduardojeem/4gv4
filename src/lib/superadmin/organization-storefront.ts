import { STOREFRONT_STYLE_LABELS, STOREFRONT_STYLE_PREFERENCES, type StorefrontStylePreference } from '@/lib/website/storefront-style'
import {
  cheapestPlanWithTemplate,
  isTemplateInPlan,
  STOREFRONT_TEMPLATE_TIER,
  TEMPLATE_TIER_LABEL,
  templateToCheck,
  type PlanTemplateSummary,
  type TemplateTier,
} from '@/lib/website/template-plan-access'
import type { PlanCode } from '@/lib/saas/plan-features'

/**
 * La tienda de una organización vista desde Super Admin: qué plantilla usa
 * (y cuál termina mostrando si está en «Automático»), cuáles le habilita su
 * plan y cuáles no, con el plan más barato que las trae. Sin servidor, para
 * poder probarlo.
 */

export type StorefrontTemplateItem = { value: StorefrontStylePreference; label: string; current: boolean }
export type StorefrontTierGroup = { tier: TemplateTier; label: string; templates: StorefrontTemplateItem[] }

export type OrganizationStorefront = {
  chosen: StorefrontStylePreference
  chosenLabel: string
  /** La plantilla que se ve: en «Automático» depende del rubro. */
  resolved: StorefrontStylePreference
  resolvedLabel: string
  isAuto: boolean
  /** false: la conserva de un plan anterior, pero no podría volver a elegirla. */
  inPlan: boolean
  /** null: no se pudo leer el catálogo de planes. */
  enabled: StorefrontTierGroup[] | null
  notIncluded: { value: StorefrontStylePreference; label: string; availableIn: string | null }[] | null
}

const labelOf = (style: StorefrontStylePreference) =>
  STOREFRONT_STYLE_LABELS[style as keyof typeof STOREFRONT_STYLE_LABELS] ?? style

export function chosenStorefrontStyle(companyInfo: unknown): StorefrontStylePreference {
  const value = companyInfo && typeof companyInfo === 'object' ? (companyInfo as { storefrontStyle?: unknown }).storefrontStyle : undefined
  return typeof value === 'string' && (STOREFRONT_STYLE_PREFERENCES as readonly string[]).includes(value)
    ? (value as StorefrontStylePreference)
    : 'auto'
}

export function describeOrganizationStorefront(input: {
  companyInfo: unknown
  businessVertical: string | null | undefined
  servicesAvailable: boolean
  planCode: PlanCode
  /** Catálogo de planes con sus plantillas; null si no se pudo leer. */
  catalog: readonly (PlanTemplateSummary & { isActive?: boolean })[] | null
}): OrganizationStorefront {
  const context = { servicesAvailable: input.servicesAvailable }
  const chosen = chosenStorefrontStyle(input.companyInfo)
  const resolved = templateToCheck(chosen, input.businessVertical, context)
  const own = input.catalog?.find((plan) => plan.code === input.planCode) ?? null
  const allowed = own?.templates ?? null
  const activePlans = (input.catalog ?? []).filter((plan) => plan.isActive !== false)

  const enabled = allowed
    ? (['base', 'rubro', 'premium'] as TemplateTier[])
        .map((tier) => ({
          tier,
          label: TEMPLATE_TIER_LABEL[tier],
          templates: allowed
            .filter((style) => STOREFRONT_TEMPLATE_TIER[style] === tier)
            .map((style) => ({ value: style, label: labelOf(style), current: style === chosen })),
        }))
        .filter((group) => group.templates.length > 0)
    : null

  const notIncluded = allowed
    ? STOREFRONT_STYLE_PREFERENCES.filter((style) => style !== 'auto' && !allowed.includes(style)).map((style) => ({
        value: style,
        label: labelOf(style),
        availableIn: cheapestPlanWithTemplate(style, activePlans, input.businessVertical, context)?.name ?? null,
      }))
    : null

  return {
    chosen,
    chosenLabel: labelOf(chosen),
    resolved,
    resolvedLabel: labelOf(resolved),
    isAuto: chosen === 'auto',
    inPlan: allowed ? isTemplateInPlan(chosen, allowed, input.businessVertical, context) : true,
    enabled,
    notIncluded,
  }
}
