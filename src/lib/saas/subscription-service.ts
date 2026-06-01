import { createAdminSupabase } from '@/lib/supabase/admin'

export type ResourceType = 'users' | 'branches' | 'cashRegisters' | 'products' | 'categories'
export type PlanCode = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'

export interface PlanRecord {
  code: string
  slug: string | null
  name: string
  price_monthly: number
  price_note: string | null
  currency: string
  limits: Record<string, unknown>
  features: Record<string, unknown>
  modules: string[]
  is_active: boolean
}

export interface SubscriptionRecord {
  id: string
  organization_id: string
  plan: string
  status: string
  provider: string | null
  provider_customer_id: string | null
  provider_subscription_id: string | null
  external_reference: string | null
  payment_status: string | null
  last_payment_method: string | null
  started_at: string | null
  trial_ends_at: string | null
  current_period_starts_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean | null
  created_at: string | null
  updated_at: string | null
}

export interface BillingProfile {
  id?: string
  organization_id: string
  business_name: string | null
  ruc: string | null
  billing_email: string | null
  fiscal_address: string | null
  phone: string | null
}

export interface SubscriptionPayment {
  id: string
  organization_id: string
  subscription_id: string | null
  plan_id: string | null
  amount: number
  currency: string
  status: string
  payment_method: string | null
  provider: string | null
  provider_payment_id: string | null
  external_reference: string | null
  receipt_url: string | null
  paid_at: string | null
  created_at: string | null
}

export interface OrganizationUsage {
  users: number
  branches: number
  cashRegisters: number
  products: number
  categories: number
}

export interface OrganizationSubscriptionState {
  subscription: SubscriptionRecord | null
  currentPlan: PlanRecord
  plans: PlanRecord[]
  usage: OrganizationUsage
  billingProfile: BillingProfile | null
  payments: SubscriptionPayment[]
}

const DEFAULT_LIMITS: Record<PlanCode, Record<string, number | null>> = {
  FREE: { users: 2, branches: 1, cashRegisters: 1, products: 50, categories: null },
  BASIC: { users: 10, branches: 2, cashRegisters: 3, products: 500, categories: null },
  PRO: { users: 25, branches: 5, cashRegisters: 10, products: 5000, categories: null },
  ENTERPRISE: { users: null, branches: null, cashRegisters: null, products: null, categories: null },
}

