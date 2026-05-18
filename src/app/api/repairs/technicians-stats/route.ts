import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'

export const dynamic = 'force-dynamic'

type TechnicianProfile = {
  id: string
  full_name: string
  role?: string | null
  specialty?: string | null
}

type BranchAssignment = {
  user_id: string
}

type RepairStatsRow = {
  technician_id: string
  status?: string | null
  created_at?: string | null
  completed_at?: string | null
}

type TechnicianAggregate = {
  activeJobs: number
  completedThisMonth: number
  totalCompleted: number
  completionDaysTotal: number
  completionDaysCount: number
}

/**
 * GET /api/repairs/technicians-stats
 *
 * Returns pre-calculated technician statistics using server-side aggregation.
 * This avoids loading all repairs on the client just to compute stats.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>

    const isConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!isConfigured) {
      return Response.json({
        technicians: [
          {
            id: 'TECH-001',
            name: 'Tecnico Demo 1',
            specialty: 'Smartphones',
            activeJobs: 3,
            completedThisMonth: 8,
            totalCompleted: 45,
            avgCompletionDays: 2.5,
          },
          {
            id: 'TECH-002',
            name: 'Tecnico Demo 2',
            specialty: 'Laptops',
            activeJobs: 1,
            completedThisMonth: 5,
            totalCompleted: 32,
            avgCompletionDays: 3.1,
          },
        ],
      })
    }

    const supabase = createAdminSupabase()
    const requestedBranchId = getRequestedBranchId(req)
    const branchScope = await resolveBranchScopeForUser({
      userId: staffAuth.user.id,
      role: staffAuth.role,
      requestedBranchId,
      strict: Boolean(requestedBranchId),
    })

    let technicianIdsForBranch: string[] | null = null
    if (branchScope.branchId) {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('user_branch_assignments')
        .select('user_id')
        .eq('branch_id', branchScope.branchId)
        .eq('is_active', true)

      if (assignmentsError) {
        throw assignmentsError
      }

      technicianIdsForBranch = ((assignments ?? []) as BranchAssignment[])
        .map((assignment) => assignment.user_id)
        .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0)

      if (technicianIdsForBranch.length === 0) {
        return Response.json({ technicians: [] })
      }
    }

    let profilesQuery = supabase
      .from('profiles')
      .select('id, full_name, email, role, specialty')
      .order('full_name')

    if (technicianIdsForBranch) {
      profilesQuery = profilesQuery.in('id', technicianIdsForBranch)
    }

    const { data: profiles, error: profilesError } = await profilesQuery

    if (profilesError) {
      const msg = (profilesError.message || '').toLowerCase()
      if (msg.includes('specialty') || msg.includes('column')) {
        let fallbackProfilesQuery = supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .order('full_name')

        if (technicianIdsForBranch) {
          fallbackProfilesQuery = fallbackProfilesQuery.in('id', technicianIdsForBranch)
        }

        const { data: fallbackProfiles, error: fallbackError } = await fallbackProfilesQuery

        if (fallbackError) throw fallbackError

        const techProfiles = filterTechnicians((fallbackProfiles ?? []) as TechnicianProfile[])
        const stats = await calculateStats(supabase, techProfiles, branchScope.branchId)
        return Response.json({ technicians: stats })
      }

      throw profilesError
    }

    const techProfiles = filterTechnicians((profiles ?? []) as TechnicianProfile[])
    const stats = await calculateStats(supabase, techProfiles, branchScope.branchId)

    return Response.json({ technicians: stats })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener estadísticas de técnicos'
    console.error('[technicians-stats] Error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

const TECHNICIAN_ROLES = new Set(['technician', 'tecnico'])

function normalizeRole(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function filterTechnicians(profiles: TechnicianProfile[]): TechnicianProfile[] {
  return profiles.filter(
    (profile) => profile.role && TECHNICIAN_ROLES.has(normalizeRole(String(profile.role)))
  )
}

async function calculateStats(
  supabase: ReturnType<typeof createAdminSupabase>,
  technicians: TechnicianProfile[],
  branchId?: string | null
) {
  if (technicians.length === 0) return []

  const techIds = technicians.map((technician) => technician.id)
  const activeStatuses = ['recibido', 'diagnostico', 'reparacion', 'pausado']
  const completedStatuses = ['listo', 'entregado']

  let repairsQuery = supabase
    .from('repairs')
    .select('technician_id, status, created_at, completed_at')
    .in('technician_id', techIds)

  if (branchId) {
    repairsQuery = repairsQuery.eq('branch_id', branchId)
  }

  const { data: repairs, error: repairsError } = await repairsQuery

  if (repairsError) throw repairsError

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const statsMap = new Map<string, TechnicianAggregate>()

  for (const technician of technicians) {
    statsMap.set(technician.id, {
      activeJobs: 0,
      completedThisMonth: 0,
      totalCompleted: 0,
      completionDaysTotal: 0,
      completionDaysCount: 0,
    })
  }

  for (const repair of ((repairs as RepairStatsRow[] | null) ?? [])) {
    const stats = statsMap.get(repair.technician_id)
    if (!stats) continue

    const status = String(repair.status || '').toLowerCase()

    if (activeStatuses.includes(status)) {
      stats.activeJobs += 1
    }

    if (completedStatuses.includes(status)) {
      stats.totalCompleted += 1

      if (repair.completed_at && repair.completed_at >= startOfMonth) {
        stats.completedThisMonth += 1
      }

      if (repair.created_at && repair.completed_at) {
        const start = new Date(repair.created_at).getTime()
        const end = new Date(repair.completed_at).getTime()
        const days = (end - start) / (1000 * 60 * 60 * 24)
        if (days >= 0) {
          stats.completionDaysTotal += days
          stats.completionDaysCount += 1
        }
      }
    }
  }

  return technicians.map((technician) => {
    const stats = statsMap.get(technician.id)!
    return {
      id: technician.id,
      name: technician.full_name,
      specialty: technician.specialty || null,
      activeJobs: stats.activeJobs,
      completedThisMonth: stats.completedThisMonth,
      totalCompleted: stats.totalCompleted,
      avgCompletionDays:
        stats.completionDaysCount > 0
          ? Math.round((stats.completionDaysTotal / stats.completionDaysCount) * 10) / 10
          : 0,
    }
  })
}
