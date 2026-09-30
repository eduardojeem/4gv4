import { deriveTechnicalModules } from './plan-modules'
import { PLAN_FEATURES } from './plan-feature-catalog'
import { PLAN_LIMIT_FIELDS, parsePlanLimit, type PlanLimitKey } from './plan-limits'

type Feature = { label?: string; value?: boolean | string }

export type PlanChangeImpact = {
  /** Módulos que las tiendas del plan dejan de tener. */
  removedModules: string[]
  addedModules: string[]
  /** Límites que bajan (null = ilimitado). */
  loweredLimits: Array<{ key: PlanLimitKey; label: string; before: number | null; after: number | null }>
}

const MODULE_LABEL = Object.fromEntries(
  PLAN_FEATURES.filter((feature) => feature.module).map((feature) => [feature.module as string, feature.label]),
)

export function moduleLabel(module: string): string {
  return MODULE_LABEL[module] ?? module
}

function isLower(before: number | null, after: number | null) {
  if (before === null) return after !== null // de ilimitado a un tope
  return after !== null && after < before
}

/**
 * Qué pierden las tiendas de un plan si se guarda este cambio.
 *
 * Guardar el plan cambia al instante lo que tienen todas sus tiendas: quitar
 * "Pedidos" a Gratis corta el carrito de todas las tiendas gratis. El editor lo
 * muestra antes de guardar en vez de dejarlo pasar sin aviso.
 */
export function computePlanChangeImpact(
  tier: string,
  before: { features: Feature[] | null | undefined; limits: Record<string, unknown> | null | undefined },
  after: { features: Feature[]; limits: Record<string, unknown> },
): PlanChangeImpact {
  const modulesBefore = new Set(deriveTechnicalModules(tier, before.features ?? []))
  const modulesAfter = new Set(deriveTechnicalModules(tier, after.features))

  const loweredLimits: PlanChangeImpact['loweredLimits'] = []
  for (const field of PLAN_LIMIT_FIELDS) {
    const previous = parsePlanLimit(before.limits?.[field.key])
    const next = parsePlanLimit(after.limits[field.key])
    // Un valor anterior ausente o inválido no permite comparar.
    if (previous === undefined || next === undefined) continue
    if (isLower(previous, next)) loweredLimits.push({ key: field.key, label: field.label, before: previous, after: next })
  }

  return {
    removedModules: [...modulesBefore].filter((module) => !modulesAfter.has(module)),
    addedModules: [...modulesAfter].filter((module) => !modulesBefore.has(module)),
    loweredLimits,
  }
}
