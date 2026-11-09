'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Globe, LayoutGrid,
  List,
  Minus,
  MoreHorizontal,
  Package,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  User,
  Users,
  Wrench
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
import { countOrganizationsWithoutSubscription, getSubscriptionTiming } from '@/lib/superadmin/organization-directory'
import { planLabel, type PlanNames } from '@/lib/superadmin/plan-names'
import { describeLastAccess } from '@/lib/superadmin/last-access'
import { OrganizationPageHeader } from './organization-page-header'
import { normalizeOrganizationSearch } from '@/lib/superadmin/organization-edit'
import { EditOrganizationDialog, type EditableOrganization } from './EditOrganizationDialog'

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
  business_vertical?: string | null
  operating_model?: string | null
  enabled_modules?: string[] | null
  /** `false` cuando no se pudo leer `auth.users` o no hay equipo: no se afirma nada. */
  last_access_known?: boolean
  /** El acceso más reciente del equipo o del dueño. */
  last_access_at?: string | null
  last_sale_at?: string | null
  /** `null` cuando no se pudieron contar. */
  products_total?: number | null
}

// ---------------------------------------------------------------------------
// Helpers & Metadatos de Rubros y Módulos
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

function RubroBadge({ vertical, model }: { vertical?: string | null; model?: string | null }) {
  const meta = VERTICAL_META[vertical || 'general'] || VERTICAL_META.general
  return (
    <div className="space-y-0.5 min-w-0">
      <Badge variant="outline" className={cn('rounded-lg px-2 py-0.5 text-xs font-semibold shadow-2xs gap-1 max-w-full truncate', meta.badge)}>
        <span>{meta.icon}</span>
        <span className="truncate">{meta.label}</span>
      </Badge>
      {model && model !== 'retail' && (
        <p className="text-[11px] text-muted-foreground font-medium capitalize truncate pl-1">
          {model === 'wholesale' ? 'Mayorista' : model === 'repair' ? 'Taller' : model === 'service' ? 'Servicios' : model === 'mixed' ? 'Mixto' : model}
        </p>
      )}
    </div>
  )
}

function ModulesPreview({ modules }: { modules?: string[] | null }) {
  if (modules == null) return <span className="text-xs text-muted-foreground">Según el plan</span>
  if (modules.length === 0) return <span className="text-xs text-muted-foreground">Sin funciones habilitadas</span>
  const list = modules
  const visible = list.slice(0, 3)
  const remaining = list.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
      {visible.map((m) => {
        const meta = MODULE_META[m] || { label: m, short: m, color: 'bg-muted text-foreground/80 border-border' }
        return (
          <span
            key={m}
            className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold border shadow-2xs', meta.color)}
            title={meta.label || m}
          >
            {meta.short}
          </span>
        )
      })}
      {remaining > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-muted text-muted-foreground border border-border">
          +{remaining}
        </span>
      )}
    </div>
  )
}

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
  cancelled: 'border-border bg-muted/40 text-foreground/80',
  expired: 'border-border bg-muted text-foreground/80',
}

const SUB_LABELS: Record<string, string> = {
  active: 'Activo', trialing: 'En prueba', past_due: 'Vencido', unpaid: 'Impago',
  suspended: 'Suspendido', canceled: 'Cancelado', cancelled: 'Cancelado', expired: 'Expirado',
}

function SubscriptionBadge({ org }: { org: SuperAdminOrganization }) {
  const status = org.subscription_status
  const label = SUB_LABELS[status ?? ''] ?? status ?? 'Sin suscripción'
  const style = SUB_COLORS[status ?? ''] ?? 'border-border bg-muted/40 text-muted-foreground'

  const timing = getSubscriptionTiming(status, org.trial_ends_at, org.current_period_ends_at)

  return (
    <div className="space-y-1">
      <Badge variant="outline" className={cn('rounded-full text-[11px] font-bold shadow-2xs', style)}>
        {label}
      </Badge>
      {timing && (timing.urgent || status === 'trialing') && (
        <div className={cn('flex items-center gap-1 text-xs font-semibold', timing.urgent ? 'text-red-500' : 'text-cyan-600 dark:text-cyan-400')}>
          <Clock className="h-3 w-3" />
          {timing.label}
        </div>
      )}
    </div>
  )
}

