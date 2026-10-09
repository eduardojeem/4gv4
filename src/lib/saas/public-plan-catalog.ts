type CommercialPlan = { tier: string; is_active: boolean }
type TechnicalPlan = {
  code: string
  is_active: boolean
  limits: Record<string, string | number | null> | null
  modules: string[] | null
}

/** No anuncia capacidad ni módulos que no estén configurados operativamente. */
export function mergePublicPlanCatalog<T extends CommercialPlan>(commercial: T[], technical: TechnicalPlan[]) {
  const byCode = new Map(technical.map(plan => [plan.code.toUpperCase(), plan]))
  return commercial.flatMap(plan => {
    const operational = byCode.get(plan.tier.toUpperCase())
    if (!plan.is_active || !operational?.is_active || !operational.limits || !Array.isArray(operational.modules)) return []
    return [{ ...plan, limits: { ...operational.limits }, modules: [...operational.modules] }]
  })
}
