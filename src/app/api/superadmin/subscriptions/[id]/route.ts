import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { normalizePlanCode } from '@/lib/saas/subscription-service'
import { getSuperAdminUser } from '@/lib/superadmin/auth'

const VALID_STATUSES = new Set(['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'canceled', 'expired', 'unpaid'])

type UpdateSubscriptionBody = {
  plan?: unknown
  status?: unknown
  trial_ends_at?: unknown
  current_period_starts_at?: unknown
  current_period_ends_at?: unknown
  cancel_at_period_end?: unknown
}

function normalizeDate(value: unknown) {
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSuperAdminUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const body = (await request.json().catch(() => null)) as UpdateSubscriptionBody | null

  if (!id) {
    return NextResponse.json({ error: 'Subscription id is required' }, { status: 400 })
  }

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const plan = typeof body.plan === 'string' ? normalizePlanCode(body.plan) : undefined
  const status = typeof body.status === 'string' ? body.status : undefined
  const trialEndsAt = normalizeDate(body.trial_ends_at)
  const periodStartsAt = normalizeDate(body.current_period_starts_at)
  const periodEndsAt = normalizeDate(body.current_period_ends_at)
  const cancelAtPeriodEnd = typeof body.cancel_at_period_end === 'boolean' ? body.cancel_at_period_end : undefined

  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid subscription status' }, { status: 400 })
  }

  if (trialEndsAt === undefined || periodStartsAt === undefined || periodEndsAt === undefined) {
    return NextResponse.json({ error: 'Invalid date value' }, { status: 400 })
  }

  if (periodStartsAt && periodEndsAt && new Date(periodStartsAt) > new Date(periodEndsAt)) {
    return NextResponse.json({ error: 'Period start must be before period end' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: activePlan, error: activePlanError } = await admin
    .from('subscription_plans')
    .select('tier')
    .eq('tier', plan.toLowerCase())
    .eq('is_active', true)
    .maybeSingle()

  if (activePlanError) {
    return NextResponse.json({ error: 'Failed to validate plan' }, { status: 500 })
  }

  if (!activePlan) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const { data: previous, error: previousError } = await admin
    .from('subscriptions')
    .select('id, organization_id, plan, status, trial_ends_at, current_period_starts_at, current_period_ends_at, cancel_at_period_end')
    .eq('id', id)
    .maybeSingle()

  if (previousError) {
    return NextResponse.json({ error: 'Failed to load subscription' }, { status: 500 })
  }

  if (!previous) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const updatePayload = {
    plan,
    status,
    trial_ends_at: trialEndsAt,
    current_period_starts_at: periodStartsAt,
    current_period_ends_at: periodEndsAt,
    cancel_at_period_end: cancelAtPeriodEnd ?? false,
    updated_at: new Date().toISOString(),
  }

  const { data: subscription, error: updateError } = await admin
    .from('subscriptions')
    .update(updatePayload)
    .eq('id', id)
    .select('id, organization_id, plan, status, provider, provider_customer_id, provider_subscription_id, trial_ends_at, current_period_starts_at, current_period_ends_at, cancel_at_period_end, created_at, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }

  const { error: organizationError } = await admin
    .from('organizations')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('id', previous.organization_id)

  if (organizationError) {
    return NextResponse.json({ error: 'Subscription updated but organization plan sync failed' }, { status: 500 })
  }

  await admin.from('tenant_audit_log').insert({
    organization_id: previous.organization_id,
    user_id: user.id,
    action: 'subscription.updated',
    resource: 'subscriptions',
    resource_id: id,
    metadata: {
      before: previous,
      after: updatePayload,
      updated_by_email: user.email,
    },
    user_agent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ subscription })
}