function MemberBar({ org }: { org: SuperAdminOrganization }) {
  const { staff_total, staff_active, staff_invited, customers_total } = org
  if (staff_total === 0 && customers_total === 0) return <span className="text-xs text-muted-foreground font-medium">Sin equipo ni clientes</span>
  const activePercent = staff_total > 0 ? Math.round((staff_active / staff_total) * 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted-foreground/15">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${activePercent}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums text-foreground/80">
          {staff_active}<span className="text-muted-foreground font-normal">/{staff_total} activos</span>
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground font-medium">
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
  const failed = normalized === 'failed' || normalized === 'unpaid'

  return (
    <Badge variant="outline" className={cn(
      'rounded-full text-xs font-bold shadow-2xs',
      healthy && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300',
      warning && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
      failed && 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300',
      !healthy && !warning && !failed && 'border-border bg-muted/40 text-muted-foreground'
    )}>
      {PAYMENT_LABELS[normalized] ?? status ?? 'Sin registro'}
    </Badge>
  )
}


// ---------------------------------------------------------------------------
// Tarjeta de la vista en cuadrícula
// ---------------------------------------------------------------------------

/** «Hace 3 días» para una venta, con la misma escala que el último acceso. */
function describeSince(value: string | null | undefined, now: number) {
  if (!value) return null
  return describeLastAccess(value, now).label
}

/**
 * Una organización de un vistazo.
 *
 * La tarjeta mostraba plan, suscripción, rubro y dos conteos: no decía quién es
 * el dueño, si la empresa todavía entra al sistema o si vende, y para ver la
 * ficha había que adivinar que el nombre era un enlace.
 */
function OrganizationActions({ org, onEdit, showDetail = false }: { org: SuperAdminOrganization; onEdit(): void; showDetail?: boolean }) {
  return <div className="flex items-center justify-end gap-1">{showDetail && <Button asChild variant="outline" className="min-h-11 rounded-xl text-sm"><Link href={'/superadmin/organizations/' + encodeURIComponent(org.slug)}>Ver ficha<ArrowRight className="size-4"/></Link></Button>}
    <EnterSupportButton iconOnly organizationId={org.id} organizationName={org.name}/>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-11 rounded-xl" aria-label={'Más acciones de ' + org.name}><MoreHorizontal className="size-5"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60 rounded-xl p-1"><DropdownMenuItem onSelect={onEdit} className="min-h-11 gap-2"><Wrench className="size-4"/>Editar organización</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem asChild className="min-h-11 gap-2"><a href={'/' + org.slug + '/inicio'} target="_blank" rel="noreferrer"><Globe className="size-4"/>Abrir tienda pública</a></DropdownMenuItem><DropdownMenuItem asChild className="min-h-11 gap-2"><Link href={'/superadmin/users?organization=' + org.id}><Users className="size-4"/>Gestionar equipo</Link></DropdownMenuItem><DropdownMenuItem asChild className="min-h-11 gap-2"><Link href={'/superadmin/subscriptions?q=' + encodeURIComponent(org.slug)}><CreditCard className="size-4"/>Suscripción y pagos</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </div>
}

function OrganizationGridCard({
  org,
  referenceTime,
  onEdit,
  onCopyUrl,
  planNames,
}: {
  org: SuperAdminOrganization
  referenceTime: string
  onEdit: () => void
  onCopyUrl: (slug: string) => void
  planNames?: PlanNames
}) {
  const now = new Date(referenceTime).getTime()
  const detailHref = `/superadmin/organizations/${encodeURIComponent(org.slug)}`
  const access = org.last_access_known ? describeLastAccess(org.last_access_at, now) : null
  const lastSale = describeSince(org.last_sale_at, now)
  const timing = getSubscriptionTiming(org.subscription_status, org.trial_ends_at, org.current_period_ends_at)
  const billingProblem = ['past_due', 'unpaid', 'suspended'].includes(org.subscription_status ?? '')
  // El vencimiento cercano ya lo dice la insignia de suscripción: acá solo pinta el borde.
  const paymentTrouble = billingProblem || Boolean(timing?.urgent)
  const inactive = Boolean(access?.stale)

  // Lo que pide atención primero: cobro y abandono son los dos motivos para llamar.
  const alerts = [
    billingProblem && { tone: 'danger' as const, label: 'Problema de cobro' },
    inactive && { tone: 'warn' as const, label: org.last_access_at ? `Sin entrar: ${access?.label.toLowerCase()}` : 'Nadie del equipo entró' },
    !org.subscription_status && { tone: 'muted' as const, label: 'Sin suscripción' },
  ].filter(Boolean) as Array<{ tone: 'danger' | 'warn' | 'muted'; label: string }>

  return (
    <Card
      data-testid={`org-card-${org.slug}`}
      className={cn(
        'group flex flex-col overflow-hidden border-t-4 transition-shadow hover:shadow-md',
        paymentTrouble ? 'border-t-red-500' : inactive ? 'border-t-amber-500' : 'border-t-emerald-500/70',
      )}
    >
      {/* Identidad */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {org.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-border bg-background object-contain p-1" />
        ) : (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold', PLAN_AVATAR_BG[org.plan] ?? PLAN_AVATAR_BG.FREE)}>
            {getInitials(org.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Link href={detailHref} className="block truncate text-sm font-bold text-foreground hover:underline">
            {org.name}
          </Link>
          <button
            type="button"
            onClick={() => onCopyUrl(org.slug)}
            className="flex max-w-full items-center gap-1 text-xs leading-5 text-muted-foreground hover:text-foreground"
            title="Copiar dirección de la tienda"
          >
            /{org.slug}
            <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </div>
        <Badge variant="outline" className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
          {planLabel(org.plan, planNames)}
        </Badge>
      </div>

      {/* Estado comercial */}
      <div className="flex flex-wrap items-center gap-1.5 px-4">
        <SubscriptionBadge org={org} />
        {org.subscription_status && <PaymentBadge status={org.payment_status} />}
        {org.cancel_at_period_end && (
          <Badge variant="outline" className="rounded-full border-amber-200 text-xs font-bold text-amber-700 dark:border-amber-900 dark:text-amber-300">
            Cancela al vencer
          </Badge>
        )}
      </div>

      {alerts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 px-4" aria-label="Requiere atención">
          {alerts.map((alert) => (
            <li
              key={alert.label}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                alert.tone === 'danger' && 'bg-red-500/10 text-red-700 dark:text-red-300',
                alert.tone === 'warn' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                alert.tone === 'muted' && 'bg-muted text-muted-foreground',
              )}
            >
              {alert.label}
            </li>
          ))}
        </ul>
      )}

      {/* Detalle */}
      <dl className="mt-3 grid flex-1 grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-4 py-3 text-xs">
        <div className="col-span-2 min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <User className="h-3 w-3" /> Dueño
          </dt>
          <dd className="mt-0.5 truncate font-medium text-foreground">
            {org.owner_name || org.owner_email || <span className="text-muted-foreground">Sin asignar</span>}
            {org.owner_name && org.owner_email && <span className="font-normal text-muted-foreground"> · {org.owner_email}</span>}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" /> Último acceso
          </dt>
          <dd className={cn('mt-0.5 font-medium', access?.stale ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
            {access ? access.label : <span className="text-muted-foreground">Sin dato</span>}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Receipt className="h-3 w-3" /> Última venta
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {lastSale ?? <span className="text-muted-foreground">Sin ventas</span>}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3 w-3" /> Equipo
          </dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">
            {org.staff_active}/{org.staff_total}
            <span className="font-normal text-muted-foreground">
              {' '}· {org.customers_total} {org.customers_total === 1 ? 'cliente web' : 'clientes web'}
            </span>
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Package className="h-3 w-3" /> Productos
          </dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">
            {org.products_total == null ? <span className="text-muted-foreground">Sin dato</span> : org.products_total.toLocaleString('es-PY')}
          </dd>
        </div>

        <div className="col-span-2 flex min-w-0 items-center justify-between gap-2">
          <RubroBadge vertical={org.business_vertical} model={org.operating_model} />
          <span className="shrink-0 text-[11px] text-muted-foreground">Alta {formatDate(org.created_at)}</span>
        </div>

        <div className="col-span-2">
          <ModulesPreview modules={org.enabled_modules} />
        </div>
      </dl>

      {/* Acciones */}
      <div className="flex items-center gap-1 border-t border-border bg-muted/40 p-2.5">
        <Button asChild size="sm" className="min-h-11 gap-2 rounded-xl text-sm font-semibold">
          <Link href={detailHref}>
            Ver detalle
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <div className="ml-auto"><OrganizationActions org={org} onEdit={onEdit}/></div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Organization Focus Panel (Command Center)
// ---------------------------------------------------------------------------

function StatCard({
  label, value, sub, icon: Icon, tone = 'default',
}: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'info'
}) {
  const iconTones = {
    default: 'text-muted-foreground bg-muted',
    success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300',
    warning: 'text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300',
    info:    'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/50 dark:text-cyan-300',
  }

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl [&>div:first-child]:hidden sm:[&>div:first-child]:flex border border-border bg-card p-4 shadow-sm">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconTones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col min-w-0">
        <p className="text-xs font-medium leading-5 text-muted-foreground">{label}</p>
        <div className="flex flex-col gap-1">
          <span className="text-xl font-bold text-foreground">{value}</span>
          <span className="text-xs leading-5 text-muted-foreground">{sub}</span>
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
type ViewMode = 'table' | 'grid'

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
  const [refreshing, startRefresh] = useTransition()
  const [editingOrg, setEditingOrg] = useState<EditableOrganization | null>(null)
  const { state, setValue } = useUrlListState({
    q: '',
    plan: 'ALL',
    status: 'all',
    sort: 'created',
    dir: 'desc',
    page: '1',
    size: '25',
    view: 'table',
  })
  const viewMode: ViewMode = state.view === 'grid' ? 'grid' : 'table'
  const setViewMode = (value: ViewMode) => setValue('view', value)
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
    totalStaff: organizations.reduce((sum, o) => sum + o.staff_total, 0),
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
    const q = normalizeOrganizationSearch(query)
    let rows = organizations.filter((o) => {
      const matchQuery = !q || [o.name, o.slug, o.owner_email, o.owner_name, o.id].some((v) => v && normalizeOrganizationSearch(v).includes(q))
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
    toast.success('Archivo CSV exportado con éxito')
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

  const renderCard = (org: SuperAdminOrganization) => (<OrganizationGridCard
                    key={org.id}
                    org={org}
                    referenceTime={referenceTime}
                    planNames={planNames}
                    onCopyUrl={(slug) => void copyUrl(slug)}
                    onEdit={() => setEditingOrg({
                      id: org.id,
                      name: org.name,
                      slug: org.slug,
                      plan: org.plan,
                      subscription_status: org.subscription_status,
                      business_vertical: org.business_vertical,
                      operating_model: org.operating_model,
                      enabled_modules: org.enabled_modules,
                      cancel_at_period_end: org.cancel_at_period_end,
                    })}
                  />)

  const thClass = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground'
  const thBtn = 'flex cursor-pointer select-none items-center whitespace-nowrap hover:text-foreground transition-colors'

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <OrganizationPageHeader title="Organizaciones" description="Encontrá cada empresa, revisá su estado y accedé a su configuración desde un solo lugar." actions={<>
        <Button variant="outline" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())} className="gap-2 rounded-xl"><RefreshCw className={cn('size-4', refreshing && 'animate-spin')}/>{refreshing ? 'Actualizando…' : 'Actualizar'}</Button>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length} className="gap-2 rounded-xl"><Download className="size-4"/>Exportar resultados</Button>
        <Button asChild className="gap-2 rounded-xl"><Link href="/superadmin/organizations/create"><Building2 className="size-4"/>Nueva organización</Link></Button>
      </>}/>

      
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5 [&>div:last-child]:col-span-2 xl:[&>div:last-child]:col-span-1">
          <StatCard label="Total Empresas" value={organizations.length} sub={`${filtered.length} coincidentes`} icon={Building2} />
          <StatCard label="Planes comerciales" value={stats.paid} sub="El pago se consulta por separado" icon={Sparkles} tone="info" />
          <StatCard label="Suscripciones activas" value={stats.activeSubscriptions} sub="Estado de suscripción" icon={CheckCircle2} tone="success" />
          <StatCard label="En Período de Prueba" value={stats.trialing} sub="Con suscripción de prueba" icon={Clock} tone={stats.trialing > 0 ? 'warning' : 'default'} />
          <StatCard label="Nuevas (30 días)" value={stats.newThisMonth} sub="recientemente creadas" icon={CalendarDays} tone={stats.newThisMonth > 0 ? 'info' : 'default'} />
        </div>

      {/* Main Table / Grid Card */}
      <Card className="rounded-3xl border border-border bg-card/95 shadow-sm overflow-hidden">
        <CardHeader className="space-y-5 border-b border-border bg-card px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-lg font-semibold">Directorio de empresas</CardTitle><CardDescription className="mt-1 text-sm">{filtered.length} de {organizations.length} organizaciones · Pago y suscripción son estados distintos.</CardDescription></div><div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1" role="group" aria-label="Vista del directorio"><button type="button" onClick={() => setViewMode('table')} aria-label="Vista de Tabla" aria-pressed={viewMode === 'table'} className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm', viewMode === 'table' && 'bg-card shadow-sm')}><List className="size-4"/>Tabla</button><button type="button" onClick={() => setViewMode('grid')} aria-label="Vista de Cuadrícula" aria-pressed={viewMode === 'grid'} className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm', viewMode === 'grid' && 'bg-card shadow-sm')}><LayoutGrid className="size-4"/>Tarjetas</button></div></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr]">
            <label className="space-y-2 text-sm font-medium">Buscar empresa<div className="relative"><Search aria-hidden className="absolute left-3 top-3.5 size-4 text-muted-foreground"/><Input className="h-11 rounded-xl pl-10 text-sm" placeholder="Buscar empresa, slug, owner..." value={query} onChange={event => setQuery(event.target.value)}/></div></label>
            <label className="space-y-2 text-sm font-medium">Plan<select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={planFilter} onChange={event => setPlanFilter(event.target.value)}><option value="ALL">Todos los planes</option>{planOptions.map(plan => <option key={plan} value={plan}>{planLabel(plan, planNames)}</option>)}</select></label>
            <label className="space-y-2 text-sm font-medium">Suscripción<select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={statusFilter} onChange={event => setStatusFilter(event.target.value as FilterStatus)}>{filterPills.map(filter => <option key={filter.key} value={filter.key}>{filter.label} ({filter.key === 'all' ? organizations.length : filter.key === 'no_sub' ? countOrganizationsWithoutSubscription(organizations) : statusCounts[filter.key] ?? 0})</option>)}</select></label>
            <label className="space-y-2 text-sm font-medium">Ordenar<select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={sortKey + ':' + sortDir} onChange={event => { const [key, dir] = event.target.value.split(':'); setValue('sort', key); setValue('dir', dir); setValue('page', '1') }}><option value="created:desc">Más recientes</option><option value="created:asc">Más antiguas</option><option value="name:asc">Nombre: A a Z</option><option value="name:desc">Nombre: Z a A</option><option value="members:desc">Mayor equipo</option><option value="plan:asc">Plan: A a Z</option><option value="plan:desc">Plan: Z a A</option><option value="status:asc">Estado: A a Z</option><option value="status:desc">Estado: Z a A</option><option value="members:asc">Menor equipo</option></select></label>
          </div>
          {(query || planFilter !== 'ALL' || statusFilter !== 'all') && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><p role="status" className="text-sm text-muted-foreground">{filtered.length} resultados con los filtros actuales</p><Button variant="ghost" className="min-h-11 text-primary" onClick={() => { setQuery(''); setPlanFilter('ALL'); setStatusFilter('all') }}>Limpiar filtros</Button></div>}
        </CardHeader>

        <CardContent className="p-0">
          {/* Table View */}
          {viewMode === 'table' ? (
            <div className="min-w-0">
              <div className="hidden xl:block">
                <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/15 px-6 py-3 text-xs text-muted-foreground"><span>Mostrando {pagination.items.length} empresas en esta página</span><span className="flex items-center gap-2"><ArrowRight aria-hidden className="size-3.5"/>Deslizá para ver todas las columnas</span></div>
                <div tabIndex={0} role="region" aria-label="Tabla de organizaciones, desplazamiento horizontal y vertical" className="max-h-[min(72vh,800px)] overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-primary">
                  <table className="w-full min-w-[1320px] table-fixed border-separate border-spacing-0 text-sm">
                    <caption className="sr-only">Directorio de organizaciones</caption>
                    <colgroup><col className="w-[270px]"/><col className="w-[190px]"/><col className="w-[190px]"/><col className="w-[200px]"/><col className="w-[160px]"/><col className="w-[130px]"/><col className="w-[180px]"/></colgroup>
                    <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
                      <tr>
                        {([{key:'name',label:'Empresa'},{key:'plan',label:'Plan y funciones'},{key:'status',label:'Suscripción y pago'}] as const).map((column,index) => <th key={column.key} scope="col" aria-sort={sortKey === column.key ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'} className={cn(thClass,'border-b border-border bg-muted',index === 0 && 'sticky left-0 z-30 border-r border-border/70')}><button type="button" className={thBtn + ' min-h-11 text-xs font-semibold normal-case tracking-normal'} onClick={() => toggleSort(column.key)}>{column.label}<SortIndicator active={sortKey===column.key} direction={sortDir}/></button></th>)}
                        <th scope="col" className={cn(thClass,'border-b border-border text-xs font-semibold normal-case tracking-normal')}>Propietario</th>
                        <th scope="col" aria-sort={sortKey==='members' ? sortDir==='asc'?'ascending':'descending':'none'} className={cn(thClass,'border-b border-border')}><button type="button" className={thBtn + ' min-h-11 text-xs font-semibold normal-case tracking-normal'} onClick={() => toggleSort('members')}>Equipo<SortIndicator active={sortKey==='members'} direction={sortDir}/></button></th>
                        <th scope="col" aria-sort={sortKey==='created' ? sortDir==='asc'?'ascending':'descending':'none'} className={cn(thClass,'border-b border-border')}><button type="button" className={thBtn + ' min-h-11 text-xs font-semibold normal-case tracking-normal'} onClick={() => toggleSort('created')}>Fecha de alta<SortIndicator active={sortKey==='created'} direction={sortDir}/></button></th>
                        <th scope="col" className={cn(thClass,'sticky right-0 z-30 border-b border-l border-border bg-muted pr-5 text-right text-xs font-semibold normal-case tracking-normal')}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!pagination.items.length ? <tr><td colSpan={7} className="py-20 text-center"><Minus aria-hidden className="mx-auto size-8 text-muted-foreground/60"/><p className="mt-3 text-sm text-muted-foreground">No se encontraron organizaciones con estos filtros</p></td></tr> : pagination.items.map(org => <tr key={org.id} className="group bg-card transition-colors even:bg-muted/10 hover:bg-primary/[.035]">
                        <td className="sticky left-0 z-10 border-b border-r border-border/60 bg-card px-5 py-5 align-top group-hover:bg-muted/80">
                          <div className="flex items-start gap-3"><span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',PLAN_AVATAR_BG[org.plan]??PLAN_AVATAR_BG.FREE)}>{getInitials(org.name)}</span><div className="min-w-0 flex-1"><Link href={'/superadmin/organizations/'+encodeURIComponent(org.slug)} title={org.name} className="block break-words text-sm font-semibold leading-5 text-foreground hover:text-primary">{org.name}</Link><div className="mt-1 flex min-w-0 items-center gap-1"><span title={'/'+org.slug} className="truncate text-xs text-muted-foreground">/{org.slug}</span><button type="button" aria-label={'Copiar URL de '+org.name} onClick={() => void copyUrl(org.slug)} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Copy aria-hidden className="size-3.5"/></button></div></div></div>
                          <div className="mt-3"><RubroBadge vertical={org.business_vertical} model={org.operating_model}/></div>
                        </td>
                        <td className="border-b border-border/60 px-4 py-5 align-top"><Badge variant="outline" className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold',PLAN_COLORS[org.plan]??PLAN_COLORS.FREE)}>{planLabel(org.plan,planNames)}</Badge><div className="mt-3"><ModulesPreview modules={org.enabled_modules}/></div></td>
                        <td className="space-y-3 border-b border-border/60 px-4 py-5 align-top"><SubscriptionBadge org={org}/><div><span className="mb-1 block text-[11px] text-muted-foreground">Pago</span><PaymentBadge status={org.payment_status}/></div></td>
                        <td className="border-b border-border/60 px-4 py-5 align-top"><p className="break-words font-medium leading-5 text-foreground">{org.owner_name || 'Sin nombre registrado'}</p>{org.owner_email ? <a title={org.owner_email} href={'mailto:'+org.owner_email} className="mt-2 block break-all text-xs leading-5 text-muted-foreground hover:text-primary">{org.owner_email}</a> : <p className="mt-2 text-xs text-muted-foreground">Sin correo registrado</p>}</td>
                        <td className="border-b border-border/60 px-4 py-5 align-top"><MemberBar org={org}/></td>
                        <td className="border-b border-border/60 px-4 py-5 align-top"><time dateTime={org.created_at??undefined} className="whitespace-nowrap text-xs font-medium text-muted-foreground">{formatDate(org.created_at)}</time></td>
                        <td className="sticky right-0 z-10 border-b border-l border-border/60 bg-card px-3 py-5 align-top group-hover:bg-muted/80"><OrganizationActions showDetail org={org} onEdit={() => setEditingOrg({id:org.id,name:org.name,slug:org.slug,plan:org.plan,subscription_status:org.subscription_status,business_vertical:org.business_vertical,operating_model:org.operating_model,enabled_modules:org.enabled_modules,cancel_at_period_end:org.cancel_at_period_end})}/></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:hidden">{pagination.items.length ? pagination.items.map(renderCard) : <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No se encontraron organizaciones con estos filtros</p>}</div>
            </div>
          ) : (
            /* Grid Cards View */
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.length === 0 ? (
                <div className="col-span-full py-16 text-center">
                  <Minus className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-3 text-xs font-bold text-muted-foreground">No se encontraron organizaciones con estos filtros</p>
                </div>
              ) : (
                pagination.items.map(renderCard)
              )}
            </div>
          )}

          {/* Pagination */}
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

      {/* Edit Organization Modal */}
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
