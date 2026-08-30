import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'

function normalizePlanCode(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'basic' || normalized === 'starter') return 'BASIC'
  if (normalized === 'pro' || normalized === 'profesional' || normalized === 'professional') return 'PRO'
  if (normalized === 'enterprise') return 'ENTERPRISE'
  return 'FREE'
}

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
    { data: members },
    { data: subscription },
    { data: settings },
    { data: branches },
    { count: productsCount },
    { count: salesCount },
    { count: customersCount },
  ] = await Promise.all([
    admin
      .from('organization_members')
      .select('id, user_id, role, status, created_at, profiles(id, email, full_name, avatar_url)')
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
    members: members ?? [],
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
  const name = typeof body.name === 'string' ? body.name.trim() : undefined
  const slug = typeof body.slug === 'string' ? body.slug.trim() : undefined
  const plan = typeof body.plan === 'string' ? normalizePlanCode(body.plan) : undefined
  const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : undefined
  const currency = typeof body.currency === 'string' ? body.currency.trim() : undefined
  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : undefined
  const businessVertical = typeof body.business_vertical === 'string' ? body.business_vertical.trim().toLowerCase() : undefined
  const operatingModel = typeof body.operating_model === 'string' ? body.operating_model.trim().toLowerCase() : undefined
  const enabledModules = Array.isArray(body.enabled_modules) ? body.enabled_modules : undefined
  const trialEndsAt = body.trial_ends_at !== undefined ? body.trial_ends_at : undefined
  const currentPeriodEndsAt = body.current_period_ends_at !== undefined ? body.current_period_ends_at : undefined
  const cancelAtPeriodEnd = typeof body.cancel_at_period_end === 'boolean' ? body.cancel_at_period_end : undefined

  // Fetch current organization state for audit diff
  const { data: currentOrg, error: fetchError } = await admin
    .from('organizations')
    .select('*')
    .eq('id', targetId)
    .maybeSingle()

  if (fetchError || !currentOrg) {
    return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
  }

  // Validate slug if changed
  if (slug && slug !== currentOrg.slug) {
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: 'El slug solo puede contener letras minúsculas, números y guiones.' }, { status: 400 })
    }
    const { data: conflict } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
    if (conflict && conflict.id !== targetId) {
      return NextResponse.json({ error: `El slug "${slug}" ya está en uso por otra empresa.` }, { status: 409 })
    }
  }

  // 1. Update organizations table
  const orgUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (name !== undefined) orgUpdates.name = name
  if (slug !== undefined) orgUpdates.slug = slug
  if (plan !== undefined) orgUpdates.plan = plan
  if (businessVertical !== undefined) orgUpdates.business_vertical = businessVertical
  if (operatingModel !== undefined) orgUpdates.operating_model = operatingModel
  if (enabledModules !== undefined) orgUpdates.enabled_modules = enabledModules

  const { error: orgUpdateError } = await admin
    .from('organizations')
    .update(orgUpdates)
    .eq('id', targetId)

  if (orgUpdateError) {
    return NextResponse.json({ error: orgUpdateError.message || 'Error al actualizar organización.' }, { status: 500 })
  }

  // 2. Update or sync subscription table if plan or status provided
  if (plan !== undefined || status !== undefined || trialEndsAt !== undefined || currentPeriodEndsAt !== undefined || cancelAtPeriodEnd !== undefined) {
    const subUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (plan !== undefined) subUpdates.plan = plan
    if (status !== undefined) subUpdates.status = status
    if (trialEndsAt !== undefined) subUpdates.trial_ends_at = trialEndsAt
    if (currentPeriodEndsAt !== undefined) subUpdates.current_period_ends_at = currentPeriodEndsAt
    if (cancelAtPeriodEnd !== undefined) subUpdates.cancel_at_period_end = cancelAtPeriodEnd

    // Check if subscription exists
    const { data: existingSub } = await admin.from('subscriptions').select('id').eq('organization_id', targetId).maybeSingle()
    if (existingSub) {
      await admin.from('subscriptions').update(subUpdates).eq('id', existingSub.id)
    } else if (plan !== undefined) {
      await admin.from('subscriptions').insert({
        organization_id: targetId,
        plan: plan,
        status: status || 'active',
        provider: 'manual',
        trial_ends_at: trialEndsAt || null,
        current_period_ends_at: currentPeriodEndsAt || null,
        cancel_at_period_end: cancelAtPeriodEnd || false,
      })
    }
  }

  // 3. Update organization_settings table if currency/timezone provided
  if (currency !== undefined || timezone !== undefined) {
    const settingsUpdates: Record<string, unknown> = {}
    if (currency !== undefined) settingsUpdates.currency = currency
    if (timezone !== undefined) settingsUpdates.timezone = timezone

    const { data: existingSettings } = await admin.from('organization_settings').select('organization_id').eq('organization_id', targetId).maybeSingle()
    if (existingSettings) {
      await admin.from('organization_settings').update(settingsUpdates).eq('organization_id', targetId)
    } else {
      await admin.from('organization_settings').insert({
        organization_id: targetId,
        ...settingsUpdates,
      })
    }
  }

  // 4. Audit Log
  await logSuperAdminAction({
    actorId: superAdmin.id,
    actorEmail: superAdmin.email,
    action: 'update',
    resource: 'organizations',
    resourceId: targetId,
    organizationId: targetId,
    oldValues: currentOrg as Record<string, unknown>,
    newValues: { name, slug, plan, status, currency, timezone },
    request,
  })

  return NextResponse.json({
    success: true,
    message: 'Organización actualizada exitosamente.',
  })
}