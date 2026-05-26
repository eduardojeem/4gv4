'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react'
import { createClient as createSupabaseClient } from '../lib/supabase/client'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { UserRole, hasEffectivePermission, canManageUser } from '../lib/auth/roles-permissions'
import { normalizeRole } from '../lib/auth/role-utils'
import { useToast } from '../components/ui/use-toast'
import { logAuthEventClient } from '@/lib/auth-event-client'

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

const AUTH_SESSION_TIMEOUT_MS = 5000
const AUTH_PROFILE_TIMEOUT_MS = 4000

const getDefaultAuthProfile = (): Partial<AuthUser> => ({
  role: toUserRole('cliente'),
  status: 'active',
  profile: {},
  permissions: []
})

const buildAuthUser = (
  sessionUser: SupabaseUser,
  userProfile: Partial<AuthUser> = getDefaultAuthProfile()
): AuthUser => ({
  ...sessionUser,
  role: userProfile.role ?? 'cliente',
  status: userProfile.status ?? 'active',
  permissions: userProfile.permissions ?? [],
  profile: userProfile.profile ?? {}
})

const toStoredAuthProfile = (authUser: AuthUser | null): Partial<AuthUser> | null => {
  if (!authUser) return null

  return {
    role: authUser.role,
    status: authUser.status,
    permissions: authUser.permissions ?? [],
    profile: authUser.profile ?? {},
  }
}

const isDefaultAuthProfile = (profile: Partial<AuthUser>): boolean => {
  const role = profile.role ?? 'cliente'
  const status = profile.status ?? 'active'
  const permissions = profile.permissions ?? []
  const profileFields = profile.profile ?? {}

  return role === 'cliente'
    && status === 'active'
    && permissions.length === 0
    && !profileFields.name
    && !profileFields.avatar_url
    && !profileFields.department
    && !profileFields.phone
    && !profileFields.location
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
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
  const latestUserRef = useRef<AuthUser | null>(null)

  const supabase = useMemo(() => createSupabaseClient(), [])

  useEffect(() => {
    latestUserRef.current = user
  }, [user])



  // Función para obtener el perfil del usuario y sus permisos
  const fetchUserProfile = useCallback(async (userId: string): Promise<Partial<AuthUser>> => {
    // Valores por defecto seguros
    const defaultProfile = getDefaultAuthProfile()

    try {
      if (!userId || typeof userId !== 'string') {
        return defaultProfile
      }

      if (!supabase) {
        return defaultProfile
      }

      const response = await withTimeout(
        fetch('/api/auth/profile', { cache: 'no-store' }),
        AUTH_PROFILE_TIMEOUT_MS,
        null
      )

      if (!response?.ok) {
        return defaultProfile
      }

      const profilePayload = await response.json() as {
        role?: unknown
        status?: unknown
        profile?: {
          name?: unknown
          avatar_url?: unknown
          phone?: unknown
        }
        permissions?: unknown
      }

      const resolvedRole = toUserRole(profilePayload.role)
      const resolvedStatus = toProfileStatus(profilePayload.status)
      const profileData = profilePayload.profile ?? {}
      const directPermissions = Array.isArray(profilePayload.permissions)
        ? profilePayload.permissions.filter((permission): permission is string => typeof permission === 'string' && permission.length > 0)
        : []

      return {
        role: resolvedRole,
        status: resolvedStatus,
        profile: {
          name: typeof profileData.name === 'string' ? profileData.name : '',
          avatar_url: typeof profileData.avatar_url === 'string' ? profileData.avatar_url : '',
          phone: typeof profileData.phone === 'string' ? profileData.phone : ''
        },
        permissions: Array.from(new Set(directPermissions))
      }
    } catch {
      return defaultProfile
    }
  }, [supabase])

  const resolveStableProfile = useCallback((sessionUser: SupabaseUser, profile: Partial<AuthUser>) => {
    const latestUser = latestUserRef.current
    const latestProfile = latestUser?.id === sessionUser.id ? toStoredAuthProfile(latestUser) : null

    if (latestProfile && isDefaultAuthProfile(profile)) {
      return latestProfile
    }

    return profile
  }, [])

  // Función para refrescar los datos del usuario
  const refreshUser = useCallback(async () => {
    if (!session?.user) return

    try {
      const userProfile = await withTimeout(
        fetchUserProfile(session.user.id),
        AUTH_PROFILE_TIMEOUT_MS,
        getDefaultAuthProfile()
      )
      setUser(buildAuthUser(session.user, resolveStableProfile(session.user, userProfile)))
    } catch (error) {
      console.error('Error refreshing user:', error)
      const fallbackProfile = resolveStableProfile(session.user, getDefaultAuthProfile())
      setUser(buildAuthUser(session.user, fallbackProfile))
    }
  }, [session, fetchUserProfile, resolveStableProfile])

  // Función para iniciar sesión
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        // La RPC requiere rol authenticated; en errores de login todavia no hay sesion valida.
        return { error: error.message }
      }

      if (data.user) {
        try {
          const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined
          await logAuthEventClient({
            userId: data.user.id,
            action: 'login',
            success: true,
            userAgent,
            details: { email, method: 'password' }
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
          await logAuthEventClient({
            userId: user.id,
            action: 'logout',
            success: true,
            userAgent,
            details: {}
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
    let isMounted = true

    const getSession = async () => {
      try {
        const nextSession = await withTimeout(
          supabase.auth
            .getSession()
            .then(({ data: { session } }) => session)
            .catch(() => null),
          AUTH_SESSION_TIMEOUT_MS,
          null
        )
        if (!isMounted) return

        setSession(nextSession)

        if (nextSession?.user) {
          const userProfile = await withTimeout(
            fetchUserProfile(nextSession.user.id),
            AUTH_PROFILE_TIMEOUT_MS,
            getDefaultAuthProfile()
          )
          if (!isMounted) return
          setUser(buildAuthUser(nextSession.user, resolveStableProfile(nextSession.user, userProfile)))
        } else {
          setUser(null)
        }
      } catch {
        if (!isMounted) return
        setSession(null)
        // Session retrieval failed — user will be set by onAuthStateChange if available
        setUser(null)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (!isMounted) return
        const nextUser = nextSession?.user

        try {
          setSession(nextSession)

          if (nextUser) {
            const userProfile = await withTimeout(
              fetchUserProfile(nextUser.id),
              AUTH_PROFILE_TIMEOUT_MS,
              getDefaultAuthProfile()
            )
            if (!isMounted) return
            setUser(buildAuthUser(nextUser, resolveStableProfile(nextUser, userProfile)))
          } else {
            setUser(null)
          }
        } catch {
          if (!isMounted) return
          if (nextUser) {
            const fallbackProfile = resolveStableProfile(nextUser, getDefaultAuthProfile())
            setUser(buildAuthUser(nextUser, fallbackProfile))
          } else {
            setUser(null)
          }
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchUserProfile, resolveStableProfile, supabase])

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
