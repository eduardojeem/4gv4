import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/repairs/technicians-stats
 * 
 * Returns pre-calculated technician statistics using server-side aggregation.
 * This avoids loading all repairs on the client just to compute stats.
 */
export async function GET(_req: NextRequest) {
  try {
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

    // 1. Get technicians (profiles with technician role)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, specialty')
      .order('full_name')

    if (profilesError) {
      // Fallback without specialty column
      const msg = (profilesError.message || '').toLowerCase()
      if (msg.includes('specialty') || msg.includes('column')) {
        const { data: fallbackProfiles, error: fallbackError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .order('full_name')

        if (fallbackError) throw fallbackError

        const techProfiles = filterTechnicians(fallbackProfiles || [])
        const stats = await calculateStats(supabase, techProfiles)
        return Response.json({ technicians: stats })
      }
      throw profilesError
    }

    const techProfiles = filterTechnicians(profiles || [])
    const stats = await calculateStats(supabase, techProfiles)

    return Response.json({ technicians: stats })
  } catch (e: any) {
    console.error('[technicians-stats] Error:', e?.message)
    return Response.json(
      { error: e?.message || 'Error al obtener estadísticas de técnicos' },
      { status: 500 }
    )
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

function filterTechnicians(profiles: any[]): any[] {
  return profiles.filter(
    (p) => p.role && TECHNICIAN_ROLES.has(normalizeRole(String(p.role)))
  )
}

async function calculateStats(supabase: any, technicians: any[]) {
  if (technicians.length === 0) return []

  const techIds = technicians.map((t) => t.id)

  // Active statuses: recibido, diagnostico, reparacion, pausado
  const activeStatuses = ['recibido', 'diagnostico', 'reparacion', 'pausado']
  // Completed statuses: listo, entregado
  const completedStatuses = ['listo', 'entregado']

  // Fetch only repairs assigned to these technicians with minimal columns
  const { data: repairs, error: repairsError } = await supabase
    .from('repairs')
    .select('technician_id, status, created_at, completed_at')
    .in('technician_id', techIds)

  if (repairsError) throw repairsError

  // Calculate stats per technician
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const statsMap = new Map<string, {
    activeJobs: number
    completedThisMonth: number
    totalCompleted: number
    completionDaysTotal: number
    completionDaysCount: number
  }>()

  // Initialize all technicians
  for (const tech of technicians) {
    statsMap.set(tech.id, {
      activeJobs: 0,
      completedThisMonth: 0,
      totalCompleted: 0,
      completionDaysTotal: 0,
      completionDaysCount: 0,
    })
  }

  // Process repairs
  for (const repair of repairs || []) {
    const stats = statsMap.get(repair.technician_id)
    if (!stats) continue

    const status = (repair.status || '').toLowerCase()

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

  // Build response
  return technicians.map((tech) => {
    const s = statsMap.get(tech.id)!
    return {
      id: tech.id,
      name: tech.full_name,
      specialty: tech.specialty || null,
      activeJobs: s.activeJobs,
      completedThisMonth: s.completedThisMonth,
      totalCompleted: s.totalCompleted,
      avgCompletionDays:
        s.completionDaysCount > 0
          ? Math.round((s.completionDaysTotal / s.completionDaysCount) * 10) / 10
          : 0,
    }
  })
}
