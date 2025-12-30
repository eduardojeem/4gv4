'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'

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

export function useSecurityLogs() {
  const [logs, setLogs] = useState<SecurityLog[]>([])
  const [stats, setStats] = useState<SecurityStats>({
    totalEvents: 0,
    criticalEvents: 0,
    highRiskEvents: 0,
    failedAttempts: 0,
    uniqueUsers: 0,
    uniqueIPs: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { user } = useAuth()
  const supabase = createClient()

  // Mapear eventos de audit_log a eventos de seguridad legibles
  const mapAuditLogToSecurityEvent = useCallback((auditLog: any): SecurityLog => {
    const eventMap: Record<string, { event: string; severity: SecurityLog['severity'] }> = {
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

    const mapped = eventMap[auditLog.action] || { event: `Acción: ${auditLog.action}`, severity: 'low' as const }
    
    return {
      id: auditLog.id,
      event: mapped.event,
      user: auditLog.user_email || auditLog.user_id || 'Sistema',
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
  }, [])

  // Función para obtener estadísticas desde Supabase
  const fetchStatsFromSupabase = useCallback(async (hours: number = 24) => {
    if (!user) return

    try {
      console.log('Fetching stats for', hours, 'hours')
      
      // Intentar usar la función RPC si existe
      const { data, error } = await supabase.rpc('get_security_stats', { p_hours: hours })
      
      if (error) {
        console.warn('RPC function not available, calculating stats manually:', error)
        
        // Fallback: calcular estadísticas manualmente
        const startDate = new Date()
        startDate.setHours(startDate.getHours() - hours)
        
        const { data: logs, error: logsError } = await supabase
          .from('audit_log')
          .select('action, new_values')
          .gte('created_at', startDate.toISOString())
        
        if (logsError) {
          console.error('Error fetching logs for stats:', logsError)
          return
        }
        
        const totalEvents = logs?.length || 0
        const criticalEvents = logs?.filter(log => 
          log.new_values && typeof log.new_values === 'object' && 
          (log.new_values as any).severity === 'critical'
        ).length || 0
        const highRiskEvents = logs?.filter(log => 
          log.new_values && typeof log.new_values === 'object' && 
          (log.new_values as any).severity === 'high'
        ).length || 0
        const failedAttempts = logs?.filter(log => 
          log.action?.includes('failed') || log.action === 'permission_denied'
        ).length || 0
        
        setStats({
          totalEvents,
          criticalEvents,
          highRiskEvents,
          failedAttempts,
          uniqueUsers: 0, // Difícil de calcular sin más queries
          uniqueIPs: 0
        })
        
        return
      }

      if (data) {
        console.log('Stats from RPC:', data)
        setStats({
          totalEvents: data.totalEvents || 0,
          criticalEvents: data.criticalEvents || 0,
          highRiskEvents: data.highRiskEvents || 0,
          failedAttempts: data.failedAttempts || 0,
          uniqueUsers: data.uniqueUsers || 0,
          uniqueIPs: data.uniqueIPs || 0
        })
      }
    } catch (err) {
      console.error('Error calling get_security_stats:', err)
      // No lanzar error, solo usar estadísticas por defecto
      setStats({
        totalEvents: 0,
        criticalEvents: 0,
        highRiskEvents: 0,
        failedAttempts: 0,
        uniqueUsers: 0,
        uniqueIPs: 0
      })
    }
  }, [user, supabase])

  const fetchSecurityLogs = useCallback(async (filters?: {
    limit?: number
    offset?: number
    severity?: string
    timeRange?: string
    userId?: string
    action?: string
  }) => {
    if (!user) {
      console.log('No user authenticated, skipping security logs fetch')
      return
    }

    console.log('Starting security logs fetch for user:', user.id)
    setIsLoading(true)
    setError(null)

    try {
      // Verificar primero si podemos acceder a la tabla
      const { count, error: countError } = await supabase
        .from('audit_log')
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        console.error('Cannot access audit_log table:', countError)
        throw new Error(`No se puede acceder a la tabla de auditoría: ${countError.message}`)
      }
      
      console.log('Audit log table accessible, total records:', count)
      console.log('Fetching security logs with filters:', filters)
      
      let query = supabase
        .from('audit_log')
        .select(`
          id,
          user_id,
          action,
          resource,
          resource_id,
          old_values,
          new_values,
          ip_address,
          user_agent,
          created_at
        `)
        .order('created_at', { ascending: false })

      // Aplicar filtros
      if (filters?.limit) {
        query = query.limit(filters.limit)
      } else {
        query = query.limit(100) // Límite por defecto
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1)
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
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24h por defecto
        }

        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error: queryError } = await query

      if (queryError) {
        console.error('Supabase query error:', queryError)
        throw queryError
      }

      console.log('Raw audit log data:', data)

      // Obtener emails de usuarios si hay datos
      let userEmails: Record<string, string> = {}
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(log => log.user_id).filter(Boolean))]
        
        if (userIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, name')
            .in('id', userIds)
          
          if (!profileError && profiles) {
            userEmails = profiles.reduce((acc, profile) => {
              acc[profile.id] = profile.email || profile.name || 'Usuario desconocido'
              return acc
            }, {} as Record<string, string>)
          }
        }
      }

      // Mapear los datos a SecurityLog
      const securityLogs: SecurityLog[] = (data || []).map((auditLog: any) => {
        const userEmail = auditLog.user_id ? 
          (userEmails[auditLog.user_id] || 'Usuario desconocido') : 
          'Sistema'
        
        return mapAuditLogToSecurityEvent({
          ...auditLog,
          user_email: userEmail
        })
      })

      // Filtrar por severidad si se especifica
      const filteredLogs = filters?.severity && filters.severity !== 'all'
        ? securityLogs.filter(log => log.severity === filters.severity)
        : securityLogs

      console.log('Processed security logs:', filteredLogs.length)
      setLogs(filteredLogs)

      // Obtener estadísticas desde Supabase si están disponibles
      const timeHours = filters?.timeRange === '1h' ? 1 : 
                       filters?.timeRange === '24h' ? 24 : 
                       filters?.timeRange === '7d' ? 168 : 
                       filters?.timeRange === '30d' ? 720 : 24

      await fetchStatsFromSupabase(timeHours)

    } catch (err) {
      console.error('Error fetching security logs:', err)
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        code: (err as any)?.code,
        details: (err as any)?.details,
        hint: (err as any)?.hint,
        user: user?.id,
        filters
      })
      
      // Si hay error, mostrar datos mock como fallback
      console.log('Using mock data as fallback')
      const mockLogs = [
        {
          id: 'mock-1',
          event: 'Inicio de sesión exitoso',
          user: user?.email || 'usuario@ejemplo.com',
          timestamp: new Date().toISOString(),
          ip: '192.168.1.100',
          severity: 'low' as const,
          details: 'Datos de ejemplo - Configure Supabase para ver datos reales'
        },
        {
          id: 'mock-2',
          event: 'Error de configuración',
          user: 'Sistema',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          ip: 'N/A',
          severity: 'high' as const,
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
      
      setError(`Error de configuración: ${err instanceof Error ? err.message : 'Error desconocido al cargar logs'}. Mostrando datos de ejemplo.`)
    } finally {
      setIsLoading(false)
    }
  }, [user, supabase, fetchStatsFromSupabase, mapAuditLogToSecurityEvent])

  // Función para crear un log de seguridad personalizado usando la función de Supabase
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
      // Usar la función de Supabase para crear el log
      const { data, error } = await supabase.rpc('log_data_event', {
        p_user_id: user.id,
        p_action: logData.action,
        p_resource: logData.resource || 'security',
        p_resource_id: logData.resource_id,
        p_new_values: logData.details || {},
        p_ip_address: logData.ip_address
      })

      if (error) {
        throw error
      }

      // Refrescar los logs después de crear uno nuevo
      await fetchSecurityLogs()

      return data

    } catch (err) {
      console.error('Error creating security log:', err)
      throw err
    }
  }, [user, supabase, fetchSecurityLogs])

  // Función para registrar eventos de autenticación
  const logAuthEvent = useCallback(async (eventData: {
    action: 'login' | 'login_failed' | 'logout' | 'password_change' | 'role_change' | 'permission_denied' | 'suspicious_activity'
    success?: boolean
    ip_address?: string
    user_agent?: string
    details?: Record<string, any>
  }) => {
    try {
      const { data, error } = await supabase.rpc('log_auth_event', {
        p_user_id: user?.id,
        p_action: eventData.action,
        p_success: eventData.success ?? true,
        p_ip_address: eventData.ip_address,
        p_user_agent: eventData.user_agent,
        p_details: eventData.details || {}
      })

      if (error) {
        throw error
      }

      return data

    } catch (err) {
      console.error('Error logging auth event:', err)
      throw err
    }
  }, [user, supabase])

  // Función para exportar logs a CSV
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

  // Cargar logs iniciales
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
    refreshLogs: () => fetchSecurityLogs({ timeRange: '24h' })
  }
}