'use client'

import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Boxes,
  Building2,
  CheckCircle2,
  Check,
  CreditCard,
  Crown,
  Download,
  Edit2,
  Globe,
  Minus,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wrench,
  Eye,
  Activity,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  TicketPercent,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  getSubscriptionPlans,
  SubscriptionPlan,
  getSubscriptionPlanStats,
  updateSubscriptionPlan,
  type SubscriptionPlanStats,
} from '@/services/subscription-plans'
import { PlanEditSheet } from './plan-edit-sheet'
import { PlanDetailsSheet } from './plan-details-sheet'
import { PlanCreateSheet } from './plan-create-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { getCommercialFeatureValue, isCommercialFeatureLabel } from '@/lib/saas/commercial-plan-features'

// ─── Constants ───────────────────────────────────────────────────────────────

const tierIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Package,
  basic: CreditCard,
  pro: Star,
  enterprise: Crown,
}

// Tier accent bar colors for the top border of each card
const tierAccent: Record<string, string> = {
  free:       'from-slate-400 to-slate-500',
  basic:      'from-blue-400 to-blue-600',
  pro:        'from-violet-500 to-purple-700',
  enterprise: 'from-amber-400 to-orange-500',
}

const tierBadge: Record<string, string> = {
  free:       'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  basic:      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  pro:        'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  enterprise: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
}

