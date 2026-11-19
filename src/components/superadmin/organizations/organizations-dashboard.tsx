'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Globe,
  LayoutGrid,
  List,
  Mail,
  Minus,
  MoreHorizontal,
  Package,
  Receipt,
  RefreshCw,
  Rows3,
  Rows4,
  Search,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EnterSupportButton } from '@/components/superadmin/EnterSupportButton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { paginateList, SUPERADMIN_PAGE_SIZES } from '@/lib/superadmin/list-pagination'
import { cn } from '@/lib/utils'
import { SortIndicator } from '@/components/superadmin/sort-indicator'
import { countOrganizationsWithoutSubscription } from '@/lib/superadmin/organization-directory'
import { planLabel, type PlanNames } from '@/lib/superadmin/plan-names'
import { describeLastAccess } from '@/lib/superadmin/last-access'
import {
  ATTENTION_LABELS,
  DEFAULT_SORT_DIRECTION,
  ORGANIZATION_SORT_KEYS,
  PLAN_RANK,
  QUICK_FILTERS,
  buildOrganizationsCsv,
  countQuickFilters,
  describeDue,
  formatPlatformDate,
  getOrganizationAttention,
  matchesQuickFilter,
  normalizeSubscriptionStatus,
  sortOrganizations,
  toEditableOrganization,
  type OrganizationAttention,
  type OrganizationSortKey,
  type QuickFilter,
  type SuperAdminOrganization,
} from '@/lib/superadmin/organization-list'
import { OrganizationPageHeader } from './organization-page-header'
import { normalizeOrganizationSearch } from '@/lib/superadmin/organization-edit'
import { EditOrganizationDialog, type EditableOrganization } from './EditOrganizationDialog'

export type { SuperAdminOrganization } from '@/lib/superadmin/organization-list'

// ---------------------------------------------------------------------------
// Metadatos de rubros y módulos
// ---------------------------------------------------------------------------