const DEFAULT_PLAN: PlanRecord = {
  code: 'FREE',
  slug: 'free',
  name: 'Free',
  price_monthly: 0,
  price_note: 'Siempre gratis',
  currency: 'PYG',
  limits: DEFAULT_LIMITS.FREE,
  features: { marketplace: 'basic', analytics: 'limited' },
  modules: ['inventory', 'pos'],
  is_active: true,
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function normalizePlan(row: Record<string, unknown> | null | undefined): PlanRecord {
  if (!row) return DEFAULT_PLAN
  const code = String(row.code || 'FREE').toUpperCase() as PlanCode
  const fallbackLimits = DEFAULT_LIMITS[code] || DEFAULT_LIMITS.FREE

  return {
    code,
    slug: typeof row.slug === 'string' ? row.slug : code.toLowerCase(),
    name: typeof row.name === 'string' ? row.name : code,
    price_monthly: toNumber(row.price_monthly),
    price_note: typeof row.price_note === 'string' ? row.price_note : null,
    currency: typeof row.currency === 'string' ? row.currency : 'PYG',
    limits: typeof row.limits === 'object' && row.limits ? { ...fallbackLimits, ...row.limits } : fallbackLimits,
    features: typeof row.features === 'object' && row.features ? row.features as Record<string, unknown> : {},
    modules: Array.isArray(row.modules) ? row.modules.map(String) : [],
    is_active: row.is_active !== false,
  }
}

export function normalizePlanCode(value: unknown): PlanCode {
  const normalized = typeof value === 'string' ? value.toLowerCase().trim() : ''
  if (normalized === 'basic' || normalized === 'starter') return 'BASIC'
  if (normalized === 'pro' || normalized === 'professional' || normalized === 'profesional') return 'PRO'
  if (normalized === 'enterprise') return 'ENTERPRISE'
  return 'FREE'
}

export function getPlanLimit(plan: PlanRecord, resourceType: ResourceType): number | null {
  const value = plan.limits?.[resourceType]
  if (value === null || typeof value === 'undefined') return null
  const numeric = toNumber(value, Number.NaN)
  return Number.isFinite(numeric) ? numeric : null
}

export async function getPlanLimits(planCode: string): Promise<PlanRecord> {
  const supabase = createAdminSupabase()
  const code = planCode.toUpperCase()
  const [{ data }, { data: commercialData }] = await Promise.all([
    supabase
      .from('plans')
      .select('code, name, limits, modules, is_active')
      .eq('code', code)
      .maybeSingle(),
    supabase
      .from('subscription_plans')
      .select('tier, name, price, price_note, limits, features, is_active')
      .eq('tier', code.toLowerCase())
      .maybeSingle(),
  ])

  const [merged] = mergeCommercialPlans(
    data ? [data as Record<string, unknown>] : [{ ...DEFAULT_PLAN, code }],
    commercialData ? [commercialData as Record<string, unknown>] : []
  )

  return normalizePlan(merged)
}

function mergeCommercialPlans(
  planRows: Array<Record<string, unknown>>,
  commercialRows: Array<Record<string, unknown>>
) {
  const commercialByCode = new Map(
    commercialRows.map((row) => [normalizePlanCode(row.tier), row])
  )

  const merged = planRows.map((row) => {
    const code = normalizePlanCode(row.code)
    const commercial = commercialByCode.get(code)

    if (!commercial) return row

    return {
      ...row,
      slug: typeof commercial.tier === 'string' ? commercial.tier : row.slug,
      name: typeof commercial.name === 'string' ? commercial.name : row.name,
      price_monthly: commercial.price,
      price_note: commercial.price_note,
      currency: 'PYG',
      limits: typeof row.limits === 'object' && row.limits ? row.limits : commercial.limits,
      features: typeof commercial.features === 'object' && commercial.features ? commercial.features : row.features,
      is_active: commercial.is_active !== false && row.is_active !== false,
    }
  })

  for (const row of commercialRows) {
    const code = normalizePlanCode(row.tier)
    if (!merged.some((plan) => normalizePlanCode(plan.code) === code)) {
      merged.push({
        code,
        slug: row.tier,
        name: row.name,
        price_monthly: row.price,
        price_note: row.price_note,
        currency: 'PYG',
        limits: row.limits,
        features: row.features,
        modules: [],
        is_active: row.is_active,
      })
    }
  }

  return merged
}

async function countRows(table: string, organizationId: string) {
  const supabase = createAdminSupabase()
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (error) return 0
  return count || 0
}

export async function getOrganizationUsage(organizationId: string): Promise<OrganizationUsage> {
  const [users, branches, cashRegisters, products, categories] = await Promise.all([
    countRows('organization_members', organizationId),
    countRows('branches', organizationId),
    countRows('cash_registers', organizationId),
    countRows('products', organizationId),
    countRows('categories', organizationId),
  ])

  return { users, branches, cashRegisters, products, categories }
}

export async function getCommercialPlanPrices(): Promise<Record<string, number>> {
  const supabase = createAdminSupabase()
  const { data } = await supabase
    .from('subscription_plans')
    .select('tier, price, is_active')

  return Object.fromEntries(
    ((data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => row.is_active !== false)
      .map((row) => [normalizePlanCode(row.tier), toNumber(row.price)])
  )
}

export async function getCurrentOrganizationSubscription(organizationId: string): Promise<OrganizationSubscriptionState> {
  const supabase = createAdminSupabase()

  const [{ data: subscriptionData }, { data: organizationData }, { data: plansData }, { data: commercialPlansData }, usage, { data: billingData }, { data: paymentsData }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id, organization_id, plan, status, provider, provider_customer_id, provider_subscription_id, external_reference, payment_status, last_payment_method, started_at, trial_ends_at, current_period_starts_at, current_period_ends_at, cancel_at_period_end, created_at, updated_at')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .maybeSingle(),
    supabase
      .from('plans')
      .select('code, name, limits, modules, is_active')
      .eq('is_active', true)
      .order('code', { ascending: true }),
    supabase
      .from('subscription_plans')
      .select('tier, name, price, price_note, limits, features, is_active')
      .eq('is_active', true)
      .order('price', { ascending: true }),
    getOrganizationUsage(organizationId),
    supabase
      .from('billing_profiles')
      .select('id, organization_id, business_name, ruc, billing_email, fiscal_address, phone')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase
      .from('subscription_payments')
      .select('id, organization_id, subscription_id, plan_id, amount, currency, status, payment_method, provider, provider_payment_id, external_reference, receipt_url, paid_at, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const planRows = plansData ?? []
  const commercialRows = commercialPlansData ?? []
  const plans = mergeCommercialPlans(
    planRows as Array<Record<string, unknown>>,
    commercialRows as Array<Record<string, unknown>>
  )
    .map(normalizePlan)
    .sort((a, b) => a.price_monthly - b.price_monthly)
  const subscription = subscriptionData as SubscriptionRecord | null
  const organizationPlan = typeof organizationData?.plan === 'string' ? organizationData.plan : null
  const currentPlanCode = subscription?.plan || organizationPlan || plans[0]?.code || DEFAULT_PLAN.code
  const currentPlan = plans.find((plan) => plan.code === currentPlanCode) || normalizePlan({ ...DEFAULT_PLAN, code: currentPlanCode })

  return {
    subscription,
    currentPlan,
    plans,
    usage,
    billingProfile: billingData as BillingProfile | null,
    payments: (paymentsData ?? []) as SubscriptionPayment[],
  }
}

const BLOCKED_STATUSES = new Set(['past_due', 'suspended', 'cancelled', 'canceled', 'expired', 'unpaid'])

export async function getSubscriptionStatus(organizationId: string): Promise<{
  status: string | null
  isBlocked: boolean
  isTrialing: boolean
  trialDaysLeft: number | null
  periodDaysLeft: number | null
}> {
  const supabase = createAdminSupabase()
  const { data } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_ends_at')
    .eq('organization_id', organizationId)
    .maybeSingle()

  const status = data?.status ?? null
  const isBlocked = status ? BLOCKED_STATUSES.has(status) : false
  const isTrialing = status === 'trialing'
  let trialDaysLeft: number | null = null
  let periodDaysLeft: number | null = null

  if (isTrialing && data?.trial_ends_at) {
    const msLeft = new Date(data.trial_ends_at).getTime() - Date.now()
    trialDaysLeft = Math.max(0, Math.ceil(msLeft / 86400000))
  }

  if (status === 'active' && data?.current_period_ends_at) {
    const msLeft = new Date(data.current_period_ends_at).getTime() - Date.now()
    periodDaysLeft = Math.max(0, Math.ceil(msLeft / 86400000))
  }

  return { status, isBlocked, isTrialing, trialDaysLeft, periodDaysLeft }
}

export async function canCreateResource(
  organizationId: string,
  resourceType: ResourceType,
  increment = 1
): Promise<{ allowed: boolean; current: number; limit: number | null; plan: PlanRecord; blocked?: boolean }> {
  const [state, subscriptionStatus] = await Promise.all([
    getCurrentOrganizationSubscription(organizationId),
    getSubscriptionStatus(organizationId),
  ])

  if (subscriptionStatus.isBlocked) {
    return {
      allowed: false,
      current: state.usage[resourceType],
      limit: null,
      plan: state.currentPlan,
      blocked: true,
    }
  }

  const current = state.usage[resourceType]
  const limit = getPlanLimit(state.currentPlan, resourceType)

  return {
    allowed: limit === null || current + increment <= limit,
    current,
    limit,
    plan: state.currentPlan,
    blocked: false,
  }
}

export type PlanFeatureItem = {
  label: string
  iconName: string
  value: boolean | string
}

export type CommercialPlan = Omit<PlanRecord, 'features'> & {
  description: string | null
  is_popular: boolean
  highlights: string[]
  features: PlanFeatureItem[]
}

export async function getChangePlanData(organizationId: string): Promise<{
  currentPlan: CommercialPlan
  usage: OrganizationUsage
  plans: CommercialPlan[]
}> {
  const supabase = createAdminSupabase()

  const [{ data: subscriptionData }, { data: orgData }, { data: commercialData }, usage] = await Promise.all([
    supabase.from('subscriptions').select('plan, status').eq('organization_id', organizationId).maybeSingle(),
    supabase.from('organizations').select('plan').eq('id', organizationId).maybeSingle(),
    supabase
      .from('subscription_plans')
      .select('tier, name, price, price_note, description, is_popular, limits, highlights, features, is_active')
      .eq('is_active', true)
      .order('price', { ascending: true }),
    getOrganizationUsage(organizationId),
  ])

  const currentCode = (subscriptionData?.plan || orgData?.plan || 'FREE') as string

  const plans = ((commercialData ?? []) as Array<Record<string, unknown>>).map((row): CommercialPlan => {
    const code = normalizePlanCode(row.tier) as PlanCode
    const limits: Record<string, unknown> = DEFAULT_LIMITS[code] || DEFAULT_LIMITS.FREE
    return {
      code,
      slug: typeof row.tier === 'string' ? row.tier : code.toLowerCase(),
      name: typeof row.name === 'string' ? row.name : code,
      price_monthly: toNumber(row.price),
      price_note: typeof row.price_note === 'string' ? row.price_note : null,
      currency: 'PYG',
      limits,
      features: Array.isArray(row.features) ? (row.features as PlanFeatureItem[]) : [],
      modules: [],
      is_active: row.is_active !== false,
      description: typeof row.description === 'string' ? row.description : null,
      is_popular: row.is_popular === true,
      highlights: Array.isArray(row.highlights) ? row.highlights.map(String) : [],
    }
  })

  const base = normalizePlan({ code: currentCode })
  const fallbackPlan: CommercialPlan = { ...base, description: null, is_popular: false, highlights: [], features: [] }
  const currentPlan = plans.find((p) => p.code === normalizePlanCode(currentCode)) ?? fallbackPlan

  return { currentPlan, usage, plans }
}

export async function changePlan(
  organizationId: string,
  newPlanCode: string,
): Promise<{ success: true } | { success: false; error: string; conflictingResources?: Array<{ resource: string; current: number; limit: number }> }> {
  const supabase = createAdminSupabase()
  const code = normalizePlanCode(newPlanCode) as PlanCode
  const newLimits = DEFAULT_LIMITS[code]

  if (!newLimits) {
    return { success: false, error: 'Plan no válido.' }
  }

  const usage = await getOrganizationUsage(organizationId)
  const resourceLabels: Record<string, string> = {
    users: 'Usuarios', branches: 'Sucursales', cashRegisters: 'Cajas', products: 'Productos',
  }

  const conflictingResources: Array<{ resource: string; current: number; limit: number }> = []

  for (const [key, limit] of Object.entries(newLimits)) {
    if (limit === null) continue
    const current = usage[key as keyof OrganizationUsage] ?? 0
    if (current > limit) {
      conflictingResources.push({ resource: resourceLabels[key] || key, current, limit })
    }
  }

  if (conflictingResources.length > 0) {
    return { success: false, error: 'El uso actual supera los límites del plan destino.', conflictingResources }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      organization_id: organizationId,
      plan: code,
      status: 'active',
      updated_at: now,
    }, { onConflict: 'organization_id' })

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_log').insert({
    action: 'update',
    resource: 'subscriptions',
    new_values: { plan: code, organization_id: organizationId },
  })

  return { success: true }
}

export async function upsertBillingProfile(organizationId: string, profile: Omit<BillingProfile, 'id' | 'organization_id'>) {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('billing_profiles')
    .upsert(
      {
        organization_id: organizationId,
        ...profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )
    .select('id, organization_id, business_name, ruc, billing_email, fiscal_address, phone')
    .single()

  if (error) throw error
  return data as BillingProfile
}
