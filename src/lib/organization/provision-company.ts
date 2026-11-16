import type { createAdminSupabase } from '@/lib/supabase/admin'
import { defaultOperatingModelFor } from '@/lib/organization/business-profile'
import { createInitialOnboardingState } from '@/lib/onboarding/shared-setup'
import type { BusinessVertical } from '@/lib/organization/business-profile'

type AdminClient = ReturnType<typeof createAdminSupabase>

export type SignupPlan = {
  /** El tier que se guarda (en mayúsculas), aunque haya llegado el slug público. */
  tier: string
  name: string | null
  /** Los días de prueba que promete la tarjeta de precios; sin días no hay prueba. */
  trialDays: number
}

/**
 * El plan elegido en el alta, vigente. Acepta el slug público o el tier: los
 * enlaces que circulan usan el slug. El slug manda y el tier es respaldo, en
 * dos consultas y no en un `or`: los dos espacios de nombres se cruzan.
 */
export async function findSignupPlan(admin: AdminClient, selected: string): Promise<{ plan: SignupPlan | null; error: string | null }> {
  const value = selected.toLowerCase()
  const lookup = (column: 'public_slug' | 'tier') => admin
    .from('subscription_plans')
    .select('tier, name, is_active, trial_days')
    .eq('is_active', true)
    .eq(column, value)
    .maybeSingle()

  const bySlug = await lookup('public_slug')
  const { data, error } = bySlug.data || bySlug.error ? bySlug : await lookup('tier')
  if (error) return { plan: null, error: error.message }
  if (!data) return { plan: null, error: null }
  return {
    plan: {
      tier: String(data.tier).toUpperCase(),
      name: (data.name as string | null) ?? null,
      trialDays: Math.max(0, Math.floor(Number(data.trial_days) || 0)),
    },
    error: null,
  }
}

export type CompanyProvisioningInput = {
  organizationId: string
  userId: string
  email: string
  fullName: string
  companyName: string
  plan: SignupPlan
  businessVertical?: BusinessVertical | null
}

/**
 * Lo que necesita un comercio recién creado para funcionar: dueño, ajustes con
 * la configuración inicial pendiente, suscripción en prueba, rol de
 * administrador y sucursal principal. Lo usan el registro con contraseña y el
 * alta de quien ya tiene cuenta (por ejemplo, con Google).
 */
export function provisionCompanyRows(admin: AdminClient, input: CompanyProvisioningInput) {
  const { organizationId, userId, plan } = input
  return Promise.allSettled([
    admin.from('organization_members').upsert(
      { organization_id: organizationId, user_id: userId, role: 'owner', status: 'active' },
      { onConflict: 'organization_id,user_id' }
    ),
    admin.from('organization_settings').upsert(
      {
        organization_id: organizationId,
        display_name: input.companyName,
        currency: 'PYG',
        timezone: 'America/Asuncion',
        branding: {},
        modules: {
          onboarding: {
            status: 'pending',
            selected_plan: plan.tier,
            started_at: new Date().toISOString(),
            shared: createInitialOnboardingState({
              plan: plan.tier,
              businessName: input.companyName,
              businessCategory: input.businessVertical ?? null,
            }),
          },
        },
      },
      { onConflict: 'organization_id' }
    ),
    admin.from('subscriptions').upsert(
      {
        organization_id: organizationId,
        plan: plan.tier,
        status: 'trialing',
        trial_ends_at: new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
      },
      { onConflict: 'organization_id' }
    ),
    admin.from('profiles').upsert({ id: userId, email: input.email, full_name: input.fullName, role: 'admin' }),
    admin.from('user_roles').upsert({ user_id: userId, role: 'admin', is_active: true }, { onConflict: 'user_id' }),
    // upsert: un reintento después de un fallo parcial no choca con la sucursal ya creada.
    admin.from('branches').upsert(
      {
        organization_id: organizationId,
        code: 'principal',
        name: 'Sucursal principal',
        slug: 'principal',
        is_active: true,
        is_default: true,
        metadata: {},
      },
      { onConflict: 'organization_id,code', ignoreDuplicates: true }
    ),
  ])
}

/** Nombres de cada paso, en el mismo orden que `provisionCompanyRows`. */
export const PROVISIONING_STEPS = ['organization_members', 'organization_settings', 'subscriptions', 'profiles', 'user_roles', 'branches'] as const

/** Las columnas del comercio con su rubro (si vino). */
export function organizationInsertRow(input: { companyName: string; companySlug: string; plan: SignupPlan; userId: string; businessVertical?: BusinessVertical | null }) {
  return {
    name: input.companyName,
    slug: input.companySlug,
    plan: input.plan.tier,
    owner_id: input.userId,
    ...(input.businessVertical
      ? { business_vertical: input.businessVertical, operating_model: defaultOperatingModelFor(input.businessVertical) }
      : {}),
  }
}
