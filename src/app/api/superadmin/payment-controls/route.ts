import { z } from 'zod'
import { requireTransferSuperAdmin, readTransferJson, transferJson, transferError } from '@/lib/saas/bank-transfer-api'
import { controlUpdateSchema, PaymentControlError } from '@/lib/payments/control-contract'
import { getSubscriptionPaymentControls, updateSubscriptionPaymentControl } from '@/lib/payments/subscription-controls'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { subscriptionControlHistory } from '@/lib/payments/control-history'

async function snapshot() {
  const catalog = await getSubscriptionPaymentControls()
  return { ...catalog, methods: await subscriptionControlHistory(catalog.methods) }
}

function respondError(error: unknown) {
  if (error instanceof PaymentControlError) return transferJson({ error: error.message, code: error.code }, error.status)
  if (error instanceof z.ZodError) return transferJson({ error: error.issues[0]?.message ?? 'Datos inválidos.' }, 400)
  return transferError(error)
}
export async function GET() {
  try { await requireTransferSuperAdmin(); return transferJson(await snapshot()) }
  catch (error) { return respondError(error) }
}
export async function PATCH(request: Request) {
  try {
    const actor = await requireTransferSuperAdmin()
    const input = controlUpdateSchema.parse(await readTransferJson(request))
    await updateSubscriptionPaymentControl({ ...input, revision: input.revision ?? null }, actor.id)
    await logSuperAdminAction({ actorId: actor.id, actorEmail: actor.email, action: 'update_subscription_payment_control', resource: 'payment_controls', resourceId: input.id, newValues: { enabled: input.enabled }, request })
    return transferJson(await snapshot())
  } catch (error) { return respondError(error) }
}
