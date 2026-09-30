import { PLAN_FEATURES, PLAN_FEATURE_GROUP_LABEL, type PlanFeatureGroup } from '@/lib/saas/plan-feature-catalog'
import { PLAN_LIMIT_FIELDS, formatPlanLimit as formatPanelLimit, parsePlanLimit, type PlanLimitKey } from '@/lib/saas/plan-limits'
import { effectivePlanFeatures } from '@/lib/saas/plan-modules'

export type PlanFeature = {
  label: string
  iconName?: string
  value: string | boolean
}

export type PlanLimitValue = string | number | null | undefined

export type SubscriptionPlan = {
  id: string
  tier: string
  /** URL publica del plan. Es un campo propio y unico, no derivado del nombre:
   *  "Pro" y "PRO+" se limpiarian al mismo texto y la URL seria ambigua. */
  public_slug?: string | null
  name: string
  price: number
  price_note?: string | null
  description?: string | null
  is_popular?: boolean
  is_active: boolean
  custom?: boolean
  trial_days?: number | null
  limits?: Record<string, PlanLimitValue>
  highlights?: string[]
  features?: PlanFeature[]
  color_config?: unknown
}

export type PlanComparisonRow<T> = {
  key: string
  label: string
  values: Record<string, T>
}

export type PlanFeatureComparisonRow = PlanComparisonRow<boolean> & {
  group: PlanFeatureGroup
  hint: string
}

export type PlanFeatureComparisonGroup = {
  group: PlanFeatureGroup
  label: string
  rows: PlanFeatureComparisonRow[]
}

export function selectActivePlans(plans: SubscriptionPlan[] | undefined) {
  if (plans === undefined) return []
  return plans.filter((plan) => plan.is_active === true)
}

/**
 * Texto de un límite con el mismo formato que el panel ("10.000", "300/mes",
 * "Ilimitadas"). Antes se mostraba el texto guardado tal cual y un 0 de fotos
 * por reparación se leía como "0" en vez de "No incluye".
 */
export function publicLimitText(key: PlanLimitKey, raw: PlanLimitValue): string {
  if (raw === undefined || raw === '') return 'No especificado'
  const value = parsePlanLimit(raw)
  if (value === undefined) return String(raw)
  if (value === 0) return 'No incluye'
  return formatPanelLimit(key, value)
}

/** Formato suelto para valores fuera del catálogo de límites. */
export function formatPlanLimit(value: PlanLimitValue) {
  if (value === null) return 'Ilimitado'
  if (value === undefined || value === '') return 'No especificado'
  return String(value)
}

/** Los mismos 6 límites, con el mismo nombre y orden, que edita el superadmin. */
export function buildPlanLimitRows(plans: SubscriptionPlan[]): PlanComparisonRow<string>[] {
  return PLAN_LIMIT_FIELDS
    .filter((field) => plans.some((plan) => plan.limits && field.key in plan.limits))
    .map((field) => ({
      key: field.key,
      label: field.label,
      values: Object.fromEntries(plans.map((plan) => [plan.id, publicLimitText(field.key, plan.limits?.[field.key])])),
    }))
}

/**
 * Todas las funciones del catálogo, agrupadas, con lo que cada plan da de
 * verdad a las tiendas. Antes se listaban las etiquetas guardadas tal cual:
 * sin orden, con nombres viejos, y lo que faltaba en la lista no aparecía.
 */
export function buildPlanFeatureGroups(plans: SubscriptionPlan[]): PlanFeatureComparisonGroup[] {
  const included = new Map(plans.map((plan) => [plan.id, effectivePlanFeatures(plan.tier, plan.features)]))
  const groups: PlanFeatureGroup[] = ['venta', 'operacion', 'gestion', 'servicio']

  return groups.map((group) => ({
    group,
    label: PLAN_FEATURE_GROUP_LABEL[group],
    rows: PLAN_FEATURES.filter((feature) => feature.group === group).map((feature) => ({
      key: feature.key,
      label: feature.label,
      group,
      hint: feature.hint,
      values: Object.fromEntries(plans.map((plan) => [plan.id, Boolean(included.get(plan.id)?.[feature.key])])),
    })),
  }))
}

export function buildPlanFeatureRows(plans: SubscriptionPlan[]): PlanFeatureComparisonRow[] {
  return buildPlanFeatureGroups(plans).flatMap((group) => group.rows)
}
