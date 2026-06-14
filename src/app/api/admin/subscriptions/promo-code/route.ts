import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { redeemSubscriptionPromo } from '@/lib/saas/redeem-subscription-promo'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { rateLimiter } from '@/lib/rate-limiter'

const redeemSchema = z.object({ code: z.string().trim().min(3).max(40) })
const USER_PROMO_ATTEMPT_LIMIT = 5
const ORGANIZATION_PROMO_ATTEMPT_LIMIT = 10
const PROMO_ATTEMPT_WINDOW_MS = 30 * 60 * 1000

export async function POST(request: Request) {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const organization = await getCurrentOrganizationContext(auth.user.id)
  if (!organization || !['owner', 'admin'].includes(organization.role)) {
    return NextResponse.json({ error: 'No tienes permiso para aplicar códigos promocionales.' }, { status: 403 })
  }

  const userAttemptKey = `subscription-promo:user:${organization.id}:${auth.user.id}`
  const organizationAttemptKey = `subscription-promo:organization:${organization.id}`
  const [userAllowed, organizationAllowed] = await Promise.all([
    rateLimiter.check(userAttemptKey, USER_PROMO_ATTEMPT_LIMIT, PROMO_ATTEMPT_WINDOW_MS),
    rateLimiter.check(organizationAttemptKey, ORGANIZATION_PROMO_ATTEMPT_LIMIT, PROMO_ATTEMPT_WINDOW_MS),
  ])
  if (!userAllowed || !organizationAllowed) {
    const retryAfter = Math.max(
      rateLimiter.getResetTime(userAttemptKey),
      rateLimiter.getResetTime(organizationAttemptKey),
      60
    )
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta nuevamente más tarde.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const parsed = redeemSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Ingresa un código promocional válido.' }, { status: 400 })

  const result = await redeemSubscriptionPromo({
    organizationId: organization.id,
    actorId: auth.user.id,
    code: parsed.data.code,
  })

  if (result.success === false) return NextResponse.json({ error: result.error }, { status: result.status })

  await createAdminSupabase().from('tenant_audit_log').insert({
    organization_id: organization.id,
    user_id: auth.user.id,
    action: 'subscription.promo_redeemed',
    resource: 'subscription_promo_redemptions',
    resource_id: result.redemption.id,
    metadata: { code: result.promoCode, requires_billing_action: result.requiresBillingAction },
    user_agent: request.headers.get('user-agent'),
  }).then(() => {}, () => {})

  return NextResponse.json(result)
}
