'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  Download,
  LayoutList,
  Minus,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { paginateList, SUPERADMIN_PAGE_SIZES } from '@/lib/superadmin/list-pagination'
import { cn } from '@/lib/utils'
import { SortIndicator } from '@/components/superadmin/sort-indicator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

type FilterOrg = { id: string; name: string; slug: string; plan?: string | null } | null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

function csvCell(v: unknown) { return `"${String(v ?? '').replace(/"/g, '""')}"` }

const ROLE_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  owner:      { label: 'Owner',      color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',     icon: Crown },
  admin:      { label: 'Admin',      color: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300', icon: ShieldCheck },
  vendedor:   { label: 'Vendedor',   color: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300',            icon: UserCheck },
  tecnico:    { label: 'Técnico',    color: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-300',            icon: UserCheck },
  cliente:    { label: 'Cliente',    color: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',            icon: Users },
  super_admin:{ label: 'SuperAdmin', color: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300',            icon: ShieldAlert },
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  active:    { label: 'Activo',     color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300', icon: CheckCircle2 },
  invited:   { label: 'Invitado',   color: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-300',                  icon: UserPlus },
  suspended: { label: 'Suspendido', color: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300',                        icon: UserMinus },
  inactive:  { label: 'Inactivo',   color: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',               icon: XCircle },
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, tone = 'default' }: {
  label: string; value: number | string; sub: string
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
    default: 'text-slate-500',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger:  'text-red-600 dark:text-red-400',
    info:    'text-blue-600 dark:text-blue-400',
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

type OrgGroup = {
  id: string
  name: string | null
  slug: string | null
  plan: string | null
  members: UserRow[]
}

function RoleSubSection({ roleGroup }: { roleGroup: { roleKey: string; label: string; color: string; icon: React.ComponentType<{ className?: string }>; members: UserRow[] } }) {
  const [open, setOpen] = useState(true)
  const RoleIcon = roleGroup.icon

  return (
    <div className="border-b border-slate-100/80 last:border-0 dark:border-slate-800/80">
      {/* Role Subheader — clickable */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-slate-100/50 px-4 py-1.5 pl-9 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
      >
        <span className="text-slate-400">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <RoleIcon className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          {roleGroup.label}s
        </span>
        <Badge variant="outline" className={cn('rounded-full text-[10px] h-4 px-1.5 font-bold', roleGroup.color)}>
          {roleGroup.members.length}
        </Badge>
      </button>

      {/* Members in role */}
      {open && (
        <div>
          {roleGroup.members.map((row, idx) => {
            const statusMeta = STATUS_META[row.memberStatus ?? 'inactive'] ?? { label: row.memberStatus ?? '—', color: 'border-slate-200 bg-slate-50 text-slate-500', icon: XCircle }
            const StatusIcon = statusMeta.icon
            const displayName = row.name || row.email?.split('@')[0] || 'Usuario'
            const isLast = idx === roleGroup.members.length - 1

            return (
              <div
                key={row.memberId}
                className={cn(
                  'flex items-center gap-3 py-2 pl-14 pr-4 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50',
                  !isLast && 'border-b border-slate-100/50 dark:border-slate-800/50'
                )}
              >
                <div className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  row.memberRole === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                  row.memberRole === 'admin' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                )}>
                  {getInitials(row.name, row.email)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
                  {row.email && (
                    <p className="truncate text-[11px] text-slate-400">{row.email}</p>
                  )}
                </div>

                <Badge variant="outline" className={cn('hidden shrink-0 gap-1 rounded-full text-[10px] md:flex', statusMeta.color)}>
                  <StatusIcon className="h-2.5 w-2.5" />
                  {statusMeta.label}
                </Badge>

                <span className="hidden shrink-0 text-[11px] text-slate-400 lg:block">
                  {formatDate(row.memberSince)}
                </span>

                {row.profileStatus && row.profileStatus !== 'active' && (
                  <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400">
                    Cuenta {row.profileStatus}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OrgGroupRow({ group }: { group: OrgGroup }) {
  const [open, setOpen] = useState(true)

  const roleSubGroups = useMemo(() => {
    const map = new Map<string, UserRow[]>()
    const roleOrder = ['owner', 'admin', 'vendedor', 'tecnico', 'cliente', 'super_admin']

    group.members.forEach((r) => {
      const role = r.memberRole || 'cliente'
      if (!map.has(role)) map.set(role, [])
      map.get(role)!.push(r)
    })

    const result: Array<{ roleKey: string; label: string; color: string; icon: React.ComponentType<{ className?: string }>; members: UserRow[] }> = []

    roleOrder.forEach((rKey) => {
      const members = map.get(rKey)
      if (members && members.length > 0) {
        const meta = ROLE_META[rKey] ?? { label: rKey, color: 'border-slate-200 bg-slate-50 text-slate-600', icon: Users }
        result.push({ roleKey: rKey, label: meta.label, color: meta.color, icon: meta.icon, members })
        map.delete(rKey)
      }
    })

    map.forEach((members, rKey) => {
      const meta = ROLE_META[rKey] ?? { label: rKey, color: 'border-slate-200 bg-slate-50 text-slate-600', icon: Users }
      result.push({ roleKey: rKey, label: meta.label, color: meta.color, icon: meta.icon, members })
    })

    return result
  }, [group.members])

  const activeCount = group.members.filter((m) => m.memberStatus === 'active').length
  const orgStatus = group.members[0]?.organizationStatus
  const isOrgProblem = Boolean(orgStatus && ['suspended', 'canceled', 'past_due', 'inactive'].includes(orgStatus))
  const issueCount = group.members.filter(
    (m) => m.memberStatus === 'suspended' || m.memberStatus === 'inactive' || (m.profileStatus && m.profileStatus !== 'active')
  ).length

  return (
    <div className="border-b border-slate-100 last:border-0 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
      >
        <span className="text-slate-400">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          <Building2 className="h-4 w-4 text-slate-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
              {group.name ?? '(sin nombre)'}
            </span>
            {group.plan && (
              <Badge variant="outline" className={cn('rounded-full text-[10px] h-4 px-1.5', PLAN_COLORS[group.plan] ?? PLAN_COLORS.FREE)}>
                {group.plan}
              </Badge>
            )}
            {isOrgProblem && (
              <Badge variant="outline" className="rounded-full border-red-200 bg-red-50 text-[10px] text-red-600 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400 font-bold">
                Org {orgStatus}
              </Badge>
            )}
            {issueCount > 0 && (
              <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                ⚠ {issueCount} inactivo{issueCount > 1 ? 's' : ''}/suspendido{issueCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs text-slate-400">/{group.slug}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-xs text-slate-500">{group.members.length} miembro{group.members.length !== 1 ? 's' : ''}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{activeCount} activos</span>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {roleSubGroups.map(({ roleKey, members }) => {
            const meta = ROLE_META[roleKey]
            if (!meta) return null
            const RoleIcon = meta.icon
            return (
              <span key={roleKey} className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.color)}>
                <RoleIcon className="h-2.5 w-2.5" />
                {members.length}
              </span>
            )
          })}
        </div>
        <Link
          href={`/superadmin/users?organization=${group.id}`}
          onClick={(e) => e.stopPropagation()}
          className="hidden shrink-0 rounded-lg border border-slate-200 bg-background px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 sm:block"
        >
          Ver sección
        </Link>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-900/20">
          {roleSubGroups.map((roleGroup) => (
            <RoleSubSection key={roleGroup.roleKey} roleGroup={roleGroup} />
          ))}
        </div>
      )}
    </div>
  )
}

type RoleGroup = {
  roleKey: string
  label: string
  color: string
  icon: React.ComponentType<{ className?: string }>
  members: UserRow[]
}

function RoleGroupRow({ group }: { group: RoleGroup }) {
  const [open, setOpen] = useState(true)
  const RoleIcon = group.icon
  const activeCount = group.members.filter((m) => m.memberStatus === 'active').length
  const orgCount = new Set(group.members.map((m) => m.organizationId)).size

  return (
    <div className="border-b border-slate-100 last:border-0 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
      >
        <span className="text-slate-400">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', group.color)}>
          <RoleIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
              {group.label}
            </span>
            <Badge variant="outline" className={cn('rounded-full text-[10px] h-4 px-1.5', group.color)}>
              {group.members.length}
            </Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs text-slate-500">{group.members.length} usuario{group.members.length !== 1 ? 's' : ''}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-xs text-slate-500">en {orgCount} organización{orgCount !== 1 ? 'es' : ''}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{activeCount} activos</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {group.members.map((row, idx) => {
            const statusMeta = STATUS_META[row.memberStatus ?? 'inactive'] ?? { label: row.memberStatus ?? '—', color: 'border-slate-200 bg-slate-50 text-slate-500', icon: XCircle }
            const StatusIcon = statusMeta.icon
            const displayName = row.name || row.email?.split('@')[0] || 'Usuario'
            const isLast = idx === group.members.length - 1

            return (
              <div
                key={row.memberId}
                className={cn(
                  'flex items-center gap-3 py-2.5 pl-12 pr-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30',
                  !isLast && 'border-b border-slate-100/60 dark:border-slate-800/60'
                )}
              >
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  row.memberRole === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                  row.memberRole === 'admin' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                )}>
                  {getInitials(row.name, row.email)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{displayName}</p>
                  {row.email && (
                    <p className="truncate text-xs text-slate-400">{row.email}</p>
                  )}
                </div>

                {row.organizationName && (
                  <Link
                    href={`/superadmin/users?organization=${row.organizationId}`}
                    className="hidden shrink-0 items-center gap-1 text-xs text-slate-600 hover:text-primary dark:text-slate-400 sm:flex"
                  >
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate max-w-[140px]">{row.organizationName}</span>
                  </Link>
                )}

                <Badge variant="outline" className={cn('hidden shrink-0 gap-1 rounded-full text-[11px] md:flex', statusMeta.color)}>
                  <StatusIcon className="h-3 w-3" />
                  {statusMeta.label}
                </Badge>

                <span className="hidden shrink-0 text-xs text-slate-400 lg:block">
                  {formatDate(row.memberSince)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

type SortKey = 'name' | 'role' | 'status' | 'org' | 'since'
type FilterRole = 'all' | 'owner' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'
type FilterStatus = 'all' | 'active' | 'invited' | 'suspended' | 'inactive' | 'issues'
type ViewMode = 'table' | 'tree' | 'role'

export function UsersDashboard({ rows, filterOrg }: { rows: UserRow[]; filterOrg: FilterOrg }) {
  const router = useRouter()
  const { state, setValue } = useUrlListState({
    q: '',
    role: 'all',
    status: 'all',
    sort: 'since',
    dir: 'desc',
    page: '1',
    size: '25',
    view: 'table',
  })
  const search = state.q
  const deferredSearch = useDeferredValue(search)
  const roleFilter = state.role as FilterRole
  const statusFilter = state.status as FilterStatus
  const sortKey = state.sort as SortKey
  const sortDir = state.dir as 'asc' | 'desc'
  const viewMode = (state.view as ViewMode) || 'table'

  const setFilter = (key: 'q' | 'role' | 'status', value: string) => {
    setValue(key, value)
    setValue('page', '1')
  }
  const setSearch = (value: string) => setFilter('q', value)
  const setRoleFilter = (value: FilterRole) => setFilter('role', value)
  const setStatusFilter = (value: FilterStatus) => setFilter('status', value)
  const setViewMode = (mode: ViewMode) => setValue('view', mode)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setValue('dir', sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setValue('sort', key)
      setValue('dir', key === 'since' ? 'desc' : 'asc')
    }
    setValue('page', '1')
  }

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.memberStatus === 'active').length,
    invited: rows.filter((r) => r.memberStatus === 'invited').length,
    suspended: rows.filter((r) => r.memberStatus === 'suspended').length,
    owners: rows.filter((r) => r.memberRole === 'owner').length,
    admins: rows.filter((r) => r.memberRole === 'admin').length,
  }), [rows])

  const roleCounts = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.memberRole, (m.get(r.memberRole) ?? 0) + 1))
    return m
  }, [rows])

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => {
      const st = r.memberStatus ?? 'inactive'
      m.set(st, (m.get(st) ?? 0) + 1)
      const isOrgProblem = Boolean(r.organizationStatus && ['suspended', 'canceled', 'past_due', 'inactive'].includes(r.organizationStatus))
      const isProfileProblem = Boolean(r.profileStatus && r.profileStatus !== 'active')
      const isMemberProblem = r.memberStatus === 'suspended' || r.memberStatus === 'inactive'
      if (isOrgProblem || isProfileProblem || isMemberProblem) {
        m.set('issues', (m.get('issues') ?? 0) + 1)
      }
    })
    return m
  }, [rows])

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    let list = rows.filter((r) => {
      const matchQ = !q || [r.name, r.email, r.userId, r.organizationName, r.organizationSlug].some((v) => v?.toLowerCase().includes(q))
      const matchRole = roleFilter === 'all' || r.memberRole === roleFilter

      const isOrgProblem = Boolean(r.organizationStatus && ['suspended', 'canceled', 'past_due', 'inactive'].includes(r.organizationStatus))
      const isProfileProblem = Boolean(r.profileStatus && r.profileStatus !== 'active')
      const isMemberProblem = r.memberStatus === 'suspended' || r.memberStatus === 'inactive'

      let matchStatus = true
      if (statusFilter === 'active') {
        matchStatus = r.memberStatus === 'active' && !isProfileProblem && !isOrgProblem
      } else if (statusFilter === 'invited') {
        matchStatus = r.memberStatus === 'invited'
      } else if (statusFilter === 'suspended') {
        matchStatus = r.memberStatus === 'suspended' || r.profileStatus === 'suspended' || r.organizationStatus === 'suspended'
      } else if (statusFilter === 'inactive') {
        matchStatus = r.memberStatus === 'inactive' || !r.memberStatus || r.profileStatus === 'inactive' || r.organizationStatus === 'inactive'
      } else if (statusFilter === 'issues') {
        matchStatus = isOrgProblem || isProfileProblem || isMemberProblem
      }

      return matchQ && matchRole && matchStatus
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? '')
      else if (sortKey === 'role') cmp = a.memberRole.localeCompare(b.memberRole)
      else if (sortKey === 'status') cmp = (a.memberStatus ?? '').localeCompare(b.memberStatus ?? '')
      else if (sortKey === 'org') cmp = (a.organizationName ?? '').localeCompare(b.organizationName ?? '')
      else if (sortKey === 'since') cmp = (a.memberSince ?? '').localeCompare(b.memberSince ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [rows, deferredSearch, roleFilter, statusFilter, sortKey, sortDir])

  const pagination = useMemo(
    () => paginateList(filtered, state.page, state.size),
    [filtered, state.page, state.size]
  )

  const orgGroups = useMemo((): OrgGroup[] => {
    const map = new Map<string, OrgGroup>()
    filtered.forEach((row) => {
      const key = row.organizationId
      if (!map.has(key)) {
        map.set(key, {
          id: row.organizationId,
          name: row.organizationName,
          slug: row.organizationSlug,
          plan: row.organizationPlan,
          members: [],
        })
      }
      map.get(key)!.members.push(row)
    })
    return [...map.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [filtered])

  const roleGroups = useMemo((): RoleGroup[] => {
    const map = new Map<string, UserRow[]>()
    filtered.forEach((row) => {
      const key = row.memberRole || 'cliente'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    })

    const roleOrder = ['owner', 'admin', 'vendedor', 'tecnico', 'cliente', 'super_admin']
    const result: RoleGroup[] = []

    roleOrder.forEach((rKey) => {
      const members = map.get(rKey)
      if (members && members.length > 0) {
        const meta = ROLE_META[rKey] ?? { label: rKey, color: 'border-slate-200 bg-slate-50 text-slate-600', icon: Users }
        result.push({
          roleKey: rKey,
          label: meta.label,
          color: meta.color,
          icon: meta.icon,
          members,
        })
        map.delete(rKey)
      }
    })

    map.forEach((members, rKey) => {
      const meta = ROLE_META[rKey] ?? { label: rKey, color: 'border-slate-200 bg-slate-50 text-slate-600', icon: Users }
      result.push({
        roleKey: rKey,
        label: meta.label,
        color: meta.color,
        icon: meta.icon,
        members,
      })
    })

    return result
  }, [filtered])

  function exportCsv() {
    const header = ['Nombre', 'Email', 'Rol', 'Estado membresía', 'Estado cuenta', 'Organización', 'Plan', 'Miembro desde']
    const data = filtered.map((r) => [
      r.name ?? '', r.email ?? '', r.memberRole, r.memberStatus ?? '',
      r.profileStatus ?? '', r.organizationName ?? '', r.organizationPlan ?? '',
      r.memberSince ?? '',
    ])
    const blob = new Blob([[header, ...data].map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usuarios-${filterOrg?.slug ?? 'plataforma'}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const thClass = 'px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'
  const thBtn = 'flex cursor-pointer select-none items-center whitespace-nowrap hover:text-slate-800 dark:hover:text-slate-200 transition-colors'

  const rolePills: Array<{ key: FilterRole; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'owner', label: 'Owner' },
    { key: 'admin', label: 'Admin' },
    { key: 'vendedor', label: 'Vendedor' },
    { key: 'tecnico', label: 'Técnico' },
    { key: 'cliente', label: 'Cliente' },
  ]

  const statusPills: Array<{ key: FilterStatus; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Activos' },
    { key: 'invited', label: 'Invitados' },
    { key: 'suspended', label: 'Suspendidos' },
    { key: 'inactive', label: 'Inactivos' },
    { key: 'issues', label: '⚠️ Inactivos / Problemas' },
  ]

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          {filterOrg ? (
            <>
              <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-slate-500">
                <Link href="/superadmin/organizations">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Organizaciones
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                  Usuarios — {filterOrg.name}
                </h1>
                {filterOrg.plan && (
                  <Badge variant="outline" className={cn('rounded-full text-[11px]', PLAN_COLORS[filterOrg.plan] ?? PLAN_COLORS.FREE)}>
                    {filterOrg.plan}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Miembros de <span className="font-medium">/{filterOrg.slug}</span> — roles, estado y fecha de alta.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                <Users className="h-3.5 w-3.5" />
                Tenants SaaS
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Usuarios SaaS</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Miembros por empresa, rol, estado de acceso y fecha de alta.
              </p>
            </>
          )}
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
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/superadmin/users/super-admins">
              <ShieldCheck className="h-3.5 w-3.5" />
              Super admins
            </Link>
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total miembros" value={rows.length} sub={`${filtered.length} visibles`} icon={Users} />
        <StatCard label="Activos" value={stats.active} sub="con acceso habilitado" icon={CheckCircle2} tone="success" />
        <StatCard label="Invitados" value={stats.invited} sub="pendientes de aceptar" icon={UserPlus} tone="info" />
        <StatCard label="Suspendidos" value={stats.suspended} sub="acceso bloqueado" icon={UserMinus} tone={stats.suspended > 0 ? 'danger' : 'default'} />
        <StatCard label="Owners" value={stats.owners} sub={`${stats.admins} admins`} icon={Crown} tone={stats.owners > 0 ? 'warning' : 'default'} />
      </div>

      {/* Table card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Directorio de usuarios</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {viewMode === 'tree'
                  ? `${orgGroups.length} organizaciones · ${filtered.length} de ${rows.length} miembros`
                  : viewMode === 'role'
                  ? `${roleGroups.length} roles · ${filtered.length} de ${rows.length} miembros`
                  : `${filtered.length} de ${rows.length} miembros`
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                  )}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  Tabla
                </button>
                {!filterOrg && (
                  <button
                    type="button"
                    onClick={() => setViewMode('tree')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                      viewMode === 'tree'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                    )}
                  >
                    <Network className="h-3.5 w-3.5" />
                    Por org
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewMode('role')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    viewMode === 'role'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                  )}
                >
                  <Crown className="h-3.5 w-3.5" />
                  Por rol
                </button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-9 w-64 pl-9 text-sm"
                  placeholder="Buscar nombre, email, org..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Role + status pills */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            {/* Role pills */}
            <div className="flex flex-wrap gap-1">
              {rolePills.map((f) => {
                const count = f.key === 'all' ? rows.length : (roleCounts.get(f.key) ?? 0)
                if (f.key !== 'all' && count === 0) return null
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setRoleFilter(f.key)}
                    className={cn(
                      'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                      roleFilter === f.key
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {ROLE_META[f.key]?.label ?? f.label}
                    <span className={cn(
                      'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                      roleFilter === f.key ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    )}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Status pills */}
            <div className="flex flex-wrap gap-1">
              {statusPills.map((f) => {
                const count = f.key === 'all' ? rows.length : (statusCounts.get(f.key) ?? 0)
                if (f.key !== 'all' && count === 0) return null
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStatusFilter(f.key)}
                    className={cn(
                      'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                      statusFilter === f.key
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {STATUS_META[f.key]?.label ?? f.label}
                    <span className={cn(
                      'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                      statusFilter === f.key ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    )}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {(search || roleFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') }}
                className="h-7 rounded-full px-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Limpiar
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {viewMode === 'tree' && !filterOrg ? (
            <div>
              {rows.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">No hay usuarios registrados</p>
                    <p className="text-xs text-slate-400">Cuando se agreguen miembros a las organizaciones aparecerán aquí</p>
                  </div>
                </div>
              ) : orgGroups.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">Sin resultados para estos filtros</p>
                    <p className="text-xs text-slate-400">Probá limpiar la búsqueda o cambiar los filtros activos</p>
                  </div>
                </div>
              ) : (
                orgGroups.map((group) => <OrgGroupRow key={group.id} group={group} />)
              )}
              {orgGroups.length > 0 && (
                <div className="border-t bg-slate-50/60 px-4 py-2.5 text-xs text-slate-400 dark:bg-slate-800/30">
                  {orgGroups.length} organizaciones · {filtered.length} miembros visibles
                </div>
              )}
            </div>
          ) : viewMode === 'role' ? (
            <div>
              {rows.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">No hay usuarios registrados</p>
                    <p className="text-xs text-slate-400">Cuando se agreguen miembros a las organizaciones aparecerán aquí</p>
                  </div>
                </div>
              ) : roleGroups.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">Sin resultados para estos filtros</p>
                    <p className="text-xs text-slate-400">Probá limpiar la búsqueda o cambiar los filtros activos</p>
                  </div>
                </div>
              ) : (
                roleGroups.map((group) => <RoleGroupRow key={group.roleKey} group={group} />)
              )}
              {roleGroups.length > 0 && (
                <div className="border-t bg-slate-50/60 px-4 py-2.5 text-xs text-slate-400 dark:bg-slate-800/30">
                  {roleGroups.length} roles · {filtered.length} miembros visibles
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      <th className={cn(thClass, 'pl-4')}>
                        <button className={thBtn} onClick={() => toggleSort('name')}>
                          Usuario <SortIndicator active={sortKey === 'name'} direction={sortDir} />
                        </button>
                      </th>
                      <th className={thClass}>
                        <button className={thBtn} onClick={() => toggleSort('role')}>
                          Rol <SortIndicator active={sortKey === 'role'} direction={sortDir} />
                        </button>
                      </th>
                      <th className={thClass}>
                        <button className={thBtn} onClick={() => toggleSort('status')}>
                          Estado <SortIndicator active={sortKey === 'status'} direction={sortDir} />
                        </button>
                      </th>
                      {!filterOrg && (
                        <th className={thClass}>
                          <button className={thBtn} onClick={() => toggleSort('org')}>
                            Organización <SortIndicator active={sortKey === 'org'} direction={sortDir} />
                          </button>
                        </th>
                      )}
                      <th className={thClass}>
                        <button className={thBtn} onClick={() => toggleSort('since')}>
                          <Clock className="mr-1 h-3.5 w-3.5" />
                          Miembro desde <SortIndicator active={sortKey === 'since'} direction={sortDir} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={filterOrg ? 4 : 5} className="py-16 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Users className="h-8 w-8 text-slate-300" />
                            <p className="text-sm font-medium text-slate-500">No hay usuarios registrados</p>
                            <p className="text-xs text-slate-400">Cuando se agreguen miembros a las organizaciones aparecerán aquí</p>
                          </div>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={filterOrg ? 4 : 5} className="py-16 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Search className="h-8 w-8 text-slate-300" />
                            <p className="text-sm font-medium text-slate-500">Sin resultados para estos filtros</p>
                            <p className="text-xs text-slate-400">
                              Probá limpiar la búsqueda o cambiar los filtros activos
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : pagination.items.map((row) => {
                      const roleMeta = ROLE_META[row.memberRole] ?? { label: row.memberRole, color: 'border-slate-200 bg-slate-50 text-slate-600', icon: Users }
                      const statusMeta = STATUS_META[row.memberStatus ?? 'inactive'] ?? { label: row.memberStatus ?? '—', color: 'border-slate-200 bg-slate-50 text-slate-500', icon: XCircle }
                      const RoleIcon = roleMeta.icon
                      const StatusIcon = statusMeta.icon
                      const displayName = row.name || row.email?.split('@')[0] || 'Usuario'

                      return (
                        <tr
                          key={row.memberId}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                        >
                          {/* Usuario */}
                          <td className="py-3 pl-4 pr-3">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                                row.memberRole === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                row.memberRole === 'admin' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              )}>
                                {getInitials(row.name, row.email)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
                                {row.email && (
                                  <p className="truncate text-xs text-slate-400">{row.email}</p>
                                )}
                                {row.profileStatus && row.profileStatus !== 'active' && (
                                  <p className="text-[11px] text-red-500">Cuenta {row.profileStatus}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Rol */}
                          <td className="px-3 py-3">
                            <Badge variant="outline" className={cn('rounded-full gap-1 text-[11px]', roleMeta.color)}>
                              <RoleIcon className="h-3 w-3" />
                              {roleMeta.label}
                            </Badge>
                          </td>

                          {/* Estado */}
                          <td className="px-3 py-3">
                            <Badge variant="outline" className={cn('rounded-full gap-1 text-[11px]', statusMeta.color)}>
                              <StatusIcon className="h-3 w-3" />
                              {statusMeta.label}
                            </Badge>
                          </td>

                          {/* Org (solo cuando no hay filtro) */}
                          {!filterOrg && (
                            <td className="px-3 py-3">
                              {row.organizationName ? (
                                <div>
                                  <Link
                                    href={`/superadmin/users?organization=${row.organizationId}`}
                                    className="group flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-primary dark:text-slate-300"
                                  >
                                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-primary" />
                                    <span className="truncate max-w-[160px]">{row.organizationName}</span>
                                  </Link>
                                  <div className="flex items-center gap-1.5 pl-5">
                                    <p className="text-xs text-slate-400">/{row.organizationSlug}</p>
                                    {row.organizationPlan && (
                                      <Badge variant="outline" className={cn('rounded-full text-[10px] h-4 px-1.5', PLAN_COLORS[row.organizationPlan] ?? PLAN_COLORS.FREE)}>
                                        {row.organizationPlan}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-slate-400">—</span>
                              )}
                            </td>
                          )}

                          {/* Fecha */}
                          <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(row.memberSince)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
