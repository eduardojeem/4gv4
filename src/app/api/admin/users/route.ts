import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { canCreateResource } from '@/lib/saas/subscription-service'
import { canWriteGlobalUserIdentity } from '@/lib/auth/admin-role-scope'
import { sanitizeSearchTerm } from '@/lib/api/sanitize-search'
import { WHOLESALE_PRICE_PERMISSION } from '@/lib/auth/wholesale-access'

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

// `scope` decide que poblacion se lista: el staff de la organizacion, los
// clientes vinculados a ella, o todo junto.
type UserScope = 'staff' | 'customers' | 'all'

function normalizeScope(value: unknown): UserScope {
  return value === 'customers' || value === 'all' ? value : 'staff'
}

// Roles tal como se guardan en organization_members, agrupados por rol canonico.
const ORG_ROLE_GROUPS: Record<Exclude<CanonicalRole, 'super_admin'>, string[]> = {
  admin: ['owner', 'admin'],
  vendedor: ['seller'],
  tecnico: ['technician'],
  cliente: ['customer'],
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
  organizations: UserOrganizationSummary[] = [],
  branches: Array<{ id: string; name: string; city?: string | null; isPrimary?: boolean }> = [],
  lastSignInAt?: string | null
) {
  const role = normalizeRole(membership?.role ?? profile.role)
  const status = normalizeStatus(membership?.status ?? profile.status)
  const resolvedPermissions = permissions.length > 0 ? permissions : profile.permissions ?? []

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role === 'super_admin' ? 'super_admin' : role,
    status,
    department: profile.department,
    phone: profile.phone,
    avatar_url: profile.avatar_url,
    permissions: resolvedPermissions,
    // Mayorista = permiso explicito de precios mayoristas (ver lib/auth/wholesale-access).
    is_wholesale: resolvedPermissions.includes(WHOLESALE_PRICE_PERMISSION),
    organizations,
    branches,
    last_sign_in_at: lastSignInAt ?? profile.updated_at ?? null,
    updated_at: profile.updated_at,
    created_at: profile.created_at,
  }
}

async function fetchUserBranchAssignments(
  supabaseAdmin: ReturnType<typeof createAdminSupabase>,
  profileIds: string[]
) {
  const map = new Map<string, Array<{ id: string; name: string; city: string | null; isPrimary: boolean }>>()
  if (profileIds.length === 0) return map

  try {
    const { data, error } = await supabaseAdmin
      .from('user_branch_assignments')
      .select('user_id, branch_id, is_primary, branches(id, name, city)')
      .in('user_id', profileIds)
      .eq('is_active', true)

    if (error) {
      logger.warn('Could not load user branch assignments for admin users list', { error: error.message })
      return map
    }

    for (const row of data ?? []) {
      const uid = String(row.user_id)
      const cur = map.get(uid) ?? []
      const branchObj = row.branches as unknown as { id: string; name: string; city: string | null } | null
      if (branchObj) {
        cur.push({
          id: branchObj.id,
          name: branchObj.name,
          city: branchObj.city ?? null,
          isPrimary: Boolean(row.is_primary),
        })
      }
      map.set(uid, cur)
    }
  } catch (err) {
    logger.warn('Error fetching branch assignments', { error: String(err) })
  }

  return map
}

async function fetchUserLastSignIns(
  supabaseAdmin: ReturnType<typeof createAdminSupabase>,
  profileIds: string[]
) {
  const map = new Map<string, string | null>()
  if (profileIds.length === 0) return map

  try {
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data) break
      const authUsers = data.users ?? []
      authUsers.forEach((u) => {
        if (profileIds.includes(u.id)) {
          map.set(u.id, u.last_sign_in_at ?? null)
        }
      })
      if (authUsers.length < 200 || map.size >= profileIds.length) break
    }
  } catch (err) {
    logger.warn('Could not fetch last_sign_in_at from auth.users', { error: String(err) })
  }

  return map
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

/**
 * Conteo de miembros por rol canonico. Usa COUNT en el servidor (head: true) en
 * lugar de contar filas ya traidas, porque PostgREST corta la lectura en 1000
 * registros y eso falsearia los totales en organizaciones grandes.
 */
