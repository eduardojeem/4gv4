import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Building2, Clock, Mail, Shield, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export type UserRow = {
  memberId: string
  userId: string
  name: string | null
  email: string | null
  profileStatus: string | null
  memberRole: string
  memberStatus: string | null
  memberSince: string | null
  organizationId: string
  organizationName: string | null
  organizationSlug: string | null
  organizationPlan: string | null
  organizationStatus?: string | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño (Owner)',
  admin: 'Administrador',
  vendedor: 'Vendedor',
  tecnico: 'Técnico',
  cliente: 'Cliente',
  super_admin: 'Súper Admin',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  invited: 'Invitado',
  suspended: 'Suspendido',
  inactive: 'Inactivo',
}

export function UserDetailModal({
  user,
  onClose,
}: {
  user: UserRow | null
  onClose: () => void
}) {
  if (!user) return null

  const roleLabel = ROLE_LABELS[user.memberRole] || user.memberRole
  const statusLabel = STATUS_LABELS[user.memberStatus ?? 'inactive'] || user.memberStatus

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Intl.DateTimeFormat('es-PY', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(dateStr))
  }

  const initials = (user.name
    ? user.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : user.email?.[0]?.toUpperCase()) || '?'

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle del Usuario</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
            {initials}
          </div>
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {user.name || 'Sin nombre'}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="h-4 w-4" />
              {user.email || 'Sin correo'}
            </div>
            
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                {roleLabel}
              </Badge>
              <Badge 
                variant="outline" 
                className={cn(
                  'gap-1.5',
                  user.memberStatus === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400' :
                  user.memberStatus === 'invited' ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400' :
                  'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400'
                )}
              >
                {statusLabel}
              </Badge>
              {user.profileStatus && user.profileStatus !== 'active' && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 gap-1.5">
                  Perfil: {user.profileStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Información de la Organización
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  {user.organizationName || 'Sin organización'}
                </p>
                {user.organizationSlug && (
                  <p className="text-xs text-slate-500">/{user.organizationSlug}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Miembro desde</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  {formatDate(user.memberSince)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 text-xs text-slate-400">
          <p>ID Usuario: {user.userId}</p>
          <p>ID Membresía: {user.memberId}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
