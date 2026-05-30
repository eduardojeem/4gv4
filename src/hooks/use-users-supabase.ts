import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from './use-admin-dashboard'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

export interface SupabaseUser extends User {
  avatar_url?: string
  updated_at?: string
  organizations?: Array<{
    id: string
    name: string
    slug?: string | null
    role?: string | null
    status?: string | null
  }>
}

interface UseUsersOptions {
  page?: number
  pageSize?: number
  search?: string
  roleFilter?: string
  statusFilter?: string
}

type ProfileStatus = 'active' | 'inactive' | 'suspended'

type CanonicalRole = 'super_admin' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'
type SerializableError = {
  message?: string
  name?: string
  code?: string
  details?: string
  hint?: string
  status?: number
  stack?: string
}

type ApiUserProfile = {
  id: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  status?: string | null
  department?: string | null
  phone?: string | null
  avatar_url?: string | null
  permissions?: string[] | null
  organizations?: SupabaseUser['organizations']
  updated_at?: string | null
  created_at?: string | null
}

const DEFAULT_ROLE: CanonicalRole = 'cliente'
const DEFAULT_STATUS: ProfileStatus = 'active'

function normalizeRole(role: unknown): CanonicalRole {
  if (typeof role !== 'string') return DEFAULT_ROLE
  const value = role.trim().toLowerCase()

  if (value === 'super_admin' || value === 'admin' || value === 'vendedor' || value === 'tecnico' || value === 'cliente') {
    return value
  }

  if (value === 'supervisor' || value === 'manager' || value === 'employee') {
    return 'vendedor'
  }

  if (value === 'technician') {
    return 'tecnico'
  }

  return DEFAULT_ROLE
}

function normalizeStatus(status: unknown): ProfileStatus {
  if (status === 'active' || status === 'inactive' || status === 'suspended') {
    return status
  }
  return DEFAULT_STATUS
}

const serializeError = (err: unknown) => {
  if (err && typeof err === 'object') {
    const e = err as SerializableError
    return {
      message: e?.message,
      name: e?.name,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
      status: e?.status,
      stack: e?.stack,
    }
  }
  return { message: String(err) }
}

const errorMessage = (err: unknown) => {
  const e = serializeError(err)
  return e.message || 'Error desconocido'
}

export function useUsersSupabase({
  page = 1,
  pageSize = 10,
  search = '',
  roleFilter = 'all',
  statusFilter = 'all',
}: UseUsersOptions = {}) {
  const [users, setUsers] = useState<SupabaseUser[]>([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    newThisMonth: 0,
  })
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { isSuperAdmin } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const mapProfileToUser = (profile: ApiUserProfile): SupabaseUser => ({
    id: profile.id,
    name: profile.full_name || profile.email?.split('@')[0] || 'Usuario',
    email: profile.email || '',
    role: normalizeRole(profile.role),
    status: normalizeStatus(profile.status),
    department: profile.department || '',
    phone: profile.phone || '',
    avatar_url: profile.avatar_url,
    permissions: profile.permissions || [],
    organizations: profile.organizations || [],
    lastLogin: profile.updated_at || new Date().toISOString(),
    createdAt: profile.created_at || new Date().toISOString(),
    loginAttempts: 0,
    lastActivity: profile.updated_at || new Date().toISOString(),
    notes: '',
  })

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        role: roleFilter || 'all',
        status: statusFilter || 'all',
      })

      if (search.trim()) {
        params.set('search', search.trim())
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`)
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudieron cargar los usuarios')
      }

      setTotalCount(payload.count || 0)
      setStats({
        total: payload.stats?.total || 0,
        active: payload.stats?.active || 0,
        inactive: payload.stats?.inactive || 0,
        admins: payload.stats?.admins || 0,
        newThisMonth: payload.stats?.newThisMonth || 0,
      })
      setUsers((payload.data || []).map(mapProfileToUser))
    } catch (err: unknown) {
      console.error('Error fetching users:', serializeError(err))
      const msg = errorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, roleFilter, statusFilter])

  useEffect(() => {
    void fetchUsers()

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }
          debounceTimer = setTimeout(() => {
            void fetchUsers()
          }, 250)
        }
      )
      .subscribe()

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      supabase.removeChannel(channel)
    }
  }, [fetchUsers, supabase])

  const createUser = async (userData: Partial<SupabaseUser>) => {
    try {
      if (!userData.email || !userData.name) {
        throw new Error('Nombre y email son obligatorios')
      }

      const requestedRole = normalizeRole(userData.role)
      if (requestedRole === 'super_admin' && !isSuperAdmin) {
        throw new Error('Solo un super admin puede asignar el rol super_admin')
      }

      const response = await fetch('/api/admin/users/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: [
            {
              name: userData.name,
              email: userData.email,
              role: requestedRole,
              status: normalizeStatus(userData.status),
            },
          ],
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload?.ok || payload?.imported < 1) {
        const apiError = payload?.results?.[0]?.error || payload?.error || 'No se pudo crear el usuario'
        throw new Error(apiError)
      }

      toast.success('Usuario creado correctamente')
      await fetchUsers()
      return { success: true }
    } catch (err: unknown) {
      console.error('Error creating user:', serializeError(err))
      const msg = errorMessage(err)
      toast.error(msg)
      return { success: false, error: msg }
    }
  }

  const updateUser = async (userId: string, userData: Partial<SupabaseUser>) => {
    try {
      if (normalizeRole(userData.role) === 'super_admin' && !isSuperAdmin) {
        throw new Error('Solo un super admin puede asignar el rol super_admin')
      }

      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, ...userData }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo actualizar el usuario')
      }

      toast.success('Usuario actualizado correctamente')

      if (payload.data) {
        const mapped = mapProfileToUser(payload.data)
        setUsers((prev) => prev.map((user) => (user.id === userId ? mapped : user)))
      } else {
        await fetchUsers()
      }

      return { success: true }
    } catch (err: unknown) {
      console.error('Error updating user:', serializeError(err))
      const msg = errorMessage(err)
      return { success: false, error: msg }
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo desactivar el usuario')
      }

      toast.success('Usuario desactivado correctamente')
      await fetchUsers()
      return { success: true }
    } catch (err: unknown) {
      console.error('Error deleting user:', serializeError(err))
      const msg = errorMessage(err)
      toast.error(msg)
      return { success: false, error: msg }
    }
  }

  const uploadAvatar = async (userId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${userId}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath)

      await updateUser(userId, { avatar_url: publicUrl })

      return { success: true, url: publicUrl }
    } catch (err: unknown) {
      console.error('Error uploading avatar:', serializeError(err))
      const msg = errorMessage(err)
      toast.error(msg)
      return { success: false, error: msg }
    }
  }

  const syncUsers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/users/sync', { method: 'POST' })
      const data = await response.json()

      if (!data.success) throw new Error(data.error)

      toast.success(data.message)
      await fetchUsers()
      return { success: true }
    } catch (err: unknown) {
      console.error('Error syncing users:', serializeError(err))
      const msg = errorMessage(err)
      toast.error(msg)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    users,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    stats,
    isLoading,
    error,
    refreshUsers: fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    uploadAvatar,
    syncUsers,
  }
}