async function countMembersByRole(
  supabaseAdmin: ReturnType<typeof createAdminSupabase>,
  organizationId: string
) {
  const roles = Object.keys(ORG_ROLE_GROUPS) as Array<keyof typeof ORG_ROLE_GROUPS>

  const results = await Promise.all(
    roles.map((role) =>
      supabaseAdmin
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('role', ORG_ROLE_GROUPS[role])
    )
  )

  const failed = results.find((result) => result.error)
  if (failed?.error) {
    logger.warn('Could not count organization members by role', { error: failed.error.message, organizationId })
  }

  return Object.fromEntries(
    roles.map((role, index) => [role, results[index].count ?? 0])
  ) as Record<keyof typeof ORG_ROLE_GROUPS, number>
}

/**
 * IDs con acceso mayorista activo. `user_permissions` no esta acotada por
 * organizacion, asi que se restringe a los ids ya filtrados por el llamador.
 */
async function fetchWholesaleUserIds(
  supabaseAdmin: ReturnType<typeof createAdminSupabase>,
  userIds?: string[],
  organizationId?: string
) {
  let query = supabaseAdmin
    .from('user_permissions')
    .select('user_id')
    .eq('permission', WHOLESALE_PRICE_PERMISSION)
    .eq('is_active', true)

  if (userIds && userIds.length > 0) {
    query = query.in('user_id', userIds)
  }
  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  const { data, error } = await query

  if (error) {
    logger.warn('Could not resolve wholesale users', { error: error.message })
    return new Set<string>()
  }

  return new Set((data ?? []).map((row) => String(row.user_id)))
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
  // Sanitized: interpolated into a PostgREST `.or(...)` filter string below.
  const search = sanitizeSearchTerm(params.get('search'))
  const roleParam = params.get('role') ?? 'all'
  const statusParam = params.get('status') ?? 'all'
  const idParam = params.get('id')
  const scope = normalizeScope(params.get('scope'))
  const wholesaleOnly = params.get('wholesale') === 'true'

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // ── Organisation-scoped path ──────────────────────────────────────────────
  if (context.organizationId) {
    // 1. Load members for the requested population.
    let membersQuery = supabaseAdmin
      .from('organization_members')
      .select('user_id, role, status, created_at')
      .eq('organization_id', context.organizationId)

    if (scope === 'customers') {
      membersQuery = membersQuery.eq('role', 'customer')
    } else if (scope === 'staff') {
      // `neq` descarta las filas con role NULL (NULL <> 'customer' es NULL), asi
      // que hay que pedirlas explicitamente para no perder miembros sin rol.
      membersQuery = membersQuery.or('role.is.null,role.neq.customer')
    }

    const { data: members, error: membersError } = await membersQuery

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
    let userIds = Array.from(membersByUserId.keys())

    if (wholesaleOnly && userIds.length > 0) {
      const wholesaleIds = await fetchWholesaleUserIds(supabaseAdmin, userIds, context.organizationId)
      userIds = userIds.filter((id) => wholesaleIds.has(id))
    }

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        stats: {
          ...buildOrganizationMemberStats(allMembers),
          byRole: await countMembersByRole(supabaseAdmin, context.organizationId),
        },
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

    // Permissions, Branches & Last Login
    const profileIds = profileRows.map((p) => p.id)
    const permissionsByUserId = new Map<string, string[]>()

    if (profileIds.length > 0) {
      const { data: perms } = await supabaseAdmin
        .from('user_permissions')
        .select('user_id, permission, organization_id')
        .in('user_id', profileIds)
        .eq('is_active', true)

      for (const row of perms ?? []) {
        if (
          row.permission === WHOLESALE_PRICE_PERMISSION &&
          row.organization_id !== context.organizationId
        ) {
          continue
        }
        const uid = String(row.user_id)
        const cur = permissionsByUserId.get(uid) ?? []
        cur.push(String(row.permission))
        permissionsByUserId.set(uid, cur)
      }
    }

    const [branchesByUserId, lastSignInsByUserId] = await Promise.all([
      fetchUserBranchAssignments(supabaseAdmin, profileIds),
      fetchUserLastSignIns(supabaseAdmin, profileIds),
    ])

    const mappedUsers = profileRows.map((p) =>
      mapProfile(
        p,
        membersByUserId.get(p.id),
        permissionsByUserId.get(p.id),
        [],
        branchesByUserId.get(p.id) ?? [],
        lastSignInsByUserId.get(p.id)
      )
    )

    const stats = {
      ...buildOrganizationMemberStats(allMembers),
      byRole: await countMembersByRole(supabaseAdmin, context.organizationId),
    }

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
  if (scope === 'customers') {
    dataQuery = dataQuery.eq('role', 'cliente')
  } else if (scope === 'staff') {
    dataQuery = dataQuery.or('role.is.null,role.neq.cliente')
  }
  if (wholesaleOnly) {
    const wholesaleIds = await fetchWholesaleUserIds(supabaseAdmin)
    // Sin coincidencias hay que forzar un conjunto vacio: un `.in()` con lista
    // vacia no filtra nada en PostgREST y devolveria todos los perfiles.
    dataQuery = dataQuery.in('id', wholesaleIds.size > 0 ? Array.from(wholesaleIds) : ['__none__'])
  }

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

  const [branchesByUserId, lastSignInsByUserId] = await Promise.all([
    fetchUserBranchAssignments(supabaseAdmin, profileIds),
    fetchUserLastSignIns(supabaseAdmin, profileIds),
  ])

  const mappedUsers = profileRows.map((p) =>
    mapProfile(
      p,
      undefined,
      permissionsByUserId.get(p.id),
      organizationsByUserId.get(p.id) ?? [],
      branchesByUserId.get(p.id) ?? [],
      lastSignInsByUserId.get(p.id)
    )
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
    byRole: {
      admin: allProfiles.filter((p) => normalizeRole(p.role) === 'admin').length,
      vendedor: allProfiles.filter((p) => normalizeRole(p.role) === 'vendedor').length,
      tecnico: allProfiles.filter((p) => normalizeRole(p.role) === 'tecnico').length,
      cliente: allProfiles.filter((p) => normalizeRole(p.role) === 'cliente').length,
    },
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

  const isAdminRole = currentRole === 'admin' || currentRole === 'super_admin'
  const nextIsAdminRole = nextRole === 'admin' || nextRole === 'super_admin'
  const isBeingDeactivated = typeof body?.status === 'string' && nextStatus !== 'active'
  // A role change away from admin removes administrative access just as much as
  // a deactivation does, so both paths must go through the same guards.
  const isBeingDemoted = typeof body?.role === 'string' && isAdminRole && !nextIsAdminRole

  if (context.user.id === userId && nextStatus !== 'active') {
    return NextResponse.json({ success: false, error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
  }

  if (context.user.id === userId && isBeingDemoted) {
    return NextResponse.json(
      { success: false, error: 'No puedes quitarte a vos mismo el rol de administrador. Pedile a otro administrador que lo haga.' },
      { status: 400 }
    )
  }

  // Guard: prevent leaving an organisation without any active admin
  if ((isBeingDeactivated || isBeingDemoted) && isAdminRole && context.organizationId) {
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
          error: isBeingDemoted
            ? 'No podés quitarle el rol de administrador al único administrador activo de la organización. Asigná otro admin primero.'
            : 'No podés desactivar al único administrador activo de la organización. Asigná otro admin primero.',
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
      .select('permission, organization_id')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (currentPermissionsError) throw currentPermissionsError

    const currentSet = new Set<string>(
      (currentPermissions ?? [])
        .filter((row) =>
          row.permission !== WHOLESALE_PRICE_PERMISSION ||
          row.organization_id === context.organizationId
        )
        .map((row) => String(row.permission))
    )
    const nextSet = new Set<string>(body.permissions.map((p: unknown) => String(p)))
    const toInsert = Array.from(nextSet).filter((p) => !currentSet.has(p))
    const toRevoke = Array.from(currentSet).filter((p) => !nextSet.has(p))

    if (toInsert.includes(WHOLESALE_PRICE_PERMISSION) && !context.organizationId) {
      return NextResponse.json(
        { error: 'Selecciona una organizacion antes de asignar acceso mayorista.' },
        { status: 400 }
      )
    }

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('user_permissions')
        .insert(toInsert.map((p) => ({
          user_id: userId,
          organization_id: p === WHOLESALE_PRICE_PERMISSION ? context.organizationId : null,
          permission: p,
          is_active: true,
        })))
      if (error) throw error
    }

    // Soft-delete: mark as inactive instead of hard delete for auditability
    const revokeWholesale = toRevoke.includes(WHOLESALE_PRICE_PERMISSION)
    const revokeGlobal = toRevoke.filter((permission) => permission !== WHOLESALE_PRICE_PERMISSION)

    if (revokeGlobal.length > 0) {
      const { error } = await supabaseAdmin
        .from('user_permissions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .in('permission', revokeGlobal)
      if (error) throw error
    }

    if (revokeWholesale && context.organizationId) {
      const { error } = await supabaseAdmin
        .from('user_permissions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('organization_id', context.organizationId)
        .eq('permission', WHOLESALE_PRICE_PERMISSION)
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
