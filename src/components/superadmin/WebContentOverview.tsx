'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  Globe,
  Image as ImageIcon,
  LayoutTemplate,
  Mail,
  MapPin,
  MessageSquare,
  Minus,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  Store,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatCard } from '@/components/superadmin/StatCard'
import { cn } from '@/lib/utils'
import { SortIndicator } from '@/components/superadmin/sort-indicator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrgWebStatus = {
  id: string
  name: string
  slug: string
  plan: string
  marketplacePublic: boolean
  maintenanceMode: boolean
  completion: number
  settingsCount: number
  lastUpdated: string | null
  checks: {
    hasLogo: boolean; hasPhone: boolean; hasEmail: boolean; hasAddress: boolean
    hasHero: boolean; hasServices: boolean; hasTestimonials: boolean
  }
}

export type WebContentData = {
  orgs: OrgWebStatus[]
  summary: {
    total: number; fullyConfigured: number; inMaintenance: number
    marketplacePublic: number; noLogo: number; avgCompletion: number
  }
  fetchedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null) {
  if (!value) return 'Nunca'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function relativeTime(value: string | null) {
  if (!value) return 'Sin actividad'
  const ms = Date.now() - new Date(value).getTime()
  const days = Math.floor(ms / 86400000)
  if (days < 1) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days}d`
  if (days < 365) return `Hace ${Math.floor(days / 30)}mes`
  return `Hace ${Math.floor(days / 365)}a`
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
}

function completionColor(percent: number) {
  if (percent >= 80) return 'bg-emerald-500'
  if (percent >= 50) return 'bg-amber-500'
  if (percent >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

function completionTextColor(percent: number) {
  if (percent >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (percent >= 50) return 'text-amber-600 dark:text-amber-400'
  if (percent >= 20) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Completion checks visualization (mini icons)
// ---------------------------------------------------------------------------

function ChecksRow({ checks }: { checks: OrgWebStatus['checks'] }) {
  const items: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; ok: boolean }> = [
    { icon: ImageIcon,       label: 'Logo',          ok: checks.hasLogo },
    { icon: Phone,           label: 'Teléfono',      ok: checks.hasPhone },
    { icon: Mail,            label: 'Email',         ok: checks.hasEmail },
    { icon: MapPin,          label: 'Dirección',     ok: checks.hasAddress },
    { icon: Sparkles,        label: 'Hero',          ok: checks.hasHero },
    { icon: LayoutTemplate,  label: 'Servicios',     ok: checks.hasServices },
    { icon: MessageSquare,   label: 'Testimonios',   ok: checks.hasTestimonials },
  ]
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            title={`${item.label}: ${item.ok ? 'configurado' : 'falta'}`}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md border',
              item.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-400'
                : 'border-slate-200 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600'
            )}
          >
            <Icon className="h-3 w-3" />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-sections quick links
// ---------------------------------------------------------------------------

function SubsectionsRow() {
  const subs = [
    { href: '/superadmin/web-content/brand', icon: Sparkles, label: 'Marca SaaS', sub: 'Logo, textos globales y CTAs', tone: 'border-cyan-200 bg-cyan-50 dark:border-cyan-900/50 dark:bg-cyan-950/20' },
    { href: '/superadmin/web-content/landing', icon: LayoutTemplate, label: 'Landing principal', sub: 'Contenido editorial del SaaS', tone: 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20' },
    { href: '/superadmin/web-content/marketplace', icon: Store, label: 'Marketplace público', sub: 'Categorías y empresas destacadas', tone: 'border-violet-200 bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/20' },
  ]
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {subs.map((s) => {
        const Icon = s.icon
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn('group flex items-center gap-3 rounded-xl border p-4 transition-all hover:shadow-sm', s.tone)}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/80 text-slate-700 dark:text-slate-300">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 dark:text-slate-50">{s.label}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{s.sub}</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type SortKey = 'name' | 'plan' | 'completion' | 'updated'
type FilterStatus = 'all' | 'fullyConfigured' | 'incomplete' | 'maintenance' | 'noLogo'

export function WebContentOverview({ data }: { data: WebContentData }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sortKey, setSortKey] = useState<SortKey>('completion')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'updated' ? 'desc' : 'asc') }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = data.orgs.filter((o) => {
      const matchQ = !q || o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)
      const matchFilter = filter === 'all'
        || (filter === 'fullyConfigured' && o.completion >= 80)
        || (filter === 'incomplete' && o.completion < 80)
        || (filter === 'maintenance' && o.maintenanceMode)
        || (filter === 'noLogo' && !o.checks.hasLogo)
      return matchQ && matchFilter
    })

    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'plan') cmp = a.plan.localeCompare(b.plan)
      else if (sortKey === 'completion') cmp = a.completion - b.completion
      else if (sortKey === 'updated') cmp = (a.lastUpdated ?? '').localeCompare(b.lastUpdated ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [data.orgs, search, filter, sortKey, sortDir])

  const thClass = 'px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'
  const thBtn = 'flex cursor-pointer select-none items-center whitespace-nowrap hover:text-slate-800 dark:hover:text-slate-200 transition-colors'

  const filterPills: Array<{ key: FilterStatus; label: string; count: number }> = [
    { key: 'all', label: 'Todas', count: data.summary.total },
    { key: 'fullyConfigured', label: '✓ Completas', count: data.summary.fullyConfigured },
    { key: 'incomplete', label: '⚠ Incompletas', count: data.summary.total - data.summary.fullyConfigured },
    { key: 'maintenance', label: '🔧 En mantenimiento', count: data.summary.inMaintenance },
    { key: 'noLogo', label: 'Sin logo', count: data.summary.noLogo },
  ]

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Globe className="h-3.5 w-3.5" />
            Contenido web
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Sitios públicos de tenants</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Estado de configuración del contenido público (landing, hero, contacto) de cada organización.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
      </header>

      {/* Sub-sections */}
      <SubsectionsRow />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Configuración promedio"
          value={`${data.summary.avgCompletion}%`}
          sub={`${data.summary.total} sitios analizados`}
          icon={LayoutTemplate}
          tone={data.summary.avgCompletion >= 70 ? 'success' : data.summary.avgCompletion >= 40 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Completos"
          value={data.summary.fullyConfigured}
          sub="≥ 80% configurado"
          icon={CheckCircle2}
          tone={data.summary.fullyConfigured > 0 ? 'success' : 'default'}
        />
        <StatCard
          label="En mantenimiento"
          value={data.summary.inMaintenance}
          sub="sitios deshabilitados"
          icon={AlertTriangle}
          tone={data.summary.inMaintenance > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Sin logo"
          value={data.summary.noLogo}
          sub="branding incompleto"
          icon={FileImage}
          tone={data.summary.noLogo > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Sitios por organización</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} de {data.orgs.length} sitios
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 w-64 pl-9 text-sm"
                placeholder="Buscar empresa o slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {filterPills.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                  filter === f.key
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {f.label}
                <span className={cn(
                  'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                  filter === f.key ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                )}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                    <button className={thBtn} onClick={() => toggleSort('completion')}>
                      Completitud <SortIndicator active={sortKey === 'completion'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}>Configurado</th>
                  <th className={thClass}>Visibilidad</th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('updated')}>
                      Actualizado <SortIndicator active={sortKey === 'updated'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={cn(thClass, 'pr-4 text-right')}>Sitio</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Minus className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">
                        {data.orgs.length === 0 ? 'No hay organizaciones' : 'Sin resultados con estos filtros'}
                      </p>
                    </td>
                  </tr>
                ) : filtered.map((org) => (
                  <tr
                    key={org.id}
                    className={cn(
                      'border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40',
                      org.maintenanceMode && 'bg-amber-50/40 dark:bg-amber-950/10'
                    )}
                  >
                    {/* Empresa */}
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {getInitials(org.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{org.name}</p>
                            {org.maintenanceMode && (
                              <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                                🔧 Mantenimiento
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-400">/{org.slug}</p>
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={cn('rounded-full text-[11px]', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
                        {org.plan}
                      </Badge>
                    </td>

                    {/* Completitud */}
                    <td className="px-3 py-3">
                      <div className="space-y-1 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className={cn('h-full rounded-full', completionColor(org.completion))} style={{ width: `${org.completion}%` }} />
                          </div>
                          <span className={cn('text-xs font-bold tabular-nums', completionTextColor(org.completion))}>
                            {org.completion}%
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Configurado (icons) */}
                    <td className="px-3 py-3">
                      <ChecksRow checks={org.checks} />
                    </td>

                    {/* Visibilidad */}
                    <td className="px-3 py-3">
                      {org.marketplacePublic ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <Eye className="h-3 w-3" /> Público
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <EyeOff className="h-3 w-3" /> Privado
                        </div>
                      )}
                    </td>

                    {/* Última actualización */}
                    <td className="px-3 py-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <div>{relativeTime(org.lastUpdated)}</div>
                        <div className="text-[10px] text-slate-400">{formatDate(org.lastUpdated)}</div>
                      </div>
                    </td>

                    {/* Sitio */}
                    <td className="py-3 pl-3 pr-4 text-right">
                      <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                        <a href={`/${org.slug}/inicio`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3" />
                          Ver sitio
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
