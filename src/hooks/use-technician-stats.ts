import { useCallback, useEffect, useRef, useState } from 'react'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders } from '@/lib/branches/client'

export interface TechnicianWithStats {
  id: string
  name: string
  specialty: string | null
  activeJobs: number
  completedThisMonth: number
  totalCompleted: number
  avgCompletionDays: number
  loadState: TechnicianLoadState
  workloadPercentage: number
}

export type TechnicianLoadState = 'no_load' | 'light_load' | 'medium_load' | 'high_load'

interface TechnicianStatsResponse {
  technicians: Array<{
    id: string
    name: string
    specialty: string | null
    activeJobs: number
    completedThisMonth: number
    totalCompleted: number
    avgCompletionDays: number
  }>
}

// Simple stale-while-revalidate cache, keyed by branch scope
const cachedDataByBranch = new Map<string, TechnicianWithStats[]>()
const cacheTimestampByBranch = new Map<string, number>()
const CACHE_TTL = 60_000 // 1 minute

function deriveLoadState(activeJobs: number): TechnicianLoadState {
  if (activeJobs === 0) return 'no_load'
  if (activeJobs <= 2) return 'light_load'
  if (activeJobs <= 4) return 'medium_load'
  return 'high_load'
}

function deriveWorkload(activeJobs: number): number {
  if (activeJobs === 0) return 0
  return Math.min(Math.round((activeJobs / 6) * 100), 100)
}

function mapToTechnicianWithStats(
  raw: TechnicianStatsResponse['technicians'][number]
): TechnicianWithStats {
  return {
    ...raw,
    loadState: deriveLoadState(raw.activeJobs),
    workloadPercentage: deriveWorkload(raw.activeJobs),
  }
}

export function useTechnicianStats() {
  const { selectedBranchId } = useBranch()
  const cacheKey = selectedBranchId || 'all'
  const initialCache = cachedDataByBranch.get(cacheKey) || []
  const [technicians, setTechnicians] = useState<TechnicianWithStats[]>(initialCache)
  const [isLoading, setIsLoading] = useState(!cachedDataByBranch.has(cacheKey))
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchStats = useCallback(async (forceRefresh = false) => {
    // Use cache if fresh
    const now = Date.now()
    const cachedData = cachedDataByBranch.get(cacheKey)
    const cacheTimestamp = cacheTimestampByBranch.get(cacheKey) || 0
    if (!forceRefresh && cachedData && now - cacheTimestamp < CACHE_TTL) {
      setTechnicians(cachedData)
      setIsLoading(false)
      return
    }

    // Cancel previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/repairs/technicians-stats', {
        signal: controller.signal,
        headers: branchHeaders(selectedBranchId),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }

      const data: TechnicianStatsResponse = await res.json()
      const mapped = data.technicians.map(mapToTechnicianWithStats)

      cachedDataByBranch.set(cacheKey, mapped)
      cacheTimestampByBranch.set(cacheKey, Date.now())
      setTechnicians(mapped)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      console.error('[useTechnicianStats] Error:', message)
    } finally {
      setIsLoading(false)
    }
  }, [cacheKey, selectedBranchId])

  useEffect(() => {
    setTechnicians(cachedDataByBranch.get(cacheKey) || [])
    setIsLoading(!cachedDataByBranch.has(cacheKey))
    fetchStats()
    return () => {
      abortRef.current?.abort()
    }
  }, [cacheKey, fetchStats])

  const refresh = useCallback(async () => {
    await fetchStats(true)
  }, [fetchStats])

  return { technicians, isLoading, error, refresh }
}
