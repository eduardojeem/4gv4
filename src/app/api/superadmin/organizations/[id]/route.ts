import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { planOrganizationUpdate, type CurrentOrganization, type CurrentSubscription } from '@/lib/superadmin/organization-update'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminSupabase()

  // Find organization by ID or by slug
  let query = admin.from('organizations').select('*')
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    query = query.eq('id', id)
  } else {
    query = query.eq('slug', id)
  }

  const { data: org, error: orgError } = await query.maybeSingle()
  if (orgError || !org) {
    return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
  }

  // Load associated data in parallel
  const [
    { data: memberRows, error: membersError },
    { data: subscription },
    { data: settings },
    { data: branches },
    { count: productsCount },
    { count: salesCount },
    { count: customersCount },
  ] = await Promise.all([
    // `organization_members.user_id` referencia `auth.users(id)`, no
    // `public.profiles`: PostgREST no puede resolver el embebido y devuelve un
    // error, que aca se servia como `members: []`.
    admin
      .from('organization_members')
      .select('id, user_id, role, status, created_at')
      .eq('organization_id', org.id),
    admin
      .from('subscriptions')
      .select('*')
      .eq('organization_id', org.id)
      .maybeSingle(),
    admin
      .from('organization_settings')
      .select('*')
      .eq('organization_id', org.id)
      .maybeSingle(),
    admin
      .from('branches')
      .select('id, name, code, slug, address, city, phone, email, is_active, is_default, created_at')
      .eq('organization_id', org.id),
    admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
    admin
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
  ])

  if (membersError) {
    return NextResponse.json(
      { error: 'No se pudo cargar el equipo de la organizacion.' },
      { status: 500 }
    )
  }

  type MemberRow = { user_id?: string | null; role?: string; [key: string]: unknown }
  type MemberProfile = { id: string; email?: string | null; full_name?: string | null; avatar_url?: string | null }

  const memberList = (memberRows ?? []) as MemberRow[]
  const memberUserIds = Array.from(
    new Set(memberList.map((m) => String(m.user_id ?? '')).filter(Boolean))
  )
  const { data: memberProfiles } = memberUserIds.length
    ? await admin
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', memberUserIds)
    : { data: [] as MemberProfile[] }
  const profileById = new Map<string, MemberProfile>(
    (memberProfiles ?? []).map((p): [string, MemberProfile] => [String(p.id), p as MemberProfile])
  )

  // Get plan details if subscription or org.plan exists
  let planDetails = null
  const planTier = (subscription?.plan || org.plan || 'FREE').toLowerCase()
  const { data: planRow } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('tier', planTier)
    .maybeSingle()
  if (planRow) {
    planDetails = planRow
  }

  // Owner profile
  let ownerProfile = null
  if (org.owner_id) {
    const { data: owner } = await admin
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', org.owner_id)
      .maybeSingle()
    ownerProfile = owner
  }

  return NextResponse.json({
    organization: org,
    owner: ownerProfile,
    settings,
    members: memberList.map((m) => ({ ...m, profiles: profileById.get(String(m.user_id)) ?? null })),
    subscription,
    plan_details: planDetails,
    branches: branches ?? [],
    counts: {
      products: productsCount ?? 0,
      sales: salesCount ?? 0,
      customers: customersCount ?? 0,
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminSupabase()

  // Resolve organization ID
  let targetId = id
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    const { data: foundOrg } = await admin.from('organizations').select('id').eq('slug', id).maybeSingle()
    if (!foundOrg) {
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
    }
    targetId = foundOrg.id
  }

  const body = await request.json().catch(() => ({}))
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  // Estado actual: para validar, para la auditoría y para deshacer si algo falla.
  const [{ data: currentOrg, error: fetchError }, { data: currentSub, error: subError }, { data: currentSettings }] = await Promise.all([
    admin.from('organizations').select('*').eq('id', targetId).maybeSingle(),
    admin.from('subscriptions').select('*').eq('organization_id', targetId).maybeSingle(),
    admin.from('organization_settings').select('*').eq('organization_id', targetId).maybeSingle(),
  ])

  if (fetchError || !currentOrg) {
    return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
  }
  if (subError) {
    return NextResponse.json({ error: 'No se pudo consultar la suscripción. Volvé a intentar.' }, { status: 500 })
  }

  // Todo se valida antes de escribir: antes un dato inválido podía dejar la
  // empresa guardada y la suscripción sin guardar.
  const planned = planOrganizationUpdate(
    body as Record<string, unknown>,
    currentOrg as CurrentOrganization,
    (currentSub as CurrentSubscription) ?? null,
  )
  if (planned.ok === false) {
    return NextResponse.json({ error: planned.error, field: planned.field }, { status: 400 })
  }
  const { organization: orgPatch, subscription: subPatch, settings: settingsPatch, slugChange } = planned.plan

  if (slugChange) {
    const { data: conflict } = await admin.from('organizations').select('id').eq('slug', slugChange.to).maybeSingle()
    if (conflict && conflict.id !== targetId) {
      return NextResponse.json({ error: `La dirección "${slugChange.to}" ya está en uso por otra empresa.`, field: 'slug' }, { status: 409 })
    }
  }

  const previousOf = (row: Record<string, unknown> | null | undefined, patch: Record<string, unknown>) =>
    Object.fromEntries(Object.keys(patch).map((key) => [key, row?.[key] ?? null]))
  const undo: Array<() => PromiseLike<unknown>> = []
  const rollback = async () => {
    for (const step of [...undo].reverse()) await Promise.resolve(step()).catch(() => undefined)
  }

  // 1. Empresa
  if (Object.keys(orgPatch).length) {
    const orgBefore = previousOf(currentOrg as Record<string, unknown>, orgPatch)
    const { error } = await admin.from('organizations').update({ ...orgPatch, updated_at: new Date().toISOString() }).eq('id', targetId)
    if (error) {
      return NextResponse.json({ error: 'No se pudo actualizar la empresa. Revisá los datos y volvé a intentar.' }, { status: 500 })
    }
    undo.push(() => admin.from('organizations').update(orgBefore).eq('id', targetId))
  }

  // 2. Suscripción
  if (subPatch) {
    const sub = currentSub as Record<string, unknown> | null
    const result = sub
      ? await admin.from('subscriptions').update({ ...subPatch, updated_at: new Date().toISOString() }).eq('id', String(sub.id))
      : await admin.from('subscriptions').insert({
          organization_id: targetId,
          plan: subPatch.plan ?? currentOrg.plan ?? 'FREE',
          status: subPatch.status ?? 'active',
          provider: 'manual',
          trial_ends_at: subPatch.trial_ends_at ?? null,
          current_period_ends_at: subPatch.current_period_ends_at ?? null,
          cancel_at_period_end: subPatch.cancel_at_period_end ?? false,
          ...(subPatch.payment_status ? { payment_status: subPatch.payment_status } : {}),
        })
    if (result.error) {
      await rollback()
      return NextResponse.json({ error: 'No se pudo guardar la suscripción. No se aplicó ningún cambio.' }, { status: 500 })
    }
    undo.push(() => sub
      ? admin.from('subscriptions').update(previousOf(sub, subPatch)).eq('id', String(sub.id))
      : admin.from('subscriptions').delete().eq('organization_id', targetId))
  }

  // 3. Moneda y zona horaria (antes un error acá se informaba como éxito)
  if (settingsPatch) {
    const result = currentSettings
      ? await admin.from('organization_settings').update(settingsPatch).eq('organization_id', targetId)
      : await admin.from('organization_settings').insert({ organization_id: targetId, ...settingsPatch })
    if (result.error) {
      await rollback()
      return NextResponse.json({ error: 'No se pudieron guardar la moneda y la zona horaria. No se aplicó ningún cambio.' }, { status: 500 })
    }
  }

  // 4. La dirección vieja redirige a la nueva, como al cambiarla desde
  // Configuración del sitio: los enlaces y QR ya compartidos siguen andando.
  if (slugChange) {
    await Promise.all([
      admin.from('organization_slug_aliases').delete().eq('old_slug', slugChange.to),
      admin.from('organization_slug_aliases').upsert(
        { organization_id: targetId, old_slug: slugChange.from, new_slug: slugChange.to, created_by: superAdmin.id },
        { onConflict: 'old_slug' },
      ),
    ]).catch((error) => {
      console.warn('[superadmin] No se pudo guardar el alias de la dirección', { organizationId: targetId, error: error instanceof Error ? error.message : String(error) })
    })
  }

  // 5. Auditoría: todo lo que se cambió, no solo nombre, plan y estado.
  await logSuperAdminAction({
    actorId: superAdmin.id,
    actorEmail: superAdmin.email,
    action: 'update',
    resource: 'organizations',
    resourceId: targetId,
    organizationId: targetId,
    oldValues: {
      ...(currentOrg as Record<string, unknown>),
      subscription: currentSub ?? null,
      settings: currentSettings ? { currency: currentSettings.currency, timezone: currentSettings.timezone } : null,
    },
    newValues: { ...orgPatch, ...(subPatch ? { subscription: subPatch } : {}), ...(settingsPatch ?? {}) },
    request,
  })

  return NextResponse.json({
    success: true,
    message: 'Organización actualizada exitosamente.',
  })
}
