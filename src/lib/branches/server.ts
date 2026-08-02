import type { AppRole } from '@/lib/auth/role-utils'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { BranchRecord, BranchScopeResolution } from '@/lib/branches/types'

type AssignmentRow = {
  branch_id: string
  is_primary?: boolean | null
  is_active?: boolean | null
}

type OrganizationMembershipRow = {
  role: string
}

const BRANCH_SELECT = 'id, organization_id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at'

function isUuidLike(value: string | null | undefined) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
}

export function getRequestedBranchId(request: Request, bodyBranchId?: unknown) {
  if (typeof bodyBranchId === 'string' && isUuidLike(bodyBranchId)) {
    return bodyBranchId.trim()
  }

  const headerBranchId = request.headers.get('x-branch-id')
  if (isUuidLike(headerBranchId)) {
    return headerBranchId!.trim()
  }

  try {
    const url = new URL(request.url)
    const queryBranchId = url.searchParams.get('branchId') || url.searchParams.get('branch_id')
    if (isUuidLike(queryBranchId)) {
      return queryBranchId!.trim()
    }
  } catch {
    return null
  }

  return null
}

async function fetchBranchesByIds(branchIds: string[], organizationId?: string | null) {
  if (branchIds.length === 0) return []

  const supabase = createAdminSupabase()
  let query = supabase
    .from('branches')
    .select(BRANCH_SELECT)
    .in('id', branchIds)
    .eq('is_active', true)

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[branches] Error loading branches by ids:', error)
    return []
  }

  return (data ?? []) as BranchRecord[]
}

async function fetchOrganizationBranches(organizationId: string) {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('branches')
    .select(BRANCH_SELECT)
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (error) {
    console.error('[branches] Error loading organization branches:', error)
    return [] as BranchRecord[]
  }

  return (data ?? []) as BranchRecord[]
}

async function fetchActiveOrganizationMembership(userId: string, organizationId: string) {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.error('[branches] Error loading organization membership:', error)
    return null
  }

  return (data as OrganizationMembershipRow | null) ?? null
}

function sortBranches<T extends BranchRecord & { is_primary?: boolean | null }>(branches: T[]) {
  return [...branches].sort((left, right) => {
    if (Boolean(left.is_primary) !== Boolean(right.is_primary)) {
      return Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary))
    }
    if (Boolean(left.is_default) !== Boolean(right.is_default)) {
      return Number(Boolean(right.is_default)) - Number(Boolean(left.is_default))
    }
    return left.name.localeCompare(right.name, 'es')
  })
}

export async function getDefaultBranch(organizationId?: string | null): Promise<BranchRecord | null> {
  try {
    const supabase = createAdminSupabase()
    let query = supabase
      .from('branches')
      .select(BRANCH_SELECT)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)

    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }

    const { data, error } = await query
      .maybeSingle()

    if (error) {
      console.error('[branches] Error loading default branch:', error)
      return null
    }

    return (data as BranchRecord | null) ?? null
  } catch (error) {
    console.error('[branches] Default branch lookup failed:', error)
    return null
  }
}

export async function listUserBranches(userId: string, organizationId?: string | null) {
  try {
    const supabase = createAdminSupabase()
    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_branch_assignments')
      .select('branch_id, is_primary, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (assignmentsError) {
      console.error('[branches] Error loading user branch assignments:', assignmentsError)
      return [] as Array<BranchRecord & { is_primary?: boolean | null }>
    }

    const safeAssignments = (assignments ?? []) as AssignmentRow[]
    const branchIds = safeAssignments
      .map((assignment) => assignment.branch_id)
      .filter((branchId): branchId is string => typeof branchId === 'string' && branchId.length > 0)

    const branches = await fetchBranchesByIds(branchIds, organizationId)
    const assignmentMap = new Map(
      safeAssignments.map((assignment) => [assignment.branch_id, assignment])
    )

    return sortBranches(branches
      .map((branch) => ({
        ...branch,
        is_primary: assignmentMap.get(branch.id)?.is_primary ?? false,
      })))
  } catch (error) {
    console.error('[branches] User branch list failed:', error)
    return [] as Array<BranchRecord & { is_primary?: boolean | null }>
  }
}

export async function listAccessibleBranchesForUser(params: {
  userId: string
  role?: AppRole
  organizationId: string
}) {
  const { userId, role, organizationId } = params
  const assignedBranches = await listUserBranches(userId, organizationId)

  if (role === 'super_admin') {
    const branches = await fetchOrganizationBranches(organizationId)
    const assignmentMap = new Map(assignedBranches.map((branch) => [branch.id, branch.is_primary]))
    return sortBranches(branches.map((branch) => ({
      ...branch,
      is_primary: assignmentMap.get(branch.id) ?? false,
    })))
  }

  const membership = await fetchActiveOrganizationMembership(userId, organizationId)
  if (!membership) return []

  if (membership.role === 'owner' || membership.role === 'admin') {
    const branches = await fetchOrganizationBranches(organizationId)
    const assignmentMap = new Map(assignedBranches.map((branch) => [branch.id, branch.is_primary]))
    return sortBranches(branches.map((branch) => ({
      ...branch,
      is_primary: assignmentMap.get(branch.id) ?? false,
    })))
  }

  return assignedBranches
}

export async function resolveBranchScopeForUser(params: {
  userId: string
  role?: AppRole
  requestedBranchId?: string | null
  organizationId?: string | null
  strict?: boolean
}): Promise<BranchScopeResolution> {
  const { userId, role, requestedBranchId, organizationId, strict = false } = params

  const defaultBranch = await getDefaultBranch(organizationId)

  if (role === 'super_admin') {
    if (requestedBranchId) {
      const branches = await fetchBranchesByIds([requestedBranchId], organizationId)
      const requestedBranch = branches[0] ?? null
      if (requestedBranch) {
        return { branchId: requestedBranch.id, branch: requestedBranch, source: 'requested' }
      }

      if (strict) {
        throw new Error('La sucursal solicitada no existe o está inactiva.')
      }
    }

    if (defaultBranch) {
      return { branchId: defaultBranch.id, branch: defaultBranch, source: 'default' }
    }

    return { branchId: null, branch: null, source: 'unavailable' }
  }

  if (!organizationId) {
    return { branchId: null, branch: null, source: 'unavailable' }
  }

  const availableBranches = await listAccessibleBranchesForUser({ userId, role, organizationId })

  if (requestedBranchId) {
    const requestedBranch = availableBranches.find((branch) => branch.id === requestedBranchId)
    if (requestedBranch) {
      return { branchId: requestedBranch.id, branch: requestedBranch, source: 'requested' }
    }

    if (strict) {
      throw new Error('No autorizado para operar sobre la sucursal seleccionada.')
    }
  }

  const primaryBranch = availableBranches.find((branch) => branch.is_primary)
  if (primaryBranch) {
    return { branchId: primaryBranch.id, branch: primaryBranch, source: 'primary' }
  }

  if (availableBranches[0]) {
    const branch = availableBranches[0]
    return {
      branchId: branch.id,
      branch,
      source: branch.is_default ? 'default' : 'primary',
    }
  }

  return { branchId: null, branch: null, source: 'unavailable' }
}
