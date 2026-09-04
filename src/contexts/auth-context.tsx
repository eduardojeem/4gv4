'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react'
import { createClient as createSupabaseClient } from '../lib/supabase/client'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { UserRole, hasEffectivePermission, canManageUser } from '../lib/auth/roles-permissions'
import { normalizeRole } from '../lib/auth/role-utils'
import { toast } from 'sonner'
import { logAuthEventClient } from '@/lib/auth-event-client'

type ProfileStatus = 'active' | 'inactive' | 'suspended'

export type DeliveryLocation = {
  city?: string
  address?: string
  reference?: string
  full_address?: string
}

// Tipos para el contexto de autenticación
export interface AuthUser extends SupabaseUser {
  role?: UserRole
  status?: ProfileStatus
  permissions?: string[]
  organizationPermissions?: boolean
  profile?: {
    name?: string
    avatar_url?: string
    department?: string
    phone?: string
    location?: string
    delivery_location?: DeliveryLocation
  }
}

export interface AuthContextType {
  user: AuthUser | null
  /**
   * La sesion NO se expone.
   *
   * Supabase refresca el token al volver a una pestaña y eso cambiaba el objeto
   * de sesion, que estaba en el valor del contexto: cada vez que el usuario
   * volvia al navegador se re-renderizaban los 70 archivos que leen useAuth(),
   * incluida la grilla de productos. Ninguno leia `session` — se comprobo en
   * todo el proyecto: cero consumidores.
   *
   * Si alguna pantalla la necesita, conviene un contexto aparte antes que
   * devolverla aca: lo que se paga no es guardarla sino que su cambio arrastre
   * a todos los consumidores.
   */
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
  delivery_location?: DeliveryLocation
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

const isDeliveryLocation = (value: unknown): value is DeliveryLocation => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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
  organizationPermissions: userProfile.organizationPermissions ?? false,
  profile: userProfile.profile ?? {}
})

