/**
 * Plantillas de tienda habilitadas por plan.
 *
 * Super Admin asigna las plantillas a cada plan (tabla
 * `storefront_template_plan_access`). Si la tabla todavía no tiene la fila de un
 * plan, se usan los tres niveles por defecto: Basic (base), Pro (+ plantillas
 * de rubro) y Pro Max (+ premium).
 *
 * Reglas:
 * - «Automático» se habilita solo si la plantilla que elige para el rubro está
 *   en el plan; si no, un plan Basic recibiría una plantilla de Pro.
 * - Una tienda conserva la plantilla que ya usa aunque su plan no la incluya:
 *   lo que se bloquea es cambiar a otra que el plan no trae.
 *
 * Archivo puro (sin imports de servidor): lo usan el panel, Super Admin y las rutas.
 */
import type { PlanCode } from '@/lib/saas/plan-features'
import {
  STOREFRONT_STYLE_PREFERENCES,
  resolveStorefrontStyle,
  type StorefrontStyleContext,
  type StorefrontStylePreference,
} from '@/lib/website/storefront-style'

export type TemplateTier = 'base' | 'rubro' | 'premium'

/** Nivel de cada plantilla: ordena el catálogo y arma los valores por defecto. */
export const STOREFRONT_TEMPLATE_TIER: Record<StorefrontStylePreference, TemplateTier> = {
  auto: 'base',
  classic: 'base',
  'catalog-basic': 'base',
  modern: 'base',
  fashion: 'rubro',
  sport: 'rubro',
  tech: 'rubro',
  market: 'rubro',
  beauty: 'rubro',
  services: 'rubro',
  'informatica-electronica': 'premium',
  'wholesale-pro': 'premium',
  barber: 'premium',
}

export const TEMPLATE_TIER_LABEL: Record<TemplateTier, string> = {
  base: 'Esencial',
  rubro: 'De rubro',
  premium: 'Premium',
}

/** Orden de los planes, del más barato al más completo. */
export const PLAN_CODE_ORDER: readonly PlanCode[] = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE']

const TIERS_BY_PLAN: Record<PlanCode, readonly TemplateTier[]> = {
  FREE: ['base'],
  BASIC: ['base'],
  PRO: ['base', 'rubro'],
  ENTERPRISE: ['base', 'rubro', 'premium'],
}

export function defaultTemplatesForPlan(code: PlanCode): StorefrontStylePreference[] {
  const tiers = TIERS_BY_PLAN[code] ?? TIERS_BY_PLAN.BASIC
  return STOREFRONT_STYLE_PREFERENCES.filter((style) => tiers.includes(STOREFRONT_TEMPLATE_TIER[style]))
}

const VALID_TEMPLATES = new Set<string>(STOREFRONT_STYLE_PREFERENCES)

/** Deja solo plantillas conocidas, sin repetir y en el orden del catálogo. */
export function sanitizeTemplateList(value: unknown): StorefrontStylePreference[] {
  if (!Array.isArray(value)) return []
  const chosen = new Set(value.filter((item): item is string => typeof item === 'string' && VALID_TEMPLATES.has(item)))
  return STOREFRONT_STYLE_PREFERENCES.filter((style) => chosen.has(style))
}

export interface PlanTemplateAccessRow {
  plan_code: string
  templates: unknown
}

/** Plantillas de un plan: lo guardado por Super Admin o, sin fila, el nivel por defecto. */
export function templatesForPlan(code: PlanCode, rows: readonly PlanTemplateAccessRow[] | null | undefined): StorefrontStylePreference[] {
  const row = rows?.find((item) => item.plan_code === code)
  return row ? sanitizeTemplateList(row.templates) : defaultTemplatesForPlan(code)
}

/** La plantilla concreta que se evalúa: «Automático» se juzga por la que elige para el rubro. */
export function templateToCheck(
  style: StorefrontStylePreference,
  businessVertical: unknown,
  context: StorefrontStyleContext = {}
): StorefrontStylePreference {
  return style === 'auto' ? resolveStorefrontStyle('auto', businessVertical, context) : style
}

export function isTemplateInPlan(
  style: StorefrontStylePreference,
  allowed: readonly StorefrontStylePreference[],
  businessVertical?: unknown,
  context: StorefrontStyleContext = {}
): boolean {
  if (style === 'auto' && !allowed.includes('auto')) return false
  return allowed.includes(templateToCheck(style, businessVertical, context))
}

/**
 * ¿Se puede guardar este cambio de plantilla? Mantener la actual siempre se puede;
 * cambiar, solo a una plantilla del plan.
 */
export function canSwitchTemplate(input: {
  next: StorefrontStylePreference
  current: StorefrontStylePreference | null | undefined
  allowed: readonly StorefrontStylePreference[]
  businessVertical?: unknown
  context?: StorefrontStyleContext
}): boolean {
  if (input.current && input.next === input.current) return true
  return isTemplateInPlan(input.next, input.allowed, input.businessVertical, input.context)
}

export interface PlanTemplateSummary {
  code: PlanCode
  name: string
  templates: StorefrontStylePreference[]
}

/** El plan más barato que trae la plantilla, para el aviso «Disponible en Pro Max». */
export function cheapestPlanWithTemplate(
  style: StorefrontStylePreference,
  plans: readonly PlanTemplateSummary[],
  businessVertical?: unknown,
  context: StorefrontStyleContext = {}
): PlanTemplateSummary | null {
  const ordered = [...plans].sort((a, b) => PLAN_CODE_ORDER.indexOf(a.code) - PLAN_CODE_ORDER.indexOf(b.code))
  return ordered.find((plan) => isTemplateInPlan(style, plan.templates, businessVertical, context)) ?? null
}
