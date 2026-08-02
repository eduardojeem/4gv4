'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SuperAdminRow = {
  userId: string
  email: string | null
  name: string | null
  profileStatus: string | null
  roleActive: boolean
  roleSince: string | null
  lastSignIn: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function relativeTime(value: string | null) {
  if (!value) return 'Nunca'
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'Ahora mismo'
  if (minutes < 60) return `Hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Hace ${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `Hace ${months} mes${months > 1 ? 'es' : ''}`
  return `Hace ${Math.floor(months / 12)} año${Math.floor(months / 12) > 1 ? 's' : ''}`
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

function recencyTone(value: string | null) {
  if (!value) return 'text-slate-400'
  const days = (Date.now() - new Date(value).getTime()) / 86400000
  if (days <= 7) return 'text-emerald-600 dark:text-emerald-400'
  if (days <= 30) return 'text-amber-600 dark:text-amber-400'
  return 'text-slate-500'
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, tone = 'default' }: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'warning' | 'danger' | 'success'
}) {
  const tones = {
    default: 'bg-card border',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
    danger:  'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20',
  }
  const iconTones = {
    default: 'text-slate-500',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger:  'text-red-600 dark:text-red-400',
  }
  return (
    <div className={cn('rounded-xl border p-5', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className={cn('rounded-lg border bg-background p-2', iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add super admin form
// ---------------------------------------------------------------------------

function AddSuperAdminForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email inválido.')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/superadmin/super-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json() as { success?: boolean; error?: string; email?: string }
      if (!res.ok || !data.success) {
        setError(data.error || 'Error al asignar rol.')
        return
      }
      setSuccess(`${data.email ?? email} ahora es super_admin.`)
      setEmail('')
      onSuccess()
    } catch {
      setError('Error de red.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label className="text-sm font-medium">Promover usuario a super_admin</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="email"
            placeholder="email@usuario.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn('pl-9', error ? 'border-red-300' : '')}
            disabled={isSubmitting}
          />
        </div>
        <Button type="submit" disabled={isSubmitting || !email.trim()}>
          {isSubmitting ? 'Asignando...' : <><Plus className="mr-1.5 h-4 w-4" />Asignar</>}
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        El usuario debe existir en la plataforma. Si no existe, primero invitalo desde la creación de organización.
      </p>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {success}
        </div>
      )}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main manager
// ---------------------------------------------------------------------------

export function SuperAdminsManager({ rows, currentUserId }: { rows: SuperAdminRow[]; currentUserId: string }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<SuperAdminRow | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (r.email?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q))
  })

  const activeCount = rows.filter((r) => r.roleActive).length
  const inactiveCount = rows.filter((r) => !r.roleActive).length
  const recentlyActive = rows.filter((r) => {
    if (!r.lastSignIn) return false
    return (Date.now() - new Date(r.lastSignIn).getTime()) <= 7 * 86400000
  }).length

  async function revokeRole(row: SuperAdminRow) {
    setRevoking(row.userId)
    setRevokeError(null)
    try {
      const res = await fetch(`/api/superadmin/super-admins?userId=${row.userId}`, { method: 'DELETE' })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        setRevokeError(data.error || 'No se pudo revocar.')
        return
      }
      setConfirmRevoke(null)
      router.refresh()
    } catch {
      setRevokeError('Error de red.')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-slate-500">
            <Link href="/superadmin/users">
              <ArrowLeft className="h-3.5 w-3.5" />
              Usuarios
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Super administradores</h1>
          </div>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Usuarios con acceso global a toda la plataforma. Los cambios quedan registrados en el audit log.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
      </header>

      {/* Security warning */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
        <Shield className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Acceso de alto privilegio</p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Los super administradores ven y modifican datos de todas las organizaciones. Asigná este rol con cuidado y revisalo periódicamente.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total super admins" value={rows.length} sub="con rol asignado" icon={Crown} tone="warning" />
        <StatCard label="Activos" value={activeCount} sub={inactiveCount > 0 ? `${inactiveCount} inactivos` : 'todos habilitados'} icon={ShieldCheck} tone="success" />
        <StatCard label="Recientemente activos" value={recentlyActive} sub="iniciaron sesión últimos 7d" icon={UserCheck} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

        {/* List */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Lista de super admins</CardTitle>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {filtered.length} de {rows.length}
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-9 w-full pl-9 text-sm sm:w-56"
                  placeholder="Buscar nombre o email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Crown className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">
                  {rows.length === 0 ? 'No hay super administradores asignados.' : 'Sin resultados con esa búsqueda.'}
                </p>
              </div>
            ) : (
              filtered.map((row) => {
                const isMe = row.userId === currentUserId
                const displayName = row.name || row.email?.split('@')[0] || 'Usuario'

                return (
                  <div key={row.userId} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 ring-2 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/40">
                      {getInitials(row.name, row.email)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{displayName}</p>
                        {isMe && (
                          <Badge variant="outline" className="rounded-full border-indigo-200 bg-indigo-50 text-[10px] text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
                            Vos
                          </Badge>
                        )}
                        {!row.roleActive && (
                          <Badge variant="outline" className="rounded-full border-red-200 bg-red-50 text-[10px] text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
                            Rol inactivo
                          </Badge>
                        )}
                        {row.profileStatus === 'suspended' && (
                          <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 text-[10px] text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300">
                            Cuenta suspendida
                          </Badge>
                        )}
                      </div>
                      {row.email && (
                        <p className="truncate text-xs text-slate-400">{row.email}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                        <span className={cn('flex items-center gap-1', recencyTone(row.lastSignIn))}>
                          <Clock className="h-3 w-3" />
                          Último acceso: {relativeTime(row.lastSignIn)}
                        </span>
                        <span className="text-slate-400">
                          Promovido: {formatDate(row.roleSince)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isMe ? (
                        <Button variant="outline" size="sm" disabled className="h-8 gap-1.5 text-xs">
                          <Lock className="h-3 w-3" />
                          Sos vos
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/20"
                          onClick={() => { setConfirmRevoke(row); setRevokeError(null) }}
                          disabled={revoking === row.userId}
                        >
                          <ShieldOff className="h-3 w-3" />
                          Revocar
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Side panel: add new */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400">
                  <Plus className="h-4 w-4" />
                </div>
                <CardTitle className="text-base">Asignar rol</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <AddSuperAdminForm onSuccess={() => router.refresh()} />
            </CardContent>
          </Card>

          {/* Best practices */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <CardTitle className="text-base">Buenas prácticas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <p><strong>Mínimo de cuentas</strong>: solo personas que realmente necesitan acceso global.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <p><strong>2FA obligatorio</strong>: activá la autenticación de dos factores en cada cuenta.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <p><strong>Auditá periódicamente</strong>: revisá los últimos accesos y revocá cuentas sin uso.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <p><strong>Audit log</strong>: cada cambio queda registrado en <code className="rounded bg-muted px-1">/superadmin/audit-logs</code>.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revoke confirmation — Dialog accesible */}
      <Dialog open={!!confirmRevoke} onOpenChange={(open) => { if (!open && !revoking) setConfirmRevoke(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <DialogTitle>Revocar rol de super_admin</DialogTitle>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  El usuario perderá acceso global pero mantendrá su acceso normal con rol{' '}
                  <code className="rounded bg-muted px-1 text-xs">admin</code>.
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6">
            {confirmRevoke && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-semibold">{confirmRevoke.name || confirmRevoke.email}</p>
                {confirmRevoke.email && confirmRevoke.name && (
                  <p className="text-xs text-slate-400">{confirmRevoke.email}</p>
                )}
              </div>
            )}
            {revokeError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {revokeError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRevoke(null)}
                disabled={revoking !== null}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => confirmRevoke && revokeRole(confirmRevoke)}
                disabled={revoking !== null}
                className="gap-1.5"
              >
                {revoking
                  ? 'Revocando...'
                  : <><Trash2 className="h-3.5 w-3.5" />Confirmar revocación</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