const kpiTones = [
  {
    wrap: 'border-blue-200 bg-card dark:border-blue-900/40',
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  {
    wrap: 'border-violet-200 bg-card dark:border-violet-900/40',
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    value: 'text-violet-700 dark:text-violet-300',
  },
  {
    wrap: 'border-emerald-200 bg-card dark:border-emerald-900/40',
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    wrap: 'border-amber-200 bg-card dark:border-amber-900/40',
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPYG(amount: number) {
  if (amount === 0) return 'Gratis'
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  helper: string
  icon: React.ComponentType<{ className?: string }>
  tone: number
}) {
  const t = kpiTones[tone]
  return (
    <Card className={cn('rounded-3xl border shadow-xs transition-all duration-200 hover:shadow-md backdrop-blur-md', t.wrap)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className={cn('text-2xl sm:text-3xl font-black tracking-tight', t.value)}>{value}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{helper}</p>
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-xs', t.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FeatureValue({ val }: { val: boolean | string }) {
  if (val === true)
    return (
      <div className="flex justify-center">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-2xs">
          <Check className="h-4 w-4" />
        </div>
      </div>
    )
  if (val === false)
    return (
      <div className="flex justify-center">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
          <Minus className="h-4 w-4" />
        </div>
      </div>
    )
  return (
    <span className="block text-center text-xs font-bold text-slate-700 dark:text-slate-300">
      {val}
    </span>
  )
}

function LimitBar({
  label,
  val,
  accent,
}: {
  label: string
  val: unknown
  accent: string
}) {
  const isUnlimited = String(val).toLowerCase() === 'ilimitado' || val === '∞'
  const numericVal = typeof val === 'number' ? val : parseInt(String(val), 10)
  const hasNumber = !isNaN(numericVal) && numericVal > 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={cn('font-black text-xs', isUnlimited ? 'text-emerald-600 dark:text-emerald-400' : accent)}>
          {isUnlimited ? '∞ Ilimitado' : String(val ?? '–')}
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {isUnlimited ? (
          <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 opacity-80" />
        ) : hasNumber ? (
          <div
            className={cn('h-full rounded-full bg-gradient-to-r', accent.replace('text-', 'from-').replace('-600', '-500').replace('-300', '-400'))}
            style={{ width: `${Math.min(100, (numericVal / 500) * 100)}%` }}
          />
        ) : (
          <div className="h-full w-1/4 rounded-full bg-slate-300 dark:bg-slate-600" />
        )}
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  orgCount,
  onEdit,
  onView,
  onToggleActive,
  onTogglePopular,
}: {
  plan: SubscriptionPlan
  orgCount: number
  onEdit: (p: SubscriptionPlan) => void
  onView: (p: SubscriptionPlan) => void
  onToggleActive: (p: SubscriptionPlan) => void
  onTogglePopular: (p: SubscriptionPlan) => void
}) {
  const Icon = tierIcons[plan.tier] || Package
  const accent = tierAccent[plan.tier] || 'from-slate-400 to-slate-500'
  const accentText = plan.color_config?.accent || 'text-slate-700'
  const badge = tierBadge[plan.tier] || 'bg-slate-100 text-slate-700'
  const inventoryAdminEnabled = Boolean(getCommercialFeatureValue(plan.features, 'inventoryAdmin'))
  const creditsEnabled = Boolean(getCommercialFeatureValue(plan.features, 'credits'))
  const promotionsEnabled = Boolean(getCommercialFeatureValue(plan.features, 'promotions'))
  const securityEnabled = Boolean(getCommercialFeatureValue(plan.features, 'security'))

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-white/95 backdrop-blur-xl transition-all duration-300 hover:shadow-2xl dark:bg-slate-900/90',
        !plan.is_active && 'opacity-65 grayscale',
        plan.is_popular
          ? 'border-violet-400 ring-2 ring-violet-300 shadow-xl dark:border-violet-600 dark:ring-violet-900/40'
          : 'border-slate-200/90 shadow-sm dark:border-slate-800/80',
      )}
    >
      {/* Tier accent bar */}
      <div className={cn('h-2 w-full bg-gradient-to-r', accent)} />

      {/* Popular badge */}
      {plan.is_popular && (
        <div className="absolute right-0 top-2 rounded-bl-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1 shadow-md">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white">
            <Sparkles className="h-3 w-3" />
            Popular
          </span>
        </div>
      )}

      <div className="flex flex-col gap-5 p-6 sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shadow-xs', plan.color_config?.icon || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}>
            <Icon className="h-5 w-5" />
          </div>
          <span className={cn('rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider shadow-2xs', badge)}>
            {plan.name}
          </span>
        </div>

        {/* Price */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-3xl sm:text-4xl font-black tracking-tight', accentText)}>
              {formatPYG(plan.price)}
            </span>
            {plan.price > 0 && (
              <span className="text-xs font-semibold text-slate-400">/mes</span>
            )}
          </div>
          {(plan.trial_days ?? 0) > 0 && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 px-2.5 py-0.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
              <Star className="h-3 w-3 fill-current" />
              Trial {plan.trial_days} días gratis
            </span>
          )}
          <p className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-slate-500 dark:text-slate-400 min-h-[36px]">
            {plan.description}
          </p>
        </div>

        {/* Org count pill */}
        <div className={cn(
          'flex items-center justify-between rounded-md px-4 py-2.5',
          'bg-slate-50 dark:bg-slate-800/50',
          'border border-slate-200/60 dark:border-slate-700/40',
        )}>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Building2 className="h-3.5 w-3.5" />
            Organizaciones activas
          </div>
          <span className={cn('text-xl font-extrabold tabular-nums', accentText)}>{orgCount}</span>
        </div>

        <div className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold',
          inventoryAdminEnabled
            ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-300'
            : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50'
        )}>
          <Boxes className="h-3.5 w-3.5" />
          Inventario avanzado
          <span className="ml-auto">{inventoryAdminEnabled ? 'Incluido' : 'No incluido'}</span>
        </div>

        <div className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold',
          creditsEnabled
            ? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/20 dark:text-cyan-300'
            : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50'
        )}>
          <CreditCard className="h-3.5 w-3.5" />
          Créditos
          <span className="ml-auto">{creditsEnabled ? 'Incluido' : 'No incluido'}</span>
        </div>

        <div className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold',
          promotionsEnabled
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
            : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50'
        )}>
          <TicketPercent className="h-3.5 w-3.5" />
          Promociones
          <span className="ml-auto">{promotionsEnabled ? 'Incluido' : 'No incluido'}</span>
        </div>

        <div className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold',
          securityEnabled
            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300'
            : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50'
        )}>
          <ShieldCheck className="h-3.5 w-3.5" />
          Seguridad
          <span className="ml-auto">{securityEnabled ? 'Incluido' : 'No incluido'}</span>
        </div>

        {/* Limits */}
        <div className="space-y-3">
          {[
            { label: 'Usuarios', val: plan.limits?.users },
            { label: 'Productos', val: plan.limits?.products },
            { label: 'Sucursales', val: plan.limits?.branches },
            { label: 'Reparaciones', val: plan.limits?.repairs },
          ].map(({ label, val }) => (
            <LimitBar key={label} label={label} val={val} accent={accentText} />
          ))}
        </div>

        {/* Highlights */}
        {(plan.highlights || []).length > 0 && (
          <ul className="space-y-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            {(plan.highlights || []).slice(0, 4).map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-slate-600 dark:text-slate-400">
                <CheckCircle2 className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', accentText)} />
                {h}
              </li>
            ))}
          </ul>
        )}

        {/* Quick toggles */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            title={plan.is_active ? 'Desactivar plan' : 'Activar plan'}
            onClick={() => onToggleActive(plan)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
              plan.is_active
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800',
            )}
          >
            {plan.is_active ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
            {plan.is_active ? 'Activo' : 'Inactivo'}
          </button>
          <button
            type="button"
            title={plan.is_popular ? 'Quitar popular' : 'Marcar popular'}
            onClick={() => onTogglePopular(plan)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
              plan.is_popular
                ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400'
                : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800',
            )}
          >
            <Star className={cn('h-3 w-3', plan.is_popular && 'fill-current')} />
            Popular
          </button>
        </div>

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(plan)}
            className="h-9 flex-1 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver detalles
          </Button>
          <Button
            size="sm"
            onClick={() => onEdit(plan)}
            className={cn(
              'h-9 flex-1 gap-1.5 rounded-xl text-xs font-semibold',
              plan.is_popular
                ? 'bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600'
                : '',
            )}
          >
            <Edit2 className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Feature table ────────────────────────────────────────────────────────────

