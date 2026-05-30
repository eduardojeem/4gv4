import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'

type UpdatePlanBody = {
  name?: unknown
  price?: unknown
  price_note?: unknown
  description?: unknown
  is_popular?: unknown
  is_active?: unknown
  limits?: unknown
  highlights?: unknown
  features?: unknown
  color_config?: unknown
}

function optionalText(value: unknown) {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function optionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function optionalJson(value: unknown) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (Array.isArray(value) || typeof value === 'object') return value
  return undefined
}

function deriveModules(features: unknown) {
  if (!Array.isArray(features)) return undefined

  return features
    .filter((feature): feature is { label?: unknown; value?: unknown } => Boolean(feature) && typeof feature === 'object')
    .filter((feature) => feature.value === true || (typeof feature.value === 'string' && feature.value.trim().length > 0))
    .map((feature) => String(feature.label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))
    .filter(Boolean)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSuperAdminUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const body = (await request.json().catch(() => null)) as UpdatePlanBody | null

  if (!id) {
    return NextResponse.json({ error: 'Plan id is required' }, { status: 400 })
  }

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if ('name' in body) {
    const name = optionalText(body.name)
    if (!name) return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })
    patch.name = name
  }

  if ('price' in body) {
    const price = optionalNumber(body.price)
    if (price === undefined || price < 0) return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    patch.price = price
  }

  if ('price_note' in body) patch.price_note = optionalText(body.price_note)
  if ('description' in body) patch.description = optionalText(body.description)
  if ('is_popular' in body) patch.is_popular = Boolean(body.is_popular)
  if ('is_active' in body) patch.is_active = Boolean(body.is_active)

  for (const key of ['limits', 'highlights', 'features', 'color_config'] as const) {
    if (key in body) {
      const value = optionalJson(body[key])
      if (value === undefined) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
      patch[key] = value
    }
  }

  const admin = createAdminSupabase()
  const { data: plan, error } = await admin
    .from('subscription_plans')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to update plan' }, { status: 500 })
  }

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const canonicalCode = typeof plan.tier === 'string' ? plan.tier.toUpperCase() : null
  if (canonicalCode) {
    const modules = deriveModules(plan.features)
    const canonicalPatch: Record<string, unknown> = {
      name: plan.name,
      limits: plan.limits || {},
      is_active: plan.is_active !== false,
    }

    if (modules?.length) canonicalPatch.modules = modules

    await admin
      .from('plans')
      .update(canonicalPatch)
      .eq('code', canonicalCode)
  }

  await admin.from('tenant_audit_log').insert({
    user_id: user.id,
    action: 'subscription_plan.updated',
    resource: 'subscription_plans',
    resource_id: id,
    metadata: {
      patch,
      updated_by_email: user.email,
      tier: plan.tier,
    },
    user_agent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ plan })
}
