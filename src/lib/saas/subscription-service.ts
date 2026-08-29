import { createAdminSupabase } from '@/lib/supabase/admin'
import { evaluateSubscriptionStatus } from '@/lib/saas/subscription-status'
import type { ModuleTrial } from './plan-features'
import { buildOrganizationBusinessProfile } from './effective-modules'
import type {
  BusinessVertical,
  OperatingModel,
  OrganizationModule,
} from '@/lib/organization/business-profile'
import { ORGANIZATION_MODULES } from '@/lib/organization/business-profile'

export type ResourceType = 'users' | 'branches' | 'cashRegisters' | 'products' | 'categories' | 'repairs' | 'services'
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
  is_popular?: boolean
  /**
   * true cuando no se encontro el plan en la tabla `plans` y se sirvieron los
   * limites del plan Free con el codigo de la organizacion. Sin esta marca la
   * pantalla decia "Plan BASIC" mientras el sistema aplicaba 50 productos, y no
   * habia forma de notarlo desde la interfaz.
   */
  limits_are_fallback?: boolean
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
  repairs: number
  services: number
}

export interface OrganizationSubscriptionState {
  subscription: SubscriptionRecord | null
  currentPlan: PlanRecord
  plans: PlanRecord[]
  usage: OrganizationUsage
  billingProfile: BillingProfile | null
  payments: SubscriptionPayment[]
  promoRedemptions?: Array<{
    id: string
    promo_code_id?: string | null
    redeemed_at?: string | null
    benefit_snapshot?: Record<string, unknown> | null
    redeemed_by?: string | null
  }>
}

// Fallback de seguridad. La fuente de verdad es la tabla `plans` (sincronizada desde
// subscription_plans por trigger); estos valores solo se usan si la DB no devuelve límites.
export const DEFAULT_LIMITS: Record<PlanCode, Record<string, number | null>> = {
  FREE: { users: 2, branches: 1, cashRegisters: 1, products: 50, categories: null, repairs: 20, services: 50 },
  BASIC: { users: 10, branches: 2, cashRegisters: 3, products: 500, categories: null, repairs: 150, services: 200 },
  PRO: { users: 25, branches: 5, cashRegisters: 10, products: 5000, categories: null, repairs: null, services: 5000 },
  ENTERPRISE: { users: null, branches: null, cashRegisters: null, products: null, categories: null, repairs: null, services: null },
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
    is_popular: row.is_popular === true,
    limits_are_fallback: row.limits_are_fallback === true,
  }
}

/**
 * Plan de respaldo cuando la fila no esta en la tabla `plans`.
 *
 * `DEFAULT_PLAN` lleva los limites de Free. Spreadearlo tal cual dejaba a una
 * organizacion BASIC operando con 50 productos —el cupo de Free— mientras la
 * pantalla mostraba su plan real, sin ninguna senal. El respaldo correcto son
 * los defaults de SU plan, y queda marcado para poder avisarlo.
 */
export function buildFallbackPlan(planCode: string): PlanRecord {
  const fallbackCode = normalizePlanCode(planCode)
  return normalizePlan({
    ...DEFAULT_PLAN,
    code: planCode,
    limits: DEFAULT_LIMITS[fallbackCode] ?? DEFAULT_LIMITS.FREE,
    limits_are_fallback: true,
  })
}

export function normalizePlanCode(value: unknown): PlanCode {
  const normalized = typeof value === 'string' ? value.toLowerCase().trim() : ''
  if (normalized === 'basic' || normalized === 'starter') return 'BASIC'
  if (normalized === 'pro' || normalized === 'professional' || normalized === 'profesional') return 'PRO'
  if (normalized === 'enterprise') return 'ENTERPRISE'
  return 'FREE'
}

const SUPPORTED_PLAN_CODES = new Set([
  'free',
  'basic',
  'starter',
  'pro',
  'professional',
  'profesional',
  'enterprise',
])

export function isSupportedPlanCode(value: unknown) {
  if (typeof value !== 'string') return false
  return SUPPORTED_PLAN_CODES.has(value.toLowerCase().trim())
}

