'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Globe, LayoutGrid,
  List,
  Minus,
  Package,
  Receipt,
  RefreshCw,
  Search,
  Shield, Sparkles,
  User,
  Users,
  Wrench,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EnterSupportButton } from '@/components/superadmin/EnterSupportButton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { paginateList, SUPERADMIN_PAGE_SIZES } from '@/lib/superadmin/list-pagination'
import { cn } from '@/lib/utils'
import { SortIndicator } from '@/components/superadmin/sort-indicator'
import { countOrganizationsWithoutSubscription, getSubscriptionTiming } from '@/lib/superadmin/organization-directory'
import { describeLastAccess } from '@/lib/superadmin/last-access'
import { type RobotMood } from '../MonitoringRobotMascot'
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
      <Badge variant="outline" className={cn('rounded-lg px-2 py-0.5 text-[10px] font-extrabold shadow-2xs gap-1 max-w-full truncate', meta.badge)}>
        <span>{meta.icon}</span>
        <span className="truncate">{meta.label}</span>
      </Badge>
      {model && model !== 'retail' && (
        <p className="text-[9px] text-muted-foreground font-medium capitalize truncate pl-1">
          {model === 'wholesale' ? 'Mayorista' : model === 'repair' ? 'Taller' : model === 'service' ? 'Servicios' : model}
        </p>
      )}
    </div>
  )
}

function ModulesPreview({ modules }: { modules?: string[] | null }) {
  const list = modules && modules.length > 0 ? modules : ['pos', 'inventory', 'crm', 'ecommerce']
  const visible = list.slice(0, 3)
  const remaining = list.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
      {visible.map((m) => {
        const meta = MODULE_META[m] || { label: m, short: m, color: 'bg-muted text-foreground/80 border-border' }
        return (
          <span
            key={m}
            className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold border shadow-2xs', meta.color)}
            title={meta.label || m}
          >
            {meta.short}
          </span>
        )
      })}
      {remaining > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-muted text-muted-foreground border border-border">
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
        <div className={cn('flex items-center gap-1 text-[10px] font-semibold', timing.urgent ? 'text-red-500' : 'text-cyan-600 dark:text-cyan-400')}>
          <Clock className="h-3 w-3" />
          {timing.label}
        </div>
      )}
    </div>
  )
}

