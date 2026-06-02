'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Download,
  Minus,
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
import { cn } from '@/lib/utils'

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

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

type SortKey = 'name' | 'role' | 'status' | 'org' | 'since'
type FilterRole = 'all' | 'owner' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'
type FilterStatus = 'all' | 'active' | 'invited' | 'suspended' | 'inactive'

export function UsersDashboard({ rows, filterOrg }: { rows: UserRow[]; filterOrg: FilterOrg }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [sortKey, setSortKey] = useState<SortKey>('since')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'since' ? 'desc' : 'asc') }
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
    rows.forEach((r) => m.set(r.memberStatus ?? 'inactive', (m.get(r.memberStatus ?? 'inactive') ?? 0) + 1))
    return m
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows.filter((r) => {
      const matchQ = !q || [r.name, r.email, r.userId, r.organizationName, r.organizationSlug].some((v) => v?.toLowerCase().includes(q))
      const matchRole = roleFilter === 'all' || r.memberRole === roleFilter
      const matchStatus = statusFilter === 'all' || (r.memberStatus ?? 'inactive') === statusFilter
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
  }, [rows, search, roleFilter, statusFilter, sortKey, sortDir])

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

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
    return sortDir === 'asc'
      ? <ChevronUp className="ml-1 h-3 w-3 text-indigo-500" />
      : <ChevronDown className="ml-1 h-3 w-3 text-indigo-500" />
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total miembros" value={rows.length} sub={`${filtered.length} visibles`} icon={Users} />
        <StatCard label="Activos" value={stats.active} sub="con acceso habilitado" icon={CheckCircle2} tone="success" />
        <StatCard label="Invitados" value={stats.invited} sub="pendientes de aceptar" icon={UserPlus} tone="info" />
        <StatCard label="Suspendidos" value={stats.suspended} sub="acceso bloqueado" icon={UserMinus} tone={stats.suspended > 0 ? 'danger' : 'default'} />
      </div>

      {/* Table card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Directorio de usuarios</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} de {rows.length} miembros
              </p>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className={cn(thClass, 'pl-4')}>
                    <button className={thBtn} onClick={() => toggleSort('name')}>
                      Usuario <SortIcon col="name" />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('role')}>
                      Rol <SortIcon col="role" />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('status')}>
                      Estado <SortIcon col="status" />
                    </button>
                  </th>
                  {!filterOrg && (
                    <th className={thClass}>
                      <button className={thBtn} onClick={() => toggleSort('org')}>
                        Organización <SortIcon col="org" />
                      </button>
                    </th>
                  )}
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('since')}>
                      <Clock className="mr-1 h-3.5 w-3.5" />
                      Miembro desde <SortIcon col="since" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={filterOrg ? 4 : 5} className="py-16 text-center">
                      <Minus className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">Sin usuarios con estos filtros</p>
                    </td>
                  </tr>
                ) : filtered.map((row) => {
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
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.organizationName}</p>
                              <div className="flex items-center gap-1.5">
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
        </CardContent>
      </Card>
    </div>
  )
}
