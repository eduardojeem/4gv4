'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUsersSupabase, SupabaseUser } from '@/hooks/use-users-supabase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
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
  UserX,
  Copy,
  CheckCircle2,
  Link2,
} from 'lucide-react'
import { UserStatsCards } from './user-stats-cards'
import { UserAvatarUpload } from './user-avatar-upload'
import { UserActivityTimeline } from './user-activity-timeline'
import { UsersTable } from './users-table'
import { UsersFilters } from './users-filters'
import { UserDetailDialog } from './user-detail-dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'
import { EditUserForm } from './EditUserForm'

// ── Simple email validation ───────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateCreateForm(data: { name: string; email: string }): string | null {
  if (!data.name.trim()) return 'El nombre es requerido'
  if (!data.email.trim()) return 'El email es requerido'
  if (!EMAIL_RE.test(data.email.trim())) return 'El formato del email no es válido'
  return null
}

type UserQuota = {
  allowed: boolean
  blocked: boolean
  overLimit: boolean
  expired: boolean
  enforcedSuspensions: number
  current: number
  limit: number | null
  plan?: {
    code?: string
    name?: string
  }
  message: string
}

export function UserManagement() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAdmin, isSuperAdmin, loading: authLoading } = useAuth()

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
    resendInvitation,
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
      }
    }
  }, [user, authLoading, router])

  // Estados de diálogos y selección
  const [selectedUser, setSelectedUser] = useState<SupabaseUser | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingEditPermissions, setIsLoadingEditPermissions] = useState(false)
  const [isUpdatingStatusFromDetail, setIsUpdatingStatusFromDetail] = useState(false)
  const [userQuota, setUserQuota] = useState<UserQuota | null>(null)
  const [isLoadingUserQuota, setIsLoadingUserQuota] = useState(false)
  // Invite link shown after user creation
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  // Delete error feedback
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Form Data (create dialog)
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
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({})

  const mapApiUserToDialogUser = useCallback((profile: Partial<SupabaseUser> & {
    id: string
    full_name?: string | null
    updated_at?: string | null
    created_at?: string | null
  }): SupabaseUser => ({
    id: profile.id,
    name: profile.name || profile.full_name || profile.email?.split('@')[0] || 'Usuario',
    email: profile.email || '',
    role: profile.role || 'cliente',
    status: profile.status === 'inactive' || profile.status === 'suspended' ? profile.status : 'active',
    department: profile.department || '',
    phone: profile.phone || '',
    avatar_url: profile.avatar_url,
    permissions: profile.permissions || [],
    lastLogin: profile.lastLogin ?? null,
    createdAt: profile.created_at || new Date().toISOString(),
    loginAttempts: 0,
    lastActivity: profile.updated_at || new Date().toISOString(),
    notes: profile.notes || '',
  }), [])

  const refreshUserQuota = useCallback(async () => {
    if (!isAdmin) return

    setIsLoadingUserQuota(true)
    try {
      let response = await fetch('/api/admin/users/quota', { cache: 'no-store' })
      let payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo verificar el plan actual')
      }

      if (payload.overLimit && !payload.blocked) {
        response = await fetch('/api/admin/users/quota', { method: 'POST', cache: 'no-store' })
        payload = await response.json().catch(() => ({}))

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'No se pudo regularizar el cupo del plan actual')
        }
      }

      setUserQuota({
        allowed: Boolean(payload.allowed),
        blocked: Boolean(payload.blocked),
        overLimit: Boolean(payload.overLimit),
        expired: Boolean(payload.expired),
        enforcedSuspensions: Number(payload.enforcedSuspensions ?? 0),
        current: Number(payload.current ?? 0),
        limit: payload.limit === null || typeof payload.limit === 'undefined' ? null : Number(payload.limit),
        plan: payload.plan,
        message: payload.message || 'Estado del plan verificado.',
      })

      const enforcedSuspensions = Number(payload.enforcedSuspensions ?? 0)
      if (enforcedSuspensions > 0) {
        toast.info(`Se suspendieron ${enforcedSuspensions} usuario(s) excedentes del cupo del plan.`)
        refreshUsers()
      }
    } catch (err: unknown) {
      console.error('Error fetching user quota:', err)
      setUserQuota(null)
    } finally {
      setIsLoadingUserQuota(false)
    }
  }, [isAdmin, refreshUsers])

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      void refreshUserQuota()
    }
  }, [authLoading, isAdmin, refreshUserQuota, user])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, statusFilter])

  useEffect(() => {
    if (!isSuperAdmin && (roleFilter === 'super_admin' || roleFilter === 'cliente')) {
      setRoleFilter('all')
    }
  }, [isSuperAdmin, roleFilter])

  // Stats for cards (coming from backend — over full unfiltered set)
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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const resetCreateForm = () => {
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
    setFormErrors({})
  }

  const handleCreateSubmit = async () => {
    const validationError = validateCreateForm(formData)
    if (validationError) {
      if (validationError.includes('nombre')) setFormErrors({ name: validationError })
      else if (validationError.includes('email') || validationError.includes('Email')) setFormErrors({ email: validationError })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createUser(formData)
      if (result.success) {
        setIsCreateDialogOpen(false)
        resetCreateForm()
        refreshUsers()
        refreshUserQuota()
        // Show invite link dialog if we have one
        if (result.invite_link) {
          setInviteLink(result.invite_link)
          setCopiedLink(false)
          setIsInviteDialogOpen(true)
        }
      } else {
        toast.error(result.error || 'No se pudo crear el usuario')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return
    setIsSubmitting(true)
    setDeleteError(null)
    try {
      const result = await deleteUser(selectedUser.id)
      if (result.success) {
        setIsDeleteDialogOpen(false)
        setSelectedUser(null)
        refreshUsers()
        refreshUserQuota()
      } else {
        // Show the error inside the dialog so the admin can read it
        setDeleteError(result.error || 'No se pudo desactivar el usuario')
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
    setIsLoadingEditPermissions(false)
  }, [])

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

      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(requestedEditUserId)}&pageSize=1`)
      const payload = await response.json().catch(() => ({}))

      if (cancelled) return

      const apiUser = payload?.data?.[0]
      if (!response.ok || !payload?.success || !apiUser) {
        toast.error('No se pudo abrir el usuario solicitado para edicion')
        clearRequestedEdit()
        return
      }

      openEditDialog(mapApiUserToDialogUser(apiUser))
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
    mapApiUserToDialogUser,
    openEditDialog,
    requestedEditUserId,
    router,
    searchParams,
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
        toast.warning(result.error || 'No se pudo actualizar el estado del usuario')
        return
      }

      setSelectedUser((current) => {
        if (!current || current.id !== targetUser.id) return current
        return { ...current, status: nextStatus }
      })

      toast.success(nextStatus === 'active' ? 'Usuario reactivado correctamente' : 'Usuario desactivado correctamente')
      refreshUsers()
      refreshUserQuota()
    } finally {
      setIsUpdatingStatusFromDetail(false)
    }
  }, [refreshUserQuota, refreshUsers, updateUser, user?.id])

  if (authGuard) return authGuard
  if (accessDenied) return accessDenied

  const canCreateUsers = !userQuota || userQuota.allowed
  const quotaLimitLabel = userQuota?.limit === null ? 'ilimitado' : userQuota?.limit
  const showQuotaNotice = Boolean(userQuota && (userQuota.expired || !userQuota.allowed || !isSuperAdmin))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} usuarios registrados ·{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.active} activos</span>
            {stats.inactive > 0 && (
              <> · <span className="text-rose-500 dark:text-rose-400">{stats.inactive} inactivos</span></>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await syncUsers()
              await refreshUserQuota()
            }}
            disabled={dataLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${dataLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!canCreateUsers) {
                toast.error(userQuota?.message || 'No se puede agregar usuarios con el plan actual')
                return
              }
              setIsCreateDialogOpen(true)
            }}
            disabled={isLoadingUserQuota || !canCreateUsers}
            title={!canCreateUsers ? userQuota?.message : undefined}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {showQuotaNotice ? (
        <div
          className={`flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${
            userQuota?.blocked || !userQuota?.allowed
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
          }`}
        >
          <div>
            <p className="font-medium">
              {userQuota?.plan?.name ? `Plan ${userQuota.plan.name}` : 'Plan actual'}
            </p>
            <p className="text-xs opacity-90">
              {userQuota?.message}
              {userQuota && userQuota.allowed && !userQuota.blocked
                ? ` Cupo: ${userQuota.current}/${quotaLimitLabel}.`
                : null}
            </p>
          </div>
          {(userQuota?.blocked || !userQuota?.allowed) && !isSuperAdmin ? (
            <div className="flex flex-wrap gap-2">
              {userQuota?.overLimit ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActiveTab('users')
                    setStatusFilter('active')
                    setRoleFilter('all')
                  }}
                >
                  Ver usuarios activos
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => router.push('/admin/subscriptions')}>
                Ver planes
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

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
            showGlobalRoles={isSuperAdmin}
          />

          <Card className="border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <UsersTable
                users={users}
                isLoading={dataLoading}
                showOrganization={isSuperAdmin}
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

      {/* ── Create Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetCreateForm() }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Crear Nuevo Usuario
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-name">
                  Nombre completo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }))
                  }}
                  placeholder="Juan Pérez"
                  className={formErrors.name ? 'border-red-400 focus-visible:ring-red-400' : ''}
                />
                {formErrors.name && (
                  <p className="text-xs text-red-500">{formErrors.name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value })
                    if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }))
                  }}
                  placeholder="juan@empresa.com"
                  type="email"
                  className={formErrors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}
                />
                {formErrors.email && (
                  <p className="text-xs text-red-500">{formErrors.email}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label htmlFor="create-dept">Departamento</Label>
                <Input
                  id="create-dept"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Ej: Ventas"
                />
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2 dark:bg-amber-900/10 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <p>Se creará la cuenta y sincronizará perfil/rol automáticamente.</p>
                {(formData.role === 'vendedor' || formData.role === 'tecnico') && (
                  <p className="mt-1 font-medium">Después de crear, editá el usuario para asignarle una sucursal.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Crear Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) setSelectedUser(null)
      }}>
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

      {/* ── Delete / Deactivate Dialog ────────────────────────────────────── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <UserX className="h-5 w-5" />
              Desactivar usuario
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Vas a desactivar la cuenta de{' '}
              <span className="font-semibold text-foreground">{selectedUser?.name}</span>.
            </p>
            <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-900/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
              <p>• El usuario <strong>no podrá acceder</strong> al sistema.</p>
              <p>• Sus datos y configuración se conservarán.</p>
              <p>• Podés reactivarlo en cualquier momento.</p>
            </div>
            {deleteError && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300 flex gap-2 items-start">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setDeleteError(null) }}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserX className="h-4 w-4 mr-2" />}
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Detail Dialog ────────────────────────────────────────────── */}
      <UserDetailDialog
        user={selectedUser}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        onEdit={openEditDialog}
        onDeactivate={(targetUser) => handleSetStatusFromDetail(targetUser, 'inactive')}
        onReactivate={(targetUser) => handleSetStatusFromDetail(targetUser, 'active')}
        onResendInvite={async (user) => {
          const result = await resendInvitation(user.id)
          if (result.success && result.invite_link) {
            setInviteLink(result.invite_link)
            setCopiedLink(false)
            setIsInviteDialogOpen(true)
          }
          return result
        }}
        isUpdatingStatus={isUpdatingStatusFromDetail}
        currentUserId={user?.id}
      />

      {/* ── Invite Link Dialog ────────────────────────────────────────────── */}
      <Dialog open={isInviteDialogOpen} onOpenChange={(open) => { setIsInviteDialogOpen(open); if (!open) setInviteLink(null) }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Invitación enviada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Se ha enviado un correo automáticamente para que el usuario configure su contraseña. Si lo prefieres, también puedes compartirle este enlace directo:
            </p>
            {inviteLink ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground break-all select-all">
                    {inviteLink}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 h-8 w-8 p-0"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink)
                      setCopiedLink(true)
                      setTimeout(() => setCopiedLink(false), 2000)
                    }}
                    title="Copiar enlace"
                  >
                    {copiedLink ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                {copiedLink && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">¡Enlace copiado!</p>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-300">
                <Link2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                El usuario recibirá un email de confirmación. Una vez que lo confirme, podrá usar "Olvidé mi contraseña" para configurar su acceso.
              </div>
            )}
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>• El enlace expira en <strong>24 horas</strong>.</p>
              <p>• Si expira, podés generar uno nuevo desde Supabase o desde el perfil del usuario.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setIsInviteDialogOpen(false); setInviteLink(null) }}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