const availableFeatures = [
  { key: 'pos',       label: 'Punto de Venta (POS)',       icon: ShoppingCart },
  { key: 'inventory', label: 'Inventario',                  icon: Boxes        },
  { key: 'inventoryAdmin', label: 'Inventario avanzado',     icon: Boxes        },
  { key: 'users',     label: 'Gestión de usuarios',         icon: Users        },
  { key: 'branches',  label: 'Sucursales múltiples',        icon: Building2    },
  { key: 'repairs',   label: 'Módulo de Reparaciones',      icon: Wrench       },
  { key: 'crm',       label: 'CRM / Gestión de clientes',   icon: Users        },
  { key: 'ecommerce', label: 'Ecommerce & Marketplace',     icon: Globe        },
  { key: 'analytics', label: 'Analytics avanzado',          icon: TrendingUp   },
  { key: 'reports',   label: 'Reportes exportables (CSV/PDF)', icon: Download  },
  { key: 'credits',   label: 'Créditos y cuotas',              icon: CreditCard },
  { key: 'promotions', label: 'Promociones y descuentos',      icon: TicketPercent },
  { key: 'security',   label: 'Seguridad y auditoría',         icon: ShieldCheck },
  { key: 'support',   label: 'Soporte prioritario',         icon: Crown        },
]

