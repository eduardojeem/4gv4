'use client'

import { useCallback, useState } from 'react'

export interface SecurityLog {
  id: string
  event: string
  user: string
  timestamp: string
  ip: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  details?: string
  user_id?: string
  action?: string
  resource?: string
  resource_id?: string
  user_agent?: string
}

export interface SecurityStats {
  totalEvents: number
  criticalEvents: number
  highRiskEvents: number
  failedAttempts: number
  uniqueUsers: number
  uniqueIPs: number
}

export type SecurityLogFilters = {
  limit?: number
  page?: number
  pageSize?: number
  severity?: string
  timeRange?: string
  search?: string
  userId?: string
}

export type SecurityLogUserOption = {
  id: string
  name: string
}

type SecurityLogsResponse = {
  logs: SecurityLog[]
  stats: SecurityStats
  totalCount?: number
  page?: number
  pageSize?: number
  users?: SecurityLogUserOption[]
  error?: string
}

const EMPTY_STATS: SecurityStats = {
  totalEvents: 0,
  criticalEvents: 0,
  highRiskEvents: 0,
  failedAttempts: 0,
  uniqueUsers: 0,
  uniqueIPs: 0,
}

interface SecurityLogsCache {
  data: SecurityLogsResponse
  timestamp: number
  filterKey: string
}

let logsCache: SecurityLogsCache | null = null
const CACHE_TTL = 2 * 60 * 1000

function buildFilterKey(filters?: SecurityLogFilters) {
  return [
    filters?.timeRange || '24h',
    filters?.severity || 'all',
    filters?.search || '',
    filters?.userId || 'all',
    filters?.page || 1,
    filters?.pageSize || filters?.limit || 20,
  ].join('|')
}

function buildUrl(filters?: SecurityLogFilters) {
  const params = new URLSearchParams()

  if (filters?.timeRange) params.set('timeRange', filters.timeRange)
  if (filters?.severity && filters.severity !== 'all') params.set('severity', filters.severity)
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize))
  if (filters?.search) params.set('search', filters.search)
  if (filters?.userId && filters.userId !== 'all') params.set('userId', filters.userId)

  const query = params.toString()
  return `/api/admin/security/logs${query ? `?${query}` : ''}`
}

export function useSecurityLogs() {
  const [logs, setLogs] = useState<SecurityLog[]>(logsCache?.data.logs || [])
  const [stats, setStats] = useState<SecurityStats>(logsCache?.data.stats || EMPTY_STATS)
  const [totalCount, setTotalCount] = useState(logsCache?.data.totalCount || logsCache?.data.logs.length || 0)
  const [users, setUsers] = useState<SecurityLogUserOption[]>(logsCache?.data.users || [])
  const [isLoading, setIsLoading] = useState(logsCache === null)
  const [error, setError] = useState<string | null>(null)

  const fetchSecurityLogs = useCallback(async (filters?: SecurityLogFilters, forceRefresh = false) => {
    const filterKey = buildFilterKey(filters)

    if (!forceRefresh && logsCache && logsCache.filterKey === filterKey && Date.now() - logsCache.timestamp < CACHE_TTL) {
      setLogs(logsCache.data.logs)
      setStats(logsCache.data.stats)
      setTotalCount(logsCache.data.totalCount ?? logsCache.data.logs.length)
      setUsers(logsCache.data.users || [])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(buildUrl(filters), { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as SecurityLogsResponse | null

      if (!response.ok || !payload) {
        throw new Error(payload?.error || 'No se pudieron cargar los eventos de seguridad.')
      }

      setLogs(payload.logs)
      setStats(payload.stats)
      setTotalCount(payload.totalCount ?? payload.logs.length)
      setUsers(payload.users || [])

      logsCache = {
        data: payload,
        timestamp: Date.now(),
        filterKey,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar los eventos de seguridad.'
      setLogs([])
      setStats(EMPTY_STATS)
      setTotalCount(0)
      setUsers([])
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    logs,
    stats,
    totalCount,
    users,
    isLoading,
    error,
    fetchSecurityLogs,
    refreshLogs: () => fetchSecurityLogs({ timeRange: '24h', limit: 200 }, true),
  }
}
