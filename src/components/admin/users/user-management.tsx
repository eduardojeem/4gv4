'use client'

import { useState, useEffect } from 'react'
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
  AlertTriangle,
  Edit,
  Trash2,
  Mail,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { UserStatsCards } from './user-stats-cards'
import { UserAvatarUpload } from './user-avatar-upload'
import { UserActivityTimeline } from './user-activity-timeline'
import { UsersTable } from './users-table'
import { UsersFilters } from './users-filters'
import { UserDetailDialog } from './user-detail-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'

import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EditUserForm } from './EditUserForm'

export function UserManagement() {
  const router = useRouter()
  const { user, isAdmin, loading: authLoading } = useAuth()

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
    totalPages,
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

  // Permission groups are imported

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData(prev => {
      const currentPermissions = prev.permissions || []
      if (checked) {
        return { ...prev, permissions: [...currentPermissions, permissionId] }
      } else {
        return { ...prev, permissions: currentPermissions.filter(p => p !== permissionId) }
      }
    })
  }

  // Helper to check if permission is active (mocked for now, assumes role based defaults if empty)
  const isPermissionActive = (permissionId: string) => {
    return formData.permissions?.includes(permissionId)
  }

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

  // No need to calculate totalPages manually anymore, use the one from hook
  // const totalPages = Math.ceil(totalCount / pageSize)

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

  const handleUpdateSubmit = async () => {
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      const result = await updateUser(selectedUser.id, formData)
      if (result.success) {
        setIsEditDialogOpen(false)
        setSelectedUser(null)
        refreshUsers()
      } else {
        if (result.error) {
          toast.error(result.error)
        }
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
                onEdit={(user) => {
                  setSelectedUser(user)
                  setFormData({
                    name: user.name,
                    email: user.email,
                    phone: user.phone || '',
                    role: user.role,
                    department: user.department || '',
                    status: user.status,
                    notes: user.notes || '',
                    permissions: user.permissions || []
                  })
                  setIsEditDialogOpen(true)
                }}
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
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
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
              Nota: Para crear un usuario con acceso al sistema, es recomendable usar el proceso de invitación o registro.
              Esta acción solo creará el perfil en la base de datos.
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
                  onSubmit={async (values) => {
                    setIsSubmitting(true)
                    try {
                      const result = await updateUser(selectedUser.id, values)
                      if (result.success) {
                        setIsEditDialogOpen(false)
                        setSelectedUser(null)
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
      />
    </div>
  )
}