function MemberBar({ org }: { org: SuperAdminOrganization }) {
  const { staff_total, staff_active, staff_invited, customers_total } = org
  if (staff_total === 0 && customers_total === 0) return <span className="text-xs text-muted-foreground font-medium">Sin miembros</span>
  const activePercent = staff_total > 0 ? Math.round((staff_active / staff_total) * 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted-foreground/15">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${activePercent}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums text-foreground/80">
          {staff_active}<span className="text-muted-foreground font-normal">/{staff_total} personal</span>
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

  return (
    <Badge variant="outline" className={cn(
      'rounded-full text-[10px] font-bold shadow-2xs',
      healthy && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300',
      warning && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
      !healthy && !warning && 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300'
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
function OrganizationGridCard({
  org,
  referenceTime,
  onEdit,
  onCopyUrl,
}: {
  org: SuperAdminOrganization
  referenceTime: string
  onEdit: () => void
  onCopyUrl: (slug: string) => void
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
            className="flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
            title="Copiar dirección de la tienda"
          >
            /{org.slug}
            <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </div>
        <Badge variant="outline" className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
          {org.plan}
        </Badge>
      </div>

      {/* Estado comercial */}
      <div className="flex flex-wrap items-center gap-1.5 px-4">
        <SubscriptionBadge org={org} />
        {org.subscription_status && <PaymentBadge status={org.payment_status} />}
        {org.cancel_at_period_end && (
          <Badge variant="outline" className="rounded-full border-amber-200 text-[10px] font-bold text-amber-700 dark:border-amber-900 dark:text-amber-300">
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
          <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <User className="h-3 w-3" /> Dueño
          </dt>
          <dd className="mt-0.5 truncate font-medium text-foreground">
            {org.owner_name || org.owner_email || <span className="text-muted-foreground">Sin asignar</span>}
            {org.owner_name && org.owner_email && <span className="font-normal text-muted-foreground"> · {org.owner_email}</span>}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" /> Último acceso
          </dt>
          <dd className={cn('mt-0.5 font-medium', access?.stale ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
            {access ? access.label : <span className="text-muted-foreground">Sin dato</span>}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Receipt className="h-3 w-3" /> Última venta
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {lastSale ?? <span className="text-muted-foreground">Sin ventas</span>}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
          <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
        <Button asChild size="sm" className="h-8 gap-1.5 rounded-lg text-xs font-bold">
          <Link href={detailHref}>
            Ver detalle
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-0.5">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Abrir tienda">
            <a href={`/${org.slug}/inicio`} target="_blank" rel="noreferrer" aria-label={`Abrir tienda de ${org.name}`}>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </Button>
          <EnterSupportButton iconOnly organizationId={org.id} organizationName={org.name} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400"
            title="Editar organización"
            aria-label={`Editar ${org.name}`}
            onClick={onEdit}
          >
            <Wrench className="h-4 w-4" />
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Gestionar usuarios">
            <Link href={`/superadmin/users?organization=${org.id}`} aria-label={`Usuarios de ${org.name}`}>
              <Users className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Suscripción y pagos">
            <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(org.slug)}`} aria-label={`Suscripción de ${org.name}`}>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Organization Focus Panel (Command Center)
// ---------------------------------------------------------------------------

function OrganizationFocusPanel({
  organization,
  onCopyUrl,
  onClearFilter,
  onEdit,
}: {
  organization: SuperAdminOrganization
  onCopyUrl: (slug: string) => Promise<void>
  onClearFilter: () => void
  onEdit?: () => void
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'billing'>('overview')
  const timing = getSubscriptionTiming(
    organization.subscription_status,
    organization.trial_ends_at,
    organization.current_period_ends_at
  )

  const copyId = () => {
    navigator.clipboard.writeText(organization.id)
    toast.success('ID copiado al portapapeles')
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50/80 via-card to-blue-50/80 p-3.5 dark:border-cyan-800/60 dark:from-cyan-950/40 dark:to-blue-950/40 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-cyan-900 dark:text-cyan-200">
          <Sparkles className="h-4 w-4 text-cyan-600" />
          <span>Mostrando Ficha de Organización Seleccionada</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilter}
          className="h-8 gap-1.5 rounded-xl text-xs font-bold border-cyan-300 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
          Ver todas las organizaciones
        </Button>
      </div>

      {/* Main Focus Card */}
      <section className="overflow-hidden rounded-3xl border border-border bg-card/95 shadow-md">

        {/* Header Hero */}
        <div className="flex flex-col gap-5 border-b border-border bg-muted/40 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className={cn(
              'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-md ring-2 ring-background',
              PLAN_AVATAR_BG[organization.plan] ?? PLAN_AVATAR_BG.FREE
            )}>
              {getInitials(organization.name)}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {organization.name}
                </h2>
                <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 text-xs font-extrabold shadow-2xs', PLAN_COLORS[organization.plan] ?? PLAN_COLORS.FREE)}>
                  PLAN {organization.plan}
                </Badge>
                <SubscriptionBadge org={organization} />
                <PaymentBadge status={organization.payment_status} />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => void onCopyUrl(organization.slug)}
                  className="inline-flex items-center gap-1 font-mono font-bold text-foreground/80 hover:text-cyan-600 transition-colors cursor-pointer"
                  title="Copiar URL pública"
                >
                  <span>/{organization.slug}/inicio</span>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <span className="text-muted-foreground/60">·</span>
                <button
                  type="button"
                  onClick={copyId}
                  className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Copiar UUID de organización"
                >
                  <span className="truncate max-w-[120px] sm:max-w-[200px]">ID: {organization.id}</span>
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <EnterSupportButton organizationId={organization.id} organizationName={organization.name} />
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="gap-1.5 rounded-xl text-xs font-bold border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 cursor-pointer"
              >
                <Wrench className="h-3.5 w-3.5 text-violet-600" />
                Editar Organización
              </Button>
            )}
            <Button asChild size="sm" className="gap-1.5 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 shadow-md cursor-pointer">
              <Link href={`/superadmin/organizations/${encodeURIComponent(organization.slug)}`}>
                <Building2 className="h-3 w-3" />
                Expediente Completo
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-border cursor-pointer">
              <a href={`/${organization.slug}/inicio`} target="_blank" rel="noreferrer">
                <Globe className="h-3.5 w-3.5 text-cyan-600" />
                Abrir tienda
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-border cursor-pointer">
              <Link href={`/superadmin/users?organization=${organization.id}`}>
                <Users className="h-3.5 w-3.5 text-violet-600" />
                Usuarios
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 rounded-xl text-xs font-bold bg-foreground text-background cursor-pointer">
              <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(organization.slug)}`}>
                <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                Suscripción
              </Link>
            </Button>
          </div>
        </div>

        {organization.cancel_at_period_end && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
            <Clock className="h-4 w-4 shrink-0" />
            La suscripción de este tenant está programada para cancelarse al finalizar el periodo actual.
          </div>
        )}

        {/* Focus KPI Bar */}
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 border-b border-border">
          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Owner de la Empresa</p>
            <p className="truncate text-sm font-extrabold text-foreground">{organization.owner_name || 'Sin nombre registrado'}</p>
            <p className="truncate text-xs text-muted-foreground font-medium">{organization.owner_email || 'Sin email registrado'}</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Equipo & Personal</p>
            <p className="text-sm font-extrabold text-foreground">
              {organization.staff_active} de {organization.staff_total} activos
            </p>
            <p className="text-xs text-muted-foreground font-medium">{organization.staff_invited} invitados · {organization.staff_suspended} suspendidos</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Clientes Registrados</p>
            <p className="text-sm font-extrabold text-foreground">{organization.customers_total} usuarios finales</p>
            <p className="text-xs text-muted-foreground font-medium">Cuentas de portal público</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Ciclo de Facturación</p>
            <p className={cn('text-sm font-extrabold', timing?.urgent ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
              {timing?.label ?? 'Sin fecha de renovación'}
            </p>
            <p className="text-xs text-muted-foreground font-medium">Hasta {formatDate(organization.current_period_ends_at || organization.trial_ends_at)}</p>
          </div>
        </div>

        {/* Tabbed Detail Section */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-muted p-1 w-fit">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                activeTab === 'overview'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-foreground/80 hover:text-foreground'
              )}
            >
              <Building2 className="h-3.5 w-3.5 text-cyan-500" />
              Ficha & Capacidad
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                activeTab === 'members'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-foreground/80 hover:text-foreground'
              )}
            >
              <Users className="h-3.5 w-3.5 text-violet-500" />
              Miembros ({organization.members_total})
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                activeTab === 'billing'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-foreground/80 hover:text-foreground'
              )}
            >
              <CreditCard className="h-3.5 w-3.5 text-amber-500" />
              Suscripción & Accesos
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              {/* Rubro & Módulos Habilitados Card */}
              <div className="rounded-3xl border border-violet-200/90 bg-gradient-to-br from-violet-50/60 via-card to-cyan-50/40 p-5 dark:border-violet-900/60 dark:from-violet-950/30 dark:to-cyan-950/20 space-y-4 sm:col-span-2 lg:col-span-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card text-2xl shadow-sm border border-violet-200/80 dark:border-violet-900/50">
                      {VERTICAL_META[organization.business_vertical || 'general']?.icon || '🏬'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-foreground">
                          {VERTICAL_META[organization.business_vertical || 'general']?.label || 'Comercio General'}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          Modelo: {organization.operating_model === 'wholesale' ? 'Mayorista' : organization.operating_model === 'repair' ? 'Taller' : organization.operating_model === 'service' ? 'Servicios' : 'Minorista'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Configuración vertical de catálogo, flujos de venta y módulos operativos del negocio.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-extrabold px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                      {(organization.enabled_modules || ['pos', 'inventory', 'crm', 'ecommerce']).length} módulos activos
                    </Badge>
                    <Button asChild size="sm" variant="outline" className="h-8 rounded-xl text-xs font-bold gap-1 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-50">
                      <Link href={`/superadmin/organizations/${encodeURIComponent(organization.slug)}`}>
                        <Boxes className="h-3.5 w-3.5" />
                        Ver Matriz Completa
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  {(organization.enabled_modules && organization.enabled_modules.length > 0
                    ? organization.enabled_modules
                    : ['pos', 'inventory', 'crm', 'ecommerce']
                  ).map((m) => {
                    const meta = MODULE_META[m] || { label: m, short: m, color: 'bg-muted text-foreground/80 border-border' }
                    return (
                      <span
                        key={m}
                        className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border shadow-2xs', meta.color)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        {meta.label || m}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Fecha de Creación</span>
                <p className="text-sm font-bold text-foreground">{formatDate(organization.created_at)}</p>
                <p className="text-xs text-muted-foreground">Registrado en la base de datos</p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Última Actualización</span>
                <p className="text-sm font-bold text-foreground">{formatDate(organization.updated_at)}</p>
                <p className="text-xs text-muted-foreground">Último cambio de configuración</p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Proveedor de Cobros</span>
                <p className="text-sm font-bold text-foreground">{organization.subscription_provider || 'Manual / Transferencia'}</p>
                <p className="text-xs text-muted-foreground">Pasarela asignada</p>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="rounded-2xl border border-border bg-muted/40 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-foreground">Desglose de Personal</h4>
                  <p className="text-xs text-muted-foreground">Usuarios con permisos de administración o ventas.</p>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs font-bold rounded-lg">
                  <Link href={`/superadmin/users?organization=${organization.id}`}>
                    Ver lista en módulo Usuarios
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 pt-2">
                <div className="p-3 rounded-xl bg-card border border-border text-center">
                  <span className="text-xs font-semibold text-muted-foreground">Activos</span>
                  <p className="text-xl font-black text-emerald-600">{organization.staff_active}</p>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border text-center">
                  <span className="text-xs font-semibold text-muted-foreground">Invitados pendientes</span>
                  <p className="text-xl font-black text-amber-600">{organization.staff_invited}</p>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border text-center">
                  <span className="text-xs font-semibold text-muted-foreground">Suspendidos</span>
                  <p className="text-xl font-black text-red-600">{organization.staff_suspended}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="rounded-2xl border border-border bg-muted/40 p-5 space-y-3">
              <h4 className="text-sm font-extrabold text-foreground">Acciones de Facturación Directas</h4>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold gap-1.5">
                  <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(organization.slug)}`}>
                    <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                    Historial de Pagos & Facturas
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold gap-1.5">
                  <Link href="/superadmin/plans">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    Comparar y Ajustar Planes
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-xl text-xs font-bold gap-1.5">
                  <Link href="/superadmin/audit-logs">
                    <Shield className="h-3.5 w-3.5 text-cyan-500" />
                    Auditar Eventos del Tenant
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

      </section>
    </div>
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
  const iconTones = {
    default: 'text-muted-foreground bg-muted',
    success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300',
    warning: 'text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300',
    info:    'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/50 dark:text-cyan-300',
  }

  return (
    <div className="flex flex-1 items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md">
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', iconTones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-foreground">{value}</span>
          <span className="truncate text-xs text-muted-foreground">{sub}</span>
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
}: {
  organizations: SuperAdminOrganization[]
  referenceTime: string
}) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [editingOrg, setEditingOrg] = useState<EditableOrganization | null>(null)
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

  const thClass = 'px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground'
  const thBtn = 'flex cursor-pointer select-none items-center whitespace-nowrap hover:text-foreground transition-colors'

  // Robot Mascot Mood & Insight
  const robotMood: RobotMood = focusedOrganization
    ? focusedOrganization.subscription_status === 'active' ? 'healthy' : 'warning'
    : stats.activeSubscriptions >= stats.total * 0.7 ? 'healthy' : 'warning'

  const robotMessage = focusedOrganization
    ? `Empresa: ${focusedOrganization.name} (${focusedOrganization.plan}) · ${focusedOrganization.staff_active} colaboradores activos y ${focusedOrganization.customers_total} clientes.`
    : `Gestionando ${organizations.length} empresas en la plataforma. ${stats.paid} organizaciones en planes pagos y ${stats.activeSubscriptions} suscripciones activas.`

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 text-cyan-500" />
            Superadmin · Gestión Multiempresa SaaS
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Directorio de Organizaciones
          </h1>
          <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground">
            Control operativo de empresas, planes, owners y suscripciones del ecosistema multiempresa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-border cursor-pointer" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-border cursor-pointer" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
          <Button asChild size="sm" className="gap-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-700 dark:hover:bg-cyan-600 shadow-md cursor-pointer">
            <Link href="/superadmin/organizations/create">
              <Sparkles className="h-3.5 w-3.5" />
              Nueva Organización
            </Link>
          </Button>
        </div>
      </header>

      
      {/* Focused Organization Command Center */}
      {focusedOrganization && (
        <OrganizationFocusPanel
          organization={focusedOrganization}
          onCopyUrl={copyUrl}
          onClearFilter={() => setQuery('')}
          onEdit={() => setEditingOrg({
            id: focusedOrganization.id,
            name: focusedOrganization.name,
            slug: focusedOrganization.slug,
            plan: focusedOrganization.plan,
            subscription_status: focusedOrganization.subscription_status,
            business_vertical: focusedOrganization.business_vertical,
            operating_model: focusedOrganization.operating_model,
            enabled_modules: focusedOrganization.enabled_modules,
            cancel_at_period_end: focusedOrganization.cancel_at_period_end,
          })}
        />
      )}

      {/* KPI Cards when not focused or when viewing all */}
      {!focusedOrganization && (
        <div className="flex flex-wrap gap-4">
          <StatCard label="Total Empresas" value={organizations.length} sub={`${filtered.length} coincidentes`} icon={Building2} />
          <StatCard label="Planes Pagos" value={stats.paid} sub="BASIC, PRO o ENTERPRISE" icon={Sparkles} tone="info" />
          <StatCard label="Suscripciones Activas" value={stats.activeSubscriptions} sub="al día con cobros" icon={CheckCircle2} tone="success" />
          <StatCard label="En Período de Prueba" value={stats.trialing} sub="trials activos" icon={Clock} tone={stats.trialing > 0 ? 'warning' : 'default'} />
          <StatCard label="Nuevas (30 días)" value={stats.newThisMonth} sub="recientemente creadas" icon={CalendarDays} tone={stats.newThisMonth > 0 ? 'info' : 'default'} />
        </div>
      )}

      {/* Main Table / Grid Card */}
      <Card className="rounded-3xl border border-border bg-card/95 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/40 px-6 py-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-foreground">
                  Directorio de Empresas
                </CardTitle>
                <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
                  {filtered.length} de {organizations.length}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Listado central con acceso a soporte y métricas por tenant.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Switcher */}
              <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer',
                    viewMode === 'table' ? 'bg-card shadow-2xs text-foreground' : ''
                  )}
                  title="Vista de Tabla"
                  aria-label="Vista de Tabla"
                  aria-pressed={viewMode === 'table'}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer',
                    viewMode === 'grid' ? 'bg-card shadow-2xs text-foreground' : ''
                  )}
                  title="Vista de Cuadrícula"
                  aria-label="Vista de Cuadrícula"
                  aria-pressed={viewMode === 'grid'}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-xs rounded-xl"
                  placeholder="Buscar empresa, slug, owner..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {/* Plan filter */}
              <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
                <button
                  type="button"
                  onClick={() => setPlanFilter('ALL')}
                  className={cn(
                    'h-6 rounded-lg px-2.5 text-xs font-bold transition-all cursor-pointer',
                    planFilter === 'ALL' ? 'bg-foreground text-background shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Todos
                </button>
                {planOptions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlanFilter(p)}
                    className={cn(
                      'h-6 rounded-lg px-2.5 text-xs font-bold transition-all cursor-pointer',
                      planFilter === p ? 'bg-foreground text-background shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border">
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
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer',
                    statusFilter === f.key
                      ? 'bg-card text-foreground shadow-2xs border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>{f.label}</span>
                  <span className={cn(
                    'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold',
                    statusFilter === f.key ? 'bg-foreground text-background' : 'bg-muted-foreground/15 text-foreground/80'
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
                className="text-xs font-bold text-cyan-600 hover:underline cursor-pointer pl-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Table View */}
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 backdrop-blur">
                  <tr>
                    <th className={cn(thClass, 'pl-4')}>
                      <button className={thBtn} onClick={() => toggleSort('name')}>
                        Empresa <SortIndicator active={sortKey === 'name'} direction={sortDir} />
                      </button>
                    </th>
                    <th className={thClass}>Rubro Comercial</th>
                    <th className={thClass}>Módulos</th>
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
                    <th className={thClass}>Owner Principal</th>
                    <th className={thClass}>
                      <button className={thBtn} onClick={() => toggleSort('members')}>
                        Personal & Clientes <SortIndicator active={sortKey === 'members'} direction={sortDir} />
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
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-20 text-center">
                        <Minus className="mx-auto h-8 w-8 text-muted-foreground/60" />
                        <p className="mt-3 text-xs font-bold text-muted-foreground">No se encontraron organizaciones con estos filtros</p>
                      </td>
                    </tr>
                  ) : (
                    pagination.items.map((org) => (
                      <tr
                        key={org.id}
                        className="transition-colors hover:bg-muted/50"
                      >
                        {/* Empresa */}
                        <td className="py-2 pl-4 pr-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black shadow-2xs',
                              PLAN_AVATAR_BG[org.plan] ?? PLAN_AVATAR_BG.FREE
                            )}>
                              {getInitials(org.name)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/superadmin/organizations?q=${encodeURIComponent(org.slug)}`}
                                className="truncate text-xs font-extrabold text-foreground hover:text-cyan-600 transition-colors block"
                              >
                                {org.name}
                              </Link>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span>/{org.slug}</span>
                                <button
                                  type="button"
                                  onClick={() => void copyUrl(org.slug)}
                                  className="hover:text-foreground cursor-pointer"
                                  title="Copiar URL"
                                  aria-label={`Copiar URL de ${org.name}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Rubro Comercial */}
                        <td className="px-3 py-2">
                          <RubroBadge vertical={org.business_vertical} model={org.operating_model} />
                        </td>

                        {/* Módulos Habilitados */}
                        <td className="px-3 py-2">
                          <ModulesPreview modules={org.enabled_modules} />
                        </td>

                        {/* Plan */}
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn('rounded-full text-[10px] font-bold px-2 py-0', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
                            {org.plan}
                          </Badge>
                        </td>

                        {/* Suscripción */}
                        <td className="px-3 py-2">
                          <SubscriptionBadge org={org} />
                        </td>

                        {/* Owner */}
                        <td className="px-3 py-2">
                          <div className="max-w-[180px]">
                            <p className="truncate text-[11px] sm:text-xs font-semibold text-foreground/80">
                              {org.owner_name || (org.owner_email?.split('@')[0]) || '—'}
                            </p>
                            {org.owner_email && (
                              <p className="truncate text-[10px] text-muted-foreground">{org.owner_email}</p>
                            )}
                          </div>
                        </td>

                        {/* Miembros */}
                        <td className="px-3 py-2">
                          <MemberBar org={org} />
                        </td>

                        {/* Creada */}
                        <td className="px-3 py-2 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                          {formatDate(org.created_at)}
                        </td>

                        {/* Acciones */}
                        <td className="py-2 pl-3 pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <EnterSupportButton iconOnly organizationId={org.id} organizationName={org.name} />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg cursor-pointer text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400"
                              title="Editar organización"
                              aria-label={`Editar ${org.name}`}
                              onClick={() => setEditingOrg({
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
                            >
                              <Wrench className="h-3 w-3" />
                            </Button>
                            <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-lg cursor-pointer text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400" title="Ver detalle completo">
                              <Link href={`/superadmin/organizations/${encodeURIComponent(org.slug)}`} aria-label={`Ver detalle de ${org.name}`}>
                                <Building2 className="h-3 w-3" />
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-lg cursor-pointer" title="Abrir tienda pública">
                              <a href={`/${org.slug}/inicio`} target="_blank" rel="noreferrer" aria-label={`Abrir tienda de ${org.name}`}>
                                <Globe className="h-3 w-3 text-muted-foreground" />
                              </a>
                            </Button>
                            <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-lg cursor-pointer" title="Gestionar usuarios">
                              <Link href={`/superadmin/users?organization=${org.id}`} aria-label={`Ver usuarios de ${org.name}`}>
                                <Users className="h-3 w-3 text-muted-foreground" />
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-lg cursor-pointer" title="Suscripción y pagos">
                              <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(org.slug)}`} aria-label={`Ver suscripción de ${org.name}`}>
                                <CreditCard className="h-3 w-3 text-muted-foreground" />
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
          ) : (
            /* Grid Cards View */
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.length === 0 ? (
                <div className="col-span-full py-16 text-center">
                  <Minus className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-3 text-xs font-bold text-muted-foreground">No se encontraron organizaciones con estos filtros</p>
                </div>
              ) : (
                pagination.items.map((org) => (
                  <OrganizationGridCard
                    key={org.id}
                    org={org}
                    referenceTime={referenceTime}
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
                  />
                ))
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
        open={Boolean(editingOrg)}
        onClose={() => setEditingOrg(null)}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
