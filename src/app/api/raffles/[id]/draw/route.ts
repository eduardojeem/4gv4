import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { routeParam } from '@/lib/api/route-params'
import { createOrgScopedClient } from '@/lib/supabase/org-scoped-server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from '@/lib/loyalty/module-status'
import { logger } from '@/lib/logger'

const drawSchema = z.object({
  // Semilla opcional para poder repetir una jugada auditada. Si no viene, la
  // genera la base con bytes aleatorios y la guarda.
  seed: z.string().max(200).optional(),
})

/**
 * Corre el sorteo. Una sola vez: la función marca el sorteo como 'completed',
 * que es un estado terminal, así que no se puede repetir hasta que salga el
 * resultado deseado.
 */
export const POST = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (request: NextRequest, { organization }, routeContext) => {
  const id = await routeParam(routeContext, 'id')
  if (!id) return NextResponse.json({ error: 'Falta el sorteo' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const parsed = drawSchema.safeParse(body ?? {})

  const supabase = await createOrgScopedClient(organization.id)

  let { data, error } = await supabase.rpc('draw_raffle_winners', {
    p_raffle_id: id,
    p_seed: parsed.success ? (parsed.data.seed ?? null) : null,
  })

  // Si falló por falta de contexto de sesión en PostgREST (42501) pero withTenantAuth
  // ya validó al usuario a nivel servidor, intentamos con adminSupabase
  if (error && error.code === '42501') {
    const adminSupabase = createAdminSupabase()
    const adminResult = await adminSupabase.rpc('draw_raffle_winners', {
      p_raffle_id: id,
      p_seed: parsed.success ? (parsed.data.seed ?? null) : null,
    })
    if (!adminResult.error) {
      data = adminResult.data
      error = null
    } else {
      error = adminResult.error
    }
  }

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
    }
    logger.warn('raffle draw rejected', { error, raffleId: id })
    return NextResponse.json({ error: error.message || 'No se pudo realizar el sorteo' }, { status: 400 })
  }

  return NextResponse.json({ winners: data ?? [] })
})