export function getPlanLimit(plan: Pick<PlanRecord, 'limits'>, resourceType: ResourceType): number | null {
  const value = plan.limits?.[resourceType]
  if (value === null || typeof value === 'undefined') return null
  const numeric = toNumber(value, Number.NaN)
  return Number.isFinite(numeric) ? numeric : null
}

export function planRequiresPayment(plan: Pick<PlanRecord, 'price_monthly'>) {
  return Number(plan.price_monthly) > 0
}

export async function getPlanLimits(planCode: string): Promise<PlanRecord> {
  const supabase = createAdminSupabase()
  const code = planCode.toUpperCase()
  const [technicalResult, commercialResult] = await Promise.all([
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
  if (technicalResult.error) {
    throw new Error(`No se pudo cargar el plan técnico: ${technicalResult.error.message}`)
  }
  if (commercialResult.error) {
    throw new Error(`No se pudo cargar el plan comercial: ${commercialResult.error.message}`)
  }

  const [merged] = mergeCommercialPlans(
    technicalResult.data ? [technicalResult.data as Record<string, unknown>] : [{ ...DEFAULT_PLAN, code }],
    commercialResult.data ? [commercialResult.data as Record<string, unknown>] : []
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
      is_popular: commercial.is_popular === true,
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
        is_popular: row.is_popular === true,
      })
    }
  }

  return merged
}

/**
 * Productos que ocupan cupo.
 *
 * Lo archivado por el ciclo de baja de plan no cuenta: si contara, la
 * organizacion quedaria trabada para siempre —archivar no liberaria espacio— y
 * el ciclo no tendria sentido.
 */
async function countActiveProducts(organizationId: string) {
  const supabase = createAdminSupabase()
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('archived_by_plan_at', null)

  if (error) {
    throw new Error(`No se pudo contar products: ${error.message}`)
  }
  return count || 0
}

async function countRows(table: string, organizationId: string) {
  const supabase = createAdminSupabase()
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(`No se pudo contar ${table}: ${error.message}`)
  }
  return count || 0
}

async function countCashRegisters(organizationId: string) {
  const supabase = createAdminSupabase()
  const { data: branches, error: branchesError } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)

  if (branchesError) {
    throw new Error(`No se pudieron cargar las sucursales: ${branchesError.message}`)
  }

  const branchIds = (branches ?? [])
    .map((branch) => String(branch.id))
    .filter(Boolean)

  if (branchIds.length === 0) return 0

  const { count, error } = await supabase
    .from('cash_registers')
    .select('id', { count: 'exact', head: true })
    .in('branch_id', branchIds)

  if (error) {
    throw new Error(`No se pudieron contar las cajas: ${error.message}`)
  }
  return count || 0
}

// Las "butacas" del plan cuentan solo staff activo. Los clientes (role 'customer')
// se registran desde la pública y no consumen límite; staff suspendido se conserva
// como histórico y puede reactivarse cuando haya cupo.
async function countStaffMembers(organizationId: string) {
  const supabase = createAdminSupabase()
  const { count, error } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .neq('role', 'customer')
    .eq('status', 'active')

  if (error) {
    throw new Error(`No se pudieron contar los usuarios: ${error.message}`)
  }
  return count || 0
}

async function countServices(organizationId: string) {
  const supabase = createAdminSupabase()
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('unit_measure', 'servicio')

  if (error) {
    throw new Error(`No se pudieron contar los servicios: ${error.message}`)
  }
  return count || 0
}

export async function getOrganizationUsage(organizationId: string): Promise<OrganizationUsage> {
  const [users, branches, cashRegisters, products, categories, repairs, services] = await Promise.all([
    countStaffMembers(organizationId),
    countRows('branches', organizationId),
    countCashRegisters(organizationId),
    countActiveProducts(organizationId),
    countRows('categories', organizationId),
    countRows('repairs', organizationId),
    countServices(organizationId)
  ])

  return { users, branches, cashRegisters, products, categories, repairs, services }
}

export async function getCommercialPlanPrices(): Promise<Record<string, number>> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('tier, price, is_active')

  if (error) {
    throw new Error(`No se pudieron cargar los precios de los planes: ${error.message}`)
  }

  return Object.fromEntries(
    ((data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => row.is_active !== false)
      .map((row) => [normalizePlanCode(row.tier), toNumber(row.price)])
  )
}

