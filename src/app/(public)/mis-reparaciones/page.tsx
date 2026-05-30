import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { getRepairStatusConfig } from '@/lib/constants/repair-status'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import {
  ArrowRight, Wrench, Clock, CheckCircle2, Package,
  AlertCircle, Calendar, Banknote, Ticket
} from 'lucide-react'
import { getPublicTenantPathPrefix, prefixPublicTenantPath } from '@/lib/public/tenant-path'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'

export const metadata: Metadata = {
  robots: { index: false, follow: false }
}

type RepairRow = {
  id: string
  ticket_number: string | null
  device_type: string | null
  device_brand: string | null
  device_model: string | null
  problem_description: string | null
  status: string
  created_at: string | null
  final_cost: number | null
  estimated_cost: number | null
}

const STATUS_COLORS: Record<string, string> = {
  recibido:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
  diagnostico: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800',
  en_reparacion:'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
  listo:       'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800',
  entregado:   'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700',
  cancelado:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = getRepairStatusConfig(status)
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.recibido
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
      {status === 'listo' || status === 'entregado'
        ? <CheckCircle2 className="h-3 w-3" />
        : status === 'cancelado'
          ? <AlertCircle className="h-3 w-3" />
          : <Clock className="h-3 w-3" />
      }
      {cfg.label}
    </span>
  )
}

export default async function MisReparacionesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  const tenantPrefix = await getPublicTenantPathPrefix()
  const repairsHref = prefixPublicTenantPath(tenantPrefix, '/mis-reparaciones')
  const tenantSlug = tenantPrefix.replace('/', '') || null

  // — Redirect unauthenticated users to login —
  if (!user) {
    const loginHref = tenantPrefix ? `${tenantPrefix}/cliente/login` : '/login'
    redirect(`${loginHref}?next=${encodeURIComponent(repairsHref)}`)
  }

  const headerStore = await headers()
  const organizationSlug = tenantSlug || headerStore.get('x-tenant-slug')
  const organization = organizationSlug
    ? await resolvePublicOrganizationBySlug(organizationSlug, createAdminSupabase())
    : null
  if (organizationSlug && !organization) {
    notFound()
  }

  const settings = await fetchWebsiteSettings()
  const companyName = settings?.company_info?.name || '4G Celulares'

  let repairs: RepairRow[] = []
  let customerName = ''
  let membership: { role: string; status: string } | null = null

  if (organization) {
    const admin = createAdminSupabase()
    const { data } = await admin
      .from('organization_members')
      .select('role, status')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .maybeSingle()

    membership = data
  }

  let customerQuery = supabase
    .from('customers')
    .select('id, name')
    .eq('profile_id', user.id)

  if (organization) {
    customerQuery = customerQuery.eq('organization_id', organization.id)
  }

  const { data: customerData } = await customerQuery.maybeSingle()

  if (organization && (!membership || membership.status !== 'active' || !customerData)) {
    redirect(`${tenantPrefix}/cliente/login?next=${encodeURIComponent(repairsHref)}`)
  }

  if (customerData) {
    customerName = customerData.name || ''
    let repairsQuery = supabase
      .from('repairs')
      .select('id, ticket_number, device_type, device_brand, device_model, problem_description, status, created_at, final_cost, estimated_cost')
      .eq('customer_id', customerData.id)

    if (organization) {
      repairsQuery = repairsQuery.eq('organization_id', organization.id)
    }

    const { data: repairsData } = await repairsQuery
      .order('created_at', { ascending: false })
      .limit(50)

    repairs = (repairsData as RepairRow[] | null) ?? []
  }

  const activeRepairs = repairs.filter(r => !['entregado', 'cancelado'].includes(r.status))
  const completedRepairs = repairs.filter(r => ['entregado', 'cancelado'].includes(r.status))

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      <div className="container max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary mb-1">Panel Personal</p>
            <h1 className="text-3xl font-bold tracking-tight">Mis Reparaciones</h1>
            <p className="mt-1 text-muted-foreground">
              Bienvenido{customerName ? `, ${customerName.split(' ')[0]}` : ''} · {companyName}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ticket className="h-4 w-4" />
            <span><strong className="text-foreground">{repairs.length}</strong> órdenes en total</span>
          </div>
        </div>

        {/* ── Stats row ── */}
        {repairs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: repairs.length, icon: Package, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
              { label: 'En curso', value: activeRepairs.length, icon: Wrench, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
              { label: 'Completadas', value: completedRepairs.length, icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
              {
                label: 'Gastado',
                value: formatCurrency(repairs.reduce((s, r) => s + (r.final_cost || r.estimated_cost || 0), 0)),
                icon: Banknote,
                color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30'
              },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="rounded-2xl border bg-card p-4 flex items-center gap-3 shadow-sm">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                    <p className="text-base font-bold text-foreground truncate">{stat.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Active repairs ── */}
        {activeRepairs.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-500" />
              <h2 className="font-semibold text-foreground">En Curso</h2>
              <Badge variant="secondary" className="ml-1">{activeRepairs.length}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeRepairs.map(r => {
                const device = [r.device_brand, r.device_model].filter(Boolean).join(' ') || 'Dispositivo'
                const cost = r.final_cost ?? r.estimated_cost
                const created = r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
                return (
                  <Link key={r.id} href={`${repairsHref}/${encodeURIComponent(r.ticket_number || r.id)}`}>
                    <Card className="group border-2 border-transparent hover:border-primary/30 hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs font-semibold text-muted-foreground">{r.ticket_number || r.id.slice(0, 8)}</p>
                            <p className="mt-0.5 text-base font-bold text-foreground truncate">{device}</p>
                          </div>
                          <StatusBadge status={r.status} />
                        </div>
                        {r.problem_description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{r.problem_description}</p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {created}
                          </span>
                          {cost != null && (
                            <span className="font-semibold text-foreground">{formatCurrency(cost)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity -mt-1">
                          Ver detalle <ArrowRight className="h-3 w-3" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Completed repairs ── */}
        {completedRepairs.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <h2 className="font-semibold text-foreground">Historial</h2>
              <Badge variant="outline" className="ml-1">{completedRepairs.length}</Badge>
            </div>
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className="divide-y">
                {completedRepairs.map(r => {
                  const device = [r.device_brand, r.device_model].filter(Boolean).join(' ') || 'Dispositivo'
                  const cost = r.final_cost ?? r.estimated_cost
                  const created = r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
                  return (
                    <Link key={r.id} href={`${repairsHref}/${encodeURIComponent(r.ticket_number || r.id)}`} className="block">
                      <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors group">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono text-xs text-muted-foreground">{r.ticket_number || r.id.slice(0, 8)}</p>
                            <StatusBadge status={r.status} />
                          </div>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">{device}</p>
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-xs text-muted-foreground">{created}</p>
                          {cost != null && <p className="text-sm font-semibold">{formatCurrency(cost)}</p>}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Empty state ── */}
        {repairs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border-2 border-dashed">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Wrench className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Todavía no tenés reparaciones</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              Cuando traigas tu equipo, podrás seguir el estado de tu reparación desde acá.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
