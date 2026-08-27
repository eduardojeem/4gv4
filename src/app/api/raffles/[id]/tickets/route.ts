import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from '@/lib/loyalty/module-status'
import { MAX_TICKETS_PER_OPERATION } from '@/lib/raffles/responsible-play'
import { logger } from '@/lib/logger'

const redeemSchema = z.object({
  customer_id: z.string().uuid('El cliente seleccionado no es válido'),
  quantity: z.number().int().min(1, 'Elegí al menos un número').max(MAX_TICKETS_PER_OPERATION),
})

function raffleId(routeContext: unknown): string | null {
  const params = (routeContext as { params?: { id?: string } } | undefined)?.params
  return params?.id ?? null
}

/**
 * Canje de puntos por números.
 *
 * No se calcula ni se descuenta nada acá: se delega en la función de la base,
 * que valida estado, autoexclusión, topes y saldo, y asigna los números dentro
 * de la misma transacción. Si esta ruta hiciera la cuenta, un cliente podría
 * pedir números sin pagar los puntos.
 */
export const POST = withTenantAuth({ permission: 'pos.sales.create', module: 'promotions' }, async (request: NextRequest, _context, routeContext) => {
  const id = raffleId(routeContext)
  if (!id) return NextResponse.json({ error: 'Falta el sorteo' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const parsed = redeemSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Error de validación',
        code: 'VALIDATION_FAILED',
        details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('redeem_points_for_raffle_tickets', {
    p_raffle_id: id,
    p_customer_id: parsed.data.customer_id,
    p_quantity: parsed.data.quantity,
  })

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
    }
    logger.warn('raffle redeem rejected', { error, raffleId: id })
    // Los mensajes de la función ya están redactados para mostrar tal cual.
    return NextResponse.json({ error: error.message || 'No se pudo canjear' }, { status: 400 })
  }

  return NextResponse.json({ tickets: data ?? [] }, { status: 201 })
})
