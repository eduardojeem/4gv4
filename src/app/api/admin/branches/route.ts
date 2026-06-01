import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { canCreateResource } from '@/lib/saas/subscription-service'

type BranchPayload = {
  organization_id?: unknown
  name?: unknown
  code?: unknown
  slug?: unknown
  address?: unknown
  city?: unknown
  phone?: unknown
  email?: unknown
  manager_name?: unknown
  is_active?: unknown
  is_default?: unknown
}

type OrganizationSummary = {
  id: string
  name: string
  slug?: string | null
}

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toOptionalText(value: unknown) {
  const normalized = toText(value)
  return normalized.length > 0 ? normalized : null
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function loadOrganizationMap(organizationIds: string[]) {
  const supabase = createAdminSupabase()
  const uniqueIds = Array.from(new Set(organizationIds.filter(Boolean)))
  const organizations = new Map<string, OrganizationSummary>()

  if (uniqueIds.length === 0) {
    return organizations
  }

  const [{ data: orgRows }, { data: settingRows }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug')
      .in('id', uniqueIds),
    supabase
      .from('organization_settings')
      .select('organization_id, display_name')
      .in('organization_id', uniqueIds),
  ])

  const settingsByOrgId = new Map(
    (settingRows ?? []).map((row: { organization_id: string; display_name?: string | null }) => [
      row.organization_id,
      row.display_name,
    ])
  )

  for (const organization of orgRows ?? []) {
    organizations.set(organization.id, {
      id: organization.id,
      name: settingsByOrgId.get(organization.id) || organization.name || 'Organizacion sin nombre',
      slug: organization.slug ?? null,
    })
  }

  return organizations
}

async function listOrganizations() {
  const organizationMap = await loadOrganizationMap([])
  const supabase = createAdminSupabase()
  const [{ data: orgRows }, { data: settingRows }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug')
      .order('name', { ascending: true }),
    supabase
      .from('organization_settings')
      .select('organization_id, display_name'),
  ])

  const settingsByOrgId = new Map(
    (settingRows ?? []).map((row: { organization_id: string; display_name?: string | null }) => [
      row.organization_id,
      row.display_name,
    ])
  )

  for (const organization of orgRows ?? []) {
    organizationMap.set(organization.id, {
      id: organization.id,
      name: settingsByOrgId.get(organization.id) || organization.name || 'Organizacion sin nombre',
      slug: organization.slug ?? null,
    })
  }

  return Array.from(organizationMap.values()).sort((left, right) => left.name.localeCompare(right.name, 'es'))
}

async function resolveWritableOrganizationId(ctx: AdminAuthContext, requestedOrganizationId: unknown) {
  if (ctx.organizationId) {
    return ctx.organizationId
  }

  const organizationId = toText(requestedOrganizationId)
  if (!organizationId) {
    return null
  }

  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.id
}

async function getBranchMetrics(branchId: string) {
  const supabase = createAdminSupabase()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthStartIso = monthStart.toISOString()

  const [
    usersCountResult,
    primaryUsersResult,
    registersCountResult,
    openRegistersCountResult,
    salesResult,
    repairsCountResult,
  ] = await Promise.all([
    supabase
      .from('user_branch_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_active', true),
    supabase
      .from('user_branch_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .eq('is_primary', true),
    supabase
      .from('cash_registers')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId),
    supabase
      .from('cash_registers')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_open', true),
    supabase
      .from('sales')
      .select('id, total_amount, total, created_at')
      .eq('branch_id', branchId)
      .gte('created_at', monthStartIso),
    supabase
      .from('repairs')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId),
  ])

  const salesRows = (salesResult.data ?? []) as Array<{
    total_amount?: number | string | null
    total?: number | string | null
  }>

  const revenueTotal = salesRows.reduce((sum, sale) => {
    const totalAmount = Number(sale.total_amount ?? sale.total ?? 0)
    return sum + (Number.isFinite(totalAmount) ? totalAmount : 0)
  }, 0)

  return {
    users_count: usersCountResult.count ?? 0,
    primary_users_count: primaryUsersResult.count ?? 0,
    registers_count: registersCountResult.count ?? 0,
    open_registers_count: openRegistersCountResult.count ?? 0,
    sales_count: salesRows.length,
    repairs_count: repairsCountResult.count ?? 0,
    revenue_total: revenueTotal,
  }
}

