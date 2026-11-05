import 'server-only'

import type { createAdminSupabase } from '@/lib/supabase/admin'
import type { CreditFrequency, CreditScheduleMode } from './installments'
import {
  canOverrideCreditPosPolicy,
  creditPlanOptions,
  creditPosPolicyViolation,
  normalizeCreditPosPolicy,
} from './pos-credit-policy'

type AdminClient = ReturnType<typeof createAdminSupabase>

export type CreditPolicyCheckInput = {
  supabase: AdminClient
  organizationId: string
  role: string | null | undefined
  productIds: string[]
  terms: {
    installmentCount: number
    interestRate: number
    frequency: CreditFrequency
    mode: CreditScheduleMode
  }
  /** Lo que se cobra en el momento (otros medios + saldo a favor). */
  paidNow: number
  /** Total de la venta según los pagos. */
  saleTotal: number
}

export type CreditPolicyCheckResult =
  | { ok: true; override: boolean }
  | { ok: false; status: number; error: string }

/**
 * Aplica la política de crédito de la organización a una venta POS. Si no se
 * puede leer la configuración, no se vende: una política que no se pudo
 * verificar no se da por cumplida.
 */
export async function checkCreditPosPolicy(input: CreditPolicyCheckInput): Promise<CreditPolicyCheckResult> {
  const [settingsResult, productsResult] = await Promise.all([
    input.supabase
      .from('website_settings')
      .select('value')
      .eq('organization_id', input.organizationId)
      .eq('key', 'product_credit_defaults')
      .maybeSingle(),
    input.productIds.length > 0
      ? input.supabase
        .from('products')
        .select('id, installments_enabled, installments_plans')
        .eq('organization_id', input.organizationId)
        .in('id', input.productIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (settingsResult.error || productsResult.error) {
    return { ok: false, status: 503, error: 'No se pudieron verificar las reglas de crédito. No se procesó la venta; probá de nuevo.' }
  }

  const defaults = (settingsResult.data?.value ?? null) as {
    posPolicy?: unknown
    plans?: Array<{ count: number; rate: number }>
    frequency?: CreditFrequency
  } | null
  const policy = normalizeCreditPosPolicy(defaults?.posPolicy)
  const plans = creditPlanOptions({
    products: (productsResult.data ?? []) as Array<{ installments_enabled?: boolean | null; installments_plans?: unknown }>,
    defaults,
  })
  const downPaymentPercent = input.saleTotal > 0 ? (Math.max(0, input.paidNow) * 100) / input.saleTotal : 0
  const violation = creditPosPolicyViolation(policy, { ...input.terms, downPaymentPercent }, plans)
  if (!violation) return { ok: true, override: false }
  if (canOverrideCreditPosPolicy(input.role)) return { ok: true, override: true }
  return { ok: false, status: 403, error: `${violation} Pedí autorización a un administrador.` }
}
