import type { AppRole } from '@/lib/auth/role-utils'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { BranchRecord, BranchScopeResolution } from '@/lib/branches/types'

type AssignmentRow = {
  branch_id: string
  is_primary?: boolean | null
  is_active?: boolean | null
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

    return branches
      .map((branch) => ({
        ...branch,
        is_primary: assignmentMap.get(branch.id)?.is_primary ?? false,
      }))
      .sort((left, right) => {
        const leftPrimary = left.is_primary ? 1 : 0
        const rightPrimary = right.is_primary ? 1 : 0
        if (leftPrimary !== rightPrimary) return rightPrimary - leftPrimary
        if ((left.is_default ? 1 : 0) !== (right.is_default ? 1 : 0)) {
          return (right.is_default ? 1 : 0) - (left.is_default ? 1 : 0)
        }
        return left.name.localeCompare(right.name, 'es')
      })
  } catch (error) {
    console.error('[branches] User branch list failed:', error)
    return [] as Array<BranchRecord & { is_primary?: boolean | null }>
  }
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

  const availableBranches = await listUserBranches(userId, organizationId)

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
    return { branchId: availableBranches[0].id, branch: availableBranches[0], source: 'primary' }
  }

  if (defaultBranch) {
    return { branchId: defaultBranch.id, branch: defaultBranch, source: 'default' }
  }

  return { branchId: null, branch: null, source: 'unavailable' }
}
