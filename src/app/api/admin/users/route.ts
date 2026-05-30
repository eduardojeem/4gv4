import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

type CanonicalRole = 'super_admin' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'
type ProfileStatus = 'active' | 'inactive' | 'suspended'

type ProfileRow = {
  id: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  status?: string | null
  department?: string | null
  phone?: string | null
  avatar_url?: string | null
  permissions?: string[] | null
  updated_at?: string | null
  created_at?: string | null
}

type MemberRow = {
  user_id: string
  organization_id?: string | null
  role?: string | null
  status?: string | null
}

type OrganizationRow = {
  id: string
  name: string
  slug?: string | null
}

type OrganizationSettingRow = {
  organization_id: string
  display_name?: string | null
}

type UserOrganizationSummary = {
  id: string
  name: string
  slug?: string | null
  role?: string | null
  status?: string | null
}

const DEFAULT_ROLE: CanonicalRole = 'cliente'
const DEFAULT_STATUS: ProfileStatus = 'active'

function normalizeRole(role: unknown): CanonicalRole {
  if (typeof role !== 'string') return DEFAULT_ROLE
  const mapped = mapUiRoleToDbRole(role)
  if (mapped === 'super_admin' || mapped === 'admin' || mapped === 'vendedor' || mapped === 'tecnico' || mapped === 'cliente') {
    return mapped
  }

  switch (role.toLowerCase().trim()) {
    case 'owner':
      return 'admin'
    case 'seller':
    case 'cashier':
    case 'manager':
      return 'vendedor'
    case 'technician':
      return 'tecnico'
    case 'customer':
      return 'cliente'
    default:
      return DEFAULT_ROLE
  }
}

function normalizeStatus(status: unknown): ProfileStatus {
  if (status === 'active' || status === 'inactive' || status === 'suspended') {
    return status
  }
  return DEFAULT_STATUS
}

function mapAppRoleToOrgRole(role: CanonicalRole): string {
  switch (role) {
    case 'admin':
      return 'admin'
    case 'vendedor':
      return 'seller'
    case 'tecnico':
      return 'technician'
    case 'cliente':
      return 'customer'
    default:
      return 'customer'
  }
}

function mapProfile(
  profile: ProfileRow,
  membership?: MemberRow,
  permissions: string[] = [],
  organizations: UserOrganizationSummary[] = []
) {
  const role = normalizeRole(membership?.role ?? profile.role)
  const status = normalizeStatus(membership?.status ?? profile.status)

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role === 'super_admin' ? 'super_admin' : role,
    status,
    department: profile.department,
    phone: profile.phone,
    avatar_url: profile.avatar_url,
    permissions: permissions.length > 0 ? permissions : profile.permissions ?? [],
    organizations,
    updated_at: profile.updated_at,
    created_at: profile.created_at,
  }
}

function calculateStats(users: ReturnType<typeof mapProfile>[]) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()

  return {
    total: users.length,
    active: users.filter((user) => user.status === 'active').length,
    inactive: users.filter((user) => user.status === 'inactive').length,
    admins: users.filter((user) => user.role === 'admin' || user.role === 'super_admin').length,
    newThisMonth: users.filter((user) => {
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0
      return Number.isFinite(createdAt) && createdAt >= startOfMonth
    }).length,
  }
}

