import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from './use-admin-dashboard'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

export interface SupabaseUser extends User {
  avatar_url?: string
  updated_at?: string
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

const DEFAULT_ROLE: CanonicalRole = 'cliente'
const DEFAULT_STATUS: ProfileStatus = 'active'

const ROLE_WRITE_CANDIDATES: Record<CanonicalRole, string[]> = {
  super_admin: ['super_admin'],
  admin: ['admin'],
  vendedor: ['vendedor'],
  tecnico: ['tecnico'],
  cliente: ['cliente'],
}

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

function isRoleConstraintViolation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23514') return true
  const message = (error.message || '').toLowerCase()
  return message.includes('user_roles_role_check') || message.includes('violates check constraint')
}

function getRoleWriteCandidates(role: unknown): CanonicalRole[] {
  if (typeof role !== 'string' || role.trim().length === 0) {
    return ROLE_WRITE_CANDIDATES[DEFAULT_ROLE]
  }

  const canonical = normalizeRole(role)
  return Array.from(new Set(ROLE_WRITE_CANDIDATES[canonical]))
}

async function upsertUserRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  role: CanonicalRole,
  isActive: boolean
) {
  const { error: roleSyncError } = await supabase.from('user_roles').upsert(
    {
      user_id: userId,
      role,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (roleSyncError) {
    throw roleSyncError
  }
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

  const mapProfileToUser = (profile: any): SupabaseUser => ({
    id: profile.id,
    name: profile.full_name || profile.email?.split('@')[0] || 'Usuario',
    email: profile.email || '',
    role: normalizeRole(profile.role),
    status: normalizeStatus(profile.status),
    department: profile.department || '',
    phone: profile.phone || '',
    avatar_url: profile.avatar_url,
    permissions: profile.permissions || [],
    lastLogin: profile.updated_at || new Date().toISOString(),
    createdAt: profile.created_at || new Date().toISOString(),
    loginAttempts: 0,
    lastActivity: profile.updated_at || new Date().toISOString(),
    notes: '',
  })

  const serializeError = (err: unknown) => {
    if (err && typeof err === 'object') {
      const e = err as any
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

  const fetchStats = useCallback(async () => {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [
        { count: total },
        { count: active },
        { count: inactive },
        { count: admins },
        { count: newThisMonth },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .in('role', ['admin', 'super_admin']),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth),
      ])

      setStats({
        total: total || 0,
        active: active || 0,
        inactive: inactive || 0,
        admins: admins || 0,
        newThisMonth: newThisMonth || 0,
      })
    } catch (err) {
      console.error('Error fetching user stats:', serializeError(err))
    }
  }, [supabase])

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
      }

      if (roleFilter && roleFilter !== 'all') {
        const normalizedRoleFilter = normalizeRole(roleFilter)
        query = query.eq('role', normalizedRoleFilter)
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', normalizeStatus(statusFilter))
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const [{ data: profiles, count, error: profilesError }] = await Promise.all([
        query,
        fetchStats(),
      ])

      if (profilesError) throw profilesError

      setTotalCount(count || 0)
      setUsers((profiles || []).map(mapProfileToUser))
    } catch (err: unknown) {
      console.error('Error fetching users:', serializeError(err))
      const msg = errorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, roleFilter, statusFilter, supabase, fetchStats])

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
      const [
        { data: currentProfile, error: currentProfileError },
        { data: currentUserRole, error: currentUserRoleError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('role,status')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
      ])

      if (currentProfileError) {
        throw currentProfileError
      }
      if (currentUserRoleError) {
        throw currentUserRoleError
      }

      const profileUpdatePayload: Record<string, unknown> = {}

      if (typeof userData.name === 'string') profileUpdatePayload.full_name = userData.name
      if (typeof userData.role === 'string') profileUpdatePayload.role = normalizeRole(userData.role)
      if (typeof userData.department === 'string') profileUpdatePayload.department = userData.department
      if (typeof userData.phone === 'string') profileUpdatePayload.phone = userData.phone
      if (typeof userData.status === 'string') profileUpdatePayload.status = normalizeStatus(userData.status)
      if (typeof userData.avatar_url === 'string') profileUpdatePayload.avatar_url = userData.avatar_url
      if (Array.isArray(userData.permissions)) profileUpdatePayload.permissions = userData.permissions

      let updatedProfile: any = null

      if (Object.keys(profileUpdatePayload).length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .update(profileUpdatePayload)
          .eq('id', userId)
          .select('*')
          .single()

        if (error) {
          throw new Error(error.message)
        }

        updatedProfile = data
      }

      const mergedRole = normalizeRole(userData.role ?? currentProfile?.role)
      if (mergedRole === 'super_admin' && !isSuperAdmin) {
        throw new Error('Solo un super admin puede asignar el rol super_admin')
      }
      const mergedStatus = normalizeStatus(userData.status ?? currentProfile?.status)

      const shouldSyncRoleRow =
        typeof userData.role === 'string' ||
        typeof userData.status === 'string' ||
        !currentUserRole?.role

      if (shouldSyncRoleRow) {
        const normalizedCurrentRole = normalizeRole(currentUserRole?.role)
        const roleForSync =
          typeof userData.role === 'string'
            ? mergedRole
            : normalizedCurrentRole ?? mergedRole

        const roleCandidates = getRoleWriteCandidates(roleForSync)
        let synced = false
        let lastConstraintError = ''

        for (const roleCandidate of roleCandidates) {
          try {
            await upsertUserRole(supabase, userId, roleCandidate, mergedStatus === 'active')
            synced = true
            break
          } catch (roleSyncError: any) {
            if (isRoleConstraintViolation(roleSyncError)) {
              lastConstraintError = roleSyncError.message || 'Role constraint violation'
              continue
            }

            throw new Error(roleSyncError.message)
          }
        }

        if (!synced) {
          if (mergedRole === 'super_admin') {
            throw new Error(
              'La base de datos no permite super_admin en user_roles. Actualiza la constraint user_roles_role_check.'
            )
          }
          throw new Error(lastConstraintError || 'No se pudo sincronizar el rol del usuario')
        }
      }

      if (Array.isArray(userData.permissions)) {
        const { data: currentPermissions, error: currentPermissionsError } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', userId)
          .eq('is_active', true)

        if (currentPermissionsError) {
          throw new Error(currentPermissionsError.message)
        }

        const currentSet = new Set((currentPermissions || []).map((row) => row.permission as string))
        const nextSet = new Set(userData.permissions)

        const toInsert = Array.from(nextSet).filter((permission) => !currentSet.has(permission))
        const toDelete = Array.from(currentSet).filter((permission) => !nextSet.has(permission))

        if (toInsert.length > 0) {
          const rows = toInsert.map((permission) => ({ user_id: userId, permission, is_active: true }))
          const { error: insertError } = await supabase.from('user_permissions').insert(rows)
          if (insertError) throw new Error(insertError.message)
        }

        if (toDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('user_permissions')
            .delete()
            .eq('user_id', userId)
            .in('permission', toDelete)

          if (deleteError) throw new Error(deleteError.message)
        }
      }

      toast.success('Usuario actualizado correctamente')

      if (updatedProfile) {
        const mapped = mapProfileToUser(updatedProfile)
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
      const [
        { data: profile, error: profileReadError },
        { data: currentUserRole, error: currentUserRoleError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
      ])

      if (profileReadError) {
        throw profileReadError
      }
      if (currentUserRoleError) {
        throw currentUserRoleError
      }

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ status: 'inactive' })
        .eq('id', userId)

      if (profileUpdateError) {
        throw profileUpdateError
      }

      const normalizedCurrentRole = normalizeRole(currentUserRole?.role)
      const roleForSync = normalizedCurrentRole ?? normalizeRole(profile?.role)
      const roleCandidates = getRoleWriteCandidates(roleForSync)
      let synced = false
      let lastConstraintError = ''

      for (const roleCandidate of roleCandidates) {
        try {
          await upsertUserRole(supabase, userId, roleCandidate, false)
          synced = true
          break
        } catch (roleSyncError: any) {
          if (isRoleConstraintViolation(roleSyncError)) {
            lastConstraintError = roleSyncError.message || 'Role constraint violation'
            continue
          }

          throw roleSyncError
        }
      }

      if (!synced) {
        throw new Error(lastConstraintError || 'No se pudo sincronizar el estado del usuario')
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