const toStoredAuthProfile = (authUser: AuthUser | null): Partial<AuthUser> | null => {
  if (!authUser) return null

  return {
    role: authUser.role,
    status: authUser.status,
    permissions: authUser.permissions ?? [],
    organizationPermissions: authUser.organizationPermissions ?? false,
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
    && !profileFields.delivery_location
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
  const latestUserRef = useRef<AuthUser | null>(null)
  // La sesion vive tambien en un ref para que `refreshUser` no cambie de
  // identidad con cada refresco de token: esta en las dependencias del valor del
  // contexto, asi que si cambia arrastra a todos los consumidores igual que
  // arrastraba el propio campo.
  const sessionRef = useRef<Session | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

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
          location?: unknown
          delivery_location?: unknown
        }
        permissions?: unknown
        organizationPermissions?: unknown
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
          phone: typeof profileData.phone === 'string' ? profileData.phone : '',
          location: typeof profileData.location === 'string' ? profileData.location : '',
          delivery_location: isDeliveryLocation(profileData.delivery_location) ? profileData.delivery_location : undefined,
        },
        permissions: Array.from(new Set(directPermissions)),
        organizationPermissions: profilePayload.organizationPermissions === true,
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
  // Lee la sesion del ref y no del estado: con `session` en las dependencias,
  // esta funcion cambiaba de identidad en cada refresco de token y arrastraba al
  // valor del contexto, que es lo que se queria dejar de mover.
  const refreshUser = useCallback(async () => {
    const sessionUser = sessionRef.current?.user
    if (!sessionUser) return

    try {
      const userProfile = await withTimeout(
        fetchUserProfile(sessionUser.id),
        AUTH_PROFILE_TIMEOUT_MS,
        getDefaultAuthProfile()
      )
      setUser(buildAuthUser(sessionUser, resolveStableProfile(sessionUser, userProfile)))
    } catch (error) {
      console.error('Error refreshing user:', error)
      const fallbackProfile = resolveStableProfile(sessionUser, getDefaultAuthProfile())
      setUser(buildAuthUser(sessionUser, fallbackProfile))
    }
  }, [fetchUserProfile, resolveStableProfile])

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

          // Register active session for session management UI
          if (data.session?.access_token) {
            const { getSessionIdFromAccessToken } = await import('@/lib/session-id')
            const sessionId = await getSessionIdFromAccessToken(data.session.access_token)
            if (sessionId) {
              const ua = typeof window !== 'undefined' ? window.navigator.userAgent : ''
              const isMobile = /Mobile|Android|iPhone/i.test(ua)
              const isTablet = /iPad|Tablet/i.test(ua)
              const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Brave|Opera)\/?\s*(\d+)/)?.[1] || 'Unknown'
              const os = ua.match(/(Windows|Mac OS|Linux|Android|iOS)/)?.[1] || 'Unknown'

              await supabase.from('user_sessions').upsert({
                user_id: data.user.id,
                session_id: sessionId,
                user_agent: ua,
                device_type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
                browser,
                os,
                is_active: true,
                last_activity: new Date().toISOString(),
              }, { onConflict: 'session_id' })
            }
          }
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
        toast.error('No se pudo cerrar sesión', {
          description: 'Intenta nuevamente.',
        })
      }
    } catch (error) {
      console.error('Error in signOut:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, user])

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
    if (user.organizationPermissions) {
      return Boolean(user.permissions?.includes(permission))
    }
    return hasEffectivePermission(user.role, permission, user.permissions)
  }, [user?.organizationPermissions, user?.permissions, user?.role])

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

          // Register/refresh current session for session management
          try {
            const { getSessionIdFromAccessToken } = await import('@/lib/session-id')
            const sessionId = await getSessionIdFromAccessToken(nextSession.access_token)
            if (sessionId) {
              const ua = typeof window !== 'undefined' ? window.navigator.userAgent : ''
              const isMobile = /Mobile|Android|iPhone/i.test(ua)
              const isTablet = /iPad|Tablet/i.test(ua)
              const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Brave|Opera)\/?\s*(\d+)/)?.[1] || 'Unknown'
              const os = ua.match(/(Windows|Mac OS|Linux|Android|iOS)/)?.[1] || 'Unknown'

              void (async () => {
                try {
                  await supabase.from('user_sessions').upsert({
                    user_id: nextSession.user.id,
                    session_id: sessionId,
                    user_agent: ua,
                    device_type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
                    browser,
                    os,
                    is_active: true,
                    last_activity: new Date().toISOString(),
                  }, { onConflict: 'session_id' })
                } catch {}
              })()
            }
          } catch {}
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
      async (event, nextSession) => {
        if (!isMounted) return

        // Flujo de recuperación de contraseña (enlace implícito con #access_token).
        // El SDK del navegador detecta la sesión en el hash y emite PASSWORD_RECOVERY;
        // llevamos al usuario al formulario sin importar en qué página haya caído.
        if (event === 'PASSWORD_RECOVERY' && typeof window !== 'undefined') {
          if (!window.location.pathname.startsWith('/auth/reset-password')) {
            window.location.replace('/auth/reset-password')
            return
          }
        }

        const nextUser = nextSession?.user

        // Supabase refresca el token solo al volver a una pestaña (el SDK
        // chequea visibilidad y refresca si corresponde), y eso dispara este
        // mismo evento con event === 'TOKEN_REFRESHED'. Si sigue siendo el
        // mismo usuario, no hay nada que recargar: antes esto pegaba a
        // /api/auth/profile y armaba un `user` nuevo en cada cambio de
        // pestaña, re-renderizando los 50+ componentes que leen useAuth()
        // solo por eso. Se actualiza igual el token (session sí cambió de
        // verdad), pero sin tocar perfil/rol/permisos, que no cambiaron.
        if (event === 'TOKEN_REFRESHED' && nextUser && latestUserRef.current?.id === nextUser.id) {
          setSession(nextSession)
          return
        }

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
      window.location.href = '/login'
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
