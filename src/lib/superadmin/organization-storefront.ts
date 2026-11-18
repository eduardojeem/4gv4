import {
  STOREFRONT_STYLE_LABELS,
  STOREFRONT_STYLE_PREFERENCES,
  STOREFRONT_TEMPLATES_METADATA,
  type StorefrontHeaderStyle,
  type StorefrontStyle,
  type StorefrontStylePreference,
} from '@/lib/website/storefront-style'
import { isKnownBrandColor } from '@/lib/website/brand-colors'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
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
 * plan y cuáles no, con el plan más barato que las trae, y con qué aspecto
 * (color y encabezado) mostrar un ejemplo de cada una. Sin servidor, para
 * poder probarlo.
 */

export type StorefrontTemplateItem = {
  value: StorefrontStylePreference
  label: string
  /** La que tiene guardada la tienda. */
  current: boolean
  /** La plantilla concreta que se dibuja (en «Automático», la del rubro). */
  preview: StorefrontStyle
  /** La que el sistema propone para su rubro. */
  suggested: boolean
  tagline: string
}
export type StorefrontTierGroup = { tier: TemplateTier; label: string; templates: StorefrontTemplateItem[] }
export type StorefrontLockedTemplate = StorefrontTemplateItem & { availableIn: string | null; tierLabel: string }

/** Lo que la tienda tiene guardado de su aspecto, para que el ejemplo se parezca. */
export type StorefrontLookSnapshot = {
  brandColor: string
  customBrandColor?: string
  headerStyle: StorefrontHeaderStyle
  showTopBar: boolean
}

export type OrganizationStorefront = {
  chosen: StorefrontStylePreference
  chosenLabel: string
  /** La plantilla que se ve: en «Automático» depende del rubro. */
  resolved: StorefrontStylePreference
  resolvedLabel: string
  /** La plantilla concreta en uso, lista para dibujar su miniatura. */
  resolvedStyle: StorefrontStyle
  resolvedTagline: string
  resolvedDescription: string
  resolvedFeatures: readonly string[]
  isAuto: boolean
  /** La que el sistema sugiere para su rubro. */
  suggestedStyle: StorefrontStyle
  /** false: la conserva de un plan anterior, pero no podría volver a elegirla. */
  inPlan: boolean
  /** null: no se pudo leer el catálogo de planes. */
  enabled: StorefrontTierGroup[] | null
  notIncluded: StorefrontLockedTemplate[] | null
  look: StorefrontLookSnapshot
}

const labelOf = (style: StorefrontStylePreference) =>
  STOREFRONT_STYLE_LABELS[style as keyof typeof STOREFRONT_STYLE_LABELS] ?? style

const HEADER_STYLES: readonly StorefrontHeaderStyle[] = ['glass', 'solid', 'accent', 'dark']

export function chosenStorefrontStyle(companyInfo: unknown): StorefrontStylePreference {
  const value = companyInfo && typeof companyInfo === 'object' ? (companyInfo as { storefrontStyle?: unknown }).storefrontStyle : undefined
  return typeof value === 'string' && (STOREFRONT_STYLE_PREFERENCES as readonly string[]).includes(value)
    ? (value as StorefrontStylePreference)
    : 'auto'
}

/** Color, encabezado y barra de contacto guardados; sin dato, los valores por defecto de la tienda. */
export function storefrontLookFrom(companyInfo: unknown): StorefrontLookSnapshot {
  const info = companyInfo && typeof companyInfo === 'object' ? (companyInfo as Record<string, unknown>) : {}
  const brandColor = isKnownBrandColor(info.brandColor) ? String(info.brandColor) : 'blue'
  const customBrandColor = brandColor === 'custom' && typeof info.customBrandColor === 'string' && isValidBrandHexColor(info.customBrandColor)
    ? info.customBrandColor
    : undefined
  return {
    // Un «personalizado» sin color válido se ve como el azul por defecto.
    brandColor: brandColor === 'custom' && !customBrandColor ? 'blue' : brandColor,
    customBrandColor,
    headerStyle: HEADER_STYLES.includes(info.headerStyle as StorefrontHeaderStyle) ? (info.headerStyle as StorefrontHeaderStyle) : 'glass',
    showTopBar: info.showTopBar !== false,
  }
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
  const concrete = (style: StorefrontStylePreference) => templateToCheck(style, input.businessVertical, context) as StorefrontStyle
  const suggestedStyle = concrete('auto')
  const own = input.catalog?.find((plan) => plan.code === input.planCode) ?? null
  const allowed = own?.templates ?? null
  const activePlans = (input.catalog ?? []).filter((plan) => plan.isActive !== false)

  const item = (style: StorefrontStylePreference): StorefrontTemplateItem => {
    const preview = concrete(style)
    return {
      value: style,
      label: labelOf(style),
      current: style === chosen,
      preview,
      suggested: style !== 'auto' && style === suggestedStyle,
      tagline: style === 'auto'
        ? `Usa la del rubro: ${labelOf(preview)}`
        : STOREFRONT_TEMPLATES_METADATA[preview]?.tagline ?? '',
    }
  }

  const enabled = allowed
    ? (['base', 'rubro', 'premium'] as TemplateTier[])
        .map((tier) => ({
          tier,
          label: TEMPLATE_TIER_LABEL[tier],
          templates: allowed.filter((style) => STOREFRONT_TEMPLATE_TIER[style] === tier).map(item),
        }))
        .filter((group) => group.templates.length > 0)
    : null

  const notIncluded = allowed
    ? STOREFRONT_STYLE_PREFERENCES.filter((style) => style !== 'auto' && !allowed.includes(style)).map((style) => ({
        ...item(style),
        tierLabel: TEMPLATE_TIER_LABEL[STOREFRONT_TEMPLATE_TIER[style]],
        availableIn: cheapestPlanWithTemplate(style, activePlans, input.businessVertical, context)?.name ?? null,
      }))
    : null

  const resolvedStyle = concrete(chosen)
  const meta = STOREFRONT_TEMPLATES_METADATA[resolvedStyle]

  return {
    chosen,
    chosenLabel: labelOf(chosen),
    resolved,
    resolvedLabel: labelOf(resolved),
    resolvedStyle,
    resolvedTagline: meta?.tagline ?? '',
    resolvedDescription: meta?.description ?? '',
    resolvedFeatures: meta?.features ?? [],
    isAuto: chosen === 'auto',
    suggestedStyle,
    inPlan: allowed ? isTemplateInPlan(chosen, allowed, input.businessVertical, context) : true,
    enabled,
    notIncluded,
    look: storefrontLookFrom(input.companyInfo),
  }
}
