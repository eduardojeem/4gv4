import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from './use-admin-dashboard'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

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
    dateRange?: { from?: Date; to?: Date }
    lastLoginFilter?: string
}

interface UserStats {
    totalUsers: number
    activeUsers: number
    inactiveUsers: number
    adminsCount: number
    newUsersThisMonth: number
}

export function useUsersOptimized({
    page = 1,
    pageSize = 10,
    search = '',
    roleFilter = 'all',
    statusFilter = 'all',
    dateRange,
    lastLoginFilter = 'all'
}: UseUsersOptions = {}) {
    const [users, setUsers] = useState<SupabaseUser[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [stats, setStats] = useState<UserStats>({
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        adminsCount: 0,
        newUsersThisMonth: 0
    })
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

    const { user } = useAuth()
    const supabase = createClient()

    // Fetch global stats using RPC function
    const fetchStats = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_user_stats')
            
            if (error) {
                console.warn('Stats RPC not available, using fallback')
                return
            }

            if (data) {
                setStats({
                    totalUsers: data.totalUsers || 0,
                    activeUsers: data.activeUsers || 0,
                    inactiveUsers: data.inactiveUsers || 0,
                    adminsCount: data.adminsCount || 0,
                    newUsersThisMonth: data.newUsersThisMonth || 0
                })
            }
        } catch (err) {
            console.error('Error fetching stats:', err)
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

            // Apply search filter (multiple fields)
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,department.ilike.%${search}%`)
            }

            // Apply role filter
            if (roleFilter && roleFilter !== 'all') {
                query = query.eq('role', roleFilter)
            }

            // Apply status filter
            if (statusFilter && statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }

            // Apply date range filter
            if (dateRange?.from) {
                query = query.gte('created_at', dateRange.from.toISOString())
            }
            if (dateRange?.to) {
                query = query.lte('created_at', dateRange.to.toISOString())
            }

            // Apply last login filter
            if (lastLoginFilter && lastLoginFilter !== 'all') {
                const now = new Date()
                switch (lastLoginFilter) {
                    case 'today':
                        query = query.gte('updated_at', new Date(now.setHours(0, 0, 0, 0)).toISOString())
                        break
                    case 'week':
                        query = query.gte('updated_at', new Date(now.setDate(now.getDate() - 7)).toISOString())
                        break
                    case 'month':
                        query = query.gte('updated_at', new Date(now.setMonth(now.getMonth() - 1)).toISOString())
                        break
                    case 'never':
                        query = query.is('updated_at', null)
                        break
                }
            }

            // Apply pagination
            const from = (page - 1) * pageSize
            const to = from + pageSize - 1
            query = query.range(from, to)

            const { data: profiles, count, error: profilesError } = await query

            if (profilesError) throw profilesError

            setTotalCount(count || 0)

            // Map to User structure
            const mappedUsers: SupabaseUser[] = (profiles || []).map(profile => ({
                id: profile.id,
                name: profile.full_name || profile.email?.split('@')[0] || 'Usuario',
                email: profile.email || '',
                role: profile.role || 'cliente',
                status: profile.status || 'active',
                department: profile.department || '',
                phone: profile.phone || '',
                avatar_url: profile.avatar_url,
                permissions: [],
                lastLogin: profile.updated_at || new Date().toISOString(),
                createdAt: profile.created_at || new Date().toISOString(),
                loginAttempts: 0,
                lastActivity: profile.updated_at || new Date().toISOString(),
                notes: profile.notes || ''
            }))

            setUsers(mappedUsers)
            setLastUpdate(new Date())
        } catch (err: unknown) {
            console.error('Error fetching users:', err)
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
            setError(errorMessage)
            toast.error('Error al cargar usuarios')
        } finally {
            setIsLoading(false)
        }
    }, [page, pageSize, search, roleFilter, statusFilter, dateRange, lastLoginFilter, supabase])

    // Optimized real-time subscription with debounce
    useEffect(() => {
        fetchUsers()
        fetchStats()

        let debounceTimer: NodeJS.Timeout

        const channel = supabase
            .channel('profiles-changes-optimized')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles'
                },
                (payload) => {
                    console.log('Realtime update:', payload)
                    
                    // Debounce updates to avoid excessive refreshes
                    clearTimeout(debounceTimer)
                    debounceTimer = setTimeout(() => {
                        // Only update if the change affects current view
                        const shouldUpdate = 
                            !roleFilter || roleFilter === 'all' || 
                            (payload.new as any)?.role === roleFilter
                        
                        if (shouldUpdate) {
                            fetchUsers()
                            fetchStats()
                        }
                    }, 1000) // 1 second debounce
                }
            )
            .subscribe()

        return () => {
            clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [fetchUsers, fetchStats, supabase, roleFilter])

    const createUser = async (userData: Partial<SupabaseUser>) => {
        try {
            // Validate unique email
            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', userData.email)
                .single()

            if (existing) {
                toast.error('Ya existe un usuario con ese email')
                return { success: false, error: 'Email duplicado' }
            }

            // Use import API to create real user
            const response = await fetch('/api/admin/users/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    users: [{
                        name: userData.name,
                        email: userData.email,
                        role: userData.role,
                        status: userData.status || 'active'
                    }]
                })
            })

            const result = await response.json()

            if (result.ok && result.imported > 0) {
                toast.success('Usuario creado exitosamente')
                
                // Log audit event
                await supabase.rpc('log_data_event', {
                    p_user_id: user?.id,
                    p_action: 'create',
                    p_resource: 'user',
                    p_resource_id: null,
                    p_new_values: userData
                }).catch(console.error)

                fetchUsers()
                fetchStats()
                return { success: true }
            } else {
                const errorMsg = result.results?.[0]?.error || 'Error al crear usuario'
                toast.error(errorMsg)
                return { success: false, error: errorMsg }
            }
        } catch (err: unknown) {
            console.error('Error creating user:', err)
            const errorMessage = err instanceof Error ? err.message : 'Error al crear usuario'
            toast.error(errorMessage)
            return { success: false, error: errorMessage }
        }
    }

    const updateUser = async (userId: string, userData: Partial<SupabaseUser>) => {
        try {
            // Get old values for audit
            const { data: oldData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: userData.name,
                    role: userData.role,
                    department: userData.department,
                    phone: userData.phone,
                    status: userData.status,
                    avatar_url: userData.avatar_url,
                    notes: userData.notes
                })
                .eq('id', userId)

            if (error) throw error

            // Log audit event
            await supabase.rpc('log_data_event', {
                p_user_id: user?.id,
                p_action: 'update',
                p_resource: 'user',
                p_resource_id: userId,
                p_old_values: oldData,
                p_new_values: userData
            }).catch(console.error)

            toast.success('Usuario actualizado correctamente')
            fetchUsers()
            fetchStats()
            return { success: true }
        } catch (err: unknown) {
            console.error('Error updating user:', err)
            toast.error('Error al actualizar usuario')
            const errorMessage = err instanceof Error ? err.message : 'Error al actualizar usuario'
            return { success: false, error: errorMessage }
        }
    }

    const deleteUser = async (userId: string) => {
        try {
            // Prevent self-deletion
            if (userId === user?.id) {
                toast.error('No puedes eliminar tu propio usuario')
                return { success: false, error: 'Auto-eliminación no permitida' }
            }

            const { error } = await supabase
                .from('profiles')
                .update({ status: 'inactive' })
                .eq('id', userId)

            if (error) throw error

            // Log audit event
            await supabase.rpc('log_data_event', {
                p_user_id: user?.id,
                p_action: 'delete',
                p_resource: 'user',
                p_resource_id: userId,
                p_new_values: { status: 'inactive' }
            }).catch(console.error)

            toast.success('Usuario desactivado correctamente')
            fetchUsers()
            fetchStats()
            return { success: true }
        } catch (err: unknown) {
            console.error('Error deleting user:', err)
            toast.error('Error al eliminar usuario')
            const errorMessage = err instanceof Error ? err.message : 'Error al eliminar usuario'
            return { success: false, error: errorMessage }
        }
    }

    const reactivateUser = async (userId: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ status: 'active' })
                .eq('id', userId)

            if (error) throw error

            // Log audit event
            await supabase.rpc('log_data_event', {
                p_user_id: user?.id,
                p_action: 'reactivate',
                p_resource: 'user',
                p_resource_id: userId,
                p_new_values: { status: 'active' }
            }).catch(console.error)

            toast.success('Usuario reactivado correctamente')
            fetchUsers()
            fetchStats()
            return { success: true }
        } catch (err: unknown) {
            console.error('Error reactivating user:', err)
            toast.error('Error al reactivar usuario')
            const errorMessage = err instanceof Error ? err.message : 'Error al reactivar usuario'
            return { success: false, error: errorMessage }
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
            console.error('Error uploading avatar:', err)
            toast.error('Error al subir imagen')
            const errorMessage = err instanceof Error ? err.message : 'Error al subir imagen'
            return { success: false, error: errorMessage }
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
            await fetchStats()
            return { success: true }
        } catch (err: unknown) {
            console.error('Error syncing users:', err)
            toast.error('Error al sincronizar usuarios')
            const errorMessage = err instanceof Error ? err.message : 'Error al sincronizar usuarios'
            return { success: false, error: errorMessage }
        } finally {
            setIsLoading(false)
        }
    }

    const exportUsers = useCallback(() => {
        const csv = [
            ['Nombre', 'Email', 'Rol', 'Estado', 'Departamento', 'Teléfono', 'Fecha Creación', 'Último Acceso'],
            ...users.map(u => [
                u.name,
                u.email,
                u.role,
                u.status,
                u.department || '',
                u.phone || '',
                new Date(u.createdAt).toLocaleDateString(),
                u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Nunca'
            ])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `usuarios-${new Date().toISOString().split('T')[0]}.csv`
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success('Usuarios exportados correctamente')
    }, [users])

    return {
        users,
        totalCount,
        stats,
        isLoading,
        error,
        lastUpdate,
        refreshUsers: fetchUsers,
        createUser,
        updateUser,
        deleteUser,
        reactivateUser,
        uploadAvatar,
        syncUsers,
        exportUsers
    }
}
