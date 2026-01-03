'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'


export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'vendedor' | 'tecnico' | 'cliente' | 'supervisor'
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

export interface SystemSettings {
  companyName: string
  companyEmail: string
  companyPhone: string
  companyAddress: string
  currency: string
  taxRate: number
  lowStockThreshold: number
  sessionTimeout: number
  autoBackup: boolean
  emailNotifications: boolean
  smsNotifications: boolean
  maintenanceMode: boolean
  allowRegistration: boolean
  requireEmailVerification: boolean
  maxLoginAttempts: number
  passwordMinLength: number
  requireTwoFactor: boolean
}

// Mock data
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@4gcelulares.com',
    role: 'admin',
    status: 'active',
    lastLogin: '2024-01-15T10:30:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    permissions: ['all'],
    phone: '+595 21 123-4567',
    department: 'Administración'
  },
  {
    id: '2',
    name: 'Ana Rodríguez',
    email: 'ana.rodriguez@4gcelulares.com',
    role: 'tecnico',
    status: 'active',
    lastLogin: '2024-01-14T16:45:00Z',
    createdAt: '2024-01-02T00:00:00Z',
    permissions: ['products', 'inventory'],
    phone: '+595 21 123-4568',
    department: 'Técnico'
  },
  {
    id: '3',
    name: 'Luis García',
    email: 'luis.garcia@4gcelulares.com',
    role: 'vendedor',
    status: 'active',
    lastLogin: '2024-01-13T09:15:00Z',
    createdAt: '2024-01-03T00:00:00Z',
    permissions: ['sales', 'customers'],
    phone: '+595 21 123-4569',
    department: 'Ventas'
  },
  {
    id: '4',
    name: 'María López',
    email: 'maria.lopez@4gcelulares.com',
    role: 'vendedor',
    status: 'inactive',
    lastLogin: '2024-01-10T14:20:00Z',
    createdAt: '2024-01-04T00:00:00Z',
    permissions: ['sales'],
    phone: '+595 21 123-4570',
    department: 'Ventas'
  }
]

const mockMetrics: SystemMetrics = {
  totalUsers: 4,
  activeUsers: 3,
  totalSales: 1250000,
  totalProducts: 156,
  systemHealth: 98,
  databaseSize: '2.4 GB',
  uptime: '15 días',
  lastBackup: '2024-01-15T02:00:00Z',
  errorRate: 0.02,
  responseTime: 120
}

const mockSecurityLogs: SecurityLog[] = [
  {
    id: '1',
    event: 'Inicio de sesión exitoso',
    user: 'carlos.mendoza@4gcelulares.com',
    timestamp: '2024-01-15T10:30:00Z',
    ip: '192.168.1.100',
    severity: 'low'
  },
  {
    id: '2',
    event: 'Intento de acceso fallido',
    user: 'unknown@example.com',
    timestamp: '2024-01-15T09:45:00Z',
    ip: '192.168.1.200',
    severity: 'medium',
    details: '3 intentos fallidos consecutivos'
  },
  {
    id: '3',
    event: 'Cambio de contraseña',
    user: 'ana.rodriguez@4gcelulares.com',
    timestamp: '2024-01-14T16:20:00Z',
    ip: '192.168.1.150',
    severity: 'low'
  },
  {
    id: '4',
    event: 'Acceso desde IP desconocida',
    user: 'luis.garcia@4gcelulares.com',
    timestamp: '2024-01-14T14:10:00Z',
    ip: '203.0.113.1',
    severity: 'high',
    details: 'Acceso desde ubicación no reconocida'
  }
]

export function useAdminDashboard() {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [metrics, setMetrics] = useState<SystemMetrics>(mockMetrics)
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>(mockSecurityLogs)
  const [settings, setSettings] = useState<SystemSettings>({
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || '4G celulares',
    companyEmail: 'info@4gcelulares.com',
    companyPhone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '+595 21 123-4567',
    companyAddress: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Av. Mariscal López 1234, Asunción, Paraguay',
    currency: process.env.NEXT_PUBLIC_CURRENCY || 'PYG',
    taxRate: parseFloat(process.env.NEXT_PUBLIC_TAX_RATE || '0.10') * 100,
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
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([])
  
  const supabase = createClient() // Necesitamos importar createClient

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch Users (from profiles or similar)
        // Asumiendo que existe una tabla 'profiles' o 'users' pública
        // Si no existe, esto fallará y capturaremos el error
        const { data: usersData, error: usersError } = await supabase
          .from('profiles') // Intentar con profiles
          .select('*')
        
        if (!usersError && usersData) {
            const mappedUsers: User[] = usersData.map((u: any) => ({
                id: u.id,
                name: u.full_name || u.name || 'Sin Nombre',
                email: u.email || '',
                role: u.role || 'vendedor',
                status: u.status || 'active',
                lastLogin: u.last_sign_in_at || new Date().toISOString(),
                createdAt: u.created_at || new Date().toISOString(),
                permissions: [], // TODO: map permissions
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
            activeUsers: usersData?.filter((u: any) => (u.status || 'active') === 'active').length || 0,
            totalProducts: productsCount || 0,
            totalSales: totalSales,
            systemHealth: 100 // Hardcoded for now
        }))

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])


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

  const createUser = useCallback(async (userData: Partial<User>) => {
    // TODO: Implement real user creation logic (likely requires server-side admin API)
    return { success: false, error: 'User creation not implemented yet in this version' }
  }, [])

  const updateUser = useCallback(async (userId: string, userData: Partial<User>) => {
    // TODO: Implement real user update logic
    return { success: false, error: 'User update not implemented yet in this version' }
  }, [])

  const deleteUser = useCallback(async (userId: string) => {
    // TODO: Implement real user deletion logic
    return { success: false, error: 'User deletion not implemented yet in this version' }
  }, [])

  const updateSettings = useCallback(async (newSettings: Partial<SystemSettings>) => {
    // TODO: Implement real settings update logic
    setSettings(prev => ({ ...prev, ...newSettings }))
    return { success: true }
  }, [])

  const performSystemAction = useCallback(async (action: string) => {
    // TODO: Implement real system actions
    return { success: true, message: `Action ${action} simulated` }
  }, [])

  return {
    users,
    metrics,
    securityLogs,
    settings,
    isLoading,
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