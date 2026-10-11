import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createOrgScopedClient } from '@/lib/supabase/org-scoped-server'
import { isLoyaltyModuleMissing } from '@/lib/loyalty/module-status'
import { logger } from '@/lib/logger'

const redeemSchema = z.object({
  points: z.number().int().positive('Indicá cuántos puntos canjear'),
  // El cliente genera una clave por intento: reintentar no canjea dos veces.
  idempotencyKey: z.string().trim().min(8).max(120),
})

/** Mensajes de la función de canje, en palabras del cajero. */
const REDEEM_ERRORS: Record<string, string> = {
  REDEMPTION_DISABLED: 'El canje de puntos está apagado. Configuralo en Promociones → Puntos.',
  INSUFFICIENT_POINTS: 'El cliente no tiene esa cantidad de puntos.',
  BELOW_MIN_REDEMPTION: 'Todavía no llega al mínimo de puntos para canjear.',
  INVALID_POINTS: 'La cantidad de puntos no es válida.',
}

async function customerId(routeContext: unknown): Promise<string | null> {
  const params = (routeContext as { params?: { customerId?: string } | Promise<{ customerId?: string }> } | undefined)?.params
  const resolved = params ? await Promise.resolve(params) : null
  return resolved?.customerId ?? null
}

/**
 * Canjea puntos por saldo a favor, que el POS ya acepta como forma de pago.
 * Lo usan el cobro y la ficha del cliente.
 */
export const POST = withTenantAuth(
  { permission: ['pos.sales.create', 'crm.customers.manage'], module: 'promotions' },
  async (request: NextRequest, { organization }, routeContext) => {
    const id = await customerId(routeContext)
    if (!id) return NextResponse.json({ error: 'Falta el cliente' }, { status: 400 })

    const parsed = redeemSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }

    const supabase = await createOrgScopedClient(organization.id)
    const { data, error } = await supabase.rpc('redeem_loyalty_points_to_store_credit', {
      p_organization_id: organization.id,
      p_customer_id: id,
      p_points: parsed.data.points,
      p_idempotency_key: `redeem:${parsed.data.idempotencyKey}`,
    })

    if (error) {
      if (isLoyaltyModuleMissing(error)) {
        return NextResponse.json({ error: 'Falta aplicar la migración del canje de puntos.', code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
      }
      const known = Object.keys(REDEEM_ERRORS).find((code) => error.message?.includes(code))
      if (known) return NextResponse.json({ error: REDEEM_ERRORS[known], code: known }, { status: 422 })
      logger.error('loyalty redeem failed', { error, customerId: id })
      return NextResponse.json({ error: error.message || 'No se pudieron canjear los puntos' }, { status: 400 })
    }

    const result = data as { points?: number; amount?: number | string; balance?: number; replayed?: boolean } | null
    return NextResponse.json({
      success: true,
      data: {
        points: Number(result?.points ?? 0),
        amount: Number(result?.amount ?? 0),
        balance: Number(result?.balance ?? 0),
        replayed: result?.replayed === true,
      },
    })
  }
)
