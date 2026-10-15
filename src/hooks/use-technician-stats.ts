import { useCallback, useEffect, useRef, useState } from 'react'
import { useBranch } from '@/contexts/branch-context'
import { useAuth } from '@/contexts/auth-context'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
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
  const { user } = useAuth()
  const organizationContext = useOptionalActiveOrganization()
  const organizationId = organizationContext?.organization?.id ?? ''
  // La caché es a nivel de módulo (compartida en el navegador): la clavamos por
  // usuario + sucursal para no filtrar datos entre cuentas u organizaciones.
  const cacheKey = `${organizationId}:${user?.id || 'anon'}:${selectedBranchId || 'all'}`
  const initialCache = cachedDataByBranch.get(cacheKey) || []
  const [technicians, setTechnicians] = useState<TechnicianWithStats[]>(initialCache)
  const [isLoading, setIsLoading] = useState(!cachedDataByBranch.has(cacheKey))
  const [error, setError] = useState<string | null>(null)
  const [loadedCacheKey, setLoadedCacheKey] = useState(cacheKey)
  const abortRef = useRef<AbortController | null>(null)

  const fetchStats = useCallback(async (forceRefresh = false) => {
    if (organizationContext?.isLoading) return
    // Use cache if fresh
    const now = Date.now()
    const cachedData = cachedDataByBranch.get(cacheKey)
    const cacheTimestamp = cacheTimestampByBranch.get(cacheKey) || 0
    if (!forceRefresh && cachedData && now - cacheTimestamp < CACHE_TTL) {
      setTechnicians(cachedData)
      setLoadedCacheKey(cacheKey)
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
        headers: { ...branchHeaders(selectedBranchId), ...(organizationId ? { 'x-organization-id': organizationId } : {}) },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }

      const data: TechnicianStatsResponse = await res.json()
      if (controller.signal.aborted || abortRef.current !== controller) return
      const mapped = data.technicians.map(mapToTechnicianWithStats)

      cachedDataByBranch.set(cacheKey, mapped)
      cacheTimestampByBranch.set(cacheKey, Date.now())
      setTechnicians(mapped)
      setLoadedCacheKey(cacheKey)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (controller.signal.aborted || abortRef.current !== controller) return
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setTechnicians([])
      setLoadedCacheKey(cacheKey)
      console.error('[useTechnicianStats] Error:', message)
    } finally {
      if (!controller.signal.aborted && abortRef.current === controller) setIsLoading(false)
    }
  }, [cacheKey, selectedBranchId, organizationId, organizationContext?.isLoading])

  useEffect(() => {
    setTechnicians(cachedDataByBranch.get(cacheKey) || [])
    setIsLoading(!cachedDataByBranch.has(cacheKey))
    fetchStats()
    return () => {
      abortRef.current?.abort()
    }
  }, [cacheKey, fetchStats])

  // Al cambiar de organización (cookie en servidor), los datos cacheados quedan
  // obsoletos: limpiamos la caché y forzamos una recarga.
  useEffect(() => {
    const handleOrgChange = () => {
      cachedDataByBranch.clear()
      cacheTimestampByBranch.clear()
      abortRef.current?.abort()
      setLoadedCacheKey('')
      setTechnicians([])
      if (!organizationId) void fetchStats(true)
    }
    window.addEventListener('organization:changed', handleOrgChange)
    return () => window.removeEventListener('organization:changed', handleOrgChange)
  }, [fetchStats, organizationId])

  const refresh = useCallback(async () => {
    await fetchStats(true)
  }, [fetchStats])

  const visible = loadedCacheKey === cacheKey && !organizationContext?.isLoading
  return { technicians: visible ? technicians : [], isLoading: isLoading || !visible, error: visible ? error : null, refresh }
}
