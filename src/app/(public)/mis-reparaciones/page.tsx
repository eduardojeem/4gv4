import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Package,
  PackageCheck,
  Ticket,
  Wrench,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/currency'
import { getRepairStatusConfig } from '@/lib/constants/repair-status'
import { calculateCustomerAccountSummary, getRepairBalance } from '@/lib/profile/customer-account-summary'
import {
  buildCustomerRepairsHref,
  CUSTOMER_REPAIRS_PAGE_SIZE,
  getCustomerRepairStatusFilter,
  parseCustomerRepairsQuery,
  type CustomerRepairFilter,
} from '@/lib/public/customer-repairs'
import { getPublicTenantPathPrefix, prefixPublicTenantPath } from '@/lib/public/tenant-path'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  paid_amount: number | null
  payment_status: string | null
}

const STATUS_STYLES: Record<string, string> = {
  recibido: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
  diagnostico: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  reparacion: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  pausado: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/60 dark:bg-yellow-950/30 dark:text-yellow-300',
  listo: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  entregado: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  cancelado: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
}

function StatusBadge({ status }: { status: string }) {
  const config = getRepairStatusConfig(status)
  const Icon = config.Icon

  return (
    <Badge variant="outline" className={cn('gap-1.5 whitespace-nowrap rounded-full text-[11px]', STATUS_STYLES[status] || STATUS_STYLES.recibido)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  )
}

function PaymentSummary({ repair }: { repair: RepairRow }) {
  const balance = getRepairBalance(repair)
  if (balance.cost <= 0) {
    return <span className="text-xs text-muted-foreground">Monto por confirmar</span>
  }

  if (balance.isPaid) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Pagado · {formatCurrency(balance.cost)}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
      <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" />
      {balance.paidAmount > 0 ? 'Saldo pendiente' : 'Por pagar'} · {formatCurrency(balance.pendingAmount)}
    </span>
  )
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default async function MisReparacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>
}) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  const tenantPrefix = await getPublicTenantPathPrefix()
  const repairsHref = prefixPublicTenantPath(tenantPrefix, '/mis-reparaciones')

  if (!user) {
    const loginHref = tenantPrefix ? `${tenantPrefix}/cliente/login` : '/login'
    redirect(`${loginHref}?next=${encodeURIComponent(repairsHref)}`)
  }

  const headerStore = await headers()
  const tenantSlug = tenantPrefix.replace('/', '') || headerStore.get('x-tenant-slug')
  const admin = createAdminSupabase()
  const organization = tenantSlug
    ? await resolvePublicOrganizationBySlug(tenantSlug, admin)
    : null

  if (tenantSlug && !organization) notFound()

  const settings = await fetchWebsiteSettings()
  const companyName = settings?.company_info?.name || organization?.name || 'Tienda'
  const parsedQuery = parseCustomerRepairsQuery(await searchParams)

  let customerQuery = admin
    .from('customers')
    .select('id, name')
    .eq('profile_id', user.id)

  let membershipQuery = admin
    .from('organization_members')
    .select('role, status')
    .eq('user_id', user.id)

  if (organization) {
    customerQuery = customerQuery.eq('organization_id', organization.id)
    membershipQuery = membershipQuery.eq('organization_id', organization.id)
  } else {
    customerQuery = customerQuery.limit(1)
  }

  const [{ data: customer, error: customerError }, { data: membership, error: membershipError }] = await Promise.all([
    customerQuery.maybeSingle(),
    organization
      ? membershipQuery.maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (customerError || membershipError) {
    throw customerError || membershipError
  }

  if (!customer || (organization && (!membership || membership.status !== 'active'))) {
    const loginHref = tenantPrefix ? `${tenantPrefix}/cliente/login` : '/login'
    redirect(`${loginHref}?next=${encodeURIComponent(repairsHref)}`)
  }

  let financialRepairsQuery = admin
    .from('repairs')
    .select('status, final_cost, estimated_cost, paid_amount, payment_status')
    .eq('customer_id', customer.id)
    .or('is_deleted.is.null,is_deleted.eq.false')

  if (organization) {
    financialRepairsQuery = financialRepairsQuery.eq('organization_id', organization.id)
  }

  const financialRepairsResult = await financialRepairsQuery
  if (financialRepairsResult.error) throw financialRepairsResult.error

  const financialRepairs = financialRepairsResult.data || []

  const repairAccount = calculateCustomerAccountSummary({
    repairs: financialRepairs,
    orders: [],
    credits: [],
    storeCreditMovements: [],
  })

  const activeStatuses = new Set(['recibido', 'diagnostico', 'reparacion', 'pausado'])
  const counts = financialRepairs.reduce((result, repair) => {
    result.all += 1
    if (activeStatuses.has(repair.status)) result.active += 1
    if (repair.status === 'listo') result.ready += 1
    if (repair.status === 'entregado') result.delivered += 1
    if (repair.status === 'cancelado') result.cancelled += 1
    return result
  }, { all: 0, active: 0, ready: 0, delivered: 0, cancelled: 0 })

  const selectedStatuses = getCustomerRepairStatusFilter(parsedQuery.status)
  const from = (parsedQuery.page - 1) * CUSTOMER_REPAIRS_PAGE_SIZE
  const to = from + CUSTOMER_REPAIRS_PAGE_SIZE - 1

  let repairsQuery = admin
    .from('repairs')
    .select('id, ticket_number, device_type, device_brand, device_model, problem_description, status, created_at, final_cost, estimated_cost, paid_amount, payment_status', { count: 'exact' })
    .eq('customer_id', customer.id)
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (organization) repairsQuery = repairsQuery.eq('organization_id', organization.id)
  if (selectedStatuses) repairsQuery = repairsQuery.in('status', selectedStatuses)

  const { data, count: filteredCount, error: repairsError } = await repairsQuery
  if (repairsError) throw repairsError

  const totalPages = Math.max(1, Math.ceil((filteredCount || 0) / CUSTOMER_REPAIRS_PAGE_SIZE))
  if (parsedQuery.page > totalPages && (filteredCount || 0) > 0) {
    redirect(buildCustomerRepairsHref(repairsHref, parsedQuery.status, totalPages))
  }

  const repairs = (data || []) as RepairRow[]
  const filters: Array<{ key: CustomerRepairFilter; label: string; count: number }> = [
    { key: 'all', label: 'Todas', count: counts.all },
    { key: 'active', label: 'En proceso', count: counts.active },
    { key: 'ready', label: 'Listas', count: counts.ready },
    { key: 'delivered', label: 'Entregadas', count: counts.delivered },
    { key: 'cancelled', label: 'Canceladas', count: counts.cancelled },
  ]

  const summary = [
    { label: 'Total', value: counts.all, icon: Package, tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' },
    { label: 'En proceso', value: counts.active, icon: Wrench, tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
    { label: 'Para retirar', value: counts.ready, icon: PackageCheck, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
    { label: 'Entregadas', value: counts.delivered, icon: CheckCircle2, tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    { label: 'Canceladas', value: counts.cancelled, icon: XCircle, tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' },
  ]

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3 text-muted-foreground">
              <Link href={tenantPrefix ? `${tenantPrefix}/perfil` : '/perfil'}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al perfil
              </Link>
            </Button>
            <p className="text-sm font-semibold text-primary">Seguimiento de equipos</p>
            <h1 className="mt-1 text-3xl font-bold text-foreground sm:text-4xl">Mis reparaciones</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {customer.name ? `${customer.name.split(' ')[0]}, revisá` : 'Revisá'} el estado, los pagos y el historial de tus equipos en {companyName}.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <Ticket className="h-4 w-4 text-primary" aria-hidden="true" />
            <span><strong className="text-foreground">{counts.all}</strong> {counts.all === 1 ? 'reparación registrada' : 'reparaciones registradas'}</span>
          </div>
        </header>

        <section aria-label="Resumen de reparaciones" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {summary.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex min-h-24 items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tone)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
              </div>
            </div>
          ))}
        </section>

        <section
          aria-labelledby="repair-total-due-title"
          className={cn(
            'flex flex-col gap-4 rounded-lg border p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between',
            repairAccount.repairs.pendingAmount > 0
              ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20'
              : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20'
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              repairAccount.repairs.pendingAmount > 0
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            )}>
              {repairAccount.repairs.pendingAmount > 0
                ? <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
                : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Resumen de pagos de reparaciones</p>
              <h2 id="repair-total-due-title" className="mt-1 text-base font-semibold text-foreground">
                {repairAccount.repairs.pendingAmount > 0 ? 'Total a pagar' : 'Reparaciones al día'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {repairAccount.repairs.pendingAmount > 0
                  ? `${repairAccount.repairs.pendingCount} ${repairAccount.repairs.pendingCount === 1 ? 'reparación tiene' : 'reparaciones tienen'} saldo pendiente.`
                  : 'No tenés saldos pendientes en reparaciones registradas.'}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className={cn(
              'text-3xl font-bold tabular-nums',
              repairAccount.repairs.pendingAmount > 0
                ? 'text-amber-800 dark:text-amber-300'
                : 'text-emerald-800 dark:text-emerald-300'
            )}>
              {formatCurrency(repairAccount.repairs.pendingAmount)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pagadas: {repairAccount.repairs.paidCount}
            </p>
          </div>
        </section>

        <section aria-labelledby="repair-list-title" className="space-y-5">
          <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="repair-list-title" className="text-lg font-semibold text-foreground">Reparaciones registradas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredCount || 0} resultados en esta vista
              </p>
            </div>
            <nav aria-label="Filtrar reparaciones" className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex min-w-max gap-1 rounded-lg bg-muted p-1">
                {filters.map((filter) => (
                  <Link
                    key={filter.key}
                    href={buildCustomerRepairsHref(repairsHref, filter.key)}
                    aria-current={parsedQuery.status === filter.key ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors',
                      parsedQuery.status === filter.key
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {filter.label}
                    <span className="tabular-nums text-[11px] opacity-70">{filter.count}</span>
                  </Link>
                ))}
              </div>
            </nav>
          </div>

          {repairs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {repairs.map((repair) => {
                const device = [repair.device_brand, repair.device_model].filter(Boolean).join(' ') || repair.device_type || 'Dispositivo'
                const detailHref = `${repairsHref}/${encodeURIComponent(repair.ticket_number || repair.id)}`

                return (
                  <Link key={repair.id} href={detailHref} className="group block h-full">
                    <article className={cn(
                      'flex h-full min-h-56 flex-col rounded-lg border bg-card p-5 shadow-sm transition-colors group-hover:border-primary/40',
                      repair.status === 'listo' ? 'border-emerald-300 dark:border-emerald-900' : 'border-border'
                    )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-muted-foreground">
                            {repair.ticket_number || repair.id.slice(0, 8).toUpperCase()}
                          </p>
                          <h3 className="mt-1 truncate text-base font-semibold text-foreground">{device}</h3>
                        </div>
                        <StatusBadge status={repair.status} />
                      </div>

                      <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
                        {repair.problem_description || 'Sin descripción del problema.'}
                      </p>

                      <div className="mt-auto space-y-3 pt-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatDate(repair.created_at)}
                          </span>
                          <PaymentSummary repair={repair} />
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          Ver detalle <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-5 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {counts.all === 0 ? <Wrench className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {counts.all === 0 ? 'Todavía no tenés reparaciones' : 'No hay reparaciones en este estado'}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {counts.all === 0
                  ? 'Cuando registremos un equipo a tu nombre, podrás seguir su avance y sus pagos desde acá.'
                  : 'Probá otro filtro para consultar el resto de tu historial.'}
              </p>
              {counts.all > 0 && (
                <Button asChild variant="outline" size="sm" className="mt-5">
                  <Link href={repairsHref}>Ver todas</Link>
                </Button>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Paginación de reparaciones" className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Página <strong className="text-foreground">{parsedQuery.page}</strong> de <strong className="text-foreground">{totalPages}</strong>
              </p>
              <div className="flex gap-2">
                {parsedQuery.page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildCustomerRepairsHref(repairsHref, parsedQuery.status, parsedQuery.page - 1)}>
                      <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                  </Button>
                )}
                {parsedQuery.page < totalPages ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildCustomerRepairsHref(repairsHref, parsedQuery.status, parsedQuery.page + 1)}>
                      Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </nav>
          )}
        </section>
      </div>
    </main>
  )
}