export const VERTICAL_META: Record<string, { label: string; icon: string; badge: string }> = {
  electronics: { label: 'Tecnología & Celulares', icon: '📱', badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' },
  clothing: { label: 'Ropa & Moda', icon: '👗', badge: 'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 border-pink-200 dark:border-pink-800' },
  general: { label: 'Comercio General', icon: '🏬', badge: 'bg-muted text-foreground/80 border-border' },
  food: { label: 'Alimentos & Gastronomía', icon: '🍔', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  cosmetics: { label: 'Cosmética & Belleza', icon: '💄', badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  hardware: { label: 'Ferretería & Construcción', icon: '🔨', badge: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
  barbershop: { label: 'Barbería y peluquería', icon: '💈', badge: 'bg-muted text-foreground border-border' },
  other: { label: 'Otros Rubros', icon: '🏷️', badge: 'bg-muted text-foreground/80 border-border' },
}

export const MODULE_META: Record<string, { label: string; short: string; color: string }> = {
  pos: { label: 'Punto de Venta', short: 'POS', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' },
  inventory: { label: 'Inventario', short: 'Stock', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300' },
  inventory_admin: { label: 'Stock Pro', short: 'Stock+', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300' },
  crm: { label: 'Clientes CRM', short: 'CRM', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300' },
  orders: { label: 'Pedidos', short: 'Pedidos', color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300' },
  ecommerce: { label: 'Tienda Online', short: 'Tienda', color: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300' },
  repairs: { label: 'Taller & SAT', short: 'Taller', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' },
  services: { label: 'Servicios', short: 'Servicios', color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300' },
  credits: { label: 'Créditos', short: 'Cuotas', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' },
  delivery: { label: 'Delivery', short: 'Delivery', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300' },
  analytics: { label: 'Analítica', short: 'KPIs', color: 'bg-muted text-foreground/80 border-border' },
  promotions: { label: 'Promociones', short: 'Promos', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300' },
  security: { label: 'Seguridad', short: 'Auditoría', color: 'bg-muted text-foreground/80 border-border' },
}

const MODEL_LABELS: Record<string, string> = { wholesale: 'Mayorista', repair: 'Taller', service: 'Servicios', mixed: 'Mixto' }

function verticalMeta(vertical?: string | null) {
  return VERTICAL_META[vertical || 'general'] || VERTICAL_META.general
}

function RubroBadge({ vertical, model }: { vertical?: string | null; model?: string | null }) {
  const meta = verticalMeta(vertical)
  return (
    <div className="min-w-0 space-y-0.5">
      <Badge variant="outline" className={cn('max-w-full gap-1 truncate rounded-lg px-2 py-0.5 text-xs font-semibold shadow-2xs', meta.badge)}>
        <span aria-hidden>{meta.icon}</span>
        <span className="truncate">{meta.label}</span>
      </Badge>
      {model && model !== 'retail' && (
        <p className="truncate pl-1 text-[11px] font-medium text-muted-foreground">{MODEL_LABELS[model] ?? model}</p>
      )}
    </div>
  )
}

function ModulesPreview({ modules }: { modules?: string[] | null }) {
  if (modules == null) return <span className="text-xs text-muted-foreground">Funciones del plan</span>
  if (modules.length === 0) return <span className="text-xs text-muted-foreground">Sin funciones habilitadas</span>
  const visible = modules.slice(0, 3)
  const remaining = modules.length - visible.length
  return (
    <div className="flex max-w-[220px] flex-wrap items-center gap-1">
      {visible.map((m) => {
        const meta = MODULE_META[m] || { label: m, short: m, color: 'bg-muted text-foreground/80 border-border' }
        return (
          <span key={m} title={meta.label} className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold shadow-2xs', meta.color)}>
            {meta.short}
          </span>
        )
      })}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">+{remaining}</span>
      )}
    </div>
  )
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'border-border bg-muted/40 text-foreground/80',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
}

const PLAN_AVATAR_BG: Record<string, string> = {
  FREE: 'bg-muted-foreground/15 text-foreground/80',
  BASIC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  PRO: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
  ENTERPRISE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
}

const SUB_COLORS: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  trialing: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300',
  past_due: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300',
  unpaid: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
  suspended: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
  canceled: 'border-border bg-muted/40 text-foreground/80',
  expired: 'border-border bg-muted text-foreground/80',
}

const SUB_LABELS: Record<string, string> = {
  active: 'Activo', trialing: 'En prueba', past_due: 'Vencido', unpaid: 'Impago',
  suspended: 'Suspendido', canceled: 'Cancelado', expired: 'Expirado',
}

const PAYMENT_LABELS: Record<string, string> = {
  paid: 'Pagado', pending: 'Pendiente', unpaid: 'Impago', failed: 'Fallido', refunded: 'Reembolsado',
}

function OrgAvatar({ org, size = 'md' }: { org: SuperAdminOrganization; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-9 rounded-lg text-xs' : 'size-11 rounded-xl text-sm'
  if (org.logo_url && !org.erased_at) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={org.logo_url} alt="" className={cn('shrink-0 border border-border bg-background object-contain p-0.5', box)} />
  }
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center font-bold', box, PLAN_AVATAR_BG[org.plan] ?? PLAN_AVATAR_BG.FREE)}>
      {getInitials(org.name)}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const normalized = normalizeSubscriptionStatus(status)
  return (
    <Badge variant="outline" className={cn('rounded-full text-[11px] font-bold shadow-2xs', SUB_COLORS[normalized ?? ''] ?? 'border-border bg-muted/40 text-muted-foreground')}>
      {normalized ? SUB_LABELS[normalized] ?? normalized : 'Sin suscripción'}
    </Badge>
  )
}

function PaymentBadge({ status }: { status: string | null }) {
  const normalized = status?.toLowerCase() ?? ''
  const healthy = normalized === 'paid'
  const warning = normalized === 'pending'
  const failed = normalized === 'failed' || normalized === 'unpaid'
  return (
    <Badge variant="outline" className={cn(
      'rounded-full text-[11px] font-bold shadow-2xs',
      healthy && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300',
      warning && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
      failed && 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300',
      !healthy && !warning && !failed && 'border-border bg-muted/40 text-muted-foreground',
    )}>
      {PAYMENT_LABELS[normalized] ?? status ?? 'Sin registro'}
    </Badge>
  )
}

/** Estado, pago (solo si no está pagado) y la fecha de vencimiento siempre visible. */
function SubscriptionSummary({ org, now }: { org: SuperAdminOrganization; now: number }) {
  const due = describeDue(org, now)
  const showPayment = Boolean(org.subscription_status) && org.payment_status?.toLowerCase() !== 'paid'
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <StatusBadge status={org.subscription_status} />
        {showPayment && <PaymentBadge status={org.payment_status} />}
      </div>
      {due && (
        <p className={cn('flex items-center gap-1 text-xs font-medium', due.urgent ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
          <Clock aria-hidden className="size-3 shrink-0" />
          {due.label}
        </p>
      )}
      {org.cancel_at_period_end && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Cancela al vencer</p>}
    </div>
  )
}

function describeSince(value: string | null | undefined, now: number) {
  if (!value) return null
  return describeLastAccess(value, now).label
}

function ActivitySummary({ org, now }: { org: SuperAdminOrganization; now: number }) {
  const access = org.last_access_known ? describeLastAccess(org.last_access_at, now) : null
  const sale = org.activity_known === false ? null : describeSince(org.last_sale_at, now)
  return (
    <dl className="space-y-0.5 text-xs">
      <div className="flex gap-1">
        <dt className="text-muted-foreground">Acceso:</dt>
        <dd className={cn('font-medium', access?.stale ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>{access ? access.label : 'Sin dato'}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="text-muted-foreground">Venta:</dt>
        <dd className="font-medium text-foreground">{org.activity_known === false ? 'Sin dato' : sale ?? 'Sin ventas'}</dd>
      </div>
    </dl>
  )
}

const ALERT_TONE: Record<string, string> = {
  billing: 'bg-red-500/10 text-red-700 dark:text-red-300',
  due: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  inactive: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  no_subscription: 'bg-muted text-muted-foreground',
}

function AttentionMarker({ attention }: { attention: OrganizationAttention }) {
  if (attention.erased) return <Badge variant="outline" className="rounded-full text-[11px]">Dada de baja</Badge>
  if (attention.rank >= 3) return null
  const label = attention.reasons.filter((reason) => reason !== 'no_subscription').map((reason) => ATTENTION_LABELS[reason]).join(' · ')
  return (
    <span title={label} className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', attention.billingProblem ? ALERT_TONE.billing : ALERT_TONE.due)}>
      <AlertTriangle aria-hidden className="size-3" />
      <span className="sr-only">Requiere atención: </span>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Acciones por organización
// ---------------------------------------------------------------------------

function OrganizationActions({
  org,
  onEdit,
  onCopyUrl,
  showDetail = false,
}: {
  org: SuperAdminOrganization
  onEdit(): void
  onCopyUrl(slug: string): void
  showDetail?: boolean
}) {
  const detailHref = '/superadmin/organizations/' + encodeURIComponent(org.slug)
  return (
    <div className="flex items-center justify-end gap-1">
      {showDetail && (
        <Button asChild variant="ghost" className="min-h-11 rounded-xl px-3 text-sm">
          <Link href={detailHref} aria-label={'Ver ficha de ' + org.name}>Ver<ArrowRight aria-hidden className="size-4" /></Link>
        </Button>
      )}
      {/* Una empresa dada de baja ya no se opera: solo se puede ver su ficha. */}
      {!org.erased_at && (
        <>
          <EnterSupportButton iconOnly organizationId={org.id} organizationName={org.name} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 rounded-xl" aria-label={'Más acciones de ' + org.name}><MoreHorizontal className="size-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-1">
              <DropdownMenuItem onSelect={onEdit} className="min-h-11 gap-2"><Wrench className="size-4" />Editar organización</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCopyUrl(org.slug)} className="min-h-11 gap-2"><Copy className="size-4" />Copiar dirección de la tienda</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="min-h-11 gap-2"><a href={'/' + org.slug + '/inicio'} target="_blank" rel="noreferrer"><Globe className="size-4" />Abrir tienda pública</a></DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11 gap-2"><Link href={'/superadmin/users?organization=' + org.id}><Users className="size-4" />Gestionar equipo</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11 gap-2"><Link href={'/superadmin/subscriptions?q=' + encodeURIComponent(org.slug)}><CreditCard className="size-4" />Suscripción y pagos</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta (vista «Tarjetas»)
// ---------------------------------------------------------------------------

function OrganizationGridCard({
  org,
  now,
  onEdit,
  onCopyUrl,
  planNames,
}: {
  org: SuperAdminOrganization
  now: number
  onEdit: () => void
  onCopyUrl: (slug: string) => void
  planNames?: PlanNames
}) {
  const detailHref = `/superadmin/organizations/${encodeURIComponent(org.slug)}`
  const attention = getOrganizationAttention(org, now)
  const access = org.last_access_known ? describeLastAccess(org.last_access_at, now) : null
  const lastSale = describeSince(org.last_sale_at, now)

  const alerts = [
    attention.billingProblem && { tone: 'billing', label: 'Problema de cobro' },
    attention.trialExpired && { tone: 'due', label: 'Prueba vencida sin pago' },
    attention.dueSoon && { tone: 'due', label: describeDue(org, now)?.label ?? 'Vence pronto' },
    attention.inactive && { tone: 'inactive', label: org.last_access_at ? `Sin entrar: ${access?.label.toLowerCase()}` : 'Nadie del equipo entró' },
    attention.noSubscription && { tone: 'no_subscription', label: 'Sin suscripción' },
  ].filter(Boolean) as Array<{ tone: string; label: string }>

  return (
    <Card
      data-testid={`org-card-${org.slug}`}
      className={cn(
        'group flex flex-col overflow-hidden border-t-4 transition-shadow hover:shadow-md',
        attention.erased ? 'border-t-border opacity-80' : attention.billingProblem ? 'border-t-red-500' : attention.trialExpired || attention.dueSoon || attention.inactive ? 'border-t-amber-500' : 'border-t-emerald-500/70',
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <OrgAvatar org={org} />
        <div className="min-w-0 flex-1">
          <Link href={detailHref} className="block truncate text-sm font-bold text-foreground hover:underline">{org.name}</Link>
          <p className="truncate text-xs leading-5 text-muted-foreground">/{org.slug}</p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
          {planLabel(org.plan, planNames)}
        </Badge>
      </div>

      <div className="px-4">
        {attention.erased ? <Badge variant="outline" className="rounded-full text-[11px]">Dada de baja</Badge> : <SubscriptionSummary org={org} now={now} />}
      </div>

      {alerts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 px-4" aria-label="Requiere atención">
          {alerts.map((alert) => (
            <li key={alert.label} className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', ALERT_TONE[alert.tone])}>{alert.label}</li>
          ))}
        </ul>
      )}

      <dl className="mt-3 grid flex-1 grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-4 py-3 text-xs">
        <div className="col-span-2 min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><User aria-hidden className="size-3" /> Dueño</dt>
          <dd className="mt-0.5 truncate font-medium text-foreground">
            {org.owner_name || org.owner_email || <span className="text-muted-foreground">Sin asignar</span>}
            {org.owner_name && org.owner_email && <span className="font-normal text-muted-foreground"> · {org.owner_email}</span>}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Clock aria-hidden className="size-3" /> Último acceso</dt>
          <dd className={cn('mt-0.5 font-medium', access?.stale ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
            {access ? access.label : <span className="text-muted-foreground">Sin dato</span>}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Receipt aria-hidden className="size-3" /> Última venta</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {org.activity_known === false ? <span className="text-muted-foreground">Sin dato</span> : lastSale ?? <span className="text-muted-foreground">Sin ventas</span>}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Users aria-hidden className="size-3" /> Equipo</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">
            {org.staff_active}/{org.staff_total}
            <span className="font-normal text-muted-foreground"> · {org.customers_total} {org.customers_total === 1 ? 'cliente web' : 'clientes web'}</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Package aria-hidden className="size-3" /> Productos</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">
            {org.products_total == null ? <span className="text-muted-foreground">Sin dato</span> : org.products_total.toLocaleString('es-PY')}
          </dd>
        </div>
        <div className="col-span-2 flex min-w-0 items-center justify-between gap-2">
          <RubroBadge vertical={org.business_vertical} model={org.operating_model} />
          <span className="shrink-0 text-[11px] text-muted-foreground">Alta {formatPlatformDate(org.created_at)}</span>
        </div>
        <div className="col-span-2"><ModulesPreview modules={org.enabled_modules} /></div>
      </dl>

      <div className="flex items-center gap-1 border-t border-border bg-muted/40 p-2.5">
        <Button asChild size="sm" className="min-h-11 gap-2 rounded-xl text-sm font-semibold">
          <Link href={detailHref}>Ver detalle<ArrowRight aria-hidden className="size-3.5" /></Link>
        </Button>
        <div className="ml-auto"><OrganizationActions org={org} onEdit={onEdit} onCopyUrl={onCopyUrl} /></div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Fila compacta para pantallas angostas (vista «Tabla» por debajo de lg)
// ---------------------------------------------------------------------------

function OrganizationListItem({
  org, now, planNames, onEdit, onCopyUrl,
}: {
  org: SuperAdminOrganization
  now: number
  planNames?: PlanNames
  onEdit(): void
  onCopyUrl(slug: string): void
}) {
  const attention = getOrganizationAttention(org, now)
  return (
    <li
      data-testid={`org-row-${org.slug}`}
      className={cn('flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0', attention.billingProblem && 'border-l-4 border-l-red-500', !attention.billingProblem && (attention.trialExpired || attention.dueSoon || attention.inactive) && 'border-l-4 border-l-amber-500')}
    >
      <OrgAvatar org={org} size="sm" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Link href={'/superadmin/organizations/' + encodeURIComponent(org.slug)} className="min-w-0 truncate text-sm font-semibold text-foreground hover:text-primary">{org.name}</Link>
          <Badge variant="outline" className={cn('shrink-0 rounded-full px-1.5 py-0 text-[11px] font-bold', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>{planLabel(org.plan, planNames)}</Badge>
        </div>
        {attention.erased ? <AttentionMarker attention={attention} /> : <SubscriptionSummary org={org} now={now} />}
        {!attention.erased && attention.rank < 3 && <AttentionMarker attention={attention} />}
      </div>
      <OrganizationActions org={org} onEdit={onEdit} onCopyUrl={onCopyUrl} />
    </li>
  )
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

function StatCard({
  label, value, sub, icon: Icon, tone = 'default', onClick, pressed,
}: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'info' | 'danger'
  onClick?: () => void
  pressed?: boolean
}) {
  const iconTones = {
    default: 'text-muted-foreground bg-muted',
    success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300',
    warning: 'text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300',
    info: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/50 dark:text-cyan-300',
    danger: 'text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300',
  }
  const content = (
    <>
      <div className={cn('hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex', iconTones[tone])}><Icon className="size-5" /></div>
      <div className="flex min-w-0 flex-col text-left">
        <p className="text-xs font-medium leading-5 text-muted-foreground">{label}</p>
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-xs leading-5 text-muted-foreground">{sub}</span>
      </div>
    </>
  )
  const className = cn('flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm', pressed && 'ring-2 ring-primary')
  return onClick
    ? <button type="button" onClick={onClick} aria-pressed={pressed} className={cn(className, 'transition-colors hover:bg-muted/40')}>{content}</button>
    : <div className={className}>{content}</div>
}

// ---------------------------------------------------------------------------
// Directorio
// ---------------------------------------------------------------------------

type FilterStatus = 'all' | 'active' | 'trialing' | 'past_due' | 'unpaid' | 'suspended' | 'canceled' | 'expired' | 'no_sub'
type ViewMode = 'table' | 'grid'
type Density = 'compact' | 'comfortable'

const STATUS_FILTERS: Array<{ key: FilterStatus; label: string }> = [
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

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'attention:asc', label: 'Requiere atención primero' },
  { value: 'due:asc', label: 'Vence antes' },
  { value: 'access:asc', label: 'Sin entrar hace más tiempo' },
  { value: 'created:desc', label: 'Más recientes' },
  { value: 'created:asc', label: 'Más antiguas' },
  { value: 'name:asc', label: 'Nombre: A a Z' },
  { value: 'name:desc', label: 'Nombre: Z a A' },
  { value: 'plan:desc', label: 'Plan: mayor a menor' },
  { value: 'plan:asc', label: 'Plan: menor a mayor' },
  { value: 'status:asc', label: 'Estado: más grave primero' },
  { value: 'members:desc', label: 'Mayor equipo' },
]


export function OrganizationsDashboard({
  organizations,
  referenceTime,
  planNames,
}: {
  organizations: SuperAdminOrganization[]
  referenceTime: string
  /** Nombre comercial por código de plan (FREE → Gratis...). */
  planNames?: PlanNames
}) {
  const router = useRouter()
  const now = useMemo(() => new Date(referenceTime).getTime(), [referenceTime])
  const [refreshing, startRefresh] = useTransition()
  const [editingOrg, setEditingOrg] = useState<EditableOrganization | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const { state, setValue } = useUrlListState({
    density: 'compact',
    q: '',
    plan: 'ALL',
    status: 'all',
    vertical: 'ALL',
    quick: 'all',
    sort: 'attention',
    dir: 'asc',
    page: '1',
    size: '25',
    view: 'table',
  })

  // En la URL, como la vista: se comparte el enlace tal como se ve.
  const density: Density = state.density === 'comfortable' ? 'comfortable' : 'compact'
  const changeDensity = (value: Density) => setValue('density', value)

  const viewMode: ViewMode = state.view === 'grid' ? 'grid' : 'table'
  const query = state.q
  const planFilter = state.plan
  const verticalFilter = state.vertical
  const statusFilter = (STATUS_FILTERS.some((f) => f.key === state.status) ? state.status : 'all') as FilterStatus
  const quickFilter = (QUICK_FILTERS.some((f) => f.key === state.quick) ? state.quick : 'all') as QuickFilter
  const sortKey = (ORGANIZATION_SORT_KEYS.includes(state.sort as OrganizationSortKey) ? state.sort : 'attention') as OrganizationSortKey
  const sortDir = state.dir === 'desc' ? 'desc' : 'asc'

  function setFilter(key: 'q' | 'plan' | 'status' | 'vertical' | 'quick', value: string) {
    setValue(key, value)
    setValue('page', '1')
  }

  function clearFilters() {
    setFilter('q', '')
    setFilter('plan', 'ALL')
    setFilter('status', 'all')
    setFilter('vertical', 'ALL')
    setFilter('quick', 'all')
  }

  const operating = useMemo(() => organizations.filter((o) => !o.erased_at), [organizations])

  const stats = useMemo(() => ({
    total: operating.length,
    attention: operating.filter((o) => getOrganizationAttention(o, now).rank < 4).length,
    paying: operating.filter((o) => normalizeSubscriptionStatus(o.subscription_status) === 'active' && o.payment_status?.toLowerCase() === 'paid').length,
    trialing: operating.filter((o) => o.subscription_status === 'trialing').length,
    newThisMonth: operating.filter((o) => o.created_at && new Date(o.created_at).getTime() >= now - 30 * 86_400_000).length,
  }), [operating, now])

  const quickCounts = useMemo(() => countQuickFilters(organizations, now), [organizations, now])
  const planOptions = useMemo(
    () => Array.from(new Set(operating.map((o) => o.plan))).sort((a, b) => (PLAN_RANK[a] ?? 9) - (PLAN_RANK[b] ?? 9)),
    [operating],
  )
  const verticalOptions = useMemo(() => Array.from(new Set(operating.map((o) => o.business_vertical || 'general'))).sort(), [operating])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    operating.forEach((o) => {
      const s = normalizeSubscriptionStatus(o.subscription_status) ?? 'no_sub'
      counts[s] = (counts[s] ?? 0) + 1
    })
    return counts
  }, [operating])

  function toggleSort(key: OrganizationSortKey) {
    if (sortKey === key) setValue('dir', sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setValue('sort', key)
      setValue('dir', DEFAULT_SORT_DIRECTION[key])
    }
    setValue('page', '1')
  }

  const filtered = useMemo(() => {
    const q = normalizeOrganizationSearch(query)
    const rows = organizations.filter((o) => {
      if (!matchesQuickFilter(o, quickFilter, now)) return false
      const vertical = o.business_vertical || 'general'
      const matchQuery = !q || [o.name, o.slug, o.owner_email, o.owner_name, o.id, verticalMeta(vertical).label]
        .some((v) => v && normalizeOrganizationSearch(v).includes(q))
      const matchPlan = planFilter === 'ALL' || o.plan === planFilter
      const matchVertical = verticalFilter === 'ALL' || vertical === verticalFilter
      const normalizedStatus = normalizeSubscriptionStatus(o.subscription_status)
      const matchStatus = statusFilter === 'all'
        || (statusFilter === 'no_sub' && !normalizedStatus)
        || normalizedStatus === statusFilter
      return matchQuery && matchPlan && matchVertical && matchStatus
    })
    return sortOrganizations(rows, sortKey, sortDir, now)
  }, [organizations, query, planFilter, verticalFilter, statusFilter, quickFilter, sortKey, sortDir, now])

  const pagination = useMemo(() => paginateList(filtered, state.page, state.size), [filtered, state.page, state.size])
  const hasFilters = Boolean(query) || planFilter !== 'ALL' || statusFilter !== 'all' || verticalFilter !== 'ALL' || quickFilter !== 'all'

  const pageIds = pagination.items.map((o) => o.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const somePageSelected = pageIds.some((id) => selected.has(id))
  const selectedRows = organizations.filter((o) => selected.has(o.id))

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePage() {
    setSelected((current) => {
      const next = new Set(current)
      if (allPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  function downloadCsv(rows: SuperAdminOrganization[]) {
    const csv = buildOrganizationsCsv(rows, now, planNames)
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `organizaciones-${formatPlatformDate(new Date(now).toISOString(), 'iso')}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    toast.success(`Exportaste ${rows.length} ${rows.length === 1 ? 'organización' : 'organizaciones'}.`)
  }

  async function copyOwnerEmails() {
    const emails = Array.from(new Set(selectedRows.map((o) => o.owner_email).filter(Boolean) as string[]))
    if (!emails.length) {
      toast.error('Las organizaciones elegidas no tienen correo de dueño.')
      return
    }
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      const missing = selectedRows.length - emails.length
      toast.success(`Copiaste ${emails.length} ${emails.length === 1 ? 'correo' : 'correos'}${missing > 0 ? ` (${missing} sin correo)` : ''}.`)
    } catch {
      toast.error('No se pudieron copiar los correos.')
    }
  }

  async function copyUrl(slug: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${slug}/inicio`)
      toast.success('URL pública copiada.')
    } catch {
      toast.error('No se pudo copiar la URL.')
    }
  }

  const editOrganization = (org: SuperAdminOrganization) => () => setEditingOrg(toEditableOrganization(org))

  const emptyState = organizations.length === 0 ? (
    <div className="px-6 py-16 text-center">
      <Building2 aria-hidden className="mx-auto size-8 text-muted-foreground/60" />
      <p className="mt-3 text-sm font-medium text-foreground">Todavía no hay organizaciones</p>
      <p className="mt-1 text-sm text-muted-foreground">Cuando una empresa se registre o la crees, aparece acá.</p>
      <Button asChild className="mt-4 min-h-11 rounded-xl"><Link href="/superadmin/organizations/create">Nueva organización</Link></Button>
    </div>
  ) : (
    <div className="px-6 py-16 text-center">
      <Minus aria-hidden className="mx-auto size-8 text-muted-foreground/60" />
      <p className="mt-3 text-sm text-muted-foreground">No se encontraron organizaciones con estos filtros</p>
      {hasFilters && <Button variant="outline" className="mt-4 min-h-11 rounded-xl" onClick={clearFilters}>Mostrar todas</Button>}
    </div>
  )

  const cellPad = density === 'compact' ? 'py-2.5' : 'py-4'
  const thClass = 'border-b border-border bg-muted px-3 py-2 text-left text-xs font-semibold text-muted-foreground'
  const thBtn = 'flex min-h-11 cursor-pointer select-none items-center whitespace-nowrap transition-colors hover:text-foreground'
  const sortableHeader = (key: OrganizationSortKey, label: string, className?: string) => (
    <th scope="col" aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn(thClass, className)}>
      <button type="button" className={thBtn} onClick={() => toggleSort(key)}>{label}<SortIndicator active={sortKey === key} direction={sortDir} /></button>
    </th>
  )

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <OrganizationPageHeader
        title="Organizaciones"
        description="Encontrá cada empresa, revisá su estado y accedé a su configuración desde un solo lugar."
        actions={<>
          <Button variant="outline" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())} className="gap-2 rounded-xl"><RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />{refreshing ? 'Actualizando…' : 'Actualizar'}</Button>
          <Button variant="outline" onClick={() => downloadCsv(filtered)} disabled={!filtered.length} className="gap-2 rounded-xl"><Download className="size-4" />Exportar resultados</Button>
          <Button asChild className="gap-2 rounded-xl"><Link href="/superadmin/organizations/create"><Building2 className="size-4" />Nueva organización</Link></Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
        <StatCard label="Empresas" value={stats.total} sub={`${quickCounts.erased} dadas de baja aparte`} icon={Building2} />
        <StatCard label="Requieren atención" value={stats.attention} sub="Cobro, vencimiento o sin acceso" icon={AlertTriangle} tone={stats.attention > 0 ? 'danger' : 'default'} onClick={() => setFilter('quick', quickFilter === 'attention' ? 'all' : 'attention')} pressed={quickFilter === 'attention'} />
        <StatCard label="Pagando" value={stats.paying} sub="Activa y con el pago al día" icon={CheckCircle2} tone="success" />
        <StatCard label="En prueba" value={stats.trialing} sub="Suscripción de prueba" icon={Clock} tone={stats.trialing > 0 ? 'warning' : 'default'} />
        <StatCard label="Nuevas (30 días)" value={stats.newThisMonth} sub="Creadas recientemente" icon={CalendarDays} tone={stats.newThisMonth > 0 ? 'info' : 'default'} />
      </div>

      <Card className="overflow-hidden rounded-3xl border border-border bg-card/95 shadow-sm">
        <CardHeader className="space-y-4 border-b border-border bg-card px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold">Directorio de empresas</CardTitle>
              <CardDescription className="mt-1 text-sm">{filtered.length} de {organizations.length} organizaciones</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {viewMode === 'table' && (
                <div className="hidden gap-1 rounded-xl border border-border bg-muted/30 p-1 lg:flex" role="group" aria-label="Densidad de la tabla">
                  <button type="button" onClick={() => changeDensity('compact')} aria-pressed={density === 'compact'} className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm', density === 'compact' && 'bg-card shadow-sm')}><Rows4 aria-hidden className="size-4" />Compacta</button>
                  <button type="button" onClick={() => changeDensity('comfortable')} aria-pressed={density === 'comfortable'} className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm', density === 'comfortable' && 'bg-card shadow-sm')}><Rows3 aria-hidden className="size-4" />Cómoda</button>
                </div>
              )}
              <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1" role="group" aria-label="Vista del directorio">
                <button type="button" onClick={() => setValue('view', 'table')} aria-label="Vista de Tabla" aria-pressed={viewMode === 'table'} className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm', viewMode === 'table' && 'bg-card shadow-sm')}><List className="size-4" />Lista</button>
                <button type="button" onClick={() => setValue('view', 'grid')} aria-label="Vista de Cuadrícula" aria-pressed={viewMode === 'grid'} className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm', viewMode === 'grid' && 'bg-card shadow-sm')}><LayoutGrid className="size-4" />Tarjetas</button>
              </div>
            </div>
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtros rápidos">
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                aria-pressed={quickFilter === filter.key}
                onClick={() => setFilter('quick', filter.key)}
                className={cn(
                  'flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm transition-colors',
                  quickFilter === filter.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted',
                )}
              >
                {filter.label}
                <span className={cn('rounded-full px-1.5 text-xs tabular-nums', quickFilter === filter.key ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground')}>{quickCounts[filter.key]}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_1fr]">
            <label className="space-y-1.5 text-sm font-medium">Buscar empresa<div className="relative"><Search aria-hidden className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input className="h-11 rounded-xl pl-10 text-sm" placeholder="Buscar empresa, slug, owner..." value={query} onChange={(event) => setFilter('q', event.target.value)} /></div></label>
            <label className="space-y-1.5 text-sm font-medium">Plan<select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={planFilter} onChange={(event) => setFilter('plan', event.target.value)}><option value="ALL">Todos los planes</option>{planOptions.map((plan) => <option key={plan} value={plan}>{planLabel(plan, planNames)}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium">Suscripción<select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setFilter('status', event.target.value)}>{STATUS_FILTERS.map((filter) => <option key={filter.key} value={filter.key}>{filter.label} ({filter.key === 'all' ? operating.length : filter.key === 'no_sub' ? countOrganizationsWithoutSubscription(operating) : statusCounts[filter.key] ?? 0})</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium">Rubro<select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={verticalFilter} onChange={(event) => setFilter('vertical', event.target.value)}><option value="ALL">Todos los rubros</option>{verticalOptions.map((vertical) => <option key={vertical} value={vertical}>{verticalMeta(vertical).label}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium">Ordenar<select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={sortKey + ':' + sortDir} onChange={(event) => { const [key, dir] = event.target.value.split(':'); setValue('sort', key); setValue('dir', dir); setValue('page', '1') }}>{SORT_OPTIONS.some((option) => option.value === sortKey + ':' + sortDir) ? null : <option value={sortKey + ':' + sortDir}>Orden de la tabla</option>}{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>

          {hasFilters && filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p role="status" className="text-sm text-muted-foreground">{filtered.length} resultados con los filtros actuales</p>
              <Button variant="ghost" className="min-h-11 text-primary" onClick={clearFilters}>Limpiar filtros</Button>
            </div>
          )}

          {selected.size > 0 && (
            <div role="region" aria-label="Acciones sobre las seleccionadas" className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2">
              <p className="mr-auto text-sm font-medium">{selected.size} {selected.size === 1 ? 'seleccionada' : 'seleccionadas'}</p>
              <Button variant="outline" className="min-h-11 gap-2 rounded-xl" onClick={() => downloadCsv(selectedRows)}><Download aria-hidden className="size-4" />Exportar seleccionadas</Button>
              <Button variant="outline" className="min-h-11 gap-2 rounded-xl" onClick={() => void copyOwnerEmails()}><Mail aria-hidden className="size-4" />Copiar correos de dueños</Button>
              <Button variant="ghost" className="min-h-11 gap-2 rounded-xl" onClick={() => setSelected(new Set())}><X aria-hidden className="size-4" />Quitar selección</Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {!pagination.items.length ? emptyState : viewMode === 'table' ? (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <caption className="sr-only">Directorio de organizaciones</caption>
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th scope="col" className={cn(thClass, 'w-12 pl-4')}>
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          aria-label="Seleccionar las organizaciones de esta página"
                          checked={allPageSelected}
                          ref={(element) => { if (element) element.indeterminate = somePageSelected && !allPageSelected }}
                          onChange={togglePage}
                        />
                      </th>
                      {sortableHeader('name', 'Empresa')}
                      {sortableHeader('plan', 'Plan', 'w-28')}
                      {sortableHeader('status', 'Suscripción', 'w-52')}
                      {sortableHeader('access', 'Actividad', 'w-44')}
                      <th scope="col" className={cn(thClass, 'hidden w-56 xl:table-cell')}>Dueño</th>
                      {sortableHeader('members', 'Uso', 'hidden w-44 2xl:table-cell')}
                      <th scope="col" className={cn(thClass, 'w-40 pr-4 text-right')}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.items.map((org) => {
                      const attention = getOrganizationAttention(org, now)
                      const isSelected = selected.has(org.id)
                      const td = cn('border-b border-border/60 px-3 align-top', cellPad)
                      return (
                        <tr key={org.id} className={cn('group bg-card transition-colors hover:bg-muted/40', isSelected && 'bg-primary/5', attention.erased && 'opacity-70')}>
                          <td className={cn(td, 'pl-4', 'border-l-4', attention.billingProblem ? 'border-l-red-500' : attention.trialExpired || attention.dueSoon || attention.inactive ? 'border-l-amber-500' : 'border-l-transparent')}>
                            <input type="checkbox" className="mt-2 size-4 accent-primary" aria-label={'Seleccionar ' + org.name} checked={isSelected} onChange={() => toggleSelected(org.id)} />
                          </td>
                          <td className={td}>
                            <div className="flex min-w-0 items-start gap-3">
                              <OrgAvatar org={org} size="sm" />
                              <div className="min-w-0 flex-1">
                                <Link href={'/superadmin/organizations/' + encodeURIComponent(org.slug)} title={org.name} className="block truncate text-sm font-semibold leading-5 text-foreground hover:text-primary">{org.name}</Link>
                                <p className="truncate text-xs text-muted-foreground" title={`/${org.slug} · Alta ${formatPlatformDate(org.created_at)}`}>
                                  /{org.slug} · <span aria-hidden>{verticalMeta(org.business_vertical).icon}</span> {verticalMeta(org.business_vertical).label}
                                </p>
                                {(attention.erased || attention.rank < 3) && <div className="mt-1"><AttentionMarker attention={attention} /></div>}
                              </div>
                            </div>
                          </td>
                          <td className={td}><Badge variant="outline" className={cn('rounded-lg px-2 py-0.5 text-xs font-semibold', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>{planLabel(org.plan, planNames)}</Badge></td>
                          <td className={td}>{attention.erased ? <span className="text-xs text-muted-foreground">—</span> : <SubscriptionSummary org={org} now={now} />}</td>
                          <td className={td}><ActivitySummary org={org} now={now} /></td>
                          <td className={cn(td, 'hidden xl:table-cell')}>
                            <p className="truncate font-medium leading-5 text-foreground" title={org.owner_name ?? undefined}>{org.owner_name || <span className="text-muted-foreground">Sin nombre</span>}</p>
                            {org.owner_email ? <a title={org.owner_email} href={'mailto:' + org.owner_email} className="block truncate text-xs leading-5 text-muted-foreground hover:text-primary">{org.owner_email}</a> : <p className="text-xs text-muted-foreground">Sin correo</p>}
                          </td>
                          <td className={cn(td, 'hidden text-xs 2xl:table-cell')}>
                            <p className="tabular-nums"><span className="font-semibold text-foreground">{org.staff_active}/{org.staff_total}</span> <span className="text-muted-foreground">equipo</span></p>
                            <p className="tabular-nums text-muted-foreground">{org.products_total == null ? 'Productos: sin dato' : `${org.products_total.toLocaleString('es-PY')} productos`} · {org.customers_total} clientes</p>
                          </td>
                          <td className={cn(td, 'pr-4')}><OrganizationActions showDetail org={org} onEdit={editOrganization(org)} onCopyUrl={(slug) => void copyUrl(slug)} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="lg:hidden" aria-label="Organizaciones">
                {pagination.items.map((org) => (
                  <OrganizationListItem key={org.id} org={org} now={now} planNames={planNames} onEdit={editOrganization(org)} onCopyUrl={(slug) => void copyUrl(slug)} />
                ))}
              </ul>
            </>
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
              {pagination.items.map((org) => (
                <OrganizationGridCard key={org.id} org={org} now={now} planNames={planNames} onCopyUrl={(slug) => void copyUrl(slug)} onEdit={editOrganization(org)} />
              ))}
            </div>
          )}

          <Pagination
            className="border-t border-border px-6 py-4"
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
      </Card>

      <EditOrganizationDialog
        organization={editingOrg}
        planNames={planNames}
        open={Boolean(editingOrg)}
        onClose={() => setEditingOrg(null)}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