function FeatureTableHeader({ plan }: { plan: SubscriptionPlan }) {
  const Icon = tierIcons[plan.tier] || Package
  const accent = tierAccent[plan.tier] || 'from-slate-400 to-slate-500'
  const accentText = plan.color_config?.accent || 'text-slate-700'
  return (
    <th
      className={cn(
        'px-4 py-4 text-center',
        plan.is_popular && 'bg-violet-50/50 dark:bg-violet-950/10',
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <div className={cn('h-1.5 w-12 rounded-full bg-gradient-to-r', accent)} />
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', plan.color_config?.icon || 'bg-slate-100 dark:bg-slate-800')}>
          <Icon className="h-4 w-4" />
        </div>
        <span className={cn('text-xs font-extrabold uppercase tracking-wider', accentText)}>
          {plan.name}
        </span>
        <span className="text-[10px] font-semibold text-slate-400">
          {formatPYG(plan.price)}{plan.price > 0 ? '/mes' : ''}
        </span>
      </div>
    </th>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlansPageContent() {
  const [activeTab, setActiveTab] = useState<'cards' | 'table'>('table')
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [stats, setStats] = useState<SubscriptionPlanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [viewingPlan, setViewingPlan] = useState<SubscriptionPlan | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)

  const loadPlans = async () => {
    setLoading(true)
    const [data, statsData] = await Promise.all([
      getSubscriptionPlans(),
      getSubscriptionPlanStats(),
    ])
    setPlans(data || [])
    setStats(statsData)
    setLoading(false)
  }

  useEffect(() => { loadPlans() }, [])

  function exportJson() {
    if (!plans.length) { toast.error('No hay planes para exportar'); return }
    const blob = new Blob([JSON.stringify(plans, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `planes-saas-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    toast.success(`Exportados ${plans.length} planes`)
  }

  async function handleToggleActive(plan: SubscriptionPlan) {
    setTogglingId(plan.id)
    try {
      await updateSubscriptionPlan(plan.id, { is_active: !plan.is_active })
      toast.success(plan.is_active ? `Plan ${plan.name} desactivado` : `Plan ${plan.name} activado`)
      await loadPlans()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cambiar estado')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleTogglePopular(plan: SubscriptionPlan) {
    setTogglingId(plan.id)
    try {
      await updateSubscriptionPlan(plan.id, { is_popular: !plan.is_popular })
      toast.success(plan.is_popular ? `${plan.name} ya no es el plan popular` : `${plan.name} marcado como popular`)
      await loadPlans()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleToggleFeature(plan: SubscriptionPlan, featureKey: string, featureLabel: string, currentVal: boolean | string) {
    const newFeatures = (plan.features || []).filter((feature) => !isCommercialFeatureLabel(feature.label, featureKey))
    newFeatures.push({ label: featureLabel, value: !Boolean(currentVal) })
    try {
      await updateSubscriptionPlan(plan.id, { features: newFeatures })
      toast.success(`Feature actualizado en ${plan.name}`)
      await loadPlans()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar feature')
    }
  }

  // Computed stats
  const activeCount = plans.filter((p) => p.is_active).length
  const popularPlan = plans.find((p) => p.is_popular)
  // El sistema usa 4 tiers fijos; si ya existen los 4 no se puede crear otro.
  const ALL_TIERS = ['free', 'basic', 'pro', 'enterprise']
  const allTiersUsed = ALL_TIERS.every((t) => plans.some((p) => p.tier === t))
  const mrrFormatted = stats
    ? new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(stats.mrr)
    : '—'
  const mostUsedPlanName = stats?.mostUsedPlan
    ? (plans.find((p) => p.tier.toUpperCase() === stats.mostUsedPlan)?.name ?? stats.mostUsedPlan)
    : (popularPlan?.name ?? '—')

  const kpis = [
    {
      label: 'Planes activos',
      value: loading ? '…' : `${activeCount}/${plans.length}`,
      helper: plans.map((p) => p.name).join(' · ') || 'Sin datos',
      icon: CreditCard,
      tone: 0,
    },
    {
      label: 'Plan más usado',
      value: loading ? '…' : mostUsedPlanName,
      helper: stats ? `${stats.mostUsedPercent}% de ${stats.totalOrgs} organizaciones` : 'Calculando…',
      icon: Star,
      tone: 1,
    },
    {
      label: 'MRR estimado',
      value: loading ? '…' : mrrFormatted,
      helper: stats ? `${stats.activeSubs} suscripciones activas` : '—',
      icon: TrendingUp,
      tone: 2,
    },
    {
      label: 'Trials activos',
      value: loading ? '…' : String(stats?.trialingSubs ?? 0),
      helper: 'Organizaciones en período de prueba',
      icon: Activity,
      tone: 3,
    },
  ]

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'popular'>('all')

  const filteredPlans = plans.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (statusFilter === 'active') return p.is_active
    if (statusFilter === 'inactive') return !p.is_active
    if (statusFilter === 'popular') return p.is_popular
    return true
  })

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* ── Premium Header ── */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="contents">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Superadmin · Facturación · SaaS
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Gestión de Planes SaaS
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Control centralizado sobre precios, límites y módulos activos. Los cambios se sincronizan en tiempo real con la base de datos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadPlans}
              disabled={loading}
              className="h-9 gap-2 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Actualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportJson}
              disabled={loading || plans.length === 0}
              className="h-9 gap-2 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar JSON
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={loading || allTiersUsed}
              title={allTiersUsed ? 'Ya existen los 4 planes (free, basic, pro, enterprise). Editá uno existente.' : undefined}
              className="h-9 gap-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo plan
            </Button>
          </div>
        </div>
      </header>

      {/* ── KPI Cards ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <KPICard key={k.label} {...k} />
        ))}
      </section>

      {/* ── Search, Filters & View Toggle Toolbar ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between">

        {/* Left: View Tabs */}
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-800/70">
          <button
            onClick={() => setActiveTab('cards')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
              activeTab === 'cards'
                ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <CreditCard className="h-3.5 w-3.5 text-violet-500" />
            Pricing Cards
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
              activeTab === 'table'
                ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
            Comparativa & Features
          </button>
        </div>

        {/* Right: Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter chips */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/60">
            {(['all', 'active', 'popular'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setStatusFilter(filterKey)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer',
                  statusFilter === filterKey
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-50'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                {filterKey === 'all' ? 'Todos' : filterKey === 'active' ? 'Activos' : 'Populares'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 pl-1">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Sincronizado
          </div>
        </div>
      </div>

      {/* ── Pricing Cards ── */}
      {activeTab === 'cards' && (
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[520px] w-full rounded-3xl" />
            ))
          ) : filteredPlans.length === 0 ? (
            <div className="col-span-4 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/30">
              <AlertCircle className="h-10 w-10 text-slate-300" />
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300">No se encontraron planes</p>
                <p className="mt-1 text-xs text-slate-400">Ajustá los filtros o creá un nuevo plan</p>
              </div>
            </div>
          ) : (
            filteredPlans.map((plan) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                orgCount={stats?.orgsByPlan?.[plan.tier.toUpperCase()] ?? 0}
                onEdit={(p) => { setEditingPlan(p); setEditOpen(true) }}
                onView={(p) => { setViewingPlan(p); setViewOpen(true) }}
                onToggleActive={togglingId ? () => {} : handleToggleActive}
                onTogglePopular={togglingId ? () => {} : handleTogglePopular}
              />
            ))
          )}
        </section>
      )}

      {/* ── Feature Comparison Table ── */}
      {activeTab === 'table' && (
        <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-lg dark:border-slate-800 dark:bg-slate-900/95">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950 dark:text-slate-50 tracking-tight">
                  Matriz Comparativa de Features y Módulos
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Hacé clic directamente en ✓ o — para activar o desactivar una función en un plan en tiempo real.
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5 rounded-full text-xs font-bold w-fit bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Edición en Vivo
              </Badge>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center p-12">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Funcionalidad
                    </th>
                    {plans.map((p) => (
                      <FeatureTableHeader key={p.tier} plan={p} />
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {availableFeatures.map((feat, i) => {
                    const Icon = feat.icon
                    return (
                      <tr
                        key={feat.key}
                        className={cn(
                          'transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/20',
                          i % 2 !== 0 && 'bg-slate-50/30 dark:bg-slate-900/10',
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                              <Icon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {feat.label}
                            </span>
                          </div>
                        </td>
                        {plans.map((plan) => {
                          const featureVal = getCommercialFeatureValue(plan.features, feat.key)
                          const isBool = typeof featureVal === 'boolean'
                          return (
                            <td
                              key={plan.tier}
                              className={cn(
                                'px-4 py-4',
                                plan.is_popular && 'bg-violet-50/30 dark:bg-violet-950/5',
                              )}
                            >
                              {isBool ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleFeature(plan, feat.key, feat.label, featureVal)
                                  }
                                  title={`${featureVal ? 'Desactivar' : 'Activar'} ${feat.label} en ${plan.name}`}
                                  className="mx-auto flex cursor-pointer items-center justify-center transition-transform hover:scale-110"
                                >
                                  <FeatureValue val={featureVal} />
                                </button>
                              ) : (
                                <FeatureValue val={featureVal} />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {/* ── Sheets ── */}
      <PlanCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={loadPlans}
        existingTiers={plans.map((p) => p.tier)}
      />
      <PlanEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        plan={editingPlan}
        onSuccess={loadPlans}
      />
      <PlanDetailsSheet
        open={viewOpen}
        onOpenChange={setViewOpen}
        plan={viewingPlan}
      />
    </div>
  )
}
