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
import { cn } from '@/lib/utils'
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
  onResendInvite?: (user: SupabaseUser) => Promise<{ success: boolean; invite_link?: string | null }> | void
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
  onResendInvite,
  isUpdatingStatus = false,
  currentUserId,
}: UserDetailDialogProps) {
  const supabase = useMemo(() => createClient(), [])

  const [isResending, setIsResending] = useState(false)

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
      <DialogContent className="w-[100vw] max-w-[100vw] md:w-[98vw] md:max-w-[98vw] h-[100dvh] max-h-[100dvh] md:h-[95vh] md:max-h-[95vh] flex flex-col p-0 overflow-hidden border-none md:border-slate-200/60 md:dark:border-slate-800/60 shadow-2xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-none md:rounded-2xl">
        {/* Dynamic header background */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-violet-500/10 dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-violet-500/20 opacity-50 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        
        <DialogHeader className="px-4 md:px-8 pt-6 md:pt-8 pb-4 relative z-10 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-5">
              <div className="relative group shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full blur opacity-30 group-hover:opacity-50 transition duration-500" />
                <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-3xl shadow-xl border-2 border-white dark:border-slate-900 overflow-hidden">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                  <div className={cn("h-3.5 w-3.5 rounded-full", user.status === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : user.status === 'inactive' ? "bg-red-500" : "bg-orange-500")} />
                </div>
              </div>
              
              <div className="min-w-0 pt-1 space-y-1.5 text-left flex-1">
                <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white break-words">
                  {user.name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 break-all">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge variant="outline" className={cn("px-2.5 py-0.5 font-medium border shadow-sm", getRoleBadgeColor(user.role))}>
                    {getRoleLabel(user.role)}
                  </Badge>
                  <Badge variant="outline" className={cn("px-2.5 py-0.5 font-medium border shadow-sm", getStatusBadgeColor(user.status))}>
                    {user.status === 'active' ? 'Activo' : user.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
                  </Badge>
                  {hasWholesaleAccess ? (
                    <Badge variant="outline" className="px-2.5 py-0.5 font-medium border shadow-sm bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                      <Store className="h-3 w-3 mr-1.5" />
                      Mayorista
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-slate-50/50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-sm shadow-sm">
              {onEdit ? (
                <Button variant="ghost" size="sm" onClick={() => onEdit(user)} className="h-8 hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all text-slate-700 dark:text-slate-300">
                  <UserCog className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              ) : null}
              {canRunStatusAction ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isSelfUser || isUpdatingStatus}
                  onClick={() => setShowStatusConfirm(true)}
                  className={cn("h-8 hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all", user.status === 'active' ? "text-red-600 hover:text-red-700 dark:text-red-400" : "text-green-600 hover:text-green-700 dark:text-green-400")}
                >
                  {isUpdatingStatus ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : user.status === 'active' ? (
                    <UserX className="h-4 w-4 mr-2" />
                  ) : (
                    <UserCheck className="h-4 w-4 mr-2" />
                  )}
                  {statusActionLabel}
                </Button>
              ) : null}
              {onResendInvite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isResending}
                  onClick={async () => {
                    setIsResending(true)
                    try {
                      await onResendInvite(user)
                    } finally {
                      setIsResending(false)
                    }
                  }}
                  className="h-8 hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all text-slate-700 dark:text-slate-300"
                >
                  {isResending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2 text-blue-500" />
                  )}
                  Reenviar
                </Button>
              ) : null}
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
              <Button variant="ghost" size="icon" onClick={() => handleCopy(user.email, 'Email')} className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" title="Copiar email">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleCopy(user.id, 'ID')} className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" title="Copiar ID">
                <Hash className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {isSelfUser ? (
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200/50 dark:border-amber-900/50 w-fit mx-4 md:mx-8">
              <AlertCircle className="h-3.5 w-3.5" />
              No puedes desactivar tu propia cuenta desde este panel.
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col bg-slate-50/30 dark:bg-slate-900/20">
          <div className="px-4 md:px-8 pt-4 md:pt-6 pb-2 shrink-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Clock3, label: 'Último acceso', value: getRelativeTime(user.lastLogin), color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { icon: CalendarDays, label: 'Antigüedad', value: `${accountAgeDays} días`, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                { icon: ShieldCheck, label: 'Permisos', value: effectivePermissions.size, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                { icon: KeyRound, label: 'Acciones', value: totalGrantedActions, color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10' }
              ].map((stat, i) => (
                <div key={i} className="group relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 p-4 transition-all hover:shadow-md hover:bg-white dark:hover:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl flex-shrink-0 transition-colors", stat.bg)}>
                      <stat.icon className={cn("h-4 w-4", stat.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                        {stat.label}
                      </p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Tabs defaultValue="info" className="flex flex-col flex-1 min-h-0 overflow-hidden px-4 md:px-8 pb-4 md:pb-8 pt-4">
            <TabsList className="w-full sm:w-fit grid grid-cols-3 bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-xl shrink-0">
              <TabsTrigger value="info" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">
                <User className="h-4 w-4 mr-2" />
                Detalles
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">
                <Activity className="h-4 w-4 mr-2" />
                Actividad
              </TabsTrigger>
              <TabsTrigger value="permissions" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">
                <Shield className="h-4 w-4 mr-2" />
                Permisos
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-6 pr-2 custom-scrollbar">
              <TabsContent value="info" className="m-0 space-y-8 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <Mail className="h-3.5 w-3.5" />
                      </div>
                      Contacto y Perfil
                    </h3>
                    <div className="space-y-1 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/30 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 shadow-sm">
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-3 shrink-0">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-500 dark:text-slate-400">Correo</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 break-all text-left sm:text-right">{user.email}</span>
                      </div>
                      {user.phone ? (
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-3 shrink-0">
                            <Phone className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-500 dark:text-slate-400">Teléfono</span>
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-left sm:text-right">{user.phone}</span>
                        </div>
                      ) : null}
                      {user.department ? (
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-3 shrink-0">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-500 dark:text-slate-400">Departamento</span>
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-left sm:text-right">{user.department}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                        <Calendar className="h-3.5 w-3.5" />
                      </div>
                      Sistema
                    </h3>
                    <div className="space-y-1 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/30 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 shadow-sm">
                      <div className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-3 shrink-0">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-500 dark:text-slate-400">Creación</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-left xl:text-right">{formatDateTime(user.createdAt)}</span>
                      </div>
                      <div className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-3 shrink-0">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-500 dark:text-slate-400">Acceso</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-left xl:text-right">{formatDateTime(user.lastLogin)}</span>
                      </div>
                      <div className="p-4 flex flex-col gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Hash className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-500 dark:text-slate-400">ID de Usuario</span>
                        </div>
                        <span className="text-xs font-mono bg-slate-100 dark:bg-slate-900 p-2.5 rounded-lg text-slate-600 dark:text-slate-400 break-all select-all border border-slate-200/50 dark:border-slate-800/50">{user.id}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {user.notes ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </div>
                      Notas Adicionales
                    </h3>
                    <div className="p-5 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm">
                      <p className="text-sm text-amber-900 dark:text-amber-200/80 leading-relaxed whitespace-pre-wrap">{user.notes}</p>
                    </div>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="activity" className="m-0 space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col h-full bg-white/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Registro de Actividad</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {timelineLogs.length > 0 ? `${timelineLogs.length} eventos registrados` : 'Sin eventos'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void loadActivity()}
                      disabled={isLoadingActivity}
                      className="h-8 rounded-lg"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isLoadingActivity && 'animate-spin')} />
                      Actualizar
                    </Button>
                  </div>

                  <div className="flex-1 relative min-h-[300px]">
                    {isLoadingActivity ? (
                      <div className="absolute inset-0 flex flex-col space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex gap-4">
                            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-1/3" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : activityError ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center max-w-sm dark:border-red-900/40 dark:bg-red-950/20">
                          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3 opacity-80" />
                          <p className="text-sm text-red-800 dark:text-red-300 font-medium">{activityError}</p>
                        </div>
                      </div>
                    ) : (
                      <UserActivityTimeline logs={timelineLogs} className="min-h-[400px] h-[500px] xl:h-[600px] pr-2 w-full" limit={50} />
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="m-0 space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                {permissionsNotice ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{permissionsNotice}</p>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Otorgados por rol', value: rolePermissions.size, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
                    { label: 'Asignados directo', value: directPermissions.length, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
                    { label: 'Total Efectivos', value: effectivePermissions.size, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' }
                  ].map((stat, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/30 p-5 flex items-center justify-between shadow-sm">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
                      <div className={cn("h-8 px-3 rounded-lg flex items-center justify-center text-sm font-bold", stat.bg, stat.color)}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-slate-500" />
                      Matriz de Accesos
                    </h3>
                  </div>
                  
                  <div className="p-5">
                    {isLoadingPermissions ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <Skeleton key={i} className="h-16 w-full rounded-xl" />
                        ))}
                      </div>
                    ) : permissionRows.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {permissionRows
                          .sort(([resourceA], [resourceB]) => resourceA.localeCompare(resourceB))
                          .map(([resource, perms]) => (
                            <div key={resource} className="group rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 p-4 hover:shadow-sm hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                {RESOURCE_LABELS[resource] || resource}
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                                {ACTION_ORDER.map((action) => {
                                  const granted = Boolean(perms[action]);
                                  return (
                                    <div key={action} className="flex items-center gap-2.5">
                                      <div className={cn("flex items-center justify-center h-5 w-5 rounded-md shrink-0", granted ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}>
                                        {granted ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                      </div>
                                      <span className={cn("text-sm font-medium", granted ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500")}>
                                        {ACTION_LABELS[action]}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Shield className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-medium text-slate-500">No hay permisos detallados disponibles</p>
                      </div>
                    )}
                  </div>
                </div>

                {unknownDirectPermissions.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-900/30 shadow-sm">
                    <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Permisos especiales
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {unknownDirectPermissions.map((permission) => (
                        <Badge key={permission} variant="secondary" className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
    
    <AlertDialog open={showStatusConfirm} onOpenChange={setShowStatusConfirm}>
      <AlertDialogContent className="border-slate-200/60 dark:border-slate-800/60 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            {user.status === 'active' ? (
              <div className="p-2 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg">
                <UserX className="h-5 w-5" />
              </div>
            ) : (
              <div className="p-2 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg">
                <UserCheck className="h-5 w-5" />
              </div>
            )}
            {statusActionLabel} usuario
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            {statusActionDescription}
            {' '}
            Estás a punto de modificar el estado de{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{user.name}</span>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isUpdatingStatus} className="border-slate-200 dark:border-slate-800">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              "font-medium",
              user.status === 'active' 
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]' 
                : 'bg-green-600 hover:bg-green-700 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]'
            )}
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
