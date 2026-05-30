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
  MessageSquare,
  Minus,
  Package,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wrench,
  Zap,
  Eye,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getSubscriptionPlans, SubscriptionPlan } from '@/services/subscription-plans'
import { PlanEditSheet } from './plan-edit-sheet'
import { PlanDetailsSheet } from './plan-details-sheet'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Constants ───────────────────────────────────────────────────────────────

const tierIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Package,
  basic: CreditCard,
  pro: Star,
  enterprise: Crown,
}

const toneMap = {
  blue: { wrap: 'border-blue-100 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20', icon: 'text-blue-600 dark:text-blue-400', value: 'text-blue-700 dark:text-blue-300' },
  violet: { wrap: 'border-violet-100 bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/20', icon: 'text-violet-600 dark:text-violet-400', value: 'text-violet-700 dark:text-violet-300' },
  emerald: { wrap: 'border-emerald-100 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20', icon: 'text-emerald-600 dark:text-emerald-400', value: 'text-emerald-700 dark:text-emerald-300' },
  amber: { wrap: 'border-amber-100 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20', icon: 'text-amber-600 dark:text-amber-400', value: 'text-amber-700 dark:text-amber-300' },
}

const defaultStats = [
  { label: 'Planes activos', value: '0', helper: 'Cargando...', icon: CreditCard, tone: 'blue' as const },
  { label: 'Plan más popular', value: '-', helper: 'Calculando', icon: Star, tone: 'violet' as const },
  { label: 'MRR estimado', value: '...', helper: 'Promedio por suscripción activa', icon: TrendingUp, tone: 'emerald' as const },
  { label: 'Límites escalables', value: 'Ilimitado', helper: 'En plan ENTERPRISE', icon: Building2, tone: 'amber' as const },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ stat }: { stat: typeof defaultStats[0] }) {
  if (defaultStats.length === 0) return null
  const Icon = stat.icon
  const t = toneMap[stat.tone]
  return (
    <Card className={cn('rounded-2xl border shadow-sm', t.wrap)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {stat.label}
            </p>
            <p className={cn('text-2xl font-bold tracking-tight', t.value)}>{stat.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{stat.helper}</p>
          </div>
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', t.wrap)}>
            <Icon className={cn('h-5 w-5', t.icon)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FeatureValue({ val }: { val: boolean | string }) {
  if (val === true) {
    return (
      <div className="flex justify-center">
        <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
      </div>
    )
  }
  if (val === false) {
    return (
      <div className="flex justify-center">
        <Minus className="h-4 w-4 text-slate-300 dark:text-slate-600" />
      </div>
    )
  }
  return <span className="text-center text-xs text-slate-600 dark:text-slate-400">{val}</span>
}

function PlanCard({ plan, onEdit, onView }: { plan: SubscriptionPlan, onEdit: (p: SubscriptionPlan) => void, onView: (p: SubscriptionPlan) => void }) {
  const Icon = tierIcons[plan.tier] || Package

  return (
    <div
      className={cn(
        'relative flex flex-col gap-5 rounded-2xl border bg-white p-6 transition-all duration-200 hover:shadow-lg dark:bg-slate-900',
        !plan.is_active && 'opacity-70 grayscale',
        plan.is_popular
          ? 'border-violet-300 shadow-md ring-1 ring-violet-200 dark:border-violet-700 dark:ring-violet-800/60'
          : cn('border shadow-sm hover:ring-1', plan.color_config?.border, plan.color_config?.ring),
      )}
    >
      {/* Popular badge */}
      {plan.is_popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md">
            <Sparkles className="h-3 w-3" />
            Más popular
          </span>
        </div>
      )}
      {!plan.is_active && (
        <div className="absolute right-4 top-4">
          <Badge variant="secondary" className="rounded-full border text-[11px] font-semibold">
            Inactivo
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', plan.color_config?.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <Badge
          variant="outline"
          className={cn('rounded-full border-0 text-[11px] font-semibold', plan.color_config?.badge)}
        >
          {plan.name}
        </Badge>
      </div>

      {/* Price */}
      <div>
        <div className="flex items-baseline gap-1">
          <span className={cn('text-4xl font-bold tracking-tight', plan.color_config?.accent)}>${plan.price}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">/{plan.price_note === 'Siempre gratis' ? '' : 'mes'}</span>
        </div>
        {plan.price_note === 'Siempre gratis' ? (
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Siempre gratis</span>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{plan.description}</p>
      </div>

      {/* Limits grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Usuarios', val: plan.limits?.users },
          { label: 'Productos', val: plan.limits?.products },
          { label: 'Sucursales', val: plan.limits?.branches },
          { label: 'Reparaciones', val: plan.limits?.repairs },
        ].map(({ label, val }) => (
          <div key={label} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={cn('mt-0.5 text-sm font-semibold', (plan.color_config as any)?.accent)}>{String(val ?? '–')}</p>
          </div>
        ))}
      </div>

      {/* Highlights */}
      <ul className="space-y-2">
        {(plan.highlights || []).map((h, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <CheckCircle2 className={cn('h-4 w-4 shrink-0', plan.color_config?.accent)} />
            {h}
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="mt-auto pt-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onView(plan)}
          className="flex-1 gap-1.5 rounded-xl text-sm font-medium"
        >
          <Eye className="h-3.5 w-3.5" />
          Detalles
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(plan)}
          className={cn(
            'flex-1 gap-1.5 rounded-xl text-sm font-medium',
            plan.is_popular && 'border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950/30',
          )}
        >
          <Edit2 className="h-3.5 w-3.5" />
          Editar
        </Button>
      </div>
    </div>
  )
}

function FeatureTableHeader({ plan }: { plan: SubscriptionPlan }) {
  const Icon = tierIcons[plan.tier] || Package
  return (
    <th className={cn('px-4 py-3 text-center', plan.is_popular && 'bg-violet-50/60 dark:bg-violet-950/20')}>
      <div className="flex flex-col items-center gap-1">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', plan.color_config?.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className={cn('text-xs font-bold uppercase tracking-wide', plan.color_config?.accent)}>{plan.name}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">${plan.price}/mes</span>
      </div>
    </th>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

const availableFeatures = [
  { key: 'pos', label: 'Punto de Venta (POS)', icon: ShoppingCart },
  { key: 'inventory', label: 'Inventario', icon: Boxes },
  { key: 'users', label: 'Usuarios', icon: Users },
  { key: 'branches', label: 'Sucursales', icon: Building2 },
  { key: 'repairs', label: 'Reparaciones', icon: Wrench },
  { key: 'crm', label: 'Gestión de clientes', icon: Users },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { key: 'ecommerce', label: 'Ecommerce / Marketplace', icon: Globe },
  { key: 'analytics', label: 'Analytics avanzado', icon: TrendingUp },
  { key: 'reports', label: 'Reportes exportables', icon: Download },
  { key: 'api', label: 'API access', icon: Zap },
  { key: 'support', label: 'Soporte', icon: Crown },
]

export function PlansPageContent() {
  const [activeTab, setActiveTab] = useState<'cards' | 'table'>('cards')
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)

  // Edit / View state
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [viewingPlan, setViewingPlan] = useState<SubscriptionPlan | null>(null)
  
  const [editOpen, setEditOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)

  const loadPlans = async () => {
    setLoading(true)
    const data = await getSubscriptionPlans()
    setPlans(data || [])
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlans()
  }, [])

  // Dynamic stats
  const activeCount = plans.filter(p => p.is_active).length
  const popularPlan = plans.find(p => p.is_popular)
  
  const stats = [
    { label: 'Planes activos', value: loading ? '...' : activeCount.toString(), helper: plans.map(p => p.name).join(' · '), icon: CreditCard, tone: 'blue' as const },
    { label: 'Plan más popular', value: loading ? '...' : popularPlan?.name || '-', helper: '~75% de tenants comerciales', icon: Star, tone: 'violet' as const },
    { label: 'MRR estimado', value: '...', helper: 'Promedio por suscripción activa', icon: TrendingUp, tone: 'emerald' as const },
    { label: 'Límites escalables', value: 'Ilimitado', helper: 'En plan ENTERPRISE', icon: Building2, tone: 'amber' as const },
  ]

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-8">
      {/* ── Header ── */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            <Sparkles className="h-3.5 w-3.5" />
            Superadmin · Facturación
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
              Planes SaaS
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Gestión visual de planes y configuración de billing de la plataforma.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadPlans} disabled={loading} className="h-9 gap-2 rounded-xl">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl">
            <Download className="h-4 w-4" />
            Exportar JSON
          </Button>
          <Button size="sm" className="h-9 gap-2 rounded-xl" disabled>
            <Sparkles className="h-4 w-4" />
            Nuevo plan
          </Button>
        </div>
      </header>

      {/* ── Stats ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </section>

      {/* ── Tab toggle ── */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('cards')}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
              activeTab === 'cards'
                ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300',
            )}
          >
            Pricing cards
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
              activeTab === 'table'
                ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300',
            )}
          >
            Comparativa de features
          </button>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Sincronizado con tabla `subscription_plans`
        </p>
      </div>

      {/* ── Pricing Cards ── */}
      {activeTab === 'cards' && (
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[400px] w-full rounded-2xl" />
            ))
          ) : plans.length === 0 ? (
            <div className="col-span-4 p-12 text-center text-slate-500 border rounded-2xl border-dashed">
              No hay planes configurados en la base de datos.
            </div>
          ) : (
            plans.map((plan) => (
              <PlanCard 
                key={plan.tier} 
                plan={plan} 
                onEdit={(p) => {
                  setEditingPlan(p)
                  setEditOpen(true)
                }}
                onView={(p) => {
                  setViewingPlan(p)
                  setViewOpen(true)
                }}
              />
            ))
          )}
        </section>
      )}

      {/* ── Feature Comparison Table ── */}
      {activeTab === 'table' && (
        <Card className="overflow-hidden rounded-3xl border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                  Comparativa completa de features
                </h2>
              </div>
              <Badge variant="outline" className="rounded-full text-xs">
                <ArrowUpRight className="mr-1 h-3 w-3" />
                Sincronizado
              </Badge>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Feature
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
                        key={feat.label}
                        className={cn(
                          'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30',
                          i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-900/20',
                        )}
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Icon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {feat.label}
                            </span>
                          </div>
                        </td>
                        {plans.map((plan) => {
                          const featureVal = plan.features?.find((f) => f.label === feat.label)?.value ?? false
                          return (
                            <td
                              key={plan.tier}
                              className={cn(
                                'px-4 py-3.5',
                                plan.is_popular && 'bg-violet-50/40 dark:bg-violet-950/10',
                              )}
                            >
                              <FeatureValue val={featureVal} />
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

      {/* Sheets */}
      <PlanEditSheet 
        open={editOpen} 
        onOpenChange={setEditOpen} 
        plan={editingPlan} 
        onSuccess={() => loadPlans()}
      />
      
      <PlanDetailsSheet
        open={viewOpen}
        onOpenChange={setViewOpen}
        plan={viewingPlan}
      />
    </div>
  )
}
