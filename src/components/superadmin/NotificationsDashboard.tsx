'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Building2,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Globe,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wrench,
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
import { Pagination } from '@/components/ui/pagination'
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
  read_count?: number
  dismissed_count?: number
}

export type OrgOption = {
  id: string
  name: string
  slug?: string
}

type Props = {
  notifications: GlobalNotification[]
  total: number
  organizations: OrgOption[]
}

// ---------------------------------------------------------------------------
// Constants & Templates
// ---------------------------------------------------------------------------

const TYPE_META: Record<
  GlobalNotification['type'],
  {
    label: string
    badgeClass: string
    cardBorder: string
    bgLight: string
    iconColor: string
    icon: React.ElementType
  }
> = {
  info: {
    label: 'Información',
    badgeClass: 'bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-800 dark:text-sky-400',
    cardBorder: 'border-l-sky-500',
    bgLight: 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800',
    iconColor: 'text-sky-600 dark:text-sky-400',
    icon: Bell,
  },
  warning: {
    label: 'Aviso',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400',
    cardBorder: 'border-l-amber-500',
    bgLight: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
  },
  success: {
    label: 'Éxito',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400',
    cardBorder: 'border-l-emerald-500',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  danger: {
    label: 'Urgente',
    badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800 dark:text-rose-400',
    cardBorder: 'border-l-rose-500',
    bgLight: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800',
    iconColor: 'text-rose-600 dark:text-rose-400',
    icon: AlertCircle,
  },
}

const STATUS_META: Record<
  GlobalNotification['status'],
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  draft: {
    label: 'Borrador',
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    icon: FileText,
  },
  scheduled: {
    label: 'Programada',
    badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    icon: Clock,
  },
  sent: {
    label: 'Enviada',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle2,
  },
}

