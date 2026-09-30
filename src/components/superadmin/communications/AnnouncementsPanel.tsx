'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CalendarClock,
  Copy,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
import { cn } from '@/lib/utils'
import type { Announcement, AnnouncementStatus, AnnouncementType } from '@/lib/superadmin/communications'

const TYPE_META: Record<AnnouncementType, { label: string; dot: string; card: string }> = {
  info: { label: 'Información', dot: 'bg-blue-500', card: 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30' },
  success: { label: 'Novedad', dot: 'bg-emerald-500', card: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30' },
  warning: { label: 'Aviso', dot: 'bg-amber-500', card: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30' },
  danger: { label: 'Urgente', dot: 'bg-red-500', card: 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30' },
}

const STATUS_META: Record<AnnouncementStatus, { label: string; badge: string }> = {
  sent: { label: 'Publicado', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' },
  scheduled: { label: 'Programado', badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300' },
  draft: { label: 'Borrador', badge: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' },
}

const TEMPLATES: Array<{ name: string; type: AnnouncementType; title: string; body: string }> = [
  { name: 'Mantenimiento', type: 'warning', title: 'Mantenimiento programado de la plataforma', body: 'El próximo domingo entre las 02:00 y las 04:00 realizaremos mejoras en los servidores. El servicio podría tener breves interrupciones. Gracias por tu comprensión.' },
  { name: 'Novedad', type: 'success', title: '¡Nuevas funciones disponibles!', body: 'Lanzamos mejoras en el sistema. Entrá al panel para conocer las novedades.' },
  { name: 'Facturación', type: 'info', title: 'Recordatorio sobre pagos y planes', body: 'Los cobros mensuales se procesan en los primeros días del mes. Revisá tus datos de pago en Suscripción para evitar pausas en el servicio.' },
  { name: 'Incidente resuelto', type: 'success', title: 'Servicio restablecido', body: 'La intermitencia de las últimas horas ya está resuelta. Todos los módulos funcionan con normalidad.' },
]

type Mode = 'now' | 'schedule' | 'draft'
type FormState = {
  id: string | null
  title: string
  body: string
  type: AnnouncementType
  target: 'all' | 'specific'
  targetOrgIds: string[]
  mode: Mode
  scheduledAt: string
}

const EMPTY_FORM: FormState = { id: null, title: '', body: '', type: 'info', target: 'all', targetOrgIds: [], mode: 'now', scheduledAt: '' }

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'medium', timeStyle: 'short' })
}

function statusLine(a: Announcement): string {
  if (a.status === 'sent') return `Publicado ${formatDate(a.sentAt)}`
  if (a.status === 'scheduled') return `Se publica ${formatDate(a.scheduledAt)}`
  return `Borrador creado ${formatDate(a.createdAt)}`
}

async function callApi(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(payload?.error ?? 'No se pudo completar la acción')
}

function AnnouncementPreview({ title, body, type }: { title: string; body: string; type: AnnouncementType }) {
  return (
    <div className={cn('rounded-xl border p-4', TYPE_META[type].card)}>
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span className={cn('h-2 w-2 rounded-full', TYPE_META[type].dot)} />
        {title || 'Título del aviso'}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{body || 'Así lo van a ver las tiendas en su campana de notificaciones.'}</p>
    </div>
  )
}

export function AnnouncementsPanel({
  announcements,
  organizations,
}: {
  announcements: Announcement[]
  organizations: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | AnnouncementStatus>('all')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [orgQuery, setOrgQuery] = useState('')
  const [preview, setPreview] = useState<Announcement | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'publish' | 'delete'; item: Announcement } | null>(null)
  const [pending, startTransition] = useTransition()

  const orgNames = useMemo(() => new Map(organizations.map((o) => [o.id, o.name])), [organizations])
  const counts = useMemo(() => ({
    all: announcements.length,
    sent: announcements.filter((a) => a.status === 'sent').length,
    scheduled: announcements.filter((a) => a.status === 'scheduled').length,
    draft: announcements.filter((a) => a.status === 'draft').length,
  }), [announcements])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return announcements.filter((a) =>
      (filter === 'all' || a.status === filter) &&
      (!q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)),
    )
  }, [announcements, filter, query])

  const audience = (a: Pick<Announcement, 'target' | 'targetOrgIds'>) =>
    a.target === 'all'
      ? 'Todas las tiendas'
      : a.targetOrgIds.length === 1
        ? orgNames.get(a.targetOrgIds[0]) ?? '1 tienda'
        : `${a.targetOrgIds.length} tiendas`

  const openEdit = (a: Announcement, duplicate = false) =>
    setForm({
      id: duplicate ? null : a.id,
      title: duplicate ? `${a.title} (copia)`.slice(0, 160) : a.title,
      body: a.body,
      type: a.type,
      target: a.target,
      targetOrgIds: a.targetOrgIds,
      mode: duplicate ? 'draft' : a.status === 'scheduled' ? 'schedule' : a.status === 'draft' ? 'draft' : 'now',
      scheduledAt: toLocalInput(a.scheduledAt),
    })

  const run = (work: () => Promise<void>, success: string) =>
    startTransition(async () => {
      try {
        await work()
        toast.success(success)
        setForm(null)
        setConfirm(null)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error inesperado')
      }
    })

  const save = () => {
    if (!form) return
    if (form.mode === 'schedule' && !form.scheduledAt) {
      toast.error('Elegí la fecha y hora de publicación')
      return
    }
    const payload = {
      title: form.title,
      body: form.body,
      type: form.type,
      target: form.target,
      target_org_ids: form.target === 'specific' ? form.targetOrgIds : null,
      status: form.mode === 'now' ? 'sent' : form.mode === 'schedule' ? 'scheduled' : 'draft',
      scheduled_at: form.mode === 'schedule' ? new Date(form.scheduledAt).toISOString() : null,
    }
    run(
      () => form.id ? callApi(`/api/superadmin/notifications/${form.id}`, 'PATCH', payload) : callApi('/api/superadmin/notifications', 'POST', payload),
      form.mode === 'now' ? 'Aviso publicado' : form.mode === 'schedule' ? 'Aviso programado' : 'Borrador guardado',
    )
  }

  const filteredOrgs = organizations.filter((o) => o.name.toLowerCase().includes(orgQuery.trim().toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por estado">
          {([['all', 'Todos'], ['sent', 'Publicados'], ['scheduled', 'Programados'], ['draft', 'Borradores']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                filter === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
              )}
            >
              {label} <span className="tabular-nums opacity-70">{counts[value]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar aviso" className="pl-8" aria-label="Buscar aviso" />
          </div>
          <Button onClick={() => setForm({ ...EMPTY_FORM })}><Plus className="h-4 w-4" /> Nuevo aviso</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card className="rounded-xl"><CardContent className="p-10 text-center text-sm text-slate-500">
          {announcements.length === 0 ? 'Todavía no enviaste avisos. Los avisos aparecen en la campana de notificaciones de cada tienda.' : 'Ningún aviso coincide con el filtro.'}
        </CardContent></Card>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => (
            <li key={a.id}>
              <Card className="rounded-xl">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => setPreview(a)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', TYPE_META[a.type].dot)} aria-label={TYPE_META[a.type].label} />
                      <span className="truncate">{a.title}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{a.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {audience(a)} · {statusLine(a)}
                      {a.status === 'sent' && ` · ${a.readCount} lectura${a.readCount === 1 ? '' : 's'}`}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Badge variant="outline" className={cn('rounded-full', STATUS_META[a.status].badge)}>{STATUS_META[a.status].label}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Acciones de ${a.title}`}><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPreview(a)}><Eye className="h-4 w-4" /> Ver</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(a, true)}><Copy className="h-4 w-4" /> Duplicar</DropdownMenuItem>
                        {a.status !== 'sent' && (
                          <DropdownMenuItem onClick={() => setConfirm({ kind: 'publish', item: a })}><Send className="h-4 w-4" /> Publicar ahora</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => setConfirm({ kind: 'delete', item: a })}><Trash2 className="h-4 w-4" /> Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Editor */}
      <Sheet open={form !== null} onOpenChange={(open) => { if (!open) setForm(null) }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {form && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{form.id ? 'Editar aviso' : 'Nuevo aviso'}</SheetTitle>
                <SheetDescription>Aparece en la campana de notificaciones del panel de cada tienda.</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4">
                {!form.id && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Empezar desde una plantilla</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATES.map((t) => (
                        <button key={t.name} type="button" onClick={() => setForm({ ...form, title: t.title, body: t.body, type: t.type })}
                          className="rounded-full border px-2.5 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="announcement-title">Título</Label>
                  <Input id="announcement-title" value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="announcement-body">Mensaje</Label>
                  <Textarea id="announcement-body" value={form.body} maxLength={5000} rows={5} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                  <p className="text-right text-xs text-slate-500">{form.body.length}/5000</p>
                </div>
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium">Tipo</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(TYPE_META) as AnnouncementType[]).map((type) => (
                      <button key={type} type="button" aria-pressed={form.type === type} onClick={() => setForm({ ...form, type })}
                        className={cn('flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm', form.type === type ? 'border-primary ring-1 ring-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40')}>
                        <span className={cn('h-2 w-2 rounded-full', TYPE_META[type].dot)} /> {TYPE_META[type].label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">¿A quién?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {([['all', 'Todas las tiendas'], ['specific', 'Algunas tiendas']] as const).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={form.target === value} onClick={() => setForm({ ...form, target: value })}
                        className={cn('rounded-lg border px-3 py-2 text-sm', form.target === value ? 'border-primary ring-1 ring-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40')}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.target === 'specific' && (
                    <div className="space-y-2 rounded-lg border p-2 dark:border-slate-800">
                      <Input value={orgQuery} onChange={(e) => setOrgQuery(e.target.value)} placeholder="Buscar tienda" aria-label="Buscar tienda" />
                      <ul className="max-h-48 space-y-1 overflow-y-auto">
                        {filteredOrgs.map((org) => {
                          const checked = form.targetOrgIds.includes(org.id)
                          return (
                            <li key={org.id}>
                              <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <Checkbox checked={checked} onCheckedChange={() => setForm({
                                  ...form,
                                  targetOrgIds: checked ? form.targetOrgIds.filter((id) => id !== org.id) : [...form.targetOrgIds, org.id],
                                })} />
                                {org.name}
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                      <p className="text-xs text-slate-500">{form.targetOrgIds.length} seleccionada{form.targetOrgIds.length === 1 ? '' : 's'}</p>
                    </div>
                  )}
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">¿Cuándo?</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {([['now', 'Publicar ya'], ['schedule', 'Programar'], ['draft', 'Borrador']] as const).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={form.mode === value} onClick={() => setForm({ ...form, mode: value })}
                        className={cn('rounded-lg border px-2 py-2 text-sm', form.mode === value ? 'border-primary ring-1 ring-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40')}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.mode === 'schedule' && (
                    <div className="space-y-1">
                      <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} aria-label="Fecha y hora de publicación" />
                      <p className="flex items-center gap-1 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" /> Se publica cuando llega la hora, la primera vez que una tienda abre su panel.</p>
                    </div>
                  )}
                </fieldset>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Vista previa</p>
                  <AnnouncementPreview title={form.title} body={form.body} type={form.type} />
                </div>
              </div>
              <SheetFooter className="flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => setForm(null)} disabled={pending}>Cancelar</Button>
                <Button onClick={save} disabled={pending || !form.title.trim() || !form.body.trim() || (form.target === 'specific' && form.targetOrgIds.length === 0)}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {form.mode === 'now' ? 'Publicar' : form.mode === 'schedule' ? 'Programar' : 'Guardar borrador'}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Detalle */}
      <Sheet open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null) }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {preview && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{preview.title}</SheetTitle>
                <SheetDescription>{statusLine(preview)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <AnnouncementPreview title={preview.title} body={preview.body} type={preview.type} />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-slate-500">Destino</dt><dd className="font-medium">{audience(preview)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Tipo</dt><dd className="font-medium">{TYPE_META[preview.type].label}</dd></div>
                  <div><dt className="text-xs text-slate-500">Lecturas</dt><dd className="font-medium tabular-nums">{preview.readCount}</dd></div>
                  <div><dt className="text-xs text-slate-500">Descartadas</dt><dd className="font-medium tabular-nums">{preview.dismissedCount}</dd></div>
                </dl>
                {preview.target === 'specific' && (
                  <div>
                    <p className="text-xs text-slate-500">Tiendas</p>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {preview.targetOrgIds.map((id) => <li key={id}><Badge variant="outline" className="rounded-full">{orgNames.get(id) ?? 'Tienda eliminada'}</Badge></li>)}
                    </ul>
                  </div>
                )}
                <Button variant="outline" onClick={() => { const item = preview; setPreview(null); openEdit(item) }}><Pencil className="h-4 w-4" /> Editar</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => { if (!open) setConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === 'delete' ? '¿Eliminar este aviso?' : '¿Publicar ahora?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'delete'
                ? `«${confirm.item.title}» desaparece de las campanas de las tiendas. No se puede deshacer.`
                : `«${confirm?.item.title}» se muestra de inmediato a ${confirm ? audience(confirm.item).toLowerCase() : ''}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className={confirm?.kind === 'delete' ? 'bg-red-600 hover:bg-red-700' : undefined}
              onClick={(e) => {
                e.preventDefault()
                if (!confirm) return
                const { item, kind } = confirm
                if (kind === 'delete') run(() => callApi(`/api/superadmin/notifications/${item.id}`, 'DELETE'), 'Aviso eliminado')
                else run(() => callApi(`/api/superadmin/notifications/${item.id}`, 'PATCH', { status: 'sent', scheduled_at: null }), 'Aviso publicado')
              }}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirm?.kind === 'delete' ? 'Eliminar' : 'Publicar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
