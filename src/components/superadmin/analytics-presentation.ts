import type { SuperAdminAnalyticsData } from '@/lib/superadmin/analytics'

export type AnalyticsPeriod = '3m' | '6m' | '12m'

const PERIOD_MONTHS: Record<AnalyticsPeriod, number> = {
  '3m': 3,
  '6m': 6,
  '12m': 12,
}

export function selectAnalyticsPeriod(data: SuperAdminAnalyticsData, period: AnalyticsPeriod) {
  const months = PERIOD_MONTHS[period]
  const growth = data.growthData.slice(-months)
  const activity = data.activityData.slice(-months)
  const currentMonth = growth.at(-1)?.count ?? 0
  const previousMonth = growth.at(-2)?.count ?? 0
  const growthPercentage = previousMonth > 0
    ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100)
    : currentMonth > 0 ? 100 : 0

  return { growth, activity, currentMonth, previousMonth, growthPercentage }
}

export function buildAnalyticsCsvRows(data: SuperAdminAnalyticsData, period: AnalyticsPeriod) {
  const selected = selectAnalyticsPeriod(data, period)

  return [
    ['Métrica', 'Valor'],
    ['MRR', data.revenueData.mrr],
    ['ARR', data.revenueData.arr],
    ['Suscripciones activas', data.revenueData.activeSubscriptions],
    ['ARPS (promedio)', data.revenueData.averageRevenuePerSub],
    [],
    ['Mes', 'Nuevas organizaciones'],
    ...selected.growth.map((item) => [item.month, item.count]),
    [],
    ['Plan', 'Cantidad'],
    ...data.planDistribution.map((item) => [item.name, item.value]),
    [],
    ['Mes', 'Altas activas', 'Altas en otros estados'],
    ...selected.activity.map((item) => [item.month, item.activeRegistrations, item.otherRegistrations]),
    [],
    ['Organización', 'Personal registrado'],
    ...data.topOrganizations.map((organization) => [organization.name, organization.user_count]),
  ]
}