function matchesFilters(
  user: ReturnType<typeof mapProfile>,
  filters: { search: string; role: string; status: string; id?: string | null }
) {
  if (filters.id && user.id !== filters.id) return false

  if (filters.search) {
    const haystack = `${user.full_name ?? ''} ${user.email ?? ''}`.toLowerCase()
    if (!haystack.includes(filters.search.toLowerCase())) return false
  }

  if (filters.role !== 'all' && user.role !== normalizeRole(filters.role)) return false
  if (filters.status !== 'all' && user.status !== normalizeStatus(filters.status)) return false

  return true
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

async function loadUsers(request: NextRequest, context: AdminAuthContext) {
  const supabaseAdmin = createAdminSupabase()
  const params = request.nextUrl.searchParams
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? '10') || 10))
  const filters = {
    search: params.get('search')?.trim() ?? '',
    role: params.get('role') ?? 'all',
    status: params.get('status') ?? 'all',
    id: params.get('id'),
  }

  let membersByUserId = new Map<string, MemberRow>()
  let profileRows: ProfileRow[] = []

  if (context.organizationId) {
    const { data: members, error: membersError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role, status')
      .eq('organization_id', context.organizationId)

    if (membersError) throw membersError

    membersByUserId = new Map((members ?? []).map((member: MemberRow) => [member.user_id, member]))
    const userIds = Array.from(membersByUserId.keys())

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, role, status, department, phone, avatar_url, permissions, updated_at, created_at')
        .in('id', userIds)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError
      profileRows = profiles ?? []
    }
  } else {
    let query = supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, status, department, phone, avatar_url, permissions, updated_at, created_at')
      .order('created_at', { ascending: false })

    if (filters.id) query = query.eq('id', filters.id)

    const { data: profiles, error: profilesError } = await query
    if (profilesError) throw profilesError
    profileRows = profiles ?? []
  }

  const profileIds = profileRows.map((profile) => profile.id)
  const permissionsByUserId = new Map<string, string[]>()
  const organizationsByUserId = new Map<string, UserOrganizationSummary[]>()

  if (profileIds.length > 0) {
    const { data: permissions, error: permissionsError } = await supabaseAdmin
      .from('user_permissions')
      .select('user_id, permission')
      .in('user_id', profileIds)
      .eq('is_active', true)

    if (permissionsError) {
      logger.warn('Could not load user permissions for admin users list', {
        error: permissionsError.message,
      })
    } else {
      for (const row of permissions ?? []) {
        const userId = String(row.user_id)
        const current = permissionsByUserId.get(userId) ?? []
        current.push(String(row.permission))
        permissionsByUserId.set(userId, current)
      }
    }

    if (!context.organizationId) {
      const { data: memberships, error: membershipsError } = await supabaseAdmin
        .from('organization_members')
        .select('user_id, organization_id, role, status')
        .in('user_id', profileIds)

      if (membershipsError) {
        logger.warn('Could not load organizations for admin users list', {
          error: membershipsError.message,
        })
      } else {
        const organizationIds = Array.from(
          new Set((memberships ?? [])
            .map((membership: MemberRow) => membership.organization_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0))
        )

        const organizationsById = new Map<string, OrganizationRow>()
        const settingsByOrgId = new Map<string, OrganizationSettingRow>()

        if (organizationIds.length > 0) {
          const [{ data: organizations }, { data: organizationSettings }] = await Promise.all([
            supabaseAdmin
              .from('organizations')
              .select('id, name, slug')
              .in('id', organizationIds),
            supabaseAdmin
              .from('organization_settings')
              .select('organization_id, display_name')
              .in('organization_id', organizationIds),
          ])

          for (const organization of organizations ?? []) {
            organizationsById.set(organization.id, organization)
          }

          for (const setting of organizationSettings ?? []) {
            settingsByOrgId.set(setting.organization_id, setting)
          }
        }

        for (const membership of memberships ?? []) {
          const organizationId = membership.organization_id
          if (!organizationId) continue

          const organization = organizationsById.get(organizationId)
          const setting = settingsByOrgId.get(organizationId)
          const current = organizationsByUserId.get(membership.user_id) ?? []

          current.push({
            id: organizationId,
            name: setting?.display_name || organization?.name || 'Organizacion sin nombre',
            slug: organization?.slug ?? null,
            role: membership.role,
            status: membership.status,
          })

          organizationsByUserId.set(membership.user_id, current)
        }
      }
    }
  }

  const mappedUsers = profileRows
    .map((profile) => mapProfile(
      profile,
      membersByUserId.get(profile.id),
      permissionsByUserId.get(profile.id),
      organizationsByUserId.get(profile.id) ?? []
    ))
    .filter((user) => matchesFilters(user, filters))

  const stats = calculateStats(mappedUsers)
  const from = (page - 1) * pageSize
  const pagedUsers = mappedUsers.slice(from, from + pageSize)

  return NextResponse.json({
    success: true,
    data: pagedUsers,
    count: mappedUsers.length,
    stats,
  })
}