async function applyScheduledDowngradeIfDue(organizationId: string) {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, cancel_at_period_end, current_period_ends_at')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(`No se pudo validar el vencimiento de la suscripción: ${error.message}`)

  const periodEnded = data?.current_period_ends_at
    ? new Date(data.current_period_ends_at).getTime() <= Date.now()
    : false

  if (!data?.cancel_at_period_end || !periodEnded || normalizePlanCode(data.plan) === 'FREE') {
    return false
  }

  const { data: applied, error: applyError } = await supabase.rpc('apply_free_subscription_plan', {
    p_organization_id: organizationId,
    p_plan: 'FREE',
  })

  if (applyError || applied !== true) {
    throw new Error(applyError?.message || 'No se pudo aplicar la cancelación programada.')
  }

  await openProductGraceIfOverLimit(organizationId, 'FREE')

  return true
}

/**
 * Abre la ventana de regularizacion si el catalogo activo supera el cupo del
 * plan nuevo.
 *
 * Se llama al aplicar una baja: si no hay excedente la funcion cierra cualquier
 * ciclo abierto, asi que tambien sirve para dar por regularizada a una
 * organizacion que volvio a entrar en su cupo.
 */
export type ProductGraceStatus = {
  stage: 'grace' | 'deactivated' | 'archived'
  productLimit: number
  activeProducts: number
  excessProducts: number
  daysLeft: number
}

/**
 * Etapa del ciclo de regularizacion, para mostrarla en la pantalla de
 * suscripcion. Devuelve null cuando no hay ciclo abierto.
 */
export async function getProductGraceStatus(
  organizationId: string
): Promise<ProductGraceStatus | null> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('plan_downgrade_grace')
    .select('stage, product_limit, active_products_at_start, grace_ends_at, archive_deadline_at')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    console.error('[subscription] No se pudo leer el ciclo de regularizacion', { organizationId, error })
    return null
  }
  if (!data || data.stage === 'resolved') return null

  const stage = data.stage as ProductGraceStatus['stage']
  const deadline = stage === 'grace' ? data.grace_ends_at : data.archive_deadline_at
  const daysLeft = deadline
    ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000))
    : 0

  const productLimit = Number(data.product_limit) || 0
  const activeProducts = Number(data.active_products_at_start) || 0

  return {
    stage,
    productLimit,
    activeProducts,
    excessProducts: Math.max(0, activeProducts - productLimit),
    daysLeft,
  }
}

export async function openProductGraceIfOverLimit(
  organizationId: string,
  planCode: string
): Promise<void> {
  const supabase = createAdminSupabase()
  const plan = await getPlanLimits(normalizePlanCode(planCode))
  const productLimit = getPlanLimit(plan, 'products')

  if (productLimit === null) return // plan sin limite

  const { error } = await supabase.rpc('open_plan_downgrade_grace', {
    p_organization_id: organizationId,
    p_plan_code: plan.code,
    p_product_limit: productLimit,
  })

  if (error) {
    // No se corta la baja por esto: el barrido periodico lo vuelve a evaluar.
    console.error('[subscription] No se pudo abrir la ventana de regularizacion de productos', {
      organizationId,
      planCode,
      error,
    })
  }
}

/**
 * Da por regularizado el ciclo y reactiva lo que se habia apagado.
 * Se invoca al subir de plan o al registrarse un pago.
 */
export async function resolveProductGrace(organizationId: string): Promise<number> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase.rpc('resolve_plan_downgrade_grace', {
    p_organization_id: organizationId,
  })

  if (error) {
    console.error('[subscription] No se pudo regularizar el ciclo de productos', { organizationId, error })
    return 0
  }
  return Number(data) || 0
}

