'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react'
import { createClient as createSupabaseClient } from '../lib/supabase/client'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { UserRole, hasEffectivePermission, canManageUser } from '../lib/auth/roles-permissions'
import { normalizeRole } from '../lib/auth/role-utils'
import { useToast } from '../components/ui/use-toast'

type ProfileStatus = 'active' | 'inactive' | 'suspended'

// Tipos para el contexto de autenticación
export interface AuthUser extends SupabaseUser {
  role?: UserRole
  status?: ProfileStatus
  permissions?: string[]
  profile?: {
    name?: string
    avatar_url?: string
    department?: string
    phone?: string
    location?: string
  }
}

export interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<AuthUser['profile']>) => Promise<{ error?: string }>
  updateUserRole: (userId: string, role: UserRole) => Promise<{ error?: string }>
  hasPermission: (permission: string) => boolean
  canManageUser: (targetRole: UserRole) => boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  isManager: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type SignUpMetadata = {
  name?: string
  avatar_url?: string
  department?: string
  phone?: string
  location?: string
  [key: string]: unknown
}

// Helper: validar y castear cadenas a UserRole
const toUserRole = (value: unknown): UserRole => {
  if (typeof value === 'string' && value.toLowerCase().trim() === 'super_admin') {
    return 'super_admin'
  }
  const n = normalizeRole(typeof value === 'string' ? value : undefined)
  return (n as UserRole) || 'cliente'
}

const toProfileStatus = (value: unknown): ProfileStatus => {
  if (value === 'active' || value === 'inactive' || value === 'suspended') {
    return value
  }
  return 'active'
}

