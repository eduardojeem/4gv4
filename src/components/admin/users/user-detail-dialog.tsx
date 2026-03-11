'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Clock,
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  Store,
  RefreshCw,
  Copy,
  Clock3,
  CalendarDays,
  Hash,
  Loader2,
  UserCog,
  UserCheck,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { SupabaseUser } from '@/hooks/use-users-supabase'
import { UserActivityTimeline } from './user-activity-timeline'
import { createClient } from '@/lib/supabase/client'
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  WHOLESALE_PRICE_PERMISSION,
} from '@/lib/auth/roles-permissions'

interface UserDetailDialogProps {
  user: SupabaseUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (user: SupabaseUser) => void
  onDeactivate?: (user: SupabaseUser) => Promise<void> | void
  onReactivate?: (user: SupabaseUser) => Promise<void> | void
  isUpdatingStatus?: boolean
  currentUserId?: string | null
}

interface PermissionActions {
  create: boolean
  read: boolean
  update: boolean
  delete: boolean
  manage: boolean
}

type PermissionsMatrix = Record<string, PermissionActions>

interface AuditLogRow {
  id: string
  action: string
  resource: string | null
  resource_id: string | null
  created_at: string
  ip_address: string | null
  new_values: Record<string, unknown> | null
}

interface TimelineLog {
  id: string
  action: string
  details: string
  timestamp: string
  type: 'info' | 'warning' | 'error' | 'success'
}

const RESOURCE_LABELS: Record<string, string> = {
  products: 'Productos',
  inventory: 'Inventario',
  reports: 'Reportes',
  users: 'Usuarios',
  settings: 'Configuracion',
  promotions: 'Promociones',
  customers: 'Clientes',
}

const ACTION_LABELS: Record<keyof PermissionActions, string> = {
  create: 'Crear',
  read: 'Leer',
  update: 'Actualizar',
  delete: 'Eliminar',
  manage: 'Gestionar',
}

const ACTION_ORDER: Array<keyof PermissionActions> = [
  'create',
  'read',
  'update',
  'delete',
  'manage',
]