async function updateUser(request: NextRequest, context: AdminAuthContext) {
  const supabaseAdmin = createAdminSupabase()
  const body = await request.json().catch(() => ({}))
  const userId = typeof body?.id === 'string' ? body.id : ''

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Missing user id' }, { status: 400 })
  }

  const canAccessUser = await assertUserInOrganization(supabaseAdmin, userId, context)
  if (!canAccessUser) {
    return NextResponse.json({ success: false, error: 'Usuario no pertenece a tu organizacion' }, { status: 403 })
  }

  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabaseAdmin.from('profiles').select('role,status').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
  ])

  const currentRole = normalizeRole(roleRow?.role ?? profile?.role)
  if (currentRole === 'super_admin' && context.user.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'No puedes modificar un super administrador' }, { status: 403 })
  }

  const nextRole = typeof body?.role === 'string' ? normalizeRole(body.role) : currentRole
  const nextStatus = typeof body?.status === 'string' ? normalizeStatus(body.status) : normalizeStatus(profile?.status)

  if (nextRole === 'super_admin' && context.user.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Solo un super admin puede asignar super_admin' }, { status: 403 })
  }

  if (context.user.id === userId && nextStatus !== 'active') {
    return NextResponse.json({ success: false, error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
  }

  const profilePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.name === 'string') profilePayload.full_name = body.name
  if (typeof body?.department === 'string') profilePayload.department = body.department
  if (typeof body?.phone === 'string') profilePayload.phone = body.phone
  if (typeof body?.avatar_url === 'string') profilePayload.avatar_url = body.avatar_url
  if (typeof body?.role === 'string') profilePayload.role = nextRole
  if (typeof body?.status === 'string') profilePayload.status = nextStatus
  if (Array.isArray(body?.permissions)) profilePayload.permissions = body.permissions

  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(profilePayload)
    .eq('id', userId)
    .select('id, full_name, email, role, status, department, phone, avatar_url, permissions, updated_at, created_at')
    .single()

  if (updateError) throw updateError

  if (typeof body?.role === 'string' || typeof body?.status === 'string') {
    const nowIso = new Date().toISOString()
    const { error: roleError } = await supabaseAdmin.from('user_roles').upsert(
      {
        user_id: userId,
        role: nextRole,
        is_active: nextStatus === 'active',
        updated_at: nowIso,
      },
      { onConflict: 'user_id' }
    )

    if (roleError) throw roleError

    if (context.organizationId && nextRole !== 'super_admin') {
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .update({
          role: mapAppRoleToOrgRole(nextRole),
          status: nextStatus === 'active' ? 'active' : 'inactive',
        })
        .eq('organization_id', context.organizationId)
        .eq('user_id', userId)

      if (memberError) throw memberError
    }
  }

  if (Array.isArray(body?.permissions)) {
    const { data: currentPermissions, error: currentPermissionsError } = await supabaseAdmin
      .from('user_permissions')
      .select('permission')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (currentPermissionsError) throw currentPermissionsError

    const currentSet = new Set<string>((currentPermissions ?? []).map((row) => String(row.permission)))
    const nextSet = new Set<string>(body.permissions.map((permission: unknown) => String(permission)))
    const toInsert = Array.from(nextSet).filter((permission) => !currentSet.has(permission))
    const toDelete = Array.from(currentSet).filter((permission) => !nextSet.has(permission))

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('user_permissions')
        .insert(toInsert.map((permission) => ({ user_id: userId, permission, is_active: true })))
      if (error) throw error
    }

    if (toDelete.length > 0) {
      const { error } = await supabaseAdmin
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .in('permission', toDelete)
      if (error) throw error
    }
  }

  await supabaseAdmin.from('audit_log').insert({
    user_id: context.user.id,
    action: 'update_admin_user',
    resource: 'users',
    resource_id: userId,
    new_values: {
      updated_by: context.user.id,
      organization_id: context.organizationId,
      fields: Object.keys(profilePayload),
    },
  })

  return NextResponse.json({
    success: true,
    data: mapProfile(updatedProfile, undefined, Array.isArray(body?.permissions) ? body.permissions : undefined),
  })
}

async function deactivateUser(request: NextRequest, context: AdminAuthContext) {
  const userId = request.nextUrl.searchParams.get('id')

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Missing user id' }, { status: 400 })
  }

  const nextRequest = new NextRequest(request.url, {
    method: 'PUT',
    headers: request.headers,
    body: JSON.stringify({ id: userId, status: 'inactive' }),
  })

  return updateUser(nextRequest, context)
}

export const GET = withAdminAuth(loadUsers)
export const PUT = withAdminAuth(updateUser)
export const DELETE = withAdminAuth(deactivateUser)
