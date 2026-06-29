'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Crown,
  Download,
  Eye,
  FileText,
  Globe,
  LifeBuoy,
  LogIn,
  LogOut,
  Mail,
  Minus,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditLogRow = {
  id: string
  userId: string | null
  userEmail: string | null
  userName: string | null
  action: string
  resource: string
  resourceId: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  ipAddress: string | null
  userAgent: string | null
  createdAt: string | null
  details: unknown
  resourceName: string | null
  resourceSlug: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function relativeTime(value: string | null) {
  if (!value) return '—'
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mes`
}

function csvCell(v: unknown) { return `"${String(v ?? '').replace(/"/g, '""')}"` }

const ACTION_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }>; category: string }> = {
  login:                  { label: 'Inicio de sesión',          color: 'text-emerald-600', icon: LogIn,        category: 'auth' },
  login_failed:           { label: 'Login fallido',             color: 'text-red-600',     icon: XCircle,      category: 'auth' },
  logout:                 { label: 'Cierre de sesión',          color: 'text-slate-500',   icon: LogOut,       category: 'auth' },
  create:                 { label: 'Creación',                  color: 'text-blue-600',    icon: Zap,          category: 'resource' },
  update:                 { label: 'Actualización',             color: 'text-cyan-600',    icon: RefreshCw,    category: 'resource' },
  delete:                 { label: 'Eliminación',               color: 'text-orange-600',  icon: Trash2,       category: 'resource' },
  role_change:            { label: 'Cambio de rol',             color: 'text-amber-600',   icon: Shield,       category: 'security' },
  admin_api_access:       { label: 'Acceso API admin',          color: 'text-violet-600',  icon: Server,       category: 'security' },
  unauthorized_admin_access_attempt: { label: 'Intento admin no autorizado', color: 'text-red-600', icon: ShieldAlert, category: 'security' },
  permission_denied:      { label: 'Permiso denegado',          color: 'text-orange-600',  icon: ShieldAlert,  category: 'security' },
  password_change:        { label: 'Cambio de contraseña',      color: 'text-slate-600',   icon: Shield,       category: 'auth' },
  grant_admin_self_rpc:   { label: 'Auto-promoción admin',      color: 'text-red-600',     icon: Crown,        category: 'security' },
  grant_admin_migration:  { label: 'Promoción admin',           color: 'text-amber-600',   icon: Crown,        category: 'security' },
  update_user_status:     { label: 'Cambio estado usuario',     color: 'text-amber-600',   icon: User,         category: 'user' },
  suspicious_activity:    { label: 'Actividad sospechosa',      color: 'text-red-600',     icon: ShieldAlert,  category: 'security' },
  data_export:            { label: 'Exportación de datos',      color: 'text-violet-600',  icon: Download,     category: 'resource' },
  bulk_operation:         { label: 'Operación masiva',          color: 'text-cyan-600',    icon: Zap,          category: 'resource' },
  // Platform (super_admin) actions
  'support.started':      { label: 'Soporte iniciado',          color: 'text-amber-600',   icon: LifeBuoy,     category: 'platform' },
  'support.ended':        { label: 'Soporte finalizado',        color: 'text-slate-500',   icon: ShieldCheck,  category: 'platform' },
  invite_owner:           { label: 'Invitación de owner',       color: 'text-blue-600',    icon: UserPlus,     category: 'platform' },
  'subscription.updated': { label: 'Suscripción actualizada',   color: 'text-cyan-600',    icon: FileText,     category: 'platform' },
  'subscription_plan.created': { label: 'Plan creado',          color: 'text-blue-600',    icon: FileText,     category: 'platform' },
  'subscription_plan.updated': { label: 'Plan actualizado',     color: 'text-cyan-600',    icon: FileText,     category: 'platform' },
  update_platform_branding: { label: 'Branding de plataforma',  color: 'text-violet-600',  icon: Globe,        category: 'platform' },
}

