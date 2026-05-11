'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { logAuthEventClient } from '@/lib/auth-event-client'

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

// ============================================================================
// Cache
// ============================================================================

interface SecurityLogsCache {
  logs: SecurityLog[]
  stats: SecurityStats
  timestamp: number
  filterKey: string
}

let logsCache: SecurityLogsCache | null = null
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

// Profiles cache persists across fetches to avoid re-fetching known users
const profilesCache = new Map<string, string>()

function buildFilterKey(filters?: { timeRange?: string; severity?: string; userId?: string; action?: string }): string {
  return `${filters?.timeRange || '24h'}|${filters?.severity || 'all'}|${filters?.userId || ''}|${filters?.action || ''}`
}

function isCacheValid(filterKey: string): boolean {
  return logsCache !== null &&
    logsCache.filterKey === filterKey &&
    (Date.now() - logsCache.timestamp) < CACHE_TTL
}

// ============================================================================
// Event mapping
// ============================================================================

const EVENT_MAP: Record<string, { event: string; severity: SecurityLog['severity'] }> = {
  'create': { event: 'Creación de registro', severity: 'low' },
  'update': { event: 'Actualización de registro', severity: 'low' },
  'delete': { event: 'Eliminación de registro', severity: 'medium' },
  'login': { event: 'Inicio de sesión exitoso', severity: 'low' },
  'login_failed': { event: 'Intento de acceso fallido', severity: 'medium' },
  'logout': { event: 'Cierre de sesión', severity: 'low' },
  'password_change': { event: 'Cambio de contraseña', severity: 'low' },
  'role_change': { event: 'Cambio de rol de usuario', severity: 'high' },
  'grant_admin_self_rpc': { event: 'Auto-promoción a administrador', severity: 'critical' },
  'grant_admin_migration': { event: 'Promoción a administrador', severity: 'high' },
  'permission_denied': { event: 'Acceso denegado', severity: 'medium' },
  'suspicious_activity': { event: 'Actividad sospechosa detectada', severity: 'high' },
  'data_export': { event: 'Exportación de datos', severity: 'medium' },
  'bulk_operation': { event: 'Operación masiva', severity: 'medium' }
}

function mapAuditLogToSecurityEvent(auditLog: any): SecurityLog {
  const mapped = EVENT_MAP[auditLog.action] || { event: `Acción: ${auditLog.action}`, severity: 'low' as const }

  return {
    id: auditLog.id,
    event: mapped.event,
    user: auditLog.user_display || auditLog.user_id || 'Sistema',
    timestamp: auditLog.created_at,
    ip: auditLog.ip_address || 'N/A',
    severity: mapped.severity,
    details: auditLog.resource ? `Recurso: ${auditLog.resource}${auditLog.resource_id ? ` (ID: ${auditLog.resource_id})` : ''}` : undefined,
    user_id: auditLog.user_id || undefined,
    action: auditLog.action,
    resource: auditLog.resource || undefined,
    resource_id: auditLog.resource_id || undefined,
    user_agent: auditLog.user_agent || undefined
  }
}