function normalizePermissionList(values?: string[]): string[] {
  if (!Array.isArray(values)) return []
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function formatDateTime(dateString?: string) {
  if (!dateString) return 'Sin datos'
  const date = new Date(dateString)
  if (!Number.isFinite(date.getTime())) return 'Sin datos'

  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRelativeTime(dateString?: string) {
  if (!dateString) return 'Nunca'
  const input = new Date(dateString).getTime()
  if (!Number.isFinite(input)) return 'Sin datos'

  const diffMs = Date.now() - input
  if (diffMs < 0) return 'En el futuro'

  const minutes = Math.floor(diffMs / (1000 * 60))
  if (minutes < 1) return 'Hace segundos'
  if (minutes < 60) return `Hace ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`

  const days = Math.floor(hours / 24)
  if (days < 30) return `Hace ${days} dias`

  const months = Math.floor(days / 30)
  if (months < 12) return `Hace ${months} meses`

  const years = Math.floor(months / 12)
  return `Hace ${years} anos`
}

function getAccountAgeDays(createdAt?: string) {
  if (!createdAt) return 0
  const diff = Date.now() - new Date(createdAt).getTime()
  if (!Number.isFinite(diff) || diff < 0) return 0
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function formatActionLabel(action: string) {
  const labelMap: Record<string, string> = {
    create: 'Creacion de registro',
    update: 'Actualizacion de registro',
    delete: 'Eliminacion de registro',
    login: 'Inicio de sesion',
    login_failed: 'Login fallido',
    logout: 'Cierre de sesion',
    role_change: 'Cambio de rol',
    password_change: 'Cambio de password',
    permission_denied: 'Acceso denegado',
    bulk_operation: 'Operacion masiva',
  }

  if (labelMap[action]) return labelMap[action]
  return action.replace(/_/g, ' ')
}

function mapLogSeverity(action: string, newValues: Record<string, unknown> | null): TimelineLog['type'] {
  const severity = typeof newValues?.severity === 'string' ? String(newValues.severity).toLowerCase() : ''
  if (severity === 'critical' || severity === 'high') return 'error'
  if (severity === 'medium') return 'warning'

  const lower = action.toLowerCase()
  if (lower.includes('failed') || lower.includes('denied') || lower.includes('suspicious')) return 'error'
  if (lower.includes('delete') || lower.includes('revoke') || lower.includes('suspend')) return 'warning'
  if (lower.includes('create') || lower.includes('grant') || lower.includes('import')) return 'success'
  return 'info'
}

function getRoleLabel(role: string) {
  switch (role) {
    case 'super_admin':
      return 'Super Admin'
    case 'admin':
      return 'Administrador'
    case 'tecnico':
      return 'Tecnico'
    case 'vendedor':
      return 'Vendedor'
    case 'cliente':
      return 'Cliente'
    default:
      return role
  }
}

function buildPermissionsFromRoleAndExtra(role: SupabaseUser['role'], extraPermissions: string[]) {
  const matrix: PermissionsMatrix = {}
  const rolePermissionIds = (ROLE_PERMISSIONS[role]?.permissions || []).map((permission) => permission.id)
  const combined = new Set<string>([...rolePermissionIds, ...extraPermissions])

  combined.forEach((permissionId) => {
    const definition = PERMISSIONS[permissionId]
    if (!definition) return

    if (!matrix[definition.resource]) {
      matrix[definition.resource] = {
        create: false,
        read: false,
        update: false,
        delete: false,
        manage: false,
      }
    }

    matrix[definition.resource][definition.action] = true
  })

  return matrix
}

function mapAuditToTimelineLog(log: AuditLogRow): TimelineLog {
  const details: string[] = []

  if (log.resource) {
    details.push(`Recurso: ${RESOURCE_LABELS[log.resource] || log.resource}`)
  }
  if (log.resource_id) {
    details.push(`ID: ${log.resource_id}`)
  }
  if (log.ip_address) {
    details.push(`IP: ${log.ip_address}`)
  }

  return {
    id: log.id,
    action: formatActionLabel(log.action),
    details: details.join(' | ') || 'Actividad sin detalles adicionales',
    timestamp: log.created_at,
    type: mapLogSeverity(log.action, log.new_values),
  }
}

export function UserDetailDialog({
  user,
  open,
  onOpenChange,
  onEdit,
  onDeactivate,
  onReactivate,
  isUpdatingStatus = false,
  currentUserId,
}: UserDetailDialogProps) {
  const supabase = useMemo(() => createClient(), [])

  const [permissions, setPermissions] = useState<PermissionsMatrix | null>(null)
  const [directPermissions, setDirectPermissions] = useState<string[]>([])
  const [timelineLogs, setTimelineLogs] = useState<TimelineLog[]>([])
  const [permissionsNotice, setPermissionsNotice] = useState<string | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)

  const loadPermissions = useCallback(async () => {
    if (!user) return

    setIsLoadingPermissions(true)
    setPermissionsNotice(null)

    const fallbackDirectPermissions = normalizePermissionList(user.permissions)

    try {
      const [rpcResult, directResult] = await Promise.all([
        supabase.rpc('get_user_permissions', { p_user_id: user.id }),
        supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', user.id)
          .eq('is_active', true),
      ])

      const { data: rpcData, error: rpcError } = rpcResult
      const { data: directData, error: directError } = directResult

      if (!rpcError && rpcData) {
        setPermissions(rpcData as PermissionsMatrix)
      } else {
        setPermissions(buildPermissionsFromRoleAndExtra(user.role, fallbackDirectPermissions))
        setPermissionsNotice(
          'No se pudo usar RPC de permisos. Se muestra calculo por rol y permisos directos.',
        )
      }

      if (directError) {
        setDirectPermissions(fallbackDirectPermissions)
        setPermissionsNotice(
          'No se pudo cargar permisos directos desde base de datos. Se muestra fallback del perfil.',
        )
      } else {
        const merged = new Set([
          ...fallbackDirectPermissions,
          ...(directData || [])
            .map((row) => row.permission)
            .filter((permission): permission is string => typeof permission === 'string' && permission.length > 0),
        ])
        setDirectPermissions(Array.from(merged).sort())
      }
    } catch (err) {
      console.error('Error loading permissions:', err)
      setPermissions(buildPermissionsFromRoleAndExtra(user.role, fallbackDirectPermissions))
      setDirectPermissions(fallbackDirectPermissions)
      setPermissionsNotice('No se pudieron cargar todos los permisos. Se muestra un resumen local.')
    } finally {
      setIsLoadingPermissions(false)
    }
  }, [supabase, user])

  const loadActivity = useCallback(async () => {
    if (!user) return

    setIsLoadingActivity(true)
    setActivityError(null)

    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, resource, resource_id, created_at, ip_address, new_values')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        setTimelineLogs([])
        setActivityError(error.message || 'No se pudo cargar la actividad del usuario')
        return
      }

      const mapped = (data || []).map((log) => mapAuditToTimelineLog(log as AuditLogRow))
      setTimelineLogs(mapped)
    } catch (err) {
      console.error('Error loading activity:', err)
      setTimelineLogs([])
      setActivityError('Error al consultar actividad')
    } finally {
      setIsLoadingActivity(false)
    }
  }, [supabase, user])

  useEffect(() => {
    if (!user || !open) return
    void loadPermissions()
    void loadActivity()
  }, [open, user, loadPermissions, loadActivity])

  const rolePermissions = useMemo(
    () => new Set((user ? ROLE_PERMISSIONS[user.role]?.permissions || [] : []).map((permission) => permission.id)),
    [user],
  )

  const effectivePermissions = useMemo(() => {
    const combined = new Set<string>(rolePermissions)
    normalizePermissionList(user?.permissions).forEach((permission) => combined.add(permission))
    directPermissions.forEach((permission) => combined.add(permission))
    return combined
  }, [rolePermissions, user, directPermissions])

  const mappedPermissions = useMemo(() => {
    if (!user) return {} as PermissionsMatrix
    if (permissions) return permissions
    return buildPermissionsFromRoleAndExtra(user.role, Array.from(effectivePermissions))
  }, [permissions, user, effectivePermissions])

  const unknownDirectPermissions = useMemo(
    () => directPermissions.filter((permission) => !PERMISSIONS[permission]),
    [directPermissions],
  )

  const permissionRows = useMemo(() => Object.entries(mappedPermissions || {}), [mappedPermissions])

  const totalGrantedActions = useMemo(
    () =>
      permissionRows.reduce((count, [, actions]) => {
        return count + ACTION_ORDER.reduce((acc, key) => acc + (actions[key] ? 1 : 0), 0)
      }, 0),
    [permissionRows],
  )

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300'
      case 'admin':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'tecnico':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
      case 'vendedor':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300'
      case 'inactive':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300'
      case 'suspended':
        return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getPermissionIcon = (hasPermission: boolean) => {
    return hasPermission ? (
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
    ) : (
      <XCircle className="h-4 w-4 text-gray-400 dark:text-gray-600" />
    )
  }

  const handleCopy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copiado`)
    } catch (err) {
      console.error('Clipboard error:', err)
      toast.error(`No se pudo copiar ${label.toLowerCase()}`)
    }
  }, [])

  const handleStatusAction = useCallback(async () => {
    if (!user) return

    const isSelfUser = currentUserId === user.id
    if (isSelfUser || isUpdatingStatus) return

    try {
      if (user.status === 'active') {
        await onDeactivate?.(user)
      } else {
        await onReactivate?.(user)
      }
    } finally {
      setShowStatusConfirm(false)
    }
  }, [currentUserId, isUpdatingStatus, onDeactivate, onReactivate, user])

  if (!user) return null

  const hasWholesaleAccess = effectivePermissions.has(WHOLESALE_PRICE_PERMISSION)
  const accountAgeDays = getAccountAgeDays(user.createdAt)
  const isSelfUser = currentUserId === user.id
  const canRunStatusAction =
    user.status === 'active' ? typeof onDeactivate === 'function' : typeof onReactivate === 'function'
  const statusActionLabel = user.status === 'active' ? 'Desactivar' : 'Reactivar'
  const statusActionDescription = user.status === 'active'
    ? 'Esta accion desactivara el acceso al sistema para este usuario.'
    : 'Esta accion reactivara el acceso al sistema para este usuario.'

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl truncate">{user.name}</DialogTitle>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                    {getRoleLabel(user.role)}
                  </Badge>
                  <Badge variant="outline" className={getStatusBadgeColor(user.status)}>
                    {user.status === 'active' ? 'Activo' : user.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
                  </Badge>
                  {hasWholesaleAccess ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                    >
                      <Store className="h-3 w-3 mr-1" />
                      Mayorista
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {onEdit ? (
                <Button variant="default" size="sm" onClick={() => onEdit(user)}>
                  <UserCog className="h-3.5 w-3.5 mr-2" />
                  Editar usuario
                </Button>
              ) : null}
              {canRunStatusAction ? (
                <Button
                  variant={user.status === 'active' ? 'destructive' : 'outline'}
                  size="sm"
                  disabled={isSelfUser || isUpdatingStatus}
                  onClick={() => setShowStatusConfirm(true)}
                >
                  {isUpdatingStatus ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : user.status === 'active' ? (
                    <UserX className="h-3.5 w-3.5 mr-2" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5 mr-2" />
                  )}
                  {statusActionLabel}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => handleCopy(user.email, 'Email')}>
                <Copy className="h-3.5 w-3.5 mr-2" />
                Copiar email
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleCopy(user.id, 'ID')}>
                <Hash className="h-3.5 w-3.5 mr-2" />
                Copiar ID
              </Button>
            </div>
          </div>
          {isSelfUser ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No puedes desactivar tu propia cuenta desde este modal.
            </p>
          ) : null}
        </DialogHeader>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Ultimo acceso
            </div>
            <div className="text-sm font-semibold mt-1">{getRelativeTime(user.lastLogin)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Antiguedad
            </div>
            <div className="text-sm font-semibold mt-1">{accountAgeDays} dias</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Permisos efectivos
            </div>
            <div className="text-sm font-semibold mt-1">{effectivePermissions.size}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" />
              Acciones habilitadas
            </div>
            <div className="text-sm font-semibold mt-1">{totalGrantedActions}</div>
          </div>
        </div>

        <Tabs defaultValue="info" className="mt-4 flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">
              <User className="h-4 w-4 mr-2" />
              Informacion
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="h-4 w-4 mr-2" />
              Actividad
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <Shield className="h-4 w-4 mr-2" />
              Permisos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="flex-1 overflow-auto mt-4">
            <div className="space-y-6 pr-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Informacion de contacto
                </h3>
                <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.email}</p>
                    </div>
                  </div>
                  {user.phone ? (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Telefono</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.phone}</p>
                      </div>
                    </div>
                  ) : null}
                  {user.department ? (
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Departamento</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.department}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Informacion de cuenta
                </h3>
                <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fecha de creacion</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatDateTime(user.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ultimo acceso</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatDateTime(user.lastLogin)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">ID de usuario</p>
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">{user.id}</p>
                    </div>
                  </div>
                </div>
              </div>

              {user.notes ? (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Notas
                    </h3>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{user.notes}</p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-auto mt-4">
            <div className="pr-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  {timelineLogs.length > 0 ? `${timelineLogs.length} eventos recientes` : 'Sin eventos recientes'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadActivity()}
                  disabled={isLoadingActivity}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoadingActivity ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>

              {isLoadingActivity ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : activityError ? (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
                  {activityError}
                </div>
              ) : (
                <UserActivityTimeline logs={timelineLogs} className="h-[430px] pr-0" limit={50} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="flex-1 overflow-auto mt-4">
            <div className="pr-4 space-y-4">
              {permissionsNotice ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  {permissionsNotice}
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Por rol</p>
                  <p className="text-lg font-semibold">{rolePermissions.size}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Directos</p>
                  <p className="text-lg font-semibold">{directPermissions.length}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Efectivos</p>
                  <p className="text-lg font-semibold">{effectivePermissions.size}</p>
                </div>
              </div>

              {isLoadingPermissions ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : permissionRows.length > 0 ? (
                <div className="space-y-4">
                  {permissionRows
                    .sort(([resourceA], [resourceB]) => resourceA.localeCompare(resourceB))
                    .map(([resource, perms]) => (
                      <div key={resource} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          {RESOURCE_LABELS[resource] || resource}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {ACTION_ORDER.map((action) => (
                            <div key={action} className="flex items-center gap-2">
                              {getPermissionIcon(Boolean(perms[action]))}
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {ACTION_LABELS[action]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No se pudieron cargar los permisos</p>
                </div>
              )}

              {unknownDirectPermissions.length > 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Permisos no tipados</p>
                  <div className="flex flex-wrap gap-2">
                    {unknownDirectPermissions.map((permission) => (
                      <Badge key={permission} variant="outline" className="font-mono text-xs">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <AlertDialog open={showStatusConfirm} onOpenChange={setShowStatusConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{statusActionLabel} usuario</AlertDialogTitle>
          <AlertDialogDescription>
            {statusActionDescription}
            {' '}
            <span className="font-semibold text-foreground">{user.name}</span>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUpdatingStatus}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={user.status === 'active' ? 'bg-red-600 hover:bg-red-700' : undefined}
            onClick={() => void handleStatusAction()}
            disabled={isUpdatingStatus}
          >
            {isUpdatingStatus ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : statusActionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
