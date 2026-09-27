import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { deriveTechnicalModules } from '@/lib/saas/plan-modules'
import { computePlanStats, type PlanPriceRow, type SubscriptionRow } from '@/lib/saas/plan-stats'

// ---------------------------------------------------------------------------
// GET — Stats por plan: cantidad de orgs y MRR estimado
// ---------------------------------------------------------------------------

export async function GET() {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()

  const [{ data: plans }, { data: subs }] = await Promise.all([
    // Se leen TODOS los planes, no solo los activos. Desactivar un plan sirve
    // para dejar de venderlo pero conservar a quienes ya lo pagan: si su precio
    // no estuviera aca, esas organizaciones aportarian 0 y el MRR mostraria
    // menos facturacion de la real.
    admin.from('subscription_plans').select('tier, price, is_active'),
    admin.from('subscriptions').select('plan, status'),
  ])

  return NextResponse.json(
    computePlanStats(
      (plans ?? []) as PlanPriceRow[],
      (subs ?? []) as SubscriptionRow[],
    )
  )
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

  // El plan comercial (subscription_plans) es lo que se muestra y cobra; el
  // tecnico (plans) es el que habilita modulos. Si esta sincronizacion no ocurre,
  // el plan queda visible y vendible pero SIN funcionalidades, y antes eso pasaba
  // en silencio: no se miraba ni el error ni si habia coincidido alguna fila.
  const { error: modulesError, count: modulesCount } = await admin
    .from('plans')
    .update({ modules: deriveTechnicalModules(tier, plan.features) }, { count: 'exact' })
    .eq('code', tier.toUpperCase())

  if (modulesError || !modulesCount) {
    return NextResponse.json(
      {
        error: modulesError
          ? `El plan se creó, pero no se pudieron sincronizar sus módulos: ${modulesError.message}`
          : `El plan se creó, pero no existe el plan técnico con código ${tier.toUpperCase()}: las organizaciones que lo contraten no tendrán módulos habilitados.`,
        plan,
      },
      { status: 500 }
    )
  }

  await admin.from('tenant_audit_log').insert({
    user_id: user.id,
    action: 'subscription_plan.created',
    resource: 'subscription_plans',
    resource_id: plan.id,
    metadata: { tier, name, price },
  }).then(() => {}, () => {})

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'subscription_plan.created',
    resource: 'subscription_plans',
    resourceId: plan.id,
    newValues: { tier, name, price },
    request,
  })

  return NextResponse.json({ plan }, { status: 201 })
}
