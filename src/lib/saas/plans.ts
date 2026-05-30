export type SaaSPlan = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'

export type SaaSModule =
  | 'inventory'
  | 'pos'
  | 'repairs'
  | 'crm'
  | 'ecommerce'
  | 'delivery'
  | 'whatsapp'
  | 'analytics'

export interface PlanLimits {
  users: number | null
  products: number | null
  branches: number | null
  storageMb: number | null
  modules: SaaSModule[]
}

export const PLAN_LIMITS: Record<SaaSPlan, PlanLimits> = {
  FREE: {
    users: 2,
    products: 100,
    branches: 1,
    storageMb: 1024,
    modules: ['inventory', 'pos', 'crm'],
  },
  BASIC: {
    users: 5,
    products: 1000,
    branches: 1,
    storageMb: 5120,
    modules: ['inventory', 'pos', 'repairs', 'crm'],
  },
  PRO: {
    users: 20,
    products: 10000,
    branches: 5,
    storageMb: 51200,
    modules: ['inventory', 'pos', 'repairs', 'crm', 'ecommerce', 'whatsapp', 'analytics'],
  },
  ENTERPRISE: {
    users: null,
    products: null,
    branches: null,
    storageMb: null,
    modules: ['inventory', 'pos', 'repairs', 'crm', 'ecommerce', 'delivery', 'whatsapp', 'analytics'],
  },
}

export function isModuleEnabled(plan: SaaSPlan, module: SaaSModule) {
  return PLAN_LIMITS[plan].modules.includes(module)
}

export function isWithinPlanLimit(plan: SaaSPlan, key: keyof Omit<PlanLimits, 'modules'>, currentValue: number) {
  const limit = PLAN_LIMITS[plan][key]
  return limit === null || currentValue < limit
}