async function getHandler(request: NextRequest, ctx: AdminAuthContext) {
  try {
    const supabase = createAdminSupabase()
    const requestedOrganizationId = toText(request.nextUrl.searchParams.get('organizationId'))
    const organizations = ctx.user.role === 'super_admin' ? await listOrganizations() : []

    if (ctx.user.role === 'super_admin' && !requestedOrganizationId) {
      return NextResponse.json({ branches: [], organizations })
    }

    if (ctx.user.role === 'super_admin' && !organizations.some((organization) => organization.id === requestedOrganizationId)) {
      return NextResponse.json({ error: 'Organizacion invalida.' }, { status: 400 })
    }

    let query = supabase
      .from('branches')
      .select('id, organization_id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (ctx.organizationId) {
      query = query.eq('organization_id', ctx.organizationId)
    } else if (requestedOrganizationId) {
      query = query.eq('organization_id', requestedOrganizationId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message || 'No se pudieron cargar las sucursales.' },
        { status: error.message?.includes('branches') ? 503 : 500 }
      )
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>
    const organizationMap = ctx.user.role === 'super_admin'
      ? await loadOrganizationMap(rows.map((branch) => String(branch.organization_id ?? '')))
      : new Map<string, OrganizationSummary>()

    const branches = await Promise.all(
      rows.map(async (branch) => ({
        ...branch,
        organization: typeof branch.organization_id === 'string'
          ? organizationMap.get(branch.organization_id) ?? null
          : null,
        ...(await getBranchMetrics(String(branch.id))),
      }))
    )

    return NextResponse.json({ branches, organizations })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function postHandler(request: NextRequest, ctx: AdminAuthContext) {
  try {
    const body = await request.json() as BranchPayload

    const name = toText(body.name)
    const code = toText(body.code).toUpperCase() || slugify(name).slice(0, 12).toUpperCase()
    const slug = toText(body.slug) || slugify(name)

    if (!name) {
      return NextResponse.json({ error: 'El nombre de la sucursal es obligatorio.' }, { status: 400 })
    }

    if (!code) {
      return NextResponse.json({ error: 'No se pudo generar un código válido para la sucursal.' }, { status: 400 })
    }

    if (!slug) {
      return NextResponse.json({ error: 'No se pudo generar un identificador válido para la sucursal.' }, { status: 400 })
    }

    const supabase = createAdminSupabase()
    const organizationId = await resolveWritableOrganizationId(ctx, body.organization_id)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Selecciona una organizacion valida para crear la sucursal.' },
        { status: 400 }
      )
    }

    const planGate = await canCreateResource(organizationId, 'branches')

    if (!planGate.allowed) {
      return NextResponse.json(
        {
          error: `Tu plan ${planGate.plan.name} permite hasta ${planGate.limit} sucursales. Actualiza el plan para crear mas.`,
          code: 'PLAN_LIMIT_REACHED',
          resource: 'branches',
          current: planGate.current,
          limit: planGate.limit,
        },
        { status: 402 }
      )
    }

    const insertPayload: Record<string, unknown> = {
      organization_id: organizationId,
      name,
      code,
      slug,
      address: toOptionalText(body.address),
      city: toOptionalText(body.city),
      phone: toOptionalText(body.phone),
      email: toOptionalText(body.email),
      manager_name: toOptionalText(body.manager_name),
      is_active: toBoolean(body.is_active, true),
      is_default: toBoolean(body.is_default, false),
    }

    const { data, error } = await supabase
      .from('branches')
      .insert(insertPayload)
      .select('id, organization_id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .single()

    if (error || !data) {
      const status = error?.message?.includes('duplicate') || error?.message?.includes('unique') ? 409 : 500
      return NextResponse.json(
        { error: error?.message || 'No se pudo crear la sucursal.' },
        { status }
      )
    }

    await supabase
      .from('user_branch_assignments')
      .insert({
        user_id: ctx.user.id,
        branch_id: data.id,
        is_active: true,
        is_primary: false,
        assigned_by: ctx.user.id,
      })
      .select('id')
      .maybeSingle()

    return NextResponse.json({ branch: data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withAdminAuth(getHandler)
export const POST = withAdminAuth(postHandler)