export async function getCurrentOrganizationSubscription(organizationId: string): Promise<OrganizationSubscriptionState> {
  await applyScheduledDowngradeIfDue(organizationId)
  const supabase = createAdminSupabase()

  const [
    subscriptionResult,
    organizationResult,
    plansResult,
    commercialPlansResult,
    usage,
    billingResult,
    paymentsResult,
    redemptionsResult,
  ] = await Promise.all([
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
      .select('tier, name, price, price_note, is_popular, limits, features, is_active')
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
    supabase
      .from('subscription_promo_redemptions')
      .select('id, promo_code_id, redeemed_at, benefit_snapshot, redeemed_by')
      .eq('organization_id', organizationId)
      .order('redeemed_at', { ascending: false })
  ])

  const queryError = [
    subscriptionResult.error,
    organizationResult.error,
    plansResult.error,
    commercialPlansResult.error,
    billingResult.error,
    paymentsResult.error,
    redemptionsResult.error,
  ].find(Boolean)
  if (queryError) {
    throw new Error(`No se pudo cargar la suscripción: ${queryError.message}`)
  }

  const planRows = plansResult.data ?? []
  const commercialRows = commercialPlansResult.data ?? []
  const plans = mergeCommercialPlans(
    planRows as Array<Record<string, unknown>>,
    commercialRows as Array<Record<string, unknown>>
  )
    .map(normalizePlan)
    .sort((a, b) => a.price_monthly - b.price_monthly)
  const subscription = subscriptionResult.data as SubscriptionRecord | null
  const organizationPlan = typeof organizationResult.data?.plan === 'string' ? organizationResult.data.plan : null
  const currentPlanCode = subscription?.plan || organizationPlan || plans[0]?.code || DEFAULT_PLAN.code
  const resolvedPlan = plans.find((plan) => plan.code === currentPlanCode)
  if (!resolvedPlan) {
    // No es un detalle menor: la organizacion queda operando con limites de Free
    // aunque figure en otro plan.
    console.error('[subscription] Plan no encontrado en la tabla `plans`; se aplican limites Free', {
      organizationId,
      currentPlanCode,
      availablePlanCodes: plans.map((plan) => plan.code),
    })
  }
  const currentPlan = resolvedPlan ?? buildFallbackPlan(currentPlanCode)

  return {
    subscription,
    currentPlan,
    plans,
    usage,
    billingProfile: billingResult.data as BillingProfile | null,
    payments: (paymentsResult.data ?? []) as SubscriptionPayment[],
    promoRedemptions: redemptionsResult.data ?? [],
  }
}

/** Info liviana del plan activo (código, nombre, módulos) para gating en el cliente. */
export async function getOrganizationPlanInfo(
  organizationId: string
): Promise<{
  code: PlanCode
  name: string
  modules: string[]
  modulePlanAvailability: Partial<Record<OrganizationModule, string[]>>
  entitledModules: string[]
  enabledModules: OrganizationModule[] | null
  effectiveModules: OrganizationModule[]
  businessVertical: BusinessVertical
  operatingModel: OperatingModel
  downgradedFromExpiry: boolean
  moduleTrials: ModuleTrial[]
  trialedModules: string[]
}> {
  await applyScheduledDowngradeIfDue(organizationId)
  const supabase = createAdminSupabase()
  const [{ data: sub }, { data: org }, { data: trials }] = await Promise.all([
    supabase.from('subscriptions').select('plan, payment_status, cancel_at_period_end, current_period_ends_at').eq('organization_id', organizationId).maybeSingle(),
    supabase.from('organizations').select('plan, business_vertical, operating_model, enabled_modules').eq('id', organizationId).maybeSingle(),
    supabase
      .from('organization_module_trials')
      .select('module, expires_at')
      .eq('organization_id', organizationId),
  ])

  const code = normalizePlanCode(sub?.plan || org?.plan)

  const { data: availablePlans } = await supabase
    .from('plans')
    .select('code, name, modules, is_active')

  const planRows = (availablePlans ?? []) as Array<{
    code: string
    name: string
    modules: unknown
    is_active: boolean | null
  }>
  const plan = planRows.find(row => String(row.code).toUpperCase() === code)

  const planModules = Array.isArray(plan?.modules) ? plan.modules.map(String) : []
  const modulePlanAvailability: Partial<Record<OrganizationModule, string[]>> = {}
  for (const availablePlan of planRows) {
    if (availablePlan.is_active === false || !Array.isArray(availablePlan.modules)) continue
    for (const module of availablePlan.modules) {
      if (!ORGANIZATION_MODULES.includes(module as OrganizationModule)) continue
      const key = module as OrganizationModule
      modulePlanAvailability[key] = [
        ...(modulePlanAvailability[key] ?? []),
        availablePlan.name || String(availablePlan.code),
      ]
    }
  }

  // Trials: separar activos (no vencidos) de los ya usados.
  const now = Date.now()
  const trialRows = (trials ?? []) as Array<{ module: string; expires_at: string }>
  const trialedModules = trialRows.map((t) => t.module)
  const moduleTrials: ModuleTrial[] = trialRows
    .filter((t) => new Date(t.expires_at).getTime() > now)
    .map((t) => ({
      module: t.module,
      expiresAt: t.expires_at,
      daysLeft: Math.max(0, Math.ceil((new Date(t.expires_at).getTime() - now) / 86400000)),
    }))

  const profile = buildOrganizationBusinessProfile({
    persisted: {
      businessVertical: org?.business_vertical,
      operatingModel: org?.operating_model,
      enabledModules: org?.enabled_modules,
    },
    entitledModules: planModules,
    trialModules: moduleTrials.map((trial) => trial.module),
  })

  // Baja de cortesía: quedó en FREE por impago (la automatización marca payment_status='unpaid').
  const downgradedFromExpiry = code === 'FREE' && sub?.payment_status === 'unpaid'
  return {
    code,
    name: typeof plan?.name === 'string' ? plan.name : code,
    modules: profile.effectiveModules,
    modulePlanAvailability,
    entitledModules: planModules,
    enabledModules: profile.enabledModules,
    effectiveModules: profile.effectiveModules,
    businessVertical: profile.businessVertical,
    operatingModel: profile.operatingModel,
    downgradedFromExpiry,
    moduleTrials,
    trialedModules,
  }
}

