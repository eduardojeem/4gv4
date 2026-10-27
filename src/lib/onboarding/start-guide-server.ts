import 'server-only'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { normalizeOpeningHours } from '@/lib/agenda/slots'
import { COMPLETED_SALE_STATUSES } from '@/lib/sales-status'
import { loadOrganizationSetupChecklist } from './setup-checklist-server'
import { evaluateStartGuide, type EvidenceState, type StartGuideEvidence, type StartGuidePreferences } from './start-guide'

export const startGuidePreferencesSchema = z.object({ version: z.literal(1), teamMode: z.enum(['solo', 'team']).nullable(), postponed: z.boolean() }).strict()
export class StartGuideError extends Error {
  constructor(public status: number) { super('Start guide unavailable') }
}

async function administrator(userId: string, expectedOrganizationId?: string) {
  const organization = await getCurrentOrganizationContext(userId)
  if (!organization || !['owner', 'admin'].includes(organization.role)) throw new StartGuideError(403)
  if (expectedOrganizationId && organization.id !== expectedOrganizationId) throw new StartGuideError(409)
  return organization
}

export async function loadStartGuide(userId: string, branchId?: string) {
  const organization = await administrator(userId)
  const admin = createAdminSupabase()
  const limitations: string[] = []
  const [plan, settings, setupChecklist] = await Promise.all([
    getOrganizationPlanInfo(organization.id, { strict: true }),
    admin.from('organization_settings').select('display_name, currency, timezone, modules').eq('organization_id', organization.id).maybeSingle(),
    // Opcional: si no se puede armar, la guía sale igual y lo avisa. Antes un
    // error del catálogo tiraba la guía entera en vez de marcarlo como dudoso.
    loadOrganizationSetupChecklist(admin, organization.id).catch(() => {
      limitations.push('No se pudo comprobar la configuración opcional del negocio.')
      return null
    }),
  ])
  if (settings.error) throw new StartGuideError(500)
  let branchQuery = admin.from('branches').select('id').eq('organization_id', organization.id).eq('is_active', true)
  if (branchId) branchQuery = branchQuery.eq('id', branchId)
  const branch = await branchQuery.limit(1)
  if (branch.error) throw new StartGuideError(500)
  if (branchId && !branch.data?.length) throw new StartGuideError(403)
  const exists = async (query: PromiseLike<{ data: unknown[] | null; error: unknown }>, label: string): Promise<EvidenceState> => {
    const result = await query
    if (result.error) { limitations.push(`No se pudo comprobar: ${label}.`); return null }
    return Boolean(result.data?.length)
  }
  const scoped = (table: string) => admin.from(table).select('id').eq('organization_id', organization.id)
  const withBranch = (query: ReturnType<typeof scoped>) => branchId ? query.eq('branch_id', branchId) : query
  const modules = plan.effectiveModules
  const has = (module: string) => modules.includes(module as typeof modules[number])
  const catalogEvidence = async (): Promise<EvidenceState> => {
    const [base, variant] = await Promise.all([
      exists(scoped('products').eq('is_active', true).neq('unit_measure', 'servicio').gte('sale_price', 0).gt('stock_quantity', 0).eq('has_variants', false).limit(1), 'producto con stock y precio'),
      exists(admin.from('product_variants').select('id, products!inner(id)').eq('organization_id', organization.id).eq('products.organization_id', organization.id).eq('products.is_active', true).neq('products.unit_measure', 'servicio').gte('products.sale_price', 0).eq('is_active', true).gt('stock_quantity', 0).limit(1), 'producto con variantes y stock'),
    ])
    return base === true || variant === true ? true : base === null || variant === null ? null : false
  }
  const [sellableProduct, activeService, teamConfigured, firstSale, firstRepair, firstReservation, firstService, agenda] = await Promise.all([
    has('inventory') ? catalogEvidence() : null,
    has('services') ? exists(scoped('products').eq('is_active', true).eq('unit_measure', 'servicio').gte('sale_price', 0).limit(1), 'servicio activo') : null,
    exists(scoped('organization_members').eq('status', 'active').neq('user_id', userId).in('role', ['owner', 'admin', 'manager', 'cashier', 'seller', 'technician']).limit(1), 'equipo'),
    has('pos') ? exists(withBranch(scoped('sales')).in('status', [...COMPLETED_SALE_STATUSES]).limit(1), 'venta completada') : null,
    has('repairs') ? exists(withBranch(scoped('repairs')).is('deleted_at', null).limit(1), 'recepción de taller') : null,
    has('services') && !branchId ? exists(scoped('appointments').in('status', ['pending', 'confirmed', 'completed']).limit(1), 'reserva') : null,
    has('services') && !branchId ? exists(scoped('appointments').eq('status', 'completed').limit(1), 'servicio atendido') : null,
    has('services') ? admin.from('agenda_settings').select('opening_hours, professional_selection').eq('organization_id', organization.id).maybeSingle() : null,
  ])
  let serviceAvailability: EvidenceState = null
  if (agenda) {
    if (agenda.error) limitations.push('No se pudo comprobar la disponibilidad de agenda.')
    else {
      serviceAvailability = Boolean(agenda.data && Object.keys(normalizeOpeningHours(agenda.data.opening_hours)).length)
      if (agenda.data?.professional_selection === 'required') {
        const professional = await exists(scoped('agenda_professionals').eq('is_active', true).limit(1), 'profesional activo')
        serviceAvailability = professional === null ? null : serviceAvailability && professional
      }
    }
  }
  if (has('services') && branchId) limitations.push('Los hitos de agenda no se atribuyen a una sucursal: consultá la guía con toda la organización.')
  if (branchId) limitations.push('El catálogo se comprueba a nivel de organización. Revisá el stock y las condiciones de la sucursal en la operación real.')
  limitations.push('El primer cobro aún no se comprueba entre todos los canales; una venta o reserva no se toma como dinero cobrado.')
  const storedModules = settings.data?.modules as Record<string, unknown> | null
  const parsed = startGuidePreferencesSchema.safeParse(storedModules?.business_start_guide)
  const preferences: StartGuidePreferences = parsed.success ? { version: 1, teamMode: parsed.data.teamMode ?? null, postponed: parsed.data.postponed } : { version: 1, teamMode: null, postponed: false }
  const evidence: StartGuideEvidence = {
    businessVertical: plan.businessVertical, operatingModel: plan.operatingModel, effectiveModules: modules,
    permissions: ['settings.manage', 'products.create', 'users.manage', 'repairs.orders.create', 'pos.sales.create'],
    basics: Boolean((settings.data?.display_name || organization.name)?.trim() && settings.data?.currency && settings.data?.timezone),
    activeBranch: Boolean(branch.data?.length), sellableProduct, activeService, serviceAvailability, teamConfigured,
    firstSale, firstReservation, firstService, firstRepair, firstCollection: null,
  }
  return { organizationId: organization.id, branchId: branchId ?? null, guide: evaluateStartGuide(evidence, preferences), preferences, limitations, setupChecklist }
}

export async function saveStartGuidePreferences(userId: string, preferences: z.infer<typeof startGuidePreferencesSchema>, expectedOrganizationId?: string) {
  const organization = await administrator(userId, expectedOrganizationId)
  const validated = startGuidePreferencesSchema.parse(preferences)
  const { error } = await createAdminSupabase().rpc('server_save_business_start_guide_preferences', {
    p_organization_id: organization.id, p_actor_user_id: userId, p_preferences: validated,
  })
  if (error) throw new StartGuideError(500)
}
