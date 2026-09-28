'use server'

import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { errorMessage } from '@/lib/health/core'
import { readHistory, type HistoryFilters } from '@/lib/health/history'
import { runSystemHealth } from '@/lib/health/run'
import type { HealthHistoryResult, HealthReport } from '@/lib/health/types'
import { logger } from '@/lib/logger'

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * La autorización se valida en cada acción (no solo en el layout): una server
 * action es un endpoint POST invocable directamente.
 */
export async function runSystemHealthAction(): Promise<ActionResult<HealthReport>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }

  try {
    return { ok: true, data: await runSystemHealth(user.id) }
  } catch (error) {
    logger.error('[system-health] el diagnóstico falló', error instanceof Error ? error.name : 'unknown')
    return { ok: false, error: `El diagnóstico no pudo completarse: ${errorMessage(error)}` }
  }
}

export async function readHealthHistoryAction(filters: HistoryFilters): Promise<ActionResult<HealthHistoryResult>> {
  const user = await getSuperAdminUser()
  if (!user) return { ok: false, error: 'Acceso denegado' }

  try {
    const safeFilters: HistoryFilters = {
      category: typeof filters.category === 'string' ? filters.category.slice(0, 40) : undefined,
      status: typeof filters.status === 'string' ? filters.status.slice(0, 20) : undefined,
      from: typeof filters.from === 'string' ? filters.from.slice(0, 10) : undefined,
      to: typeof filters.to === 'string' ? filters.to.slice(0, 10) : undefined,
      onlyIssues: filters.onlyIssues === true,
      limit: typeof filters.limit === 'number' ? filters.limit : 200,
    }
    return { ok: true, data: await readHistory(createAdminSupabase(), safeFilters) }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}
