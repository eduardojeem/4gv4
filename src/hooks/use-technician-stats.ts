import { useCallback, useEffect, useRef, useState } from 'react'

export interface TechnicianWithStats {
  id: string
  name: string
  specialty: string | null
  activeJobs: number
  completedThisMonth: number
  totalCompleted: number
  avgCompletionDays: number
  status: 'available' | 'busy' | 'offline' | 'unavailable'
  workloadPercentage: number
}

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

// Simple stale-while-revalidate cache
let cachedData: TechnicianWithStats[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60_000 // 1 minute

function deriveStatus(activeJobs: number): 'available' | 'busy' | 'unavailable' {
  if (activeJobs === 0) return 'available'
  if (activeJobs <= 3) return 'busy'
  return 'unavailable'
}

function deriveWorkload(activeJobs: number): number {
  return Math.min((activeJobs / 10) * 100, 100)
}

function mapToTechnicianWithStats(
  raw: TechnicianStatsResponse['technicians'][number]
): TechnicianWithStats {
  return {
    ...raw,
    status: deriveStatus(raw.activeJobs),
    workloadPercentage: deriveWorkload(raw.activeJobs),
  }
}

export function useTechnicianStats() {
  const [technicians, setTechnicians] = useState<TechnicianWithStats[]>(cachedData || [])
  const [isLoading, setIsLoading] = useState(cachedData === null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchStats = useCallback(async (forceRefresh = false) => {
    // Use cache if fresh
    const now = Date.now()
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
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }

      const data: TechnicianStatsResponse = await res.json()
      const mapped = data.technicians.map(mapToTechnicianWithStats)

      cachedData = mapped
      cacheTimestamp = Date.now()
      setTechnicians(mapped)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      console.error('[useTechnicianStats] Error:', message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchStats])

  const refresh = useCallback(async () => {
    await fetchStats(true)
  }, [fetchStats])

  return { technicians, isLoading, error, refresh }
}
