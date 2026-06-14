import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { redeemSubscriptionPromo } from '@/lib/saas/redeem-subscription-promo'

const applySchema = z.object({ organizationId: z.string().uuid() })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const parsed = applySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Organización inválida.' }, { status: 400 })

  const result = await redeemSubscriptionPromo({
    promoId: id,
    organizationId: parsed.data.organizationId,
    actorId: user.id,
  })

  if (result.success === false) return NextResponse.json({ error: result.error }, { status: result.status })

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'promo_code.redeemed',
    resource: 'subscription_promo_redemptions',
    resourceId: result.redemption.id,
    organizationId: parsed.data.organizationId,
    newValues: {
      code: result.promoCode,
      requires_billing_action: result.requiresBillingAction,
      resulting_subscription: result.subscription,
    },
    request,
    severity: 'high',
  })

  return NextResponse.json(result)
}