const QUICK_TEMPLATES = [
  {
    name: 'Mantenimiento preventivo',
    icon: '🛠️',
    type: 'warning' as const,
    title: 'Mantenimiento programado de la plataforma',
    body: 'Estimado equipo: El próximo domingo entre las 02:00 y las 04:00 AM realizaremos mejoras en nuestros servidores. El servicio podría experimentar breves intermitencias. Agradecemos su comprensión.',
  },
  {
    name: 'Nueva actualización',
    icon: '🚀',
    type: 'success' as const,
    title: '¡Nueva versión disponible con mejoras!',
    body: 'Hemos lanzado nuevas funcionalidades en el sistema, optimizando la velocidad de respuesta, módulos de inventario y facturación. Consulta el registro de novedades en nuestro panel.',
  },
  {
    name: 'Aviso de facturación',
    icon: '💳',
    type: 'info' as const,
    title: 'Recordatorio importante sobre pagos y planes',
    body: 'Recuerda que los ciclos de facturación mensual se procesan automáticamente los primeros días del mes. Revisa tus datos de pago en la sección de Suscripción para evitar pausas en el servicio.',
  },
  {
    name: 'Incidencia técnica resuelta',
    icon: '✅',
    type: 'success' as const,
    title: 'Servicios 100% operativos tras incidencia',
    body: 'La intermitencia detectada en las últimas horas ha sido solucionada con éxito por nuestro equipo técnico. Todos los módulos y sincronizaciones operan con normalidad.',
  },
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-PY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function relativeTime(iso: string | null) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `hace ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days}d`
  return formatDate(iso)
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
// Notification Preview Component
// ---------------------------------------------------------------------------

function NotificationInAppPreview({
  title,
  body,
  type,
}: {
  title: string
  body: string
  type: GlobalNotification['type']
}) {
  const meta = TYPE_META[type]
  const Icon = meta.icon
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-4 shadow-xs transition-all',
        meta.bgLight
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background/80 shadow-2xs',
            meta.iconColor
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {title || 'Título de la notificación'}
            </h4>
            <Badge variant="outline" className={cn('text-[10px] uppercase font-bold', meta.badgeClass)}>
              {meta.label}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {body || 'Aquí se mostrará el cuerpo del mensaje que verán los usuarios en su panel...'}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[10px] text-slate-400 dark:border-slate-800">
            <span>Notificación de Sistema</span>
            <span>Ahora</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NotificationsDashboard({
  notifications: initial,
  organizations,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notifications, setNotifications] = useState(initial)

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [targetFilter, setTargetFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Modals & Sheets
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GlobalNotification | null>(null)
  const [detailTarget, setDetailTarget] = useState<GlobalNotification | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GlobalNotification | null>(null)
  const [sendNowTarget, setSendNowTarget] = useState<GlobalNotification | null>(null)

  // Form State
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sendingNow, setSendingNow] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [orgSearch, setOrgSearch] = useState('')

  // Map of organizations by ID for quick lookup
  const orgMap = useMemo(() => {
    const map = new Map<string, OrgOption>()
    organizations.forEach(o => map.set(o.id, o))
    return map
  }, [organizations])

  // Stats calculation
  const stats = useMemo(() => {
    const total = notifications.length
    const sent = notifications.filter(n => n.status === 'sent').length
    const scheduled = notifications.filter(n => n.status === 'scheduled').length
    const draft = notifications.filter(n => n.status === 'draft').length
    const totalReads = notifications.reduce((acc, n) => acc + (n.read_count ?? 0), 0)
    return { total, sent, scheduled, draft, totalReads }
  }, [notifications])

  // Filtering
  const filtered = useMemo(() => {
    return notifications.filter(n => {
      // Status filter
      if (statusFilter !== 'all' && n.status !== statusFilter) return false

      // Type filter
      if (typeFilter !== 'all' && n.type !== typeFilter) return false

      // Target filter
      if (targetFilter === 'all_tenants' && n.target !== 'all') return false
      if (targetFilter === 'specific_tenants' && n.target !== 'specific') return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = n.title.toLowerCase().includes(q)
        const matchBody = n.body.toLowerCase().includes(q)
        // Check if query matches any target org name
        const matchOrg =
          n.target_org_ids?.some(id => {
            const org = orgMap.get(id)
            return org && org.name.toLowerCase().includes(q)
          }) ?? false

        if (!matchTitle && !matchBody && !matchOrg) return false
      }

      return true
    })
  }, [notifications, statusFilter, typeFilter, targetFilter, searchQuery, orgMap])

  // Pagination items
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage, pageSize])

  // Reset page when filters change
  const handleFilterChange = useCallback((setter: (val: string) => void, val: string) => {
    setter(val)
    setCurrentPage(1)
  }, [])

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    targetFilter !== 'all'

  const handleClearFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter('all')
    setTypeFilter('all')
    setTargetFilter('all')
    setCurrentPage(1)
  }, [])

  // -------------------------------------------------------------------------
  // Form Open & Save Handlers
  // -------------------------------------------------------------------------
  const openCreate = useCallback(() => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setOrgSearch('')
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
    setFormError(null)
    setOrgSearch('')
    setSheetOpen(true)
  }, [])

  const handleDuplicate = useCallback((n: GlobalNotification) => {
    setEditTarget(null)
    setForm({
      title: `[Copia] ${n.title}`,
      body: n.body,
      type: n.type,
      target: n.target,
      target_org_ids: n.target_org_ids ?? [],
      status: 'draft',
      scheduled_at: '',
    })
    setFormError(null)
    setOrgSearch('')
    setSheetOpen(true)
  }, [])

  const handleApplyTemplate = useCallback((tpl: typeof QUICK_TEMPLATES[0]) => {
    setForm(prev => ({
      ...prev,
      title: tpl.title,
      body: tpl.body,
      type: tpl.type,
    }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      setFormError('El título es obligatorio.')
      return
    }
    if (form.title.length > 160) {
      setFormError('El título no puede exceder los 160 caracteres.')
      return
    }
    if (!form.body.trim()) {
      setFormError('El cuerpo del mensaje es obligatorio.')
      return
    }
    if (form.target === 'specific' && form.target_org_ids.length === 0) {
      setFormError('Selecciona al menos una organización de destino.')
      return
    }
    if (form.status === 'scheduled' && !form.scheduled_at) {
      setFormError('Ingresa la fecha y hora de programación.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        ...form,
        target_org_ids: form.target === 'specific' ? form.target_org_ids : [],
        scheduled_at:
          form.status === 'scheduled' && form.scheduled_at
            ? new Date(form.scheduled_at).toISOString()
            : null,
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
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Error al guardar la notificación.')
      }

      const saved = (await res.json()) as GlobalNotification
      setNotifications(prev =>
        editTarget ? prev.map(n => (n.id === saved.id ? saved : n)) : [saved, ...prev]
      )
      setSheetOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setSaving(false)
    }
  }, [form, editTarget])

  // -------------------------------------------------------------------------
  // Send Now Handler
  // -------------------------------------------------------------------------
  const executeSendNow = useCallback(async () => {
    if (!sendNowTarget) return
    setSendingNow(true)
    try {
      const res = await fetch(`/api/superadmin/notifications/${sendNowTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Error al enviar la notificación.')
      }
      const updated = (await res.json()) as GlobalNotification
      setNotifications(prev => prev.map(x => (x.id === updated.id ? updated : x)))
      if (detailTarget?.id === updated.id) {
        setDetailTarget(updated)
      }
      setSendNowTarget(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al enviar notificación')
    } finally {
      setSendingNow(false)
    }
  }, [sendNowTarget, detailTarget])

  // -------------------------------------------------------------------------
  // Delete Handler
  // -------------------------------------------------------------------------
  const executeDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/superadmin/notifications/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error al eliminar notificación.')
      setNotifications(prev => prev.filter(n => n.id !== deleteTarget.id))
      if (detailTarget?.id === deleteTarget.id) {
        setDetailTarget(null)
      }
      setDeleteTarget(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, detailTarget])

  // -------------------------------------------------------------------------
  // Refresh Handler
  // -------------------------------------------------------------------------
  const handleRefresh = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  // -------------------------------------------------------------------------
  // Org Selection Helpers
  // -------------------------------------------------------------------------
  const filteredOrgs = useMemo(() => {
    if (!orgSearch.trim()) return organizations
    const q = orgSearch.toLowerCase()
    return organizations.filter(o => o.name.toLowerCase().includes(q))
  }, [organizations, orgSearch])

  const toggleOrg = useCallback((orgId: string) => {
    setForm(prev => ({
      ...prev,
      target_org_ids: prev.target_org_ids.includes(orgId)
        ? prev.target_org_ids.filter(id => id !== orgId)
        : [...prev.target_org_ids, orgId],
    }))
  }, [])

  const selectAllOrgs = useCallback(() => {
    setForm(prev => ({
      ...prev,
      target_org_ids: organizations.map(o => o.id),
    }))
  }, [organizations])

  const clearAllOrgs = useCallback(() => {
    setForm(prev => ({
      ...prev,
      target_org_ids: [],
    }))
  }, [])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <BellRing className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Notificaciones Globales
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Crea, programa y difunde comunicados directos hacia todas tus organizaciones o clientes específicos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isPending}
            className="gap-1.5 h-9 font-semibold"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={openCreate}
            className="gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Nueva notificación
          </Button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Comunicados',
            value: stats.total,
            sub: 'creados en historial',
            icon: BellRing,
            color: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-indigo-50/50 dark:bg-indigo-950/20',
          },
          {
            label: 'Enviadas',
            value: stats.sent,
            sub: `${stats.totalReads} lecturas registradas`,
            icon: CheckCircle2,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
          },
          {
            label: 'Programadas',
            value: stats.scheduled,
            sub: 'envío automático futuro',
            icon: Clock,
            color: 'text-violet-600 dark:text-violet-400',
            bg: 'bg-violet-50/50 dark:bg-violet-950/20',
          },
          {
            label: 'Borradores',
            value: stats.draft,
            sub: 'en edición / sin publicar',
            icon: FileText,
            color: 'text-slate-600 dark:text-slate-400',
            bg: 'bg-slate-50/50 dark:bg-slate-800/30',
          },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.label}
              className="border-slate-200/80 shadow-2xs transition-all hover:shadow-xs dark:border-slate-800"
            >
              <CardContent className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-50">
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">{stat.sub}</p>
                </div>
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/60 dark:border-slate-800',
                    stat.bg,
                    stat.color
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Toolbar: Search, Filters & View Toggle */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-card p-3 shadow-2xs dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por título, contenido u organización..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="h-9 pl-9 pr-8 text-xs bg-slate-50/50 dark:bg-slate-900/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type Dropdown */}
          <div className="w-40">
            <Select
              value={typeFilter}
              onValueChange={v => handleFilterChange(setTypeFilter, v)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tipo de aviso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="info">Información</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="success">Éxito</SelectItem>
                <SelectItem value="danger">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target Audience Dropdown */}
          <div className="w-44">
            <Select
              value={targetFilter}
              onValueChange={v => handleFilterChange(setTargetFilter, v)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Audiencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las audiencias</SelectItem>
                <SelectItem value="all_tenants">Todos los tenants</SelectItem>
                <SelectItem value="specific_tenants">Específicos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              <List className="h-3.5 w-3.5" />
              Tabla
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Tarjetas
            </button>
          </div>
        </div>

        {/* Status Pills Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Todas', count: notifications.length },
              { id: 'sent', label: 'Enviadas', count: stats.sent },
              { id: 'scheduled', label: 'Programadas', count: stats.scheduled },
              { id: 'draft', label: 'Borradores', count: stats.draft },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleFilterChange(setStatusFilter, tab.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer',
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                    statusFilter === tab.id
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
            >
              <X className="mr-1 h-3 w-3" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {filtered.length === 0 ? (
        <Card className="border-dashed border-slate-200 dark:border-slate-800">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <BellOff className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
              No se encontraron notificaciones
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {hasActiveFilters
                ? 'Ningún registro coincide con los filtros aplicados. Intenta restablecer los filtros de búsqueda.'
                : 'Todavía no se ha registrado ninguna notificación en el sistema.'}
            </p>
            {hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="mt-4 text-xs"
              >
                Limpiar filtros
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={openCreate}
                className="mt-4 gap-1.5 bg-indigo-600 text-xs text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear primera notificación
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <Card className="overflow-hidden border-slate-200/80 shadow-2xs dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
                <tr>
                  <th className="py-2.5 pl-4 pr-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Tipo & Estado
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Título & Mensaje
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Audiencia
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Lecturas
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Fecha
                  </th>
                  <th className="py-2.5 pl-2 pr-4 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedItems.map(n => {
                  const typeMeta = TYPE_META[n.type]
                  const statusMeta = STATUS_META[n.status]
                  const TypeIcon = typeMeta.icon
                  const StatusIcon = statusMeta.icon
                  const orgCount = n.target_org_ids?.length ?? 0

                  return (
                    <tr
                      key={n.id}
                      onClick={() => setDetailTarget(n)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80 even:bg-slate-50/40 dark:hover:bg-slate-800/40 dark:even:bg-slate-900/20"
                    >
                      {/* Tipo & Estado */}
                      <td className="py-2 pl-4 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold gap-1', typeMeta.badgeClass)}
                          >
                            <TypeIcon className="h-3 w-3" />
                            {typeMeta.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold gap-1', statusMeta.badgeClass)}
                          >
                            <StatusIcon className="h-2.5 w-2.5" />
                            {statusMeta.label}
                          </Badge>
                        </div>
                      </td>

                      {/* Título & Mensaje */}
                      <td className="px-3 py-2 max-w-sm sm:max-w-md">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs">
                          {n.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {n.body}
                        </p>
                      </td>

                      {/* Audiencia */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {n.target === 'all' ? (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                            <Globe className="h-3.5 w-3.5 text-indigo-500" />
                            <span>Todos los tenants</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-500" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {orgCount} organizacion{orgCount !== 1 ? 'es' : ''}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Lecturas */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {n.status === 'sent' ? (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="font-bold">{n.read_count ?? 0}</span>
                            <span className="text-[10px] text-slate-400">leídas</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Fecha */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          {n.status === 'sent' && n.sent_at
                            ? relativeTime(n.sent_at)
                            : n.status === 'scheduled' && n.scheduled_at
                            ? formatDate(n.scheduled_at)
                            : relativeTime(n.created_at)}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {n.status === 'sent' ? 'Enviado' : n.status === 'scheduled' ? 'Programado' : 'Creado'}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td
                        className="py-2 pl-2 pr-4 text-right whitespace-nowrap"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md text-slate-500 hover:text-indigo-600"
                            title="Ver detalle / Previsualizar"
                            onClick={() => setDetailTarget(n)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {n.status !== 'sent' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              title="Enviar ahora"
                              onClick={() => setSendNowTarget(n)}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md text-slate-500 hover:text-indigo-600"
                            title="Duplicar como borrador"
                            onClick={() => handleDuplicate(n)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>

                          {n.status !== 'sent' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md text-slate-500 hover:text-violet-600"
                              title="Editar"
                              onClick={() => openEdit(n)}
                            >
                              <Wrench className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Eliminar"
                            onClick={() => setDeleteTarget(n)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={pageSize}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setPageSize}
              itemsPerPageOptions={[10, 15, 25, 50]}
            />
          </div>
        </Card>
      ) : (
        /* CARDS / TIMELINE VIEW */
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedItems.map(n => {
              const typeMeta = TYPE_META[n.type]
              const statusMeta = STATUS_META[n.status]
              const TypeIcon = typeMeta.icon
              const StatusIcon = statusMeta.icon
              const orgCount = n.target_org_ids?.length ?? 0

              return (
                <Card
                  key={n.id}
                  className={cn(
                    'flex flex-col border-l-4 shadow-2xs transition-all hover:shadow-md cursor-pointer dark:border-slate-800',
                    typeMeta.cardBorder
                  )}
                  onClick={() => setDetailTarget(n)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold gap-1', typeMeta.badgeClass)}
                      >
                        <TypeIcon className="h-3 w-3" />
                        {typeMeta.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold gap-1', statusMeta.badgeClass)}
                      >
                        <StatusIcon className="h-2.5 w-2.5" />
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                      {n.title}
                    </CardTitle>
                    <p className="text-[10px] text-slate-400">
                      {n.status === 'sent' && n.sent_at
                        ? `Enviado ${relativeTime(n.sent_at)}`
                        : n.status === 'scheduled' && n.scheduled_at
                        ? `Programado para ${formatDate(n.scheduled_at)}`
                        : `Creado ${relativeTime(n.created_at)}`}
                    </p>
                  </CardHeader>

                  <CardContent className="flex-1 p-4 pt-0">
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                      {n.body}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        {n.target === 'all' ? (
                          <>
                            <Globe className="h-3 w-3 text-indigo-500" />
                            <span>Todos los tenants</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="h-3 w-3 text-slate-500" />
                            <span>{orgCount} organizaciones</span>
                          </>
                        )}
                      </div>

                      {n.status === 'sent' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCheck className="h-3.5 w-3.5" />
                          {n.read_count ?? 0} leídas
                        </span>
                      )}
                    </div>
                  </CardContent>

                  {/* Card Actions Footer */}
                  <div
                    className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-2.5 px-4 dark:border-slate-800 dark:bg-slate-900/40"
                    onClick={e => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs font-semibold text-slate-600 hover:text-indigo-600"
                      onClick={() => setDetailTarget(n)}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Detalles
                    </Button>

                    <div className="flex items-center gap-1">
                      {n.status !== 'sent' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          title="Enviar ahora"
                          onClick={() => setSendNowTarget(n)}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md text-slate-500 hover:text-indigo-600"
                        title="Duplicar como borrador"
                        onClick={() => handleDuplicate(n)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {n.status !== 'sent' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-slate-500 hover:text-violet-600"
                          title="Editar"
                          onClick={() => openEdit(n)}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Eliminar"
                        onClick={() => setDeleteTarget(n)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Cards Pagination */}
          <Card className="border-slate-200/80 dark:border-slate-800">
            <CardContent className="p-3">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={pageSize}
                totalItems={filtered.length}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setPageSize}
                itemsPerPageOptions={[10, 15, 25, 50]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Create / Edit Sheet                                                 */}
      {/* ------------------------------------------------------------------- */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl overflow-hidden p-0">
          <SheetHeader className="border-b p-5 pr-12 text-left bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-black">
                  {editTarget ? 'Editar Notificación' : 'Nueva Notificación Global'}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {editTarget
                    ? 'Actualiza los parámetros o el alcance de este comunicado.'
                    : 'Redacta un anuncio para todos los tenants o clientes específicos.'}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {/* Quick Templates Picker (only when creating or draft) */}
            {!editTarget && (
              <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 dark:border-indigo-950/50 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    Plantillas rápidas
                  </span>
                  <span className="text-[10px] text-indigo-500">Un clic para autocompletar</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="flex items-center gap-2 rounded-lg border border-indigo-200/60 bg-white p-2 text-left text-xs font-medium text-slate-700 shadow-2xs hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer transition-all"
                    >
                      <span className="text-base">{tpl.icon}</span>
                      <span className="truncate text-[11px]">{tpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title with Character Counter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-title" className="text-xs font-bold">
                  Título del anuncio *
                </Label>
                <span
                  className={cn(
                    'text-[10px] font-mono',
                    form.title.length > 140
                      ? 'text-amber-500 font-bold'
                      : 'text-slate-400'
                  )}
                >
                  {form.title.length}/160
                </span>
              </div>
              <Input
                id="notif-title"
                placeholder="Ej: Mantenimiento programado el fin de semana"
                maxLength={160}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="text-xs"
              />
            </div>

            {/* Body with Character Counter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-body" className="text-xs font-bold">
                  Mensaje detallado *
                </Label>
                <span className="text-[10px] font-mono text-slate-400">
                  {form.body.length}/5000
                </span>
              </div>
              <Textarea
                id="notif-body"
                placeholder="Escribe el mensaje que verán los usuarios en su barra de notificaciones..."
                rows={4}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                className="text-xs leading-relaxed"
              />
            </div>

            {/* Type and Status Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Tipo de Notificación</Label>
                <Select
                  value={form.type}
                  onValueChange={v =>
                    setForm(f => ({ ...f, type: v as GlobalNotification['type'] }))
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">
                      <span className="flex items-center gap-2">
                        <Bell className="h-3.5 w-3.5 text-sky-500" />
                        Información
                      </span>
                    </SelectItem>
                    <SelectItem value="warning">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        Aviso
                      </span>
                    </SelectItem>
                    <SelectItem value="success">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        Éxito
                      </span>
                    </SelectItem>
                    <SelectItem value="danger">
                      <span className="flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                        Urgente
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Acción / Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={v =>
                    setForm(f => ({ ...f, status: v as GlobalNotification['status'] }))
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador (Guardar sin enviar)</SelectItem>
                    <SelectItem value="scheduled">Programar para fecha futura</SelectItem>
                    <SelectItem value="sent">Enviar inmediatamente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scheduled Datetime */}
            {form.status === 'scheduled' && (
              <div className="space-y-1.5 rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
                <Label htmlFor="notif-scheduled" className="text-xs font-bold text-violet-900 dark:text-violet-300">
                  Fecha y hora de envío automático *
                </Label>
                <Input
                  id="notif-scheduled"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="text-xs bg-white dark:bg-slate-900"
                />
                <p className="text-[10px] text-violet-600 dark:text-violet-400">
                  El cron de despacho enviará la notificación cuando se alcance esta fecha.
                </p>
              </div>
            )}

            {/* Target Audience */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">Audiencia de Destino</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, target: 'all', target_org_ids: [] }))}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-all cursor-pointer',
                    form.target === 'all'
                      ? 'border-indigo-600 bg-indigo-50/60 font-bold text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                  )}
                >
                  <Globe className="h-4 w-4 text-indigo-500" />
                  <div>
                    <p className="font-bold">Todos los tenants</p>
                    <p className="text-[10px] text-slate-400 font-normal">Todas las empresas registradas</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, target: 'specific' }))}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-all cursor-pointer',
                    form.target === 'specific'
                      ? 'border-indigo-600 bg-indigo-50/60 font-bold text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                  )}
                >
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <div>
                    <p className="font-bold">Específicas</p>
                    <p className="text-[10px] text-slate-400 font-normal">Seleccionar organizaciones</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Specific Org Selector */}
            {form.target === 'specific' && (
              <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Organizaciones seleccionadas ({form.target_org_ids.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllOrgs}
                      className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Todas ({organizations.length})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={clearAllOrgs}
                      className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Filtrar por nombre de empresa..."
                    value={orgSearch}
                    onChange={e => setOrgSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-slate-50 dark:bg-slate-900"
                  />
                </div>

                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1.5 dark:border-slate-800">
                  {filteredOrgs.length === 0 ? (
                    <p className="py-3 text-center text-xs text-slate-400">
                      No se encontraron organizaciones.
                    </p>
                  ) : (
                    filteredOrgs.map(org => {
                      const isSelected = form.target_org_ids.includes(org.id)
                      return (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => toggleOrg(org.id)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer',
                            isSelected
                              ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                          )}
                        >
                          <span className="truncate">{org.name}</span>
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* Realtime Live Preview */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500">
                Previsualización en tiempo real (Vista del Tenant)
              </Label>
              <NotificationInAppPreview
                title={form.title}
                body={form.body}
                type={form.type}
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t p-4 bg-slate-50/50 dark:bg-slate-900/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSheetOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {form.status === 'sent'
                ? 'Enviar Inmediatamente'
                : form.status === 'scheduled'
                ? 'Programar Envío'
                : 'Guardar Borrador'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------------------- */}
      {/* Detail / In-App Preview Dialog                                      */}
      {/* ------------------------------------------------------------------- */}
      <Dialog
        open={!!detailTarget}
        onOpenChange={open => {
          if (!open) setDetailTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {detailTarget && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-base font-black">
                    Detalle de Notificación
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-bold gap-1',
                      STATUS_META[detailTarget.status].badgeClass
                    )}
                  >
                    {STATUS_META[detailTarget.status].label}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  ID: {detailTarget.id}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Visual In-App Card */}
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Así la ven los usuarios:
                  </p>
                  <NotificationInAppPreview
                    title={detailTarget.title}
                    body={detailTarget.body}
                    type={detailTarget.type}
                  />
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Audiencia</p>
                    <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">
                      {detailTarget.target === 'all'
                        ? 'Todos los tenants'
                        : `${detailTarget.target_org_ids?.length ?? 0} empresas específicas`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Lecturas</p>
                    <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">
                      {detailTarget.read_count ?? 0} usuarios leyeron
                    </p>
                  </div>
                </div>

                {/* Target Organizations List (if specific) */}
                {detailTarget.target === 'specific' && detailTarget.target_org_ids && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Empresas asignadas ({detailTarget.target_org_ids.length}):
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                      {detailTarget.target_org_ids.map(id => {
                        const org = orgMap.get(id)
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                          >
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {org ? (
                              org.slug ? (
                                <Link
                                  href={`/superadmin/organizations/${org.slug}`}
                                  className="hover:text-indigo-600 hover:underline"
                                  target="_blank"
                                >
                                  {org.name}
                                  <ExternalLink className="ml-1 inline h-2.5 w-2.5 opacity-60" />
                                </Link>
                              ) : (
                                org.name
                              )
                            ) : (
                              id.slice(0, 8)
                            )}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 space-y-1">
                  <div className="flex justify-between">
                    <span>Fecha de creación:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatDate(detailTarget.created_at)}
                    </span>
                  </div>
                  {detailTarget.scheduled_at && (
                    <div className="flex justify-between">
                      <span>Programada para:</span>
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        {formatDate(detailTarget.scheduled_at)}
                      </span>
                    </div>
                  )}
                  {detailTarget.sent_at && (
                    <div className="flex justify-between">
                      <span>Enviada con éxito:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatDate(detailTarget.sent_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 border-t pt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const target = detailTarget
                    setDetailTarget(null)
                    setDeleteTarget(target)
                  }}
                  className="text-xs h-8"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Eliminar
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const target = detailTarget
                      setDetailTarget(null)
                      handleDuplicate(target)
                    }}
                    className="text-xs h-8"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Duplicar
                  </Button>

                  {detailTarget.status !== 'sent' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const target = detailTarget
                        setDetailTarget(null)
                        openEdit(target)
                      }}
                      className="text-xs h-8"
                    >
                      <Wrench className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                  )}

                  {detailTarget.status !== 'sent' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const target = detailTarget
                        setSendNowTarget(target)
                      }}
                      className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Enviar ahora
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------- */}
      {/* Confirm Send Now Dialog                                             */}
      {/* ------------------------------------------------------------------- */}
      <Dialog
        open={!!sendNowTarget}
        onOpenChange={open => {
          if (!open) setSendNowTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600">
              <Send className="h-5 w-5" />
              <DialogTitle className="text-base font-bold">
                ¿Enviar notificación ahora?
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              Esta acción publicará y entregará inmediatamente la notificación{' '}
              <strong>&quot;{sendNowTarget?.title}&quot;</strong> a{' '}
              {sendNowTarget?.target === 'all'
                ? 'todos los tenants de la plataforma.'
                : `${sendNowTarget?.target_org_ids?.length ?? 0} organizaciones seleccionadas.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSendNowTarget(null)}
              disabled={sendingNow}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={executeSendNow}
              disabled={sendingNow}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {sendingNow && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Sí, enviar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------- */}
      {/* Confirm Delete Dialog                                               */}
      {/* ------------------------------------------------------------------- */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" />
              <DialogTitle className="text-base font-bold">
                Eliminar notificación
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              {deleteTarget && (
                <>
                  ¿Estás seguro de que deseas eliminar permanentemente{' '}
                  <strong>&quot;{deleteTarget.title}&quot;</strong>? Esta acción no se
                  puede deshacer.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={executeDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
