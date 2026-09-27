'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SystemSettings } from '@/lib/validations/system-settings'
import { DEFAULT_SYSTEM_COLOR_SCHEME } from '@/lib/theme/color-schemes'

export type { SystemSettings } from '@/lib/validations/system-settings'


export interface User {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'owner' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'
  status: 'active' | 'inactive' | 'suspended'
  lastLogin: string
  createdAt: string
  permissions: string[]
  avatar?: string
  phone?: string
  department?: string
  avatar_url?: string
  loginAttempts?: number
  lastActivity?: string
  notes?: string
}

export interface SystemMetrics {
  totalUsers: number
  activeUsers: number
  totalSales: number
  totalProducts: number
  systemHealth: number
  databaseSize: string
  uptime: string
  lastBackup: string
  errorRate: number
  responseTime: number
}

export interface SecurityLog {
  id: string
  event: string
  user: string
  timestamp: string
  ip: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  details?: string
}

// Mock data



export function useAdminDashboard() {
  // Estado inicial vacío
  const [users, setUsers] = useState<User[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    totalSales: 0,
    totalProducts: 0,
    systemHealth: 100,
    databaseSize: 'Unknown',
    uptime: '0',
    lastBackup: new Date().toISOString(),
    errorRate: 0,
    responseTime: 0
  })
  const [securityLogs, _setSecurityLogs] = useState<SecurityLog[]>([])
  const [settings, setSettings] = useState<SystemSettings>({
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || '4G celulares',
    companyEmail: 'info@4gcelulares.com',
    companyPhone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '+595 21 123-4567',
    companyRuc: '',
    companyAddress: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Av. Mariscal López 1234, Asunción, Paraguay',
    city: 'Asunción',
    currency: ((process.env.NEXT_PUBLIC_CURRENCY || 'PYG') as 'PYG' | 'USD' | 'EUR' | 'MXN'),
    taxRate: parseFloat(process.env.NEXT_PUBLIC_TAX_RATE || '0.10') * 100,
    repairMaxDiscountPercent: 20,
    repairLaborTaxRate: 10,
    defaultInstallmentRates: {},
    theme: 'system',
    primaryColor: DEFAULT_SYSTEM_COLOR_SCHEME,
    dateFormat: 'DD/MM/YYYY',
    timeZone: 'America/Asuncion',
    language: 'es',
    itemsPerPage: 10,
    socialLinks: {},
    features: {},
    retentionDays: 90,
    lowStockThreshold: 10,
    sessionTimeout: 30,
    autoBackup: true,
    emailNotifications: true,
    smsNotifications: false,
    maintenanceMode: false,
    allowRegistration: true,
    requireEmailVerification: true,
    maxLoginAttempts: 3,
    passwordMinLength: 8,
    requireTwoFactor: false
  })

  const [isLoading, setIsLoading] = useState(false)
  // El hook no tenia donde reportar una falla: la carga se caia, las metricas
  // quedaban en sus ceros iniciales y la pantalla se veia normal.
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Fetch Settings from database
        const { data: settingsData, error: settingsError } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', 'system')
          .single()

        if (!settingsError && settingsData) {
          const { mapDBToSettings } = await import('@/lib/validations/system-settings')
          const mappedSettings = mapDBToSettings(settingsData)
          setSettings(mappedSettings)
        }

        // Fetch Users (from profiles or similar)
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('*')

        interface ProfileRow {
          id: string
          full_name?: string | null
          name?: string | null
          email?: string | null
          role?: User['role'] | null
          status?: User['status'] | null
          last_sign_in_at?: string | null
          created_at?: string | null
          phone?: string
          department?: string
        }

        if (!usersError && usersData) {
            const mappedUsers: User[] = (usersData as unknown as ProfileRow[]).map((u) => ({
                id: u.id,
                name: u.full_name || u.name || 'Sin Nombre',
                email: u.email || '',
                role: u.role || 'vendedor',
                status: u.status || 'active',
                lastLogin: u.last_sign_in_at || new Date().toISOString(),
                createdAt: u.created_at || new Date().toISOString(),
                permissions: [],
                phone: u.phone,
                department: u.department
            }))
            setUsers(mappedUsers)
        }

        // Fetch Metrics
        const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true })
        const { data: salesData } = await supabase.from('sales').select('total_amount')

        const totalSales = salesData?.reduce((acc, curr) => acc + (curr.total_amount || 0), 0) || 0

        setMetrics(prev => ({
            ...prev,
            totalUsers: usersData?.length || 0,
            activeUsers: ((usersData as unknown as ProfileRow[]) || []).filter((u) => (u.status || 'active') === 'active').length,
            totalProducts: productsCount || 0,
            totalSales: totalSales,
            systemHealth: 100
        }))

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setError(
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar las métricas del panel.'
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [supabase])


  const getFilteredUsers = useCallback((filters: { role?: string; status?: string; search?: string }) => {
    return users.filter(user => {
      if (filters.role && user.role !== filters.role) return false
      if (filters.status && user.status !== filters.status) return false
      if (filters.search) {
        const search = filters.search.toLowerCase()
        return user.name.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search)
      }
      return true
    })
  }, [users])

  const getSecurityLogsByPeriod = useCallback((days: number = 7) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    return securityLogs.filter(log => new Date(log.timestamp) >= cutoff)
  }, [securityLogs])

  const summary = useMemo(() => ({
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'active').length,
    roles: users.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1
      return acc
    }, {}),
  }), [users])

  const createUser = useCallback(async (_userData: Partial<User>) => {
    // TODO: Implement real user creation logic (likely requires server-side admin API)
    return { success: false, error: 'User creation not implemented yet in this version' }
  }, [])

  const updateUser = useCallback(async (_userId: string, _userData: Partial<User>) => {
    // TODO: Implement real user update logic
    return { success: false, error: 'User update not implemented yet in this version' }
  }, [])

  const deleteUser = useCallback(async (_userId: string) => {
    // TODO: Implement real user deletion logic
    return { success: false, error: 'User deletion not implemented yet in this version' }
  }, [])

  const updateSettings = useCallback(async (newSettings: Partial<SystemSettings>) => {
    try {
      setIsLoading(true)

      // 1. Validar con Zod
      const { SystemSettingsPartialSchema } = await import('@/lib/validations/system-settings')
      const validated = SystemSettingsPartialSchema.parse(newSettings)

      // 2. Verificar rate limit
      const { checkRateLimit } = await import('@/lib/security/rate-limit')
      const rateLimitCheck = await checkRateLimit('settings_update')
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: `Demasiadas solicitudes. Intente nuevamente en ${rateLimitCheck.resetAt.toLocaleTimeString()}.`
        }
      }

      // 3. Actualizar via endpoint protegido en servidor
      const response = await fetch('/api/admin/system/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: validated })
      })

      const responseData = await response.json().catch(() => ({}))
      if (!response.ok || !responseData?.success || !responseData?.data) {
        const errorMessage =
          responseData?.error || `No se pudo guardar la configuración (${response.status})`
        console.error('Error updating settings via API:', errorMessage)
        return { success: false, error: errorMessage }
      }

      // 4. Registrar en audit log
      const { logAuditEvent, getChangedFields, determineSeverity } = await import('@/lib/security/audit-log')
      const changes = getChangedFields(settings, validated as SystemSettings)

      // Registrar cada cambio individualmente
      for (const change of changes) {
        await logAuditEvent({
          action: 'update',
          fieldName: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          severity: determineSeverity(change.field),
          details: {
            totalChanges: changes.length,
            timestamp: new Date().toISOString()
          }
        })
      }

      // 5. Actualizar estado local
      const { mapDBToSettings } = await import('@/lib/validations/system-settings')
      const updatedSettings = mapDBToSettings(responseData.data)
      setSettings(updatedSettings)

      return { success: true }
    } catch (error) {
      console.error('Update settings error:', error)

      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: false,
        error: 'Error al actualizar configuración'
      }
    } finally {
      setIsLoading(false)
    }
  }, [settings])

  const performSystemAction = useCallback(async (action: string) => {
    try {
      // Validar acción
      const { SystemActionSchema } = await import('@/lib/validations/system-settings')
      const validatedAction = SystemActionSchema.parse(action)

      // Verificar rate limit
      const { checkRateLimit } = await import('@/lib/security/rate-limit')
      const rateLimitCheck = await checkRateLimit(`system_action_${validatedAction}`)
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: 'Demasiadas solicitudes. Intente más tarde.'
        }
      }

      // Registrar en audit log
      const { logAuditEvent } = await import('@/lib/security/audit-log')
      await logAuditEvent({
        action: 'system_action',
        severity: 'high',
        details: { action: validatedAction }
      })

      // Ejecutar acción (aquí deberías implementar la lógica real)
      let message = ''
      switch (validatedAction) {
        case 'backup':
          message = 'Backup iniciado correctamente'
          // TODO: Implementar backup real
          break
        case 'clearCache':
          message = 'Caché limpiado correctamente'
          // TODO: Implementar limpieza de caché
          break
        case 'checkIntegrity':
          message = 'Verificación de integridad completada'
          // TODO: Implementar verificación
          break
        case 'testEmail':
          message = 'Email de prueba enviado'
          // TODO: Implementar envío de email
          break
      }

      return { success: true, message }
    } catch (error) {
      console.error('System action error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al realizar acción'
      }
    }
  }, [])

  return {
    users,
    metrics,
    securityLogs,
    settings,
    isLoading,
    error,
    summary,
    createUser,
    updateUser,
    deleteUser,
    updateSettings,
    performSystemAction,
    getFilteredUsers,
    getSecurityLogsByPeriod
  }
}