export async function getSubscriptionStatus(organizationId: string): Promise<{
  status: string | null
  isBlocked: boolean
  isExpired: boolean
  isTrialing: boolean
  trialDaysLeft: number | null
  periodDaysLeft: number | null
}> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, payment_status, trial_ends_at, current_period_ends_at')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo validar el estado de la suscripción: ${error.message}`)
  }

  return evaluateSubscriptionStatus({
    status: data?.status,
    paymentStatus: data?.payment_status,
    trialEndsAt: data?.trial_ends_at,
    periodEndsAt: data?.current_period_ends_at,
  })
}

export async function canCreateResource(
  organizationId: string,
  resourceType: ResourceType,
  increment = 1
): Promise<{ allowed: boolean; current: number; limit: number | null; plan: PlanRecord; blocked?: boolean; expired?: boolean }> {
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
  const effectivePlan = subscriptionStatus.isExpired ? await getPlanLimits('FREE') : state.currentPlan
  const limit = getPlanLimit(effectivePlan, resourceType)

  return {
    allowed: limit === null || current + increment <= limit,
    current,
    limit,
    plan: effectivePlan,
    blocked: false,
    expired: subscriptionStatus.isExpired,
  }
}

/**
 * Reparaciones tienen un límite MENSUAL (free 20/mes, basic 150/mes, pro ilimitado), no por total.
 * Cuenta las reparaciones creadas en el mes calendario en curso para la organización.
 */
