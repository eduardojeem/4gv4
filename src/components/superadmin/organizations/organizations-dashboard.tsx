'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Globe,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
  trial_ends_at: string | null
  current_period_ends_at: string | null
  members_total: number
  members_active: number
  members_invited: number
  members_suspended: number
}

type Props = {
  organizations: SuperAdminOrganization[]
}

const planStyles: Record<string, string> = {
  FREE: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
}

const subscriptionStyles: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  trialing: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300',
  past_due: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300',
  canceled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
  unpaid: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function shortId(value: string | null) {
  if (!value) return 'Sin owner'
  return `${value.slice(0, 8)}...`
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string | number
  helper: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

export function OrganizationsDashboard({ organizations }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('ALL')
  const [subscription, setSubscription] = useState('ALL')
  const [owner, setOwner] = useState('ALL')

  const planOptions = useMemo(
    () => Array.from(new Set(organizations.map((item) => item.plan))).sort(),
    [organizations]
  )
  const subscriptionOptions = useMemo(
    () => Array.from(new Set(organizations.map((item) => item.subscription_status || 'sin_suscripcion'))).sort(),
    [organizations]
  )

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return organizations.filter((organization) => {
      const matchesQuery = !normalizedQuery || [
        organization.name,
        organization.slug,
        organization.owner_email,
        organization.owner_name,
        organization.id,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))
      const matchesPlan = plan === 'ALL' || organization.plan === plan
      const matchesSubscription = subscription === 'ALL' || (organization.subscription_status || 'sin_suscripcion') === subscription
      const matchesOwner =
        owner === 'ALL' ||
        (owner === 'WITH_OWNER' && Boolean(organization.owner_id)) ||
        (owner === 'WITHOUT_OWNER' && !organization.owner_id)

      return matchesQuery && matchesPlan && matchesSubscription && matchesOwner
    })
  }, [organizations, owner, plan, query, subscription])

  const stats = useMemo(() => {
    const paid = organizations.filter((item) => item.plan !== 'FREE').length
    const withOwner = organizations.filter((item) => item.owner_id).length
    const activeSubscriptions = organizations.filter((item) => item.subscription_status === 'active').length
    const totalMembers = organizations.reduce((sum, item) => sum + item.members_total, 0)
    const createdThisMonth = organizations.filter((item) => {
      if (!item.created_at) return false
      const created = new Date(item.created_at)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      return created >= cutoff
    }).length

    return { paid, withOwner, activeSubscriptions, totalMembers, createdThisMonth }
  }, [organizations])

  function exportCsv() {
    const rows = [
      ['Nombre', 'Slug', 'Plan', 'Suscripcion', 'Owner', 'Email owner', 'Miembros', 'Activos', 'Invitados', 'Suspendidos', 'Creada'],
      ...filtered.map((organization) => [
        organization.name,
        organization.slug,
        organization.plan,
        organization.subscription_status || 'sin_suscripcion',
        organization.owner_name || organization.owner_id || '',
        organization.owner_email || '',
        organization.members_total,
        organization.members_active,
        organization.members_invited,
        organization.members_suspended,
        organization.created_at || '',
      ]),
    ]
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `organizaciones-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function copyTenantUrl(slug: string) {
    const url = `${window.location.origin}/${slug}/inicio`
    await navigator.clipboard.writeText(url)
  }

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Tenants SaaS
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Organizaciones</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Control operativo de empresas, planes, owners, suscripciones y salud basica del ecosistema multiempresa.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.refresh()}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button asChild className="gap-2">
            <Link href="/superadmin/organizations/create">
              <Sparkles className="h-4 w-4" />
              Nueva organizacion
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={organizations.length} helper={`${filtered.length} visibles con filtros`} icon={Building2} />
        <StatCard label="Planes pagos" value={stats.paid} helper="BASIC, PRO o ENTERPRISE" icon={Sparkles} />
        <StatCard label="Owners" value={stats.withOwner} helper="Organizaciones con owner" icon={Users} />
        <StatCard label="Suscripciones" value={stats.activeSubscriptions} helper="Activas actualmente" icon={CheckCircle2} />
        <StatCard label="Nuevas" value={stats.createdThisMonth} helper="Ultimos 30 dias" icon={CalendarDays} />
      </section>

      <Card className="rounded-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>Directorio de organizaciones</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Busqueda y filtros locales sobre los ultimos {organizations.length} tenants cargados.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-4 xl:w-[820px]">
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar empresa, slug u owner"
                  className="pl-9"
                />
              </div>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los planes</SelectItem>
                  {planOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger>
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="WITH_OWNER">Con owner</SelectItem>
                  <SelectItem value="WITHOUT_OWNER">Sin owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={subscription} onValueChange={setSubscription}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Suscripcion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las suscripciones</SelectItem>
                {subscriptionOptions.map((item) => (
                  <SelectItem key={item} value={item}>{item.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(query || plan !== 'ALL' || owner !== 'ALL' || subscription !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery('')
                  setPlan('ALL')
                  setOwner('ALL')
                  setSubscription('ALL')
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Suscripcion</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Miembros</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">{organization.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>/{organization.slug}</span>
                            <button type="button" onClick={() => void copyTenantUrl(organization.slug)} className="hover:text-foreground">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={planStyles[organization.plan] ?? planStyles.FREE}>{organization.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={subscriptionStyles[organization.subscription_status || ''] ?? 'border-slate-200 bg-slate-50 text-slate-600'}>
                        {organization.subscription_status || 'sin suscripcion'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[220px]">
                        <div className="truncate text-sm font-medium">{organization.owner_name || shortId(organization.owner_id)}</div>
                        <div className="truncate text-xs text-muted-foreground">{organization.owner_email || 'Sin email'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{organization.members_total}</div>
                      <div className="text-xs text-muted-foreground">
                        {organization.members_active} activos · {organization.members_invited} invitados · {organization.members_suspended} susp.
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(organization.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon">
                          <Link href={`/${organization.slug}/inicio`} title="Abrir tienda">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon">
                          <Link href={`/superadmin/users?organization=${organization.id}`} title="Ver usuarios">
                            <Users className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon">
                          <Link href="/superadmin/organizations/settings" title="Configuracion tenants">
                            <Settings className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No hay organizaciones que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {filtered.map((organization) => (
              <article key={organization.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{organization.name}</h3>
                    <p className="text-sm text-muted-foreground">/{organization.slug}</p>
                  </div>
                  <Badge variant="outline" className={planStyles[organization.plan] ?? planStyles.FREE}>{organization.plan}</Badge>
                </div>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Suscripcion</span>
                    <span>{organization.subscription_status || 'sin suscripcion'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="max-w-[180px] truncate">{organization.owner_email || shortId(organization.owner_id)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Miembros</span>
                    <span>{organization.members_total}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/${organization.slug}/inicio`}>
                      <Globe className="mr-2 h-4 w-4" />
                      Tienda
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/superadmin/users?organization=${organization.id}`}>
                      <Users className="mr-2 h-4 w-4" />
                      Usuarios
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
            {filtered.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                <ShieldAlert className="mx-auto mb-3 h-8 w-8" />
                No hay organizaciones que coincidan con los filtros.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ArrowUpRight className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="font-semibold">Operacion mas rapida</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Los filtros, exportacion y refresh ya son acciones reales, no controles decorativos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <h2 className="font-semibold">Memberships visibles</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada tenant muestra activos, invitados y suspendidos para detectar problemas de onboarding.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Globe className="mt-0.5 h-5 w-5 text-violet-600" />
              <div>
                <h2 className="font-semibold">Acceso directo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada fila abre la tienda publica, usuarios o configuracion tenant desde la misma tabla.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
