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

function canonicalPlanCode(tier: unknown) {
  const normalized = typeof tier === 'string' ? tier.toLowerCase().trim() : ''
  if (normalized === 'basic' || normalized === 'starter') return 'BASIC'
  if (normalized === 'pro' || normalized === 'profesional' || normalized === 'professional') return 'PRO'
  if (normalized === 'enterprise') return 'ENTERPRISE'
  return 'FREE'
}

function parseLimit(limits: unknown, key: string, fallback: number | null) {
  if (!limits || typeof limits !== 'object') return fallback
  const value = (limits as Record<string, unknown>)[key]
  if (value === null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    if (value.toLowerCase().startsWith('ilimit')) return null
    const parsed = Number(value.replace(/[^\d]/g, ''))
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function technicalLimits(plan: { tier?: unknown; limits?: unknown }) {
  const code = canonicalPlanCode(plan.tier)
  const defaults: Record<string, Record<string, number | null>> = {
    FREE: { users: 2, branches: 1, cashRegisters: 1, products: 50, categories: null },
    BASIC: { users: 5, branches: 2, cashRegisters: 3, products: 500, categories: null },
    PRO: { users: 15, branches: 5, cashRegisters: 10, products: 5000, categories: null },
    ENTERPRISE: { users: null, branches: null, cashRegisters: null, products: null, categories: null },
  }
  const fallback = defaults[code] ?? defaults.FREE

  return {
    users: parseLimit(plan.limits, 'users', fallback.users),
    branches: parseLimit(plan.limits, 'branches', fallback.branches),
    cashRegisters: parseLimit(plan.limits, 'cashRegisters', fallback.cashRegisters),
    products: parseLimit(plan.limits, 'products', fallback.products),
    categories: parseLimit(plan.limits, 'categories', fallback.categories),
  }
}

function technicalModules(tier: unknown) {
  const code = canonicalPlanCode(tier)
  if (code === 'FREE') return ['inventory', 'pos', 'crm']
  if (code === 'BASIC') return ['inventory', 'pos', 'crm', 'ecommerce']
  if (code === 'PRO') return ['inventory', 'pos', 'repairs', 'crm', 'ecommerce', 'whatsapp', 'analytics']
  return ['inventory', 'pos', 'repairs', 'crm', 'ecommerce', 'delivery', 'whatsapp', 'analytics']
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

  const canonicalCode = canonicalPlanCode(plan.tier)
  if (canonicalCode) {
    const canonicalPatch: Record<string, unknown> = {
      name: plan.name,
      limits: technicalLimits(plan),
      is_active: plan.is_active !== false,
      modules: technicalModules(plan.tier),
    }

    await admin
      .from('plans')
      .upsert({ code: canonicalCode, ...canonicalPatch }, { onConflict: 'code' })
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
