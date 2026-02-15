import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from './use-admin-dashboard'
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

export function useUsersSupabase({
    page = 1,
    pageSize = 10,
    search = '',
    roleFilter = 'all',
    statusFilter = 'all'
}: UseUsersOptions = {}) {
    const [users, setUsers] = useState<SupabaseUser[]>([])
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        admins: 0,
        newThisMonth: 0
    })
    const [totalCount, setTotalCount] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    const mapProfileToUser = (profile: any): SupabaseUser => ({
        id: profile.id,
        name: profile.full_name || profile.email?.split('@')[0] || 'Usuario',
        email: profile.email || '',
        role: profile.role || 'cliente',
        status: profile.status || 'active',
        department: profile.department || '',
        phone: profile.phone || '',
        avatar_url: profile.avatar_url,
        permissions: profile.permissions || [],
        lastLogin: profile.updated_at || new Date().toISOString(),
        createdAt: profile.created_at || new Date().toISOString(),
        loginAttempts: 0,
        lastActivity: profile.updated_at || new Date().toISOString(),
        notes: ''
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
                stack: e?.stack
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
            // Run parallel count queries
            const [
                { count: total },
                { count: active },
                { count: inactive },
                { count: admins },
                { count: newThisMonth }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
                supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
            ])

            setStats({
                total: total || 0,
                active: active || 0,
                inactive: inactive || 0,
                admins: admins || 0,
                newThisMonth: newThisMonth || 0
            })
        } catch (error) {
            console.error('Error fetching user stats:', error)
        }
    }, [supabase])

    const fetchUsers = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)
            
            // Fetch stats alongside users
            fetchStats()

            let query = supabase
                .from('profiles')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })

            // Apply filters
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
            }

            if (roleFilter && roleFilter !== 'all') {
                query = query.eq('role', roleFilter)
            }

            if (statusFilter && statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }

            // Apply pagination
            const from = (page - 1) * pageSize
            const to = from + pageSize - 1
            query = query.range(from, to)

            const { data: profiles, count, error: profilesError } = await query

            if (profilesError) throw profilesError

            setTotalCount(count || 0)

            const mappedUsers: SupabaseUser[] = profiles.map(mapProfileToUser)

            setUsers(mappedUsers)
        } catch (err: unknown) {
            console.error('Error fetching users:', serializeError(err))
            const msg = errorMessage(err)
            setError(msg)
            toast.error(msg)
        } finally {
            setIsLoading(false)
        }
    }, [page, pageSize, search, roleFilter, statusFilter, supabase])

    // Suscripción a cambios en tiempo real
    useEffect(() => {
        fetchUsers()

        const channel = supabase
            .channel('profiles-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles'
                },
                (payload) => {
                    console.log('Realtime update:', payload)
                    fetchUsers()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchUsers, supabase])

    const createUser = async (userData: Partial<SupabaseUser>) => {
        try {
            throw new Error('Para crear usuarios, use el módulo de registro o invitación')
        } catch (err: unknown) {
            console.error('Error creating user:', err)
            const errorMessage = err instanceof Error ? err.message : 'Error al crear usuario'
            toast.error(errorMessage)
            return { success: false, error: errorMessage }
        }
    }

    const updateUser = async (userId: string, userData: Partial<SupabaseUser>) => {
        try {
            const { data: updated, error } = await supabase
                .from('profiles')
                .update({
                    full_name: userData.name,
                    role: userData.role,
                    department: userData.department,
                    phone: userData.phone,
                    status: userData.status,
                    avatar_url: userData.avatar_url,
                    permissions: userData.permissions
                })
                .eq('id', userId)
                .select('*')
                .single()

            if (error) throw new Error(error.message)

            toast.success('Usuario actualizado correctamente')
            if (updated) {
                const mapped = mapProfileToUser(updated)
                setUsers(prev => prev.map(u => (u.id === userId ? mapped : u)))
            } else {
                fetchUsers()
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
            const { error } = await supabase
                .from('profiles')
                .update({ status: 'inactive' })
                .eq('id', userId)

            if (error) throw error

            toast.success('Usuario desactivado correctamente')
            fetchUsers()
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

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

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
        totalPages: Math.ceil(totalCount / pageSize),
        stats,
        isLoading,
        error,
        refreshUsers: fetchUsers,
        createUser,
        updateUser,
        deleteUser,
        uploadAvatar,
        syncUsers
    }
}
