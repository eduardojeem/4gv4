import { CreditPlanDefinitionSchema } from '@/lib/credits/plan-definition'
import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { canOverrideCreditPosPolicy, normalizeCreditPosPolicy } from '@/lib/credits/pos-credit-policy'

/**
 * Política de crédito que el POS (web y app) muestra al cajero. Es solo para
 * acotar el formulario: la que vale es la que aplica /api/pos/process-sale.
 * No devuelve el resto de los predeterminados (base de costo, márgenes).
 */
export const GET = withTenantAuth({ permission: 'pos.sales.create', module: 'pos' }, async (_request, { organization }) => {
  const { data, error } = await createAdminSupabase()
    .from('website_settings')
    .select('value')
    .eq('organization_id', organization.id)
    .eq('key', 'product_credit_defaults')
    .maybeSingle()
  if (error) {
    return NextResponse.json({ success: false, error: 'No se pudieron leer las reglas de crédito.' }, { status: 503 })
  }
  const value = (data?.value ?? null) as { posPolicy?: unknown; plans?: unknown; frequency?: unknown } | null
  const plans = Array.isArray(value?.plans) ? value.plans.flatMap(raw => { const parsed = CreditPlanDefinitionSchema.safeParse(raw); return parsed.success ? [parsed.data] : [] }) : []
  const frequency = value?.frequency === 'weekly' || value?.frequency === 'biweekly' ? value.frequency : 'monthly'
  return NextResponse.json({
    success: true,
    data: {
      policy: normalizeCreditPosPolicy(value?.posPolicy),
      canOverride: canOverrideCreditPosPolicy(organization.role),
      defaultPlans: plans.map(plan => ({ ...plan, frequency })),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
})
