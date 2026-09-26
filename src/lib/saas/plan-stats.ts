export type PlanPriceRow = { tier: string; price: number | string | null }
export type SubscriptionRow = { plan: string | null; status: string | null }

export type PlanStats = {
  orgsByPlan: Record<string, number>
  activeByPlan: Record<string, number>
  mrr: number
  activeSubs: number
  trialingSubs: number
  totalOrgs: number
  mostUsedPlan: string | null
  mostUsedPercent: number
}

/**
 * Agrega las metricas de la pantalla de planes.
 *
 * Vive aparte del route para poder ejercitarla: el MRR es un numero de negocio
 * y antes se calculaba solo con los precios de planes activos, de modo que las
 * organizaciones que seguian pagando un plan retirado aportaban cero y el
 * indicador mostraba menos facturacion de la real.
 */
export function computePlanStats(
  plans: PlanPriceRow[],
  subscriptions: SubscriptionRow[],
): PlanStats {
  const priceByTier = new Map<string, number>()
  for (const plan of plans) {
    priceByTier.set(String(plan.tier).toUpperCase(), Number(plan.price) || 0)
  }

  const orgsByPlan = new Map<string, number>()
  const activeByPlan = new Map<string, number>()
  let mrr = 0
  let activeSubs = 0
  let trialingSubs = 0

  for (const subscription of subscriptions) {
    const tier = (subscription.plan ?? 'FREE').toUpperCase()
    orgsByPlan.set(tier, (orgsByPlan.get(tier) ?? 0) + 1)

    if (subscription.status === 'active') {
      activeByPlan.set(tier, (activeByPlan.get(tier) ?? 0) + 1)
      mrr += priceByTier.get(tier) ?? 0
      activeSubs++
    }

    // Un trial todavia no factura: cuenta aparte y no suma al MRR.
    if (subscription.status === 'trialing') trialingSubs++
  }

  let mostUsedPlan: string | null = null
  let mostUsedCount = 0
  orgsByPlan.forEach((count, tier) => {
    if (count > mostUsedCount) {
      mostUsedCount = count
      mostUsedPlan = tier
    }
  })

  const totalOrgs = Array.from(orgsByPlan.values()).reduce((a, b) => a + b, 0)

  return {
    orgsByPlan: Object.fromEntries(orgsByPlan),
    activeByPlan: Object.fromEntries(activeByPlan),
    mrr,
    activeSubs,
    trialingSubs,
    totalOrgs,
    mostUsedPlan,
    mostUsedPercent: totalOrgs > 0 ? Math.round((mostUsedCount / totalOrgs) * 100) : 0,
  }
}
