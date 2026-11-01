import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logSuperAdminAction } from '@/lib/superadmin/audit'

const refundSchema = z.object({
  reason: z.string().trim().min(3, 'Indicá el motivo del reembolso.').max(500),
  revokeAccess: z.boolean(),
}).strict()

const ERRORS: Record<string, [number, string]> = {
  REFUND_FORBIDDEN: [403, 'Solo el superadmin puede registrar reembolsos.'],
  REFUND_REASON_REQUIRED: [400, 'Indicá el motivo del reembolso.'],
  REFUND_PAYMENT_NOT_FOUND: [404, 'El pago no existe.'],
  REFUND_INVALID_STATE: [409, 'Solo se puede reembolsar un pago cobrado.'],
}

/**
 * Registra el reembolso de un pago de suscripción. La plata se devuelve fuera
 * del sistema (panel de Pagopar o banco); acá queda el registro y, si se pide,
 * se quita el período que ese pago cubría.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Pago inválido.' }, { status: 400 })
  const parsed = refundSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos.' }, { status: 400 })

  const { data, error } = await createAdminSupabase().rpc('refund_subscription_payment', {
    p_actor_id: user.id,
    p_payment_id: id,
    p_reason: parsed.data.reason,
    p_revoke_access: parsed.data.revokeAccess,
    p_chargeback: false,
  })
  if (error) {
    const code = Object.keys(ERRORS).find((key) => error.message.includes(key))
    const [status, message] = code ? ERRORS[code] : [500, 'No se pudo registrar el reembolso.']
    return NextResponse.json({ error: message }, { status })
  }

  const payment = data as { organization_id?: string; amount?: number; access_revoked?: boolean } | null
  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'subscription.payment_refunded',
    resource: 'subscription_payments',
    resourceId: id,
    organizationId: payment?.organization_id ?? null,
    newValues: { reason: parsed.data.reason, revokeAccess: parsed.data.revokeAccess, amount: payment?.amount ?? null },
    request,
    severity: 'high',
  })

  return NextResponse.json({ success: true, accessRevoked: payment?.access_revoked === true })
}
