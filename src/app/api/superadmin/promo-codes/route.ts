import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { promoCodeCreateSchema } from '@/lib/superadmin/promo-codes'

export async function GET() {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabase()
  const [{ data: codes, error }, { data: redemptions }, { data: organizations }, { data: plans }] = await Promise.all([
    admin.from('subscription_promo_codes').select('*').order('created_at', { ascending: false }),
    admin.from('subscription_promo_redemptions').select('id, promo_code_id, organization_id, redeemed_at').order('redeemed_at', { ascending: false }),
    admin.from('organizations').select('id, name, slug, plan').order('name'),
    admin.from('subscription_plans').select('tier, name').eq('is_active', true).order('price'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const redemptionCounts = new Map<string, number>()
  for (const redemption of redemptions ?? []) {
    redemptionCounts.set(redemption.promo_code_id, (redemptionCounts.get(redemption.promo_code_id) ?? 0) + 1)
  }

  // Detalle de canjes enriquecido con el nombre de la organización (quién activó y cuándo).
  const orgNameById = new Map((organizations ?? []).map((o: { id: string; name: string }) => [o.id, o.name]))
  const enrichedRedemptions = (redemptions ?? []).map((r) => ({
    id: r.id,
    promo_code_id: r.promo_code_id,
    organization_id: r.organization_id,
    organization_name: orgNameById.get(r.organization_id) ?? '—',
    redeemed_at: r.redeemed_at,
  }))

  return NextResponse.json({
    codes: (codes ?? []).map(code => ({ ...code, redemption_count: redemptionCounts.get(code.id) ?? 0 })),
    redemptions: enrichedRedemptions,
    organizations: organizations ?? [],
    plans: plans ?? [],
  })
}

export async function POST(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = promoCodeCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }, { status: 400 })
  }

  const value = parsed.data
  const admin = createAdminSupabase()

  if (value.benefitType === 'activate_plan') {
    const { data: plan, error: planError } = await admin
      .from('subscription_plans')
      .select('tier')
      .eq('tier', value.targetPlan!.toLowerCase())
      .eq('is_active', true)
      .maybeSingle()

    if (planError) return NextResponse.json({ error: 'No se pudo validar el plan seleccionado.' }, { status: 500 })
    if (!plan) return NextResponse.json({ error: 'El plan seleccionado no está disponible.' }, { status: 400 })
  }

  const { data: code, error } = await admin
    .from('subscription_promo_codes')
    .insert({
      code: value.code,
      name: value.name,
      description: value.description || null,
      benefit_type: value.benefitType,
      discount_percent: value.discountPercent ?? null,
      discount_amount: value.discountAmount ?? null,
      target_plan: value.targetPlan?.toUpperCase() ?? null,
      duration_days: value.durationDays ?? null,
      duration_unit: value.durationUnit ?? 'days',
      max_redemptions: value.maxRedemptions ?? null,
      starts_at: value.startsAt ?? null,
      expires_at: value.expiresAt ?? null,
      is_active: value.isActive,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return NextResponse.json({ error: status === 409 ? 'Ese código ya existe.' : error.message }, { status })
  }

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'promo_code.created',
    resource: 'subscription_promo_codes',
    resourceId: code.id,
    newValues: { code: code.code, benefit_type: code.benefit_type },
    request,
  })

  return NextResponse.json({ code: { ...code, redemption_count: 0 } }, { status: 201 })
}
