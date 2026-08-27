import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from '@/lib/loyalty/module-status'
import { logger } from '@/lib/logger'

const drawSchema = z.object({
  // Semilla opcional para poder repetir una jugada auditada. Si no viene, la
  // genera la base con bytes aleatorios y la guarda.
  seed: z.string().max(200).optional(),
})

function raffleId(routeContext: unknown): string | null {
  const params = (routeContext as { params?: { id?: string } } | undefined)?.params
  return params?.id ?? null
}

/**
 * Corre el sorteo. Una sola vez: la función marca el sorteo como 'completed',
 * que es un estado terminal, así que no se puede repetir hasta que salga el
 * resultado deseado.
 */
export const POST = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (request: NextRequest, _context, routeContext) => {
  const id = raffleId(routeContext)
  if (!id) return NextResponse.json({ error: 'Falta el sorteo' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const parsed = drawSchema.safeParse(body ?? {})

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('draw_raffle_winners', {
    p_raffle_id: id,
    p_seed: parsed.success ? (parsed.data.seed ?? null) : null,
  })

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
    }
    logger.warn('raffle draw rejected', { error, raffleId: id })
    return NextResponse.json({ error: error.message || 'No se pudo realizar el sorteo' }, { status: 400 })
  }

  return NextResponse.json({ winners: data ?? [] })
})
