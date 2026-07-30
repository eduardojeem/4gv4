import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { canCreateResource } from '@/lib/saas/subscription-service'
import { canWriteGlobalUserIdentity } from '@/lib/auth/admin-role-scope'

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
  created_at?: string | null
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
  if (status === 'invited') return 'inactive'
  return DEFAULT_STATUS
}

function memberStatusMatchesFilter(memberStatus: unknown, statusParam: string) {
  if (statusParam === 'all') return true
  const normalizedMemberStatus = normalizeStatus(memberStatus)
  const normalizedFilterStatus = normalizeStatus(statusParam)

  if (normalizedFilterStatus === 'inactive') {
    return normalizedMemberStatus !== 'active'
  }

  return normalizedMemberStatus === normalizedFilterStatus
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

function buildOrganizationMemberStats(members: MemberRow[]) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()

  return {
    total: members.length,
    active: members.filter((m) => normalizeStatus(m.status) === 'active').length,
    inactive: members.filter((m) => normalizeStatus(m.status) !== 'active').length,
    admins: members.filter((m) => normalizeRole(m.role) === 'admin').length,
    newThisMonth: members.filter((m) => {
      const t = m.created_at ? new Date(m.created_at).getTime() : 0
      return Number.isFinite(t) && t >= startOfMonth
    }).length,
  }
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
  const search = params.get('search')?.trim() ?? ''
  const roleParam = params.get('role') ?? 'all'
  const statusParam = params.get('status') ?? 'all'
  const idParam = params.get('id')

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // ── Organisation-scoped path ──────────────────────────────────────────────
  if (context.organizationId) {
    // 1. Load members (exclude plain customers from staff management view)
    const { data: members, error: membersError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role, status, created_at')
      .eq('organization_id', context.organizationId)
      .neq('role', 'customer')

    if (membersError) throw membersError

    const allMembers = members ?? []
    const filteredMembers = allMembers.filter((member: MemberRow) => {
      if (roleParam !== 'all' && normalizeRole(member.role) !== normalizeRole(roleParam)) {
        return false
      }

      if (!memberStatusMatchesFilter(member.status, statusParam)) {
        return false
      }

      return true
    })

    const membersByUserId = new Map(
      filteredMembers.map((m: MemberRow) => [m.user_id, m])
    )
    const userIds = Array.from(membersByUserId.keys())

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        stats: buildOrganizationMemberStats(allMembers),
      })
    }

    // 2. Build profile query with DB-level filters
    let profileQuery = supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, status, department, phone, avatar_url, permissions, updated_at, created_at', { count: 'exact' })
      .in('id', userIds)
      .order('created_at', { ascending: false })

    if (idParam) profileQuery = profileQuery.eq('id', idParam)
    if (search) profileQuery = profileQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)

    const filteredResult = await profileQuery.range(from, to)

    if (filteredResult.error) throw filteredResult.error

    const profileRows: ProfileRow[] = filteredResult.data ?? []
    const totalCount = filteredResult.count ?? 0

    // Permissions
    const profileIds = profileRows.map((p) => p.id)
    const permissionsByUserId = new Map<string, string[]>()

    if (profileIds.length > 0) {
      const { data: perms } = await supabaseAdmin
        .from('user_permissions')
        .select('user_id, permission')
        .in('user_id', profileIds)
        .eq('is_active', true)

      for (const row of perms ?? []) {
        const uid = String(row.user_id)
        const cur = permissionsByUserId.get(uid) ?? []
        cur.push(String(row.permission))
        permissionsByUserId.set(uid, cur)
      }
    }

    const mappedUsers = profileRows.map((p) =>
      mapProfile(p, membersByUserId.get(p.id), permissionsByUserId.get(p.id))
    )

    const stats = buildOrganizationMemberStats(allMembers)

    return NextResponse.json({ success: true, data: mappedUsers, count: totalCount, stats })
  }

  // ── Super-admin / global path ─────────────────────────────────────────────

  // Stats query (no filters at all)
  const statsQueryGlobal = supabaseAdmin
    .from('profiles')
    .select('status, role, created_at')

  // Data query with DB-level filters + real pagination
  let dataQuery = supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, status, department, phone, avatar_url, permissions, updated_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (idParam) dataQuery = dataQuery.eq('id', idParam)
  if (search) dataQuery = dataQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
  if (roleParam !== 'all') dataQuery = dataQuery.eq('role', normalizeRole(roleParam))
  if (statusParam !== 'all') dataQuery = dataQuery.eq('status', normalizeStatus(statusParam))

  const [dataResult, statsResult] = await Promise.all([
    dataQuery.range(from, to),
    statsQueryGlobal,
  ])

  if (dataResult.error) throw dataResult.error

  const profileRows: ProfileRow[] = dataResult.data ?? []
  const totalCount = dataResult.count ?? 0

  // Permissions
  const profileIds = profileRows.map((p) => p.id)
  const permissionsByUserId = new Map<string, string[]>()
  const organizationsByUserId = new Map<string, UserOrganizationSummary[]>()

  if (profileIds.length > 0) {
    const { data: perms, error: permsError } = await supabaseAdmin
      .from('user_permissions')
      .select('user_id, permission')
      .in('user_id', profileIds)
      .eq('is_active', true)

    if (permsError) {
      logger.warn('Could not load user permissions for admin users list', { error: permsError.message })
    } else {
      for (const row of perms ?? []) {
        const uid = String(row.user_id)
        const cur = permissionsByUserId.get(uid) ?? []
        cur.push(String(row.permission))
        permissionsByUserId.set(uid, cur)
      }
    }

    // Organizations
    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, organization_id, role, status')
      .in('user_id', profileIds)

    if (membershipsError) {
      logger.warn('Could not load organizations for admin users list', { error: membershipsError.message })
    } else {
      const orgIds = Array.from(
        new Set((memberships ?? [])
          .map((m: MemberRow) => m.organization_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0))
      )

      const orgsById = new Map<string, OrganizationRow>()
      const settingsByOrgId = new Map<string, OrganizationSettingRow>()

      if (orgIds.length > 0) {
        const [{ data: orgs }, { data: orgSettings }] = await Promise.all([
          supabaseAdmin.from('organizations').select('id, name, slug').in('id', orgIds),
          supabaseAdmin.from('organization_settings').select('organization_id, display_name').in('organization_id', orgIds),
        ])

        for (const org of orgs ?? []) orgsById.set(org.id, org)
        for (const s of orgSettings ?? []) settingsByOrgId.set(s.organization_id, s)
      }

      for (const m of memberships ?? []) {
        const orgId = m.organization_id
        if (!orgId) continue
        const org = orgsById.get(orgId)
        const setting = settingsByOrgId.get(orgId)
        const cur = organizationsByUserId.get(m.user_id) ?? []
        cur.push({
          id: orgId,
          name: setting?.display_name || org?.name || 'Organizacion sin nombre',
          slug: org?.slug ?? null,
          role: m.role,
          status: m.status,
        })
        organizationsByUserId.set(m.user_id, cur)
      }
    }
  }

  const mappedUsers = profileRows.map((p) =>
    mapProfile(p, undefined, permissionsByUserId.get(p.id), organizationsByUserId.get(p.id) ?? [])
  )

  // Stats over full unfiltered universe
  const allProfiles = statsResult.data ?? []
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const stats = {
    total: allProfiles.length,
    active: allProfiles.filter((p) => p.status === 'active').length,
    inactive: allProfiles.filter((p) => p.status === 'inactive').length,
    admins: allProfiles.filter((p) => p.role === 'admin' || p.role === 'super_admin').length,
    newThisMonth: allProfiles.filter((p) => {
      const t = p.created_at ? new Date(p.created_at).getTime() : 0
      return Number.isFinite(t) && t >= startOfMonth
    }).length,
  }

  return NextResponse.json({ success: true, data: mappedUsers, count: totalCount, stats })
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

  const [{ data: profile }, { data: roleRow }, { data: membershipRow }] = await Promise.all([
    supabaseAdmin.from('profiles').select('role,status').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    context.organizationId
      ? supabaseAdmin
          .from('organization_members')
          .select('role,status')
          .eq('organization_id', context.organizationId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const currentRole = normalizeRole(membershipRow?.role ?? roleRow?.role ?? profile?.role)
  if (currentRole === 'super_admin' && context.user.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'No puedes modificar un super administrador' }, { status: 403 })
  }

  const nextRole = typeof body?.role === 'string' ? normalizeRole(body.role) : currentRole
  const nextStatus =
    typeof body?.status === 'string'
      ? normalizeStatus(body.status)
      : normalizeStatus(membershipRow?.status ?? profile?.status)

  if (nextRole === 'super_admin' && context.user.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Solo un super admin puede asignar super_admin' }, { status: 403 })
  }

  if (context.user.id === userId && nextStatus !== 'active') {
    return NextResponse.json({ success: false, error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
  }

  // Guard: prevent leaving an organisation without any active admin
  const isBeingDeactivated = typeof body?.status === 'string' && nextStatus !== 'active'
  const isAdminRole = currentRole === 'admin' || currentRole === 'super_admin'
  if (isBeingDeactivated && isAdminRole && context.organizationId) {
    const { count: remainingAdmins } = await supabaseAdmin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', context.organizationId)
      .in('role', ['owner', 'admin'])
      .eq('status', 'active')
      .neq('user_id', userId)

    if ((remainingAdmins ?? 0) === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No podés desactivar al único administrador activo de la organización. Asigná otro admin primero.',
        },
        { status: 400 }
      )
    }
  }

  const isBeingReactivated = typeof body?.status === 'string' && nextStatus === 'active' && normalizeStatus(membershipRow?.status) !== 'active'
  const consumesUserSeat = nextRole !== 'cliente' && nextRole !== 'super_admin'
  if (isBeingReactivated && consumesUserSeat && context.organizationId) {
    const quota = await canCreateResource(context.organizationId, 'users')

    if (!quota.allowed) {
      const planName = quota.plan?.name || quota.plan?.code || 'actual'
      const limitText = quota.limit === null ? 'ilimitado' : String(quota.limit)

      return NextResponse.json(
        {
          success: false,
          error: quota.blocked
            ? 'No se puede reactivar este usuario porque la suscripcion de la organizacion esta suspendida o cancelada. Reactiva la suscripcion para habilitar mas accesos.'
            : quota.expired
              ? `No hay cupo para reactivar este usuario. Como el plan vencio, la organizacion quedo con el limite Free de ${limitText} usuarios activos. Suspende otro usuario activo o actualiza el plan para habilitar este acceso.`
            : `No hay cupo para reactivar este usuario. El plan ${planName} permite ${limitText} usuarios activos. Suspende otro usuario activo o actualiza el plan para habilitar este acceso.`,
          plan: {
            code: quota.plan?.code,
            name: quota.plan?.name,
            limit: quota.limit,
            current: quota.current,
          },
        },
        { status: quota.blocked ? 402 : 409 }
      )
    }
  }

  const profilePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body?.name === 'string') profilePayload.full_name = body.name
  if (typeof body?.department === 'string') profilePayload.department = body.department
  if (typeof body?.phone === 'string') profilePayload.phone = body.phone
  if (typeof body?.avatar_url === 'string') profilePayload.avatar_url = body.avatar_url
  const canWriteGlobalIdentity = canWriteGlobalUserIdentity(context.user.role)
  if (canWriteGlobalIdentity && typeof body?.role === 'string') profilePayload.role = nextRole
  if (canWriteGlobalIdentity && typeof body?.status === 'string') profilePayload.status = nextStatus
  // NOTA: los permisos específicos ahora se persisten SOLO en la tabla
  // user_permissions (fuente de verdad única, ver bloque más abajo). Ya no se
  // escribe la columna profiles.permissions; queda vestigial hasta dropearla en
  // una migración futura. La lectura (GET) aún la usa como fallback.

  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(profilePayload)
    .eq('id', userId)
    .select('id, full_name, email, role, status, department, phone, avatar_url, permissions, updated_at, created_at')
    .single()

  if (updateError) throw updateError

  if (
    canWriteGlobalIdentity &&
    (typeof body?.role === 'string' || typeof body?.status === 'string')
  ) {
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
  }

  if (
    context.organizationId &&
    nextRole !== 'super_admin' &&
    (typeof body?.role === 'string' || typeof body?.status === 'string')
  ) {
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .upsert(
        {
          organization_id: context.organizationId,
          user_id: userId,
          role: mapAppRoleToOrgRole(nextRole),
          status: nextStatus === 'active' ? 'active' : 'suspended',
        },
        { onConflict: 'organization_id,user_id' }
      )

    if (memberError) throw memberError
  }

  if (Array.isArray(body?.permissions)) {
    const { data: currentPermissions, error: currentPermissionsError } = await supabaseAdmin
      .from('user_permissions')
      .select('permission')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (currentPermissionsError) throw currentPermissionsError

    const currentSet = new Set<string>((currentPermissions ?? []).map((row) => String(row.permission)))
    const nextSet = new Set<string>(body.permissions.map((p: unknown) => String(p)))
    const toInsert = Array.from(nextSet).filter((p) => !currentSet.has(p))
    const toRevoke = Array.from(currentSet).filter((p) => !nextSet.has(p))

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('user_permissions')
        .insert(toInsert.map((p) => ({ user_id: userId, permission: p, is_active: true })))
      if (error) throw error
    }

    // Soft-delete: mark as inactive instead of hard delete for auditability
    if (toRevoke.length > 0) {
      const { error } = await supabaseAdmin
        .from('user_permissions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .in('permission', toRevoke)
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
    data: mapProfile(
      updatedProfile,
      context.organizationId && nextRole !== 'super_admin'
        ? {
            user_id: userId,
            organization_id: context.organizationId,
            role: mapAppRoleToOrgRole(nextRole),
            status: nextStatus,
          }
        : undefined,
      Array.isArray(body?.permissions) ? body.permissions : undefined
    ),
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