// Hook para usar el contexto de autenticación
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Proveedor del contexto de autenticación
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const supabase = useMemo(() => createSupabaseClient(), [])



  // Función para obtener el perfil del usuario y sus permisos
  const fetchUserProfile = useCallback(async (userId: string): Promise<Partial<AuthUser>> => {
    // Valores por defecto seguros
    const defaultProfile: Partial<AuthUser> = {
      role: toUserRole('cliente'),
      status: 'active',
      profile: {},
      permissions: []
    }

    try {
      if (!userId || typeof userId !== 'string') {
        return defaultProfile
      }

      if (!supabase) {
        return defaultProfile
      }

      // 1. Obtener rol de user_roles (fuente de verdad, misma que el middleware)
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()

      // 2. Obtener perfil para datos de display
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, phone, status')
        .eq('id', userId)
        .maybeSingle()

      // 3. Obtener permisos directos del usuario (fuente para permisos extra por encima del rol)
      let directPermissions: string[] = []
      const { data: directPermissionsWithStatus, error: directPermissionsError } = await supabase
        .from('user_permissions')
        .select('permission,is_active')
        .eq('user_id', userId)

      if (!directPermissionsError) {
        directPermissions = (directPermissionsWithStatus || [])
          .filter((row) => row?.is_active !== false)
          .map((row) => row?.permission)
          .filter((permission): permission is string => typeof permission === 'string' && permission.length > 0)
      } else if (directPermissionsError.message?.includes('is_active')) {
        // Compatibilidad con esquemas antiguos sin user_permissions.is_active
        const { data: directPermissionsOnly } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', userId)

        directPermissions = (directPermissionsOnly || [])
          .map((row) => row?.permission)
          .filter((permission): permission is string => typeof permission === 'string' && permission.length > 0)
      }

      // user_roles is the trusted role source for permissions.
      const resolvedRole = toUserRole(roleRow?.role ?? undefined)
      const resolvedStatus = toProfileStatus(profileData?.status)

      return {
        role: resolvedRole,
        status: resolvedStatus,
        profile: {
          name: profileData?.full_name || '',
          avatar_url: profileData?.avatar_url || '',
          phone: profileData?.phone || ''
        },
        permissions: Array.from(new Set(directPermissions))
      }
    } catch {
      return defaultProfile
    }
  }, [supabase])

  // Función para refrescar los datos del usuario
  const refreshUser = useCallback(async () => {
    if (!session?.user) return

    try {
      const userProfile = await fetchUserProfile(session.user.id)
      setUser({
        ...session.user,
        role: userProfile.role,
        status: userProfile.status,
        permissions: userProfile.permissions,
        profile: userProfile.profile
      } as AuthUser)
    } catch (error) {
      console.error('Error refreshing user:', error)
    }
  }, [session, fetchUserProfile])

  // Función para iniciar sesión
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        // Registrar intento fallido
        try {
          const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined
          await supabase.rpc('log_auth_event', {
            p_user_id: undefined, // No tenemos UUID si falló
            p_action: 'login_failed',
            p_success: false,
            p_ip_address: undefined,
            p_user_agent: userAgent,
            p_details: { email, error: error.message }
          })
        } catch (logError) {
          console.error('Error logging failed login:', logError)
        }
        return { error: error.message }
      }

      if (data.user) {
        try {
          const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined
          await supabase.rpc('log_auth_event', {
            p_user_id: data.user.id,
            p_action: 'login',
            p_success: true,
            p_ip_address: undefined,
            p_user_agent: userAgent,
            p_details: { email, method: 'password' }
          })
        } catch (logError) {
          console.error('Error logging auth event (login):', logError)
        }
      }

      return {}
    } catch (error) {
      console.error('Error signing in:', error)
      return { error: 'Error inesperado al iniciar sesión' }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Función para registrarse
  const signUp = useCallback(async (email: string, password: string, metadata?: SignUpMetadata) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })

      if (error) {
        return { error: error.message }
      }

      // Crear perfil inicial y asignar rol por defecto
      if (data.user) {
        // Crear perfil
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: metadata?.name,
          avatar_url: metadata?.avatar_url,
          department: metadata?.department,
          phone: metadata?.phone,
          location: metadata?.location
        })

        // Asignar rol por defecto
        await supabase.from('user_roles').insert({
          user_id: data.user.id,
          role: 'cliente'
        })

        // Registrar en audit log
        await supabase.from('audit_log').insert({
          user_id: data.user.id,
          action: 'sign_up',
          resource_type: 'auth',
          details: { email }
        })
      }

      return {}
    } catch (error) {
      console.error('Error signing up:', error)
      return { error: 'Error inesperado al registrarse' }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Función para cerrar sesión
  const signOut = useCallback(async () => {
    try {
      setLoading(true)

      if (user) {
        try {
          const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined
          await supabase.rpc('log_auth_event', {
            p_user_id: user.id,
            p_action: 'logout',
            p_success: true,
            p_ip_address: undefined,
            p_user_agent: userAgent,
            p_details: {}
          })
        } catch (logError) {
          console.error('Error logging auth event (logout):', logError)
        }
      }

      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error)
        toast({
          title: 'Error',
          description: 'Error al cerrar sesión',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error in signOut:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, user, toast])

  // Función para actualizar el perfil
  const updateProfile = useCallback(async (updates: Partial<AuthUser['profile']>) => {
    if (!user) return { error: 'Usuario no autenticado' }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (error) {
        return { error: error.message }
      }

      // Actualizar el estado local
      setUser({
        ...user,
        profile: {
          ...user.profile,
          ...updates
        }
      })

      // Registrar en audit log
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'update_profile',
        resource_type: 'user',
        details: updates
      })

      return {}
    } catch (error) {
      console.error('Error updating profile:', error)
      return { error: 'Error inesperado al actualizar perfil' }
    }
  }, [supabase, user])

  // Función para actualizar el rol de un usuario
  const updateUserRole = useCallback(async (userId: string, role: UserRole) => {
    if (!user || !hasEffectivePermission(user.role || 'cliente', 'users.update', user.permissions)) {
      return { error: 'Sin permisos para actualizar roles' }
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: role,
          updated_at: new Date().toISOString()
        })

      if (error) {
        return { error: error.message }
      }

      // Registrar en audit log
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'update_user_role',
        resource_type: 'user',
        resource_id: userId,
        details: { new_role: role }
      })

      return {}
    } catch (error) {
      console.error('Error updating user role:', error)
      return { error: 'Error inesperado al actualizar rol' }
    }
  }, [supabase, user])

  // Funciones de verificación de permisos
  const checkPermission = useCallback((permission: string): boolean => {
    if (!user?.role) return false
    return hasEffectivePermission(user.role, permission, user.permissions)
  }, [user?.role, user?.permissions])

  const checkCanManageUser = useCallback((targetRole: UserRole): boolean => {
    if (!user?.role) return false
    return canManageUser(user.role, targetRole)
  }, [user?.role])

  // Propiedades computadas
  const isActiveUser = user?.status !== 'inactive' && user?.status !== 'suspended'
  const isAdmin = Boolean(isActiveUser && (user?.role === 'admin' || user?.role === 'super_admin'))
  const isSuperAdmin = Boolean(isActiveUser && user?.role === 'super_admin')
  const isManager = Boolean(
    isActiveUser && (user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'vendedor')
  )

  // Auto-promocion a admin completamente deshabilitada.
  // Para promover un usuario a admin, usa la API /api/admin/set-role-by-email
  // o directamente en la base de datos de Supabase.

  // Efecto para manejar cambios de autenticación
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)

        if (session?.user) {
          try {
            const userProfile = await fetchUserProfile(session.user.id)
            setUser({
              ...session.user,
              role: userProfile.role,
              status: userProfile.status,
              permissions: userProfile.permissions,
              profile: userProfile.profile
            } as AuthUser)
          } catch {
            setUser({
              ...session.user,
              role: 'cliente' as UserRole,
              profile: {},
              permissions: []
            } as AuthUser)
          }
        } else {
          setUser(null)
        }
      } catch {
        // Silently handle session errors
      } finally {
        setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          setSession(session)

          if (session?.user) {
            try {
              const userProfile = await fetchUserProfile(session.user.id)
              setUser({
                ...session.user,
                role: userProfile.role,
                status: userProfile.status,
                permissions: userProfile.permissions,
                profile: userProfile.profile
              } as AuthUser)
            } catch {
              setUser({
                ...session.user,
                role: 'cliente' as UserRole,
                profile: {},
                permissions: []
              } as AuthUser)
            }
          } else {
            setUser(null)
          }
        } catch {
          if (session?.user) {
            setUser({
              ...session.user,
              role: 'cliente' as UserRole,
              profile: {},
              permissions: []
            } as AuthUser)
          } else {
            setUser(null)
          }
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchUserProfile, supabase])

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    updateUserRole,
    hasPermission: checkPermission,
    canManageUser: checkCanManageUser,
    isAdmin,
    isSuperAdmin,
    isManager,
    refreshUser
  }), [
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    updateUserRole,
    checkPermission,
    checkCanManageUser,
    isAdmin,
    isSuperAdmin,
    isManager,
    refreshUser
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook para requerir autenticación
export function useRequireAuth() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      // Redirigir a login si no está autenticado
      window.location.href = '/auth/login'
    }
  }, [user, loading])

  return { user, loading }
}

// Hook para verificar permisos específicos
export function usePermissions(requiredPermissions: string[]) {
  const { hasPermission } = useAuth()

  const permissions = requiredPermissions.reduce((acc, permission) => {
    acc[permission] = hasPermission(permission)
    return acc
  }, {} as Record<string, boolean>)

  const hasAllPermissions = requiredPermissions.every(permission =>
    hasPermission(permission)
  )

  const hasAnyPermission = requiredPermissions.some(permission =>
    hasPermission(permission)
  )

  return {
    permissions,
    hasAllPermissions,
    hasAnyPermission
  }
}
