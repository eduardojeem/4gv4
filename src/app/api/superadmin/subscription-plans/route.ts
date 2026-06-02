import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'

// ---------------------------------------------------------------------------
// GET — Stats por plan: cantidad de orgs y MRR estimado
// ---------------------------------------------------------------------------

export async function GET() {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()

  const [{ data: plans }, { data: subs }] = await Promise.all([
    admin.from('subscription_plans').select('tier, price, is_active').eq('is_active', true),
    admin.from('subscriptions').select('plan, status'),
  ])

  const priceByTier = new Map<string, number>()
  ;((plans ?? []) as Array<{ tier: string; price: number }>).forEach((p) => {
    priceByTier.set(p.tier.toUpperCase(), Number(p.price) || 0)
  })

  // Count orgs and MRR by plan
  const orgsByPlan = new Map<string, number>()
  const activeByPlan = new Map<string, number>()
  let mrr = 0
  let activeSubs = 0
  let trialingSubs = 0

  ;((subs ?? []) as Array<{ plan: string | null; status: string | null }>).forEach((s) => {
    const tier = (s.plan ?? 'FREE').toUpperCase()
    orgsByPlan.set(tier, (orgsByPlan.get(tier) ?? 0) + 1)

    if (s.status === 'active') {
      activeByPlan.set(tier, (activeByPlan.get(tier) ?? 0) + 1)
      mrr += priceByTier.get(tier) ?? 0
      activeSubs++
    }
    if (s.status === 'trialing') trialingSubs++
  })

  // Most used plan
  let mostUsedPlan: string | null = null
  let mostUsedCount = 0
  orgsByPlan.forEach((count, tier) => {
    if (count > mostUsedCount) {
      mostUsedCount = count
      mostUsedPlan = tier
    }
  })

  const totalOrgs = Array.from(orgsByPlan.values()).reduce((a, b) => a + b, 0)
  const mostUsedPercent = totalOrgs > 0 ? Math.round((mostUsedCount / totalOrgs) * 100) : 0

  return NextResponse.json({
    orgsByPlan: Object.fromEntries(orgsByPlan),
    activeByPlan: Object.fromEntries(activeByPlan),
    mrr,
    activeSubs,
    trialingSubs,
    totalOrgs,
    mostUsedPlan,
    mostUsedPercent,
  })
}

// ---------------------------------------------------------------------------
// POST — Crear nuevo plan
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const tier = typeof body.tier === 'string' ? body.tier.toLowerCase().trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const price = typeof body.price === 'number' ? body.price : Number(body.price)

  if (!tier || !/^[a-z0-9_]+$/.test(tier)) {
    return NextResponse.json({ error: 'tier inválido (solo letras minúsculas, números, guiones bajos)' }, { status: 400 })
  }
  if (!['free', 'basic', 'pro', 'enterprise'].includes(tier)) {
    return NextResponse.json({ error: 'tier debe ser: free, basic, pro o enterprise' }, { status: 400 })
  }
  if (!name) return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'price debe ser un número ≥ 0' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Check uniqueness
  const { data: existing } = await admin.from('subscription_plans').select('id').eq('tier', tier).maybeSingle()
  if (existing) return NextResponse.json({ error: `El tier "${tier}" ya existe` }, { status: 409 })

  const { data: plan, error } = await admin
    .from('subscription_plans')
    .insert({
      tier,
      name,
      price,
      price_note: typeof body.price_note === 'string' ? body.price_note : (price === 0 ? 'Siempre gratis' : 'por mes'),
      description: typeof body.description === 'string' ? body.description : null,
      is_popular: false,
      is_active: true,
      trial_days: typeof body.trial_days === 'number' ? Math.floor(body.trial_days) : 14,
      limits: typeof body.limits === 'object' ? body.limits : {},
      highlights: Array.isArray(body.highlights) ? body.highlights : [],
      features: Array.isArray(body.features) ? body.features : [],
      color_config: typeof body.color_config === 'object' ? body.color_config : {},
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('tenant_audit_log').insert({
    user_id: user.id,
    action: 'subscription_plan.created',
    resource: 'subscription_plans',
    resource_id: plan.id,
    metadata: { tier, name, price },
  }).then(() => {}, () => {})

  return NextResponse.json({ plan }, { status: 201 })
}
