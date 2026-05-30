import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'

type BranchRow = {
  id: string
  name: string
  city: string | null
  is_default: boolean | null
  organization_id?: string | null
}

async function assertUserInOrganization(
  supabaseAdmin: ReturnType<typeof createAdminSupabase>,
  userId: string,
  context: AdminAuthContext
) {
  if (!context.organizationId) return true

  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', context.organizationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

async function assertBranchInOrganization(
  supabaseAdmin: ReturnType<typeof createAdminSupabase>,
  branchId: string,
  context: AdminAuthContext
) {
  let query = supabaseAdmin
    .from('branches')
    .select('id, organization_id')
    .eq('id', branchId)

  if (context.organizationId) {
    query = query.eq('organization_id', context.organizationId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return Boolean(data)
}

async function loadBranches(
  request: NextRequest,
  context: AdminAuthContext & { params: Promise<{ id: string }> }
) {
  const { id: userId } = await context.params
  const supabaseAdmin = createAdminSupabase()

  const canAccessUser = await assertUserInOrganization(supabaseAdmin, userId, context)
  if (!canAccessUser) {
    return NextResponse.json({ success: false, error: 'Usuario no pertenece a tu organizacion' }, { status: 403 })
  }

  let branchesQuery = supabaseAdmin
    .from('branches')
    .select('id, name, city, is_default, organization_id')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (context.organizationId) {
    branchesQuery = branchesQuery.eq('organization_id', context.organizationId)
  }

  const [{ data: branches, error: branchesError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      branchesQuery,
      supabaseAdmin
        .from('user_branch_assignments')
        .select('branch_id, is_primary')
        .eq('user_id', userId)
        .eq('is_active', true),
    ])

  if (branchesError) throw branchesError
  if (assignmentsError) throw assignmentsError

  const allowedBranchIds = new Set((branches || []).map((branch: BranchRow) => branch.id))

  return NextResponse.json({
    success: true,
    branches: branches || [],
    assignments: (assignments || [])
      .filter((assignment) => allowedBranchIds.has(assignment.branch_id))
      .map((assignment) => ({
        branchId: assignment.branch_id,
        isPrimary: Boolean(assignment.is_primary),
      })),
  })
}

async function updateBranchAssignment(
  request: NextRequest,
  context: AdminAuthContext & { params: Promise<{ id: string }> }
) {
  const { id: userId } = await context.params
  const body = await request.json().catch(() => ({}))
  const branchId = typeof body?.branchId === 'string' ? body.branchId : ''
  const assigned = Boolean(body?.assigned)
  const primary = Boolean(body?.primary)

  if (!branchId) {
    return NextResponse.json({ success: false, error: 'Missing branch id' }, { status: 400 })
  }

  const supabaseAdmin = createAdminSupabase()
  const [canAccessUser, canAccessBranch] = await Promise.all([
    assertUserInOrganization(supabaseAdmin, userId, context),
    assertBranchInOrganization(supabaseAdmin, branchId, context),
  ])

  if (!canAccessUser || !canAccessBranch) {
    return NextResponse.json({ success: false, error: 'Usuario o sucursal fuera de tu organizacion' }, { status: 403 })
  }

  if (assigned) {
    const { error } = await supabaseAdmin.from('user_branch_assignments').upsert(
      {
        user_id: userId,
        branch_id: branchId,
        is_primary: primary,
        is_active: true,
        assigned_by: context.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,branch_id' }
    )

    if (error) throw error
  } else {
    const { error } = await supabaseAdmin
      .from('user_branch_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('branch_id', branchId)

    if (error) throw error
  }

  return loadBranches(request, context)
}

async function setPrimaryBranch(
  request: NextRequest,
  context: AdminAuthContext & { params: Promise<{ id: string }> }
) {
  const { id: userId } = await context.params
  const body = await request.json().catch(() => ({}))
  const branchId = typeof body?.branchId === 'string' ? body.branchId : ''

  if (!branchId) {
    return NextResponse.json({ success: false, error: 'Missing branch id' }, { status: 400 })
  }

  const supabaseAdmin = createAdminSupabase()
  const [canAccessUser, canAccessBranch] = await Promise.all([
    assertUserInOrganization(supabaseAdmin, userId, context),
    assertBranchInOrganization(supabaseAdmin, branchId, context),
  ])

  if (!canAccessUser || !canAccessBranch) {
    return NextResponse.json({ success: false, error: 'Usuario o sucursal fuera de tu organizacion' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('user_branch_assignments')
    .update({ is_primary: true, is_active: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('branch_id', branchId)

  if (error) throw error

  return loadBranches(request, context)
}

export async function GET(
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> }
) {
  return withAdminAuth((req, authContext) =>
    loadBranches(req, { ...authContext, params: routeContext.params })
  )(request)
}

export async function PATCH(
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> }
) {
  return withAdminAuth((req, authContext) =>
    updateBranchAssignment(req, { ...authContext, params: routeContext.params })
  )(request)
}

export async function PUT(
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> }
) {
  return withAdminAuth((req, authContext) =>
    setPrimaryBranch(req, { ...authContext, params: routeContext.params })
  )(request)
}
