'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUsersSupabase, SupabaseUser } from '@/hooks/use-users-supabase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  UserPlus,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Activity,
  Users,
  AlertTriangle
} from 'lucide-react'
import { UserStatsCards } from './user-stats-cards'
import { UserAvatarUpload } from './user-avatar-upload'
import { UserActivityTimeline } from './user-activity-timeline'
import { createClient } from '@/lib/supabase/client'
import { UsersTable } from './users-table'
import { UsersFilters } from './users-filters'
import { UserDetailDialog } from './user-detail-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { normalizeRole as normalizeAppRole } from '@/lib/auth/role-utils'
import { toast } from 'sonner'
import { EditUserForm } from './EditUserForm'

interface ProfileLookupRow {
  id: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  status?: string | null
  department?: string | null
  phone?: string | null
  avatar_url?: string | null
  updated_at?: string | null
  created_at?: string | null
  permissions?: string[] | null
}

export function UserManagement() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAdmin, isSuperAdmin, loading: authLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  // Estados de filtros y paginación
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('users')
  const requestedEditUserId = searchParams.get('editUser')

  const debouncedSearch = useDebounce(searchTerm, 500)

  // Hook de Supabase con paginación
  const {
    users,
    totalCount,
    stats,
    isLoading: dataLoading,
    refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    uploadAvatar,
    syncUsers
  } = useUsersSupabase({
    page,
    pageSize,
    search: debouncedSearch,
    roleFilter,
    statusFilter
  })

  // Security Check
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login')
      } else if (!isAdmin) {
        // Optional: Show toast or redirect to a specific 403 page
        // For now we render a message below
      }
    }
  }, [user, isAdmin, authLoading, router])

  // Estados de diálogos y selección
  const [selectedUser, setSelectedUser] = useState<SupabaseUser | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingEditPermissions, setIsLoadingEditPermissions] = useState(false)
  const [isUpdatingStatusFromDetail, setIsUpdatingStatusFromDetail] = useState(false)

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'cliente' as SupabaseUser['role'],
    department: '',
    status: 'active' as SupabaseUser['status'],
    notes: '',
    permissions: [] as string[]
  })

  const mapProfileToDialogUser = useCallback((profile: ProfileLookupRow): SupabaseUser => ({
    id: profile.id,
    name: profile.full_name || profile.email?.split('@')[0] || 'Usuario',
    email: profile.email || '',
    role: normalizeAppRole(profile.role) ?? 'cliente',
    status: profile.status === 'inactive' || profile.status === 'suspended' ? profile.status : 'active',
    department: profile.department || '',
    phone: profile.phone || '',
    avatar_url: profile.avatar_url,
    permissions: profile.permissions || [],
    lastLogin: profile.updated_at || new Date().toISOString(),
    createdAt: profile.created_at || new Date().toISOString(),
    loginAttempts: 0,
    lastActivity: profile.updated_at || new Date().toISOString(),
    notes: '',
  }), [])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, statusFilter])

  // Stats for cards (now coming from backend)
  const dashboardStats = {
    totalUsers: stats.total,
    activeUsers: stats.active,
    inactiveUsers: stats.inactive,
    adminsCount: stats.admins,
    newUsersThisMonth: stats.newThisMonth
  }

  const authGuard = authLoading ? (
    <div className="flex items-center justify-center h-[500px]">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  ) : null

  const accessDenied = !isAdmin ? (
      <div className="flex flex-col items-center justify-center h-[500px] text-center p-6">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Acceso Denegado</h2>
        <p className="text-gray-500 mt-2 max-w-md">
          No tienes permisos de administrador para ver esta sección. Por favor contacta al soporte si crees que esto es un error.
        </p>
        <Button className="mt-6" onClick={() => router.push('/dashboard')}>
          Volver al Dashboard
        </Button>
      </div>
    ) : null

  // Handlers
  const handleCreateSubmit = async () => {
    setIsSubmitting(true)
    try {
      const result = await createUser(formData)
      if (result.success) {
        setIsCreateDialogOpen(false)
        setFormData({
          name: '',
          email: '',
          phone: '',
          role: 'cliente',
          department: '',
          status: 'active',
          notes: '',
          permissions: []
        })
        refreshUsers()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      const result = await deleteUser(selectedUser.id)
      if (result.success) {
        setIsDeleteDialogOpen(false)
        setSelectedUser(null)
        refreshUsers()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!selectedUser) return { success: false, error: 'No user selected' }
    const result = await uploadAvatar(selectedUser.id, file)
    if (result.success) {
      refreshUsers()
    }
    return result
  }

  const openEditDialog = useCallback((targetUser: SupabaseUser) => {
    const merged = { ...targetUser, permissions: targetUser.permissions || [] }
    setSelectedUser(merged)
    setIsEditDialogOpen(true)
    setIsLoadingEditPermissions(true)

    void (async () => {
      let specificPerms: string[] = []
      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', targetUser.id)
          .eq('is_active', true)

        if (!error && data) {
          specificPerms = data.map((row) => row.permission as string)
        }
      } catch {
        specificPerms = []
      } finally {
        setIsLoadingEditPermissions(false)
      }

      setSelectedUser((current) => {
        if (!current || current.id !== targetUser.id) return current
        return {
          ...current,
          permissions: specificPerms.length > 0 ? specificPerms : current.permissions || [],
        }
      })
    })()
  }, [supabase])

  useEffect(() => {
    if (!requestedEditUserId || authLoading || dataLoading || !isAdmin) return

    let cancelled = false

    const clearRequestedEdit = () => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('editUser')
      const query = params.toString()
      router.replace(query ? `/admin/users?${query}` : '/admin/users')
    }

    const openRequestedUser = async () => {
      setActiveTab('users')

      const existingUser = users.find((item) => item.id === requestedEditUserId)
      if (existingUser) {
        openEditDialog(existingUser)
        clearRequestedEdit()
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, status, department, phone, avatar_url, updated_at, created_at')
        .eq('id', requestedEditUserId)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        toast.error('No se pudo abrir el usuario solicitado para edicion')
        clearRequestedEdit()
        return
      }

      openEditDialog(mapProfileToDialogUser(data))
      clearRequestedEdit()
    }

    void openRequestedUser()

    return () => {
      cancelled = true
    }
  }, [
    authLoading,
    dataLoading,
    isAdmin,
    mapProfileToDialogUser,
    openEditDialog,
    requestedEditUserId,
    router,
    searchParams,
    supabase,
    users,
  ])

  const handleSetStatusFromDetail = useCallback(async (
    targetUser: SupabaseUser,
    nextStatus: SupabaseUser['status'],
  ) => {
    if (targetUser.status === nextStatus) return
    if (targetUser.id === user?.id && nextStatus !== 'active') {
      toast.error('No puedes desactivar tu propia cuenta desde este modal')
      return
    }

    setIsUpdatingStatusFromDetail(true)
    try {
      const result = await updateUser(targetUser.id, { status: nextStatus })
      if (!result.success) {
        toast.error(result.error || 'No se pudo actualizar el estado del usuario')
        return
      }

      setSelectedUser((current) => {
        if (!current || current.id !== targetUser.id) return current
        return { ...current, status: nextStatus }
      })

      toast.success(nextStatus === 'active' ? 'Usuario reactivado correctamente' : 'Usuario desactivado correctamente')
      refreshUsers()
    } finally {
      setIsUpdatingStatusFromDetail(false)
    }
  }, [refreshUsers, updateUser, user?.id])

  if (authGuard) return authGuard
  if (accessDenied) return accessDenied

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Usuarios</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} usuarios registrados · {stats.active} activos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => syncUsers()} disabled={dataLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${dataLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <UserStatsCards stats={dashboardStats} isLoading={dataLoading} />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="users" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Actividad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UsersFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />

          <Card className="border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <UsersTable
                users={users}
                isLoading={dataLoading}
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onEdit={openEditDialog}
                onDelete={(user) => {
                  setSelectedUser(user)
                  setIsDeleteDialogOpen(true)
                }}
                onView={(user) => {
                  setSelectedUser(user)
                  setIsViewDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="border shadow-sm">
            <CardContent className="p-6">
              <UserActivityTimeline />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="juan@ejemplo.com"
                  type="email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value as SupabaseUser['role'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin ? <SelectItem value="super_admin">Super Admin</SelectItem> : null}
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="tecnico">Técnico</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800 dark:bg-yellow-900/10 dark:border-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              Se crea la cuenta y sincroniza perfil/rol automáticamente.
              {(formData.role === 'vendedor' || formData.role === 'tecnico') && (
                <span className="block mt-1 text-xs">
                  Después de crear, editá el usuario para asignarle una sucursal.
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto px-6">
            {selectedUser && (
              <div className="grid gap-6 py-4">
                {isLoadingEditPermissions ? (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Cargando permisos especificos...
                  </div>
                ) : null}
                <div className="flex justify-center">
                  <UserAvatarUpload
                    userName={selectedUser.name}
                    currentAvatarUrl={selectedUser.avatar_url}
                    onUpload={handleAvatarUpload}
                  />
                </div>
                <EditUserForm
                  user={selectedUser}
                  isSubmitting={isSubmitting}
                  canAssignSuperAdmin={isSuperAdmin}
                  onSubmit={async (values) => {
                    setIsSubmitting(true)
                    try {
                      const result = await updateUser(selectedUser.id, values)
                      if (result.success) {
                        setIsEditDialogOpen(false)
                        setSelectedUser((current) => {
                          if (!current || current.id !== selectedUser.id) return current
                          return {
                            ...current,
                            ...values,
                          }
                        })
                        refreshUsers()
                      } else if (result.error) {
                        toast.error(result.error)
                      }
                    } finally {
                      setIsSubmitting(false)
                    }
                  }}
                  onCancel={() => setIsEditDialogOpen(false)}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Estás seguro?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-500">
            Esta acción marcará al usuario <strong>{selectedUser?.name}</strong> como inactivo.
            No podrá acceder al sistema hasta que sea reactivado.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desactivar Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <UserDetailDialog
        user={selectedUser}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        onEdit={openEditDialog}
        onDeactivate={(targetUser) => handleSetStatusFromDetail(targetUser, 'inactive')}
        onReactivate={(targetUser) => handleSetStatusFromDetail(targetUser, 'active')}
        isUpdatingStatus={isUpdatingStatusFromDetail}
        currentUserId={user?.id}
      />
    </div>
  )
}
