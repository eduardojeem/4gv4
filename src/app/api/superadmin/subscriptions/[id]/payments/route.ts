import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { sendSubscriptionPaymentReceipt } from '@/lib/saas/subscription-notifications'

const manualPaymentSchema = z.object({
  plan: z.enum(['BASIC', 'PRO', 'ENTERPRISE']),
  amount: z.number().int().positive().max(1_000_000_000),
  method: z.enum(['Efectivo', 'Depósito bancario', 'Transferencia', 'Otro']),
  reference: z.string().trim().max(160).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
}).strict()

const ERRORS: Record<string, [number, string]> = {
  MANUAL_PAYMENT_FORBIDDEN: [403, 'Solo el superadmin puede registrar pagos.'],
  MANUAL_PAYMENT_INVALID_PLAN: [400, 'Elegí un plan pago.'],
  MANUAL_PAYMENT_INVALID_AMOUNT: [400, 'El monto tiene que ser un número entero mayor a 0.'],
  MANUAL_PAYMENT_FUTURE_DATE: [400, 'La fecha del pago no puede ser futura.'],
  MANUAL_PAYMENT_ORGANIZATION_NOT_FOUND: [404, 'El comercio no tiene suscripción.'],
}

/**
 * Registra un cobro hecho fuera de Pagopar o de la transferencia con
 * comprobante y aplica el plan con la misma lógica que los demás pagos.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const parsed = manualPaymentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos del pago inválidos.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: subscription, error: lookupError } = await admin
    .from('subscriptions')
    .select('organization_id, plan, status')
    .eq('id', id)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'No se pudo leer la suscripción.' }, { status: 500 })
  if (!subscription) return NextResponse.json({ error: 'Suscripción no encontrada.' }, { status: 404 })

  const { data, error } = await admin.rpc('record_manual_subscription_payment', {
    p_actor_id: user.id,
    p_organization_id: subscription.organization_id,
    p_plan: parsed.data.plan,
    p_amount: parsed.data.amount,
    p_payment_method: parsed.data.method,
    p_reference: parsed.data.reference || null,
    p_paid_at: parsed.data.paidAt ?? new Date().toISOString(),
  })

  if (error) {
    const code = Object.keys(ERRORS).find((key) => error.message.includes(key))
    const [status, message] = code ? ERRORS[code] : [500, 'No se pudo registrar el pago.']
    return NextResponse.json({ error: message }, { status })
  }

  const result = Array.isArray(data) ? data[0] : data
  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'subscription.manual_payment',
    resource: 'subscription_payments',
    resourceId: result?.payment_id ?? null,
    organizationId: subscription.organization_id,
    oldValues: { plan: subscription.plan, status: subscription.status },
    newValues: { plan: parsed.data.plan, amount: parsed.data.amount, method: parsed.data.method },
    request,
    severity: 'high',
  })

  if (result?.payment_id) await sendSubscriptionPaymentReceipt(result.payment_id)

  return NextResponse.json({ success: true, paymentId: result?.payment_id ?? null, plan: result?.plan_id ?? parsed.data.plan })
}