function computeStatsFromLogs(logs: SecurityLog[]): SecurityStats {
  const uniqueUsers = new Set<string>()
  const uniqueIPs = new Set<string>()
  let criticalEvents = 0
  let highRiskEvents = 0
  let failedAttempts = 0

  for (const log of logs) {
    if (log.user && log.user !== 'Sistema') uniqueUsers.add(log.user)
    if (log.ip && log.ip !== 'N/A') uniqueIPs.add(log.ip)

    switch (log.severity) {
      case 'critical': criticalEvents++; break
      case 'high': highRiskEvents++; break
    }

    if (log.action?.includes('failed') || log.action === 'permission_denied') {
      failedAttempts++
    }
  }

  return {
    totalEvents: logs.length,
    criticalEvents,
    highRiskEvents,
    failedAttempts,
    uniqueUsers: uniqueUsers.size,
    uniqueIPs: uniqueIPs.size
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useSecurityLogs() {
  const [logs, setLogs] = useState<SecurityLog[]>(logsCache?.logs || [])
  const [stats, setStats] = useState<SecurityStats>(logsCache?.stats || {
    totalEvents: 0,
    criticalEvents: 0,
    highRiskEvents: 0,
    failedAttempts: 0,
    uniqueUsers: 0,
    uniqueIPs: 0
  })
  const [isLoading, setIsLoading] = useState(logsCache === null)
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuth()
  const supabase = createClient()

  const fetchSecurityLogs = useCallback(async (filters?: {
    limit?: number
    offset?: number
    severity?: string
    timeRange?: string
    userId?: string
    action?: string
  }, forceRefresh = false) => {
    if (!user) return

    const filterKey = buildFilterKey(filters)

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && isCacheValid(filterKey)) {
      setLogs(logsCache!.logs)
      setStats(logsCache!.stats)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Single query — no redundant COUNT check
      let query = supabase
        .from('audit_log')
        .select(`
          id,
          user_id,
          action,
          resource,
          resource_id,
          ip_address,
          user_agent,
          created_at
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      const limit = filters?.limit || 200
      query = query.limit(limit)

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + limit - 1)
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId)
      }

      if (filters?.action) {
        query = query.eq('action', filters.action)
      }

      if (filters?.timeRange) {
        const now = new Date()
        let startDate: Date

        switch (filters.timeRange) {
          case '1h':
            startDate = new Date(now.getTime() - 60 * 60 * 1000)
            break
          case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            break
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        }

        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw queryError
      }

      // Resolve user display names — only fetch uncached profiles
      const userIds = [...new Set((data || []).map(log => log.user_id).filter(Boolean))] as string[]
      const uncachedIds = userIds.filter(id => !profilesCache.has(id))

      if (uncachedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', uncachedIds)

        if (profiles) {
          for (const profile of profiles) {
            const name = profile.full_name || ''
            const email = profile.email || ''
            let display: string

            if (name && email) {
              display = `${name} (${email})`
            } else if (name || email) {
              display = name || email
            } else {
              display = 'Usuario desconocido'
            }

            profilesCache.set(profile.id, display)
          }
        }
      }

      // Map audit logs to security events with cached profile names
      const securityLogs: SecurityLog[] = (data || []).map((auditLog: any) => {
        const userDisplay = auditLog.user_id
          ? (profilesCache.get(auditLog.user_id) || 'Usuario desconocido')
          : 'Sistema'

        return mapAuditLogToSecurityEvent({
          ...auditLog,
          user_display: userDisplay
        })
      })

      // Filter by severity client-side (severity is derived, not a DB column)
      const filteredLogs = filters?.severity && filters.severity !== 'all'
        ? securityLogs.filter(log => log.severity === filters.severity)
        : securityLogs

      // Compute stats from the fetched data — no extra query needed
      const computedStats = computeStatsFromLogs(securityLogs)

      // Try RPC for more accurate stats (non-blocking)
      fetchStatsRPC(filters?.timeRange).then(rpcStats => {
        if (rpcStats) {
          setStats(rpcStats)
          if (logsCache && logsCache.filterKey === filterKey) {
            logsCache.stats = rpcStats
          }
        }
      }).catch(() => { /* RPC unavailable, use computed stats */ })

      setLogs(filteredLogs)
      setStats(computedStats)

      // Update cache
      logsCache = {
        logs: filteredLogs,
        stats: computedStats,
        timestamp: Date.now(),
        filterKey
      }

    } catch (err) {
      console.error('Error fetching security logs:', err)

      // Fallback to mock data
      const mockLogs: SecurityLog[] = [
        {
          id: 'mock-1',
          event: 'Inicio de sesión exitoso',
          user: user?.email || 'usuario@ejemplo.com',
          timestamp: new Date().toISOString(),
          ip: '192.168.1.100',
          severity: 'low',
          details: 'Datos de ejemplo - Configure Supabase para ver datos reales'
        },
        {
          id: 'mock-2',
          event: 'Error de configuración',
          user: 'Sistema',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          ip: 'N/A',
          severity: 'high',
          details: 'La tabla audit_log no está disponible o no tiene permisos'
        }
      ]

      setLogs(mockLogs)
      setStats({
        totalEvents: 2,
        criticalEvents: 0,
        highRiskEvents: 1,
        failedAttempts: 0,
        uniqueUsers: 1,
        uniqueIPs: 1
      })

      setError(`Error de configuración: ${err instanceof Error ? err.message : 'Error desconocido'}. Mostrando datos de ejemplo.`)
    } finally {
      setIsLoading(false)
    }
  }, [user, supabase])

  // Non-blocking RPC call for accurate stats (if available)
  const fetchStatsRPC = useCallback(async (timeRange?: string): Promise<SecurityStats | null> => {
    if (!user) return null

    const hours = timeRange === '1h' ? 1 :
      timeRange === '24h' ? 24 :
        timeRange === '7d' ? 168 :
          timeRange === '30d' ? 720 : 24

    try {
      const { data, error } = await supabase.rpc('get_security_stats', { p_hours: hours })
      if (error || !data) return null

      return {
        totalEvents: data.totalEvents || 0,
        criticalEvents: data.criticalEvents || 0,
        highRiskEvents: data.highRiskEvents || 0,
        failedAttempts: data.failedAttempts || 0,
        uniqueUsers: data.uniqueUsers || 0,
        uniqueIPs: data.uniqueIPs || 0
      }
    } catch {
      return null
    }
  }, [user, supabase])

  // Create a security log entry
  const createSecurityLog = useCallback(async (logData: {
    action: string
    resource?: string
    resource_id?: string
    details?: Record<string, any>
    severity?: SecurityLog['severity']
    ip_address?: string
  }) => {
    if (!user) return

    try {
      const { data, error } = await supabase.rpc('log_data_event', {
        p_user_id: user.id,
        p_action: logData.action,
        p_resource: logData.resource || 'security',
        p_resource_id: logData.resource_id,
        p_new_values: logData.details || {},
        p_ip_address: logData.ip_address
      })

      if (error) throw error

      // Invalidate cache and refresh
      logsCache = null
      await fetchSecurityLogs()

      return data
    } catch (err) {
      console.error('Error creating security log:', err)
      throw err
    }
  }, [user, supabase, fetchSecurityLogs])

  // Log authentication events
  const logAuthEvent = useCallback(async (eventData: {
    action: 'login' | 'login_failed' | 'logout' | 'password_change' | 'role_change' | 'permission_denied' | 'suspicious_activity'
    success?: boolean
    ip_address?: string
    user_agent?: string
    details?: Record<string, any>
  }) => {
    try {
      const ok = await logAuthEventClient({
        userId: user?.id,
        action: eventData.action,
        success: eventData.success ?? true,
        ipAddress: eventData.ip_address,
        userAgent: eventData.user_agent,
        details: eventData.details || {}
      })

      if (!ok) throw new Error('Failed to log auth event')
      return true
    } catch (err) {
      console.error('Error logging auth event:', err)
      throw err
    }
  }, [user])

  // Export logs to CSV
  const exportLogsToCSV = useCallback(() => {
    const headers = ['ID', 'Evento', 'Usuario', 'Fecha/Hora', 'IP', 'Severidad', 'Detalles']
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        log.id,
        `"${log.event}"`,
        `"${log.user}"`,
        log.timestamp,
        log.ip,
        log.severity,
        `"${log.details || ''}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `security-logs-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [logs])

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchSecurityLogs({ timeRange: '24h' })
    }
  }, [user, fetchSecurityLogs])

  return {
    logs,
    stats,
    isLoading,
    error,
    fetchSecurityLogs,
    createSecurityLog,
    logAuthEvent,
    exportLogsToCSV,
    refreshLogs: () => fetchSecurityLogs({ timeRange: '24h' }, true)
  }
}
