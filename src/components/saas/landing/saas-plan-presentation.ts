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

const LIMIT_LABELS: Record<string, string> = {
  users: 'Usuarios y cajeros concurrentes',
  products: 'Productos en catálogo',
  services: 'Servicios en catálogo',
  branches: 'Sucursales comerciales permitidas',
  cashRegisters: 'Cajas registradoras',
  categories: 'Categorías',
  repairs: 'Órdenes de reparación por mes',
  storage: 'Almacenamiento',
  storageMb: 'Almacenamiento',
}

const LIMIT_ORDER = Object.keys(LIMIT_LABELS)

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (first) => first.toUpperCase())
}

export function selectActivePlans(plans: SubscriptionPlan[] | undefined) {
  if (plans === undefined) return []
  return plans.filter((plan) => plan.is_active === true)
}

export function formatPlanLimit(value: PlanLimitValue) {
  if (value === null) return 'Ilimitado'
  if (value === undefined || value === '') return 'No especificado'
  return String(value)
}

export function buildPlanLimitRows(plans: SubscriptionPlan[]): PlanComparisonRow<string>[] {
  const keys = Array.from(new Set(plans.flatMap((plan) => Object.keys(plan.limits ?? {}))))
    .sort((left, right) => {
      const leftIndex = LIMIT_ORDER.indexOf(left)
      const rightIndex = LIMIT_ORDER.indexOf(right)
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right)
      if (leftIndex === -1) return 1
      if (rightIndex === -1) return -1
      return leftIndex - rightIndex
    })

  return keys.map((key) => ({
    key,
    label: LIMIT_LABELS[key] ?? humanizeKey(key),
    values: Object.fromEntries(plans.map((plan) => [plan.id, formatPlanLimit(plan.limits?.[key])])),
  }))
}

export function buildPlanFeatureRows(
  plans: SubscriptionPlan[],
): PlanComparisonRow<string | boolean>[] {
  const rows = new Map<string, PlanComparisonRow<string | boolean>>()

  for (const plan of plans) {
    for (const feature of plan.features ?? []) {
      if (!feature.label?.trim()) continue
      const key = normalized(feature.label)
      const row = rows.get(key) ?? { key, label: feature.label.trim(), values: {} }
      row.values[plan.id] = feature.value
      rows.set(key, row)
    }
  }

  for (const row of rows.values()) {
    for (const plan of plans) {
      if (!(plan.id in row.values)) row.values[plan.id] = false
    }
  }

  return Array.from(rows.values())
}
