export type SaaSPlan = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'

export type SaaSModule =
  | 'inventory'
  | 'inventory_admin'
  | 'pos'
  | 'orders'
  | 'repairs'
  | 'services'
  | 'crm'
  | 'ecommerce'
  | 'delivery'
  | 'analytics'
  | 'credits'
  | 'promotions'
  | 'security'

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
    modules: ['inventory', 'pos', 'crm', 'services'],
  },
  BASIC: {
    users: 5,
    products: 1000,
    branches: 1,
    storageMb: 5120,
    modules: ['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'services', 'orders', 'delivery'],
  },
  PRO: {
    users: 20,
    products: 10000,
    branches: 5,
    storageMb: 51200,
    modules: ['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'promotions', 'security'],
  },
  ENTERPRISE: {
    users: null,
    products: null,
    branches: null,
    storageMb: null,
    modules: ['inventory', 'inventory_admin', 'pos', 'repairs', 'crm', 'ecommerce', 'services', 'orders', 'delivery', 'analytics', 'promotions', 'security'],
  },
}

export function isModuleEnabled(plan: SaaSPlan, module: SaaSModule) {
  return PLAN_LIMITS[plan].modules.includes(module)
}

export function isWithinPlanLimit(plan: SaaSPlan, key: keyof Omit<PlanLimits, 'modules'>, currentValue: number) {
  const limit = PLAN_LIMITS[plan][key]
  return limit === null || currentValue < limit
}
