'use client'

import { useMemo, useState } from 'react'
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
  ExternalLink,
  Globe,
  Layers,
  LayoutGrid,
  List,
  Minus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  Wrench,
  X,
  Zap,
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
import { MonitoringRobotMascot, type RobotMood } from '../MonitoringRobotMascot'

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
  FREE: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
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
  if (staff_total === 0 && customers_total === 0) return <span className="text-xs text-slate-400 font-medium">Sin miembros</span>
  const activePercent = staff_total > 0 ? Math.round((staff_active / staff_total) * 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${activePercent}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300">
          {staff_active}<span className="text-slate-400 font-normal">/{staff_total} personal</span>
        </span>
      </div>
      <p className="text-[11px] text-slate-400 font-medium">
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
// Organization Focus Panel (Command Center)
// ---------------------------------------------------------------------------

function OrganizationFocusPanel({
  organization,
  onCopyUrl,
  onClearFilter,
}: {
  organization: SuperAdminOrganization
  onCopyUrl: (slug: string) => Promise<void>
  onClearFilter: () => void
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
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50/80 via-white to-blue-50/80 p-3.5 dark:border-cyan-800/60 dark:from-cyan-950/40 dark:via-slate-900 dark:to-blue-950/40 shadow-xs">
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
      <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-md dark:border-slate-800 dark:bg-slate-900/95">

        {/* Header Hero */}
        <div className="flex flex-col gap-5 border-b border-slate-100 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-950/40 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className={cn(
              'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-md ring-2 ring-white dark:ring-slate-800',
              PLAN_AVATAR_BG[organization.plan] ?? PLAN_AVATAR_BG.FREE
            )}>
              {getInitials(organization.name)}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
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
                  className="inline-flex items-center gap-1 font-mono font-bold text-slate-600 dark:text-slate-300 hover:text-cyan-600 transition-colors cursor-pointer"
                  title="Copiar URL pública"
                >
                  <span>/{organization.slug}/inicio</span>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  type="button"
                  onClick={copyId}
                  className="inline-flex items-center gap-1 font-mono text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Copiar UUID de organización"
                >
                  <span className="truncate max-w-[120px] sm:max-w-[200px]">ID: {organization.id}</span>
                  <Copy className="h-3 w-3 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <EnterSupportButton organizationId={organization.id} organizationName={organization.name} />
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer">
              <a href={`/${organization.slug}/inicio`} target="_blank" rel="noreferrer">
                <Globe className="h-3.5 w-3.5 text-cyan-600" />
                Abrir tienda
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer">
              <Link href={`/superadmin/users?organization=${organization.id}`}>
                <Users className="h-3.5 w-3.5 text-violet-600" />
                Gestionar Usuarios
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 cursor-pointer">
              <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(organization.slug)}`}>
                <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                Ver Suscripción
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
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Owner de la Empresa</p>
            <p className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100">{organization.owner_name || 'Sin nombre registrado'}</p>
            <p className="truncate text-xs text-slate-500 font-medium">{organization.owner_email || 'Sin email registrado'}</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Equipo & Personal</p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {organization.staff_active} de {organization.staff_total} activos
            </p>
            <p className="text-xs text-slate-500 font-medium">{organization.staff_invited} invitados · {organization.staff_suspended} suspendidos</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Clientes Registrados</p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{organization.customers_total} usuarios finales</p>
            <p className="text-xs text-slate-500 font-medium">Cuentas de portal público</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Ciclo de Facturación</p>
            <p className={cn('text-sm font-extrabold', timing?.urgent ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100')}>
              {timing?.label ?? 'Sin fecha de renovación'}
            </p>
            <p className="text-xs text-slate-500 font-medium">Hasta {formatDate(organization.current_period_ends_at || organization.trial_ends_at)}</p>
          </div>
        </div>

        {/* Tabbed Detail Section */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-800/80 w-fit">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
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
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
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
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              )}
            >
              <CreditCard className="h-3.5 w-3.5 text-amber-500" />
              Suscripción & Accesos
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Fecha de Creación</span>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatDate(organization.created_at)}</p>
                <p className="text-xs text-slate-500">Registrado en la base de datos</p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Última Actualización</span>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatDate(organization.updated_at)}</p>
                <p className="text-xs text-slate-500">Último cambio de configuración</p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Proveedor de Cobros</span>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{organization.subscription_provider || 'Manual / Transferencia'}</p>
                <p className="text-xs text-slate-500">Pasarela asignada</p>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Desglose de Personal</h4>
                  <p className="text-xs text-slate-500">Usuarios con permisos de administración o ventas.</p>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs font-bold rounded-lg">
                  <Link href={`/superadmin/users?organization=${organization.id}`}>
                    Ver lista en módulo Usuarios
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 pt-2">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-xs font-semibold text-slate-400">Activos</span>
                  <p className="text-xl font-black text-emerald-600">{organization.staff_active}</p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-xs font-semibold text-slate-400">Invitados pendientes</span>
                  <p className="text-xl font-black text-amber-600">{organization.staff_invited}</p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-xs font-semibold text-slate-400">Suspendidos</span>
                  <p className="text-xl font-black text-red-600">{organization.staff_suspended}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Acciones de Facturación Directas</h4>
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
  const tones = {
    default: 'bg-white/90 dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800',
    success: 'border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    warning: 'border-amber-200/80 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20',
    info:    'border-cyan-200/80 bg-cyan-50/60 dark:border-cyan-900/50 dark:bg-cyan-950/20',
  }
  const iconTones = {
    default: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
    success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300',
    warning: 'text-amber-600 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
    info:    'text-cyan-600 bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300',
  }

  return (
    <Card className={cn('rounded-3xl border shadow-xs transition-all duration-200 hover:shadow-md backdrop-blur-md', tones[tone])}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{sub}</p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-2xs', iconTones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
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

  const thClass = 'px-4 py-3.5 text-left text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400'
  const thBtn = 'flex cursor-pointer select-none items-center whitespace-nowrap hover:text-slate-900 dark:hover:text-slate-100 transition-colors'

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
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            <Building2 className="h-3.5 w-3.5 text-cyan-500" />
            Superadmin · Gestión Multiempresa SaaS
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            Directorio de Organizaciones
          </h1>
          <p className="max-w-2xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Control operativo de empresas, planes, owners y suscripciones del ecosistema multiempresa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer" onClick={exportCsv} disabled={filtered.length === 0}>
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

      {/* 🤖 ROBOT MASCOT GUARDIAN */}
      <MonitoringRobotMascot
        mood={robotMood}
        statusText={robotMessage}
        headline={focusedOrganization ? `Empresa Seleccionada: ${focusedOrganization.name}` : 'Supervisor de Empresas Activo'}
        metrics={{
          healthScore: stats.total > 0 ? Math.round((stats.activeSubscriptions / stats.total) * 100) : 100,
          activeAlerts: organizations.filter(o => o.subscription_status === 'past_due' || o.subscription_status === 'unpaid').length,
        }}
        onQuickAction={() => router.refresh()}
        actionLabel="Sincronizar Lista"
      />

      {/* Focused Organization Command Center */}
      {focusedOrganization && (
        <OrganizationFocusPanel
          organization={focusedOrganization}
          onCopyUrl={copyUrl}
          onClearFilter={() => setQuery('')}
        />
      )}

      {/* KPI Cards when not focused or when viewing all */}
      {!focusedOrganization && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Empresas" value={organizations.length} sub={`${filtered.length} coincidentes`} icon={Building2} />
          <StatCard label="Planes Pagos" value={stats.paid} sub="BASIC, PRO o ENTERPRISE" icon={Sparkles} tone="info" />
          <StatCard label="Suscripciones Activas" value={stats.activeSubscriptions} sub="al día con cobros" icon={CheckCircle2} tone="success" />
          <StatCard label="En Período de Prueba" value={stats.trialing} sub="trials activos" icon={Clock} tone={stats.trialing > 0 ? 'warning' : 'default'} />
          <StatCard label="Nuevas (30 días)" value={stats.newThisMonth} sub="recientemente creadas" icon={CalendarDays} tone={stats.newThisMonth > 0 ? 'info' : 'default'} />
        </div>
      )}

      {/* Main Table / Grid Card */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
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
              <div className="flex items-center gap-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer',
                    viewMode === 'table' ? 'bg-white shadow-2xs text-slate-900 dark:bg-slate-900 dark:text-slate-50' : ''
                  )}
                  title="Vista de Tabla"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer',
                    viewMode === 'grid' ? 'bg-white shadow-2xs text-slate-900 dark:bg-slate-900 dark:text-slate-50' : ''
                  )}
                  title="Vista de Cuadrícula"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-8 pl-8 text-xs rounded-xl"
                  placeholder="Buscar empresa, slug, owner..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {/* Plan filter */}
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setPlanFilter('ALL')}
                  className={cn(
                    'h-6 rounded-lg px-2.5 text-xs font-bold transition-all cursor-pointer',
                    planFilter === 'ALL' ? 'bg-slate-900 text-white shadow-2xs dark:bg-slate-800' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
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
                      planFilter === p ? 'bg-slate-900 text-white shadow-2xs dark:bg-slate-800' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
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
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50 border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  )}
                >
                  <span>{f.label}</span>
                  <span className={cn(
                    'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold',
                    statusFilter === f.key ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
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
                <thead className="border-b border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40">
                  <tr>
                    <th className={cn(thClass, 'pl-6')}>
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
                    <th className={cn(thClass, 'pr-6 text-right')}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-20 text-center">
                        <Minus className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-3 text-xs font-bold text-slate-500">No se encontraron organizaciones con estos filtros</p>
                      </td>
                    </tr>
                  ) : (
                    pagination.items.map((org) => (
                      <tr
                        key={org.id}
                        className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        {/* Empresa */}
                        <td className="py-3.5 pl-6 pr-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-2xs',
                              PLAN_AVATAR_BG[org.plan] ?? PLAN_AVATAR_BG.FREE
                            )}>
                              {getInitials(org.name)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/superadmin/organizations?q=${encodeURIComponent(org.slug)}`}
                                className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100 hover:text-cyan-600 transition-colors block"
                              >
                                {org.name}
                              </Link>
                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <span>/{org.slug}</span>
                                <button
                                  type="button"
                                  onClick={() => void copyUrl(org.slug)}
                                  className="hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
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
                        <td className="px-4 py-3.5">
                          <Badge variant="outline" className={cn('rounded-full text-[11px] font-bold', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
                            {org.plan}
                          </Badge>
                        </td>

                        {/* Suscripción */}
                        <td className="px-4 py-3.5">
                          <SubscriptionBadge org={org} />
                        </td>

                        {/* Owner */}
                        <td className="px-4 py-3.5">
                          <div className="max-w-[200px]">
                            <p className="truncate text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {org.owner_name || (org.owner_email?.split('@')[0]) || '—'}
                            </p>
                            {org.owner_email && (
                              <p className="truncate text-[11px] text-slate-400">{org.owner_email}</p>
                            )}
                          </div>
                        </td>

                        {/* Miembros */}
                        <td className="px-4 py-3.5">
                          <MemberBar org={org} />
                        </td>

                        {/* Creada */}
                        <td className="px-4 py-3.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(org.created_at)}
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 pl-3 pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <EnterSupportButton iconOnly organizationId={org.id} organizationName={org.name} />
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer" title="Abrir tienda pública">
                              <a href={`/${org.slug}/inicio`} target="_blank" rel="noreferrer" aria-label={`Abrir tienda de ${org.name}`}>
                                <Globe className="h-3.5 w-3.5 text-slate-500" />
                              </a>
                            </Button>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer" title="Gestionar usuarios">
                              <Link href={`/superadmin/users?organization=${org.id}`} aria-label={`Ver usuarios de ${org.name}`}>
                                <Users className="h-3.5 w-3.5 text-slate-500" />
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer" title="Suscripción y pagos">
                              <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(org.slug)}`} aria-label={`Ver suscripción de ${org.name}`}>
                                <CreditCard className="h-3.5 w-3.5 text-slate-500" />
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
                  <Minus className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-xs font-bold text-slate-500">No se encontraron organizaciones con estos filtros</p>
                </div>
              ) : (
                pagination.items.map((org) => (
                  <Card key={org.id} className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/90 p-5 shadow-2xs hover:shadow-md transition-all space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black shadow-2xs',
                          PLAN_AVATAR_BG[org.plan] ?? PLAN_AVATAR_BG.FREE
                        )}>
                          {getInitials(org.name)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/superadmin/organizations?q=${encodeURIComponent(org.slug)}`}
                            className="truncate text-sm font-extrabold text-slate-900 dark:text-slate-100 hover:text-cyan-600 transition-colors block"
                          >
                            {org.name}
                          </Link>
                          <p className="truncate text-xs text-slate-400 font-mono">/{org.slug}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('rounded-full text-[10px] font-bold px-2 py-0.5', PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
                        {org.plan}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 text-xs border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suscripción</span>
                        <SubscriptionBadge org={org} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Personal</span>
                        <MemberBar org={org} />
                      </div>
                    </div>

                    {org.owner_email && (
                      <div className="text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Owner</span>
                        <p className="truncate font-semibold text-slate-700 dark:text-slate-300">{org.owner_email}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <EnterSupportButton organizationId={org.id} organizationName={org.name} />
                      <Button asChild variant="outline" size="sm" className="h-8 text-xs font-bold rounded-xl flex-1">
                        <Link href={`/superadmin/organizations?q=${encodeURIComponent(org.slug)}`}>
                          Ver Ficha
                        </Link>
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            className="border-t border-slate-100 dark:border-slate-800 px-6 py-4"
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

    </div>
  )
}