export async function canCreateRepair(
  organizationId: string
): Promise<{ allowed: boolean; current: number; limit: number | null; plan: PlanRecord; blocked?: boolean; expired?: boolean }> {
  const [state, subscriptionStatus] = await Promise.all([
    getCurrentOrganizationSubscription(organizationId),
    getSubscriptionStatus(organizationId),
  ])

  if (subscriptionStatus.isBlocked) {
    return { allowed: false, current: 0, limit: null, plan: state.currentPlan, blocked: true }
  }

  const effectivePlan = subscriptionStatus.isExpired ? await getPlanLimits('FREE') : state.currentPlan
  const raw = effectivePlan.limits?.repairs
  const limit = raw === null || typeof raw === 'undefined'
    ? null
    : (Number.isFinite(toNumber(raw, Number.NaN)) ? toNumber(raw, Number.NaN) : null)

  // Plan ilimitado (limit null) -> siempre permitido, sin contar.
  if (limit === null) {
    return { allowed: true, current: 0, limit: null, plan: effectivePlan, expired: subscriptionStatus.isExpired }
  }

  const supabase = createAdminSupabase()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count, error } = await supabase
    .from('repairs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('created_at', monthStart)

  if (error) {
    throw new Error(`No se pudieron contar las reparaciones del período: ${error.message}`)
  }

  const current = count || 0
  return { allowed: current < limit, current, limit, plan: effectivePlan, expired: subscriptionStatus.isExpired }
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

  const [subscriptionResult, organizationResult, commercialResult, technicalResult, usage] = await Promise.all([
    supabase.from('subscriptions').select('plan, status').eq('organization_id', organizationId).maybeSingle(),
    supabase.from('organizations').select('plan').eq('id', organizationId).maybeSingle(),
    supabase
      .from('subscription_plans')
      .select('tier, name, price, price_note, description, is_popular, limits, highlights, features, is_active')
      .eq('is_active', true)
      .order('price', { ascending: true }),
    supabase.from('plans').select('code, limits').eq('is_active', true),
    getOrganizationUsage(organizationId),
  ])

  const queryError = [
    subscriptionResult.error,
    organizationResult.error,
    commercialResult.error,
    technicalResult.error,
  ].find(Boolean)
  if (queryError) {
    throw new Error(`No se pudieron evaluar los planes: ${queryError.message}`)
  }

  const currentCode = (subscriptionResult.data?.plan || organizationResult.data?.plan || 'FREE') as string

  // Límites técnicos desde la DB (fuente única); DEFAULT_LIMITS solo como fallback.
  const technicalLimitsByCode = new Map(
    ((technicalResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      normalizePlanCode(row.code),
      (typeof row.limits === 'object' && row.limits ? row.limits : {}) as Record<string, unknown>,
    ])
  )

  const plans = ((commercialResult.data ?? []) as Array<Record<string, unknown>>).map((row): CommercialPlan => {
    const code = normalizePlanCode(row.tier) as PlanCode
    const limits: Record<string, unknown> = {
      ...(DEFAULT_LIMITS[code] || DEFAULT_LIMITS.FREE),
      ...(technicalLimitsByCode.get(code) || {}),
    }
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

export type PlanChangeConflict = { resource: string; current: number; limit: number }

export type PlanChangeAssessment =
  | {
      success: true
      currentPlan: CommercialPlan
      targetPlan: CommercialPlan
      usage: OrganizationUsage
      conflictingResources: []
    }
  | {
      success: false
      error: string
      conflictingResources?: PlanChangeConflict[]
    }

export async function assessPlanChange(
  organizationId: string,
  newPlanCode: string,
): Promise<PlanChangeAssessment> {
  if (!isSupportedPlanCode(newPlanCode)) {
    return { success: false, error: 'El código del plan solicitado no es válido.' }
  }

  const data = await getChangePlanData(organizationId)
  const code = normalizePlanCode(newPlanCode)
  const targetPlan = data.plans.find((plan) => plan.code === code)

  if (!targetPlan) {
    return { success: false, error: 'El plan solicitado no existe o no está disponible.' }
  }

  const resourceLabels: Record<ResourceType, string> = {
    users: 'Usuarios',
    branches: 'Sucursales',
    cashRegisters: 'Cajas',
    products: 'Productos',
    categories: 'Categorías',
    repairs: 'Reparaciones',
    services: 'Servicios',
  }
  const countResources: ResourceType[] = ['users', 'branches', 'cashRegisters', 'products', 'categories', 'repairs', 'services']
  const conflictingResources: PlanChangeConflict[] = []

  for (const key of countResources) {
    const limit = getPlanLimit(targetPlan, key)
    if (limit === null) continue
    const current = data.usage[key]
    if (current > limit) {
      conflictingResources.push({ resource: resourceLabels[key], current, limit })
    }
  }

  if (conflictingResources.length > 0) {
    return {
      success: false,
      error: 'El uso actual supera los límites del plan destino.',
      conflictingResources,
    }
  }

  return {
    success: true,
    currentPlan: data.currentPlan,
    targetPlan,
    usage: data.usage,
    conflictingResources: [],
  }
}

export async function changePlan(
  organizationId: string,
  newPlanCode: string,
): Promise<{ success: true } | { success: false; error: string; conflictingResources?: Array<{ resource: string; current: number; limit: number }> }> {
  const supabase = createAdminSupabase()
  const assessment = await assessPlanChange(organizationId, newPlanCode)

  if (assessment.success === false) {
    return assessment
  }

  if (planRequiresPayment(assessment.targetPlan)) {
    return {
      success: false,
      error: 'Los planes pagos deben activarse mediante un pago confirmado.',
    }
  }

  const { data, error } = await supabase.rpc('apply_free_subscription_plan', {
    p_organization_id: organizationId,
    p_plan: assessment.targetPlan.code,
  })

  if (error || data !== true) {
    return { success: false, error: error?.message || 'No se pudo aplicar el plan gratuito.' }
  }

  await supabase.from('audit_log').insert({
    action: 'update',
    resource: 'subscriptions',
    new_values: { plan: assessment.targetPlan.code, organization_id: organizationId },
  })

  return { success: true }
}

/**
 * Programa la cancelación al fin del período: conserva el plan pagado hasta el
 * vencimiento y luego baja a Gratuito (ver getOrganizationPlanInfo).
 * Bloquea si el uso actual supera los límites del plan Gratuito.
 */
export async function cancelSubscriptionAtPeriodEnd(
  organizationId: string,
): Promise<
  | { success: true; effectiveUntil: string | null }
  | { success: false; error: string; conflictingResources?: Array<{ resource: string; current: number; limit: number }> }
> {
  const supabase = createAdminSupabase()
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('plan, current_period_ends_at')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (subError) return { success: false, error: subError.message }

  if (normalizePlanCode(sub?.plan) === 'FREE') {
    return { success: false, error: 'Ya estás en el plan Gratuito; no hay una suscripción paga para cancelar.' }
  }

  // Validar uso contra los límites de Gratuito (bloquear si excede).
  const freePlan = await getPlanLimits(normalizePlanCode('free') as PlanCode)
  const usage = await getOrganizationUsage(organizationId)
  const resourceLabels: Record<string, string> = {
    users: 'Usuarios', branches: 'Sucursales', cashRegisters: 'Cajas', products: 'Productos',
  }
  const countResources: ResourceType[] = ['users', 'branches', 'cashRegisters', 'products', 'categories']
  const conflictingResources: Array<{ resource: string; current: number; limit: number }> = []
  for (const key of countResources) {
    const limit = getPlanLimit(freePlan, key)
    if (limit === null) continue
    const current = usage[key] ?? 0
    if (current > limit) {
      conflictingResources.push({ resource: resourceLabels[key] || key, current, limit })
    }
  }
  if (conflictingResources.length > 0) {
    return {
      success: false,
      error: 'Tu uso actual supera los límites del plan Gratuito. Reducí estos recursos antes de cancelar.',
      conflictingResources,
    }
  }

  const now = new Date().toISOString()
  const periodEnd = sub?.current_period_ends_at ? new Date(sub.current_period_ends_at) : null
  const hasFuturePeriod = !!periodEnd && periodEnd.getTime() > Date.now()

  if (hasFuturePeriod) {
    // Hay período pagado pendiente → programar la baja para esa fecha.
    const { error } = await supabase
      .from('subscriptions')
      .update({ cancel_at_period_end: true, updated_at: now })
      .eq('organization_id', organizationId)
    if (error) return { success: false, error: error.message }
    return { success: true, effectiveUntil: sub?.current_period_ends_at ?? null }
  }

  // Sin período futuro definido → bajar a Gratuito de inmediato (estado limpio).
  const { data: applied, error } = await supabase.rpc('apply_free_subscription_plan', {
    p_organization_id: organizationId,
    p_plan: 'FREE',
  })
  if (error || applied !== true) {
    return { success: false, error: error?.message || 'No se pudo aplicar el plan Gratuito.' }
  }
  return { success: true, effectiveUntil: null }
}

/** Revierte una cancelación programada (vuelve a renovar normalmente). */
export async function reactivateSubscription(
  organizationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)

  if (error) return { success: false, error: error.message }
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
