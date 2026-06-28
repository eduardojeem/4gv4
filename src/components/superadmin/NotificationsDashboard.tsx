'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Bell,
  BellOff,
  BellRing,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GlobalNotification = {
  id: string
  title: string
  body: string
  type: 'info' | 'warning' | 'success' | 'danger'
  target: 'all' | 'specific'
  target_org_ids: string[] | null
  status: 'draft' | 'scheduled' | 'sent'
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
}

export type OrgOption = {
  id: string
  name: string
}

type Props = {
  notifications: GlobalNotification[]
  total: number
  organizations: OrgOption[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_META: Record<GlobalNotification['type'], { label: string; color: string; icon: React.ElementType }> = {
  info:    { label: 'Info',      color: 'bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-800 dark:text-sky-400',      icon: Bell },
  warning: { label: 'Aviso',     color: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400', icon: AlertCircle },
  success: { label: 'Exito',     color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400', icon: CheckCircle2 },
  danger:  { label: 'Urgente',   color: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800 dark:text-rose-400',    icon: AlertCircle },
}

const STATUS_META: Record<GlobalNotification['status'], { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: 'Borrador',  color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',              icon: FileText },
  scheduled: { label: 'Programada', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',     icon: Clock },
  sent:      { label: 'Enviada',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',  icon: CheckCircle2 },
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

const EMPTY_FORM = {
  title: '',
  body: '',
  type: 'info' as GlobalNotification['type'],
  target: 'all' as GlobalNotification['target'],
  target_org_ids: [] as string[],
  status: 'draft' as GlobalNotification['status'],
  scheduled_at: '',
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NotificationsDashboard({ notifications: initial, total: initialTotal, organizations }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notifications, setNotifications] = useState(initial)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GlobalNotification | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GlobalNotification | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stats
  const totalSent = notifications.filter(n => n.status === 'sent').length
  const totalScheduled = notifications.filter(n => n.status === 'scheduled').length
  const totalDraft = notifications.filter(n => n.status === 'draft').length

  const displayed = statusFilter === 'all'
    ? notifications
    : notifications.filter(n => n.status === statusFilter)

  // -------------------------------------------------------------------------
  // Open form
  // -------------------------------------------------------------------------
  const openCreate = useCallback(() => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setError(null)
    setSheetOpen(true)
  }, [])

  const openEdit = useCallback((n: GlobalNotification) => {
    setEditTarget(n)
    setForm({
      title: n.title,
      body: n.body,
      type: n.type,
      target: n.target,
      target_org_ids: n.target_org_ids ?? [],
      status: n.status,
      scheduled_at: n.scheduled_at ? n.scheduled_at.slice(0, 16) : '',
    })
    setError(null)
    setSheetOpen(true)
  }, [])

  // -------------------------------------------------------------------------
  // Save (create or update)
  // -------------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setError('El titulo y el cuerpo son obligatorios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        target_org_ids: form.target === 'specific' ? form.target_org_ids : [],
        scheduled_at: form.status === 'scheduled' && form.scheduled_at ? form.scheduled_at : null,
      }

      const url = editTarget
        ? `/api/superadmin/notifications/${editTarget.id}`
        : '/api/superadmin/notifications'
      const method = editTarget ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? 'Error al guardar.')
      }

      const saved = await res.json() as GlobalNotification
      setNotifications(prev =>
        editTarget
          ? prev.map(n => n.id === saved.id ? saved : n)
          : [saved, ...prev]
      )
      setSheetOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setSaving(false)
    }
  }, [form, editTarget])

  // -------------------------------------------------------------------------
  // Send now
  // -------------------------------------------------------------------------
  const handleSendNow = useCallback(async (n: GlobalNotification) => {
    try {
      const res = await fetch(`/api/superadmin/notifications/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      })
      if (!res.ok) return
      const updated = await res.json() as GlobalNotification
      setNotifications(prev => prev.map(x => x.id === updated.id ? updated : x))
    } catch { /* ignore */ }
  }, [])

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/superadmin/notifications/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) return
      setNotifications(prev => prev.filter(n => n.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch { /* ignore */ }
    finally { setDeleting(false) }
  }, [deleteTarget])

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------
  const handleRefresh = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  // -------------------------------------------------------------------------
  // Org toggle
  // -------------------------------------------------------------------------
  const toggleOrg = useCallback((orgId: string) => {
    setForm(prev => ({
      ...prev,
      target_org_ids: prev.target_org_ids.includes(orgId)
        ? prev.target_org_ids.filter(id => id !== orgId)
        : [...prev.target_org_ids, orgId],
    }))
  }, [])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Notificaciones globales
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Crea y administra notificaciones para todos los tenants o grupos especificos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isPending} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
            Actualizar
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nueva notificacion
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: notifications.length, icon: BellRing, color: 'text-indigo-500' },
          { label: 'Enviadas', value: totalSent, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Programadas', value: totalScheduled, icon: Clock, color: 'text-violet-500' },
          { label: 'Borradores', value: totalDraft, icon: FileText, color: 'text-slate-400' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-slate-200/80 dark:border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
                <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">{stat.label}</CardTitle>
                <Icon className={cn('h-4 w-4', stat.color)} />
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{stat.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(['all', 'sent', 'scheduled', 'draft'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            )}
          >
            {s === 'all' ? 'Todas' : STATUS_META[s].label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-0">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <BellOff className="h-10 w-10 opacity-30" />
              <p className="text-sm">Sin notificaciones {statusFilter !== 'all' ? 'con este filtro' : 'todavia'}.</p>
              {statusFilter === 'all' && (
                <Button variant="outline" size="sm" onClick={openCreate}>
                  Crear primera notificacion
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayed.map(n => {
                const TypeIcon = TYPE_META[n.type].icon
                const StatusIcon = STATUS_META[n.status].icon
                const orgCount = n.target_org_ids?.length ?? 0
                return (
                  <div key={n.id} className="flex flex-wrap items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', TYPE_META[n.type].color)}>
                      <TypeIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{n.title}</p>
                        <Badge variant="outline" className={cn('h-5 rounded px-1.5 text-[10px]', TYPE_META[n.type].color)}>
                          {TYPE_META[n.type].label}
                        </Badge>
                        <Badge variant="outline" className={cn('h-5 rounded px-1.5 text-[10px]', STATUS_META[n.status].color)}>
                          <StatusIcon className="mr-1 h-2.5 w-2.5" />
                          {STATUS_META[n.status].label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          {n.target === 'all' ? <Globe className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                          {n.target === 'all' ? 'Todos los tenants' : `${orgCount} organizacion${orgCount !== 1 ? 'es' : ''}`}
                        </span>
                        {n.status === 'sent' && n.sent_at && (
                          <span className="flex items-center gap-1">
                            <Send className="h-3 w-3" />
                            {fmt(n.sent_at)}
                          </span>
                        )}
                        {n.status === 'scheduled' && n.scheduled_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {fmt(n.scheduled_at)}
                          </span>
                        )}
                        {n.status === 'draft' && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Creada {fmt(n.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {n.status !== 'sent' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30"
                          onClick={() => handleSendNow(n)}
                        >
                          <Send className="h-3 w-3" />
                          Enviar
                        </Button>
                      )}
                      {n.status !== 'sent' && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => openEdit(n)}>
                          Editar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                        onClick={() => setDeleteTarget(n)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>{editTarget ? 'Editar notificacion' : 'Nueva notificacion'}</SheetTitle>
            <SheetDescription>
              {editTarget ? 'Modifica los datos de esta notificacion.' : 'Redacta una notificacion para enviar a tus tenants.'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="notif-title">Titulo</Label>
              <Input
                id="notif-title"
                placeholder="Ej: Mantenimiento programado"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-body">Mensaje</Label>
              <Textarea
                id="notif-body"
                placeholder="Escribe el cuerpo de la notificacion..."
                rows={4}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as GlobalNotification['type'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Aviso</SelectItem>
                    <SelectItem value="success">Exito</SelectItem>
                    <SelectItem value="danger">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as GlobalNotification['status'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="scheduled">Programada</SelectItem>
                    <SelectItem value="sent">Enviar ahora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.status === 'scheduled' && (
              <div className="space-y-1.5">
                <Label htmlFor="notif-scheduled">Fecha y hora de envio</Label>
                <Input
                  id="notif-scheduled"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Destino</Label>
              <Select value={form.target} onValueChange={v => setForm(f => ({ ...f, target: v as GlobalNotification['target'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tenants</SelectItem>
                  <SelectItem value="specific">Organizaciones especificas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.target === 'specific' && (
              <div className="space-y-1.5">
                <Label>Seleccionar organizaciones</Label>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  {organizations.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">Sin organizaciones disponibles.</p>
                  ) : (
                    organizations.map(org => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => toggleOrg(org.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                          form.target_org_ids.includes(org.id)
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                        )}
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 truncate">{org.name}</span>
                        {form.target_org_ids.includes(org.id) && (
                          <X className="h-3 w-3 text-indigo-500" />
                        )}
                      </button>
                    ))
                  )}
                </div>
                {form.target_org_ids.length > 0 && (
                  <p className="text-[11px] text-slate-400">{form.target_org_ids.length} organizacion{form.target_org_ids.length !== 1 ? 'es' : ''} seleccionada{form.target_org_ids.length !== 1 ? 's' : ''}.</p>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {form.status === 'sent' ? 'Enviar ahora' : 'Guardar'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar notificacion</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>¿Seguro que deseas eliminar <strong>&quot;{deleteTarget.title}&quot;</strong>? Esta accion no se puede deshacer.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
