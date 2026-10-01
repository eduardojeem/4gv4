import type { createAdminSupabase } from '@/lib/supabase/admin'

/**
 * Nombre comercial de cada plan por su código técnico (FREE, BASIC, PRO,
 * ENTERPRISE → Gratis, Pro, Pro Max, ULTRA). Las pantallas de organizaciones
 * mostraban «PLAN BASIC» donde el cliente ve «Pro».
 */
export type PlanNames = Record<string, string>

const TIER_TO_CODE: Record<string, string> = { free: 'FREE', basic: 'BASIC', starter: 'BASIC', pro: 'PRO', profesional: 'PRO', enterprise: 'ENTERPRISE' }

export async function loadPlanNames(admin: ReturnType<typeof createAdminSupabase>): Promise<PlanNames> {
  const { data } = await admin.from('subscription_plans').select('tier, name')
  const names: PlanNames = {}
  for (const row of (data ?? []) as Array<{ tier: string | null; name: string | null }>) {
    const code = TIER_TO_CODE[String(row.tier ?? '').toLowerCase()] ?? String(row.tier ?? '').toUpperCase()
    if (code && row.name?.trim()) names[code] = row.name.trim()
  }
  return names
}

export function planLabel(code: string | null | undefined, names?: PlanNames | null): string {
  const key = String(code ?? 'FREE').toUpperCase()
  return names?.[key] ?? key
}
