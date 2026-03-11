'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import { toast } from 'sonner'
import { EditUserForm } from './EditUserForm'

export function UserManagement() {
  const router = useRouter()
  const { user, isAdmin, isSuperAdmin, loading: authLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  // Estados de filtros y paginación
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('users')

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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
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
    )
  }

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestión de Usuarios</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Administra el acceso y roles del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncUsers()} disabled={dataLoading} title="Sincronizar con Auth">
            <RefreshCw className={`h-4 w-4 mr-2 ${dataLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-200 transition-all dark:hover:shadow-blue-900/30"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <UserStatsCards stats={dashboardStats} isLoading={dataLoading} />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-1 rounded-lg">
          <TabsTrigger value="users" className="data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-900/20 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400">
            <Users className="h-4 w-4 mr-2" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-900/20 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400">
            <Activity className="h-4 w-4 mr-2" />
            Actividad Reciente
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

          <Card className="border-0 shadow-lg dark:shadow-none overflow-hidden dark:bg-gray-800 dark:border dark:border-gray-700">
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
          <Card className="dark:bg-gray-800 dark:border-gray-700">
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
                  onValueChange={(v: any) => setFormData({ ...formData, role: v })}
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
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              Nota: Esta accion crea la cuenta en autenticacion y sincroniza perfil/rol automaticamente.
              Verifica email, rol y estado antes de confirmar.
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
