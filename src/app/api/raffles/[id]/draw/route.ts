import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { routeParam } from '@/lib/api/route-params'
import { createOrgScopedClient } from '@/lib/supabase/org-scoped-server'
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

  if (!parsed.success) return NextResponse.json({ error: 'La semilla del sorteo no es válida' }, { status: 400 })

  const supabase = await createOrgScopedClient(organization.id)

  const current = await supabase.from('raffles').select('id, status, ends_at').eq('id', id).eq('organization_id', organization.id).maybeSingle()
  if (current.error) return NextResponse.json({ error: 'No se pudo verificar el sorteo' }, { status: 500 })
  if (!current.data) return NextResponse.json({ error: 'El sorteo no existe' }, { status: 404 })
  if (current.data.status !== 'closed' && !(current.data.status === 'published' && new Date(current.data.ends_at).getTime() <= Date.now())) return NextResponse.json({ error: 'Cerrá el sorteo antes de elegir ganadores.', code: 'INVALID_STATUS_TRANSITION' }, { status: 409 })

  const { data, error } = await supabase.rpc('draw_raffle_winners', {
    p_raffle_id: id,
    p_seed: parsed.data.seed ?? null,
  })

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
    }
    if (error.code === '42501') return NextResponse.json({ error: 'No tenés permiso para realizar este sorteo.' }, { status: 403 })
    logger.warn('raffle draw rejected', { error, raffleId: id })
    return NextResponse.json({ error: error.message || 'No se pudo realizar el sorteo' }, { status: 400 })
  }

  return NextResponse.json({ winners: data ?? [] })
})
