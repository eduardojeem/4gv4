'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Globe,
  Minus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EnterSupportButton } from '@/components/superadmin/EnterSupportButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { paginateList, SUPERADMIN_PAGE_SIZES } from '@/lib/superadmin/list-pagination'
import { cn } from '@/lib/utils'
import { SortIndicator } from '@/components/superadmin/sort-indicator'
import { countOrganizationsWithoutSubscription, getSubscriptionTiming } from '@/lib/superadmin/organization-directory'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SuperAdminOrganization = {
  id: string
  name: string
  slug: string
  plan: string
  logo_url: string | null
  owner_id: string | null
  owner_name: string | null
  owner_email: string | null
  created_at: string | null
  updated_at: string | null
  subscription_status: string | null
  payment_status: string | null
  subscription_provider: string | null
  trial_ends_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean
  members_total: number
  members_active: number
  members_invited: number
  members_suspended: number
  staff_total: number
  staff_active: number
  staff_invited: number
  staff_suspended: number
  customers_total: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
}

const PLAN_AVATAR_BG: Record<string, string> = {
  FREE: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  BASIC: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PRO: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  ENTERPRISE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

const SUB_COLORS: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  trialing: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300',
  past_due: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300',
  unpaid: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
  suspended: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
  canceled: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  expired: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

const SUB_LABELS: Record<string, string> = {
  active: 'Activo', trialing: 'En prueba', past_due: 'Vencido', unpaid: 'Impago',
  suspended: 'Suspendido', canceled: 'Cancelado', cancelled: 'Cancelado', expired: 'Expirado',
}

function SubscriptionBadge({ org }: { org: SuperAdminOrganization }) {
  const status = org.subscription_status
  const label = SUB_LABELS[status ?? ''] ?? status ?? 'Sin suscripción'
  const style = SUB_COLORS[status ?? ''] ?? 'border-slate-200 bg-slate-50 text-slate-500'

  const timing = getSubscriptionTiming(status, org.trial_ends_at, org.current_period_ends_at)

  return (
    <div className="space-y-1">
      <Badge variant="outline" className={cn('rounded-full text-[11px]', style)}>
        {label}
      </Badge>
      {timing && (timing.urgent || status === 'trialing') && (
        <div className={cn('flex items-center gap-1 text-[11px]', timing.urgent ? 'text-red-500' : 'text-cyan-600 dark:text-cyan-400')}>
          <Clock className="h-3 w-3" />
          {timing.label}
        </div>
      )}
    </div>
  )
}

function MemberBar({ org }: { org: SuperAdminOrganization }) {
  const { staff_total, staff_active, staff_invited, customers_total } = org
  if (staff_total === 0 && customers_total === 0) return <span className="text-xs text-slate-400">Sin miembros</span>
  const activePercent = staff_total > 0 ? Math.round((staff_active / staff_total) * 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${activePercent}%` }} />
        </div>
        <span className="text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
          {staff_active}<span className="text-slate-400">/{staff_total} personal</span>
        </span>
      </div>
      <p className="text-[11px] text-slate-400">
        {staff_invited > 0 ? `${staff_invited} invitado${staff_invited !== 1 ? 's' : ''} · ` : ''}{customers_total} cliente{customers_total !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

const PAYMENT_LABELS: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  unpaid: 'Impago',
  failed: 'Fallido',
  refunded: 'Reembolsado',
}

function PaymentBadge({ status }: { status: string | null }) {
  const normalized = status?.toLowerCase() ?? ''
  const healthy = normalized === 'paid'
  const warning = normalized === 'pending'

  return (
    <Badge variant="outline" className={cn(
      'rounded-full text-[11px]',
      healthy && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300',
      warning && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
      !healthy && !warning && 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300'
    )}>
      {PAYMENT_LABELS[normalized] ?? status ?? 'Sin registro de pago'}
    </Badge>
  )
}

function OrganizationFocusPanel({
  organization,
  onCopyUrl,
}: {
  organization: SuperAdminOrganization
  onCopyUrl: (slug: string) => Promise<void>
}) {
  const timing = getSubscriptionTiming(
    organization.subscription_status,
    organization.trial_ends_at,
    organization.current_period_ends_at
  )

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
            PLAN_AVATAR_BG[organization.plan] ?? PLAN_AVATAR_BG.FREE
          )}>
            {getInitials(organization.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-50">{organization.name}</h2>
              <Badge variant="outline" className={cn('rounded-full text-[11px]', PLAN_COLORS[organization.plan] ?? PLAN_COLORS.FREE)}>
                {organization.plan}
              </Badge>
              <SubscriptionBadge org={organization} />
              <PaymentBadge status={organization.payment_status} />
            </div>
            <button
              type="button"
              onClick={() => void onCopyUrl(organization.slug)}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              /{organization.slug}/inicio
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <EnterSupportButton organizationId={organization.id} organizationName={organization.name} />
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={`/${organization.slug}/inicio`} target="_blank" rel="noreferrer">
              <Globe className="h-3.5 w-3.5" />
              Abrir tienda
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/superadmin/users?organization=${organization.id}`}>
              <Users className="h-3.5 w-3.5" />
              Usuarios
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(organization.slug)}`}>
              <CreditCard className="h-3.5 w-3.5" />
              Suscripción
            </Link>
          </Button>
        </div>
      </div>

      {organization.cancel_at_period_end && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          <Clock className="h-4 w-4" />
          La suscripción está programada para cancelarse al finalizar el periodo actual.
        </div>
      )}

      <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <div className="p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Owner</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{organization.owner_name || 'Sin nombre registrado'}</p>
          <p className="truncate text-xs text-slate-500">{organization.owner_email || 'Sin email registrado'}</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Equipo</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{organization.staff_active} de {organization.staff_total} activos</p>
          <p className="text-xs text-slate-500">{organization.staff_invited} invitados · {organization.staff_suspended} suspendidos</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Clientes vinculados</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{organization.customers_total}</p>
          <p className="text-xs text-slate-500">No consumen cupos de personal</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Periodo</p>
          <p className={cn('mt-1 text-sm font-medium', timing?.urgent ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200')}>
            {timing?.label ?? 'Sin fecha de renovación'}
          </p>
          <p className="text-xs text-slate-500">Hasta {formatDate(organization.current_period_ends_at || organization.trial_ends_at)}</p>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label, value, sub, icon: Icon, tone = 'default',
}: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'info'
}) {
  const tones = {
    default: 'bg-card border',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
    info: 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20',
  }
  const iconTones = {
    default: 'text-slate-500',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
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
// Main dashboard
// ---------------------------------------------------------------------------

type SortKey = 'name' | 'plan' | 'status' | 'members' | 'created'
type FilterStatus = 'all' | 'active' | 'trialing' | 'past_due' | 'unpaid' | 'suspended' | 'canceled' | 'expired' | 'no_sub'

export function OrganizationsDashboard({
  organizations,
  referenceTime,
}: {
  organizations: SuperAdminOrganization[]
  referenceTime: string
}) {
  const router = useRouter()
  const { state, setValue } = useUrlListState({
    q: '',
    plan: 'ALL',
    status: 'all',
    sort: 'created',
    dir: 'desc',
    page: '1',
    size: '25',
  })
  const query = state.q
  const planFilter = state.plan
  const statusFilter = state.status as FilterStatus
  const sortKey = state.sort as SortKey
  const sortDir = state.dir as 'asc' | 'desc'
  const setFilter = (key: 'q' | 'plan' | 'status', value: string) => {
    setValue(key, value)
    setValue('page', '1')
  }
  const setQuery = (value: string) => setFilter('q', value)
  const setPlanFilter = (value: string) => setFilter('plan', value)
  const setStatusFilter = (value: FilterStatus) => setFilter('status', value)

  const stats = useMemo(() => ({
    total: organizations.length,
    paid: organizations.filter((o) => o.plan !== 'FREE').length,
    activeSubscriptions: organizations.filter((o) => o.subscription_status === 'active').length,
    trialing: organizations.filter((o) => o.subscription_status === 'trialing').length,
    newThisMonth: organizations.filter((o) => {
      if (!o.created_at) return false
      return new Date(o.created_at) >= new Date(new Date(referenceTime).getTime() - 30 * 86400000)
    }).length,
  }), [organizations, referenceTime])

  const planOptions = useMemo(() => Array.from(new Set(organizations.map((o) => o.plan))).sort(), [organizations])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    organizations.forEach((o) => {
      const s = o.subscription_status === 'cancelled' ? 'canceled' : o.subscription_status ?? 'no_sub'
      counts[s] = (counts[s] ?? 0) + 1
    })
    return counts
  }, [organizations])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setValue('dir', sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setValue('sort', key)
      setValue('dir', key === 'created' ? 'desc' : 'asc')
    }
    setValue('page', '1')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = organizations.filter((o) => {
      const matchQuery = !q || [o.name, o.slug, o.owner_email, o.owner_name, o.id].some((v) => v?.toLowerCase().includes(q))
      const matchPlan = planFilter === 'ALL' || o.plan === planFilter
      const normalizedStatus = o.subscription_status === 'cancelled' ? 'canceled' : o.subscription_status
      const matchStatus = statusFilter === 'all'
        || (statusFilter === 'no_sub' && !o.subscription_status)
        || normalizedStatus === statusFilter
      return matchQuery && matchPlan && matchStatus
    })

    rows = [...rows].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'plan') cmp = a.plan.localeCompare(b.plan)
      else if (sortKey === 'status') cmp = (a.subscription_status ?? '').localeCompare(b.subscription_status ?? '')
      else if (sortKey === 'members') cmp = a.staff_total - b.staff_total
      else if (sortKey === 'created') cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [organizations, query, planFilter, statusFilter, sortKey, sortDir])
  const pagination = useMemo(
    () => paginateList(filtered, state.page, state.size),
    [filtered, state.page, state.size]
  )
  const focusedOrganization = query.trim() && filtered.length === 1 ? filtered[0] ?? null : null

  function exportCsv() {
    const rows = [
      ['Nombre', 'Slug', 'Plan', 'Suscripcion', 'Pago', 'Owner', 'Email', 'Personal', 'Personal activo', 'Clientes', 'Creada'],
      ...filtered.map((o) => [
        o.name, o.slug, o.plan, o.subscription_status ?? 'sin_suscripcion', o.payment_status ?? 'sin_registro',
        o.owner_name ?? o.owner_id ?? '', o.owner_email ?? '',
        o.staff_total, o.staff_active, o.customers_total, o.created_at ?? '',
      ]),
    ]
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `organizaciones-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  async function copyUrl(slug: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${slug}/inicio`)
      toast.success('URL pública copiada.')
    } catch {
      toast.error('No se pudo copiar la URL.')
    }
  }

  const filterPills: Array<{ key: FilterStatus; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'active', label: 'Activas' },
    { key: 'trialing', label: 'En prueba' },
    { key: 'past_due', label: 'Vencidas' },
    { key: 'unpaid', label: 'Impagas' },
    { key: 'suspended', label: 'Suspendidas' },
    { key: 'canceled', label: 'Canceladas' },
    { key: 'expired', label: 'Expiradas' },
    { key: 'no_sub', label: 'Sin suscripción' },
  ]

  const thClass = 'px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'
  const thBtn = 'flex cursor-pointer select-none items-center whitespace-nowrap hover:text-slate-800 dark:hover:text-slate-200 transition-colors'

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Building2 className="h-3.5 w-3.5" />
            Tenants SaaS
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Organizaciones</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Control operativo de empresas, planes, owners y suscripciones del ecosistema multiempresa.
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
          <Button asChild size="sm" className="gap-2">
            <Link href="/superadmin/organizations/create">
              <Sparkles className="h-3.5 w-3.5" />
              Nueva organización
            </Link>
          </Button>
        </div>
      </header>

      {focusedOrganization ? (
        <OrganizationFocusPanel organization={focusedOrganization} onCopyUrl={copyUrl} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total" value={organizations.length} sub={`${filtered.length} visibles`} icon={Building2} />
          <StatCard label="Planes pagos" value={stats.paid} sub="BASIC, PRO o ENTERPRISE" icon={Sparkles} tone="info" />
          <StatCard label="Activas" value={stats.activeSubscriptions} sub="con suscripción activa" icon={CheckCircle2} tone="success" />
          <StatCard label="En prueba" value={stats.trialing} sub="período de trial" icon={Clock} tone={stats.trialing > 0 ? 'warning' : 'default'} />
          <StatCard label="Nuevas" value={stats.newThisMonth} sub="últimos 30 días" icon={CalendarDays} tone={stats.newThisMonth > 0 ? 'info' : 'default'} />
        </div>
      )}

      {/* Table card */}
      {!focusedOrganization && <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Directorio de organizaciones</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} de {organizations.length} organizaciones
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-9 w-64 pl-9 text-sm"
                  placeholder="Buscar empresa, slug, owner..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {/* Plan filter */}
              <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setPlanFilter('ALL')}
                  aria-pressed={planFilter === 'ALL'}
                  className={cn(
                    'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
                    planFilter === 'ALL' ? 'bg-background shadow-sm text-slate-900 dark:text-slate-50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                >
                  Todos
                </button>
                {planOptions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlanFilter(p)}
                    aria-pressed={planFilter === p}
                    className={cn(
                      'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
                      planFilter === p ? 'bg-background shadow-sm text-slate-900 dark:text-slate-50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {filterPills.map((f) => {
              const count = f.key === 'all'
                ? organizations.length
                : f.key === 'no_sub'
                ? countOrganizationsWithoutSubscription(organizations)
                : statusCounts[f.key] ?? 0
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  aria-pressed={statusFilter === f.key}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                    statusFilter === f.key
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  )}
                >
                  {f.label}
                  <span className={cn(
                    'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                    statusFilter === f.key ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
            {(query || planFilter !== 'ALL' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setQuery(''); setPlanFilter('ALL'); setStatusFilter('all') }}
                className="h-7 rounded-full px-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Limpiar
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className={cn(thClass, 'pl-4')}>
                    <button className={thBtn} onClick={() => toggleSort('name')}>
                      Empresa <SortIndicator active={sortKey === 'name'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('plan')}>
                      Plan <SortIndicator active={sortKey === 'plan'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('status')}>
                      Suscripción <SortIndicator active={sortKey === 'status'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}>Owner</th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('members')}>
                      Miembros <SortIndicator active={sortKey === 'members'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('created')}>
                      Creada <SortIndicator active={sortKey === 'created'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={cn(thClass, 'pr-4 text-right')}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Minus className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">Sin organizaciones con estos filtros</p>
                    </td>
                  </tr>
                ) : (
                  pagination.items.map((org) => (
                    <tr
                      key={org.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      {/* Empresa */}
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                            PLAN_AVATAR_BG[org.plan] ?? PLAN_AVATAR_BG.FREE
                          )}>
                            {getInitials(org.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{org.name}</p>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <span>/{org.slug}</span>
                              <button
                                type="button"
                                onClick={() => void copyUrl(org.slug)}
                                className="hover:text-slate-600 dark:hover:text-slate-300"
                                title="Copiar URL"
                                aria-label={`Copiar URL de ${org.name}`}
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn('rounded-full text-[11px]', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
                          {org.plan}
                        </Badge>
                      </td>

                      {/* Suscripción */}
                      <td className="px-3 py-3">
                        <SubscriptionBadge org={org} />
                      </td>

                      {/* Owner */}
                      <td className="px-3 py-3">
                        <div className="max-w-[200px]">
                          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                            {org.owner_name || (org.owner_email?.split('@')[0]) || '—'}
                          </p>
                          {org.owner_email && (
                            <p className="truncate text-xs text-slate-400">{org.owner_email}</p>
                          )}
                        </div>
                      </td>

                      {/* Miembros */}
                      <td className="px-3 py-3">
                        <MemberBar org={org} />
                      </td>

                      {/* Creada */}
                      <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(org.created_at)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 pl-3 pr-4">
                        <div className="flex justify-end gap-0.5">
                          <EnterSupportButton iconOnly organizationId={org.id} organizationName={org.name} />
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Abrir tienda">
                            <a href={`/${org.slug}/inicio`} target="_blank" rel="noreferrer" aria-label={`Abrir tienda de ${org.name}`}>
                              <Globe className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Usuarios">
                            <Link href={`/superadmin/users?organization=${org.id}`} aria-label={`Ver usuarios de ${org.name}`}>
                              <Users className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Suscripción">
                            <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(org.slug)}`} aria-label={`Ver suscripción de ${org.name}`}>
                              <CreditCard className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 p-4 lg:hidden">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">Sin organizaciones con estos filtros</p>
              </div>
            ) : (
              pagination.items.map((org) => (
                <article key={org.id} className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold', PLAN_AVATAR_BG[org.plan] ?? PLAN_AVATAR_BG.FREE)}>
                        {getInitials(org.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{org.name}</p>
                        <p className="truncate text-xs text-slate-400">/{org.slug}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 rounded-full text-[11px]', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
                      {org.plan}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider">Suscripción</p>
                      <SubscriptionBadge org={org} />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider">Miembros</p>
                      <MemberBar org={org} />
                    </div>
                    {org.owner_email && (
                      <div className="col-span-2">
                        <p className="text-[11px] text-slate-400 uppercase tracking-wider">Owner</p>
                        <p className="truncate text-sm text-slate-600 dark:text-slate-300">{org.owner_email}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2 border-t pt-3">
                    <Button asChild variant="outline" size="sm" className="flex-1 h-8 text-xs">
                      <a href={`/${org.slug}/inicio`} target="_blank" rel="noreferrer">
                        <Globe className="mr-1.5 h-3.5 w-3.5" /> Tienda
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="flex-1 h-8 text-xs">
                      <Link href={`/superadmin/users?organization=${org.id}`}>
                        <Users className="mr-1.5 h-3.5 w-3.5" /> Usuarios
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(org.slug)}`} aria-label={`Ver suscripción de ${org.name}`}>
                        <CreditCard className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
          <Pagination
            className="border-t px-4 py-3"
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            itemsPerPage={pagination.pageSize}
            totalItems={filtered.length}
            itemsPerPageOptions={[...SUPERADMIN_PAGE_SIZES]}
            onPageChange={(page) => setValue('page', String(page))}
            onItemsPerPageChange={(size) => {
              setValue('size', String(size))
              setValue('page', '1')
            }}
          />
        </CardContent>
      </Card>}
    </div>
  )
}
