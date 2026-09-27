'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SubscriptionPlan } from '@/services/subscription-plans'
import {
  Boxes, Building2, CheckCircle2, CreditCard, Crown,
  Download, Globe, Package, ShoppingCart, Sparkles, Star,
  TrendingUp, Users, Wrench, XCircle,
  TicketPercent,
  ShieldCheck,
  ClipboardList,
  Handshake,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCommercialFeatureValue } from '@/lib/saas/commercial-plan-features'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { bar: string; icon: string; accent: string }> = {
  free:       { bar: 'bg-gradient-to-r from-slate-400 to-slate-500',   icon: 'bg-slate-100 text-slate-600',   accent: 'text-slate-700'   },
  basic:      { bar: 'bg-gradient-to-r from-blue-400 to-blue-600',     icon: 'bg-blue-50 text-blue-600',      accent: 'text-blue-700'    },
  pro:        { bar: 'bg-gradient-to-r from-violet-500 to-purple-700', icon: 'bg-violet-50 text-violet-600',  accent: 'text-violet-700'  },
  enterprise: { bar: 'bg-gradient-to-r from-amber-400 to-orange-500',  icon: 'bg-amber-50 text-amber-600',    accent: 'text-amber-700'   },
}

const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Package, basic: CreditCard, pro: Star, enterprise: Crown,
}

const FEATURE_LIST = [
  { label: 'Punto de Venta (POS)',    icon: ShoppingCart },
  { label: 'Inventario',              icon: Boxes        },
  { label: 'Inventario avanzado',      icon: Boxes        },
  { label: 'Gestión de usuarios',     icon: Users        },
  { label: 'Sucursales múltiples',    icon: Building2    },
  { label: 'Módulo de Reparaciones',  icon: Wrench       },
  { label: 'Servicios',               icon: Handshake    },
  { label: 'Pedidos',                 icon: ClipboardList },
  { label: 'Entregas',                icon: Truck        },
  { label: 'CRM / Clientes',          icon: Users        },
  { label: 'Ecommerce & Marketplace', icon: Globe        },
  { label: 'Analytics avanzado',      icon: TrendingUp   },
  { label: 'Reportes exportables',    icon: Download     },
  { label: 'Créditos y cuotas',       icon: CreditCard   },
  { label: 'Promociones y descuentos', icon: TicketPercent },
  { label: 'Seguridad y auditoría',     icon: ShieldCheck },
  { label: 'Soporte prioritario',     icon: Sparkles     },
]

function formatPYG(amount: number) {
  if (amount === 0) return 'Gratis'
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount)
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  plan: SubscriptionPlan | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlanDetailsSheet({ plan, open, onOpenChange }: Props) {
  if (!plan) return null

  const tierStyle = TIER_STYLES[plan.tier] || TIER_STYLES.basic
  const TierIcon  = TIER_ICONS[plan.tier] || Package

  // Build feature map from plan.features + fallback to FEATURE_LIST
  const enabledFeatures = FEATURE_LIST.filter((feature) => Boolean(getCommercialFeatureValue(plan.features, feature.label)))
  const disabledFeatures = FEATURE_LIST.filter((feature) => !Boolean(getCommercialFeatureValue(plan.features, feature.label)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">

        {/* ── Header ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
          <div className={cn('absolute inset-x-0 top-0 h-1', tierStyle.bar)} />
          <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-white/5 blur-3xl" />

          <DialogHeader className="relative">
            <div className="flex items-center gap-4">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tierStyle.icon)}>
                <TierIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
                  Plan {plan.name}
                  {plan.is_popular && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/40 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                      <Star className="h-2.5 w-2.5 fill-current" /> Popular
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="mt-0.5 flex items-center gap-2 text-slate-400">
                  <span className="font-mono text-[11px] uppercase tracking-widest">{plan.tier}</span>
                  <span>·</span>
                  <span className={cn('text-[11px] font-bold', plan.is_active ? 'text-emerald-400' : 'text-slate-500')}>
                    {plan.is_active ? '● Activo' : '○ Inactivo'}
                  </span>
                </DialogDescription>
              </div>
              <div className="text-right">
                <p className={cn('text-2xl font-extrabold', tierStyle.accent.replace('text-', 'text-white'))}>
                  {formatPYG(plan.price)}
                </p>
                {plan.price > 0 && (
                  <p className="text-[10px] text-slate-400">{plan.price_note || 'por mes'}</p>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ── Body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-5 divide-x divide-slate-100 dark:divide-slate-800">

            {/* Left: commercial info + limits */}
            <div className="col-span-3 space-y-6 p-6">

              {/* Description */}
              {plan.description && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Descripción</p>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{plan.description}</p>
                </div>
              )}

              {/* Limits */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Límites del sistema</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(plan.limits || {}).map(([key, value]) => {
                    const isUnlimited = String(value).toLowerCase() === 'ilimitado' || String(value) === '∞'
                    return (
                      <div key={key} className={cn(
                        'rounded-xl border p-3',
                        isUnlimited
                          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20'
                          : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900',
                      )}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 capitalize">{key}</p>
                        <p className={cn('mt-0.5 text-base font-extrabold', isUnlimited ? 'text-emerald-600' : tierStyle.accent)}>
                          {isUnlimited ? '∞' : String(value)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Highlights */}
              {(plan.highlights || []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Puntos destacados</p>
                  <ul className="space-y-1.5">
                    {plan.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <CheckCircle2 className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', tierStyle.accent)} />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Technical info */}
              <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900/40">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Info técnica</p>
                <dl className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">ID</dt>
                    <dd className="truncate font-mono text-slate-600 dark:text-slate-400">{plan.id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Trial</dt>
                    <dd className="font-semibold text-slate-600 dark:text-slate-400">
                      {(plan.trial_days ?? 0) > 0 ? `${plan.trial_days} días` : 'Sin trial'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Actualizado</dt>
                    <dd className="text-slate-600 dark:text-slate-400">
                      {new Date(plan.updated_at).toLocaleDateString('es-PY')}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Right: features */}
            <div className="col-span-2 p-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Módulos · <span className="text-emerald-500">{enabledFeatures.length}</span>/{FEATURE_LIST.length}
              </p>

              {/* Enabled */}
              {enabledFeatures.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {enabledFeatures.map(({ label, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">{label}</span>
                      <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    </div>
                  ))}
                </div>
              )}

              {/* Disabled */}
              {disabledFeatures.length > 0 && (
                <div className="space-y-1.5">
                  {disabledFeatures.map(({ label, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 opacity-50 dark:border-slate-800 dark:bg-slate-900/40">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="text-[11px] text-slate-500">{label}</span>
                      <XCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-300" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