const SEVERITY_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  low:      { label: 'Baja',     color: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',         icon: CheckCircle2 },
  medium:   { label: 'Media',    color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',   icon: AlertCircle },
  high:     { label: 'Alta',     color: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300', icon: AlertTriangle },
  critical: { label: 'Crítica',  color: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300',               icon: XCircle },
}

const RESOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  organizations: Building2, users: User, subscriptions: FileText,
  user_roles: Shield, profiles: User, system: Globe, default: Activity,
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, tone = 'default' }: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    default: 'bg-card border',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
    danger:  'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20',
    info:    'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20',
  }
  const iconTones = {
    default: 'text-slate-500', success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400', danger: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
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
// Details drawer
// ---------------------------------------------------------------------------

type LogPayload = { details: unknown; new_values: unknown; old_values: unknown } | null

function DetailsDrawer({ log, onClose }: { log: AuditLogRow; onClose: () => void }) {
  const actionMeta = ACTION_META[log.action] ?? { label: log.action, color: 'text-slate-600', icon: Activity, category: 'other' }
  const severityMeta = SEVERITY_META[log.severity] ?? SEVERITY_META.low
  const ActionIcon = actionMeta.icon
  const SeverityIcon = severityMeta.icon
  const [payload, setPayload] = useState<LogPayload>(null)
  const [loadingPayload, setLoadingPayload] = useState(false)

  useEffect(() => {
    setLoadingPayload(true)
    fetch(`/api/superadmin/audit-logs/${log.id}`)
      .then((r) => r.json())
      .then((data) => setPayload(data))
      .catch(() => {})
      .finally(() => setLoadingPayload(false))
  }, [log.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto border-l bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 p-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <ActionIcon className={cn('h-4 w-4', actionMeta.color)} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{actionMeta.label}</h2>
              <p className="text-xs text-slate-400">ID: {log.id.slice(0, 8)}...</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          {/* Metadata */}
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Información</h3>
            <div className="space-y-1.5 text-sm">
              <DetailRow label="Acción" value={<code className="rounded bg-muted px-1.5 py-0.5 text-xs">{log.action}</code>} />
              <DetailRow label="Recurso" value={<code className="rounded bg-muted px-1.5 py-0.5 text-xs">{log.resource}</code>} />
              {log.resourceId && (
                <DetailRow label="Resource ID" value={
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {log.resourceId.slice(0, 16)}...
                  </code>
                } />
              )}
              {log.resourceName && (
                <DetailRow label="Org" value={
                  <Link href="/superadmin/organizations" className="text-indigo-600 hover:underline">
                    {log.resourceName}
                  </Link>
                } />
              )}
              <DetailRow label="Severidad" value={
                <Badge variant="outline" className={cn('rounded-full gap-1 text-[11px]', severityMeta.color)}>
                  <SeverityIcon className="h-3 w-3" />
                  {severityMeta.label}
                </Badge>
              } />
              <DetailRow label="Fecha" value={formatDate(log.createdAt)} />
              {log.ipAddress && <DetailRow label="IP" value={<code className="text-xs font-mono">{log.ipAddress}</code>} />}
            </div>
          </div>

          {/* User */}
          {(log.userEmail || log.userName) && (
            <div className="space-y-2 rounded-lg border bg-card p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Usuario</h3>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {getInitials(log.userName, log.userEmail)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {log.userName || log.userEmail?.split('@')[0]}
                  </p>
                  {log.userEmail && (
                    <p className="text-xs text-slate-400">{log.userEmail}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* User agent */}
          {log.userAgent && (
            <div className="space-y-2 rounded-lg border bg-card p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">User-Agent</h3>
              <p className="break-all text-xs font-mono text-slate-600 dark:text-slate-400">{log.userAgent}</p>
            </div>
          )}

          {/* Payload — lazy loaded */}
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Payload</h3>
            {loadingPayload ? (
              <p className="text-xs text-slate-400">Cargando...</p>
            ) : payload ? (
              <>
                {payload.new_values != null && (
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-600">new_values</p>
                    <pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-emerald-100">
                      {JSON.stringify(payload.new_values, null, 2)}
                    </pre>
                  </div>
                )}
                {payload.old_values != null && (
                  <div>
                    <p className="text-[11px] font-semibold text-orange-600">old_values</p>
                    <pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-orange-100">
                      {JSON.stringify(payload.old_values, null, 2)}
                    </pre>
                  </div>
                )}
                {payload.details != null && (
                  <div>
                    <p className="text-[11px] font-semibold text-blue-600">details</p>
                    <pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-blue-100">
                      {JSON.stringify(payload.details, null, 2)}
                    </pre>
                  </div>
                )}
                {payload.new_values == null && payload.old_values == null && payload.details == null && (
                  <p className="text-xs text-slate-400 italic">Sin payload adicional.</p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400 italic">Sin datos.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <div className="text-right">{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type SortKey = 'date' | 'action' | 'user' | 'severity'
type FilterSeverity = 'all' | 'low' | 'medium' | 'high' | 'critical'
type FilterCategory = 'all' | 'auth' | 'resource' | 'security' | 'user' | 'platform'
type DateFilter = 'all' | '1h' | '24h' | '7d' | '30d'

export function AuditLogsDashboard({
  rows, period, severityParam, page, pageSize, total,
}: {
  rows: AuditLogRow[]
  period: string
  severityParam: string
  page: number
  pageSize: number
  total: number
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null)

  function setUrlParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search)
    if (value) params.set(key, value)
    else params.delete(key)
    if (key !== 'page') params.delete('page')
    router.push(`?${params.toString()}`)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const stats = useMemo(() => {
    const critical = rows.filter((r) => r.severity === 'high' || r.severity === 'critical')
    const uniqueActors = new Set(rows.map((r) => r.userId).filter(Boolean)).size
    const adminAccess = rows.filter((r) => r.action === 'admin_api_access' || r.action === 'login').length
    return {
      total: rows.length,
      critical: critical.length,
      uniqueActors,
      adminAccess,
    }
  }, [rows])

  const severityCounts = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.severity, (m.get(r.severity) ?? 0) + 1))
    return m
  }, [rows])

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => {
      const cat = ACTION_META[r.action]?.category ?? 'other'
      m.set(cat, (m.get(cat) ?? 0) + 1)
    })
    return m
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    let list = rows.filter((r) => {
      const matchQ = !q || [
        r.action, r.resource, r.userEmail, r.userName, r.ipAddress,
        r.resourceName, r.resourceId, r.id,
      ].some((v) => v?.toLowerCase().includes(q))
      const category = ACTION_META[r.action]?.category ?? 'other'
      const matchCategory = categoryFilter === 'all' || category === categoryFilter
      return matchQ && matchCategory
    })

    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
      else if (sortKey === 'action') cmp = a.action.localeCompare(b.action)
      else if (sortKey === 'user') cmp = (a.userEmail ?? '').localeCompare(b.userEmail ?? '')
      else if (sortKey === 'severity') {
        const order = { critical: 4, high: 3, medium: 2, low: 1 }
        cmp = (order[a.severity] ?? 0) - (order[b.severity] ?? 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [rows, search, categoryFilter, sortKey, sortDir])

  function exportCsv() {
    const header = ['Fecha', 'Acción', 'Recurso', 'Severidad', 'Usuario', 'Email', 'IP', 'ResourceID']
    const data = filtered.map((r) => [
      r.createdAt ?? '', r.action, r.resource, r.severity,
      r.userName ?? '', r.userEmail ?? '', r.ipAddress ?? '', r.resourceId ?? '',
    ])
    const blob = new Blob([[header, ...data].map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
    return sortDir === 'asc'
      ? <ChevronUp className="ml-1 h-3 w-3 text-indigo-500" />
      : <ChevronDown className="ml-1 h-3 w-3 text-indigo-500" />
  }

  const thClass = 'px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'
  const thBtn = 'flex cursor-pointer select-none items-center whitespace-nowrap hover:text-slate-800 dark:hover:text-slate-200 transition-colors'

  const severityPills: Array<{ key: string; label: string }> = [
    { key: '', label: 'Todas' },
    { key: 'critical', label: 'Crítica' },
    { key: 'high', label: 'Alta' },
    { key: 'medium', label: 'Media' },
    { key: 'low', label: 'Baja' },
  ]

  const categoryPills: Array<{ key: FilterCategory; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'platform', label: 'Plataforma' },
    { key: 'security', label: 'Seguridad' },
    { key: 'auth', label: 'Auth' },
    { key: 'resource', label: 'Recursos' },
    { key: 'user', label: 'Usuario' },
  ]

  const datePills: Array<{ key: string; label: string }> = [
    { key: '1h', label: '1h' },
    { key: '24h', label: '24h' },
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
  ]

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Shield className="h-3.5 w-3.5" />
            Auditoría SaaS
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Audit logs</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Trazabilidad global de accesos, cambios sensibles y acciones críticas en toda la plataforma.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Eventos cargados" value={stats.total} sub={`Período: ${period}`} icon={FileText} tone="info" />
        <StatCard
          label="Alta severidad"
          value={stats.critical}
          sub="High + Critical en el período"
          icon={AlertTriangle}
          tone={stats.critical > 0 ? 'danger' : 'success'}
        />
        <StatCard label="Accesos admin" value={stats.adminAccess} sub="logins + API admin" icon={ShieldCheck} tone="info" />
        <StatCard label="Actores activos" value={stats.uniqueActors} sub="usuarios distintos" icon={UserPlus} />
      </div>

      {/* Logs table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Stream de eventos</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} de {rows.length} eventos · período: {period}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 w-72 pl-9 text-sm"
                placeholder="Buscar acción, usuario, IP, recurso..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Date — server-side via URL */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Período</span>
              <div className="flex gap-1">
                {datePills.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setUrlParam('period', f.key)}
                    className={cn(
                      'h-7 rounded-full border px-2.5 text-xs font-medium transition-colors',
                      period === f.key
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Severity — server-side via URL */}
            <div className="flex flex-wrap gap-1">
              {severityPills.map((f) => {
                const count = f.key === '' ? rows.length : (severityCounts.get(f.key) ?? 0)
                const active = severityParam === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setUrlParam('severity', f.key)}
                    className={cn(
                      'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                      active
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {f.label}
                    <span className={cn(
                      'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                      active ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    )}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Category */}
            <div className="flex flex-wrap gap-1">
              {categoryPills.map((f) => {
                const count = f.key === 'all' ? rows.length : (categoryCounts.get(f.key) ?? 0)
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setCategoryFilter(f.key)}
                    className={cn(
                      'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                      categoryFilter === f.key
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {f.label}
                    <span className="text-[10px] text-slate-400 font-bold">{count}</span>
                  </button>
                )
              })}
            </div>

            {(search || severityParam || categoryFilter !== 'all' || period !== '7d') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setCategoryFilter('all')
                  router.push('?period=7d')
                }}
                className="h-7 rounded-full px-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Reset
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className={cn(thClass, 'pl-4 w-24')}>
                    <button className={thBtn} onClick={() => toggleSort('date')}>
                      Fecha <SortIcon col="date" />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('action')}>
                      Acción <SortIcon col="action" />
                    </button>
                  </th>
                  <th className={thClass}>Recurso</th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('severity')}>
                      Severidad <SortIcon col="severity" />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('user')}>
                      Usuario <SortIcon col="user" />
                    </button>
                  </th>
                  <th className={thClass}>IP</th>
                  <th className={cn(thClass, 'pr-4 text-right w-12')} />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Minus className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">
                        {rows.length === 0 ? 'No hay eventos registrados' : 'Sin resultados con estos filtros'}
                      </p>
                    </td>
                  </tr>
                ) : filtered.map((r) => {
                  const actionMeta = ACTION_META[r.action] ?? { label: r.action, color: 'text-slate-600', icon: Activity, category: 'other' }
                  const severityMeta = SEVERITY_META[r.severity] ?? SEVERITY_META.low
                  const ActionIcon = actionMeta.icon
                  const SeverityIcon = severityMeta.icon
                  const ResourceIcon = RESOURCE_ICON[r.resource] ?? RESOURCE_ICON.default

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedLog(r)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver detalle de ${actionMeta.label}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedLog(r)
                        }
                      }}
                      className={cn(
                        'cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 dark:border-slate-800 dark:hover:bg-slate-800/40',
                        (r.severity === 'critical' || r.severity === 'high') && 'bg-orange-50/30 dark:bg-orange-950/10'
                      )}
                    >
                      {/* Fecha */}
                      <td className="py-3 pl-4 pr-3 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {relativeTime(r.createdAt)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {r.createdAt && new Date(r.createdAt).toLocaleTimeString('es-PY', { timeStyle: 'short' })}
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800">
                            <ActionIcon className={cn('h-3.5 w-3.5', actionMeta.color)} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{actionMeta.label}</p>
                            <p className="truncate text-[10px] font-mono text-slate-400">{r.action}</p>
                          </div>
                        </div>
                      </td>

                      {/* Recurso */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <ResourceIcon className="h-3 w-3 text-slate-400" />
                          <code className="text-xs text-slate-600 dark:text-slate-400">{r.resource}</code>
                        </div>
                        {r.resourceName && (
                          <p className="mt-0.5 truncate text-[11px] text-indigo-600 dark:text-indigo-400">{r.resourceName}</p>
                        )}
                      </td>

                      {/* Severidad */}
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn('rounded-full gap-1 text-[11px]', severityMeta.color)}>
                          <SeverityIcon className="h-3 w-3" />
                          {severityMeta.label}
                        </Badge>
                      </td>

                      {/* Usuario */}
                      <td className="px-3 py-3">
                        {r.userId ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                              {getInitials(r.userName, r.userEmail)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                                {r.userName || r.userEmail?.split('@')[0] || 'Usuario'}
                              </p>
                              {r.userEmail && r.userName && (
                                <p className="truncate text-[10px] text-slate-400">{r.userEmail}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400">Sistema</span>
                        )}
                      </td>

                      {/* IP */}
                      <td className="px-3 py-3">
                        {r.ipAddress ? (
                          <code className="text-[11px] font-mono text-slate-500">{r.ipAddress}</code>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 pl-3 pr-4 text-right">
                        <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total} eventos
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setUrlParam('page', String(page - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * pageSize >= total}
                onClick={() => setUrlParam('page', String(page + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Details drawer */}
      {selectedLog && <DetailsDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  )
}
